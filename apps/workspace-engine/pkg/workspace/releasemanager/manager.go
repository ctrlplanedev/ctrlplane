package releasemanager

import (
	"context"
	"fmt"
	"sync"
	"time"

	"workspace-engine/pkg/changeset"
	"workspace-engine/pkg/cmap"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/releasemanager/deployment"
	"workspace-engine/pkg/workspace/releasemanager/policy"
	"workspace-engine/pkg/workspace/releasemanager/targets"
	"workspace-engine/pkg/workspace/releasemanager/variables"
	"workspace-engine/pkg/workspace/releasemanager/versions"
	"workspace-engine/pkg/workspace/store"

	"github.com/charmbracelet/log"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/codes"
)

// Manager handles the business logic for release target changes and deployment decisions.
// It orchestrates deployment planning, job eligibility checking, execution, and job management.
type Manager struct {
	store *store.Store

	// Sub-managers
	targetsManager *targets.Manager

	// Deployment components
	planner               *deployment.Planner
	jobEligibilityChecker *deployment.JobEligibilityChecker
	executor              *deployment.Executor

	// Concurrency control
	releaseTargetLocks sync.Map
}

var tracer = otel.Tracer("workspace/releasemanager")

// New creates a new release manager for a workspace.
func New(store *store.Store) *Manager {
	targetsManager := targets.New(store)
	policyManager := policy.New(store)
	versionManager := versions.New(store)
	variableManager := variables.New(store)

	return &Manager{
		store:                 store,
		targetsManager:        targetsManager,
		planner:               deployment.NewPlanner(store, policyManager, versionManager, variableManager),
		jobEligibilityChecker: deployment.NewJobEligibilityChecker(store),
		executor:              deployment.NewExecutor(store),
		releaseTargetLocks:    sync.Map{},
	}
}

// ============================================================================
// Public API
// ============================================================================

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
	removed := targetChanges.Process().FilterByType(changeset.ChangeTypeDelete).CollectEntities()
	allToProcess := append(added, tainted...)

	targetChanges.Finalize()
	for _, change := range targetChanges.Changes {
		changes.Record(change.Type, change.Entity)
	}

	// Process added/tainted release targets
	for _, rt := range allToProcess {
		wg.Add(1)
		go func(target *oapi.ReleaseTarget) {
			defer wg.Done()
			if err := m.reconcileTarget(ctx, target, false); err != nil {
				log.Warn("error reconciling release target", "error", err.Error())
			}
		}(rt)
	}

	// Cancel jobs for removed release targets
	// Only cancel jobs that are in processing states (Pending, InProgress, ActionRequired)
	// Jobs in exited states (Successful, Failure, InvalidJobAgent, etc.) should never be modified
	for _, rt := range removed {
		wg.Add(1)
		go func(target *oapi.ReleaseTarget) {
			defer wg.Done()
			for _, job := range m.store.Jobs.GetJobsForReleaseTarget(target) {
				if job != nil && job.IsInProcessingState() {
					job.Status = oapi.Cancelled
					job.UpdatedAt = time.Now()
					cancelledJobs.Set(job.Id, job)
				}
			}
		}(rt)
	}

	wg.Wait()

	cancelledJobs.IterCb(func(_ string, job *oapi.Job) {
		changes.Record(changeset.ChangeTypeUpdate, job)
	})

	return cancelledJobs, nil
}

// Redeploy forces a new deployment for a release target, skipping eligibility checks (WRITES TO STORE).
// This is useful for manually triggered redeployments where you want to create a new job
// regardless of retry limits, previous attempts, or other eligibility criteria.
//
// Unlike ProcessChanges which respects eligibility rules, Redeploy always attempts to create a new job
// as long as there is a valid desired release (determined by planning phase) AND no job is currently
// in a processing state.
//
// Returns error if:
//   - A job is already in progress for this release target
//   - Planning fails
//   - Execution fails (job creation, persistence, etc.)
//
// Returns nil without error if:
//   - No desired release (no versions available or blocked by user policies)
func (m *Manager) Redeploy(ctx context.Context, releaseTarget *oapi.ReleaseTarget) error {
	ctx, span := tracer.Start(ctx, "Redeploy")
	defer span.End()

	// Check if there's already a job in progress for this release target
	inProgressJobs := m.store.Jobs.GetJobsInProcessingStateForReleaseTarget(releaseTarget)
	if len(inProgressJobs) > 0 {
		// Get the first in-progress job for logging
		var jobId string
		var jobStatus oapi.JobStatus
		for _, job := range inProgressJobs {
			jobId = job.Id
			jobStatus = job.Status
			break
		}

		err := fmt.Errorf("cannot redeploy: job %s already in progress (status: %s)", jobId, jobStatus)
		span.RecordError(err)
		span.SetStatus(codes.Error, "job in progress")
		log.Warn("Redeploy blocked: job already in progress",
			"releaseTargetKey", releaseTarget.Key(),
			"jobId", jobId,
			"jobStatus", jobStatus)
		return err
	}

	return m.reconcileTarget(ctx, releaseTarget, true)
}

// reconcileTarget ensures a release target is in its desired state (WRITES TO STORE).
// Uses a three-phase deployment pattern: planning, eligibility checking, and execution.
//
// Three-Phase Design:
//
//	Phase 1 (PLANNING): planner.PlanDeployment() - "What should be deployed?" (read-only)
//	  Determines the desired release based on versions, variables, and user-defined policies.
//	  User policies: approval requirements, environment progression, etc.
//
//	Phase 2 (ELIGIBILITY): jobEligibilityChecker.ShouldCreateJob() - "Should we create a job?" (read-only)
//	  System-level checks for job creation: retry logic, duplicate prevention, etc.
//	  This is separate from user policies - it's about when to create jobs.
//	  Can be skipped when forceRedeploy is true (e.g., for explicit redeploy operations).
//
//	Phase 3 (EXECUTION): executor.ExecuteRelease() - "Create the job" (writes)
//	  Persists release, creates job, dispatches to integration.
//
// Parameters:
//   - forceRedeploy: if true, skips eligibility checks and always creates a new job
//
// Returns early if:
//   - No desired release (no versions available or blocked by user policies)
//   - Job should not be created (already attempted, retry limit exceeded, etc.) - unless forceRedeploy is true
func (m *Manager) reconcileTarget(ctx context.Context, releaseTarget *oapi.ReleaseTarget, forceRedeploy bool) error {
	ctx, span := tracer.Start(ctx, "ReconcileTarget")
	defer span.End()

	targetKey := releaseTarget.Key()
	lockInterface, _ := m.releaseTargetLocks.LoadOrStore(targetKey, &sync.Mutex{})
	lock := lockInterface.(*sync.Mutex)

	// Serialize processing for this specific release target
	lock.Lock()
	defer lock.Unlock()

	// Phase 1: PLANNING - What should be deployed? (READ-ONLY)
	desiredRelease, err := m.planner.PlanDeployment(ctx, releaseTarget)
	if err != nil {
		span.RecordError(err)
		return err
	}

	// No desired release (no versions or blocked by user policies)
	if desiredRelease == nil {
		return nil
	}

	// Phase 2: ELIGIBILITY - Should we create a job for this release? (READ-ONLY)
	// Skip eligibility check if this is a forced redeploy
	if !forceRedeploy {
		shouldCreate, _, err := m.jobEligibilityChecker.ShouldCreateJob(ctx, desiredRelease)
		if err != nil {
			span.RecordError(err)
			return err
		}

		// Job should not be created (retry limit, already attempted, etc.)
		if !shouldCreate {
			return nil
		}
	}

	// Phase 3: EXECUTION - Create the job (WRITES)
	return m.executor.ExecuteRelease(ctx, desiredRelease)
}

func (m *Manager) GetReleaseTargetState(ctx context.Context, releaseTarget *oapi.ReleaseTarget) (*oapi.ReleaseTargetState, error) {
	// Get current release (may be nil if no successful jobs exist)
	currentRelease, _, err := m.store.ReleaseTargets.GetCurrentRelease(ctx, releaseTarget)
	if err != nil {
		// No successful job found is not an error condition - it just means no current release
		log.Debug("no current release for release target", "error", err.Error())
		currentRelease = nil
	}

	// Get desired release (may be nil if no versions available or blocked by policies)
	desiredRelease, err := m.planner.PlanDeployment(ctx, releaseTarget)
	if err != nil {
		log.Error("error planning deployment for release target", "error", err.Error())
		return nil, err
	}

	latestJob, _ := m.store.ReleaseTargets.GetLatestJob(ctx, releaseTarget)

	rts := &oapi.ReleaseTargetState{
		DesiredRelease: desiredRelease,
		CurrentRelease: currentRelease,
		LatestJob:      latestJob,
	}

	return rts, nil
}
