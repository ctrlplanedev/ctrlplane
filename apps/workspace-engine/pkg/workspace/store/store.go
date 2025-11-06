package store

import (
	"context"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/persistence"
	"workspace-engine/pkg/selector"
	"workspace-engine/pkg/statechange"
	"workspace-engine/pkg/workspace/store/repository"
)

func New(wsId string, changeset *statechange.ChangeSet[any]) *Store {
	repo := repository.New(wsId)
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

	// Group deployments by SystemId for O(1) lookup
	deploymentsBySystem := make(map[string][]*oapi.Deployment)
	for _, deployment := range s.Deployments.Items() {
		deploymentsBySystem[deployment.SystemId] = append(deploymentsBySystem[deployment.SystemId], deployment)
	}

	// Iterate environments, then matching deployments, then resources
	for _, environment := range s.Environments.Items() {
		matchingDeployments := deploymentsBySystem[environment.SystemId]
		if len(matchingDeployments) == 0 {
			continue
		}

		// Check environment selector once per resource
		for _, resource := range s.Resources.Items() {
			isInEnv, err := selector.Match(ctx, environment.ResourceSelector, resource)
			if err != nil || !isInEnv {
				continue
			}

			// Only check deployment selectors for matching deployments
			for _, deployment := range matchingDeployments {
				isInDeployment, err := selector.Match(ctx, deployment.ResourceSelector, resource)
				if err != nil || !isInDeployment {
					continue
				}

				s.ReleaseTargets.Upsert(ctx, &oapi.ReleaseTarget{
					EnvironmentId: environment.Id,
					DeploymentId:  deployment.Id,
					ResourceId:    resource.Id,
				})
			}
		}
	}

	return nil
}
