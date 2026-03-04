package events

import (
	"context"
	"workspace-engine/pkg/reconcile"

	"github.com/charmbracelet/log"
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

func EnqueueManyEnvironmentResourceselectorEval(queue reconcile.Queue, ctx context.Context, params []EnvironmentResourceselectorEvalParams) error {
	if len(params) == 0 {
		return nil
	}
	log.Info("enqueueing environment resourceselector evals", "count", len(params))
	items := make([]reconcile.EnqueueParams, len(params))
	for i, p := range params {
		items[i] = reconcile.EnqueueParams{
			WorkspaceID: p.WorkspaceID,
			Kind:        EnvironmentResourceselectorEvalKind,
			ScopeType:   "environment",
			ScopeID:     p.EnvironmentID,
		}
	}
	return queue.EnqueueMany(ctx, items)
}
