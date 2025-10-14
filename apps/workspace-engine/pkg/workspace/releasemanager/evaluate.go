package releasemanager

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

import (
	"context"
	"fmt"

	"sync"
	"time"
	"workspace-engine/pkg/cmap"
	"workspace-engine/pkg/oapi"
	jobdispatch "workspace-engine/pkg/workspace/job-dispatch"

	"github.com/charmbracelet/log"
	"github.com/google/uuid"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

var tracer = otel.Tracer("workspace/releasemanager")

// EvaluateChange processes detected changes to release targets (WRITES TO STORE).
// Handles added, updated, and removed release targets concurrently.
// Returns a map of cancelled jobs (for removed targets).
func (m *Manager) EvaluateChange(ctx context.Context, changes *SyncResult) cmap.ConcurrentMap[string, *oapi.Job] {
	ctx, span := tracer.Start(ctx, "EvaluateChange")
	defer span.End()

	cancelledJobs := cmap.New[*oapi.Job]()
	var wg sync.WaitGroup

	// Combine Added and Tainted release targets for processing
	allToProcess := append(changes.Changes.Added, changes.Changes.Tainted...)

	// Process added release targets
	for _, rt := range allToProcess {
		wg.Add(1)
		go func(target *oapi.ReleaseTarget) {
			defer wg.Done()
			if err := m.ProcessReleaseTarget(ctx, target); err != nil {
				log.Warn("error processing added release target", "error", err.Error())
			}
		}(rt)
	}

	// Cancel jobs for removed release targets
	for _, rt := range changes.Changes.Removed {
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
	return cancelledJobs
}

// ProcessReleaseTarget orchestrates the full deployment lifecycle (WRITES TO STORE).
//
// Two-Phase Design:
// Phase 1: DECISION - Evaluate() answers "What needs deploying?" (read-only)
// Phase 2: ACTION  - ProcessReleaseTarget() executes the deployment (writes)
//
// If Evaluate() returns nil → Nothing to deploy (already deployed, no versions, or blocked)
// If Evaluate() returns release → Deploy it (Evaluate() already checked everything)
func (m *Manager) ProcessReleaseTarget(ctx context.Context, releaseTarget *oapi.ReleaseTarget) error {
	targetKey := releaseTarget.Key()
	lockInterface, _ := m.releaseTargetLocks.LoadOrStore(targetKey, &sync.Mutex{})
	lock := lockInterface.(*sync.Mutex)

	// Serialize processing for this specific release target
	lock.Lock()
	defer lock.Unlock()

	ctx, span := tracer.Start(ctx, "ProcessReleaseTarget")
	defer span.End()

	// Phase 1: DECISION - What needs deploying? (READ-ONLY)
	releaseToDeploy, err := m.evaluate(ctx, releaseTarget)
	if err != nil {
		span.RecordError(err)
		return err
	}

	// Nothing to deploy - Evaluate() already checked all conditions
	if releaseToDeploy == nil {
		span.SetAttributes(attribute.Bool("deployment.needed", false))
		return nil
	}

	// Phase 2: ACTION - Deploy it (WRITES)
	return m.executeDeployment(ctx, releaseToDeploy)
}

// executeDeployment performs all write operations to deploy a release (WRITES TO STORE).
// Precondition: Evaluate() has already determined this release NEEDS to be deployed.
// No additional "should we deploy" checks here - trust the decision phase.
func (m *Manager) executeDeployment(ctx context.Context, releaseToDeploy *oapi.Release) error {
	ctx, span := tracer.Start(ctx, "executeDeployment")
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
	newJob, err := m.NewJob(ctx, releaseToDeploy)
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
		if err := m.IntegrationDispatch(ctx, newJob); err != nil {
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

// Evaluate answers: "What needs to be deployed?" (READ-ONLY, NO WRITES)
//
// Decision Logic - Returns nil if ANY of these are true:
//  1. No versions available for this deployment
//  2. All versions are blocked by policies
//  3. Latest passing version is already deployed (most recent successful job)
//  4. Job already in progress for this release (pending/in-progress job exists)
//
// Returns:
//   - *oapi.Release: This release NEEDS to be deployed (definitely needs a new job)
//   - nil: No deployment needed (see decision logic above)
//   - error: Evaluation failed
//
// Design Pattern: Two-Phase Deployment
//
//	Phase 1 (this function): DECISION - read all state, determine if deployment needed
//	Phase 2 (executeDeployment): ACTION - write operations to make it happen
//
// Trust the contract: If this returns a release, caller should deploy it without additional checks.
func (m *Manager) evaluate(ctx context.Context, releaseTarget *oapi.ReleaseTarget) (*oapi.Release, error) {
	ctx, span := tracer.Start(ctx, "Evaluate",
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
	deployableVersion := m.selectDeployableVersion(ctx, candidateVersions, releaseTarget)
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

// selectDeployableVersion finds the first version that passes all policies (READ-ONLY).
// Returns nil if all versions are blocked by policies.
func (m *Manager) selectDeployableVersion(
	ctx context.Context,
	candidateVersions []*oapi.DeploymentVersion,
	releaseTarget *oapi.ReleaseTarget,
) *oapi.DeploymentVersion {
	ctx, span := tracer.Start(ctx, "selectDeployableVersion")
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

func buildRelease(
	ctx context.Context,
	releaseTarget *oapi.ReleaseTarget,
	version *oapi.DeploymentVersion,
	variables map[string]*oapi.LiteralValue,
) *oapi.Release {
	_, span := tracer.Start(ctx, "buildRelease",
		trace.WithAttributes(
			attribute.String("deployment.id", releaseTarget.DeploymentId),
			attribute.String("environment.id", releaseTarget.EnvironmentId),
			attribute.String("resource.id", releaseTarget.ResourceId),
			attribute.String("version.id", version.Id),
			attribute.String("version.tag", version.Tag),
			attribute.String("variables.count", fmt.Sprintf("%d", len(variables))),
		))
	defer span.End()

	// Clone variables to avoid mutations affecting this release
	clonedVariables := make(map[string]oapi.LiteralValue, len(variables))
	for key, value := range variables {
		if value != nil {
			clonedVariables[key] = *value
		}
	}

	return &oapi.Release{
		ReleaseTarget:      *releaseTarget,
		Version:            *version,
		Variables:          clonedVariables,
		EncryptedVariables: []string{}, // TODO: Handle encrypted variables
		CreatedAt:          time.Now().Format(time.RFC3339),
	}
}

func DeepMerge(dst, src map[string]any) {
	for k, v := range src {
		if sm, ok := v.(map[string]any); ok {
			if dm, ok := dst[k].(map[string]any); ok {
				DeepMerge(dm, sm)
				continue
			}
		}
		dst[k] = v // overwrite
	}
}

// NewJob creates a job for a given release (PURE FUNCTION, NO WRITES).
// The job is configured with merged settings from JobAgent + Deployment.
func (m *Manager) NewJob(ctx context.Context, release *oapi.Release) (*oapi.Job, error) {
	_, span := tracer.Start(ctx, "NewJob",
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

func (m *Manager) IntegrationDispatch(ctx context.Context, job *oapi.Job) error {
	jobAgent, exists := m.store.JobAgents.Get(job.JobAgentId)
	if !exists {
		return fmt.Errorf("job agent %s not found", job.JobAgentId)
	}

	if jobAgent.Type == string(jobdispatch.JobAgentTypeGithub) {
		return jobdispatch.NewGithubDispatcher(m.store.Repo()).DispatchJob(ctx, job)
	}

	if jobAgent.Type == string(jobdispatch.JobAgentTypeTest) {
		return nil
	}

	return fmt.Errorf("job agent %s not supported", job.JobAgentId)
}
