package store

import (
	"context"
	"fmt"
	"workspace-engine/pkg/cmap"
	"workspace-engine/pkg/pb"
	"workspace-engine/pkg/selector/langs/jsonselector"
	"workspace-engine/pkg/selector/langs/jsonselector/unknown"
)

type Environments struct {
	store *Store

	resources cmap.ConcurrentMap[string, map[string]*pb.Resource]
}

func (e *Environments) IterBuffered() <-chan cmap.Tuple[string, *pb.Environment] {
	return e.store.environments.IterBuffered()
}

func (e *Environments) Get(id string) (*pb.Environment, bool) {
	return e.store.environments.Get(id)
}

func (e *Environments) Has(id string) bool {
	return e.store.environments.Has(id)
}

func (e *Environments) HasResources(envId string, resourceId string) bool {
	resources, exists := e.resources.Get(envId)
	return exists && resources[resourceId] != nil
}

func (e *Environments) Resources(id string) map[string]*pb.Resource {
	resources, exists := e.resources.Get(id)
	if !exists {
		return map[string]*pb.Resource{}
	}
	return resources
}

func (e *Environments) RecomputeResources(ctx context.Context, environmentId string) error {
	env, exists := e.store.environments.Get(environmentId)
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

	environmentResources := make(map[string]*pb.Resource, e.store.resources.Count())
	for item := range e.store.resources.IterBuffered() {
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

	// Step 3: NOW lock and atomically update both
	envShard := e.store.environments.GetShard(environment.Id)
	envShard.Lock()
	defer envShard.Unlock()
	envShard.Items[environment.Id] = environment

	resourceShard := e.resources.GetShard(environment.Id)
	resourceShard.Lock()
	defer resourceShard.Unlock()
	resourceShard.Items[environment.Id] = environmentResources

	return nil
}

func (e *Environments) Remove(id string) {
	e.store.environments.Remove(id)
	e.resources.Remove(id)
}
