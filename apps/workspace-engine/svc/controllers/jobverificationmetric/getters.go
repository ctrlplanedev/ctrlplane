package jobverificationmetric

import (
	"context"

	"workspace-engine/svc/controllers/jobverificationmetric/metrics"
	"workspace-engine/svc/controllers/jobverificationmetric/metrics/provider"
)

type Getter interface {
	// GetVerificationMetric returns the metric row with its measurements
	// pre-loaded from the verification_metric and
	// verification_metric_measurement tables.
	GetVerificationMetric(ctx context.Context, metricID string) (*metrics.VerificationMetric, error)

	// GetProviderContext builds the context needed for metric measurement
	// by looking up the job, release, resource, environment, version,
	// deployment, and variables through the job_verification_metric join.
	GetProviderContext(ctx context.Context, metricID string) (*provider.ProviderContext, error)
}
