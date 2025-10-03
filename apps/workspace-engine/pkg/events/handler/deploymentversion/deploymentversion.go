package deploymentversion

import (
	"context"
	"encoding/json"
	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/pb"
	"workspace-engine/pkg/workspace"

	"github.com/charmbracelet/log"
)

func HandleDeploymentVersionCreated(
	ctx context.Context,
	workspace *workspace.Workspace, 
	event handler.RawEvent,
) error {
	deploymentVersion := &pb.DeploymentVersion{}
	if err := json.Unmarshal(event.Data, deploymentVersion); err != nil {
		return err
	}

	log.Info("Deployment version created", "deploymentId", deploymentVersion.DeploymentId, "tag", deploymentVersion.Tag)


	workspace.DeploymentVersions().Upsert(deploymentVersion.Id, deploymentVersion)
	return nil
}