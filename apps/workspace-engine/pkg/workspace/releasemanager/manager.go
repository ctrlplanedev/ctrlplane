package releasemanager

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"workspace-engine/pkg/concurrency"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/statechange"
	"workspace-engine/pkg/workspace/relationships"
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

type targetState struct {
	entity   *oapi.ReleaseTarget
	isDelete bool
}

// ProcessChanges handles detected changes to release targets (WRITES TO STORE).
// Reconciles added/tainted targets (triggers deployments) and removes deleted targets.
// Returns a map of cancelled jobs (for removed targets).
func (m *Manager) ProcessChanges(ctx context.Context, changes *statechange.ChangeSet[any]) error {
	ctx, span := tracer.Start(ctx, "ProcessChanges",
		trace.WithAttributes(
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

	// Pre-compute resource relationships for all unique resources
	// This avoids recomputing relationships for every release target that shares the same resource
	span.AddEvent("Pre-computing resource relationships")
	resourceRelationships := m.computeResourceRelationships(ctx, targetStates)

	processFn := func(state targetState) (targetState, error) {
		if state.isDelete {
			// Handle deletion - cancel pending jobs
			jobsCancelled := 0
			for _, job := range m.store.Jobs.GetJobsForReleaseTarget(state.entity) {
				if job != nil && job.IsInProcessingState() {
					job.Status = oapi.Cancelled
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

		// Handle upsert - reconcile the target with pre-computed relationships
		relationships := resourceRelationships[state.entity.ResourceId]
		if err := m.reconcileTargetWithRelationships(ctx, state.entity, false, relationships); err != nil {
			log.Warn("error reconciling release target",
				"release_target", state.entity.Key(),
				"error", err.Error())
		}

		return state, nil
	}

	states := make([]targetState, 0, len(targetStates))
	for _, state := range targetStates {
		states = append(states, state)
	}

	span.AddEvent("Processing release target states",
		trace.WithAttributes(
			attribute.Int("states.count", len(states)),
			attribute.Int("chunk_size", 100),
			attribute.Int("concurrency", 10),
		))
	concurrency.ProcessInChunks(states, 100, 10, processFn)

	span.AddEvent("Completed processing changes")
	return nil
}

// computeResourceRelationships pre-computes relationships for all unique resources in the target states.
// This optimization avoids redundant relationship computation when multiple release targets share the same resource.
func (m *Manager) computeResourceRelationships(ctx context.Context, targetStates map[string]targetState) map[string]map[string][]*oapi.EntityRelation {
	ctx, span := tracer.Start(ctx, "computeResourceRelationships")
	defer span.End()

	// Collect unique resource IDs
	span.AddEvent("Collecting unique resource IDs")
	uniqueResourceIds := make(map[string]bool)
	for _, state := range targetStates {
		if !state.isDelete {
			uniqueResourceIds[state.entity.ResourceId] = true
		}
	}
	span.SetAttributes(attribute.Int("unique_resources", len(uniqueResourceIds)))

	// Pre-compute relationships for all unique resources
	span.AddEvent("Computing relationships for unique resources")
	resourceRelationships := make(map[string]map[string][]*oapi.EntityRelation)
	successCount := 0
	errorCount := 0

	for resourceId := range uniqueResourceIds {
		resource, exists := m.store.Resources.Get(resourceId)
		if !exists {
			log.Warn("resource not found during relationship computation", "resourceId", resourceId)
			errorCount++
			continue
		}

		entity := relationships.NewResourceEntity(resource)
		relatedEntities, err := m.store.Relationships.GetRelatedEntities(ctx, entity)
		if err != nil {
			log.Warn("error getting related entities", "resourceId", resourceId, "error", err.Error())
			errorCount++
			continue
		}

		resourceRelationships[resourceId] = relatedEntities
		successCount++
	}

	span.SetAttributes(
		attribute.Int("relationships.computed_successfully", successCount),
		attribute.Int("relationships.errors", errorCount),
	)

	return resourceRelationships
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

// reconcileTargetWithRelationships is like ReconcileTarget but accepts pre-computed resource relationships.
// This is an optimization to avoid recomputing relationships for multiple release targets that share the same resource.
func (m *Manager) reconcileTargetWithRelationships(
	ctx context.Context,
	releaseTarget *oapi.ReleaseTarget,
	forceRedeploy bool,
	resourceRelationships map[string][]*oapi.EntityRelation,
) error {
	ctx, span := tracer.Start(ctx, "reconcileTargetWithRelationships",
		trace.WithAttributes(
			attribute.String("release_target.key", releaseTarget.Key()),
			attribute.Bool("force_redeploy", forceRedeploy),
		))
	defer span.End()

	// Phase 1: PLANNING - What should be deployed? (READ-ONLY)
	// Pass pre-computed relationships to avoid redundant computation
	span.AddEvent("Phase 1: Planning deployment")
	desiredRelease, err := m.planner.PlanDeployment(
		ctx,
		releaseTarget,
		deployment.WithResourceRelatedEntities(resourceRelationships),
	)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "planning failed")
		return err
	}

	m.setDesiredReleaseSpanAttributes(span, desiredRelease)

	// No desired release (no versions or blocked by user policies)
	if desiredRelease == nil {
		span.AddEvent("No desired release (no versions or blocked by policies)")
		span.SetAttributes(attribute.String("reconciliation_result", "no_desired_release"))
		return nil
	}

	// Phase 2: ELIGIBILITY - Should we create a job for this release? (READ-ONLY)
	// Skip eligibility check if this is a forced redeploy
	if !forceRedeploy {
		span.AddEvent("Phase 2: Checking job eligibility")
		shouldCreate, reason, err := m.jobEligibilityChecker.ShouldCreateJob(ctx, desiredRelease)
		if err != nil {
			span.RecordError(err)
			span.SetStatus(codes.Error, "eligibility check failed")
			return err
		}

		span.SetAttributes(
			attribute.Bool("job_eligibility.should_create", shouldCreate),
			attribute.String("job_eligibility.reason", reason),
		)

		// Job should not be created (retry limit, already attempted, etc.)
		if !shouldCreate {
			span.AddEvent("Job should not be created",
				trace.WithAttributes(attribute.String("reason", reason)))
			span.SetAttributes(attribute.String("reconciliation_result", "job_not_eligible"))
			return nil
		}
	} else {
		span.AddEvent("Phase 2: Skipping eligibility check (forced redeploy)")
	}

	// Phase 3: EXECUTION - Create the job (WRITES)
	span.AddEvent("Phase 3: Executing release")
	err = m.executor.ExecuteRelease(ctx, desiredRelease)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "execution failed")
		span.SetAttributes(attribute.String("reconciliation_result", "execution_failed"))
		return err
	}

	span.SetAttributes(attribute.String("reconciliation_result", "job_created"))
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
	ctx, span := tracer.Start(ctx, "ReconcileTarget",
		trace.WithAttributes(
			attribute.String("release_target.key", releaseTarget.Key()),
			attribute.String("release_target.deployment_id", releaseTarget.DeploymentId),
			attribute.String("release_target.environment_id", releaseTarget.EnvironmentId),
			attribute.String("release_target.resource_id", releaseTarget.ResourceId),
			attribute.Bool("force_redeploy", forceRedeploy),
		))
	defer span.End()

	// Compute relationships on-demand for this single resource
	span.AddEvent("Getting resource and relationships")
	resource, exists := m.store.Resources.Get(releaseTarget.ResourceId)
	if !exists {
		err := fmt.Errorf("resource %q not found", releaseTarget.ResourceId)
		span.RecordError(err)
		span.SetStatus(codes.Error, "resource not found")
		return err
	}

	entity := relationships.NewResourceEntity(resource)
	resourceRelationships, err := m.store.Relationships.GetRelatedEntities(ctx, entity)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "failed to get relationships")
		return err
	}

	// Count total related entities
	totalRelatedEntities := 0
	for _, entities := range resourceRelationships {
		totalRelatedEntities += len(entities)
	}
	span.SetAttributes(attribute.Int("related_entities.count", totalRelatedEntities))

	// Delegate to the implementation that accepts pre-computed relationships
	return m.reconcileTargetWithRelationships(ctx, releaseTarget, forceRedeploy, resourceRelationships)
}

func (m *Manager) GetReleaseTargetStateWithRelationships(ctx context.Context, releaseTarget *oapi.ReleaseTarget, resourceRelationships map[string][]*oapi.EntityRelation) (*oapi.ReleaseTargetState, error) {
	// Get current release (may be nil if no successful jobs exist)
	currentRelease, _, err := m.store.ReleaseTargets.GetCurrentRelease(ctx, releaseTarget)
	if err != nil {
		// No successful job found is not an error condition - it just means no current release
		log.Debug("no current release for release target", "error", err.Error())
		currentRelease = nil
	}

	// Get desired release (may be nil if no versions available or blocked by policies)
	// If relationships are provided, use them; otherwise PlanDeployment will compute on-demand
	var desiredRelease *oapi.Release
	if resourceRelationships != nil {
		desiredRelease, err = m.planner.PlanDeployment(ctx, releaseTarget, deployment.WithResourceRelatedEntities(resourceRelationships))
	} else {
		desiredRelease, err = m.planner.PlanDeployment(ctx, releaseTarget)
	}
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
	return m.GetCachedReleaseTargetStateWithRelationships(ctx, releaseTarget, nil)
}

func (m *Manager) GetCachedReleaseTargetStateWithRelationships(ctx context.Context, releaseTarget *oapi.ReleaseTarget, resourceRelationships map[string][]*oapi.EntityRelation) (*oapi.ReleaseTargetState, error) {
	key := releaseTarget.Key()

	if m.releaseTargetStateCache == nil {
		return m.GetReleaseTargetStateWithRelationships(ctx, releaseTarget, resourceRelationships)
	}

	if state, ok := m.releaseTargetStateCache.Get(key); ok {
		return state, nil
	}

	return m.GetReleaseTargetStateWithRelationships(ctx, releaseTarget, resourceRelationships)
}

func (m *Manager) Planner() *deployment.Planner {
	return m.planner
}
