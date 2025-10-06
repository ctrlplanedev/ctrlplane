package store

import (
	"workspace-engine/pkg/workspace/store/repository"
)

func initSubStores(store *Store) {
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
	store.JobAgents = NewJobAgents(store)
}

func New() *Store {
	repo := repository.New()
	store := &Store{
		repo: repo,
	}

	initSubStores(store)
	return store
}

func NewWithRepository(repo *repository.Repository) *Store {
	store := New()
	store.repo = repo

	initSubStores(store)
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
	JobAgents           *JobAgents
}
