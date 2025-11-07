package deploymentversion

import (
	"context"
	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace"

	"encoding/json"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
)

var tracer = otel.Tracer("events/handler/deploymentversion")

func HandleDeploymentVersionCreated(
	ctx context.Context,
	ws *workspace.Workspace,
	event handler.RawEvent,
) error {
	ctx, span := tracer.Start(ctx, "HandleDeploymentVersionCreated")
	defer span.End()
	span.SetAttributes(
		attribute.String("event.type", string(event.EventType)),
	)

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
		if releaseTarget.DeploymentId == deploymentVersion.DeploymentId {
			ws.ReleaseManager().ReconcileTarget(ctx, releaseTarget, false)
		}
	}

	return nil
}

func HandleDeploymentVersionUpdated(
	ctx context.Context,
	ws *workspace.Workspace,
	event handler.RawEvent,
) error {
	ctx, span := tracer.Start(ctx, "HandleDeploymentVersionUpdated")
	defer span.End()
	span.SetAttributes(
		attribute.String("event.type", string(event.EventType)),
	)

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
		if releaseTarget.DeploymentId == deploymentVersion.DeploymentId {
			ws.ReleaseManager().ReconcileTarget(ctx, releaseTarget, false)
		}
	}

	return nil
}

func HandleDeploymentVersionDeleted(
	ctx context.Context,
	ws *workspace.Workspace,
	event handler.RawEvent,
) error {
	ctx, span := tracer.Start(ctx, "HandleDeploymentVersionDeleted")
	defer span.End()
	span.SetAttributes(
		attribute.String("event.type", string(event.EventType)),
	)

	deploymentVersion := &oapi.DeploymentVersion{}
	if err := json.Unmarshal(event.Data, deploymentVersion); err != nil {
		return err
	}

	ws.DeploymentVersions().Remove(ctx, deploymentVersion.Id)

	releaseTargets, err := ws.ReleaseTargets().GetForDeployment(ctx, deploymentVersion.DeploymentId)
	if err != nil {
		return err
	}

	reconileReleaseTargets := make([]*oapi.ReleaseTarget, 0)
	for _, releaseTarget := range releaseTargets {
		if releaseTarget.DeploymentId == deploymentVersion.DeploymentId {
			reconileReleaseTargets = append(reconileReleaseTargets, releaseTarget)
		}
	}

	ws.ReleaseManager().ReconcileTargets(ctx, reconileReleaseTargets, false)

	return nil
}
