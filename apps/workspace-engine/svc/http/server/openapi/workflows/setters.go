package workflows

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/reconcile"
)

type Setter interface {
	PersistWorkflowRun(
		ctx context.Context,
		workspaceID string,
		workflowID string,
		inputs map[string]any,
		dispatches []plannedDispatch,
	) (*oapi.WorkflowRunResult, error)
}

var _ Setter = &PostgresSetter{}

type PostgresSetter struct {
	queue reconcile.Queue
}

func NewPostgresSetter(queue reconcile.Queue) *PostgresSetter {
	return &PostgresSetter{queue: queue}
}

func (s *PostgresSetter) PersistWorkflowRun(
	ctx context.Context,
	workspaceID string,
	workflowID string,
	inputs map[string]any,
	dispatches []plannedDispatch,
) (*oapi.WorkflowRunResult, error) {
	workflowIDUUID, err := uuid.Parse(workflowID)
	if err != nil {
		return nil, fmt.Errorf("parse workflow id: %w", err)
	}

	tx, err := db.GetPool(ctx).Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin transaction: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	queries := db.GetQueries(ctx).WithTx(tx)

	workflowRun, err := queries.InsertWorkflowRun(ctx, db.InsertWorkflowRunParams{
		WorkflowID: workflowIDUUID,
		Inputs:     inputs,
	})
	if err != nil {
		return nil, fmt.Errorf("insert workflow run: %w", err)
	}

	jobs := make([]oapi.WorkflowRunJob, 0, len(dispatches))
	for _, d := range dispatches {
		job, err := insertJob(ctx, queries, d, workflowRun.ID)
		if err != nil {
			return nil, err
		}
		jobs = append(jobs, job)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit transaction: %w", err)
	}

	for _, job := range jobs {
		if err := s.queue.Enqueue(ctx, reconcile.EnqueueParams{
			WorkspaceID: workspaceID,
			Kind:        "job-dispatch",
			ScopeType:   "job",
			ScopeID:     job.JobId,
		}); err != nil {
			return nil, fmt.Errorf("enqueue job dispatch: %w", err)
		}
	}

	return &oapi.WorkflowRunResult{
		Id:         workflowRun.ID.String(),
		WorkflowId: workflowID,
		Inputs:     inputs,
		Jobs:       jobs,
	}, nil
}

func insertJob(
	ctx context.Context,
	queries *db.Queries,
	d plannedDispatch,
	workflowRunID uuid.UUID,
) (oapi.WorkflowRunJob, error) {
	jobAgentConfig, err := json.Marshal(d.mergedConfig)
	if err != nil {
		return oapi.WorkflowRunJob{}, fmt.Errorf("marshal job agent config: %w", err)
	}
	dispatchContextJSON, err := json.Marshal(d.dispatchCtx)
	if err != nil {
		return oapi.WorkflowRunJob{}, fmt.Errorf("marshal dispatch context: %w", err)
	}

	now := pgtype.Timestamptz{Time: time.Now().UTC(), Valid: true}
	jobID := uuid.New()

	if err := queries.InsertJob(ctx, db.InsertJobParams{
		ID:              jobID,
		Status:          db.JobStatusPending,
		JobAgentID:      pgtype.UUID{Bytes: d.runner.ID, Valid: true},
		JobAgentConfig:  jobAgentConfig,
		DispatchContext: dispatchContextJSON,
		CreatedAt:       now,
		UpdatedAt:       now,
	}); err != nil {
		return oapi.WorkflowRunJob{}, fmt.Errorf("insert job: %w", err)
	}

	if _, err := queries.InsertWorkflowJob(ctx, db.InsertWorkflowJobParams{
		WorkflowRunID: workflowRunID,
		JobID:         jobID,
	}); err != nil {
		return oapi.WorkflowRunJob{}, fmt.Errorf("insert workflow job: %w", err)
	}

	return oapi.WorkflowRunJob{
		JobId:      jobID.String(),
		JobAgentId: d.runner.ID.String(),
	}, nil
}
