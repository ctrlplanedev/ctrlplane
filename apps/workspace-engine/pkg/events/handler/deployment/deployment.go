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

	return nil
}

func HandleDeploymentUpdated(
	ctx context.Context,
	ws *workspace.Workspace,
	event handler.RawEvent,
) error {
	deployment := &pb.Deployment{}
	if err := json.Unmarshal(event.Data, deployment); err != nil {
		return err
	}

	ws.Deployments().Upsert(ctx, deployment)

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

	ws.Deployments().Remove(ctx,deployment.Id)

	return nil
}
