package store

import (
	"context"
	"sync"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/changeset"
	"workspace-engine/pkg/workspace/store/repository"
)

func NewResources(store *Store) *Resources {
	return &Resources{
		repo:  store.repo,
		store: store,
	}
}

type Resources struct {
	repo  *repository.Repository
	store *Store
}

func (r *Resources) Upsert(ctx context.Context, resource *oapi.Resource) (*oapi.Resource, error) {
	r.repo.Resources.Set(resource.Id, resource)

	var wg sync.WaitGroup
	wg.Add(2)
	go func() {
		defer wg.Done()
		for item := range r.store.Environments.IterBuffered() {
			environment := item.Val
			r.store.Environments.RecomputeResources(ctx, environment.Id)
		}
	}()
	go func() {
		defer wg.Done()
		for item := range r.store.Deployments.IterBuffered() {
			deployment := item.Val
			r.store.Deployments.RecomputeResources(ctx, deployment.Id)
		}
	}()
	wg.Wait()

	r.store.ReleaseTargets.Recompute(ctx)

	if cs, ok := changeset.FromContext(ctx); ok {
		cs.Record("resource", changeset.ChangeTypeInsert, resource.Id, resource)
	}

	return resource, nil
}

func (r *Resources) Get(id string) (*oapi.Resource, bool) {
	return r.repo.Resources.Get(id)
}

func (r *Resources) Remove(ctx context.Context, id string) {
	r.repo.Resources.Remove(id)

	var wg sync.WaitGroup
	wg.Add(2)
	go func() {
		defer wg.Done()
		for item := range r.store.Environments.IterBuffered() {
			environment := item.Val
			r.store.Environments.RecomputeResources(ctx, environment.Id)
		}
	}()
	go func() {
		defer wg.Done()
		for item := range r.store.Deployments.IterBuffered() {
			deployment := item.Val
			r.store.Deployments.RecomputeResources(ctx, deployment.Id)
		}
	}()
	wg.Wait()

	r.store.ReleaseTargets.Recompute(ctx)

	if cs, ok := changeset.FromContext(ctx); ok {
		cs.Record("resource", changeset.ChangeTypeDelete, id, nil)
	}
}

func (r *Resources) Items() map[string]*oapi.Resource {
	return r.repo.Resources.Items()
}

func (r *Resources) Has(id string) bool {
	return r.repo.Resources.Has(id)
}

func (r *Resources) Variables(resourceId string) map[string]*oapi.ResourceVariable {
	variables := make(map[string]*oapi.ResourceVariable, 25)
	for item := range r.repo.ResourceVariables.IterBuffered() {
		if item.Val.ResourceId != resourceId {
			continue
		}
		variables[item.Val.Key] = item.Val
	}
	return variables
}
