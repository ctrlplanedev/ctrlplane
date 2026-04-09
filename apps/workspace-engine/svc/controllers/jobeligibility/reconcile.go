package jobeligibility

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/selector"
	"workspace-engine/pkg/workspace/jobs"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator/releasetargetconcurrency"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator/retry"
)

type ReconcileResult struct {
	NextReconcileAt *time.Time
}

type reconciler struct {
	workspaceID uuid.UUID

	getter Getter
	setter Setter
	rt     *ReleaseTarget

	release  *oapi.Release
	policies []*oapi.Policy
}

func (r *reconciler) loadInput(ctx context.Context) error {
	ctx, span := tracer.Start(ctx, "loadInput")
	defer span.End()

	release, err := r.getter.GetDesiredRelease(ctx, r.rt)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return fmt.Errorf("get desired release: %w", err)
	}
	r.release = release
	if release == nil {
		span.AddEvent("no desired release found for release target")
		return nil
	}
	span.SetAttributes(attribute.String("release", fmt.Sprintf("%+v", release)))

	policies, err := r.getter.GetPoliciesForReleaseTarget(ctx, r.rt.ToOAPI())
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return fmt.Errorf("get policies for release target: %w", err)
	}
	r.policies = policies

	return nil
}

// buildEvaluators constructs the set of job evaluators to run against the release.
// Static: concurrency check (always applied).
// Dynamic: retry evaluators built from policy retry rules.
func (r *reconciler) buildEvaluators() []evaluator.JobEvaluator {
	evals := []evaluator.JobEvaluator{
		releasetargetconcurrency.NewEvaluator(r.getter),
	}

	retryEvals := r.buildRetryEvaluators()
	evals = append(evals, retryEvals...)

	return evals
}

func (r *reconciler) buildRetryEvaluators() []evaluator.JobEvaluator {
	var retryEvals []evaluator.JobEvaluator

	for _, policy := range r.policies {
		if !policy.Enabled {
			continue
		}
		for _, rule := range policy.Rules {
			if rule.Retry == nil {
				continue
			}
			eval := retry.NewEvaluator(r.getter, rule.Retry)
			if eval != nil {
				retryEvals = append(retryEvals, eval)
			}
		}
	}

	if len(retryEvals) == 0 {
		eval := retry.NewEvaluator(r.getter, nil)
		if eval != nil {
			retryEvals = append(retryEvals, eval)
		}
	}

	return retryEvals
}

// checkEligibility runs all evaluators and returns the eligibility decision.
func (r *reconciler) checkEligibility(ctx context.Context) (bool, *time.Time, string) {
	if r.release == nil {
		return false, nil, "no desired release"
	}

	evals := r.buildEvaluators()

	var earliestNextTime *time.Time
	hasPending := false
	hasBlocked := false
	reason := "eligible"

	for _, eval := range evals {
		result := eval.Evaluate(ctx, r.release)

		if result.ActionRequired {
			hasPending = true
			reason = result.Message
			if result.NextEvaluationTime != nil {
				if earliestNextTime == nil || result.NextEvaluationTime.Before(*earliestNextTime) {
					earliestNextTime = result.NextEvaluationTime
				}
			}
		}

		if !result.Allowed && !result.ActionRequired {
			hasBlocked = true
			reason = result.Message
			break
		}
	}

	if hasBlocked {
		return false, nil, reason
	}
	if hasPending {
		return false, earliestNextTime, reason
	}
	return true, nil, reason
}

func (r *reconciler) createFailureJob(
	ctx context.Context,
	status oapi.JobStatus,
	message string,
) error {
	now := time.Now()

	factory := jobs.NewFactoryFromGetters(r.getter)
	deploymentID, err := uuid.Parse(r.release.ReleaseTarget.DeploymentId)
	if err != nil {
		return fmt.Errorf("parse deployment id: %w", err)
	}
	deployment, err := r.getter.GetDeployment(ctx, deploymentID)
	if err != nil {
		return fmt.Errorf("get deployment: %w", err)
	}

	dc, err := factory.BuildDispatchContext(ctx, r.release, deployment, nil)
	if err != nil {
		return fmt.Errorf("build dispatch context: %w", err)
	}

	job := &oapi.Job{
		Id:              uuid.New().String(),
		ReleaseId:       r.release.Id.String(),
		JobAgentConfig:  oapi.JobAgentConfig{},
		Status:          status,
		Message:         &message,
		CreatedAt:       now,
		UpdatedAt:       now,
		CompletedAt:     &now,
		Metadata:        make(map[string]string),
		DispatchContext: dc,
	}
	if err := r.setter.CreateJob(ctx, job, r.release); err != nil {
		return fmt.Errorf("create failure job: %w", err)
	}
	return nil
}

func (r *reconciler) buildAndDispatchJob(ctx context.Context) error {
	ctx, span := tracer.Start(ctx, "jobeligibility.buildAndDispatchJob")
	defer span.End()

	deploymentID, err := uuid.Parse(r.release.ReleaseTarget.DeploymentId)
	if err != nil {
		return fmt.Errorf("parse deployment id: %w", err)
	}

	deployment, err := r.getter.GetDeployment(ctx, deploymentID)
	if err != nil {
		return recordErr(span, "get deployment", err)
	}

	span.SetAttributes(attribute.String("deployment.id", deployment.Id))
	span.SetAttributes(attribute.String("deployment.name", deployment.Name))
	span.SetAttributes(
		attribute.String("deployment.job_agent_selector", deployment.JobAgentSelector),
	)

	if deployment.JobAgentSelector == "" {
		msg := fmt.Sprintf("No job agents configured for deployment '%s'", deployment.Name)
		span.AddEvent(msg)
		return r.createFailureJob(ctx, oapi.JobStatusInvalidJobAgent, msg)
	}

	resource, err := r.getter.GetResource(ctx, r.rt.ResourceID)
	if err != nil {
		return recordErr(span, "get resource", err)
	}

	allAgents, err := r.getter.ListJobAgentsByWorkspaceID(ctx, r.workspaceID)
	if err != nil {
		return recordErr(span, "list job agents", err)
	}
	span.SetAttributes(attribute.Int("workspace_agents.count", len(allAgents)))

	matchedAgents, err := selector.MatchJobAgentsWithResource(
		ctx,
		deployment.JobAgentSelector,
		allAgents,
		resource,
	)
	if err != nil {
		return recordErr(span, "match job agents", err)
	}
	span.SetAttributes(attribute.Int("matched_agents.count", len(matchedAgents)))

	if len(matchedAgents) == 0 {
		msg := fmt.Sprintf("No job agents matched selector for deployment '%s'", deployment.Name)
		span.AddEvent(msg)
		return r.createFailureJob(ctx, oapi.JobStatusInvalidJobAgent, msg)
	}

	for i := range matchedAgents {
		agent := &matchedAgents[i]
		agent.Config = oapi.DeepMergeConfigs(
			agent.Config, deployment.JobAgentConfig, r.release.Version.JobAgentConfig,
		)

		job, err := jobs.NewFactoryFromGetters(r.getter).
			CreateJobForRelease(ctx, r.release, agent)
		if err != nil {
			return recordErr(span, "build job", err)
		}

		if err := r.setter.CreateJob(ctx, job, r.release); err != nil {
			return recordErr(span, "create job", err)
		}

		if err := r.setter.EnqueueJobDispatch(ctx, r.workspaceID.String(), job.Id); err != nil {
			return recordErr(span, "enqueue job dispatch", err)
		}
	}

	return nil
}

// Reconcile determines job eligibility for a release target and, if eligible,
// builds a job and enqueues it for dispatch.
func Reconcile(
	ctx context.Context,
	workspaceID string,
	getter Getter,
	setter Setter,
	rt *ReleaseTarget,
) (*ReconcileResult, error) {
	ctx, span := tracer.Start(ctx, "jobeligibility.Reconcile")
	defer span.End()

	workspaceIDUUID, err := uuid.Parse(workspaceID)
	if err != nil {
		return nil, fmt.Errorf("parse workspace id: %w", err)
	}

	r := &reconciler{workspaceID: workspaceIDUUID, getter: getter, setter: setter, rt: rt}
	r.rt.WorkspaceID = r.workspaceID

	if err := r.loadInput(ctx); err != nil {
		return nil, recordErr(span, "load input", err)
	}

	if r.release == nil {
		return &ReconcileResult{}, nil
	}

	allowed, nextTime, reason := r.checkEligibility(ctx)
	span.SetAttributes(attribute.Bool("allowed", allowed))
	span.SetAttributes(attribute.String("reason", reason))
	if nextTime != nil {
		span.SetAttributes(attribute.String("next_time", nextTime.Format(time.RFC3339)))
	}
	if !allowed {
		if nextTime != nil {
			span.AddEvent("job creation pending: " + reason)
			return &ReconcileResult{NextReconcileAt: nextTime}, nil
		}
		span.AddEvent("job creation denied: " + reason)
		return &ReconcileResult{}, nil
	}

	span.AddEvent("job creation allowed: " + reason)
	if err := r.buildAndDispatchJob(ctx); err != nil {
		return nil, recordErr(span, "build and dispatch job", err)
	}

	return &ReconcileResult{}, nil
}

func recordErr(span trace.Span, msg string, err error) error {
	span.RecordError(err)
	span.SetStatus(codes.Error, msg+" failed")
	return fmt.Errorf("%s: %w", msg, err)
}
