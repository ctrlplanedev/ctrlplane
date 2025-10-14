package store

import (
	"context"
	"fmt"
	"workspace-engine/pkg/cmap"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/selector"
	"workspace-engine/pkg/workspace/store/materialized"
	"workspace-engine/pkg/workspace/store/repository"
)

func NewEnvironments(store *Store) *Environments {
	return &Environments{
		repo:      store.repo,
		store:     store,
		resources: cmap.New[*materialized.MaterializedView[map[string]*oapi.Resource]](),
	}
}

type Environments struct {
	repo  *repository.Repository
	store *Store

	resources cmap.ConcurrentMap[string, *materialized.MaterializedView[map[string]*oapi.Resource]]
}

func (e *Environments) Items() map[string]*oapi.Environment {
	return e.repo.Environments.Items()
}

// ReinitializeMaterializedViews recreates all materialized views after deserialization
func (e *Environments) ReinitializeMaterializedViews() {
	for item := range e.repo.Environments.IterBuffered() {
		environment := item.Val
		mv := materialized.New(
			e.environmentResourceRecomputeFunc(environment.Id),
		)
		e.resources.Set(environment.Id, mv)
	}
}

// environmentResourceRecomputeFunc returns a function that computes resources for a specific environment
func (e *Environments) environmentResourceRecomputeFunc(environmentId string) materialized.RecomputeFunc[map[string]*oapi.Resource] {
	return func(ctx context.Context) (map[string]*oapi.Resource, error) {
		_, span := tracer.Start(ctx, "environmentResourceRecomputeFunc")
		defer span.End()

		environment, exists := e.repo.Environments.Get(environmentId)
		if !exists {
			return nil, fmt.Errorf("environment %s not found", environmentId)
		}

		// Pre-allocate slice with exact capacity to avoid reallocations
		resourceCount := e.repo.Resources.Count()
		repoResources := make([]*oapi.Resource, 0, resourceCount)
		
		// Use IterCb for more efficient iteration (no channel overhead)
		e.repo.Resources.IterCb(func(key string, resource *oapi.Resource) {
			repoResources = append(repoResources, resource)
		})

		environmentResources, err := selector.FilterResources(ctx, environment.ResourceSelector, repoResources)
		if err != nil {
			return nil, fmt.Errorf("failed to filter resources for environment %s: %w", environmentId, err)
		}

		return environmentResources, nil
	}
}

func (e *Environments) IterBuffered() <-chan cmap.Tuple[string, *oapi.Environment] {
	return e.repo.Environments.IterBuffered()
}

func (e *Environments) Get(id string) (*oapi.Environment, bool) {
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

	_ = mv.WaitRecompute()
	allResources := mv.Get()
	if envResources, ok := allResources[resourceId]; ok {
		return envResources != nil
	}
	return false
}

func (e *Environments) Resources(id string) map[string]*oapi.Resource {
	mv, ok := e.resources.Get(id)
	if !ok {
		return map[string]*oapi.Resource{}
	}

	_ = mv.WaitRecompute()
	allResources := mv.Get()
	return allResources
}

func (e *Environments) RecomputeResources(ctx context.Context, environmentId string) error {
	mv, ok := e.resources.Get(environmentId)
	if !ok {
		return fmt.Errorf("environment %s not found", environmentId)
	}

	return mv.StartRecompute(ctx)
}

func (e *Environments) Upsert(ctx context.Context, environment *oapi.Environment) error {
	previous, _ := e.repo.Environments.Get(environment.Id)
	previousSystemId := ""
	if previous != nil {
		previousSystemId = previous.SystemId
	}

	// Store the environment in the repository
	e.repo.Environments.Set(environment.Id, environment)
	e.store.Systems.ApplyEnvironmentUpdate(ctx, previousSystemId, environment)

	// Create materialized view with immediate computation of environment resources
	mv := materialized.New(
		e.environmentResourceRecomputeFunc(environment.Id),
	)

	e.resources.Set(environment.Id, mv)

	e.store.ReleaseTargets.Recompute(ctx)

	return nil
}

// ApplyResourceUpdate applies an incremental update for a single resource.
// This is more efficient than RecomputeResources when only one resource changed.
// It checks if the resource matches the environment's selector and updates the cached map accordingly.
func (e *Environments) ApplyResourceUpdate(ctx context.Context, environmentId string, resource *oapi.Resource) error {
	// Apply the incremental update
	mv, ok := e.resources.Get(environmentId)
	if !ok {
		return fmt.Errorf("environment %s not found", environmentId)
	}

	return mv.StartRecompute(ctx)
}

func (e *Environments) Remove(ctx context.Context, id string) {
	e.repo.Environments.Remove(id)
	e.resources.Remove(id)

	e.store.ReleaseTargets.Recompute(ctx)
}
