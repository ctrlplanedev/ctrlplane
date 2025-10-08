package deployment

import (
	"context"
	"encoding/json"
	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/pb"
	"workspace-engine/pkg/workspace"
)

func HandleDeploymentCreated(
	ctx context.Context,
	ws *workspace.Workspace,
	event handler.RawEvent,
) error {
	deployment := &pb.Deployment{}
	if err := json.Unmarshal(event.Data, deployment); err != nil {
		return err
	}

	ws.Deployments().Upsert(ctx, deployment)
	ws.ReleaseManager().TaintDeploymentsReleaseTargets(deployment.Id)

	return nil
}

func HandleDeploymentUpdated(
	ctx context.Context,
	ws *workspace.Workspace,
	event handler.RawEvent,
) error {
	var raw map[string]json.RawMessage
	if err := json.Unmarshal(event.Data, &raw); err != nil {
		return err
	}

	deployment := &pb.Deployment{}
	if currentData, exists := raw["current"]; exists {
		// Parse as nested structure with "current" field
		if err := json.Unmarshal(currentData, deployment); err != nil {
			return err
		}
	} else {
		if err := json.Unmarshal(event.Data, deployment); err != nil {
			return err
		}
	}

	ws.Deployments().Upsert(ctx, deployment)
	ws.ReleaseManager().TaintDeploymentsReleaseTargets(deployment.Id)

	return nil
}

func HandleDeploymentDeleted(
	ctx context.Context,
	ws *workspace.Workspace,
	event handler.RawEvent,
) error {
	deployment := &pb.Deployment{}
	if err := json.Unmarshal(event.Data, deployment); err != nil {
		return err
	}

	ws.Deployments().Remove(ctx, deployment.Id)
	ws.ReleaseManager().TaintDeploymentsReleaseTargets(deployment.Id)

	return nil
}
