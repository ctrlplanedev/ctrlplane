package deployment

import (
	"context"
	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/pb"
	"workspace-engine/pkg/workspace"

	"google.golang.org/protobuf/encoding/protojson"
)

func HandleDeploymentCreated(
	ctx context.Context,
	ws *workspace.Workspace,
	event handler.RawEvent,
) error {
	deployment := &pb.Deployment{}
	if err := protojson.Unmarshal(event.Data, deployment); err != nil {
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
	deployment := &pb.Deployment{}
	if err := protojson.Unmarshal(event.Data, deployment); err != nil {
		return err
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
	if err := protojson.Unmarshal(event.Data, deployment); err != nil {
		return err
	}

	ws.Deployments().Remove(ctx, deployment.Id)
	ws.ReleaseManager().TaintDeploymentsReleaseTargets(deployment.Id)

	return nil
}
