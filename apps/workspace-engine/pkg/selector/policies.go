package selector

import (
	"context"
	"workspace-engine/pkg/oapi"
)

func NewBasicReleaseTarget(environment *oapi.Environment, deployment *oapi.Deployment, resource *oapi.Resource) *BasicReleaseTarget {
	return &BasicReleaseTarget{
		environment: environment,
		deployment: deployment,
		resource: resource,
	}
}

type BasicReleaseTarget struct {
	environment *oapi.Environment
	deployment *oapi.Deployment
	resource *oapi.Resource
}

func (b *BasicReleaseTarget) Environment() *oapi.Environment {
	return b.environment
}

func (b *BasicReleaseTarget) Deployment() *oapi.Deployment {
	return b.deployment
}

func (b *BasicReleaseTarget) Resource() *oapi.Resource {
	return b.resource
}

func MatchPolicy(ctx context.Context, policy *oapi.Policy, releaseTarget *BasicReleaseTarget) bool {
	for _, policyTarget := range policy.Selectors {
		if policyTarget.EnvironmentSelector != nil {
			if ok, _ := Match(ctx, policyTarget.EnvironmentSelector, releaseTarget.Environment()); !ok {
				continue
			}
		}
		if policyTarget.DeploymentSelector != nil {
			if ok, _ := Match(ctx, policyTarget.DeploymentSelector, releaseTarget.Deployment()); !ok {
				continue
			}
		}
		if policyTarget.ResourceSelector != nil {
			if ok, _ := Match(ctx, policyTarget.ResourceSelector, releaseTarget.Resource()); !ok {
				continue
			}
		}
		return true
	}
	return false
}