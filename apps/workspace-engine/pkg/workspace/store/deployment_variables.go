package store

import (
	"context"
	"workspace-engine/pkg/changeset"
	"workspace-engine/pkg/cmap"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/store/repository"
)

func NewDeploymentVariables(store *Store) *DeploymentVariables {
	return &DeploymentVariables{
		repo:  store.repo,
		store: store,
	}
}

type DeploymentVariables struct {
	repo  *repository.Repository
	store *Store
}

func (d *DeploymentVariables) IterBuffered() <-chan cmap.Tuple[string, *oapi.DeploymentVariable] {
	return d.repo.DeploymentVariables.IterBuffered()
}

func (d *DeploymentVariables) Get(id string) (*oapi.DeploymentVariable, bool) {
	return d.repo.DeploymentVariables.Get(id)
}

func (d *DeploymentVariables) Values(varableId string) map[string]*oapi.DeploymentVariableValue {
	values := make(map[string]*oapi.DeploymentVariableValue)
	return values
}

func (d *DeploymentVariables) Upsert(ctx context.Context, id string, deploymentVariable *oapi.DeploymentVariable) {
	d.repo.DeploymentVariables.Set(id, deploymentVariable)
	if cs, ok := changeset.FromContext[any](ctx); ok {
		cs.Record(changeset.ChangeTypeUpsert, deploymentVariable)
	}

	d.store.changeset.RecordUpsert(deploymentVariable)
}

func (d *DeploymentVariables) Remove(ctx context.Context, id string) {
	deploymentVariable, ok := d.repo.DeploymentVariables.Get(id)
	if !ok || deploymentVariable == nil {
		return
	}
	d.repo.DeploymentVariables.Remove(id)
	if cs, ok := changeset.FromContext[any](ctx); ok {
		cs.Record(changeset.ChangeTypeDelete, deploymentVariable)
	}

	d.store.changeset.RecordDelete(deploymentVariable)
}
