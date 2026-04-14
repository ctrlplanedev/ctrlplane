package forcedeploy

import (
	"context"
	"fmt"
	"time"

	"github.com/charmbracelet/log"
	"github.com/google/uuid"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/selector"
	"workspace-engine/pkg/workspace/jobs"
)

const requeueDelay = 5 * time.Second

type ReconcileResult struct {
	RequeueAfter time.Duration
}

func Reconcile(
	ctx context.Context,
	workspaceID string,
	getter Getter,
	setter Setter,
	rt *ReleaseTarget,
) (*ReconcileResult, error) {
	ctx, span := tracer.Start(ctx, "forcedeploy.Reconcile")
	defer span.End()

	workspaceUUID, err := uuid.Parse(workspaceID)
	if err != nil {
		return nil, fmt.Errorf("parse workspace id: %w", err)
	}

	release, err := getter.GetDesiredRelease(ctx, rt)
	if err != nil {
		return nil, recordErr(span, "get desired release", err)
	}
	if release == nil {
		log.Info("no desired release for release target, skipping", "rt", rt.ToOAPI().Key())
		return &ReconcileResult{}, nil
	}

	activeJobs, err := getter.GetActiveJobsForReleaseTarget(ctx, rt.ToOAPI())
	if err != nil {
		return nil, recordErr(span, "get active jobs", err)
	}
	if len(activeJobs) > 0 {
		span.SetAttributes(attribute.Int("active_jobs", len(activeJobs)))
		log.Info("release target has active jobs, requeueing",
			"rt", rt.ToOAPI().Key(),
			"activeJobs", len(activeJobs),
		)
		return &ReconcileResult{RequeueAfter: requeueDelay}, nil
	}

	if err := buildAndDispatchJob(
		ctx,
		span,
		workspaceUUID,
		getter,
		setter,
		rt,
		release,
	); err != nil {
		return nil, recordErr(span, "build and dispatch job", err)
	}

	return &ReconcileResult{}, nil
}

func buildAndDispatchJob(
	ctx context.Context,
	span trace.Span,
	workspaceID uuid.UUID,
	getter Getter,
	setter Setter,
	rt *ReleaseTarget,
	release *oapi.Release,
) error {
	deploymentID, err := uuid.Parse(release.ReleaseTarget.DeploymentId)
	if err != nil {
		return fmt.Errorf("parse deployment id: %w", err)
	}

	deployment, err := getter.GetDeployment(ctx, deploymentID)
	if err != nil {
		return fmt.Errorf("get deployment: %w", err)
	}

	if deployment.JobAgentSelector == "" {
		span.AddEvent("no job agent selector configured")
		return fmt.Errorf("no job agent selector configured for deployment '%s'", deployment.Name)
	}

	resource, err := getter.GetResource(ctx, rt.ResourceID)
	if err != nil {
		return fmt.Errorf("get resource: %w", err)
	}

	allAgents, err := getter.ListJobAgentsByWorkspaceID(ctx, workspaceID)
	if err != nil {
		return fmt.Errorf("list job agents: %w", err)
	}

	matchResult := selector.MatchJobAgentsWithResourceDetailed(
		deployment.JobAgentSelector,
		allAgents,
		resource,
	)
	if matchResult.Err != nil {
		return fmt.Errorf("match job agents: %w", matchResult.Err)
	}

	matchedAgents := matchResult.Result.Matched
	span.SetAttributes(attribute.Int("matched_agents", len(matchedAgents)))

	if len(matchedAgents) == 0 {
		return fmt.Errorf(
			"no job agents matched selector for deployment '%s' (selector=%q)",
			deployment.Name, deployment.JobAgentSelector,
		)
	}

	factory := jobs.NewFactoryFromGetters(getter)
	for i := range matchedAgents {
		agent := &matchedAgents[i]
		agent.Config = oapi.DeepMergeConfigs(
			agent.Config, deployment.JobAgentConfig, release.Version.JobAgentConfig,
		)

		job, err := factory.CreateJobForRelease(ctx, release, agent)
		if err != nil {
			return fmt.Errorf("create job for agent %s: %w", agent.Name, err)
		}

		if err := setter.CreateJobAndEnqueueDispatch(
			ctx,
			job,
			release,
			workspaceID.String(),
		); err != nil {
			return fmt.Errorf("create and enqueue job: %w", err)
		}
	}

	return nil
}

func recordErr(span trace.Span, msg string, err error) error {
	span.RecordError(err)
	span.SetStatus(codes.Error, msg+" failed")
	return fmt.Errorf("%s: %w", msg, err)
}
