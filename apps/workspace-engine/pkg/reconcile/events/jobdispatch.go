package events

import (
	"context"
	"fmt"
	"workspace-engine/pkg/reconcile"
)

const JobDispatchKind = "job-dispatch"

type JobDispatchParams struct {
	WorkspaceID   string
	DeploymentID  string
	EnvironmentID string
	ResourceID    string
}

func (params JobDispatchParams) ScopeID() string {
	return fmt.Sprintf("%s:%s:%s", params.DeploymentID, params.EnvironmentID, params.ResourceID)
}

func EnqueueJobDispatch(queue reconcile.Queue, ctx context.Context, params JobDispatchParams) error {
	return queue.Enqueue(ctx, reconcile.EnqueueParams{
		WorkspaceID: params.WorkspaceID,
		Kind:        JobDispatchKind,
		ScopeType:   "release-target",
		ScopeID:     params.ScopeID(),
	})
}
