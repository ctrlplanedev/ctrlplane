package repository

import (
	"fmt"
	"workspace-engine/pkg/cmap"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/persistence"
	"workspace-engine/pkg/workspace/store/repository/indexstore"

	"github.com/hashicorp/go-memdb"
)

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

func New(wsId string) *InMemoryStore {
	router := persistence.NewRepositoryRouter()
	memdb, err := indexstore.NewDB()
	if err != nil {
		panic(err)
	}

	return &InMemoryStore{
		router: router,
		db:     memdb,

		JobVerifications:         createTypedStore[*oapi.JobVerification](router, "job_verification"),
		Resources:                createTypedStore[*oapi.Resource](router, "resource"),
		ResourceProviders:        createTypedStore[*oapi.ResourceProvider](router, "resource_provider"),
		ResourceVariables:        createTypedStore[*oapi.ResourceVariable](router, "resource_variable"),
		Deployments:              createTypedStore[*oapi.Deployment](router, "deployment"),
		DeploymentVersions:       createTypedStore[*oapi.DeploymentVersion](router, "deployment_version"),
		DeploymentVariables:      createTypedStore[*oapi.DeploymentVariable](router, "deployment_variable"),
		DeploymentVariableValues: createTypedStore[*oapi.DeploymentVariableValue](router, "deployment_variable_value"),
		Environments:             createTypedStore[*oapi.Environment](router, "environment"),
		Policies:                 createTypedStore[*oapi.Policy](router, "policy"),
		PolicySkips:              createTypedStore[*oapi.PolicySkip](router, "policy_skip"),
		Systems:                  createTypedStore[*oapi.System](router, "system"),
		Releases:                 createMemDBStore[*oapi.Release](router, "release", memdb),
		Jobs:                     createMemDBStore[*oapi.Job](router, "job", memdb),
		JobAgents:                createTypedStore[*oapi.JobAgent](router, "job_agent"),
		UserApprovalRecords:      createTypedStore[*oapi.UserApprovalRecord](router, "user_approval_record"),
		RelationshipRules:        createTypedStore[*oapi.RelationshipRule](router, "relationship_rule"),
		GithubEntities:           createTypedStore[*oapi.GithubEntity](router, "github_entity"),
		WorkflowTemplates:        createTypedStore[*oapi.WorkflowTemplate](router, "workflow_template"),
		WorkflowTaskTemplates:    createTypedStore[*oapi.WorkflowTaskTemplate](router, "workflow_task_template"),
		Workflows:                createTypedStore[*oapi.Workflow](router, "workflow"),
		WorkflowTasks:            createTypedStore[*oapi.WorkflowTask](router, "workflow_task"),
	}
}

// InMemoryStore provides type-safe access to workspace entities stored in memory.
// It exposes typed concurrent maps for direct access while maintaining a router
// for receiving generic persistence updates from Kafka/Pebble.
type InMemoryStore struct {
	router *persistence.RepositoryRouter
	db     *memdb.MemDB

	Resources         cmap.ConcurrentMap[string, *oapi.Resource]
	ResourceVariables cmap.ConcurrentMap[string, *oapi.ResourceVariable]
	ResourceProviders cmap.ConcurrentMap[string, *oapi.ResourceProvider]

	Deployments              cmap.ConcurrentMap[string, *oapi.Deployment]
	DeploymentVariables      cmap.ConcurrentMap[string, *oapi.DeploymentVariable]
	DeploymentVersions       cmap.ConcurrentMap[string, *oapi.DeploymentVersion]
	DeploymentVariableValues cmap.ConcurrentMap[string, *oapi.DeploymentVariableValue]

	Environments     cmap.ConcurrentMap[string, *oapi.Environment]
	Policies         cmap.ConcurrentMap[string, *oapi.Policy]
	PolicySkips      cmap.ConcurrentMap[string, *oapi.PolicySkip]
	Systems          cmap.ConcurrentMap[string, *oapi.System]
	Releases         *indexstore.Store[*oapi.Release]
	JobVerifications cmap.ConcurrentMap[string, *oapi.JobVerification]

	Jobs      *indexstore.Store[*oapi.Job]
	JobAgents cmap.ConcurrentMap[string, *oapi.JobAgent]

	GithubEntities      cmap.ConcurrentMap[string, *oapi.GithubEntity]
	UserApprovalRecords cmap.ConcurrentMap[string, *oapi.UserApprovalRecord]
	RelationshipRules   cmap.ConcurrentMap[string, *oapi.RelationshipRule]

	WorkflowTemplates     cmap.ConcurrentMap[string, *oapi.WorkflowTemplate]
	WorkflowTaskTemplates cmap.ConcurrentMap[string, *oapi.WorkflowTaskTemplate]
	Workflows             cmap.ConcurrentMap[string, *oapi.Workflow]
	WorkflowTasks         cmap.ConcurrentMap[string, *oapi.WorkflowTask]
}

func (s *InMemoryStore) Router() *persistence.RepositoryRouter {
	return s.router
}

func (s *InMemoryStore) DB() *memdb.MemDB {
	return s.db
}
