package store

import (
	"context"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/persistence"
	"workspace-engine/pkg/selector"
	"workspace-engine/pkg/statechange"
	dbrepo "workspace-engine/pkg/workspace/store/repository/db"
	"workspace-engine/pkg/workspace/store/repository/memory"

	"github.com/charmbracelet/log"
	"go.opentelemetry.io/otel/attribute"
)

// StoreOption configures optional Store behavior.
type StoreOption func(*Store)

// WithDBDeploymentVersions replaces the default in-memory DeploymentVersionRepo
// with a DB-backed implementation. The provided context is used for DB operations.
func WithDBDeploymentVersions(ctx context.Context) StoreOption {
	return func(s *Store) {
		dbRepo := dbrepo.NewDBRepo(ctx, s.id)
		s.DeploymentVersions.SetRepo(dbRepo.DeploymentVersions())
	}
}

func New(wsId string, changeset *statechange.ChangeSet[any], opts ...StoreOption) *Store {
	repo := memory.New(wsId)
	store := &Store{id: wsId, repo: repo, changeset: changeset}

	store.Deployments = NewDeployments(store)
	store.Environments = NewEnvironments(store)
	store.Resources = NewResources(store)
	store.Policies = NewPolicies(store)
	store.PolicySkips = NewPolicySkips(store)
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
	store.Relations = NewRelations(store)
	store.RelationshipIndexes = NewRelationshipIndexes(store)
	store.JobVerifications = NewJobVerifications(store)
	store.WorkflowTemplates = NewWorkflowTemplates(store)
	store.WorkflowJobTemplates = NewWorkflowJobTemplates(store)
	store.Workflows = NewWorkflows(store)
	store.WorkflowJobs = NewWorkflowJobs(store)

	for _, opt := range opts {
		opt(store)
	}

	return store
}

type Store struct {
	id        string
	repo      *memory.InMemory
	changeset *statechange.ChangeSet[any]

	Policies                 *Policies
	PolicySkips              *PolicySkips
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
	Relations                *Relations
	RelationshipIndexes      *RelationshipIndexes
	JobVerifications         *JobVerifications
	WorkflowTemplates        *WorkflowTemplates
	WorkflowJobTemplates     *WorkflowJobTemplates
	Workflows                *Workflows
	WorkflowJobs             *WorkflowJobs
}

func (s *Store) ID() string {
	return s.id
}

func (s *Store) Repo() *memory.InMemory {
	return s.repo
}

func (s *Store) Restore(ctx context.Context, changes persistence.Changes, setStatus func(status string)) error {
	ctx, span := tracer.Start(ctx, "Store.Restore")
	defer span.End()

	span.SetAttributes(attribute.Int("changes.count", len(changes)))

	err := s.repo.Router().Apply(ctx, changes)
	if err != nil {
		return err
	}

	// Migrate legacy changelog deployment versions into the active repo.
	// After Router().Apply(), the in-memory repo may contain deployment
	// versions loaded from changelog_entry records. When the DB backend is
	// active, sync them so they are available through the DB-backed repo.
	if setStatus != nil {
		setStatus("Migrating legacy deployment versions")
	}
	for _, v := range s.repo.DeploymentVersions().Items() {
		if err := s.DeploymentVersions.repo.Set(v); err != nil {
			log.Warn("Failed to migrate legacy deployment version",
				"version_id", v.Id, "error", err)
		}
	}

	if setStatus != nil {
		setStatus("Computing release targets")
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

		system, ok := s.Systems.Get(environment.SystemId)
		if !ok {
			continue
		}

		if setStatus != nil {
			setStatus(
				"Computing release targets for environment \"" + environment.Name + "\" in system \"" + system.Name + "\".",
			)
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

				_ = s.ReleaseTargets.Upsert(ctx, &oapi.ReleaseTarget{
					EnvironmentId: environment.Id,
					DeploymentId:  deployment.Id,
					ResourceId:    resource.Id,
				})
			}
		}
	}

	_, span = relationshipIndexesTracer.Start(ctx, "Store.Restore.RelationshipIndexes")
	for _, rule := range s.Relationships.Items() {
		if setStatus != nil {
			setStatus("Computing relationships for rule: " + rule.Name)
		}
		s.RelationshipIndexes.AddRule(ctx, rule)
	}
	s.RelationshipIndexes.Recompute(ctx)
	span.End()

	s.changeset.Clear()

	return nil
}
