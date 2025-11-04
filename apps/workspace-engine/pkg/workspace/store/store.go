package store

import (
	"context"
	"workspace-engine/pkg/persistence"
	"workspace-engine/pkg/statechange"
	"workspace-engine/pkg/workspace/store/repository"

	"github.com/charmbracelet/log"
)

func New(changeset *statechange.ChangeSet[any]) *Store {
	repo := repository.New()
	store := &Store{repo: repo, changeset: changeset}

	store.Deployments = NewDeployments(store)
	store.Environments = NewEnvironments(store)
	store.Resources = NewResources(store)
	store.Policies = NewPolicies(store)
	store.ReleaseTargets = NewReleaseTargets(store)
	store.DeploymentVersions = NewDeploymentVersions(store)
	store.DeploymentVariableValues = NewDeploymentVariableValues(store)
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
	repo      *repository.InMemoryStore
	changeset *statechange.ChangeSet[any]

	Policies                 *Policies
	Resources                *Resources
	ResourceProviders        *ResourceProviders
	ResourceVariables        *ResourceVariables
	Deployments              *Deployments
	DeploymentVersions       *DeploymentVersions
	DeploymentVariables      *DeploymentVariables
	DeploymentVariableValues *DeploymentVariableValues
	Environments             *Environments
	ReleaseTargets           *ReleaseTargets
	Systems                  *Systems
	Releases                 *Releases
	Jobs                     *Jobs
	JobAgents                *JobAgents
	UserApprovalRecords      *UserApprovalRecords
	Relationships            *RelationshipRules
	Variables                *Variables
	GithubEntities           *GithubEntities
}

func (s *Store) Repo() *repository.InMemoryStore {
	return s.repo
}

func (s *Store) Restore(ctx context.Context, changes persistence.Changes, setStatus func(status string)) error {
	err := s.repo.Router().Apply(ctx, changes)
	if err != nil {
		return err
	}

	// Reinitialize all materialized views after restore
	s.Systems.ReinitializeMaterializedViews()
	s.Environments.ReinitializeMaterializedViews()
	s.Deployments.ReinitializeMaterializedViews()

	if setStatus != nil {
		setStatus("Reinitializing materialized views")
	}
	if err := s.ReleaseTargets.Recompute(ctx); err != nil {
		log.Error("Failed to recompute release targets", "error", err)
		return err
	}

	if setStatus != nil {
		setStatus("Building relationships graph")
	}
	if err := s.Relationships.buildGraph(ctx, setStatus); err != nil {
		log.Error("Failed to build relationships graph", "error", err)
		return err
	}

	return nil
}
