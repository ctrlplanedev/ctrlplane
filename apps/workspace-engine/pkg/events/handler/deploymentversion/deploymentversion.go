package deploymentversion

import (
	"context"
	"encoding/json"
	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/pb"
	"workspace-engine/pkg/workspace"
)

func HandleDeploymentVersionCreated(
	ctx context.Context,
	ws *workspace.Workspace,
	event handler.RawEvent,
) error {
	deploymentVersion := &pb.DeploymentVersion{}
	if err := json.Unmarshal(event.Data, deploymentVersion); err != nil {
		return err
	}

	ws.DeploymentVersions().Upsert(deploymentVersion.Id, deploymentVersion)

	return nil
}

func HandleDeploymentVersionUpdated(
	ctx context.Context,
	ws *workspace.Workspace,
	event handler.RawEvent,
) error {
	deploymentVersion := &pb.DeploymentVersion{}
	if err := json.Unmarshal(event.Data, deploymentVersion); err != nil {
		return err
	}

	ws.DeploymentVersions().Upsert(deploymentVersion.Id, deploymentVersion)

	return nil
}

func HandleDeploymentVersionDeleted(
	ctx context.Context,
	ws *workspace.Workspace,
	event handler.RawEvent,
) error {
	deploymentVersion := &pb.DeploymentVersion{}
	if err := json.Unmarshal(event.Data, deploymentVersion); err != nil {
		return err
	}

	ws.DeploymentVersions().Remove(deploymentVersion.Id)

	return nil
}
