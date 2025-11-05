package relationgraph

import (
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/relationships"
)

// EntityStore manages all entity data for relationship computation
// It uses the EntityProvider interface to avoid circular dependencies
type EntityStore struct {
	provider EntityProvider
}

// NewEntityStore creates a new entity store that reads from an EntityProvider
func NewEntityStore(provider EntityProvider) *EntityStore {
	return &EntityStore{
		provider: provider,
	}
}

// GetAllEntities returns all entities from all stores as RelatableEntities
func (s *EntityStore) GetAllEntities() []*oapi.RelatableEntity {
	resources := s.provider.GetResources()
	deployments := s.provider.GetDeployments()
	environments := s.provider.GetEnvironments()

	totalSize := len(resources) + len(deployments) + len(environments)
	entities := make([]*oapi.RelatableEntity, 0, totalSize)

	for _, res := range resources {
		entities = append(entities, relationships.NewResourceEntity(res))
	}
	for _, dep := range deployments {
		entities = append(entities, relationships.NewDeploymentEntity(dep))
	}
	for _, env := range environments {
		entities = append(entities, relationships.NewEnvironmentEntity(env))
	}

	return entities
}

// GetRules returns all relationship rules
func (s *EntityStore) GetRules() map[string]*oapi.RelationshipRule {
	return s.provider.GetRelationshipRules()
}

// GetRule returns a specific rule by reference
func (s *EntityStore) GetRule(reference string) (*oapi.RelationshipRule, bool) {
	return s.provider.GetRelationshipRule(reference)
}

// EntityCount returns the total number of entities
func (s *EntityStore) EntityCount() int {
	resources := s.provider.GetResources()
	deployments := s.provider.GetDeployments()
	environments := s.provider.GetEnvironments()
	return len(resources) + len(deployments) + len(environments)
}

// RuleCount returns the total number of rules
func (s *EntityStore) RuleCount() int {
	return len(s.provider.GetRelationshipRules())
}
