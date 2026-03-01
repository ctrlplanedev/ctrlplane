package jobverificationmetric

import (
	"context"

	"workspace-engine/svc/controllers/jobverificationmetric/metrics"
)

var _ Setter = &PostgresSetter{}

type PostgresSetter struct{}

func (s *PostgresSetter) RecordMeasurement(ctx context.Context, metricID string, measurement metrics.Measurement) error {
	panic("unimplemented")
}

func (s *PostgresSetter) CompleteMetric(ctx context.Context, metricID string, status metrics.VerificationStatus) error {
	panic("unimplemented")
}
