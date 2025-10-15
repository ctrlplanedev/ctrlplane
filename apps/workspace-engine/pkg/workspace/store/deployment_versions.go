package store

import (
	"context"
	"workspace-engine/pkg/changeset"
	"workspace-engine/pkg/cmap"
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
	repo  *repository.Repository
	store *Store

	deployableVersions cmap.ConcurrentMap[string, *oapi.DeploymentVersion]
}

func (d *DeploymentVersions) IterBuffered() <-chan cmap.Tuple[string, *oapi.DeploymentVersion] {
	return d.repo.DeploymentVersions.IterBuffered()
}

func (d *DeploymentVersions) Has(id string) bool {
	return d.repo.DeploymentVersions.Has(id)
}

func (d *DeploymentVersions) Items() map[string]*oapi.DeploymentVersion {
	return d.repo.DeploymentVersions.Items()
}

func (d *DeploymentVersions) Get(id string) (*oapi.DeploymentVersion, bool) {
	return d.repo.DeploymentVersions.Get(id)
}

func (d *DeploymentVersions) Upsert(ctx context.Context, id string, version *oapi.DeploymentVersion) {
	d.repo.DeploymentVersions.Set(id, version)
	if cs, ok := changeset.FromContext[any](ctx); ok {
		cs.Record(changeset.ChangeTypeCreate, version)
	}
}

func (d *DeploymentVersions) Remove(ctx context.Context, id string) {
	version, ok := d.repo.DeploymentVersions.Get(id)
	if !ok { return }

	d.repo.DeploymentVersions.Remove(id)
	d.deployableVersions.Remove(id)

	if cs, ok := changeset.FromContext[any](ctx); ok {
		cs.Record(changeset.ChangeTypeDelete, version)
	}
}
