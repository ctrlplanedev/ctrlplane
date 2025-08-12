package deploymentversion

import (
	"context"
	"encoding/json"
	"workspace-engine/pkg/engine/workspace"
	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/model/deployment"
)

type NewDeploymentVersionHandler struct {
	handler.Handler
}

func NewNewDeploymentVersionHandler() *NewDeploymentVersionHandler {
	return &NewDeploymentVersionHandler{}
}

func (h *NewDeploymentVersionHandler) Handle(ctx context.Context, engine *workspace.WorkspaceEngine, event handler.RawEvent) error {
	deploymentVersion := deployment.DeploymentVersion{}
	if err := json.Unmarshal(event.Data, &deploymentVersion); err != nil {
		return err
	}

	return engine.CreateDeploymentVersion(ctx, deploymentVersion).
		UpdateDeploymentVersions().
		GetMatchingPolicies().
		EvaulatePolicies().
		CreateHookDispatchRequests().
		CreateDeploymentDispatchRequests().
		Dispatch()
}
