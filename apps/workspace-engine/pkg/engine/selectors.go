package engine

import (
	"context"
	"workspace-engine/pkg/engine/selector"
	"workspace-engine/pkg/model/deployment"
	"workspace-engine/pkg/model/environment"
	"workspace-engine/pkg/model/policy"
	"workspace-engine/pkg/model/resource"
)

type ResourceRepository struct {
	Resources            map[string]resource.Resource
	DeploymentResources  selector.SelectorEngine[resource.Resource, deployment.Deployment]
	EnvironmentResources selector.SelectorEngine[resource.Resource, environment.Environment]
}

type ResourceChange struct {
	Deployment  <-chan selector.ChannelResult[resource.Resource, deployment.Deployment]
	Environment <-chan selector.ChannelResult[resource.Resource, environment.Environment]
}

func (r *ResourceRepository) Upsert(ctx context.Context, res ...resource.Resource) (ResourceChange, error) {
	for _, res := range res {
		r.Resources[res.GetID()] = res
	}
	return ResourceChange{
		Deployment:  r.DeploymentResources.UpsertEntity(ctx, res...),
		Environment: r.EnvironmentResources.UpsertEntity(ctx, res...),
	}, nil
}

func (r *ResourceRepository) Remove(ctx context.Context, res ...resource.Resource) (ResourceChange, error) {
	for _, res := range res {
		delete(r.Resources, res.GetID())
	}
	return ResourceChange{
		Deployment:  r.DeploymentResources.RemoveEntity(ctx, res...),
		Environment: r.EnvironmentResources.RemoveEntity(ctx, res...),
	}, nil
}

type ReleaseTargetSelectors struct {
	EnvironmentResources selector.SelectorEngine[resource.Resource, environment.Environment]
	DeploymentResources  selector.SelectorEngine[resource.Resource, deployment.Deployment]
}

type PolicyTargetSelectors struct {
	Resources    selector.SelectorEngine[resource.Resource, policy.PolicyTarget]
	Environments selector.SelectorEngine[environment.Environment, policy.PolicyTarget]
	Deployments  selector.SelectorEngine[deployment.Deployment, policy.PolicyTarget]
}
