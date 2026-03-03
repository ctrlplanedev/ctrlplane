package events

import (
	"context"
	"workspace-engine/pkg/reconcile"
)

const EnvironmentResourceselectorEvalKind = "environment-resource-selector-eval"

type EnvironmentResourceselectorEvalParams struct {
	WorkspaceID   string
	EnvironmentID string
}

func EnqueueEnvironmentResourceselectorEval(queue reconcile.Queue, ctx context.Context, params EnvironmentResourceselectorEvalParams) error {
	return queue.Enqueue(ctx, reconcile.EnqueueParams{
		WorkspaceID: params.WorkspaceID,
		Kind:        EnvironmentResourceselectorEvalKind,
		ScopeType:   "environment",
		ScopeID:     params.EnvironmentID,
	})
}
