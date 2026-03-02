package verification

import (
	"context"
	"fmt"

	"workspace-engine/pkg/db"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/reconcile"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

// VerificationStarter inserts verification metric rows into the database
// and enqueues them for processing by the reconciler.
type VerificationStarter interface {
	StartVerification(ctx context.Context, job *oapi.Job, specs []oapi.VerificationMetricSpec) error
}

// DBVerificationStarter implements VerificationStarter using Postgres and
// the reconcile work queue.
type DBVerificationStarter struct {
	WorkspaceID string
	Queue reconcile.Queue
}

func (s *DBVerificationStarter) StartVerification(ctx context.Context, job *oapi.Job, specs []oapi.VerificationMetricSpec) error {
	if len(specs) == 0 {
		return nil
	}

	if s.Queue == nil {
		return fmt.Errorf("reconcile queue is not configured; use workspace.WithReconcileQueue when creating the workspace")
	}

	queries := db.GetQueries(ctx)
	jobUUID := uuid.MustParse(job.Id)

	for _, spec := range specs {
		providerJSON, err := spec.Provider.MarshalJSON()
		if err != nil {
			return fmt.Errorf("marshal provider for metric %q: %w", spec.Name, err)
		}

		metric, err := queries.InsertJobVerificationMetric(ctx, db.InsertJobVerificationMetricParams{
			JobID:            jobUUID,
			Name:             spec.Name,
			Provider:         providerJSON,
			IntervalSeconds:  spec.IntervalSeconds,
			Count:            int32(spec.Count),
			SuccessCondition: spec.SuccessCondition,
			SuccessThreshold: toPgInt4(spec.SuccessThreshold),
			FailureCondition: toPgText(spec.FailureCondition),
			FailureThreshold: toPgInt4(spec.FailureThreshold),
		})
		if err != nil {
			return fmt.Errorf("insert verification metric %q: %w", spec.Name, err)
		}

		if err := s.Queue.Enqueue(ctx, reconcile.EnqueueParams{
			WorkspaceID: s.WorkspaceID,
			Kind:        "job-verification-metric",
			ScopeType:   "job-verification-metric",
			ScopeID:     metric.ID.String(),
		}); err != nil {
			return fmt.Errorf("enqueue verification metric %q: %w", spec.Name, err)
		}
	}

	return nil
}

func toPgInt4(v *int) pgtype.Int4 {
	if v == nil {
		return pgtype.Int4{}
	}
	return pgtype.Int4{Int32: int32(*v), Valid: true}
}

func toPgText(v *string) pgtype.Text {
	if v == nil {
		return pgtype.Text{}
	}
	return pgtype.Text{String: *v, Valid: true}
}
