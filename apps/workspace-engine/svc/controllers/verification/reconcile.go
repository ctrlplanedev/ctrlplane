package verification

import (
	"context"
	"fmt"
	"time"

	"workspace-engine/pkg/oapi"
	"workspace-engine/svc/controllers/verification/metrics"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"
)

type ReconcileResult struct {
	RequeueAfter *time.Duration
}

// Reconcile processes a single verification metric: takes a measurement,
// records the result, and determines whether to requeue for another
// measurement or mark the verification as complete.
func Reconcile(ctx context.Context, getter Getter, setter Setter, scope *VerificationMetricScope) (*ReconcileResult, error) {
	ctx, span := tracer.Start(ctx, "verification.Reconcile")
	defer span.End()

	span.SetAttributes(
		attribute.String("verification.id", scope.VerificationID),
		attribute.Int("metric.index", scope.MetricIndex),
	)

	v, err := getter.GetVerification(ctx, scope.VerificationID)
	if err != nil {
		return nil, recordErr(span, "get verification", err)
	}
	if v == nil {
		span.AddEvent("verification not found")
		return &ReconcileResult{}, nil
	}

	if scope.MetricIndex < 0 || scope.MetricIndex >= len(v.Metrics) {
		return nil, recordErr(span, "validate metric index",
			fmt.Errorf("metric index %d out of range [0, %d)", scope.MetricIndex, len(v.Metrics)))
	}

	metric := &v.Metrics[scope.MetricIndex]
	span.SetAttributes(attribute.String("metric.name", metric.Name))

	m := metrics.NewMeasurements(metric.Measurements)
	if !m.ShouldContinue(metric) {
		span.AddEvent("metric already complete, checking overall verification")
		return handleVerificationStatus(ctx, getter, setter, v, span)
	}

	if remaining := m.TimeUntilNextMeasurement(metric); remaining > 0 {
		span.AddEvent("interval not yet elapsed, deferring",
			trace.WithAttributes(attribute.String("remaining", remaining.String())),
		)
		return &ReconcileResult{RequeueAfter: &remaining}, nil
	}

	job, err := getter.GetJob(ctx, v.JobId)
	if err != nil {
		return nil, recordErr(span, "get job", err)
	}

	providerCtx, err := getter.GetProviderContext(ctx, job.ReleaseId)
	if err != nil {
		return nil, recordErr(span, "get provider context", err)
	}

	measurement, err := metrics.Measure(ctx, metric, providerCtx)
	if err != nil {
		span.AddEvent("measurement failed, will retry",
			trace.WithAttributes(attribute.String("error", err.Error())),
		)
		interval := metric.GetInterval()
		return &ReconcileResult{RequeueAfter: &interval}, nil
	}

	span.SetAttributes(attribute.String("measurement.status", string(measurement.Status)))

	if err := setter.RecordMeasurement(ctx, scope.VerificationID, scope.MetricIndex, measurement); err != nil {
		return nil, recordErr(span, "record measurement", err)
	}

	// Re-read the verification to get the updated state after recording.
	v, err = getter.GetVerification(ctx, scope.VerificationID)
	if err != nil {
		return nil, recordErr(span, "re-read verification", err)
	}

	metric = &v.Metrics[scope.MetricIndex]
	updatedMeasurements := metrics.NewMeasurements(metric.Measurements)

	if updatedMeasurements.ShouldContinue(metric) {
		interval := metric.GetInterval()
		span.AddEvent("metric still running, requeueing",
			trace.WithAttributes(attribute.String("interval", interval.String())),
		)
		return &ReconcileResult{RequeueAfter: &interval}, nil
	}

	span.AddEvent("metric complete, checking overall verification")
	return handleVerificationStatus(ctx, getter, setter, v, span)
}

// handleVerificationStatus checks the aggregate status across all metrics.
// If the verification is no longer running, it updates the message and
// enqueues a desired-release reconcile item so the pipeline can advance.
func handleVerificationStatus(ctx context.Context, getter Getter, setter Setter, v *oapi.JobVerification, span trace.Span) (*ReconcileResult, error) {
	status := v.Status()
	span.SetAttributes(attribute.String("verification.status", string(status)))

	if status == oapi.JobVerificationStatusRunning {
		return &ReconcileResult{}, nil
	}

	message := fmt.Sprintf("Verification %s", status)
	if err := setter.UpdateVerificationMessage(ctx, v.Id, message); err != nil {
		return nil, recordErr(span, "update verification message", err)
	}

	job, err := getter.GetJob(ctx, v.JobId)
	if err != nil {
		return nil, recordErr(span, "get job for release target", err)
	}

	rt, err := getter.GetReleaseTarget(ctx, job.ReleaseId)
	if err != nil {
		return nil, recordErr(span, "get release target", err)
	}

	if err := setter.EnqueueDesiredRelease(ctx, rt.WorkspaceID, rt); err != nil {
		return nil, recordErr(span, "enqueue desired release", err)
	}

	span.AddEvent("verification terminal, enqueued desired-release",
		trace.WithAttributes(attribute.String("status", string(status))),
	)
	return &ReconcileResult{}, nil
}

func recordErr(span trace.Span, msg string, err error) error {
	span.RecordError(err)
	span.SetStatus(codes.Error, msg+" failed")
	return fmt.Errorf("%s: %w", msg, err)
}
