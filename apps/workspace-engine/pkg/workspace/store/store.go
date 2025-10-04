package store

import (
	"workspace-engine/pkg/workspace/store/repository"
)

func New() *Store {
	repo := repository.New()
	store := &Store{
		repo: repo,
	}

	store.Deployments = NewDeployments(store)
	store.Environments = NewEnvironments(store)
	store.Resources = NewResources(store)
	store.Policies = NewPolicies(store)
	store.ReleaseTargets = NewReleaseTargets(store)
	store.DeploymentVersions = NewDeploymentVersions(store)
	store.Systems = NewSystems(store)
	store.DeploymentVariables = NewDeploymentVariables(store)
	store.Releases = NewReleases(store)
	store.Jobs = NewJobs(store)

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
	Releases            *Releases
	Jobs                *Jobs
}
