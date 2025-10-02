package store

import (
	"workspace-engine/pkg/cmap"
	"workspace-engine/pkg/pb"
	"workspace-engine/pkg/workspace/store/repository"
)

func New() *Store {
	store := &Store{
		repo: repository.New(),
	}

	store.Deployments = &Deployments{
		store:     store,
		resources: cmap.New[map[string]*pb.Resource](),
	}
	store.Environments = &Environments{
		store:     store,
		resources: cmap.New[map[string]*pb.Resource](),
	}
	store.Resources = &Resources{store: store}
	store.Policies = &Policies{store: store}
	store.ReleaseTargets = &ReleaseTargets{store: store}
	store.DeploymentVersions = &DeploymentVersions{
		store:              store,
		deployableVersions: cmap.New[*pb.DeploymentVersion](),
	}
	store.Systems = &Systems{store: store}

	return store
}

type Store struct {
	repo *repository.Repository

	Policies           *Policies
	Resources          *Resources
	Deployments        *Deployments
	Environments       *Environments
	ReleaseTargets     *ReleaseTargets
	DeploymentVersions *DeploymentVersions
	Systems            *Systems
}
