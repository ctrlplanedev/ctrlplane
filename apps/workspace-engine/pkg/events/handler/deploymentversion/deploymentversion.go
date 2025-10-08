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
	ws.ReleaseManager().TaintDeploymentsReleaseTargets(deploymentVersion.DeploymentId)
	return nil
}

func HandleDeploymentVersionUpdated(
	ctx context.Context,
	ws *workspace.Workspace,
	event handler.RawEvent,
) error {
	var raw map[string]json.RawMessage
	if err := json.Unmarshal(event.Data, &raw); err != nil {
		return err
	}

	deploymentVersion := &pb.DeploymentVersion{}
	if currentData, exists := raw["current"]; exists {
		// Parse as nested structure with "current" field
		if err := json.Unmarshal(currentData, deploymentVersion); err != nil {
			return err
		}
	} else {
		if err := json.Unmarshal(event.Data, deploymentVersion); err != nil {
			return err
		}
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
