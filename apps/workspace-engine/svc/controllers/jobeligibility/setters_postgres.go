package jobeligibility

import (
	"context"
	"encoding/json"
	"fmt"

	"workspace-engine/pkg/db"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/reconcile"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

var _ Setter = (*PostgresSetter)(nil)

type PostgresSetter struct {
	Queue reconcile.Queue
}

func (s *PostgresSetter) CreateJob(ctx context.Context, job *oapi.Job, release *oapi.Release) error {
	q := db.GetQueries(ctx)

	jobID, err := uuid.Parse(job.Id)
	if err != nil {
		return fmt.Errorf("parse job id: %w", err)
	}

	jobAgentID, err := uuid.Parse(job.JobAgentId)
	if err != nil {
		return fmt.Errorf("parse job agent id: %w", err)
	}

	jobAgentConfig, err := json.Marshal(job.JobAgentConfig)
	if err != nil {
		return fmt.Errorf("marshal job agent config: %w", err)
	}

	dispatchContext, err := json.Marshal(job.DispatchContext)
	if err != nil {
		return fmt.Errorf("marshal dispatch context: %w", err)
	}

	if err := q.InsertJob(ctx, db.InsertJobParams{
		ID:              jobID,
		JobAgentID:      pgtype.UUID{Bytes: jobAgentID, Valid: true},
		JobAgentConfig:  jobAgentConfig,
		Status:          db.JobStatus(job.Status),
		CreatedAt:       pgtype.Timestamptz{Time: job.CreatedAt, Valid: !job.CreatedAt.IsZero()},
		UpdatedAt:       pgtype.Timestamptz{Time: job.UpdatedAt, Valid: !job.UpdatedAt.IsZero()},
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

	return nil
}

func (s *PostgresSetter) EnqueueJobDispatch(ctx context.Context, workspaceID string, jobID string) error {
	return s.Queue.Enqueue(ctx, reconcile.EnqueueParams{
		WorkspaceID: workspaceID,
		Kind:        "job-dispatch",
		ScopeType:   "job",
		ScopeID:     jobID,
	})
}
