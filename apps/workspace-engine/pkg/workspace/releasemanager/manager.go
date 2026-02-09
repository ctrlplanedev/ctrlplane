package releasemanager

import (
	"context"
	"fmt"
	"time"

	"workspace-engine/pkg/concurrency"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/statechange"
	"workspace-engine/pkg/workspace/jobagents"
	"workspace-engine/pkg/workspace/releasemanager/action/rollback"
	"workspace-engine/pkg/workspace/releasemanager/deployment"
	"workspace-engine/pkg/workspace/releasemanager/trace"
	"workspace-engine/pkg/workspace/releasemanager/verification"
	"workspace-engine/pkg/workspace/store"

	"github.com/charmbracelet/log"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	oteltrace "go.opentelemetry.io/otel/trace"
)

// Manager handles the business logic for release target changes and deployment decisions.
// It coordinates between the state cache and deployment orchestrator to manage release targets.
type Manager struct {
	store        *store.Store
	deployment   *DeploymentOrchestrator
	verification *verification.Manager
	traceStore   PersistenceStore

	// Deprecated: WIP: Use stateIndex instead
	cache      *StateCache
	stateIndex *StateIndex
}

var tracer = otel.Tracer("workspace/releasemanager")

// PersistenceStore interface for storing deployment traces
type PersistenceStore = trace.PersistenceStore

// New creates a new release manager for a workspace.
// traceStore must not be nil - panics if not provided.
func New(store *store.Store, traceStore PersistenceStore, verificationManager *verification.Manager, jobAgentRegistry *jobagents.Registry) *Manager {
	if traceStore == nil {
		panic("traceStore cannot be nil - deployment tracing is mandatory")
	}

	deploymentOrch := NewDeploymentOrchestrator(store, jobAgentRegistry)
	stateIndex := NewStateIndex(store, deploymentOrch.Planner())
	stateCache := NewStateCache(store, deploymentOrch.Planner())

	releaseManagerHooks := newReleaseManagerVerificationHooks(store, stateCache)
	rollbackHooks := rollback.NewRollbackHooks(store, jobAgentRegistry)
	compositeHooks := verification.NewCompositeHooks(releaseManagerHooks, rollbackHooks)
	verificationManager.SetHooks(compositeHooks)

	return &Manager{
		store:        store,
		cache:        stateCache,
		deployment:   deploymentOrch,
		verification: verificationManager,
		traceStore:   traceStore,
		stateIndex:   stateIndex,
	}
}

// ============================================================================
// Public API
// ============================================================================

type targetState struct {
	entity   *oapi.ReleaseTarget
	isDelete bool
}

func (m *Manager) VerificationManager() *verification.Manager {
	return m.verification
}

// ProcessChanges handles detected changes to release targets (WRITES TO STORE).
// Reconciles added/tainted targets (triggers deployments) and removes deleted targets.
// Returns a map of cancelled jobs (for removed targets).
func (m *Manager) ProcessChanges(ctx context.Context, changes *statechange.ChangeSet[any]) error {
	ctx, span := tracer.Start(ctx, "ProcessChanges",
		oteltrace.WithAttributes(
			attribute.Int("changes.total", len(changes.Changes())),
		))
	defer span.End()

	// Track the final state of each release target by key
	// We use a map to deduplicate changes - if a target is created then deleted in the same
	// changeset, we only want to process the final state (delete). This avoids unnecessary work
	// like reconciling a target that will immediately be deleted, or creating jobs that will
	// immediately be cancelled. The map key is the release target key, and the value tracks
	// whether the final operation is a delete.
	targetStates := make(map[string]targetState)

	span.AddEvent("Deduplicating changes")
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
				targetStates[key] = targetState{entity: entity, isDelete: false}
			}
		case statechange.StateChangeDelete:
			// Delete always wins - it's the final state
			targetStates[key] = targetState{entity: entity, isDelete: true}
		}
	}

	// Count upserts vs deletes
	upsertCount := 0
	deleteCount := 0
	for _, state := range targetStates {
		if state.isDelete {
			deleteCount++
		} else {
			upsertCount++
		}
	}
	span.SetAttributes(
		attribute.Int("target_states.total", len(targetStates)),
		attribute.Int("target_states.upserts", upsertCount),
		attribute.Int("target_states.deletes", deleteCount),
	)

	processFn := func(ctx context.Context, state targetState) (targetState, error) {
		if state.isDelete {
			// Handle deletion - cancel pending jobs
			jobsCancelled := 0
			for _, job := range m.store.Jobs.GetJobsForReleaseTarget(state.entity) {
				if job != nil && job.IsInProcessingState() {
					job.Status = oapi.JobStatusCancelled
					job.UpdatedAt = time.Now()
					m.store.Jobs.Upsert(ctx, job)
					fmt.Printf("cancelled job: %+v\n", job)
					jobsCancelled++
				}
			}
			if jobsCancelled > 0 {
				log.Debug("cancelled jobs for deleted release target",
					"release_target", state.entity.Key(),
					"jobs_cancelled", jobsCancelled)
			}
			return state, nil
		}

		// Handle upsert - reconcile the target
		workspaceID := m.store.ID()
		recorder := trace.NewReconcileTarget(workspaceID, state.entity.Key(), trace.TriggerScheduled)
		defer func() {
			recorder.Complete(trace.StatusCompleted)
			if err := recorder.Persist(m.traceStore); err != nil {
				log.Error("Failed to persist deployment trace",
					"workspace_id", workspaceID,
					"release_target", state.entity.Key(),
					"error", err.Error())
			}
		}()

		if err := m.reconcileTargetWithRecorder(ctx, state.entity, recorder); err != nil {
			log.Warn("error reconciling release target",
				"release_target", state.entity.Key(),
				"error", err.Error())
			recorder.Complete(trace.StatusFailed)
		}

		return state, nil
	}

	states := make([]targetState, 0, len(targetStates))
	for _, state := range targetStates {
		states = append(states, state)
	}

	span.AddEvent("Processing release target states",
		oteltrace.WithAttributes(
			attribute.Int("states.count", len(states)),
			attribute.Int("chunk_size", 100),
			attribute.Int("concurrency", 10),
		))
	_, _ = concurrency.ProcessInChunks(ctx, states, processFn)

	span.AddEvent("Completed processing changes")
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

	return m.ReconcileTarget(ctx, releaseTarget,
		WithSkipEligibilityCheck(true),
		WithTrigger(trace.TriggerManual))
}

// reconcileTargetWithRecorder runs the three-phase deployment process and caches the result.
func (m *Manager) reconcileTargetWithRecorder(
	ctx context.Context,
	releaseTarget *oapi.ReleaseTarget,
	recorder *trace.ReconcileTarget,
	opts ...Option,
) error {
	ctx, span := tracer.Start(ctx, "reconcileTargetWithRecorder",
		oteltrace.WithAttributes(
			attribute.String("release_target.key", releaseTarget.Key()),
		))
	defer span.End()

	// Delegate to deployment orchestrator for the three-phase deployment process
	desiredRelease, job, err := m.deployment.Reconcile(ctx, releaseTarget, recorder, opts...)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "reconciliation failed")
		// Still cache the state even on error if we have a desired release
		if desiredRelease != nil {
			_, _ = m.cache.compute(ctx, releaseTarget, WithDesiredRelease(desiredRelease), WithLatestJob(job))
		}
		return err
	}

	// Cache the computed state for other APIs to use
	// Do this after reconciliation completes so the state reflects the latest job
	if desiredRelease != nil {
		span.AddEvent("Caching release target state")
		_, _ = m.cache.compute(ctx, releaseTarget, WithDesiredRelease(desiredRelease), WithLatestJob(job))
	}

	return nil
}

func (m *Manager) ReconcileTargets(ctx context.Context, releaseTargets []*oapi.ReleaseTarget, opts ...Option) error {
	// Extract options for logging only
	options := &options{}
	for _, opt := range opts {
		opt(options)
	}

	ctx, span := tracer.Start(ctx, "ReconcileTargets",
		oteltrace.WithAttributes(
			attribute.Int("reconcile.count", len(releaseTargets)),
			attribute.Bool("skip_eligibility_check", options.skipEligibilityCheck),
			attribute.String("trigger", string(options.trigger)),
		))
	defer span.End()

	// Process targets in parallel for better performance
	// Pass opts directly to each ReconcileTarget call
	_, _ = concurrency.ProcessInChunks(
		ctx,
		releaseTargets,
		func(pctx context.Context, rt *oapi.ReleaseTarget) (any, error) {
			if err := m.ReconcileTarget(pctx, rt, opts...); err != nil {
				log.Error("failed to reconcile release target",
					"release_target", rt.Key(),
					"error", err.Error())
			}
			return nil, nil
		},
		concurrency.WithChunkSize(1),
	)

	return nil
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
//	  Can be skipped when WithSkipEligibilityCheck option is set (e.g., for explicit redeploy operations).
//
//	Phase 3 (EXECUTION): executor.ExecuteRelease() - "Create the job" (writes)
//	  Persists release, creates job, dispatches to integration.
//
// Options:
//   - WithSkipEligibilityCheck: if true, skips Phase 2 eligibility checks and creates a job if planning produces a desired release
//   - WithTrigger: specifies the trigger reason for this reconciliation
//
// Returns early if:
//   - No desired release (no versions available or blocked by user policies)
//   - Job should not be created (already attempted, retry limit exceeded, etc.) - unless skipEligibilityCheck is true
func (m *Manager) ReconcileTarget(ctx context.Context, releaseTarget *oapi.ReleaseTarget, opts ...Option) error {
	// Extract options for logging and trace recorder creation
	options := &options{}
	for _, opt := range opts {
		opt(options)
	}

	ctx, span := tracer.Start(ctx, "ReconcileTarget",
		oteltrace.WithAttributes(
			attribute.String("release_target.key", releaseTarget.Key()),
			attribute.String("release_target.deployment_id", releaseTarget.DeploymentId),
			attribute.String("release_target.environment_id", releaseTarget.EnvironmentId),
			attribute.String("release_target.resource_id", releaseTarget.ResourceId),
			attribute.Bool("skip_eligibility_check", options.skipEligibilityCheck),
			attribute.String("trigger", string(options.trigger)),
		))
	defer span.End()

	// Create trace recorder for deployment analysis
	workspaceID := m.store.ID()
	recorder := trace.NewReconcileTarget(workspaceID, releaseTarget.Key(), options.trigger)

	// Ensure trace is persisted even if reconciliation fails
	defer func() {
		// Complete the trace recorder with appropriate status
		// Note: errors are captured in the trace phases, status defaults to completed
		status := trace.StatusCompleted
		recorder.Complete(status)

		// Persist traces - log error but don't fail reconciliation
		if err := recorder.Persist(m.traceStore); err != nil {
			log.Error("Failed to persist deployment trace",
				"workspace_id", workspaceID,
				"release_target", releaseTarget.Key(),
				"error", err.Error())
		}
	}()

	// Delegate to the implementation with the recorder
	return m.reconcileTargetWithRecorder(ctx, releaseTarget, recorder, opts...)
}

// GetReleaseTargetState computes and returns the release target state.
func (m *Manager) GetReleaseTargetState(ctx context.Context, releaseTarget *oapi.ReleaseTarget, opts ...Option) (*oapi.ReleaseTargetState, error) {
	ctx, span := tracer.Start(ctx, "GetReleaseTargetState",
		oteltrace.WithAttributes(
			attribute.String("release_target.key", releaseTarget.Key()),
		))
	defer span.End()

	return m.cache.Get(ctx, releaseTarget, opts...)
}

// InvalidateReleaseTargetState removes the cached state for a release target.
// This is useful when the underlying data has changed and a fresh computation is needed.
func (m *Manager) InvalidateReleaseTargetState(releaseTarget *oapi.ReleaseTarget) {
	m.cache.Invalidate(releaseTarget)
}

// Planner returns the planner instance for API
func (m *Manager) Planner() *deployment.Planner {
	return m.deployment.Planner()
}

// Scheduler returns the reconciliation scheduler instance.
func (m *Manager) Scheduler() *deployment.ReconciliationScheduler {
	return m.deployment.Planner().Scheduler()
}

func (m *Manager) Restore(ctx context.Context) error {
	ctx, span := tracer.Start(ctx, "ReleaseManager.Restore")
	defer span.End()

	if err := m.verification.Restore(ctx); err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "failed to restore verifications")
		log.Error("failed to restore verifications", "error", err.Error())
	}

	return nil
}
