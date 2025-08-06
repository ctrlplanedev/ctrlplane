package resource

import (
	"context"
	"workspace-engine/pkg/engine"
	"workspace-engine/pkg/engine/policy"
	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/model/resource"
)

type NewResourceHandler struct {
	handler.Handler
}

func NewNewResourceHandler() *NewResourceHandler {
	return &NewResourceHandler{}
}

func (h *NewResourceHandler) Handle(ctx context.Context, engine *engine.WorkspaceEngine, event handler.RawEvent) error {
	resource := resource.Resource{}

	deploymentSelectors := engine.Selectors.DeploymentResources.UpsertEntity(ctx, resource)
	environmentSelectors := engine.Selectors.EnvironmentResources.UpsertEntity(ctx, resource)

	deploymentDone := false
	environmentDone := false

	for !deploymentDone || !environmentDone {
		select {
		case selector := <-deploymentSelectors:
			if selector.Done {
				deploymentDone = true
				continue
			}
		case selector := <-environmentSelectors:
			if selector.Done {
				environmentDone = true
				continue
			}
		}
	}

	deployments, _ := engine.Selectors.DeploymentResources.GetSelectorsForEntity(ctx, resource)
	environments, _ := engine.Selectors.EnvironmentResources.GetSelectorsForEntity(ctx, resource)

	// Find matching deployment-environment pairs based on system ID
	var matches []policy.ReleaseTarget

	for _, deployment := range deployments {
		for _, environment := range environments {
			if deployment.SystemID == environment.SystemID {
				matches = append(matches, policy.ReleaseTarget{
					Resource:    resource,
					Environment: environment,
					Deployment:  deployment,
				})
			}
		}
	}

	return nil
}
