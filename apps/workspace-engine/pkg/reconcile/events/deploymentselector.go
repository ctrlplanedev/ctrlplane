package events

import (
	"context"
	"workspace-engine/pkg/reconcile"

	"github.com/charmbracelet/log"
)

const DeploymentResourceselectorEvalKind = "deployment-resource-selector-eval"

type DeploymentResourceselectorEvalParams struct {
	WorkspaceID  string
	DeploymentID string
}

func EnqueueDeploymentResourceselectorEval(queue reconcile.Queue, ctx context.Context, params DeploymentResourceselectorEvalParams) error {
	return queue.Enqueue(ctx, reconcile.EnqueueParams{
		WorkspaceID: params.WorkspaceID,
		Kind:        DeploymentResourceselectorEvalKind,
		ScopeType:   "deployment",
		ScopeID:     params.DeploymentID,
	})
}

func EnqueueManyDeploymentResourceselectorEval(queue reconcile.Queue, ctx context.Context, params []DeploymentResourceselectorEvalParams) error {
	if len(params) == 0 {
		return nil
	}
	log.Info("enqueueing deployment resourceselector evals", "count", len(params))
	items := make([]reconcile.EnqueueParams, len(params))
	for i, p := range params {
		items[i] = reconcile.EnqueueParams{
			WorkspaceID: p.WorkspaceID,
			Kind:        DeploymentResourceselectorEvalKind,
			ScopeType:   "deployment",
			ScopeID:     p.DeploymentID,
		}
	}
	return queue.EnqueueMany(ctx, items)
}
