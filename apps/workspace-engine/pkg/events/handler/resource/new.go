package resource

import (
	"context"
	"fmt"
	"sort"
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

func (h *NewResourceHandler) getPoliciesForReleaseTarget(ctx context.Context, engine *engine.WorkspaceEngine, releaseTarget policy.ReleaseTarget) ([]policy.Policy, error) {
	policies := make([]policy.Policy, 0)
	policyTargets, err := engine.Selectors.PolicyTargetReleaseTargets.GetSelectorsForEntity(ctx, releaseTarget)
	if err != nil {
		return nil, err
	}

	for _, policyTarget := range policyTargets {
		policy, ok := engine.Policies[policyTarget.ID]
		if !ok {
			continue
		}
		policies = append(policies, policy)
	}

	sort.Slice(policies, func(i, j int) bool {
		return policies[i].Priority < policies[j].Priority
	})

	return policies, nil
}

func (h *NewResourceHandler) Handle(ctx context.Context, engine *engine.WorkspaceEngine, event handler.RawEvent) error {
	resource := resource.Resource{}

	deploymentSelectors := engine.Selectors.DeploymentResources.UpsertEntity(ctx, resource)
	environmentSelectors := engine.Selectors.EnvironmentResources.UpsertEntity(ctx, resource)
	policyTargetSelectors := engine.Selectors.PolicyTargetResources.UpsertEntity(ctx, resource)

	deploymentDone := false
	environmentDone := false
	policyTargetDone := false

	for !deploymentDone || !environmentDone || !policyTargetDone {
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
		case selector := <-policyTargetSelectors:
			if selector.Done {
				policyTargetDone = true
				continue
			}
		}
	}

	deployments, err := engine.Selectors.DeploymentResources.GetSelectorsForEntity(ctx, resource)
	if err != nil {
		return err
	}
	environments, err := engine.Selectors.EnvironmentResources.GetSelectorsForEntity(ctx, resource)
	if err != nil {
		return err
	}

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

	policyTargetsReleaseTargetsChan := engine.Selectors.PolicyTargetReleaseTargets.UpsertEntity(ctx, matches...)

	policyTargetsReleaseTargetsDone := false

	for !policyTargetsReleaseTargetsDone {
		select {
		case selector := <-policyTargetsReleaseTargetsChan:
			if selector.Done {
				policyTargetsReleaseTargetsDone = true
				continue
			}
		}
	}

	for _, match := range matches {
		policies, err := h.getPoliciesForReleaseTarget(ctx, engine, match)
		if err != nil {
			return err
		}

		fmt.Printf("found %d policies for release target %s\n", len(policies), match.GetID())
	}

	// upsert the new release targets to the policy target release targets selector
	// delete old release targets from the policy target release targets selector

	// for each new release target
	//   just grab any policy that matches
	//     feed it to eval engine (release target, policies[])  engine.GetSelectorsForEntity(ctx, releaseTarget)

	// for each removed release target
	//   call exit hooks

	return nil
}
