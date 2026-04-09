package jobdispatch

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
	"workspace-engine/svc/controllers/jobdispatch/verification"
)

type ReconcileResult struct {
	RequeueAfter *time.Duration
}

func getRelease(ctx context.Context, getter Getter, job *oapi.Job) (*oapi.Release, error) {
	ctx, span := tracer.Start(ctx, "jobdispatch.getRelease")
	defer span.End()

	releaseID := uuid.MustParse(job.ReleaseId)
	release, err := getter.GetRelease(ctx, releaseID)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return nil, recordErr(span, "get release", err)
	}

	span.SetAttributes(attribute.String("release.id", release.Id.String()))
	span.SetAttributes(attribute.String("release.content_hash", release.ContentHash()))
	return release, nil
}

func getDeployment(
	ctx context.Context,
	getter Getter,
	release *oapi.Release,
) (*oapi.Deployment, error) {
	ctx, span := tracer.Start(ctx, "jobdispatch.getDeployment")
	defer span.End()

	deploymentID := uuid.MustParse(release.Version.DeploymentId)
	deployment, err := getter.GetDeployment(ctx, deploymentID)
	if err != nil {
		return nil, recordErr(span, "get deployment", err)
	}
	return deployment, nil
}

func getJobAgents(
	ctx context.Context,
	getter Getter,
	workspaceID uuid.UUID,
	release *oapi.Release,
) ([]oapi.JobAgent, error) {
	ctx, span := tracer.Start(ctx, "jobdispatch.getJobAgents")
	defer span.End()

	deployment, err := getDeployment(ctx, getter, release)
	if err != nil {
		return nil, err
	}

	if deployment.JobAgentSelector == "" {
		return nil, fmt.Errorf("deployment job agent selector is empty")
	}

	resourceID, err := uuid.Parse(release.ReleaseTarget.ResourceId)
	if err != nil {
		return nil, fmt.Errorf("parse resource id: %w", err)
	}

	resource, err := getter.GetResource(ctx, resourceID)
	if err != nil {
		return nil, fmt.Errorf("get resource: %w", err)
	}

	allAgents, err := getter.ListJobAgentsByWorkspaceID(ctx, workspaceID)
	if err != nil {
		return nil, fmt.Errorf("list job agents: %w", err)
	}

	matched, err := selector.MatchJobAgentsWithResource(
		ctx,
		deployment.JobAgentSelector,
		allAgents,
		resource,
	)
	if err != nil {
		return nil, fmt.Errorf("match job agents: %w", err)
	}

	return matched, nil
}

func getAgentSpecs(
	ctx context.Context,
	verifier AgentVerifier,
	getter Getter,
	workspaceID uuid.UUID,
	release *oapi.Release,
) ([]oapi.VerificationMetricSpec, error) {
	ctx, span := tracer.Start(ctx, "jobdispatch.getAgentSpecs")
	defer span.End()

	if verifier == nil {
		return nil, nil
	}

	agents, err := getJobAgents(ctx, getter, workspaceID, release)
	if err != nil {
		return nil, err
	}

	specs := make([]oapi.VerificationMetricSpec, 0)
	for _, agent := range agents {
		agentSpecs, err := verifier.AgentVerifications(agent.Type, agent.Config)
		if err != nil {
			return nil, recordErr(
				span,
				fmt.Sprintf("get agent verifications for agent %s", agent.Id),
				err,
			)
		}
		specs = append(specs, agentSpecs...)
	}
	return specs, nil
}

// Reconcile dispatches a job and enqueues verifications for the job.
func Reconcile(
	ctx context.Context,
	getter Getter,
	setter Setter,
	verifier AgentVerifier,
	dispatcher Dispatcher,
	workspaceID uuid.UUID,
	job *oapi.Job,
) (*ReconcileResult, error) {
	ctx, span := tracer.Start(ctx, "jobdispatch.Reconcile")
	defer span.End()

	release, err := getRelease(ctx, getter, job)
	if err != nil {
		return nil, err
	}

	agents, err := getJobAgents(ctx, getter, workspaceID, release)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return nil, err
	}
	if len(agents) == 0 {
		span.AddEvent("no job agents matched selector for deployment")
		return &ReconcileResult{}, nil
	}

	releaseTarget := &ReleaseTarget{
		DeploymentID:  uuid.MustParse(release.ReleaseTarget.DeploymentId),
		EnvironmentID: uuid.MustParse(release.ReleaseTarget.EnvironmentId),
		ResourceID:    uuid.MustParse(release.ReleaseTarget.ResourceId),
	}

	policySpecs, err := getter.GetVerificationPolicies(ctx, releaseTarget)
	if err != nil {
		return nil, err
	}

	agentSpecs, err := getAgentSpecs(ctx, verifier, getter, workspaceID, release)
	if err != nil {
		return nil, err
	}

	specs := verification.MergeAndDeduplicate(policySpecs, agentSpecs)

	specs, err = verification.TemplateSpecs(specs, job.DispatchContext)
	if err != nil {
		return nil, recordErr(span, "template verification specs", err)
	}

	if err := dispatcher.Dispatch(ctx, job); err != nil {
		return nil, recordErr(span, "dispatch job", err)
	}

	if err := setter.CreateVerifications(ctx, job, specs); err != nil {
		return nil, recordErr(span, "create verifications", err)
	}

	return &ReconcileResult{}, nil
}

func recordErr(span trace.Span, msg string, err error) error {
	span.RecordError(err)
	span.SetStatus(codes.Error, msg+" failed")
	return fmt.Errorf("%s: %w", msg, err)
}
