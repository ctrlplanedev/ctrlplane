package selector

import (
	"context"
	"workspace-engine/pkg/oapi"
)

func NewResolvedReleaseTarget(environment *oapi.Environment, deployment *oapi.Deployment, resource *oapi.Resource) *ResolvedReleaseTarget {
	return &ResolvedReleaseTarget{
		environment: environment,
		deployment:  deployment,
		resource:    resource,
	}
}

type ResolvedReleaseTarget struct {
	environment *oapi.Environment
	deployment  *oapi.Deployment
	resource    *oapi.Resource
}

func (b *ResolvedReleaseTarget) Environment() *oapi.Environment {
	return b.environment
}

func (b *ResolvedReleaseTarget) Deployment() *oapi.Deployment {
	return b.deployment
}

func (b *ResolvedReleaseTarget) Resource() *oapi.Resource {
	return b.resource
}

func MatchPolicy(ctx context.Context, policy *oapi.Policy, releaseTarget *ResolvedReleaseTarget) bool {
	for _, policyTarget := range policy.Selectors {
		if policyTarget.EnvironmentSelector == nil {
			continue
		}
		if ok, _ := Match(ctx, policyTarget.EnvironmentSelector, releaseTarget.Environment()); !ok {
			continue
		}
		if policyTarget.DeploymentSelector == nil {
			continue
		}
		if ok, _ := Match(ctx, policyTarget.DeploymentSelector, releaseTarget.Deployment()); !ok {
			continue
		}
		if policyTarget.ResourceSelector == nil {
			continue
		}
		if ok, _ := Match(ctx, policyTarget.ResourceSelector, releaseTarget.Resource()); !ok {
			continue
		}
		return true
	}
	return false
}
