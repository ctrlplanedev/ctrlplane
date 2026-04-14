package forcedeploy

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/oapi"
	reconciledb "workspace-engine/pkg/reconcile/postgres/db"
)

var _ Setter = (*PostgresSetter)(nil)

type PostgresSetter struct{}

func (s *PostgresSetter) CreateJobAndEnqueueDispatch(
	ctx context.Context,
	job *oapi.Job,
	release *oapi.Release,
	workspaceID string,
) error {
	jobID, err := uuid.Parse(job.Id)
	if err != nil {
		return fmt.Errorf("parse job id: %w", err)
	}

	wsID, err := uuid.Parse(workspaceID)
	if err != nil {
		return fmt.Errorf("parse workspace id: %w", err)
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
		Message:         toPgText(job.Message),
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

	now := time.Now()
	rq := reconciledb.New(tx)
	if err := rq.UpsertReconcileWorkItem(ctx, reconciledb.UpsertReconcileWorkItemParams{
		WorkspaceID: wsID,
		Kind:        "job-dispatch",
		ScopeType:   "job",
		ScopeID:     job.Id,
		EventTs:     pgtype.Timestamptz{Time: now, Valid: true},
		Priority:    100,
		NotBefore:   pgtype.Timestamptz{Time: now.Add(-1 * time.Second), Valid: true},
	}); err != nil {
		return fmt.Errorf("enqueue job dispatch: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit transaction: %w", err)
	}

	return nil
}

func toPgText(s *string) pgtype.Text {
	if s == nil {
		return pgtype.Text{}
	}
	return pgtype.Text{String: *s, Valid: true}
}
