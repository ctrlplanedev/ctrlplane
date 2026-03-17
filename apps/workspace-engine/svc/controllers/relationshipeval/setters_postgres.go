package relationshipeval

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"workspace-engine/pkg/db"
)

type PostgresSetter struct{}

func (s *PostgresSetter) SetComputedRelationships(
	ctx context.Context,
	entityType string,
	entityID uuid.UUID,
	relationships []ComputedRelationship,
) error {
	q := db.GetQueries(ctx)

	params := db.SetComputedEntityRelationshipsParams{
		RuleIds:         make([]uuid.UUID, len(relationships)),
		FromEntityTypes: make([]string, len(relationships)),
		FromEntityIds:   make([]uuid.UUID, len(relationships)),
		ToEntityTypes:   make([]string, len(relationships)),
		ToEntityIds:     make([]uuid.UUID, len(relationships)),
		EntityType:      entityType,
		EntityID:        entityID,
	}
	for i, rel := range relationships {
		params.RuleIds[i] = rel.RuleID
		params.FromEntityTypes[i] = rel.FromEntityType
		params.FromEntityIds[i] = rel.FromEntityID
		params.ToEntityTypes[i] = rel.ToEntityType
		params.ToEntityIds[i] = rel.ToEntityID
	}

	if err := q.SetComputedEntityRelationships(ctx, params); err != nil {
		return fmt.Errorf("set %d relationships for %s/%s: %w",
			len(relationships), entityType, entityID, err)
	}
	return nil
}
