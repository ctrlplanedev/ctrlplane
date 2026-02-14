package memory

import (
	"fmt"
	"slices"
	"workspace-engine/pkg/cmap"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/persistence"
	"workspace-engine/pkg/workspace/store/repository"
	"workspace-engine/pkg/workspace/store/repository/memory/indexstore"

	"github.com/hashicorp/go-memdb"
)

var _ repository.Repo = &InMemory{}

// createTypedStore creates an in-memory store and registers it with the persistence router.
// Returns the store for direct type-safe access while enabling generic persistence updates.
func createTypedStore[E any](router *persistence.RepositoryRouter, entityType string) cmap.ConcurrentMap[string, E] {
	store := cmap.New[E]()
	router.Register(entityType, &TypedStoreAdapter[E]{store: &store})
	return store
}

func createMemDBStore[E persistence.Entity](router *persistence.RepositoryRouter, entityType string, db *memdb.MemDB) *indexstore.Store[E] {
	adapter := indexstore.NewMemDBAdapter[E](db, entityType)
	router.Register(entityType, adapter)
	fn := func(entity E) string {
		keyer, ok := any(entity).(persistence.Entity)
		if !ok {
			panic(fmt.Errorf("entity does not implement persistence.Entity interface"))
		}
		_, key := keyer.CompactionKey()
		return key
	}
	return indexstore.NewStore(db, entityType, fn)
}

func New(wsId string) *InMemory {
	router := persistence.NewRepositoryRouter()
	memdb, err := indexstore.NewDB()
	if err != nil {
		panic(err)
	}

	return &InMemory{
		router: router,
		db:     memdb,

		JobVerifications:         createTypedStore[*oapi.JobVerification](router, "job_verification"),
		Resources:                createTypedStore[*oapi.Resource](router, "resource"),
		ResourceProviders:        createTypedStore[*oapi.ResourceProvider](router, "resource_provider"),
		ResourceVariables:        createTypedStore[*oapi.ResourceVariable](router, "resource_variable"),
		deployments:              createTypedStore[*oapi.Deployment](router, "deployment"),
		deploymentVersions:       createMemDBStore[*oapi.DeploymentVersion](router, "deployment_version", memdb),
		DeploymentVariables:      createTypedStore[*oapi.DeploymentVariable](router, "deployment_variable"),
		DeploymentVariableValues: createTypedStore[*oapi.DeploymentVariableValue](router, "deployment_variable_value"),
		environments:             createTypedStore[*oapi.Environment](router, "environment"),
		Policies:                 createTypedStore[*oapi.Policy](router, "policy"),
		PolicySkips:              createTypedStore[*oapi.PolicySkip](router, "policy_skip"),
		systems:                  createTypedStore[*oapi.System](router, "system"),
		Releases:                 createMemDBStore[*oapi.Release](router, "release", memdb),
		Jobs:                     createMemDBStore[*oapi.Job](router, "job", memdb),
		JobAgents:                createTypedStore[*oapi.JobAgent](router, "job_agent"),
		UserApprovalRecords:      createTypedStore[*oapi.UserApprovalRecord](router, "user_approval_record"),
		RelationshipRules:        createTypedStore[*oapi.RelationshipRule](router, "relationship_rule"),
		GithubEntities:           createTypedStore[*oapi.GithubEntity](router, "github_entity"),
		Workflows:                createTypedStore[*oapi.Workflow](router, "workflow"),
		WorkflowJobTemplates:     createTypedStore[*oapi.WorkflowJobTemplate](router, "workflow_job_template"),
		WorkflowRuns:             createTypedStore[*oapi.WorkflowRun](router, "workflow_run"),
		WorkflowJobs:             createTypedStore[*oapi.WorkflowJob](router, "workflow_job"),
	}
}

// InMemory provides type-safe access to workspace entities stored in memory.
// It exposes typed concurrent maps for direct access while maintaining a router
// for receiving generic persistence updates from Kafka/Pebble.
type InMemory struct {
	router *persistence.RepositoryRouter
	db     *memdb.MemDB

	Resources         cmap.ConcurrentMap[string, *oapi.Resource]
	ResourceVariables cmap.ConcurrentMap[string, *oapi.ResourceVariable]
	ResourceProviders cmap.ConcurrentMap[string, *oapi.ResourceProvider]

	deployments              cmap.ConcurrentMap[string, *oapi.Deployment]
	DeploymentVariables      cmap.ConcurrentMap[string, *oapi.DeploymentVariable]
	deploymentVersions       *indexstore.Store[*oapi.DeploymentVersion]
	DeploymentVariableValues cmap.ConcurrentMap[string, *oapi.DeploymentVariableValue]

	environments     cmap.ConcurrentMap[string, *oapi.Environment]
	Policies         cmap.ConcurrentMap[string, *oapi.Policy]
	PolicySkips      cmap.ConcurrentMap[string, *oapi.PolicySkip]
	systems          cmap.ConcurrentMap[string, *oapi.System]
	Releases         *indexstore.Store[*oapi.Release]
	JobVerifications cmap.ConcurrentMap[string, *oapi.JobVerification]

	Jobs      *indexstore.Store[*oapi.Job]
	JobAgents cmap.ConcurrentMap[string, *oapi.JobAgent]

	GithubEntities      cmap.ConcurrentMap[string, *oapi.GithubEntity]
	UserApprovalRecords cmap.ConcurrentMap[string, *oapi.UserApprovalRecord]
	RelationshipRules   cmap.ConcurrentMap[string, *oapi.RelationshipRule]

	Workflows            cmap.ConcurrentMap[string, *oapi.Workflow]
	WorkflowJobTemplates cmap.ConcurrentMap[string, *oapi.WorkflowJobTemplate]
	WorkflowRuns         cmap.ConcurrentMap[string, *oapi.WorkflowRun]
	WorkflowJobs         cmap.ConcurrentMap[string, *oapi.WorkflowJob]
}

// deploymentVersionRepoAdapter wraps an indexstore.Store to satisfy the
// explicit DeploymentVersionRepo interface.
type deploymentVersionRepoAdapter struct {
	*indexstore.Store[*oapi.DeploymentVersion]
}

func (a *deploymentVersionRepoAdapter) GetByDeploymentID(deploymentID string) ([]*oapi.DeploymentVersion, error) {
	return a.GetBy("deployment_id", deploymentID)
}

// DeploymentVersions implements repository.Repo.
func (s *InMemory) DeploymentVersions() repository.DeploymentVersionRepo {
	return &deploymentVersionRepoAdapter{s.deploymentVersions}
}

// cmapRepoAdapter wraps a cmap.ConcurrentMap to satisfy a basic entity repo interface.
type cmapRepoAdapter[E persistence.Entity] struct {
	store *cmap.ConcurrentMap[string, E]
}

func (a *cmapRepoAdapter[E]) Get(id string) (E, bool) {
	return a.store.Get(id)
}

func (a *cmapRepoAdapter[E]) Set(entity E) error {
	_, key := entity.CompactionKey()
	a.store.Set(key, entity)
	return nil
}

func (a *cmapRepoAdapter[E]) Remove(id string) error {
	a.store.Remove(id)
	return nil
}

func (a *cmapRepoAdapter[E]) Items() map[string]E {
	return a.store.Items()
}

// deploymentRepoAdapter wraps a cmap for deployments and adds GetBySystemID.
type deploymentRepoAdapter struct {
	cmapRepoAdapter[*oapi.Deployment]
}

func (a *deploymentRepoAdapter) GetBySystemID(systemID string) map[string]*oapi.Deployment {
	result := make(map[string]*oapi.Deployment)
	for id, d := range a.store.Items() {
		if slices.Contains(d.SystemIds, systemID) {
			result[id] = d
		}
	}
	return result
}

// Deployments implements repository.Repo.
func (s *InMemory) Deployments() repository.DeploymentRepo {
	return &deploymentRepoAdapter{cmapRepoAdapter[*oapi.Deployment]{store: &s.deployments}}
}

// environmentRepoAdapter wraps a cmap for environments and adds GetBySystemID.
type environmentRepoAdapter struct {
	cmapRepoAdapter[*oapi.Environment]
}

func (a *environmentRepoAdapter) GetBySystemID(systemID string) map[string]*oapi.Environment {
	result := make(map[string]*oapi.Environment)
	for id, e := range a.store.Items() {
		if slices.Contains(e.SystemIds, systemID) {
			result[id] = e
		}
	}
	return result
}

// Environments implements repository.Repo.
func (s *InMemory) Environments() repository.EnvironmentRepo {
	return &environmentRepoAdapter{cmapRepoAdapter[*oapi.Environment]{store: &s.environments}}
}

// Systems implements repository.Repo.
func (s *InMemory) Systems() repository.SystemRepo {
	return &cmapRepoAdapter[*oapi.System]{store: &s.systems}
}

func (s *InMemory) Router() *persistence.RepositoryRouter {
	return s.router
}

func (s *InMemory) DB() *memdb.MemDB {
	return s.db
}
