package deploymentversion

import (
	"context"
	"encoding/json"

	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/reconcile/events"
	"workspace-engine/pkg/workspace"
	"workspace-engine/pkg/workspace/releasemanager"
	"workspace-engine/pkg/workspace/releasemanager/trace"

	"github.com/charmbracelet/log"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
)

var tracer = otel.Tracer("events/handler/deploymentversion")

func enqueuePolicySummaries(ctx context.Context, ws *workspace.Workspace, version *oapi.DeploymentVersion, releaseTargets []*oapi.ReleaseTarget) {
	seen := make(map[string]struct{})
	var params []events.PolicySummaryParams

	for _, rt := range releaseTargets {
		evKey := rt.EnvironmentId + ":" + version.Id
		if _, ok := seen[evKey]; !ok {
			seen[evKey] = struct{}{}
			params = append(params, events.EnvironmentVersionSummaryParams{
				WorkspaceID:   ws.ID,
				EnvironmentID: rt.EnvironmentId,
				VersionID:     version.Id,
			}.ToParams())
		}
	}

	params = append(params, events.DeploymentVersionSummaryParams{
		WorkspaceID:  ws.ID,
		DeploymentID: version.DeploymentId,
		VersionID:    version.Id,
	}.ToParams())

	if err := events.EnqueueManyPolicySummary(ws.Queue(), ctx, params); err != nil {
		log.Error("failed to enqueue policy summaries for version change", "error", err)
	}
}

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

	for _, rt := range releaseTargets {
		ws.ReleaseManager().DirtyDesiredRelease(rt)
	}
	ws.ReleaseManager().RecomputeState(ctx)

	_ = ws.ReleaseManager().ReconcileTargets(ctx, releaseTargets,
		releasemanager.WithTrigger(trace.TriggerVersionCreated))

	enqueuePolicySummaries(ctx, ws, deploymentVersion, releaseTargets)

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
	for _, rt := range releaseTargets {
		ws.ReleaseManager().DirtyDesiredRelease(rt)
	}
	ws.ReleaseManager().RecomputeState(ctx)

	_ = ws.ReleaseManager().ReconcileTargets(ctx, releaseTargets,
		releasemanager.WithTrigger(trace.TriggerVersionCreated))

	enqueuePolicySummaries(ctx, ws, deploymentVersion, releaseTargets)

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

	for _, rt := range releaseTargets {
		ws.ReleaseManager().DirtyDesiredRelease(rt)
	}
	ws.ReleaseManager().RecomputeState(ctx)

	_ = ws.ReleaseManager().ReconcileTargets(ctx, releaseTargets,
		releasemanager.WithTrigger(trace.TriggerVersionCreated))

	enqueuePolicySummaries(ctx, ws, deploymentVersion, releaseTargets)

	return nil
}
