package store

import (
	"context"
	"fmt"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/selector"
	"workspace-engine/pkg/workspace/store/repository"
)

func NewEnvironments(store *Store) *Environments {
	return &Environments{
		repo:  store.repo,
		store: store,
	}
}

type Environments struct {
	repo  *repository.InMemoryStore
	store *Store
}

func (e *Environments) Items() map[string]*oapi.Environment {
	return e.repo.Environments.Items()
}

func (e *Environments) Get(id string) (*oapi.Environment, bool) {
	return e.repo.Environments.Get(id)
}

func (e *Environments) Upsert(ctx context.Context, environment *oapi.Environment) error {
	if environment.Metadata == nil {
		environment.Metadata = map[string]string{}
	}

	e.repo.Environments.Set(environment.Id, environment)
	e.store.changeset.RecordUpsert(environment)

	return nil
}

func (e *Environments) Remove(ctx context.Context, id string) {
	env, ok := e.Get(id)
	if !ok || env == nil {
		return
	}

	e.repo.Environments.Remove(id)
	e.store.changeset.RecordDelete(env)
}

func (e *Environments) Resources(ctx context.Context, environmentId string) ([]*oapi.Resource, error) {
	environment, ok := e.Get(environmentId)
	if !ok {
		return nil, fmt.Errorf("environment %s not found", environmentId)
	}

	allResourcesSlice := make([]*oapi.Resource, 0)
	for _, resource := range e.store.Resources.Items() {
		allResourcesSlice = append(allResourcesSlice, resource)
	}

	resources, err := selector.FilterResources(ctx, environment.ResourceSelector, allResourcesSlice)
	if err != nil {
		return nil, err
	}

	resourcesSlice := make([]*oapi.Resource, 0, len(resources))
	for _, resource := range resources {
		resourcesSlice = append(resourcesSlice, resource)
	}

	return resourcesSlice, nil
}

func (e *Environments) ForResource(ctx context.Context, resource *oapi.Resource) ([]*oapi.Environment, error) {
	environments := make([]*oapi.Environment, 0)
	for _, environment := range e.Items() {
		matched, err := selector.Match(ctx, environment.ResourceSelector, resource)
		if err != nil {
			return nil, err
		}
		if matched {
			environments = append(environments, environment)
		}
	}
	return environments, nil
}
