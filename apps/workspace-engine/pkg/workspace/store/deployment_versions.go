package store

import (
	"context"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/store/repository"
)

func NewDeploymentVersions(store *Store) *DeploymentVersions {
	return &DeploymentVersions{
		repo:  store.repo,
		store: store,
	}
}

type DeploymentVersions struct {
	repo  *repository.InMemoryStore
	store *Store
}

func (d *DeploymentVersions) Items() map[string]*oapi.DeploymentVersion {
	return d.repo.DeploymentVersions.Items()
}

func (d *DeploymentVersions) Get(id string) (*oapi.DeploymentVersion, bool) {
	return d.repo.DeploymentVersions.Get(id)
}

func (d *DeploymentVersions) GetByDeploymentID(deploymentID string) ([]*oapi.DeploymentVersion, error) {
	return d.repo.DeploymentVersions.GetBy("deployment_id", deploymentID)
}

func (d *DeploymentVersions) Upsert(ctx context.Context, id string, version *oapi.DeploymentVersion) {
	d.repo.DeploymentVersions.Set(version)
	d.store.changeset.RecordUpsert(version)
}

func (d *DeploymentVersions) Remove(ctx context.Context, id string) {
	version, ok := d.repo.DeploymentVersions.Get(id)
	if !ok {
		return
	}

	d.repo.DeploymentVersions.Remove(id)
	d.store.changeset.RecordDelete(version)
}
