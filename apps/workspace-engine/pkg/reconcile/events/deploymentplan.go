package events

import (
	"context"

	"workspace-engine/pkg/reconcile"
)

const DeploymentPlanKind = "deployment-plan"

type DeploymentPlanParams struct {
	WorkspaceID string
	PlanID      string
}

func EnqueueDeploymentPlan(
	queue reconcile.Queue,
	ctx context.Context,
	params DeploymentPlanParams,
) error {
	return queue.Enqueue(ctx, reconcile.EnqueueParams{
		WorkspaceID: params.WorkspaceID,
		Kind:        DeploymentPlanKind,
		ScopeType:   "deployment-plan",
		ScopeID:     params.PlanID,
	})
}
