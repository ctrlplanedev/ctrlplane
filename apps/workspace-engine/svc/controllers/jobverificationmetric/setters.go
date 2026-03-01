package jobverificationmetric

import (
	"context"

	"workspace-engine/svc/controllers/jobverificationmetric/metrics"
)

type Setter interface {
	// RecordMeasurement inserts a row into verification_metric_measurement.
	RecordMeasurement(ctx context.Context, metricID string, measurement metrics.Measurement) error

	// CompleteMetric is called when the metric reaches a terminal state
	// (passed or failed). The implementation should handle any downstream
	// effects, such as checking sibling metrics via job_verification_metric,
	// updating the job verification status, and enqueuing a desired-release
	// reconcile item when the entire verification is done.
	CompleteMetric(ctx context.Context, metricID string, status metrics.VerificationStatus) error
}
