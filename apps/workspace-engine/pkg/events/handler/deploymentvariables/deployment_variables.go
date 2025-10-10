package deploymentvariables

import (
	"context"
	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace"

	"encoding/json"
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

	ws.DeploymentVariables().Upsert(deploymentVariable.Id, deploymentVariable)

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

	ws.DeploymentVariables().Upsert(deploymentVariable.Id, deploymentVariable)

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

	ws.DeploymentVariables().Remove(deploymentVariable.Id)

	return nil
}
