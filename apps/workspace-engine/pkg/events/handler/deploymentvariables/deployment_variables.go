package deploymentvariables

import (
	"context"
	"encoding/json"

	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace"
	"workspace-engine/pkg/workspace/releasemanager"
	"workspace-engine/pkg/workspace/releasemanager/trace"
)

func HandleDeploymentVariableCreated(
	ctx context.Context,
	ws *workspace.Workspace,
	event handler.RawEvent,
) error {
	deploymentVariable := &oapi.DeploymentVariable{}
	if err := json.Unmarshal(event.Data, deploymentVariable); err != nil {
		return err
	}

	ws.DeploymentVariables().Upsert(ctx, deploymentVariable.Id, deploymentVariable)

	releaseTargets, err := ws.ReleaseTargets().GetForDeployment(ctx, deploymentVariable.DeploymentId)
	if err != nil {
		return err
	}

	for _, rt := range releaseTargets {
		ws.ReleaseManager().DirtyDesiredRelease(rt)
	}
	ws.ReleaseManager().RecomputeState(ctx)

	_ = ws.ReleaseManager().ReconcileTargets(ctx, releaseTargets,
		releasemanager.WithTrigger(trace.TriggerVariablesUpdated))

	return nil
}

func HandleDeploymentVariableUpdated(
	ctx context.Context,
	ws *workspace.Workspace,
	event handler.RawEvent,
) error {
	deploymentVariable := &oapi.DeploymentVariable{}
	if err := json.Unmarshal(event.Data, deploymentVariable); err != nil {
		return err
	}

	ws.DeploymentVariables().Upsert(ctx, deploymentVariable.Id, deploymentVariable)

	releaseTargets, err := ws.ReleaseTargets().GetForDeployment(ctx, deploymentVariable.DeploymentId)
	if err != nil {
		return err
	}

	for _, rt := range releaseTargets {
		ws.ReleaseManager().DirtyDesiredRelease(rt)
	}
	ws.ReleaseManager().RecomputeState(ctx)

	_ = ws.ReleaseManager().ReconcileTargets(ctx, releaseTargets,
		releasemanager.WithTrigger(trace.TriggerVariablesUpdated))

	return nil
}

func HandleDeploymentVariableDeleted(
	ctx context.Context,
	ws *workspace.Workspace,
	event handler.RawEvent,
) error {
	deploymentVariable := &oapi.DeploymentVariable{}
	if err := json.Unmarshal(event.Data, deploymentVariable); err != nil {
		return err
	}

	ws.DeploymentVariables().Remove(ctx, deploymentVariable.Id)

	releaseTargets, err := ws.ReleaseTargets().GetForDeployment(ctx, deploymentVariable.DeploymentId)
	if err != nil {
		return err
	}

	for _, rt := range releaseTargets {
		ws.ReleaseManager().DirtyDesiredRelease(rt)
	}
	ws.ReleaseManager().RecomputeState(ctx)

	_ = ws.ReleaseManager().ReconcileTargets(ctx, releaseTargets,
		releasemanager.WithTrigger(trace.TriggerVariablesUpdated))
	return nil
}
