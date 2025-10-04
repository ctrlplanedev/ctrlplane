package store

import (
	"workspace-engine/pkg/cmap"
	"workspace-engine/pkg/pb"
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

	deployableVersions cmap.ConcurrentMap[string, *pb.DeploymentVersion]
}

func (d *DeploymentVersions) IterBuffered() <-chan cmap.Tuple[string, *pb.DeploymentVersion] {
	return d.repo.DeploymentVersions.IterBuffered()
}

func (d *DeploymentVersions) Has(id string) bool {
	return d.repo.DeploymentVersions.Has(id)
}

func (d *DeploymentVersions) Items() map[string]*pb.DeploymentVersion {
	return d.repo.DeploymentVersions.Items()
}

func (d *DeploymentVersions) Get(id string) (*pb.DeploymentVersion, bool) {
	return d.repo.DeploymentVersions.Get(id)
}

func (d *DeploymentVersions) Upsert(id string, version *pb.DeploymentVersion) {
	d.repo.DeploymentVersions.Set(id, version)
}

func (d *DeploymentVersions) Remove(id string) {
	d.repo.DeploymentVersions.Remove(id)
	d.deployableVersions.Remove(id)
}
