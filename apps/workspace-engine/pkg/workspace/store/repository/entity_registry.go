package repository

import (
	"sync"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/persistence"
)

var (
	globalRegistry *persistence.JSONEntityRegistry
	once           sync.Once
)

// initGlobalRegistry initializes the global JSONEntityRegistry exactly once.
// This is used by PebbleStore and other persistence layers for deserialization.
func initGlobalRegistry() {
	once.Do(func() {
		globalRegistry = persistence.NewJSONEntityRegistry()

		// Register all entity types with their factory functions
		globalRegistry.Register("resource", func() persistence.Entity { return &oapi.Resource{} })
		globalRegistry.Register("resource_provider", func() persistence.Entity { return &oapi.ResourceProvider{} })
		globalRegistry.Register("resource_variable", func() persistence.Entity { return &oapi.ResourceVariable{} })
		globalRegistry.Register("deployment", func() persistence.Entity { return &oapi.Deployment{} })
		globalRegistry.Register("deployment_version", func() persistence.Entity { return &oapi.DeploymentVersion{} })
		globalRegistry.Register("deployment_variable", func() persistence.Entity { return &oapi.DeploymentVariable{} })
		globalRegistry.Register("environment", func() persistence.Entity { return &oapi.Environment{} })
		globalRegistry.Register("policy", func() persistence.Entity { return &oapi.Policy{} })
		globalRegistry.Register("system", func() persistence.Entity { return &oapi.System{} })
		globalRegistry.Register("release", func() persistence.Entity { return &oapi.Release{} })
		globalRegistry.Register("job", func() persistence.Entity { return &oapi.Job{} })
		globalRegistry.Register("job_agent", func() persistence.Entity { return &oapi.JobAgent{} })
		globalRegistry.Register("user_approval_record", func() persistence.Entity { return &oapi.UserApprovalRecord{} })
		globalRegistry.Register("relationship_rule", func() persistence.Entity { return &oapi.RelationshipRule{} })
		globalRegistry.Register("github_entity", func() persistence.Entity { return &oapi.GithubEntity{} })
	})
}

// GlobalRegistry returns the shared JSONEntityRegistry for deserialization.
// This registry is shared across all workspaces and is safe to call concurrently.
func GlobalRegistry() *persistence.JSONEntityRegistry {
	initGlobalRegistry()
	return globalRegistry
}
