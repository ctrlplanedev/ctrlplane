package store

import (
	"context"
	"fmt"
	"workspace-engine/pkg/cmap"
	"workspace-engine/pkg/pb"
	"workspace-engine/pkg/selector/langs/jsonselector"
	"workspace-engine/pkg/selector/langs/jsonselector/unknown"
	"workspace-engine/pkg/selector/langs/util"
	"workspace-engine/pkg/workspace/store/materialized"
	"workspace-engine/pkg/workspace/store/repository"
)

func NewDeployments(store *Store) *Deployments {
	deployments := &Deployments{
		repo:      store.repo,
		store:     store,
		resources: cmap.New[*materialized.MaterializedView[map[string]*pb.Resource]](),
		versions:  cmap.New[*materialized.MaterializedView[map[string]*pb.DeploymentVersion]](),
	}

	return deployments
}

type Deployments struct {
	repo  *repository.Repository
	store *Store

	resources cmap.ConcurrentMap[string, *materialized.MaterializedView[map[string]*pb.Resource]]
	versions  cmap.ConcurrentMap[string, *materialized.MaterializedView[map[string]*pb.DeploymentVersion]]
}

// deploymentResourceRecomputeFunc returns a function that computes resources for a specific deployment
func (e *Deployments) deploymentResourceRecomputeFunc(deploymentId string) materialized.RecomputeFunc[map[string]*pb.Resource] {
	return func(ctx context.Context) (map[string]*pb.Resource, error) {
		deployment, exists := e.repo.Deployments.Get(deploymentId)
		if !exists {
			return nil, fmt.Errorf("deployment %s not found", deploymentId)
		}

		var condition util.MatchableCondition
		if deployment.ResourceSelector != nil {
			unknownCondition, err := unknown.ParseFromMap(deployment.ResourceSelector.AsMap())
			if err != nil {
				return nil, fmt.Errorf("failed to parse selector for deployment %s: %w", deployment.Id, err)
			}
			condition, err = jsonselector.ConvertToSelector(context.Background(), unknownCondition)
			if err != nil {
				return nil, fmt.Errorf("failed to convert selector for deployment %s: %w", deployment.Id, err)
			}
		}

		deploymentResources := make(map[string]*pb.Resource, e.repo.Resources.Count())
		for resourceItem := range e.repo.Resources.IterBuffered() {
			if condition == nil {
				deploymentResources[resourceItem.Key] = resourceItem.Val
				continue
			}
			ok, err := condition.Matches(resourceItem.Val)
			if err != nil {
				return nil, fmt.Errorf("error matching resource %s for deployment %s: %w", resourceItem.Key, deployment.Id, err)
			}
			if ok {
				deploymentResources[resourceItem.Key] = resourceItem.Val
			}
		}

		return deploymentResources, nil
	}
}

func (e *Deployments) deploymentVersionRecomputeFunc(deploymentId string) materialized.RecomputeFunc[map[string]*pb.DeploymentVersion] {
	return func(ctx context.Context) (map[string]*pb.DeploymentVersion, error) {
		_, exists := e.repo.Deployments.Get(deploymentId)
		if !exists {
			return nil, fmt.Errorf("deployment %s not found", deploymentId)
		}
		deploymentVersions := make(map[string]*pb.DeploymentVersion, e.repo.DeploymentVersions.Count())
		for versionItem := range e.repo.DeploymentVersions.IterBuffered() {
			if versionItem.Val.DeploymentId != deploymentId {
				continue
			}
			deploymentVersions[versionItem.Key] = versionItem.Val
		}
		return deploymentVersions, nil
	}
}

func (e *Deployments) IterBuffered() <-chan cmap.Tuple[string, *pb.Deployment] {
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

func (e *Deployments) Get(id string) (*pb.Deployment, bool) {
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

	mv.WaitRecompute()
	allResources := mv.Get()
	if deploymentResources, ok := allResources[resourceId]; ok {
		return deploymentResources != nil
	}
	return false
}

func (e *Deployments) Resources(deploymentId string) map[string]*pb.Resource {
	mv, ok := e.resources.Get(deploymentId)
	if !ok {
		return map[string]*pb.Resource{}
	}

	mv.WaitRecompute()
	allResources := mv.Get()
	return allResources
}

func (e *Deployments) Upsert(ctx context.Context, deployment *pb.Deployment) error {
	// Validate selector before storing
	if deployment.ResourceSelector != nil {
		unknownCondition, err := unknown.ParseFromMap(deployment.ResourceSelector.AsMap())
		if err != nil {
			return fmt.Errorf("failed to parse selector: %w", err)
		}
		_, err = jsonselector.ConvertToSelector(ctx, unknownCondition)
		if err != nil {
			return fmt.Errorf("failed to convert selector: %w", err)
		}
	}

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

// ApplyResourceUpdate applies an incremental update for a single resource.
// This is more efficient than RecomputeResources when only one resource changed.
// It checks if the resource matches the deployment's selector and updates the cached map accordingly.
func (e *Deployments) ApplyResourceUpdate(ctx context.Context, deploymentId string, resource *pb.Resource) error {
	deployment, exists := e.repo.Deployments.Get(deploymentId)
	if !exists {
		return fmt.Errorf("deployment %s not found", deploymentId)
	}

	// Parse the deployment's resource selector
	if deployment.ResourceSelector != nil {
		unknownCondition, err := unknown.ParseFromMap(deployment.ResourceSelector.AsMap())
		if err != nil {
			return fmt.Errorf("failed to parse selector for deployment %s: %w", deployment.Id, err)
		}
		_, err = jsonselector.ConvertToSelector(ctx, unknownCondition)
		if err != nil {
			return fmt.Errorf("failed to convert selector for deployment %s: %w", deployment.Id, err)
		}
	}

	mv, ok := e.resources.Get(deploymentId)
	if !ok {
		return fmt.Errorf("deployment %s not found", deploymentId)
	}

	mv.StartRecompute(ctx)

	return nil
}

func (e *Deployments) Remove(ctx context.Context, id string) {
	e.repo.Deployments.Remove(id)
	e.resources.Remove(id)
	e.versions.Remove(id)

	e.store.ReleaseTargets.Recompute(ctx)
}

func (e *Deployments) Variables(deploymentId string) map[string]*pb.DeploymentVariable {
	vars := make(map[string]*pb.DeploymentVariable)
	for variable := range e.repo.DeploymentVariables.IterBuffered() {
		if variable.Val.DeploymentId != deploymentId {
			continue
		}
		vars[variable.Val.Key] = variable.Val
	}
	return vars
}

func (e *Deployments) Items() map[string]*pb.Deployment {
	return e.repo.Deployments.Items()
}
