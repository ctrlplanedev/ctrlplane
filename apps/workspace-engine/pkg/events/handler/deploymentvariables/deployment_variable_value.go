package deploymentvariables

import (
	"context"
	"encoding/json"
	"fmt"
	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace"
	"workspace-engine/pkg/workspace/releasemanager"
	"workspace-engine/pkg/workspace/releasemanager/trace"
)

func getReleaseTargets(ctx context.Context, ws *workspace.Workspace, deploymentVariableValue *oapi.DeploymentVariableValue) ([]*oapi.ReleaseTarget, error) {
	deploymentVariable, ok := ws.DeploymentVariables().Get(deploymentVariableValue.DeploymentVariableId)
	if !ok {
		return nil, fmt.Errorf("deployment variable %s not found", deploymentVariableValue.DeploymentVariableId)
	}

	releaseTargets, err := ws.ReleaseTargets().GetForDeployment(ctx, deploymentVariable.DeploymentId)
	if err != nil {
		return nil, err
	}
	return releaseTargets, nil

}

func HandleDeploymentVariableValueCreated(
	ctx context.Context,
	ws *workspace.Workspace,
	event handler.RawEvent,
) error {
	deploymentVariableValue := &oapi.DeploymentVariableValue{}
	if err := json.Unmarshal(event.Data, deploymentVariableValue); err != nil {
		return err
	}

	ws.DeploymentVariableValues().Upsert(ctx, deploymentVariableValue.Id, deploymentVariableValue)

	releaseTargets, err := getReleaseTargets(ctx, ws, deploymentVariableValue)
	if err != nil {
		return err
	}
	for _, releaseTarget := range releaseTargets {
		_ = ws.ReleaseManager().ReconcileTarget(ctx, releaseTarget,
			releasemanager.WithTrigger(trace.TriggerVariablesUpdated))
	}
	return nil
}

func HandleDeploymentVariableValueUpdated(
	ctx context.Context,
	ws *workspace.Workspace,
	event handler.RawEvent,
) error {
	deploymentVariableValue := &oapi.DeploymentVariableValue{}
	if err := json.Unmarshal(event.Data, deploymentVariableValue); err != nil {
		return err
	}

	ws.DeploymentVariableValues().Upsert(ctx, deploymentVariableValue.Id, deploymentVariableValue)

	releaseTargets, err := getReleaseTargets(ctx, ws, deploymentVariableValue)
	if err != nil {
		return err
	}
	for _, releaseTarget := range releaseTargets {
		_ = ws.ReleaseManager().ReconcileTarget(ctx, releaseTarget,
			releasemanager.WithTrigger(trace.TriggerVariablesUpdated))
	}

	return nil
}

func HandleDeploymentVariableValueDeleted(
	ctx context.Context,
	ws *workspace.Workspace,
	event handler.RawEvent,
) error {
	deploymentVariableValue := &oapi.DeploymentVariableValue{}
	if err := json.Unmarshal(event.Data, deploymentVariableValue); err != nil {
		return err
	}
	ws.DeploymentVariableValues().Remove(ctx, deploymentVariableValue.Id)

	releaseTargets, err := getReleaseTargets(ctx, ws, deploymentVariableValue)
	if err != nil {
		return err
	}
	for _, releaseTarget := range releaseTargets {
		_ = ws.ReleaseManager().ReconcileTarget(ctx, releaseTarget,
			releasemanager.WithTrigger(trace.TriggerVariablesUpdated))
	}
	return nil
}
