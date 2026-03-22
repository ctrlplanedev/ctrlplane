package jobdispatch

import (
	"context"
	"errors"
	"fmt"

	"workspace-engine/pkg/db"
	"workspace-engine/pkg/oapi"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

func IsWorkflowJob(ctx context.Context, jobID uuid.UUID) (bool, error) {
	_, err := db.GetQueries(ctx).GetWorkflowJobByJobID(ctx, jobID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return false, nil
		}
		return false, fmt.Errorf("check workflow job: %w", err)
	}
	return true, nil
}

func ReconcileWorkflowJob(
	ctx context.Context,
	dispatcher Dispatcher,
	job *oapi.Job,
) (*ReconcileResult, error) {
	if err := dispatcher.Dispatch(ctx, job); err != nil {
		return nil, fmt.Errorf("dispatch workflow job: %w", err)
	}
	return &ReconcileResult{RequeueAfter: nil}, nil
}
