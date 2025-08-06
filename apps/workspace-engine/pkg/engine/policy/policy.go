package policy

import (
	"context"
	"workspace-engine/pkg/engine/selector"
	"workspace-engine/pkg/model/deployment"
	"workspace-engine/pkg/model/environment"
	"workspace-engine/pkg/model/resource"
)

type ReleaseTarget struct {
	Resource    resource.Resource
	Environment environment.Environment
	Deployment  deployment.Deployment
}

func (r ReleaseTarget) GetID() string {
	return r.Resource.ID + r.Deployment.ID + r.Environment.ID
}

type PolicyTarget struct {
	ID string

	ResourceSelector    selector.Condition[resource.Resource]       `json:"resourceSelector"`
	EnvironmentSelector selector.Condition[environment.Environment] `json:"environmentSelector"`
	DeploymentSelector  selector.Condition[deployment.Deployment]   `json:"deploymentSelector"`

	EnvironmentMatcher selector.SelectorEngine[environment.Environment, selector.BaseSelector]
	DeploymentMatcher  selector.SelectorEngine[deployment.Deployment, selector.BaseSelector]
	ResourceMatcher    selector.SelectorEngine[resource.Resource, selector.BaseSelector]
}

func (p PolicyTarget) GetID() string {
	return p.ID
}

func (p PolicyTarget) GetEnvironmentSelector() selector.BaseSelector {
	return selector.BaseSelector{ID: p.ID, Conditions: p.EnvironmentSelector}
}

func (p PolicyTarget) GetDeploymentSelector() selector.BaseSelector {
	return selector.BaseSelector{ID: p.ID, Conditions: p.DeploymentSelector}
}

func (p PolicyTarget) GetResourceSelector() selector.BaseSelector {
	return selector.BaseSelector{ID: p.ID, Conditions: p.ResourceSelector}
}

func (p PolicyTarget) GetConditions() selector.Condition[ReleaseTarget] {
	return ReleaseTargetConditions{
		ID:           p.ID,
		PolicyTarget: p,
	}
}

type ReleaseTargetConditions struct {
	ID           string
	PolicyTarget PolicyTarget
}

func (c ReleaseTargetConditions) Matches(target ReleaseTarget) (bool, error) {
	ctx := context.Background()

	if c.PolicyTarget.EnvironmentMatcher != nil {
		environmentSelector := c.PolicyTarget.GetEnvironmentSelector()
		matchingEnvironments, err := c.PolicyTarget.EnvironmentMatcher.GetEntitiesForSelector(ctx, environmentSelector)
		if err != nil {
			return false, err
		}
		if len(matchingEnvironments) == 0 {
			return false, nil
		}
	}

	if c.PolicyTarget.DeploymentMatcher != nil {
		deploymentSelector := c.PolicyTarget.GetDeploymentSelector()
		matchingDeployments, err := c.PolicyTarget.DeploymentMatcher.GetEntitiesForSelector(ctx, deploymentSelector)
		if err != nil {
			return false, err
		}
		if len(matchingDeployments) == 0 {
			return false, nil
		}
	}

	if c.PolicyTarget.ResourceMatcher != nil {
		resourceSelector := c.PolicyTarget.GetResourceSelector()
		matchingResources, err := c.PolicyTarget.ResourceMatcher.GetEntitiesForSelector(ctx, resourceSelector)
		if err != nil {
			return false, err
		}
		if len(matchingResources) == 0 {
			return false, nil
		}
	}

	return true, nil
}
