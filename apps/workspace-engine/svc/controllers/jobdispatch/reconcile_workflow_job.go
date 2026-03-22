package jobdispatch

import (
	"context"
	"fmt"

	"workspace-engine/pkg/oapi"
)

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
