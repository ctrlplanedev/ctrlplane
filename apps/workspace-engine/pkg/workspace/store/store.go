package store

import (
	"workspace-engine/pkg/cmap"
	"workspace-engine/pkg/pb"
	"workspace-engine/pkg/workspace/store/materialized"
	"workspace-engine/pkg/workspace/store/repository"
)

func New() *Store {
	repo := repository.New()
	store := &Store{
		repo: repo,
	}

	// Initialize Deployments with materialized view
	deployments := &Deployments{
		repo:      repo,
		resources: cmap.New[*materialized.MaterializedView[map[string]*pb.Resource]](),
	}

	store.Deployments = deployments
	store.Environments = &Environments{
		repo:      repo,
		resources: cmap.New[*materialized.MaterializedView[map[string]*pb.Resource]](),
	}
	store.Resources = &Resources{
		repo:  repo,
		store: store,
	}
	store.Policies = &Policies{repo: repo}
	store.ReleaseTargets = NewReleaseTargets(store)
	store.DeploymentVersions = &DeploymentVersions{
		repo:               repo,
		store:              store,
		deployableVersions: cmap.New[*pb.DeploymentVersion](),
	}
	store.Systems = &Systems{repo: repo}

	store.DeploymentVariables = &DeploymentVariables{repo: repo}

	return store
}

type Store struct {
	repo *repository.Repository

	Policies            *Policies
	Resources           *Resources
	Deployments         *Deployments
	DeploymentVersions  *DeploymentVersions
	DeploymentVariables *DeploymentVariables
	Environments        *Environments
	ReleaseTargets      *ReleaseTargets
	Systems             *Systems
}
