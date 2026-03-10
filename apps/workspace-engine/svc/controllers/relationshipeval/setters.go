package relationshipeval

import (
	"context"

	"github.com/google/uuid"
)

// ComputedRelationship is a single directional edge produced by the controller.
type ComputedRelationship struct {
	RuleID         uuid.UUID
	FromEntityType string
	FromEntityID   uuid.UUID
	ToEntityType   string
	ToEntityID     uuid.UUID
}

type Setter interface {
	// SetComputedRelationships replaces all stored relationships for an entity.
	// It deletes stale rows and upserts the current set atomically.
	SetComputedRelationships(
		ctx context.Context,
		entityType string,
		entityID uuid.UUID,
		relationships []ComputedRelationship,
	) error
}
