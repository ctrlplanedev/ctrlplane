package store

import (
	"context"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/store/repository"

	"github.com/charmbracelet/log"
)

func NewDeploymentVariables(store *Store) *DeploymentVariables {
	return &DeploymentVariables{
		repo:  store.repo.DeploymentVariables(),
		store: store,
	}
}

type DeploymentVariables struct {
	repo  repository.DeploymentVariableRepo
	store *Store
}

func (d *DeploymentVariables) SetRepo(repo repository.DeploymentVariableRepo) {
	d.repo = repo
}

func (d *DeploymentVariables) Items() map[string]*oapi.DeploymentVariable {
	return d.repo.Items()
}

func (d *DeploymentVariables) Get(id string) (*oapi.DeploymentVariable, bool) {
	return d.repo.Get(id)
}

func (d *DeploymentVariables) Upsert(ctx context.Context, id string, deploymentVariable *oapi.DeploymentVariable) {
	if err := d.repo.Set(deploymentVariable); err != nil {
		log.Error("Failed to upsert deployment variable", "error", err)
		return
	}
	d.store.changeset.RecordUpsert(deploymentVariable)
}

func (d *DeploymentVariables) Remove(ctx context.Context, id string) {
	deploymentVariable, ok := d.repo.Get(id)
	if !ok || deploymentVariable == nil {
		return
	}
	if err := d.repo.Remove(id); err != nil {
		log.Error("Failed to remove deployment variable", "error", err)
		return
	}
	d.store.changeset.RecordDelete(deploymentVariable)
}

func (d *DeploymentVariables) Values(variableId string) map[string]*oapi.DeploymentVariableValue {
	values := make(map[string]*oapi.DeploymentVariableValue)
	for _, value := range d.store.DeploymentVariableValues.Items() {
		if value.DeploymentVariableId == variableId {
			values[value.Id] = value
		}
	}
	return values
}
