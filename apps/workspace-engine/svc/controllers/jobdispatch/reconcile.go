package jobdispatch

import (
	"context"
	"fmt"
	"time"

	"workspace-engine/pkg/oapi"
	"workspace-engine/svc/controllers/jobdispatch/verification"

	"github.com/charmbracelet/log"
	"github.com/google/uuid"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"
)

type ReconcileResult struct {
	RequeueAfter *time.Duration
}

// Reconcile evaluates whether a job should be created for the release target's
// desired release, and if so creates and persists the job(s). The verifier
// resolves agent-declared verification specs; pass nil when no agent
// verifier is available.
func Reconcile(ctx context.Context, getter Getter, setter Setter, verifier AgentVerifier, rt *ReleaseTarget) (*ReconcileResult, error) {
	ctx, span := tracer.Start(ctx, "jobdispatch.Reconcile")
	defer span.End()

	release, err := getter.GetDesiredRelease(ctx, rt)
	if err != nil {
		return nil, recordErr(span, "get desired release", err)
	}
	if release == nil {
		span.AddEvent("no desired release")
		return &ReconcileResult{}, nil
	}
	span.SetAttributes(attribute.String("release.id", release.ID()))

	releaseID := release.UUID()

	existingJobs, err := getter.GetJobsForRelease(ctx, releaseID)
	if err != nil {
		return nil, recordErr(span, "get jobs for release", err)
	}
	if hasSuccessfulJob(existingJobs) {
		span.AddEvent("release already has a successful job")
		return &ReconcileResult{}, nil
	}

	activeJobs, err := getter.GetActiveJobsForTarget(ctx, rt)
	if err != nil {
		return nil, recordErr(span, "get active jobs for target", err)
	}
	if len(activeJobs) > 0 {
		span.AddEvent("release target has active jobs, requeueing")
		d := 5 * time.Second
		return &ReconcileResult{RequeueAfter: &d}, nil
	}

	// TODO: Check retry policy — if the release has exhausted its retry
	// budget, return without creating a new job.

	agents, err := getter.GetJobAgentsForDeployment(ctx, rt.DeploymentID)
	if err != nil {
		return nil, recordErr(span, "get job agents", err)
	}
	if len(agents) == 0 {
		span.AddEvent("no job agents configured for deployment")
		return &ReconcileResult{}, nil
	}
	span.SetAttributes(attribute.Int("job_agents.count", len(agents)))

	for _, agent := range agents {
		job := buildJob(release, &agent)

		policySpecs, err := getter.GetVerificationPolicies(ctx, rt)
		if err != nil {
			return nil, recordErr(span, fmt.Sprintf("get verification policies for agent %s", agent.Id), err)
		}

		var agentSpecs []oapi.VerificationMetricSpec
		if verifier != nil {
			agentSpecs, err = verifier.AgentVerifications(agent.Type, agent.Config)
			if err != nil {
				log.Warn("Failed to get agent verifications",
					"agent_type", agent.Type,
					"error", err,
				)
			}
		}

		specs := verification.MergeAndDeduplicate(policySpecs, agentSpecs)

		if err := setter.CreateJobWithVerification(ctx, job, specs); err != nil {
			return nil, recordErr(span, fmt.Sprintf("create job for agent %s", agent.Id), err)
		}
		span.AddEvent("job created",
			trace.WithAttributes(
				attribute.String("job.id", job.Id),
				attribute.String("job_agent.id", agent.Id),
				attribute.Int("verification_specs", len(specs)),
			),
		)
	}

	return &ReconcileResult{}, nil
}

func buildJob(release *oapi.Release, agent *oapi.JobAgent) *oapi.Job {
	now := time.Now()
	return &oapi.Job{
		Id:             uuid.New().String(),
		ReleaseId:      release.ID(),
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
