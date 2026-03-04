package relationshipeval

import (
	"context"

	"github.com/google/uuid"
)

// EntityInfo holds the entity data needed for relationship evaluation.
type EntityInfo struct {
	ID          uuid.UUID
	WorkspaceID uuid.UUID
	EntityType  string // "resource", "deployment", or "environment"
	// Raw is passed into the CEL evaluation context as "from" or "to".
	Raw map[string]any
}

// RuleInfo holds a relationship rule and its compiled CEL expression.
type RuleInfo struct {
	ID        uuid.UUID
	Reference string
	// Cel is the full CEL expression combining type filters, selector
	// filters, and the matcher logic.
	Cel      string
	FromType string
	ToType   string
}

// ExistingRelationship represents a currently stored relationship for an entity.
type ExistingRelationship struct {
	RuleID       uuid.UUID
	FromEntityID uuid.UUID
	ToEntityID   uuid.UUID
}

type Getter interface {
	// GetEntityInfo loads a single entity by type and ID.
	GetEntityInfo(ctx context.Context, entityType string, entityID uuid.UUID) (*EntityInfo, error)

	// GetRulesForWorkspace returns all relationship rules for a workspace.
	GetRulesForWorkspace(ctx context.Context, workspaceID uuid.UUID) ([]RuleInfo, error)

	// StreamCandidateEntities sends batches of entities matching the given type
	// for a workspace. The caller creates the channel and controls its buffer size.
	StreamCandidateEntities(ctx context.Context, workspaceID uuid.UUID, entityType string, batchSize int, batches chan<- []EntityInfo) error

	// GetExistingRelationships returns all currently stored relationships
	// where the given entity is either the "from" or "to" side.
	GetExistingRelationships(ctx context.Context, entityID uuid.UUID) ([]ExistingRelationship, error)
}
