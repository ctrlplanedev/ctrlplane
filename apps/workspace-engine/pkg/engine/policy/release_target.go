package policy

import (
	"context"
	"workspace-engine/pkg/engine/selector"
	"workspace-engine/pkg/model/deployment"
	"workspace-engine/pkg/model/environment"
	"workspace-engine/pkg/model/policy"
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

	EnvironmentSelector selector.SelectorEngine[environment.Environment, policy.PolicyTarget]
	DeploymentSelector  selector.SelectorEngine[deployment.Deployment, policy.PolicyTarget]
	ResourceSelector    selector.SelectorEngine[resource.Resource, policy.PolicyTarget]
}

type ReleaseTargetConditions struct {
	ID           string
	PolicyTarget PolicyTarget
}

func (c ReleaseTargetConditions) Matches(target ReleaseTarget) (bool, error) {
	ctx := context.Background()

	if c.PolicyTarget.EnvironmentSelector != nil {
		matcher := c.PolicyTarget.EnvironmentSelector
		matchingSelectors, err := matcher.GetSelectorsForEntity(ctx, target.Environment)
		if err != nil {
			return false, err
		}
		if len(matchingSelectors) == 0 {
			return false, nil
		}
	}

	if c.PolicyTarget.DeploymentSelector != nil {
		matcher := c.PolicyTarget.DeploymentSelector
		matchingSelectors, err := matcher.GetSelectorsForEntity(ctx, target.Deployment)
		if err != nil {
			return false, err
		}
		if len(matchingSelectors) == 0 {
			return false, nil
		}
	}

	if c.PolicyTarget.ResourceSelector != nil {
		matcher := c.PolicyTarget.ResourceSelector
		matchingSelectors, err := matcher.GetSelectorsForEntity(ctx, target.Resource)
		if err != nil {
			return false, err
		}
		if len(matchingSelectors) == 0 {
			return false, nil
		}
	}

	return true, nil
}
