package workflows

import (
	"context"
	"encoding/json"
	"fmt"
	"time"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/reconcile"
	"workspace-engine/pkg/selector"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

type Setter interface {
	CreateWorkflowRun(ctx context.Context, workspaceID string, workflow *oapi.Workflow, inputs map[string]any) error
}

var _ Setter = &PostgresSetter{}

type PostgresSetter struct {
	queue reconcile.Queue
}

func NewPostgresSetter(queue reconcile.Queue) *PostgresSetter {
	return &PostgresSetter{queue: queue}
}

func (s *PostgresSetter) buildDispatchContext(workflow *oapi.Workflow, inputs map[string]any) *oapi.DispatchContext {
	return &oapi.DispatchContext{
		Workflow: workflow,
		Inputs:   &inputs,
	}
}

func (s *PostgresSetter) CreateWorkflowRun(ctx context.Context, workspaceID string, workflow *oapi.Workflow, inputs map[string]any) error {
	dispatchContext := s.buildDispatchContext(workflow, inputs)

	workflowIDUUID, err := uuid.Parse(workflow.Id)
	if err != nil {
		return fmt.Errorf("parse workflow id: %w", err)
	}

	tx, err := db.GetPool(ctx).Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin transaction: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	queries := db.GetQueries(ctx).WithTx(tx)

	workflowRun, err := queries.InsertWorkflowRun(ctx, db.InsertWorkflowRunParams{
		WorkflowID: workflowIDUUID,
		Inputs:     inputs,
	})
	if err != nil {
		return fmt.Errorf("insert workflow run: %w", err)
	}

	for _, jobAgent := range workflow.Jobs {
		isMatchingSelector, err := selector.Match(ctx, jobAgent.Selector, *dispatchContext)
		if err != nil {
			return fmt.Errorf("match selector: %w", err)
		}
		if !isMatchingSelector {
			continue
		}
		if err := s.dispatchJobForAgent(ctx, queries, jobAgent, workflowRun.ID, dispatchContext, workspaceID); err != nil {
			return err
		}
	}

	return tx.Commit(ctx)
}

func (s *PostgresSetter) dispatchJobForAgent(
	ctx context.Context,
	queries *db.Queries,
	jobAgent oapi.WorkflowJobAgent,
	workflowRunID uuid.UUID,
	dispatchContext *oapi.DispatchContext,
	workspaceID string,
) error {
	jobAgentIDUUID, err := uuid.Parse(jobAgent.Id)
	if err != nil {
		return fmt.Errorf("parse job agent id: %w", err)
	}
	jobAgentConfig, err := json.Marshal(jobAgent.Config)
	if err != nil {
		return fmt.Errorf("marshal job agent config: %w", err)
	}
	dispatchContextJSON, err := json.Marshal(dispatchContext)
	if err != nil {
		return fmt.Errorf("marshal dispatch context: %w", err)
	}

	now := pgtype.Timestamptz{Time: time.Now().UTC(), Valid: true}
	jobID := uuid.New()

	if err := queries.InsertJob(ctx, db.InsertJobParams{
		ID:              jobID,
		Status:          db.JobStatusPending,
		JobAgentID:      pgtype.UUID{Bytes: jobAgentIDUUID, Valid: true},
		JobAgentConfig:  jobAgentConfig,
		DispatchContext: dispatchContextJSON,
		CreatedAt:       now,
		UpdatedAt:       now,
	}); err != nil {
		return fmt.Errorf("insert job: %w", err)
	}

	if _, err := queries.InsertWorkflowJob(ctx, db.InsertWorkflowJobParams{
		WorkflowRunID: workflowRunID,
		JobID:         jobID,
	}); err != nil {
		return fmt.Errorf("insert workflow job: %w", err)
	}

	if err := s.queue.Enqueue(ctx, reconcile.EnqueueParams{
		WorkspaceID: workspaceID,
		Kind:        "job-dispatch",
		ScopeType:   "job",
		ScopeID:     jobID.String(),
	}); err != nil {
		return fmt.Errorf("enqueue job dispatch: %w", err)
	}

	return nil
}
