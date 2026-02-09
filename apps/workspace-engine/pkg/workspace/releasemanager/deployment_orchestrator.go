package releasemanager

import (
	"context"

	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/jobagents"
	"workspace-engine/pkg/workspace/releasemanager/deployment"
	"workspace-engine/pkg/workspace/releasemanager/policy"
	"workspace-engine/pkg/workspace/releasemanager/trace"
	"workspace-engine/pkg/workspace/releasemanager/variables"
	"workspace-engine/pkg/workspace/releasemanager/versions"
	"workspace-engine/pkg/workspace/store"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	oteltrace "go.opentelemetry.io/otel/trace"
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
func NewDeploymentOrchestrator(store *store.Store, jobAgentRegistry *jobagents.Registry) *DeploymentOrchestrator {
	policyManager := policy.New(store)
	versionManager := versions.New(store)
	variableManager := variables.New(store)

	return &DeploymentOrchestrator{
		store:                 store,
		planner:               deployment.NewPlanner(store, policyManager, versionManager, variableManager),
		jobEligibilityChecker: deployment.NewJobEligibilityChecker(store),
		executor:              deployment.NewExecutor(store, jobAgentRegistry),
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
//	  Can be skipped when skipEligibilityCheck option is set (e.g., for explicit redeploy operations).
//
//	Phase 3 (EXECUTION): executor.ExecuteRelease() - "Create the job" (writes)
//	  Persists release, creates job, dispatches to integration.
//
// Options:
//   - WithSkipEligibilityCheck: if true, skips Phase 2 eligibility checks
//
// Returns:
//   - desiredRelease: the desired release computed during planning (may be nil)
//   - error: any error that occurred during the process
//
// Returns early if:
//   - No desired release (no versions available or blocked by user policies)
//   - Job should not be created (already attempted, retry limit exceeded, etc.) - unless skipEligibilityCheck is true
func (o *DeploymentOrchestrator) Reconcile(
	ctx context.Context,
	releaseTarget *oapi.ReleaseTarget,
	recorder *trace.ReconcileTarget,
	opts ...Option,
) (*oapi.Release, *oapi.Job, error) {
	// Extract options for span attributes and eligibility check
	options := &options{}
	for _, opt := range opts {
		opt(options)
	}

	ctx, span := tracer.Start(ctx, "DeploymentOrchestrator.Reconcile",
		oteltrace.WithAttributes(
			attribute.String("release_target.key", releaseTarget.Key()),
			attribute.Bool("skip_eligibility_check", options.skipEligibilityCheck),
		))
	defer span.End()

	// Phase 1: PLANNING - What should be deployed? (READ-ONLY)
	span.AddEvent("Phase 1: Planning deployment")
	desiredRelease, err := o.planner.PlanDeployment(
		ctx,
		releaseTarget,
		deployment.WithTraceRecorder(recorder),
		deployment.WithVersionAndNewer(options.earliestVersionForEvaluation),
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
	// Skip eligibility check when requested (e.g., for manual redeploys)
	if !options.skipEligibilityCheck {
		span.AddEvent("Phase 2: Checking job eligibility")
		eligibilityResult, err := o.jobEligibilityChecker.ShouldCreateJob(ctx, desiredRelease, recorder)
		if err != nil {
			span.RecordError(err)
			span.SetStatus(codes.Error, "eligibility check failed")
			return desiredRelease, nil, err
		}

		span.SetAttributes(
			attribute.String("job_eligibility.decision", string(eligibilityResult.Decision)),
			attribute.String("job_eligibility.reason", eligibilityResult.Reason),
		)

		// Handle pending results - schedule re-evaluation
		if eligibilityResult.IsPending() {
			span.AddEvent("Job creation pending, scheduling re-evaluation",
				oteltrace.WithAttributes(attribute.String("reason", eligibilityResult.Reason)))

			if eligibilityResult.ShouldScheduleRetry() {
				scheduler := o.planner.Scheduler()
				scheduler.Schedule(releaseTarget, *eligibilityResult.NextEvaluationTime)
				span.SetAttributes(
					attribute.String("next_evaluation_time", eligibilityResult.NextEvaluationTime.Format("2006-01-02T15:04:05Z07:00")),
				)
			}

			span.SetAttributes(attribute.String("reconciliation_result", "job_pending"))
			return desiredRelease, nil, nil
		}

		// Handle denied results - job should not be created
		if eligibilityResult.IsDenied() {
			span.AddEvent("Job should not be created",
				oteltrace.WithAttributes(attribute.String("reason", eligibilityResult.Reason)))
			span.SetAttributes(attribute.String("reconciliation_result", "job_denied"))
			return desiredRelease, nil, nil
		}
	} else {
		span.AddEvent("Phase 2: Skipping eligibility check (explicitly requested)")
	}

	// Phase 3: EXECUTION - Create the job (WRITES)
	span.AddEvent("Phase 3: Executing release")
	job, err := o.executor.ExecuteRelease(ctx, desiredRelease, recorder)
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
