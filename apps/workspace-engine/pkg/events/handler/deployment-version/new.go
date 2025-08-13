package deploymentversion

import (
	"context"
	"encoding/json"
	"fmt"
	"workspace-engine/pkg/engine/workspace"
	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/model/deployment"

	"github.com/google/uuid"
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

	if deploymentVersion.DeploymentID == "" {
		return fmt.Errorf("deployment version must have a deployment")
	}

	if deploymentVersion.Tag == "" {
		return fmt.Errorf("deployment version must have a tag")
	}

	if deploymentVersion.Name == nil {
		deploymentVersion.Name = &deploymentVersion.Tag
	}

	if deploymentVersion.ID == "" {
		deploymentVersion.ID = uuid.New().String()
	}

	return engine.UpsertDeploymentVersion(ctx, deploymentVersion).
		GetMatchingPolicies().
		EvaluatePolicies().
		CreateHookDispatchRequests().
		CreateDeploymentDispatchRequests().
		Dispatch()
}
