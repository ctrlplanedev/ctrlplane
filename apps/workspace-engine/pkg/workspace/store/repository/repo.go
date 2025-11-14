package repository

import (
	"workspace-engine/pkg/cmap"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/persistence"
)

// createTypedStore creates an in-memory store and registers it with the persistence router.
// Returns the store for direct type-safe access while enabling generic persistence updates.
func createTypedStore[E any](router *persistence.RepositoryRouter, entityType string) cmap.ConcurrentMap[string, E] {
	store := cmap.New[E]()
	router.Register(entityType, &TypedStoreAdapter[E]{store: &store})
	return store
}

// func createMemSQLStore[T any](router *persistence.RepositoryRouter, entityType string, tableBuilder *memsql.TableBuilder) *memsql.MemSQL[T] {
// 	store := memsql.NewMemSQL[T](tableBuilder)
// 	router.Register(entityType, &MemSQLAdapter[T]{store: store})
// 	return store
// }

// func createMapStore[T any](router *persistence.RepositoryRouter, entityType string) Map[T] {
// 	store := Map[T]{}
// 	router.Register(entityType, &MapStoreAdapter[T]{store: store})
// 	return store
// }

func New(wsId string) *InMemoryStore {
	router := persistence.NewRepositoryRouter()

	return &InMemoryStore{
		router:                   router,
		ReleaseVerifications:     createTypedStore[*oapi.ReleaseVerification](router, "release_verification"),
		Resources:                createTypedStore[*oapi.Resource](router, "resource"),
		ResourceProviders:        createTypedStore[*oapi.ResourceProvider](router, "resource_provider"),
		ResourceVariables:        createTypedStore[*oapi.ResourceVariable](router, "resource_variable"),
		Deployments:              createTypedStore[*oapi.Deployment](router, "deployment"),
		DeploymentVersions:       createTypedStore[*oapi.DeploymentVersion](router, "deployment_version"),
		DeploymentVariables:      createTypedStore[*oapi.DeploymentVariable](router, "deployment_variable"),
		DeploymentVariableValues: createTypedStore[*oapi.DeploymentVariableValue](router, "deployment_variable_value"),
		Environments:             createTypedStore[*oapi.Environment](router, "environment"),
		Policies:                 createTypedStore[*oapi.Policy](router, "policy"),
		PolicyBypasses:           createTypedStore[*oapi.PolicyBypass](router, "policy_bypass"),
		Systems:                  createTypedStore[*oapi.System](router, "system"),
		Releases:                 createTypedStore[*oapi.Release](router, "release"),
		Jobs:                     createTypedStore[*oapi.Job](router, "job"),
		JobAgents:                createTypedStore[*oapi.JobAgent](router, "job_agent"),
		UserApprovalRecords:      createTypedStore[*oapi.UserApprovalRecord](router, "user_approval_record"),
		RelationshipRules:        createTypedStore[*oapi.RelationshipRule](router, "relationship_rule"),
		GithubEntities:           createTypedStore[*oapi.GithubEntity](router, "github_entity"),
	}
}

// InMemoryStore provides type-safe access to workspace entities stored in memory.
// It exposes typed concurrent maps for direct access while maintaining a router
// for receiving generic persistence updates from Kafka/Pebble.
type InMemoryStore struct {
	router *persistence.RepositoryRouter

	Resources         cmap.ConcurrentMap[string, *oapi.Resource]
	ResourceVariables cmap.ConcurrentMap[string, *oapi.ResourceVariable]
	ResourceProviders cmap.ConcurrentMap[string, *oapi.ResourceProvider]

	Deployments              cmap.ConcurrentMap[string, *oapi.Deployment]
	DeploymentVariables      cmap.ConcurrentMap[string, *oapi.DeploymentVariable]
	DeploymentVersions       cmap.ConcurrentMap[string, *oapi.DeploymentVersion]
	DeploymentVariableValues cmap.ConcurrentMap[string, *oapi.DeploymentVariableValue]

	Environments         cmap.ConcurrentMap[string, *oapi.Environment]
	Policies             cmap.ConcurrentMap[string, *oapi.Policy]
	PolicyBypasses       cmap.ConcurrentMap[string, *oapi.PolicyBypass]
	Systems              cmap.ConcurrentMap[string, *oapi.System]
	Releases             cmap.ConcurrentMap[string, *oapi.Release]
	ReleaseVerifications cmap.ConcurrentMap[string, *oapi.ReleaseVerification]

	Jobs      cmap.ConcurrentMap[string, *oapi.Job]
	JobAgents cmap.ConcurrentMap[string, *oapi.JobAgent]

	GithubEntities      cmap.ConcurrentMap[string, *oapi.GithubEntity]
	UserApprovalRecords cmap.ConcurrentMap[string, *oapi.UserApprovalRecord]
	RelationshipRules   cmap.ConcurrentMap[string, *oapi.RelationshipRule]
}

func (s *InMemoryStore) Router() *persistence.RepositoryRouter {
	return s.router
}
