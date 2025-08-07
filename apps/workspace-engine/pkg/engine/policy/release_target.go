package policy

import (
	"context"
	"fmt"
	"workspace-engine/pkg/engine/selector"
	"workspace-engine/pkg/model/deployment"
	"workspace-engine/pkg/model/environment"
	"workspace-engine/pkg/model/policy"
	"workspace-engine/pkg/model/resource"
)

type PolicyTargetSelectors struct {
	EnvironmentSelector selector.SelectorEngine[environment.Environment, policy.PolicyTarget]
	DeploymentSelector  selector.SelectorEngine[deployment.Deployment, policy.PolicyTarget]
	ResourceSelector    selector.SelectorEngine[resource.Resource, policy.PolicyTarget]
}

type ReleaseTarget struct {
	Resource    resource.Resource
	Environment environment.Environment
	Deployment  deployment.Deployment
}

func (r ReleaseTarget) GetID() string {
	return r.Resource.ID + r.Deployment.ID + r.Environment.ID
}

// GetPolicyTargets returns all PolicyTargets that match this ReleaseTarget
func (r ReleaseTarget) GetPolicyTargets(ctx context.Context, policyTargetSelectors PolicyTargetSelectors, policyTargets []policy.PolicyTarget) ([]policy.PolicyTarget, error) {
	var matchingPolicyTargets []policy.PolicyTarget

	for _, policyTarget := range policyTargets {
		matches, err := r.matchesPolicyTarget(ctx, policyTargetSelectors, policyTarget)
		if err != nil {
			fmt.Println("error matching policy target:", err)
			continue
		}

		if matches {
			matchingPolicyTargets = append(matchingPolicyTargets, policyTarget)
		}
	}

	return matchingPolicyTargets, nil
}

// matchesPolicyTarget checks if this ReleaseTarget matches the given PolicyTarget
func (r ReleaseTarget) matchesPolicyTarget(ctx context.Context, selectors PolicyTargetSelectors, policyTarget policy.PolicyTarget) (bool, error) {
	resourceMatches, err := r.matchesResourceSelector(ctx, selectors.ResourceSelector, policyTarget)
	if err != nil {
		return false, err
	}

	envMatches, err := r.matchesEnvironmentSelector(ctx, selectors.EnvironmentSelector, policyTarget)
	if err != nil {
		return false, err
	}

	deploymentMatches, err := r.matchesDeploymentSelector(ctx, selectors.DeploymentSelector, policyTarget)
	if err != nil {
		return false, err
	}

	return resourceMatches && envMatches && deploymentMatches, nil
}

// matchesResourceSelector checks if this ReleaseTarget's resource matches the selector
func (r ReleaseTarget) matchesResourceSelector(ctx context.Context, resourceSelector selector.SelectorEngine[resource.Resource, policy.PolicyTarget], policyTarget policy.PolicyTarget) (bool, error) {
	if resourceSelector == nil {
		return true, nil
	}

	resources, err := resourceSelector.GetEntitiesForSelector(ctx, policyTarget)
	if err != nil {
		return false, err
	}

	for _, resource := range resources {
		if resource.GetID() == r.Resource.GetID() {
			return true, nil
		}
	}

	return false, nil
}

// matchesEnvironmentSelector checks if this ReleaseTarget's environment matches the selector
func (r ReleaseTarget) matchesEnvironmentSelector(ctx context.Context, envSelector selector.SelectorEngine[environment.Environment, policy.PolicyTarget], policyTarget policy.PolicyTarget) (bool, error) {
	if envSelector == nil {
		return true, nil
	}

	environments, err := envSelector.GetEntitiesForSelector(ctx, policyTarget)
	if err != nil {
		return false, err
	}

	for _, environment := range environments {
		if environment.GetID() == r.Environment.GetID() {
			return true, nil
		}
	}

	return false, nil
}

// matchesDeploymentSelector checks if this ReleaseTarget's deployment matches the selector
func (r ReleaseTarget) matchesDeploymentSelector(ctx context.Context, deploymentSelector selector.SelectorEngine[deployment.Deployment, policy.PolicyTarget], policyTarget policy.PolicyTarget) (bool, error) {
	if deploymentSelector == nil {
		return true, nil
	}

	deployments, err := deploymentSelector.GetEntitiesForSelector(ctx, policyTarget)
	if err != nil {
		return false, err
	}

	for _, deployment := range deployments {
		if deployment.GetID() == r.Deployment.GetID() {
			return true, nil
		}
	}

	return false, nil
}
