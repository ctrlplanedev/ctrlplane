package resource

import (
	"context"
	"workspace-engine/pkg/engine"
	"workspace-engine/pkg/engine/policy"
	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/model/resource"

	"github.com/charmbracelet/log"
)

type NewResourceHandler struct {
	handler.Handler
}

func NewNewResourceHandler() *NewResourceHandler {
	return &NewResourceHandler{}
}

func (h *NewResourceHandler) Handle(ctx context.Context, engine *engine.WorkspaceEngine, event handler.RawEvent) error {
	resource := resource.Resource{}

	selectors := engine.Selectors

	deploymentCh := selectors.DeploymentResources.UpsertEntity(ctx, resource)
	environmentCh := selectors.EnvironmentResources.UpsertEntity(ctx, resource)
	policyTargetCh := selectors.PolicyTargetResources.UpsertEntity(ctx, resource)
	for range deploymentCh {}
	for range environmentCh {}
	for range policyTargetCh {}

	deployments, _ := engine.Selectors.DeploymentResources.GetSelectorsForEntity(ctx, resource)
	environments, _ := engine.Selectors.EnvironmentResources.GetSelectorsForEntity(ctx, resource)

	releaseTargets := make([]*policy.ReleaseTarget, 0)
	for _, deployment := range deployments {
		for _, environment := range environments {
			if deployment.SystemID == environment.SystemID {
				releaseTargets = append(releaseTargets, &policy.ReleaseTarget{
					Resource:    resource,
					Environment: environment,
					Deployment:  deployment,
				})
			}
		}
	}

	deploymentIDs := make([]string, 0)
	environmentIDs := make([]string, 0)
	for _, deployment := range deployments {
		deploymentIDs = append(deploymentIDs, deployment.GetID())
	}
	for _, environment := range environments {
		environmentIDs = append(environmentIDs, environment.GetID())
	}

	changes, err := engine.Repository.
		ReleaseTarget.
		SetReleaseTargetsForDeploymentsAndEnvironments(
			ctx,
			deploymentIDs,
			environmentIDs,
			releaseTargets,
		)
	if err != nil {
		return err
	}
	if changes.HasChanges() {
		log.Info(
			"Release targets changed",
			"added", changes.Added,
			"removed", changes.Removed,
			"already existed", changes.AlreadyExisted,
		)
	}

	return nil
}
