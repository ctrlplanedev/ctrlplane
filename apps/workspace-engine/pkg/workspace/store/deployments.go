package store

import (
	"context"
	"fmt"
	"workspace-engine/pkg/cmap"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/selector"
	"workspace-engine/pkg/workspace/store/materialized"
	"workspace-engine/pkg/workspace/store/repository"

	"go.opentelemetry.io/otel/attribute"
)

func NewDeployments(store *Store) *Deployments {
	deployments := &Deployments{
		repo:      store.repo,
		store:     store,
		resources: cmap.New[*materialized.MaterializedView[map[string]*oapi.Resource]](),
		versions:  cmap.New[*materialized.MaterializedView[map[string]*oapi.DeploymentVersion]](),
	}

	return deployments
}

type Deployments struct {
	repo  *repository.Repository
	store *Store

	resources cmap.ConcurrentMap[string, *materialized.MaterializedView[map[string]*oapi.Resource]]
	versions  cmap.ConcurrentMap[string, *materialized.MaterializedView[map[string]*oapi.DeploymentVersion]]
}

func (e *Deployments) RecomputeResources(ctx context.Context, deploymentId string) error {
	mv, ok := e.resources.Get(deploymentId)
	if !ok {
		return fmt.Errorf("deployment %s not found", deploymentId)
	}

	return mv.StartRecompute(ctx)
}

// deploymentResourceRecomputeFunc returns a function that computes resources for a specific deployment
func (e *Deployments) deploymentResourceRecomputeFunc(deploymentId string) materialized.RecomputeFunc[map[string]*oapi.Resource] {
	return func(ctx context.Context) (map[string]*oapi.Resource, error) {
		_, span := tracer.Start(ctx, "deploymentResourceRecomputeFunc")
		defer span.End()

		deployment, exists := e.repo.Deployments.Get(deploymentId)
		if !exists {
			span.RecordError(fmt.Errorf("deployment %s not found", deploymentId))
			return nil, fmt.Errorf("deployment %s not found", deploymentId)
		}

		span.SetAttributes(
			attribute.String("deployment.id", deploymentId),
			attribute.String("deployment.name", deployment.Name),
		)

		if deployment.ResourceSelector == nil {
			allResources := make(map[string]*oapi.Resource, e.repo.Resources.Count())
			resourceCount := 0
			e.repo.Resources.IterCb(func(key string, resource *oapi.Resource) {
				allResources[key] = resource
				resourceCount++
			})
			span.SetAttributes(
				attribute.Int("deployment.resources.without_selector", resourceCount),
			)
			return allResources, nil
		}

		// Pre-allocate slice with exact capacity
		resourceCount := e.repo.Resources.Count()
		items := make([]*oapi.Resource, 0, resourceCount)
		
		// Use IterCb for more efficient iteration (no channel overhead)
		e.repo.Resources.IterCb(func(key string, resource *oapi.Resource) {
			items = append(items, resource)
		})

		span.SetAttributes(
			attribute.Int("repo.resource_count", resourceCount),
			attribute.String("deployment.resource_selector", fmt.Sprintf("%v", deployment.ResourceSelector)),
		)

		deploymentResources, err := selector.FilterResources(ctx, deployment.ResourceSelector, items)
		if err != nil {
			span.RecordError(err)
			return nil, fmt.Errorf("failed to filter resources for deployment %s: %w", deploymentId, err)
		}

		span.SetAttributes(
			attribute.Int("deployment.matched_resource_count", len(deploymentResources)),
		)

		return deploymentResources, nil
	}
}

func (e *Deployments) deploymentVersionRecomputeFunc(deploymentId string) materialized.RecomputeFunc[map[string]*oapi.DeploymentVersion] {
	return func(ctx context.Context) (map[string]*oapi.DeploymentVersion, error) {
		_, exists := e.repo.Deployments.Get(deploymentId)
		if !exists {
			return nil, fmt.Errorf("deployment %s not found", deploymentId)
		}
		deploymentVersions := make(map[string]*oapi.DeploymentVersion, e.repo.DeploymentVersions.Count())
		// Use IterCb for more efficient iteration (no channel overhead)
		e.repo.DeploymentVersions.IterCb(func(key string, version *oapi.DeploymentVersion) {
			if version.DeploymentId == deploymentId {
				deploymentVersions[key] = version
			}
		})
		return deploymentVersions, nil
	}
}

func (e *Deployments) IterBuffered() <-chan cmap.Tuple[string, *oapi.Deployment] {
	return e.repo.Deployments.IterBuffered()
}

// ReinitializeMaterializedViews recreates all materialized views after deserialization
func (e *Deployments) ReinitializeMaterializedViews() {
	for item := range e.repo.Deployments.IterBuffered() {
		deployment := item.Val
		resourcesMv := materialized.New(
			e.deploymentResourceRecomputeFunc(deployment.Id),
		)
		versionsMv := materialized.New(
			e.deploymentVersionRecomputeFunc(deployment.Id),
		)
		e.resources.Set(deployment.Id, resourcesMv)
		e.versions.Set(deployment.Id, versionsMv)
	}
}

func (e *Deployments) Get(id string) (*oapi.Deployment, bool) {
	return e.repo.Deployments.Get(id)
}

func (e *Deployments) Has(id string) bool {
	return e.repo.Deployments.Has(id)
}

func (e *Deployments) HasResource(deploymentId string, resourceId string) bool {
	mv, ok := e.resources.Get(deploymentId)
	if !ok {
		return false
	}

	_ = mv.WaitRecompute()
	allResources := mv.Get()
	if deploymentResources, ok := allResources[resourceId]; ok {
		return deploymentResources != nil
	}
	return false
}

func (e *Deployments) Resources(deploymentId string) (map[string]*oapi.Resource, error) {
	mv, ok := e.resources.Get(deploymentId)
	if !ok {
		return nil, fmt.Errorf("deployment %s not found", deploymentId)
	}

	if err := mv.WaitRecompute(); err != nil && !materialized.IsNotStarted(err) {
		return nil, err
	}

	return mv.Get(), nil
}

func (e *Deployments) Upsert(ctx context.Context, deployment *oapi.Deployment) error {
	previous, _ := e.repo.Deployments.Get(deployment.Id)
	previousSystemId := ""
	if previous != nil {
		previousSystemId = previous.SystemId
	}

	// Store the deployment in the repository
	e.repo.Deployments.Set(deployment.Id, deployment)
	e.store.Systems.ApplyDeploymentUpdate(ctx, previousSystemId, deployment)

	// Create materialized view with immediate computation of deployment resources
	mv := materialized.New(
		e.deploymentResourceRecomputeFunc(deployment.Id),
	)

	versionsMv := materialized.New(
		e.deploymentVersionRecomputeFunc(deployment.Id),
	)

	e.resources.Set(deployment.Id, mv)
	e.versions.Set(deployment.Id, versionsMv)

	e.store.ReleaseTargets.Recompute(ctx)

	return nil
}

func (e *Deployments) Remove(ctx context.Context, id string) {
	e.repo.Deployments.Remove(id)
	e.resources.Remove(id)
	e.versions.Remove(id)

	e.store.ReleaseTargets.Recompute(ctx)
}

func (e *Deployments) Variables(deploymentId string) map[string]*oapi.DeploymentVariable {
	vars := make(map[string]*oapi.DeploymentVariable)
	// Use IterCb for more efficient iteration (no channel overhead)
	e.repo.DeploymentVariables.IterCb(func(key string, variable *oapi.DeploymentVariable) {
		if variable.DeploymentId == deploymentId {
			vars[variable.Key] = variable
		}
	})
	return vars
}

func (e *Deployments) Items() map[string]*oapi.Deployment {
	return e.repo.Deployments.Items()
}
