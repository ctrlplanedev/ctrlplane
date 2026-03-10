package jobeligibility

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/reconcile"
)

var _ Setter = (*PostgresSetter)(nil)

type PostgresSetter struct {
	Queue reconcile.Queue
}

func (s *PostgresSetter) CreateJob(
	ctx context.Context,
	job *oapi.Job,
	release *oapi.Release,
) error {
	jobID, err := uuid.Parse(job.Id)
	if err != nil {
		return fmt.Errorf("parse job id: %w", err)
	}

	var jobAgentIDParam pgtype.UUID
	if job.JobAgentId != "" {
		parsed, err := uuid.Parse(job.JobAgentId)
		if err != nil {
			return fmt.Errorf("parse job agent id: %w", err)
		}
		jobAgentIDParam = pgtype.UUID{Bytes: parsed, Valid: true}
	}

	jobAgentConfig, err := json.Marshal(job.JobAgentConfig)
	if err != nil {
		return fmt.Errorf("marshal job agent config: %w", err)
	}

	dispatchContext, err := json.Marshal(job.DispatchContext)
	if err != nil {
		return fmt.Errorf("marshal dispatch context: %w", err)
	}

	tx, err := db.GetPool(ctx).Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin transaction: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	q := db.GetQueries(ctx).WithTx(tx)

	var completedAt pgtype.Timestamptz
	if job.CompletedAt != nil {
		completedAt = pgtype.Timestamptz{Time: *job.CompletedAt, Valid: true}
	}

	if err := q.InsertJob(ctx, db.InsertJobParams{
		ID:              jobID,
		JobAgentID:      jobAgentIDParam,
		JobAgentConfig:  jobAgentConfig,
		Status:          db.ToDBJobStatus(job.Status),
		Message:         job.Message,
		CreatedAt:       pgtype.Timestamptz{Time: job.CreatedAt, Valid: !job.CreatedAt.IsZero()},
		UpdatedAt:       pgtype.Timestamptz{Time: job.UpdatedAt, Valid: !job.UpdatedAt.IsZero()},
		CompletedAt:     completedAt,
		DispatchContext: dispatchContext,
	}); err != nil {
		return fmt.Errorf("insert job: %w", err)
	}

	if err := q.InsertReleaseJob(ctx, db.InsertReleaseJobParams{
		ReleaseID: release.Id,
		JobID:     jobID,
	}); err != nil {
		return fmt.Errorf("insert release job: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit transaction: %w", err)
	}

	return nil
}

func (s *PostgresSetter) EnqueueJobDispatch(
	ctx context.Context,
	workspaceID string,
	jobID string,
) error {
	return s.Queue.Enqueue(ctx, reconcile.EnqueueParams{
		WorkspaceID: workspaceID,
		Kind:        "job-dispatch",
		ScopeType:   "job",
		ScopeID:     jobID,
	})
}
