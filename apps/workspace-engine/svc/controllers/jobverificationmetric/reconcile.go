package jobverificationmetric

import (
	"context"
	"fmt"
	"time"

	"workspace-engine/svc/controllers/jobverificationmetric/metrics"

	"github.com/charmbracelet/log"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"
)

type ReconcileResult struct {
	RequeueAfter *time.Duration
}

// Reconcile processes a single verification metric: takes a measurement,
// records the result, and determines whether to requeue for another
// measurement or mark the metric as complete.
func Reconcile(ctx context.Context, getter Getter, setter Setter, metricID string) (*ReconcileResult, error) {
	ctx, span := tracer.Start(ctx, "verification.Reconcile")
	defer span.End()

	metric, err := getter.GetVerificationMetric(ctx, metricID)
	if err != nil {
		return nil, recordErr(span, "get verification metric", err)
	}
	if metric == nil {
		span.AddEvent("metric not found")
		return &ReconcileResult{}, nil
	}

	m := metrics.NewMeasurements(metric.Measurements)
	if !m.ShouldContinue(metric) {
		span.AddEvent("metric already complete")
		status := m.Phase(metric)
		if err := setter.CompleteMetric(ctx, metricID, status); err != nil {
			return nil, recordErr(span, "complete metric", err)
		}
		return &ReconcileResult{}, nil
	}

	if remaining := m.TimeUntilNextMeasurement(metric); remaining > 0 {
		span.AddEvent("interval not yet elapsed, deferring",
			trace.WithAttributes(attribute.String("remaining", remaining.String())),
		)
		log.Info("Interval not yet elapsed, deferring", "remaining", remaining)
		return &ReconcileResult{RequeueAfter: &remaining}, nil
	}

	providerCtx, err := getter.GetProviderContext(ctx, metricID)
	if err != nil {
		return nil, recordErr(span, "get provider context", err)
	}

	measurement, err := metrics.Measure(ctx, metric, providerCtx)
	if err != nil {
		span.AddEvent("measurement failed, will retry",
			trace.WithAttributes(attribute.String("error", err.Error())),
		)
		interval := metric.Interval()
		return &ReconcileResult{RequeueAfter: &interval}, nil
	}

	span.SetAttributes(attribute.String("measurement.status", string(measurement.Status)))

	if err := setter.RecordMeasurement(ctx, metricID, measurement); err != nil {
		return nil, recordErr(span, "record measurement", err)
	}

	// Re-read to get the updated state after recording.
	metric, err = getter.GetVerificationMetric(ctx, metricID)
	if err != nil {
		return nil, recordErr(span, "re-read verification metric", err)
	}

	updated := metrics.NewMeasurements(metric.Measurements)

	if updated.ShouldContinue(metric) {
		interval := metric.Interval()
		span.AddEvent("metric still running, requeueing",
			trace.WithAttributes(attribute.String("interval", interval.String())),
		)
		return &ReconcileResult{RequeueAfter: &interval}, nil
	}

	span.AddEvent("metric complete")
	status := updated.Phase(metric)
	if err := setter.CompleteMetric(ctx, metricID, status); err != nil {
		return nil, recordErr(span, "complete metric", err)
	}

	return &ReconcileResult{}, nil
}

func recordErr(span trace.Span, msg string, err error) error {
	span.RecordError(err)
	span.SetStatus(codes.Error, msg+" failed")
	return fmt.Errorf("%s: %w", msg, err)
}
