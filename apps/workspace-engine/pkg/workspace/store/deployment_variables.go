package store

import (
	"context"
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
	repo  *repository.InMemoryStore
	store *Store
}

func (d *DeploymentVariables) Items() map[string]*oapi.DeploymentVariable {
	return d.repo.DeploymentVariables
}

func (d *DeploymentVariables) Get(id string) (*oapi.DeploymentVariable, bool) {
	return d.repo.DeploymentVariables.Get(id)
}

func (d *DeploymentVariables) Upsert(ctx context.Context, id string, deploymentVariable *oapi.DeploymentVariable) {
	d.repo.DeploymentVariables.Set(id, deploymentVariable)
	d.store.changeset.RecordUpsert(deploymentVariable)
}

func (d *DeploymentVariables) Remove(ctx context.Context, id string) {
	deploymentVariable, ok := d.repo.DeploymentVariables.Get(id)
	if !ok || deploymentVariable == nil {
		return
	}
	d.repo.DeploymentVariables.Remove(id)
	d.store.changeset.RecordDelete(deploymentVariable)
}

func (d *DeploymentVariables) Values(variableId string) map[string]*oapi.DeploymentVariableValue {
	values := make(map[string]*oapi.DeploymentVariableValue)
	for _, value := range d.repo.DeploymentVariableValues {
		if value.DeploymentVariableId == variableId {
			values[value.Id] = value
		}
	}
	return values
}
