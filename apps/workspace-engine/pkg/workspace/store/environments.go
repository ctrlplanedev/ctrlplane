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

type Environments struct {
	repo *repository.Repository

	resources cmap.ConcurrentMap[string, *materialized.MaterializedView[map[string]*pb.Resource]]
}

// environmentResourceRecomputeFunc returns a function that computes resources for a specific environment
func (e *Environments) environmentResourceRecomputeFunc(environmentId string) materialized.RecomputeFunc[map[string]*pb.Resource] {
	return func() (map[string]*pb.Resource, error) {
		environment, exists := e.repo.Environments.Get(environmentId)
		if !exists {
			return nil, fmt.Errorf("environment %s not found", environmentId)
		}

		var condition unknown.MatchableCondition
		if environment.ResourceSelector != nil {
			unknownCondition, err := unknown.ParseFromMap(environment.ResourceSelector.AsMap())
			if err != nil {
				return nil, fmt.Errorf("failed to parse selector for environment %s: %w", environment.Id, err)
			}
			condition, err = jsonselector.ConvertToSelector(context.Background(), unknownCondition)
			if err != nil {
				return nil, fmt.Errorf("failed to convert selector for environment %s: %w", environment.Id, err)
			}
		}

		environmentResources := make(map[string]*pb.Resource, e.repo.Resources.Count())
		for resourceItem := range e.repo.Resources.IterBuffered() {
			if condition == nil {
				environmentResources[resourceItem.Key] = resourceItem.Val
				continue
			}
			ok, err := condition.Matches(resourceItem.Val)
			if err != nil {
				return nil, fmt.Errorf("error matching resource %s for environment %s: %w", resourceItem.Key, environment.Id, err)
			}
			if ok {
				environmentResources[resourceItem.Key] = resourceItem.Val
			}
		}

		return environmentResources, nil
	}
}

func (e *Environments) IterBuffered() <-chan cmap.Tuple[string, *pb.Environment] {
	return e.repo.Environments.IterBuffered()
}

func (e *Environments) Get(id string) (*pb.Environment, bool) {
	return e.repo.Environments.Get(id)
}

func (e *Environments) Has(id string) bool {
	return e.repo.Environments.Has(id)
}

func (e *Environments) HasResource(envId string, resourceId string) bool {
	mv, ok := e.resources.Get(envId)
	if !ok {
		return false
	}

	mv.WaitRecompute()
	allResources := mv.Get()
	if envResources, ok := allResources[resourceId]; ok {
		return envResources != nil
	}
	return false
}

func (e *Environments) Resources(id string) map[string]*pb.Resource {
	mv, ok := e.resources.Get(id)
	if !ok {
		return map[string]*pb.Resource{}
	}

	mv.WaitRecompute()
	allResources := mv.Get()
	return allResources
}

func (e *Environments) RecomputeResources(ctx context.Context, environmentId string) error {
	mv, ok := e.resources.Get(environmentId)
	if !ok {
		return fmt.Errorf("environment %s not found", environmentId)
	}

	// RunRecompute will start a new computation or wait for an existing one
	return mv.RunRecompute()
}

func (e *Environments) Upsert(ctx context.Context, environment *pb.Environment) error {
	// Validate selector before storing
	if environment.ResourceSelector != nil {
		unknownCondition, err := unknown.ParseFromMap(environment.ResourceSelector.AsMap())
		if err != nil {
			return fmt.Errorf("failed to parse selector: %w", err)
		}
		_, err = jsonselector.ConvertToSelector(ctx, unknownCondition)
		if err != nil {
			return fmt.Errorf("failed to convert selector: %w", err)
		}
	}

	// Store the environment in the repository
	e.repo.Environments.Set(environment.Id, environment)

	// Create materialized view with immediate computation of environment resources
	mv := materialized.New(e.environmentResourceRecomputeFunc(environment.Id))

	e.resources.Set(environment.Id, mv)

	// Wait for initial computation to complete to maintain synchronous behavior
	return mv.WaitRecompute()
}

// ApplyResourceUpdate applies an incremental update for a single resource.
// This is more efficient than RecomputeResources when only one resource changed.
// It checks if the resource matches the environment's selector and updates the cached map accordingly.
func (e *Environments) ApplyResourceUpdate(ctx context.Context, environmentId string, resource *pb.Resource) error {
	environment, exists := e.repo.Environments.Get(environmentId)
	if !exists {
		return fmt.Errorf("environment %s not found", environmentId)
	}

	// Parse the environment's resource selector
	var condition unknown.MatchableCondition
	if environment.ResourceSelector != nil {
		unknownCondition, err := unknown.ParseFromMap(environment.ResourceSelector.AsMap())
		if err != nil {
			return fmt.Errorf("failed to parse selector for environment %s: %w", environment.Id, err)
		}
		condition, err = jsonselector.ConvertToSelector(ctx, unknownCondition)
		if err != nil {
			return fmt.Errorf("failed to convert selector for environment %s: %w", environment.Id, err)
		}
	}

	// Apply the incremental update
	mv, ok := e.resources.Get(environmentId)
	if !ok {
		return fmt.Errorf("environment %s not found", environmentId)
	}

	_, err := mv.ApplyUpdate(func(currentResources map[string]*pb.Resource) (map[string]*pb.Resource, error) {
		// Check if resource matches selector
		matches := condition == nil // nil condition means match all
		if condition != nil {
			ok, err := condition.Matches(resource)
			if err != nil {
				return nil, fmt.Errorf("error matching resource %s for environment %s: %w", resource.Id, environment.Id, err)
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

func (e *Environments) Remove(id string) {
	e.repo.Environments.Remove(id)
	e.resources.Remove(id)
}
