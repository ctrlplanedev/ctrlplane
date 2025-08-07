package resource

import (
	"context"
	"workspace-engine/pkg/engine"
	"workspace-engine/pkg/engine/policy"
	"workspace-engine/pkg/engine/selector"
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
	policyTargetSelectors := engine.Selectors.PolicyTargetResources.UpsertEntity(ctx, resource)

	deploymentAdded, deploymentRemoved, _ := selector.CollectMatchChangesByType(deploymentSelectors)
	environmentAdded, environmentRemoved, _ := selector.CollectMatchChangesByType(environmentSelectors)
	policyTargetAdded, policyTargetRemoved, _ := selector.CollectMatchChangesByType(policyTargetSelectors)

	deployments, _ := engine.Selectors.DeploymentResources.GetSelectorsForEntity(ctx, resource)
	environments, _ := engine.Selectors.EnvironmentResources.GetSelectorsForEntity(ctx, resource)

	// Get existing release targets for this resource to track changes
	existingReleaseTargets, _ := engine.Selectors.PolicyTargetResources.GetSelectorsForEntity(ctx, resource)
	
	// Find matching deployment-environment pairs based on system ID
	newReleaseTargets := make([]policy.ReleaseTarget, 0)

	for _, deployment := range deployments {
		for _, environment := range environments {
			if deployment.SystemID == environment.SystemID {
				newReleaseTargets = append(newReleaseTargets, policy.ReleaseTarget{
					Resource:    resource,
					Environment: environment,
					Deployment:  deployment,
				})
			}
		}
	}

	// Create maps for efficient lookup
	existingTargetMap := make(map[string]policy.ReleaseTarget)
	for _, target := range existingReleaseTargets {
		existingTargetMap[target.GetID()] = target
	}

	newTargetMap := make(map[string]policy.ReleaseTarget)
	for _, target := range newReleaseTargets {
		newTargetMap[target.GetID()] = target
	}

	// Determine added and removed release targets
	addedTargets := make([]policy.ReleaseTarget, 0)
	removedTargets := make([]policy.ReleaseTarget, 0)

	// Find added targets (in new but not in existing)
	for id, target := range newTargetMap {
		if _, exists := existingTargetMap[id]; !exists {
			addedTargets = append(addedTargets, target)
		}
	}

	// Find removed targets (in existing but not in new)
	for id, target := range existingTargetMap {
		if _, exists := newTargetMap[id]; !exists {
			removedTargets = append(removedTargets, target)
		}
	}

	// Process added release targets
	for _, target := range addedTargets {
		// Upsert the new release target to the policy target release targets selector
		releaseTargetChannel := engine.Selectors.PolicyTargetReleaseTargets.UpsertEntity(ctx, target)
		
		// Wait for completion and handle any policy matches
		for change := range releaseTargetChannel {
			if change.Done {
				break
			}
			if change.MatchChange != nil {
				// This target now matches a policy - handle the policy activation
				// TODO: Feed to eval engine (release target, policies[])
				// policies, _ := engine.GetSelectorsForEntity(ctx, target)
			}
		}
	}

	// Process removed release targets
	for _, target := range removedTargets {
		// Remove the release target from the policy target release targets selector
		releaseTargetChannel := engine.Selectors.PolicyTargetReleaseTargets.RemoveEntity(ctx, target)
		
		// Wait for completion and handle any policy removals
		for change := range releaseTargetChannel {
			if change.Done {
				break
			}
			if change.MatchChange != nil {
				// This target no longer matches a policy - handle the policy deactivation
				// TODO: Call exit hooks for the policy that was removed
			}
		}
	}

	return nil

}
