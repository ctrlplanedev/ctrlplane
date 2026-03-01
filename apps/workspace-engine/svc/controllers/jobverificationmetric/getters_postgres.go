package jobverificationmetric

import (
	"context"
	"encoding/json"
	"time"

	"workspace-engine/pkg/db"
	"workspace-engine/svc/controllers/jobverificationmetric/metrics"
	"workspace-engine/svc/controllers/jobverificationmetric/metrics/provider"

	"github.com/google/uuid"
)

var _ Getter = &PostgresGetter{}

type PostgresGetter struct{}

type rawMeasurement struct {
	ID         string         `json:"id"`
	MetricID   string         `json:"metric_id"`
	Data       map[string]any `json:"data"`
	MeasuredAt time.Time      `json:"measured_at"`
	Message    string         `json:"message"`
	Status     string         `json:"status"`
}

func (p *PostgresGetter) GetVerificationMetric(ctx context.Context, metricID string) (*metrics.VerificationMetric, error) {
	row, err := db.GetQueries(ctx).GetVerificationMetricWithMeasurements(ctx, uuid.MustParse(metricID))
	if err != nil {
		return nil, err
	}

	var raw []rawMeasurement
	if err := json.Unmarshal(row.Measurements, &raw); err != nil {
		return nil, err
	}

	measurements := make([]metrics.Measurement, len(raw))
	for i, r := range raw {
		measurements[i] = metrics.Measurement{
			ID:         r.ID,
			MetricID:   r.MetricID,
			Data:       r.Data,
			MeasuredAt: r.MeasuredAt,
			Message:    r.Message,
			Status:     metrics.MeasurementStatus(r.Status),
		}
	}

	return &metrics.VerificationMetric{
		ID:               row.ID.String(),
		Name:             row.Name,
		Provider:         row.Provider,
		IntervalSeconds:  row.IntervalSeconds,
		Count:            row.Count,
		SuccessCondition: row.SuccessCondition,
		SuccessThreshold: &row.SuccessThreshold.Int32,
		FailureCondition: &row.FailureCondition.String,
		FailureThreshold: &row.FailureThreshold.Int32,
		Measurements:     measurements,
	}, nil
}

func (p *PostgresGetter) GetProviderContext(ctx context.Context, metricID string) (*provider.ProviderContext, error) {
	panic("unimplemented")
}
