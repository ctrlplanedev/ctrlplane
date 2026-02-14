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

// WithDBDeployments replaces the default in-memory DeploymentRepo
// with a DB-backed implementation.
func WithDBDeployments(ctx context.Context) StoreOption {
	return func(s *Store) {
		dbRepo := dbrepo.NewDBRepo(ctx, s.id)
		s.Deployments.SetRepo(dbRepo.Deployments())
	}
}

// WithDBEnvironments replaces the default in-memory EnvironmentRepo
// with a DB-backed implementation.
func WithDBEnvironments(ctx context.Context) StoreOption {
	return func(s *Store) {
		dbRepo := dbrepo.NewDBRepo(ctx, s.id)
		s.Environments.SetRepo(dbRepo.Environments())
	}
}

// WithDBSystems replaces the default in-memory SystemRepo
// with a DB-backed implementation.
func WithDBSystems(ctx context.Context) StoreOption {
	return func(s *Store) {
		dbRepo := dbrepo.NewDBRepo(ctx, s.id)
		s.Systems.SetRepo(dbRepo.Systems())
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
	store.Workflows = NewWorkflows(store)
	store.WorkflowJobTemplates = NewWorkflowJobTemplates(store)
	store.WorkflowRuns = NewWorkflowRuns(store)
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
	Workflows                *Workflows
	WorkflowJobTemplates     *WorkflowJobTemplates
	WorkflowRuns             *WorkflowRuns
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

	// Migrate legacy changelog entities into the active repos.
	// After Router().Apply(), the in-memory repo may contain entities
	// loaded from changelog_entry records. When the DB backend is
	// active, sync them so they are available through the DB-backed repos.
	// The DB repo Set() methods handle creating join table entries
	// (system_deployment, system_environment) from the oapi SystemIds field.
	if setStatus != nil {
		setStatus("Migrating legacy systems")
	}
	for _, sys := range s.repo.Systems().Items() {
		log.Info("Migrating legacy system", "system_id", sys.Id, "name", sys.Name)
		if err := s.Systems.repo.Set(sys); err != nil {
			log.Warn("Failed to migrate legacy system",
				"system_id", sys.Id, "name", sys.Name, "error", err)
		}
	}

	if setStatus != nil {
		setStatus("Migrating legacy deployments")
	}
	for _, d := range s.repo.Deployments().Items() {
		log.Info("Migrating legacy deployment", "deployment_id", d.Id, "name", d.Name)
		if err := s.Deployments.repo.Set(d); err != nil {
			log.Warn("Failed to migrate legacy deployment",
				"deployment_id", d.Id, "name", d.Name, "error", err)
		}
	}

	if setStatus != nil {
		setStatus("Migrating legacy environments")
	}
	for _, env := range s.repo.Environments().Items() {
		log.Info("Migrating legacy environment", "environment_id", env.Id, "name", env.Name)
		if err := s.Environments.repo.Set(env); err != nil {
			log.Warn("Failed to migrate legacy environment",
				"environment_id", env.Id, "name", env.Name, "error", err)
		}
	}

	if setStatus != nil {
		setStatus("Migrating legacy deployment versions")
	}
	for _, v := range s.repo.DeploymentVersions().Items() {
		log.Info("Migrating legacy deployment version", "version_id", v.Id, "name", v.Name)
		if err := s.DeploymentVersions.repo.Set(v); err != nil {
			log.Warn("Failed to migrate legacy deployment version",
				"version_id", v.Id, "name", v.Name, "error", err)
		}
	}

	if setStatus != nil {
		setStatus("Computing release targets")
	}

	// Group deployments by SystemId for O(1) lookup
	deploymentsBySystem := make(map[string][]*oapi.Deployment)
	for _, deployment := range s.Deployments.Items() {
		for _, sid := range deployment.SystemIds {
			deploymentsBySystem[sid] = append(deploymentsBySystem[sid], deployment)
		}
	}

	// Iterate environments, then matching deployments, then resources.
	// Deduplicate across systems so the same (deployment, environment, resource)
	// tuple is not added twice.
	seenRT := make(map[string]struct{})
	for _, environment := range s.Environments.Items() {
		// Collect all deployments from systems this environment belongs to.
		matchingDeployments := make(map[string]*oapi.Deployment)
		var systemName string
		for _, sid := range environment.SystemIds {
			for _, d := range deploymentsBySystem[sid] {
				matchingDeployments[d.Id] = d
			}
			if systemName == "" {
				if sys, ok := s.Systems.Get(sid); ok {
					systemName = sys.Name
				}
			}
		}
		if len(matchingDeployments) == 0 {
			continue
		}

		if setStatus != nil {
			setStatus(
				"Computing release targets for environment \"" + environment.Name + "\" in system \"" + systemName + "\".",
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

				rt := &oapi.ReleaseTarget{
					EnvironmentId: environment.Id,
					DeploymentId:  deployment.Id,
					ResourceId:    resource.Id,
				}
				if _, ok := seenRT[rt.Key()]; !ok {
					seenRT[rt.Key()] = struct{}{}
					_ = s.ReleaseTargets.Upsert(ctx, rt)
				}
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
