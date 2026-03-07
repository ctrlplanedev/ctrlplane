package jobdispatch

import (
	"context"
	"fmt"
	"time"

	"workspace-engine/pkg/oapi"
	"workspace-engine/svc/controllers/jobdispatch/verification"

	"github.com/google/uuid"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"
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

func getDeployment(ctx context.Context, getter Getter, release *oapi.Release) (*oapi.Deployment, error) {
	ctx, span := tracer.Start(ctx, "jobdispatch.getDeployment")
	defer span.End()

	deploymentID := uuid.MustParse(release.Version.DeploymentId)
	deployment, err := getter.GetDeployment(ctx, deploymentID)
	if err != nil {
		return nil, recordErr(span, "get deployment", err)
	}
	return deployment, nil
}

func getJobAgents(ctx context.Context, getter Getter, release *oapi.Release) ([]oapi.JobAgent, error) {
	ctx, span := tracer.Start(ctx, "jobdispatch.getJobAgents")
	defer span.End()

	deployment, err := getDeployment(ctx, getter, release)
	if err != nil {
		return nil, err
	}

	if deployment.JobAgents == nil {
		return nil, fmt.Errorf("deployment job agents are nil")
	}

	jobAgents := make([]oapi.JobAgent, 0)
	for _, jobAgent := range *deployment.JobAgents {
		jobAgent, err := getter.GetJobAgent(ctx, uuid.MustParse(jobAgent.Ref))
		if err != nil {
			return nil, err
		}
		jobAgents = append(jobAgents, *jobAgent)
	}
	return jobAgents, nil
}

func getAgentSpecs(ctx context.Context, verifier AgentVerifier, getter Getter, release *oapi.Release) ([]oapi.VerificationMetricSpec, error) {
	ctx, span := tracer.Start(ctx, "jobdispatch.getAgentSpecs")
	defer span.End()

	agents, err := getJobAgents(ctx, getter, release)
	if err != nil {
		return nil, err
	}

	specs := make([]oapi.VerificationMetricSpec, 0)
	for _, agent := range agents {
		agentSpecs, err := verifier.AgentVerifications(agent.Type, agent.Config)
		if err != nil {
			return nil, recordErr(span, fmt.Sprintf("get agent verifications for agent %s", agent.Id), err)
		}
		specs = append(specs, agentSpecs...)
	}
	return specs, nil
}

// Reconcile evaluates whether a job should be created for the release target's
// desired release, and if so creates and persists the job(s). The verifier
// resolves agent-declared verification specs; pass nil when no agent
// verifier is available.
func Reconcile(ctx context.Context, getter Getter, setter Setter, verifier AgentVerifier, dispatcher Dispatcher, job *oapi.Job) (*ReconcileResult, error) {
	ctx, span := tracer.Start(ctx, "jobdispatch.Reconcile")
	defer span.End()

	release, err := getRelease(ctx, getter, job)
	if err != nil {
		return nil, err
	}

	agents, err := getJobAgents(ctx, getter, release)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return nil, err
	}
	if len(agents) == 0 {
		span.AddEvent("no job agents configured for deployment")
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

	agentSpecs, err := getAgentSpecs(ctx, verifier, getter, release)
	if err != nil {
		return nil, err
	}

	specs := verification.MergeAndDeduplicate(policySpecs, agentSpecs)

	if err := dispatcher.Dispatch(ctx, job); err != nil {
		return nil, recordErr(span, "dispatch job", err)
	}

	if err := setter.CreateVerifications(ctx, job, specs); err != nil {
		return nil, recordErr(span, "create verifications", err)
	}

	return &ReconcileResult{}, nil
}

func buildJob(release *oapi.Release, agent *oapi.JobAgent) *oapi.Job {
	now := time.Now()
	return &oapi.Job{
		Id:             uuid.New().String(),
		ReleaseId:      release.Id.String(),
		JobAgentId:     agent.Id,
		JobAgentConfig: agent.Config,
		Status:         oapi.JobStatusPending,
		Metadata:       map[string]string{},
		CreatedAt:      now,
		UpdatedAt:      now,
	}
}

func hasSuccessfulJob(jobs []oapi.Job) bool {
	for _, j := range jobs {
		if j.Status == oapi.JobStatusSuccessful {
			return true
		}
	}
	return false
}

func recordErr(span trace.Span, msg string, err error) error {
	span.RecordError(err)
	span.SetStatus(codes.Error, msg+" failed")
	return fmt.Errorf("%s: %w", msg, err)
}
