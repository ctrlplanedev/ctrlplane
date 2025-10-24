package relationships

import "workspace-engine/pkg/oapi"

// RelatedEntity represents an entity that is related to a resource via a relationship
type RelatedEntity[E any] struct {
	EntityType oapi.RelatableEntityType
	EntityID   string
	Entity     *oapi.RelatableEntity // Can be *oapi.Resource, *oapi.Deployment, *oapi.Environment, etc.
}

// ComputedRelationship represents a relationship instance and the entity it connects to
type ComputedRelationship[E any] struct {
	Relationship  *oapi.RelationshipRule
	Direction     oapi.RelationDirection // "from" or "to" - indicates if the entity is the source or target
	RelatedEntity *RelatedEntity[E]
}

// Relationship represents a single relationship between two entities
type Relationship struct {
	From *oapi.RelatableEntity // The source entity (can be *oapi.Resource, *oapi.Deployment, *oapi.Environment, etc.)
	To   *oapi.RelatableEntity // The target entity (can be *oapi.Resource, *oapi.Deployment, *oapi.Environment, etc.)
}

// RelationshipsResult represents the result of GetRelationships
type RelationshipsResult struct {
	RuleID           string
	RuleName         string
	RelationshipType string
	Relationships    []Relationship
}
