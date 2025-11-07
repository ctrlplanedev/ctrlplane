package releasemanager

import (
	"context"

	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/releasemanager/deployment"
	"workspace-engine/pkg/workspace/releasemanager/policy"
	"workspace-engine/pkg/workspace/releasemanager/variables"
	"workspace-engine/pkg/workspace/releasemanager/versions"
	"workspace-engine/pkg/workspace/store"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"
)

// DeploymentOrchestrator coordinates the three-phase deployment process:
// planning, eligibility checking, and execution.
type DeploymentOrchestrator struct {
	store                 *store.Store
	planner               *deployment.Planner
	jobEligibilityChecker *deployment.JobEligibilityChecker
	executor              *deployment.Executor
}

// NewDeploymentOrchestrator creates a new deployment orchestrator.
func NewDeploymentOrchestrator(store *store.Store) *DeploymentOrchestrator {
	policyManager := policy.New(store)
	versionManager := versions.New(store)
	variableManager := variables.New(store)

	return &DeploymentOrchestrator{
		store:                 store,
		planner:               deployment.NewPlanner(store, policyManager, versionManager, variableManager),
		jobEligibilityChecker: deployment.NewJobEligibilityChecker(store),
		executor:              deployment.NewExecutor(store),
	}
}

// Reconcile ensures a release target is in its desired state using a three-phase deployment pattern.
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
//   - releaseTarget: the release target to reconcile
//   - forceRedeploy: if true, skips eligibility checks and always creates a new job
//   - resourceRelationships: pre-computed relationships to avoid redundant computation
//
// Returns:
//   - desiredRelease: the desired release computed during planning (may be nil)
//   - error: any error that occurred during the process
//
// Returns early if:
//   - No desired release (no versions available or blocked by user policies)
//   - Job should not be created (already attempted, retry limit exceeded, etc.) - unless forceRedeploy is true
func (o *DeploymentOrchestrator) Reconcile(
	ctx context.Context,
	releaseTarget *oapi.ReleaseTarget,
	forceRedeploy bool,
	resourceRelationships map[string][]*oapi.EntityRelation,
) (*oapi.Release, *oapi.Job, error) {
	ctx, span := tracer.Start(ctx, "DeploymentOrchestrator.Reconcile",
		trace.WithAttributes(
			attribute.String("release_target.key", releaseTarget.Key()),
			attribute.Bool("force_redeploy", forceRedeploy),
		))
	defer span.End()

	// Phase 1: PLANNING - What should be deployed? (READ-ONLY)
	// Pass pre-computed relationships to avoid redundant computation
	span.AddEvent("Phase 1: Planning deployment")
	desiredRelease, err := o.planner.PlanDeployment(
		ctx,
		releaseTarget,
		deployment.WithResourceRelatedEntities(resourceRelationships),
	)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "planning failed")
		return nil, nil, err
	}

	// No desired release (no versions or blocked by user policies)
	if desiredRelease == nil {
		span.AddEvent("No desired release (no versions or blocked by policies)")
		span.SetAttributes(attribute.String("reconciliation_result", "no_desired_release"))
		return nil, nil, nil
	}

	// Phase 2: ELIGIBILITY - Should we create a job for this release? (READ-ONLY)
	// Skip eligibility check if this is a forced redeploy
	if !forceRedeploy {
		span.AddEvent("Phase 2: Checking job eligibility")
		shouldCreate, reason, err := o.jobEligibilityChecker.ShouldCreateJob(ctx, desiredRelease)
		if err != nil {
			span.RecordError(err)
			span.SetStatus(codes.Error, "eligibility check failed")
			return desiredRelease, nil, err
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
			return desiredRelease, nil, nil
		}
	} else {
		span.AddEvent("Phase 2: Skipping eligibility check (forced redeploy)")
	}

	// Phase 3: EXECUTION - Create the job (WRITES)
	span.AddEvent("Phase 3: Executing release")
	job, err := o.executor.ExecuteRelease(ctx, desiredRelease)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "execution failed")
		span.SetAttributes(attribute.String("reconciliation_result", "execution_failed"))
		return desiredRelease, nil, err
	}

	span.SetAttributes(attribute.String("reconciliation_result", "job_created"))
	return desiredRelease, job, nil
}

// Planner returns the planner instance for backward compatibility.
func (o *DeploymentOrchestrator) Planner() *deployment.Planner {
	return o.planner
}
