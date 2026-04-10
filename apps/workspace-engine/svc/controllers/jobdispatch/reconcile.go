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

// Reconcile dispatches a job and enqueues verifications for the job.
func Reconcile(
	ctx context.Context,
	getter Getter,
	setter Setter,
	verifier AgentVerifier,
	dispatcher Dispatcher,
	job *oapi.Job,
) (*ReconcileResult, error) {
	ctx, span := tracer.Start(ctx, "jobdispatch.Reconcile")
	defer span.End()

	release, err := getRelease(ctx, getter, job)
	if err != nil {
		return nil, err
	}

	releaseTarget := &ReleaseTarget{
		DeploymentID:  uuid.MustParse(release.ReleaseTarget.DeploymentId),
		EnvironmentID: uuid.MustParse(release.ReleaseTarget.EnvironmentId),
		ResourceID:    uuid.MustParse(release.ReleaseTarget.ResourceId),
	}

	agentUUID, err := uuid.Parse(job.JobAgentId)
	if err != nil {
		return nil, err
	}

	agent, err := getter.GetJobAgent(ctx, agentUUID)
	if err != nil {
		return nil, err
	}

	var agentSpecs []oapi.VerificationMetricSpec
	if verifier != nil {
		agentSpecs, err = verifier.AgentVerifications(agent.Type, agent.Config)
		if err != nil {
			return nil, err
		}
	}

	policySpecs, err := getter.GetVerificationPolicies(ctx, releaseTarget)
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
