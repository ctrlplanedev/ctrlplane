package deploymentversion

import (
	"context"
	"encoding/json"
	"fmt"
	"workspace-engine/pkg/engine/workspace"
	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/model/deployment"
)

type DeleteDeploymentVersionHandler struct {
	handler.Handler
}

func NewDeleteDeploymentVersionHandler() *DeleteDeploymentVersionHandler {
	return &DeleteDeploymentVersionHandler{}
}

func (h *DeleteDeploymentVersionHandler) Handle(ctx context.Context, engine *workspace.WorkspaceEngine, event handler.RawEvent) error {
	deploymentVersion := deployment.DeploymentVersion{}

	if err := json.Unmarshal(event.Data, &deploymentVersion); err != nil {
		return err
	}

	if deploymentVersion.ID == "" {
		return fmt.Errorf("deployment version must have an id")
	}

	return engine.RemoveDeploymentVersion(ctx, deploymentVersion).Dispatch()
}
