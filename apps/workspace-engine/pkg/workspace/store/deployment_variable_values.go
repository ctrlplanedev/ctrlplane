package store

import (
	"context"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/store/repository"
)

func NewDeploymentVariableValues(store *Store) *DeploymentVariableValues {
	return &DeploymentVariableValues{repo: store.repo, store: store}
}

type DeploymentVariableValues struct {
	repo  *repository.InMemoryStore
	store *Store
}

func (d *DeploymentVariableValues) Items() map[string]*oapi.DeploymentVariableValue {
	return d.repo.DeploymentVariableValues.Items()
}

func (d *DeploymentVariableValues) Upsert(ctx context.Context, id string, deploymentVariableValue *oapi.DeploymentVariableValue) {
	d.repo.DeploymentVariableValues.Set(id, deploymentVariableValue)
	d.store.changeset.RecordUpsert(deploymentVariableValue)
}

func (d *DeploymentVariableValues) Remove(ctx context.Context, id string) {
	deploymentVariableValue, ok := d.repo.DeploymentVariableValues.Get(id)
	if !ok || deploymentVariableValue == nil {
		return
	}

	d.repo.DeploymentVariableValues.Remove(id)
	d.store.changeset.RecordDelete(deploymentVariableValue)
}
