package jobverificationmetric

import (
	"context"
	"encoding/json"
	"fmt"

	"workspace-engine/pkg/db"
	"workspace-engine/pkg/reconcile"
	"workspace-engine/svc/controllers/jobverificationmetric/metrics"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

var _ Setter = &PostgresSetter{}

type PostgresSetter struct {
	Queue reconcile.Queue
}

func (s *PostgresSetter) RecordMeasurement(ctx context.Context, metricID string, measurement metrics.Measurement) error {
	data, err := json.Marshal(measurement.Data)
	if err != nil {
		return fmt.Errorf("marshal measurement data: %w", err)
	}

	return db.GetQueries(ctx).InsertJobVerificationMetricMeasurement(ctx, db.InsertJobVerificationMetricMeasurementParams{
		JobVerificationMetricStatusID: uuid.MustParse(metricID),
		Data:                          data,
		MeasuredAt:                    pgtype.Timestamptz{Time: measurement.MeasuredAt, Valid: true},
		Message:                       measurement.Message,
		Status:                        db.JobVerificationStatus(measurement.Status),
	})
}

func (s *PostgresSetter) CompleteMetric(ctx context.Context, metricID string, status metrics.VerificationStatus) error {
	queries := db.GetQueries(ctx)
	metricUUID := uuid.MustParse(metricID)

	siblings, err := queries.GetSiblingMetricStatuses(ctx, metricUUID)
	if err != nil {
		return fmt.Errorf("get sibling metric statuses: %w", err)
	}

	allTerminal := true
	anyFailed := false
	for _, s := range siblings {
		if !s.IsTerminal {
			allTerminal = false
		}
		if s.IsFailed {
			anyFailed = true
		}
	}

	_ = anyFailed

	if !allTerminal {
		return nil
	}

	rt, err := queries.GetReleaseTargetForMetric(ctx, metricUUID)
	if err != nil {
		return fmt.Errorf("get release target for metric: %w", err)
	}

	scopeID := rt.DeploymentID.String() + ":" + rt.EnvironmentID.String() + ":" + rt.ResourceID.String()
	if err := s.Queue.Enqueue(ctx, reconcile.EnqueueParams{
		WorkspaceID: rt.WorkspaceID.String(),
		Kind:        "desired-release",
		ScopeType:   "release-target",
		ScopeID:     scopeID,
	}); err != nil {
		return fmt.Errorf("enqueue desired-release: %w", err)
	}

	return nil
}
