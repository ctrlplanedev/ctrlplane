package store

import (
	"context"
	"fmt"
	"workspace-engine/pkg/cmap"
	"workspace-engine/pkg/pb"
	"workspace-engine/pkg/selector/langs/jsonselector"
	"workspace-engine/pkg/selector/langs/jsonselector/unknown"
	"workspace-engine/pkg/workspace/store/materialized"
	"workspace-engine/pkg/workspace/store/repository"
)

type Deployments struct {
	repo *repository.Repository

	resources cmap.ConcurrentMap[string, *materialized.MaterializedView[map[string]*pb.Resource]]
}

// deploymentResourceRecomputeFunc returns a function that computes resources for a specific deployment
func (e *Deployments) deploymentResourceRecomputeFunc(deploymentId string) materialized.RecomputeFunc[map[string]*pb.Resource] {
	return func() (map[string]*pb.Resource, error) {
		deployment, exists := e.repo.Deployments.Get(deploymentId)
		if !exists {
			return nil, fmt.Errorf("deployment %s not found", deploymentId)
		}

		var condition unknown.MatchableCondition
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

func (e *Deployments) IterBuffered() <-chan cmap.Tuple[string, *pb.Deployment] {
	return e.repo.Deployments.IterBuffered()
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

	// Store the deployment in the repository
	e.repo.Deployments.Set(deployment.Id, deployment)

	// Create materialized view with immediate computation of deployment resources
	mv := materialized.New(
		e.deploymentResourceRecomputeFunc(deployment.Id),
		materialized.WithImmediateCompute[map[string]*pb.Resource](),
	)

	e.resources.Set(deployment.Id, mv)

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
	var condition unknown.MatchableCondition
	if deployment.ResourceSelector != nil {
		unknownCondition, err := unknown.ParseFromMap(deployment.ResourceSelector.AsMap())
		if err != nil {
			return fmt.Errorf("failed to parse selector for deployment %s: %w", deployment.Id, err)
		}
		condition, err = jsonselector.ConvertToSelector(ctx, unknownCondition)
		if err != nil {
			return fmt.Errorf("failed to convert selector for deployment %s: %w", deployment.Id, err)
		}
	}

	mv, ok := e.resources.Get(deploymentId)
	if !ok {
		return fmt.Errorf("deployment %s not found", deploymentId)
	}

	_, err := mv.ApplyUpdate(func(currentResources map[string]*pb.Resource) (map[string]*pb.Resource, error) {
		// Check if resource matches selector
		matches := condition == nil // nil condition means match all
		if condition != nil {
			ok, err := condition.Matches(resource)
			if err != nil {
				return nil, fmt.Errorf("error matching resource %s for deployment %s: %w", resource.Id, deployment.Id, err)
			}
			matches = ok
		}

		// Update the map
		if matches {
			currentResources[resource.Id] = resource
		} else {
			delete(currentResources, resource.Id)
		}

		return currentResources, nil
	})

	return err
}

func (e *Deployments) Remove(id string) {
	e.repo.Deployments.Remove(id)
	e.resources.Remove(id)
}
