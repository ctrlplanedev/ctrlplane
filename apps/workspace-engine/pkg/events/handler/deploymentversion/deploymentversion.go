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
	ws *workspace.Workspace,
	event handler.RawEvent,
) error {
	deploymentVersion := &pb.DeploymentVersion{}
	if err := json.Unmarshal(event.Data, deploymentVersion); err != nil {
		return err
	}

	log.Info("Deployment version created", "deploymentId", deploymentVersion.DeploymentId, "tag", deploymentVersion.Tag)

	ws.DeploymentVersions().Upsert(deploymentVersion.Id, deploymentVersion)
	changes := ws.ReleaseManager().Sync(ctx)
	jobs := ws.ReleaseManager().EvaulateChange(ctx, changes)
	
	log.Info("Dispatching", "jobs", len(jobs.Items()))

	return nil
}
