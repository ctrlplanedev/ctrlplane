package deploymentvariables

import (
	"context"
	"encoding/json"

	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace"
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

	ws.ReleaseManager().ReconcileTargets(ctx, releaseTargets, false, trace.TriggerVariablesUpdated)

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
	for _, releaseTarget := range releaseTargets {
		ws.ReleaseManager().ReconcileTarget(ctx, releaseTarget, false, trace.TriggerVariablesUpdated)
	}

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
	for _, releaseTarget := range releaseTargets {
		ws.ReleaseManager().ReconcileTarget(ctx, releaseTarget, false, trace.TriggerVariablesUpdated)
	}
	return nil
}
