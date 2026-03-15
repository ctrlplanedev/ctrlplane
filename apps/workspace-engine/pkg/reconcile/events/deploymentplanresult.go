package events

import (
	"context"

	"workspace-engine/pkg/reconcile"
)

const DeploymentPlanTargetResultKind = "deployment-plan-target-result"

type DeploymentPlanTargetResultParams struct {
	WorkspaceID string
	ResultID    string
}

func EnqueueDeploymentPlanTargetResult(
	queue reconcile.Queue,
	ctx context.Context,
	params DeploymentPlanTargetResultParams,
) error {
	return queue.Enqueue(ctx, reconcile.EnqueueParams{
		WorkspaceID: params.WorkspaceID,
		Kind:        DeploymentPlanTargetResultKind,
		ScopeType:   "deployment-plan-target-result",
		ScopeID:     params.ResultID,
	})
}
