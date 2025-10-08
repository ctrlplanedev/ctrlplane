package deployment

import (
	"context"
	"encoding/json"
	"errors"
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
	deployment := &pb.Deployment{}
	if err := json.Unmarshal(event.Data, deployment); err != nil {
		var payload struct {
			New *pb.Deployment `json:"new"`
		}
		if err := json.Unmarshal(event.Data, &payload); err != nil {
			return err
		}
		if payload.New == nil {
			return errors.New("missing 'new' deployment in update event")
		}
		deployment = payload.New
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
