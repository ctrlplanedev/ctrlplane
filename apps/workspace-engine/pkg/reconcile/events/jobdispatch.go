package events

import (
	"context"
	"workspace-engine/pkg/reconcile"
)

const JobDispatchKind = "job-dispatch"

type JobDispatchParams struct {
	WorkspaceID string
	JobID       string
}

func EnqueueJobDispatch(queue reconcile.Queue, ctx context.Context, params JobDispatchParams) error {
	return queue.Enqueue(ctx, reconcile.EnqueueParams{
		WorkspaceID: params.WorkspaceID,
		Kind:        JobDispatchKind,
		ScopeType:   "job",
		ScopeID:     params.JobID,
	})
}
