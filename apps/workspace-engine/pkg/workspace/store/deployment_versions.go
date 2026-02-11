package store

import (
	"context"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/store/repository"
)

func NewDeploymentVersions(store *Store) *DeploymentVersions {
	return &DeploymentVersions{
		repo:  store.repo.DeploymentVersions(),
		store: store,
	}
}

type DeploymentVersions struct {
	repo  repository.DeploymentVersionRepo
	store *Store
}

// SetRepo replaces the underlying DeploymentVersionRepo implementation.
func (d *DeploymentVersions) SetRepo(repo repository.DeploymentVersionRepo) {
	d.repo = repo
}

func (d *DeploymentVersions) Items() map[string]*oapi.DeploymentVersion {
	return d.repo.Items()
}

func (d *DeploymentVersions) Get(id string) (*oapi.DeploymentVersion, bool) {
	return d.repo.Get(id)
}

func (d *DeploymentVersions) GetByDeploymentID(deploymentID string) ([]*oapi.DeploymentVersion, error) {
	return d.repo.GetByDeploymentID(deploymentID)
}

func (d *DeploymentVersions) Upsert(ctx context.Context, id string, version *oapi.DeploymentVersion) {
	d.repo.Set(version)
	d.store.changeset.RecordUpsert(version)
}

func (d *DeploymentVersions) Remove(ctx context.Context, id string) {
	version, ok := d.repo.Get(id)
	if !ok {
		return
	}

	d.repo.Remove(id)
	d.store.changeset.RecordDelete(version)
}
