package store

import (
	"context"
	"fmt"
	"workspace-engine/pkg/cmap"
	"workspace-engine/pkg/pb"
	"workspace-engine/pkg/selector/langs/jsonselector"
	"workspace-engine/pkg/selector/langs/jsonselector/unknown"
	"workspace-engine/pkg/workspace/store/repository"
)

type Environments struct {
	repo *repository.Repository

	cachedResources cmap.ConcurrentMap[string, map[string]*pb.Resource]
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
	resources, exists := e.cachedResources.Get(envId)
	return exists && resources[resourceId] != nil
}

func (e *Environments) Resources(id string) map[string]*pb.Resource {
	resources, exists := e.cachedResources.Get(id)
	if !exists {
		return map[string]*pb.Resource{}
	}
	return resources
}

func (e *Environments) RecomputeResources(ctx context.Context, environmentId string) error {
	env, exists := e.repo.Environments.Get(environmentId)
	if !exists {
		return fmt.Errorf("environment %s not found", environmentId)
	}
	return e.Upsert(ctx, env)
}

func (e *Environments) Upsert(ctx context.Context, environment *pb.Environment) error {
	// Step 1: Parse selector OUTSIDE locks (can't change during function)
	var condition unknown.MatchableCondition
	if environment.ResourceSelector != nil {
		unknownCondition, err := unknown.ParseFromMap(environment.ResourceSelector.AsMap())
		if err != nil {
			return err
		}
		condition, err = jsonselector.ConvertToSelector(ctx, unknownCondition)
		if err != nil {
			return err
		}
	}

	environmentResources := make(map[string]*pb.Resource, e.repo.Resources.Count())
	for item := range e.repo.Resources.IterBuffered() {
		if condition == nil {
			environmentResources[item.Key] = item.Val
			continue
		}
		ok, err := condition.Matches(item.Val)
		if err != nil {
			return err
		}
		if ok {
			environmentResources[item.Key] = item.Val
		}
	}

	e.repo.Environments.Set(environment.Id, environment)
	e.cachedResources.Set(environment.Id, environmentResources)

	return nil
}

func (e *Environments) Remove(id string) {
	e.repo.Environments.Remove(id)
	e.cachedResources.Remove(id)
}
