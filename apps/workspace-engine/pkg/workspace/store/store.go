package store

import (
	"bytes"
	"encoding/gob"
	"sync/atomic"
	"workspace-engine/pkg/workspace/store/repository"
)

var _ gob.GobEncoder = (*Store)(nil)
var _ gob.GobDecoder = (*Store)(nil)

func New(wsId string) *Store {
	repo := repository.New()
	store := &Store{repo: repo, workspaceID: wsId}
	store.isReplay.Store(false)

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
	store.UserApprovalRecords = NewUserApprovalRecords(store)
	store.Relationships = NewRelationshipRules(store)
	store.Variables = NewVariables(store)
	store.ResourceVariables = NewResourceVariables(store)
	store.ResourceProviders = NewResourceProviders(store)
	store.GithubEntities = NewGithubEntities(store)

	return store
}

type Store struct {
	repo        *repository.Repository
	workspaceID string

	Policies            *Policies
	Resources           *Resources
	ResourceProviders   *ResourceProviders
	ResourceVariables   *ResourceVariables
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
	Relationships       *RelationshipRules
	Variables           *Variables
	GithubEntities      *GithubEntities

	isReplay atomic.Bool
}

func (s *Store) IsReplay() bool {
	return s.isReplay.Load()
}

func (s *Store) SetIsReplay(isReplay bool) {
	s.isReplay.Store(isReplay)
}

func (s *Store) WorkspaceID() string {
	return s.workspaceID
}

func (s *Store) Repo() *repository.Repository {
	return s.repo
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
	s.ResourceVariables = NewResourceVariables(s)
	s.ResourceProviders = NewResourceProviders(s)
	s.Policies = NewPolicies(s)
	s.DeploymentVersions = NewDeploymentVersions(s)
	s.Systems = NewSystems(s)
	s.DeploymentVariables = NewDeploymentVariables(s)
	s.Releases = NewReleases(s)
	s.Jobs = NewJobs(s)
	s.JobAgents = NewJobAgents(s)
	s.UserApprovalRecords = NewUserApprovalRecords(s)
	s.Relationships = NewRelationshipRules(s)
	s.Variables = NewVariables(s)
	s.GithubEntities = NewGithubEntities(s)

	// Reinitialize materialized views for environments and deployments
	s.Environments.ReinitializeMaterializedViews()
	s.Deployments.ReinitializeMaterializedViews()

	// Initialize ReleaseTargets after materialized views are ready
	// This is important because ReleaseTargets.computeTargets() depends on
	// deployments.Resources() which requires the materialized views to exist
	s.ReleaseTargets = NewReleaseTargets(s)

	return nil
}
