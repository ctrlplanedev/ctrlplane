package relationshipeval

import (
	"context"
	"fmt"

	"workspace-engine/pkg/db"

	"github.com/google/uuid"
)

type PostgresSetter struct{}

func (s *PostgresSetter) SetComputedRelationships(ctx context.Context, entityType string, entityID uuid.UUID, relationships []ComputedRelationship) error {
	pool := db.GetPool(ctx)
	tx, err := pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	q := db.New(tx)

	err = q.DeleteComputedRelationshipsForEntity(ctx, db.DeleteComputedRelationshipsForEntityParams{
		EntityType: entityType,
		EntityID:   entityID,
	})
	if err != nil {
		return fmt.Errorf("delete existing relationships for %s/%s: %w", entityType, entityID, err)
	}

	if len(relationships) > 0 {
		params := db.BulkUpsertComputedRelationshipsParams{
			RuleIds:         make([]uuid.UUID, len(relationships)),
			FromEntityTypes: make([]string, len(relationships)),
			FromEntityIds:   make([]uuid.UUID, len(relationships)),
			ToEntityTypes:   make([]string, len(relationships)),
			ToEntityIds:     make([]uuid.UUID, len(relationships)),
		}
		for i, rel := range relationships {
			params.RuleIds[i] = rel.RuleID
			params.FromEntityTypes[i] = rel.FromEntityType
			params.FromEntityIds[i] = rel.FromEntityID
			params.ToEntityTypes[i] = rel.ToEntityType
			params.ToEntityIds[i] = rel.ToEntityID
		}
		if err := q.BulkUpsertComputedRelationships(ctx, params); err != nil {
			return fmt.Errorf("bulk insert %d relationships for %s/%s: %w",
				len(relationships), entityType, entityID, err)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit: %w", err)
	}
	return nil
}
