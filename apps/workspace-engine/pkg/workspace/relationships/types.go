package relationships

import "workspace-engine/pkg/pb"

// RelatedEntity represents an entity that is related to a resource via a relationship
type RelatedEntity[E any] struct {
	EntityType string
	EntityID   string
	Entity     E // Can be *pb.Resource, *pb.Deployment, *pb.Environment, etc.
}

type Direction string

const (
	DirectionFrom Direction = "from"
	DirectionTo   Direction = "to"
)

// ComputedRelationship represents a relationship instance and the entity it connects to
type ComputedRelationship[E any] struct {
	Relationship  *pb.RelationshipRule
	Direction     Direction // "from" or "to" - indicates if the entity is the source or target
	RelatedEntity *RelatedEntity[E]
}
