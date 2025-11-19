package deploymentversion

import (
	"context"
	"encoding/json"

	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace"
	"workspace-engine/pkg/workspace/releasemanager"
	"workspace-engine/pkg/workspace/releasemanager/trace"

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

	ws.ReleaseManager().ReconcileTargets(ctx, releaseTargets,
		releasemanager.WithTrigger(trace.TriggerVersionCreated),
		releasemanager.WithEarliestVersionForEvaluation(deploymentVersion))

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
	ws.ReleaseManager().ReconcileTargets(ctx, releaseTargets,
		releasemanager.WithTrigger(trace.TriggerVersionCreated),
		releasemanager.WithEarliestVersionForEvaluation(deploymentVersion))

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

	ws.ReleaseManager().ReconcileTargets(ctx, releaseTargets,
		releasemanager.WithTrigger(trace.TriggerVersionCreated))

	return nil
}
