package rollback

import (
	"context"
	"time"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/releasemanager/deployment/jobs"
	"workspace-engine/pkg/workspace/releasemanager/verification"
	"workspace-engine/pkg/workspace/store"

	"github.com/google/uuid"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
)

type RollbackHooks struct {
	store      *store.Store
	dispatcher *jobs.Dispatcher
}

var _ verification.VerificationHooks = &RollbackHooks{}

func NewRollbackHooks(store *store.Store, dispatcher *jobs.Dispatcher) *RollbackHooks {
	return &RollbackHooks{
		store:      store,
		dispatcher: dispatcher,
	}
}

func (h *RollbackHooks) OnVerificationStarted(ctx context.Context, verification *oapi.JobVerification) error {
	return nil
}

func (h *RollbackHooks) OnMeasurementTaken(ctx context.Context, verification *oapi.JobVerification, metricIndex int, measurement *oapi.VerificationMeasurement) error {
	return nil
}

func (h *RollbackHooks) OnMetricComplete(ctx context.Context, verification *oapi.JobVerification, metricIndex int) error {
	return nil
}

func (h *RollbackHooks) OnVerificationComplete(ctx context.Context, verificationResult *oapi.JobVerification) error {
	ctx, span := tracer.Start(ctx, "RollbackHooks.OnVerificationComplete")
	defer span.End()

	span.SetAttributes(
		attribute.String("verification.id", verificationResult.Id),
		attribute.String("verification.job_id", verificationResult.JobId),
	)

	status := verificationResult.Status()
	span.SetAttributes(attribute.String("verification.status", string(status)))

	if status != oapi.JobVerificationStatusFailed {
		span.SetStatus(codes.Ok, "verification did not fail")
		return nil
	}

	job, ok := h.store.Jobs.Get(verificationResult.JobId)
	if !ok {
		span.SetStatus(codes.Error, "job not found")
		return nil
	}

	release, ok := h.store.Releases.Get(job.ReleaseId)
	if !ok {
		span.SetStatus(codes.Error, "release not found")
		return nil
	}

	span.SetAttributes(
		attribute.String("release.id", release.ID()),
		attribute.String("release_target.key", release.ReleaseTarget.Key()),
	)

	policies, err := h.store.ReleaseTargets.GetPolicies(ctx, &release.ReleaseTarget)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "failed to get policies")
		return nil
	}

	if !h.shouldRollbackOnVerificationFailure(policies) {
		span.SetAttributes(attribute.Bool("rollback_applicable", false))
		span.SetStatus(codes.Ok, "no applicable rollback policy for verification failure")
		return nil
	}

	span.SetAttributes(attribute.Bool("rollback_applicable", true))

	currentRelease, lastSuccessfulJob, err := h.store.ReleaseTargets.GetCurrentRelease(ctx, &release.ReleaseTarget)
	if err != nil {
		span.AddEvent("No previous release to roll back to")
		span.SetStatus(codes.Ok, "no previous release available")
		return nil
	}

	// Don't rollback to the same release
	if currentRelease.ID() == release.ID() {
		span.AddEvent("Current release is the same as failed release, no rollback needed")
		span.SetStatus(codes.Ok, "already on current release")
		return nil
	}

	span.SetAttributes(
		attribute.String("rollback_to_release.id", currentRelease.ID()),
		attribute.String("rollback_to_version.id", currentRelease.Version.Id),
		attribute.String("rollback_to_version.tag", currentRelease.Version.Tag),
	)

	now := time.Now()
	newJob := oapi.Job{
		Id:             uuid.New().String(),
		ReleaseId:      lastSuccessfulJob.ReleaseId,
		JobAgentId:     lastSuccessfulJob.JobAgentId,
		JobAgentConfig: lastSuccessfulJob.JobAgentConfig,
		Status:         oapi.JobStatusPending,
		CreatedAt:      now,
		UpdatedAt:      now,
	}

	h.store.Jobs.Upsert(ctx, &newJob)

	if err := h.dispatcher.DispatchJob(ctx, &newJob); err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "rollback execution failed")
		return err
	}

	span.SetStatus(codes.Ok, "rollback executed successfully")
	return nil
}

func (h *RollbackHooks) OnVerificationStopped(ctx context.Context, verification *oapi.JobVerification) error {
	return nil
}

func (h *RollbackHooks) shouldRollbackOnVerificationFailure(policies []*oapi.Policy) bool {
	for _, policy := range policies {
		if !policy.Enabled {
			continue
		}

		for _, rule := range policy.Rules {
			if rule.Rollback == nil {
				continue
			}

			if rule.Rollback.OnVerificationFailure != nil && *rule.Rollback.OnVerificationFailure {
				return true
			}
		}
	}

	return false
}
