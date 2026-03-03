package events

import (
	"context"
	"workspace-engine/pkg/reconcile"
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
