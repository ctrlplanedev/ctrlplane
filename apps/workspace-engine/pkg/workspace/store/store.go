package store

import (
	"bytes"
	"encoding/gob"
	"workspace-engine/pkg/workspace/store/repository"
)

var _ gob.GobEncoder = (*Store)(nil)
var _ gob.GobDecoder = (*Store)(nil)

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
	UserApprovalRecords *UserApprovalRecords
}

func (s *Store) GobEncode() ([]byte, error) {
	var buf bytes.Buffer
	enc := gob.NewEncoder(&buf)
	if err := enc.Encode(s.repo); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

func (s *Store) GobDecode(data []byte) error {
	// Create reader from provided data
	buf := bytes.NewReader(data)
	dec := gob.NewDecoder(buf)

	// Initialize repository if needed
	if s.repo == nil {
		s.repo = repository.New()
	}

	// Decode the repository
	if err := dec.Decode(s.repo); err != nil {
		return err
	}

	// Re-initialize store accessors after decode
	s.Deployments = NewDeployments(s)
	s.Environments = NewEnvironments(s)
	s.Resources = NewResources(s)
	s.Policies = NewPolicies(s)
	s.ReleaseTargets = NewReleaseTargets(s)
	s.DeploymentVersions = NewDeploymentVersions(s)
	s.Systems = NewSystems(s)
	s.DeploymentVariables = NewDeploymentVariables(s)
	s.Releases = NewReleases(s)
	s.Jobs = NewJobs(s)
	s.JobAgents = NewJobAgents(s)

	// Reinitialize materialized views for environments and deployments
	s.Environments.ReinitializeMaterializedViews()
	s.Deployments.ReinitializeMaterializedViews()

	return nil
}
