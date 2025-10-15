package releasemanager

import (
	"context"
	"errors"
	"fmt"
	"workspace-engine/pkg/changeset"
	"workspace-engine/pkg/workspace/releasemanager/policymanager"
	"workspace-engine/pkg/workspace/releasemanager/targetsmanager"
	"workspace-engine/pkg/workspace/releasemanager/variablemanager"
	"workspace-engine/pkg/workspace/releasemanager/versionmanager"
	"workspace-engine/pkg/workspace/store"

	"sync"
	"time"
	"workspace-engine/pkg/cmap"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/jobdispatch"

	"github.com/charmbracelet/log"
	"github.com/google/uuid"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"
)

// Manager handles the business logic for release target changes and deployment decisions
type Manager struct {
	store *store.Store

	targetsManager  *targetsmanager.Manager
	versionManager  *versionmanager.Manager
	variableManager *variablemanager.Manager
	policyManager   *policymanager.Manager

	releaseTargetLocks sync.Map
}

// New creates a new release manager for a workspace
func New(store *store.Store) *Manager {
	return &Manager{
		store:           store,
		targetsManager:  targetsmanager.New(store),
		policyManager:   policymanager.New(store),
		versionManager:  versionmanager.New(store),
		variableManager: variablemanager.New(store),

		releaseTargetLocks: sync.Map{},
	}
}

// Design Pattern: Two-Phase Deployment Decision
//
// This file implements a clear separation between DECISION and ACTION:
//
// ┌─────────────────────────────────────────────────────────────┐
// │ Phase 1: DECISION (Evaluate)                                │
// │ - Answers: "What needs to be deployed?"                     │
// │ - READ-ONLY: examines all state without writing             │
// │ - Returns: release to deploy OR nil if nothing needed       │
// │                                                              │
// │ Why nil?                                                     │
// │   • No versions available                                   │
// │   • All versions blocked by policies                        │
// │   • Already deployed (most recent job is for this release)  │
// └─────────────────────────────────────────────────────────────┘
//                            ↓
// ┌─────────────────────────────────────────────────────────────┐
// │ Phase 2: ACTION (executeDeployment)                         │
// │ - Answers: "Make it happen"                                 │
// │ - WRITES: persists release, creates jobs, dispatches        │
// │ - Precondition: Evaluate() determined deployment needed     │
// │ - No additional "should we deploy" checks here              │
// └─────────────────────────────────────────────────────────────┘
//
// Contract: If Evaluate() returns a release, deploy it. Trust the decision phase.

var tracer = otel.Tracer("workspace/releasemanager")

// ProcessChanges handles detected changes to release targets (WRITES TO STORE).
// Reconciles added/tainted targets (triggers deployments) and removes deleted targets.
// Returns a map of cancelled jobs (for removed targets).
func (m *Manager) ProcessChanges(ctx context.Context, changes *changeset.ChangeSet[any]) (cmap.ConcurrentMap[string, *oapi.Job], error) {
	ctx, span := tracer.Start(ctx, "ProcessChanges")
	defer span.End()

	targetChanges, err := m.targetsManager.DetectChanges(ctx, changes)
	if err != nil {
		log.Error("error detecting changes to release targets", "error", err.Error())
		span.RecordError(err)
		span.SetStatus(codes.Error, "failed to detect changes to release targets")
		return cmap.New[*oapi.Job](), err
	}

	if err := m.targetsManager.RefreshTargets(ctx); err != nil {
		log.Error("error refreshing targets cache", "error", err.Error())
		span.RecordError(err)
		span.SetStatus(codes.Error, "failed to refresh targets cache")
		return cmap.New[*oapi.Job](), err
	}

	cancelledJobs := cmap.New[*oapi.Job]()
	var wg sync.WaitGroup

	added := targetChanges.Process().FilterByType(changeset.ChangeTypeCreate).CollectEntities()
	tainted := targetChanges.Process().FilterByType(changeset.ChangeTypeTaint).CollectEntities()
	allToProcess := append(added, tainted...)

	// Process added release targets
	for _, rt := range allToProcess {
		wg.Add(1)
		go func(target *oapi.ReleaseTarget) {
			defer wg.Done()
			if err := m.ReconcileTarget(ctx, target); err != nil {
				log.Warn("error reconciling release target", "error", err.Error())
			}
		}(rt)
	}

	removed := targetChanges.Process().FilterByType(changeset.ChangeTypeDelete).CollectEntities()

	// Cancel jobs for removed release targets
	for _, rt := range removed {
		wg.Add(1)
		go func(target *oapi.ReleaseTarget) {
			defer wg.Done()
			for _, job := range m.store.Jobs.GetJobsForReleaseTarget(target) {
				if job != nil {
					job.Status = oapi.Cancelled
					job.UpdatedAt = time.Now()
					cancelledJobs.Set(job.Id, job)
				}
			}
		}(rt)
	}

	wg.Wait()
	return cancelledJobs, nil
}

// ReconcileTarget ensures a release target is in its desired state (WRITES TO STORE).
// Uses a two-phase approach: plan what to deploy, then execute the deployment.
//
// Two-Phase Design:
// Phase 1: DECISION - planDeployment() answers "What needs deploying?" (read-only)
// Phase 2: ACTION   - executeRelease() creates the job and deploys (writes)
//
// If planDeployment() returns nil → Nothing to deploy (already deployed, no versions, or blocked)
// If planDeployment() returns release → Deploy it (planning phase already validated everything)
func (m *Manager) ReconcileTarget(ctx context.Context, releaseTarget *oapi.ReleaseTarget) error {
	ctx, span := tracer.Start(ctx, "ReconcileTarget")
	defer span.End()

	targetKey := releaseTarget.Key()
	lockInterface, _ := m.releaseTargetLocks.LoadOrStore(targetKey, &sync.Mutex{})

	lock := lockInterface.(*sync.Mutex)

	// Serialize processing for this specific release target
	lock.Lock()
	defer lock.Unlock()

	// Phase 1: DECISION - What needs deploying? (READ-ONLY)
	releaseToDeploy, err := m.planDeployment(ctx, releaseTarget)
	if err != nil {
		span.RecordError(err)
		return err
	}

	// Nothing to deploy - planDeployment() already checked all conditions
	if releaseToDeploy == nil {
		span.SetAttributes(attribute.Bool("deployment.needed", false))
		return nil
	}

	// Phase 2: ACTION - Deploy it (WRITES)
	return m.executeRelease(ctx, releaseToDeploy)
}

// executeRelease performs all write operations to deploy a release (WRITES TO STORE).
// Precondition: planDeployment() has already determined this release NEEDS to be deployed.
// No additional "should we deploy" checks here - trust the planning phase.
func (m *Manager) executeRelease(ctx context.Context, releaseToDeploy *oapi.Release) error {
	ctx, span := tracer.Start(ctx, "executeRelease")
	defer span.End()

	// Step 1: Persist the release (WRITE)
	if err := m.store.Releases.Upsert(ctx, releaseToDeploy); err != nil {
		span.RecordError(err)
		return err
	}

	// Step 2: Cancel outdated jobs for this release target (WRITES)
	// Cancel any pending/in-progress jobs for different releases (outdated versions)
	m.cancelOutdatedJobs(ctx, releaseToDeploy)

	// Step 3: Create and persist new job (WRITE)
	newJob, err := m.createJobForRelease(ctx, releaseToDeploy)
	if err != nil {
		span.RecordError(err)
		return err
	}

	m.store.Jobs.Upsert(ctx, newJob)
	span.SetAttributes(
		attribute.Bool("job.created", true),
		attribute.String("job.id", newJob.Id),
	)

	// Step 4: Dispatch job to integration (ASYNC)
	go func() {
		if err := m.dispatchJobToAgent(ctx, newJob); err != nil && !errors.Is(err, ErrUnsupportedJobAgent) {
			log.Error("error dispatching job to integration", "error", err.Error())
		}
	}()

	return nil
}

// cancelOutdatedJobs cancels jobs for outdated releases (WRITES TO STORE).
func (m *Manager) cancelOutdatedJobs(ctx context.Context, desiredRelease *oapi.Release) {
	ctx, span := tracer.Start(ctx, "cancelOutdatedJobs")
	defer span.End()

	jobs := m.store.Jobs.GetJobsForReleaseTarget(&desiredRelease.ReleaseTarget)

	for _, job := range jobs {
		if job.Status == oapi.Pending {
			job.Status = oapi.Cancelled
			job.UpdatedAt = time.Now()
			m.store.Jobs.Upsert(ctx, job)
		}
	}
}

// planDeployment determines what release (if any) should be deployed for a target (READ-ONLY).
//
// Planning Logic - Returns nil if ANY of these are true:
//  1. No versions available for this deployment
//  2. All versions are blocked by policies
//  3. Latest passing version is already deployed (most recent successful job)
//  4. Job already in progress for this release (pending/in-progress job exists)
//
// Returns:
//   - *oapi.Release: This release should be deployed (caller should create a job for it)
//   - nil: No deployment needed (see planning logic above)
//   - error: Planning failed
//
// Design Pattern: Two-Phase Deployment (DECISION Phase)
// This function only READS state and makes decisions. No writes occur here.
// If this returns a release, executeRelease() will handle the actual deployment.
func (m *Manager) planDeployment(ctx context.Context, releaseTarget *oapi.ReleaseTarget) (*oapi.Release, error) {
	ctx, span := tracer.Start(ctx, "planDeployment",
		trace.WithAttributes(
			attribute.String("deployment.id", releaseTarget.DeploymentId),
			attribute.String("environment.id", releaseTarget.EnvironmentId),
			attribute.String("resource.id", releaseTarget.ResourceId),
		))
	defer span.End()

	// Step 1: Get candidate versions (sorted newest to oldest)
	candidateVersions := m.versionManager.GetCandidateVersions(ctx, releaseTarget)
	if len(candidateVersions) == 0 {
		return nil, nil
	}

	// Step 2: Find first version that passes ALL policies
	deployableVersion := m.findDeployableVersion(ctx, candidateVersions, releaseTarget)
	if deployableVersion == nil {
		return nil, nil
	}

	// Step 3: Resolve variables for this deployment
	resolvedVariables, err := m.variableManager.Evaluate(ctx, releaseTarget)
	if err != nil {
		span.RecordError(err)
		return nil, err
	}

	// Step 4: Construct the desired release
	desiredRelease := buildRelease(ctx, releaseTarget, deployableVersion, resolvedVariables)

	policyDecision, err := m.policyManager.EvaluateRelease(ctx, desiredRelease)
	if err != nil {
		span.RecordError(err)
		return nil, err
	}

	if !policyDecision.CanDeploy() {
		return nil, nil
	}

	// This release needs to be deployed!
	span.SetAttributes(attribute.Bool("needs_deployment", true))
	return desiredRelease, nil
}

// findDeployableVersion finds the first version that passes all policies (READ-ONLY).
// Returns nil if all versions are blocked by policies.
func (m *Manager) findDeployableVersion(
	ctx context.Context,
	candidateVersions []*oapi.DeploymentVersion,
	releaseTarget *oapi.ReleaseTarget,
) *oapi.DeploymentVersion {
	ctx, span := tracer.Start(ctx, "findDeployableVersion")
	defer span.End()

	versionsEvaluated := 0

	for _, version := range candidateVersions {
		versionsEvaluated++

		policyDecision, err := m.policyManager.EvaluateVersion(ctx, version, releaseTarget)
		if err != nil {
			span.RecordError(err)
			continue // Skip this version on error
		}

		if policyDecision.CanDeploy() {
			span.SetAttributes(
				attribute.String("selected.version.id", version.Id),
				attribute.String("selected.version.tag", version.Tag),
				attribute.Int("versions.evaluated", versionsEvaluated),
			)
			return version
		}
	}

	// All versions blocked by policies
	span.SetAttributes(
		attribute.Bool("all_versions_blocked", true),
		attribute.Int("versions.evaluated", versionsEvaluated),
	)
	return nil
}

// createJobForRelease creates a job for a given release (PURE FUNCTION, NO WRITES).
// The job is configured with merged settings from JobAgent + Deployment.
func (m *Manager) createJobForRelease(ctx context.Context, release *oapi.Release) (*oapi.Job, error) {
	_, span := tracer.Start(ctx, "createJobForRelease",
		trace.WithAttributes(
			attribute.String("deployment.id", release.ReleaseTarget.DeploymentId),
			attribute.String("environment.id", release.ReleaseTarget.EnvironmentId),
			attribute.String("resource.id", release.ReleaseTarget.ResourceId),
			attribute.String("version.id", release.Version.Id),
			attribute.String("version.tag", release.Version.Tag),
		))
	defer span.End()

	releaseTarget := release.ReleaseTarget

	// Lookup deployment
	deployment, exists := m.store.Deployments.Get(releaseTarget.DeploymentId)
	if !exists {
		return nil, fmt.Errorf("deployment %s not found", releaseTarget.DeploymentId)
	}

	// Validate job agent exists
	jobAgentId := deployment.JobAgentId
	if jobAgentId == nil || *jobAgentId == "" {
		return nil, fmt.Errorf("deployment %s has no job agent configured", deployment.Id)
	}

	jobAgent, exists := m.store.JobAgents.Get(*jobAgentId)
	if !exists {
		return nil, fmt.Errorf("job agent %s not found", *jobAgentId)
	}

	// Merge job agent config: deployment config overrides agent defaults
	mergedConfig := make(map[string]any)
	DeepMerge(mergedConfig, jobAgent.Config)
	DeepMerge(mergedConfig, deployment.JobAgentConfig)

	return &oapi.Job{
		Id:             uuid.New().String(),
		ReleaseId:      release.ID(),
		JobAgentId:     *jobAgentId,
		JobAgentConfig: mergedConfig,
		Status:         oapi.Pending,
		CreatedAt:      time.Now(),
		UpdatedAt:      time.Now(),
	}, nil
}

var ErrUnsupportedJobAgent = errors.New("job agent not supported")

// dispatchJobToAgent sends a job to the configured job agent for execution.
func (m *Manager) dispatchJobToAgent(ctx context.Context, job *oapi.Job) error {
	jobAgent, exists := m.store.JobAgents.Get(job.JobAgentId)
	if !exists {
		return fmt.Errorf("job agent %s not found", job.JobAgentId)
	}

	if jobAgent.Type == string(jobdispatch.JobAgentTypeGithub) {
		return jobdispatch.NewGithubDispatcher(m.store.Repo()).DispatchJob(ctx, job)
	}

	return ErrUnsupportedJobAgent
}
