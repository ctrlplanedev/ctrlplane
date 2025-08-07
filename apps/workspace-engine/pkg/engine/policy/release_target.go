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

// GetPolicyTargets returns all PolicyTargets that match this ReleaseTarget
func (r ReleaseTarget) GetPolicyTargets(ctx context.Context, policyTargetSelector selector.SelectorEngine[ReleaseTarget, policy.PolicyTarget]) ([]policy.PolicyTarget, error) {
	return policyTargetSelector.GetSelectorsForEntity(ctx, r)
}

type PolicyTarget struct {
	ID string

	EnvironmentSelector selector.SelectorEngine[environment.Environment, policy.PolicyTarget]
	DeploymentSelector  selector.SelectorEngine[deployment.Deployment, policy.PolicyTarget]
	ResourceSelector    selector.SelectorEngine[resource.Resource, policy.PolicyTarget]
}
