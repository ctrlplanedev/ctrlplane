package repository

import (
	"workspace-engine/pkg/cmap"
	"workspace-engine/pkg/memsql"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/persistence"
)

type Map[T any] map[string]T

func (m Map[T]) Get(key string) (T, bool) {
	val, ok := m[key]
	return val, ok
}

func (m Map[T]) Set(key string, val T) {
	m[key] = val
}

func (m Map[T]) Remove(key string) {
	delete(m, key)
}

// createTypedStore creates an in-memory store and registers it with the persistence router.
// Returns the store for direct type-safe access while enabling generic persistence updates.
func createTypedStore[E any](router *persistence.RepositoryRouter, entityType string) cmap.ConcurrentMap[string, E] {
	store := cmap.New[E]()
	router.Register(entityType, &TypedStoreAdapter[E]{store: &store})
	return store
}

func createMemSQLStore[T any](router *persistence.RepositoryRouter, entityType string, tableBuilder *memsql.TableBuilder) *memsql.MemSQL[T] {
	store := memsql.NewMemSQL[T](tableBuilder)
	router.Register(entityType, &MemSQLAdapter[T]{store: store})
	return store
}

func createMapStore[T any](router *persistence.RepositoryRouter, entityType string) Map[T] {
	store := Map[T]{}
	router.Register(entityType, &MapStoreAdapter[T]{store: store})
	return store
}

func New(wsId string) *InMemoryStore {
	router := persistence.NewRepositoryRouter()

	return &InMemoryStore{
		router:                   router,
		Resources:                createMapStore[*oapi.Resource](router, "resource"),
		ResourceProviders:        createMapStore[*oapi.ResourceProvider](router, "resource_provider"),
		ResourceVariables:        createMapStore[*oapi.ResourceVariable](router, "resource_variable"),
		Deployments:              createMapStore[*oapi.Deployment](router, "deployment"),
		DeploymentVersions:       createMapStore[*oapi.DeploymentVersion](router, "deployment_version"),
		DeploymentVariables:      createMapStore[*oapi.DeploymentVariable](router, "deployment_variable"),
		DeploymentVariableValues: createMapStore[*oapi.DeploymentVariableValue](router, "deployment_variable_value"),
		Environments:             createMapStore[*oapi.Environment](router, "environment"),
		Policies:                 createMapStore[*oapi.Policy](router, "policy"),
		Systems:                  createMapStore[*oapi.System](router, "system"),
		Releases:                 createMapStore[*oapi.Release](router, "release"),
		Jobs:                     createMapStore[*oapi.Job](router, "job"),
		JobAgents:                createMapStore[*oapi.JobAgent](router, "job_agent"),
		UserApprovalRecords:      createMapStore[*oapi.UserApprovalRecord](router, "user_approval_record"),
		RelationshipRules:        createMapStore[*oapi.RelationshipRule](router, "relationship_rule"),
		GithubEntities:           createMapStore[*oapi.GithubEntity](router, "github_entity"),
	}
}

// InMemoryStore provides type-safe access to workspace entities stored in memory.
// It exposes typed concurrent maps for direct access while maintaining a router
// for receiving generic persistence updates from Kafka/Pebble.
type InMemoryStore struct {
	router *persistence.RepositoryRouter

	Resources         Map[*oapi.Resource]
	ResourceVariables Map[*oapi.ResourceVariable]
	ResourceProviders Map[*oapi.ResourceProvider]

	Deployments              Map[*oapi.Deployment]
	DeploymentVariables      Map[*oapi.DeploymentVariable]
	DeploymentVersions       Map[*oapi.DeploymentVersion]
	DeploymentVariableValues Map[*oapi.DeploymentVariableValue]

	Environments Map[*oapi.Environment]
	Policies     Map[*oapi.Policy]
	Systems      Map[*oapi.System]
	Releases     Map[*oapi.Release]

	Jobs      Map[*oapi.Job]
	JobAgents Map[*oapi.JobAgent]

	UserApprovalRecords Map[*oapi.UserApprovalRecord]
	RelationshipRules   Map[*oapi.RelationshipRule]

	GithubEntities Map[*oapi.GithubEntity]
}

func (s *InMemoryStore) Router() *persistence.RepositoryRouter {
	return s.router
}
