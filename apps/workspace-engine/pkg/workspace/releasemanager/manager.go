package releasemanager

import (
	"context"
	"fmt"
	"time"

	"workspace-engine/pkg/concurrency"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/statechange"
	"workspace-engine/pkg/workspace/jobagents"
	"workspace-engine/pkg/workspace/releasemanager/deployment"
	"workspace-engine/pkg/workspace/releasemanager/policy"
	"workspace-engine/pkg/workspace/releasemanager/trace"
	"workspace-engine/pkg/workspace/releasemanager/variables"
	"workspace-engine/pkg/workspace/releasemanager/versions"
	"workspace-engine/pkg/workspace/store"

	"github.com/charmbracelet/log"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	oteltrace "go.opentelemetry.io/otel/trace"
)

// Manager handles the business logic for release target changes and deployment decisions.
// It coordinates the state index, eligibility checking, and execution to manage release targets.
type Manager struct {
	store       *store.Store
	planner     *deployment.Planner
	eligibility *deployment.JobEligibilityChecker
	executor    *deployment.Executor
	traceStore  PersistenceStore
	stateIndex  *StateIndex
}

var tracer = otel.Tracer("workspace/releasemanager")

// PersistenceStore interface for storing deployment traces
type PersistenceStore = trace.PersistenceStore

// New creates a new release manager for a workspace.
// traceStore must not be nil - panics if not provided.
func New(store *store.Store, traceStore PersistenceStore, jobAgentRegistry *jobagents.Registry) *Manager {
	if traceStore == nil {
		panic("traceStore cannot be nil - deployment tracing is mandatory")
	}

	policyManager := policy.New(store)
	versionManager := versions.New(store)
	variableManager := variables.New(store)

	planner := deployment.NewPlanner(store, policyManager, versionManager, variableManager)
	eligibility := deployment.NewJobEligibilityChecker(store)
	executor := deployment.NewExecutor(store, jobAgentRegistry)
	stateIndex := NewStateIndex(store, planner)

	return &Manager{
		store:       store,
		planner:     planner,
		eligibility: eligibility,
		executor:    executor,
		traceStore:  traceStore,
		stateIndex:  stateIndex,
	}
}

// ============================================================================
// Public API
// ============================================================================

type targetState struct {
	entity   *oapi.ReleaseTarget
	isDelete bool
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

	// Phase 1: Process deletes and register upserts (concurrent).
	// Deletions cancel orphaned jobs and remove from the state index.
	// Upserts register the entity in the state index (marks dirty) but do NOT reconcile yet.
	registerFn := func(ctx context.Context, state targetState) (targetState, error) {
		if state.isDelete {
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
			m.stateIndex.RemoveReleaseTarget(*state.entity)
			return state, nil
		}

		m.stateIndex.AddReleaseTarget(*state.entity)
		return state, nil
	}

	allStates := make([]targetState, 0, len(targetStates))
	upsertStates := make([]targetState, 0, upsertCount)
	for _, state := range targetStates {
		allStates = append(allStates, state)
		if !state.isDelete {
			upsertStates = append(upsertStates, state)
		}
	}

	span.AddEvent("Phase 1: Registering/removing release targets",
		oteltrace.WithAttributes(
			attribute.Int("states.count", len(allStates)),
		))
	_, _ = concurrency.ProcessInChunks(ctx, allStates, registerFn)

	// Phase 2: Batch recompute — materializes desired releases for all new/dirty targets.
	// The index must be populated before reconciliation can read from it.
	recomputed := m.stateIndex.Recompute(ctx)
	span.AddEvent("Phase 2: Recomputed state index",
		oteltrace.WithAttributes(
			attribute.Int("recomputed.count", recomputed),
		))

	// Phase 3: Reconcile each upserted target (concurrent).
	// Now that the index is populated, reconciliation reads desired releases from it.
	reconcileFn := func(ctx context.Context, state targetState) (targetState, error) {
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

	span.AddEvent("Phase 3: Reconciling upserted targets",
		oteltrace.WithAttributes(
			attribute.Int("upsert_states.count", len(upsertStates)),
		))
	_, _ = concurrency.ProcessInChunks(ctx, upsertStates, reconcileFn)

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

// reconcileTargetWithRecorder reads the desired release from the pre-computed
// state index, checks eligibility, and executes the deployment.
func (m *Manager) reconcileTargetWithRecorder(
	ctx context.Context,
	releaseTarget *oapi.ReleaseTarget,
	recorder *trace.ReconcileTarget,
	opts ...Option,
) error {
	options := &options{}
	for _, opt := range opts {
		opt(options)
	}

	ctx, span := tracer.Start(ctx, "reconcileTargetWithRecorder",
		oteltrace.WithAttributes(
			attribute.String("release_target.key", releaseTarget.Key()),
			attribute.Bool("skip_eligibility_check", options.skipEligibilityCheck),
		))
	defer span.End()

	// Phase 1: Read desired release from the pre-computed state index
	desiredRelease := m.stateIndex.GetDesiredRelease(*releaseTarget)

	planning := recorder.StartPlanning()
	if desiredRelease != nil {
		planning.MakeDecision(
			fmt.Sprintf("Desired release resolved from index: %s", desiredRelease.ID()),
			trace.DecisionApproved,
		)
	} else {
		planning.MakeDecision("No desired release in index", trace.DecisionRejected)
	}
	planning.End()

	if desiredRelease == nil {
		span.AddEvent("No desired release in index")
		span.SetAttributes(attribute.String("reconciliation_result", "no_desired_release"))
		return nil
	}

	// Phase 2: Check eligibility (skip when explicitly requested, e.g. manual redeploys)
	if !options.skipEligibilityCheck {
		span.AddEvent("Checking job eligibility")
		eligibilityResult, err := m.eligibility.ShouldCreateJob(ctx, desiredRelease, recorder)
		if err != nil {
			span.RecordError(err)
			span.SetStatus(codes.Error, "eligibility check failed")
			return err
		}

		span.SetAttributes(
			attribute.String("job_eligibility.decision", string(eligibilityResult.Decision)),
			attribute.String("job_eligibility.reason", eligibilityResult.Reason),
		)

		if eligibilityResult.IsPending() {
			span.AddEvent("Job creation pending, scheduling re-evaluation",
				oteltrace.WithAttributes(attribute.String("reason", eligibilityResult.Reason)))

			if eligibilityResult.ShouldScheduleRetry() {
				scheduler := m.planner.Scheduler()
				scheduler.Schedule(releaseTarget, *eligibilityResult.NextEvaluationTime)
				span.SetAttributes(
					attribute.String("next_evaluation_time", eligibilityResult.NextEvaluationTime.Format("2006-01-02T15:04:05Z07:00")),
				)
			}

			span.SetAttributes(attribute.String("reconciliation_result", "job_pending"))
			return nil
		}

		if eligibilityResult.IsDenied() {
			span.AddEvent("Job should not be created",
				oteltrace.WithAttributes(attribute.String("reason", eligibilityResult.Reason)))
			span.SetAttributes(attribute.String("reconciliation_result", "job_denied"))
			return nil
		}
	} else {
		span.AddEvent("Skipping eligibility check (explicitly requested)")
	}

	// Phase 3: Execute release
	span.AddEvent("Executing release")
	_, err := m.executor.ExecuteRelease(ctx, desiredRelease, recorder)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "execution failed")
		span.SetAttributes(attribute.String("reconciliation_result", "execution_failed"))
		return err
	}

	span.SetAttributes(attribute.String("reconciliation_result", "job_created"))

	// Recompute state after execution so subsequent reads reflect the latest data.
	m.stateIndex.DirtyAll(*releaseTarget)
	m.stateIndex.Recompute(ctx)

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

	// Delegate to the implementation with the recorder.
	// Callers are responsible for dirtying the state index before calling ReconcileTarget
	// when they change state that affects the desired release (versions, policies, variables, etc.).
	// ProcessChanges uses the optimized 3-phase path (register → batch recompute → reconcile).
	return m.reconcileTargetWithRecorder(ctx, releaseTarget, recorder, opts...)
}

// GetReleaseTargetState returns the release target state from the pre-computed state index.
func (m *Manager) GetReleaseTargetState(ctx context.Context, releaseTarget *oapi.ReleaseTarget, opts ...Option) (*oapi.ReleaseTargetState, error) {
	_, span := tracer.Start(ctx, "GetReleaseTargetState",
		oteltrace.WithAttributes(
			attribute.String("release_target.key", releaseTarget.Key()),
		))
	defer span.End()

	state := m.stateIndex.Get(*releaseTarget)
	return state, nil
}

// DirtyDesiredRelease marks the desired release for recompute.
// Use when policies, versions, or approval records change.
func (m *Manager) DirtyDesiredRelease(rt *oapi.ReleaseTarget) {
	m.stateIndex.DirtyDesired(*rt)
}

// DirtyCurrentAndJob marks the current release and latest job for recompute.
// Use when job status changes or verification hooks fire.
func (m *Manager) DirtyCurrentAndJob(rt *oapi.ReleaseTarget) {
	m.stateIndex.DirtyCurrentAndJob(*rt)
}

// RecomputeState processes all dirty entities in the state index.
// Returns the total number of evaluations performed.
func (m *Manager) RecomputeState(ctx context.Context) int {
	return m.stateIndex.Recompute(ctx)
}

// RecomputeEntity forces a full recompute for a single release target.
// Use for bypass-cache scenarios where fresh state is needed immediately.
func (m *Manager) RecomputeEntity(ctx context.Context, rt *oapi.ReleaseTarget) {
	m.stateIndex.RecomputeEntity(ctx, *rt)
}

// Planner returns the planner instance for API
func (m *Manager) Planner() *deployment.Planner {
	return m.planner
}

// Scheduler returns the reconciliation scheduler instance.
func (m *Manager) Scheduler() *deployment.ReconciliationScheduler {
	return m.planner.Scheduler()
}

func (m *Manager) Restore(ctx context.Context) error {
	ctx, span := tracer.Start(ctx, "ReleaseManager.Restore")
	defer span.End()

	// Pre-compute the state index for every release target that was restored
	// from persistence.  This avoids per-request lazy registration and ensures
	// the first API read is fast.
	m.stateIndex.RestoreAll(ctx)

	return nil
}
