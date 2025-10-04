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
	rm := ws.ReleaseManager()

	rts := rm.ReleaseTargets()
	versionReleases := make([]*pb.ReleaseTargetDeploy, len(rts))

	for _, rt := range rts {
		if rt.ResourceId != deploymentVersion.DeploymentId {
			continue
		}

		isDeployable := ws.DeploymentVersions().IsDeployable(rt, deploymentVersion)
		if !isDeployable {
			log.Info("Newly created deployment version not deployable", "tag", deploymentVersion.Tag, "releaseTarget", rt.Id)
			continue
		}

		vr, err := rm.Evaluate(ctx, rt)
		if err != nil {
			log.Error("Failed to evaluate release target", "error", err, "releaseTarget", rt.Id)
			continue
		}

		versionReleases = append(versionReleases, vr)
	}

	return nil
}
