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

	ws.DeploymentVersions().Upsert(ctx, deploymentVersion.Id, deploymentVersion)

	releaseTargets, err := ws.ReleaseTargets().GetForDeployment(ctx, deploymentVersion.DeploymentId)
	if err != nil {
		return err
	}

	for _, releaseTarget := range releaseTargets {
		ws.ReleaseManager().ReconcileTarget(ctx, releaseTarget, false)
	}

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

	ws.DeploymentVersions().Upsert(ctx, deploymentVersion.Id, deploymentVersion)

	releaseTargets, err := ws.ReleaseTargets().GetForDeployment(ctx, deploymentVersion.DeploymentId)
	if err != nil {
		return err
	}
	for _, releaseTarget := range releaseTargets {
		ws.ReleaseManager().ReconcileTarget(ctx, releaseTarget, false)
	}

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

	ws.DeploymentVersions().Remove(ctx, deploymentVersion.Id)

	releaseTargets, err := ws.ReleaseTargets().GetForDeployment(ctx, deploymentVersion.DeploymentId)
	if err != nil {
		return err
	}
	for _, releaseTarget := range releaseTargets {
		ws.ReleaseManager().ReconcileTarget(ctx, releaseTarget, false)
	}

	return nil
}
