package rollback

import (
	"context"
	"time"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/releasemanager/deployment/jobs"
	"workspace-engine/pkg/workspace/releasemanager/verification"
	"workspace-engine/pkg/workspace/store"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
)

var hookTracer = otel.Tracer("RollbackHooks")

type reconcileTargetFn func(ctx context.Context, releaseTarget *oapi.ReleaseTarget) error

type RollbackHooks struct {
	store           *store.Store
	dispatcher      *jobs.Dispatcher
	reconcileTarget reconcileTargetFn
}

var _ verification.VerificationHooks = &RollbackHooks{}

func NewRollbackHooks(store *store.Store, dispatcher *jobs.Dispatcher) *RollbackHooks {
	return &RollbackHooks{
		store:      store,
		dispatcher: dispatcher,
	}
}

func (h *RollbackHooks) SetReconcileTargetFn(reconcileTargetFn reconcileTargetFn) *RollbackHooks {
	h.reconcileTarget = reconcileTargetFn
	return h
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
	ctx, span := hookTracer.Start(ctx, "RollbackHooks.OnVerificationComplete")
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

	releaseRollback := oapi.ReleaseRollback{
		ReleaseId:    release.ID(),
		RolledBackAt: time.Now(),
	}
	if err := h.store.ReleaseRollbacks.Upsert(ctx, &releaseRollback); err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "failed to create release rollback")
		return err
	}

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
