package deploymentversion

import (
	"context"
	"encoding/json"
	"errors"
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
	ws.ReleaseManager().TaintDeploymentsReleaseTargets(deploymentVersion.DeploymentId)
	return nil
}

func HandleDeploymentVersionUpdated(
	ctx context.Context,
	ws *workspace.Workspace,
	event handler.RawEvent,
) error {
	deploymentVersion := &pb.DeploymentVersion{}
	if err := json.Unmarshal(event.Data, deploymentVersion); err != nil {
		var payload struct {
			New *pb.DeploymentVersion `json:"new"`
		}
		if err := json.Unmarshal(event.Data, &payload); err != nil {
			return err
		}
		if payload.New == nil {
			return errors.New("missing 'new' deployment version in update event")
		}
		deploymentVersion = payload.New
	}

	ws.DeploymentVersions().Upsert(deploymentVersion.Id, deploymentVersion)
	ws.ReleaseManager().TaintDeploymentsReleaseTargets(deploymentVersion.DeploymentId)

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
	ws.ReleaseManager().TaintDeploymentsReleaseTargets(deploymentVersion.DeploymentId)

	return nil
}
