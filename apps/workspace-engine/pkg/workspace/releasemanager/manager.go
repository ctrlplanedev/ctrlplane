package releasemanager

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/statechange"
	"workspace-engine/pkg/workspace/releasemanager/deployment"
	"workspace-engine/pkg/workspace/releasemanager/policy"
	"workspace-engine/pkg/workspace/releasemanager/variables"
	"workspace-engine/pkg/workspace/releasemanager/versions"
	"workspace-engine/pkg/workspace/store"

	"github.com/charmbracelet/log"
	"github.com/dgraph-io/ristretto/v2"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"
)

// Manager handles the business logic for release target changes and deployment decisions.
// It orchestrates deployment planning, job eligibility checking, execution, and job management.
type Manager struct {
	store *store.Store

	// Deployment components
	planner               *deployment.Planner
	jobEligibilityChecker *deployment.JobEligibilityChecker
	executor              *deployment.Executor

	// Concurrency control
	releaseTargetLocks sync.Map

	releaseTargetStateCache *ristretto.Cache[string, *oapi.ReleaseTargetState]
}

var tracer = otel.Tracer("workspace/releasemanager")

// New creates a new release manager for a workspace.
func New(store *store.Store) *Manager {
	policyManager := policy.New(store)
	versionManager := versions.New(store)
	variableManager := variables.New(store)

	stateCacheConfig := &ristretto.Config[string, *oapi.ReleaseTargetState]{
		NumCounters: 1e7,     // 10M keys
		MaxCost:     1 << 30, // 1GB
		BufferItems: 64,
	}
	stateCache, err := ristretto.NewCache(stateCacheConfig)
	if err != nil {
		log.Warn("error creating release target state cache", "error", err.Error())
	}

	return &Manager{
		store:                 store,
		planner:               deployment.NewPlanner(store, policyManager, versionManager, variableManager),
		jobEligibilityChecker: deployment.NewJobEligibilityChecker(store),
		executor:              deployment.NewExecutor(store),
		releaseTargetLocks:    sync.Map{},

		releaseTargetStateCache: stateCache,
	}
}

// ============================================================================
// Public API
// ============================================================================

// ProcessChanges handles detected changes to release targets (WRITES TO STORE).
// Reconciles added/tainted targets (triggers deployments) and removes deleted targets.
// Returns a map of cancelled jobs (for removed targets).
func (m *Manager) ProcessChanges(ctx context.Context, changes *statechange.ChangeSet[any]) error {
	ctx, span := tracer.Start(ctx, "ProcessChanges")
	defer span.End()

	// Track the final state of each release target by key
	// We use a map to deduplicate changes - if a target is created then deleted in the same
	// changeset, we only want to process the final state (delete). This avoids unnecessary work
	// like reconciling a target that will immediately be deleted, or creating jobs that will
	// immediately be cancelled. The map key is the release target key, and the value tracks
	// whether the final operation is a delete.
	targetStates := make(map[string]struct {
		entity   *oapi.ReleaseTarget
		isDelete bool
	})

	for _, change := range changes.Changes() {
		entity, ok := change.Entity.(*oapi.ReleaseTarget)
		if !ok {
			continue
		}

		key := entity.Key()
		switch change.Type {
		case statechange.StateChangeUpsert:
			// Only record upsert if not already marked for deletion
			if state, exists := targetStates[key]; !exists || !state.isDelete {
				targetStates[key] = struct {
					entity   *oapi.ReleaseTarget
					isDelete bool
				}{entity: entity, isDelete: false}
			}
		case statechange.StateChangeDelete:
			// Delete always wins - it's the final state
			targetStates[key] = struct {
				entity   *oapi.ReleaseTarget
				isDelete bool
			}{entity: entity, isDelete: true}
		}
	}

	// Process final states
	for _, state := range targetStates {
		if state.isDelete {
			// Handle deletion - cancel pending jobs
			for _, job := range m.store.Jobs.GetJobsForReleaseTarget(state.entity) {
				if job != nil && job.IsInProcessingState() {
					job.Status = oapi.Cancelled
					job.UpdatedAt = time.Now()
					m.store.Jobs.Upsert(ctx, job)
					fmt.Printf("cancelled job: %+v\n", job)
				}
			}
		} else {
			// Handle upsert - reconcile the target
			if err := m.ReconcileTarget(ctx, state.entity, false); err != nil {
				log.Warn("error reconciling release target", "error", err.Error())
			}
		}
	}

	return nil
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

	return m.ReconcileTarget(ctx, releaseTarget, true)
}

func (m *Manager) setDesiredReleaseSpanAttributes(span trace.Span, desiredRelease *oapi.Release) {
	if desiredRelease == nil {
		return
	}

	span.SetAttributes(attribute.String("desired_release.id", desiredRelease.ID()))
	span.SetAttributes(attribute.String("desired_release.version.id", desiredRelease.Version.Id))
	span.SetAttributes(attribute.String("desired_release.version.tag", desiredRelease.Version.Tag))
	variablesJSON, err := json.Marshal(desiredRelease.Variables)
	if err == nil {
		span.SetAttributes(attribute.String("desired_release.variables", string(variablesJSON)))
	}
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
func (m *Manager) ReconcileTarget(ctx context.Context, releaseTarget *oapi.ReleaseTarget, forceRedeploy bool) error {
	ctx, span := tracer.Start(ctx, "ReconcileTarget")
	defer span.End()

	span.SetAttributes(attribute.String("release_target.key", releaseTarget.Key()))

	// targetKey := releaseTarget.Key()
	// lockInterface, _ := m.releaseTargetLocks.LoadOrStore(targetKey, &sync.Mutex{})
	// lock := lockInterface.(*sync.Mutex)

	// // Serialize processing for this specific release target
	// lock.Lock()
	// defer lock.Unlock()

	// Phase 1: PLANNING - What should be deployed? (READ-ONLY)
	desiredRelease, err := m.planner.PlanDeployment(ctx, releaseTarget)
	if err != nil {
		span.RecordError(err)
		return err
	}

	m.setDesiredReleaseSpanAttributes(span, desiredRelease)

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

	if m.releaseTargetStateCache != nil {
		m.releaseTargetStateCache.SetWithTTL(releaseTarget.Key(), rts, 1, 2*time.Minute)
	}

	return rts, nil
}

func (m *Manager) GetCachedReleaseTargetState(ctx context.Context, releaseTarget *oapi.ReleaseTarget) (*oapi.ReleaseTargetState, error) {
	key := releaseTarget.Key()

	if m.releaseTargetStateCache == nil {
		return m.GetReleaseTargetState(ctx, releaseTarget)
	}

	if state, ok := m.releaseTargetStateCache.Get(key); ok {
		return state, nil
	}

	return m.GetReleaseTargetState(ctx, releaseTarget)
}

func (m *Manager) Planner() *deployment.Planner {
	return m.planner
}
