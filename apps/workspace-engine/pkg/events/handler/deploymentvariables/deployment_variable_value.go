package deploymentvariables

import (
	"context"
	"encoding/json"
	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace"
)

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
	return nil
}