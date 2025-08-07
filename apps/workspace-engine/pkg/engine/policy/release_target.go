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

	EnvironmentSelector selector.SelectorEngine[environment.Environment, ReleaseTarget]
	DeploymentSelector  selector.SelectorEngine[deployment.Deployment, ReleaseTarget]
	ResourceSelector    selector.SelectorEngine[resource.Resource, ReleaseTarget]
}

func (p PolicyTarget) GetID() string {
	return p.ID
}

type ReleaseTargetConditions struct {
	ID           string
	PolicyTarget PolicyTarget
}

func (c ReleaseTargetConditions) Matches(target ReleaseTarget) (bool, error) {
	ctx := context.Background()

	if c.PolicyTarget.EnvironmentMatcher != nil {
		matcher := c.PolicyTarget.EnvironmentMatcher
		matchingEnvironments, err := matcher.GetEntitiesForSelector(ctx, target)
		if err != nil {
			return false, err
		}
		if len(matchingEnvironments) == 0 {
			return false, nil
		}
	}

	if c.PolicyTarget.DeploymentMatcher != nil {
		matcher := c.PolicyTarget.DeploymentMatcher
		matchingDeployments, err := matcher.GetEntitiesForSelector(ctx, target)
		if err != nil {
			return false, err
		}
		if len(matchingDeployments) == 0 {
			return false, nil
		}
	}

	if c.PolicyTarget.ResourceMatcher != nil {
		matcher := c.PolicyTarget.ResourceMatcher
		matchingResources, err := matcher.GetEntitiesForSelector(ctx, target)
		if err != nil {
			return false, err
		}
		if len(matchingResources) == 0 {
			return false, nil
		}
	}

	return true, nil
}
