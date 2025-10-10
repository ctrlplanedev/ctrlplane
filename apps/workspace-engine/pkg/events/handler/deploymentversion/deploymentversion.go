package deploymentversion

import (
	"context"
	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace"

	"encoding/json"
)

func HandleDeploymentVersionCreated(
	ctx context.Context,
	ws *workspace.Workspace,
	event handler.RawEvent,
) error {
	deploymentVersion := &oapi.DeploymentVersion{}
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
	deploymentVersion := &oapi.DeploymentVersion{}
	if err := json.Unmarshal(event.Data, deploymentVersion); err != nil {
		return err
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
	deploymentVersion := &oapi.DeploymentVersion{}
	if err := json.Unmarshal(event.Data, deploymentVersion); err != nil {
		return err
	}

	ws.DeploymentVersions().Remove(deploymentVersion.Id)
	ws.ReleaseManager().TaintDeploymentsReleaseTargets(deploymentVersion.DeploymentId)

	return nil
}
