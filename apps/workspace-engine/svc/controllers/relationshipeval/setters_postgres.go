package relationshipeval

import (
	"context"
	"fmt"

	"workspace-engine/pkg/db"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

const batchSize = 100

type PostgresSetter struct{}

type relKey struct {
	RuleID         uuid.UUID
	FromEntityType string
	FromEntityID   uuid.UUID
	ToEntityType   string
	ToEntityID     uuid.UUID
}

func (s *PostgresSetter) SetComputedRelationships(
	ctx context.Context,
	entityType string,
	entityID uuid.UUID,
	relationships []ComputedRelationship,
) error {
	q := db.GetQueries(ctx)

	existing, err := q.GetExistingRelationshipsForEntity(ctx, db.GetExistingRelationshipsForEntityParams{
		EntityType: pgtype.Text{String: entityType, Valid: true},
		EntityID:   entityID,
	})
	if err != nil {
		return fmt.Errorf("get existing relationships for %s/%s: %w", entityType, entityID, err)
	}

	desiredSet := make(map[relKey]struct{}, len(relationships))
	for _, rel := range relationships {
		desiredSet[relKey{
			RuleID:         rel.RuleID,
			FromEntityType: rel.FromEntityType,
			FromEntityID:   rel.FromEntityID,
			ToEntityType:   rel.ToEntityType,
			ToEntityID:     rel.ToEntityID,
		}] = struct{}{}
	}

	existingSet := make(map[relKey]struct{}, len(existing))
	var toDelete []db.BatchDeleteComputedEntityRelationshipByPKParams
	for _, row := range existing {
		k := relKey{
			RuleID:         row.RuleID,
			FromEntityType: row.FromEntityType,
			FromEntityID:   row.FromEntityID,
			ToEntityType:   row.ToEntityType,
			ToEntityID:     row.ToEntityID,
		}
		existingSet[k] = struct{}{}
		if _, ok := desiredSet[k]; !ok {
			toDelete = append(toDelete, db.BatchDeleteComputedEntityRelationshipByPKParams{
				RuleID:         row.RuleID,
				FromEntityType: row.FromEntityType,
				FromEntityID:   row.FromEntityID,
				ToEntityType:   row.ToEntityType,
				ToEntityID:     row.ToEntityID,
			})
		}
	}

	var toUpsert []db.BatchUpsertComputedEntityRelationshipParams
	for _, rel := range relationships {
		k := relKey{
			RuleID:         rel.RuleID,
			FromEntityType: rel.FromEntityType,
			FromEntityID:   rel.FromEntityID,
			ToEntityType:   rel.ToEntityType,
			ToEntityID:     rel.ToEntityID,
		}
		if _, ok := existingSet[k]; !ok {
			toUpsert = append(toUpsert, db.BatchUpsertComputedEntityRelationshipParams{
				RuleID:         rel.RuleID,
				FromEntityType: rel.FromEntityType,
				FromEntityID:   rel.FromEntityID,
				ToEntityType:   rel.ToEntityType,
				ToEntityID:     rel.ToEntityID,
			})
		}
	}

	for i := 0; i < len(toDelete); i += batchSize {
		end := i + batchSize
		if end > len(toDelete) {
			end = len(toDelete)
		}
		chunk := toDelete[i:end]
		delResults := q.BatchDeleteComputedEntityRelationshipByPK(ctx, chunk)
		var delErr error
		delResults.Exec(func(j int, err error) {
			if err != nil && delErr == nil {
				delErr = fmt.Errorf("batch delete relationship %d: %w", i+j, err)
			}
		})
		if delErr != nil {
			return delErr
		}
	}

	for i, rel := range toUpsert {
		if _, err := q.BatchUpsertComputedEntityRelationship(ctx, rel); err != nil {
			return fmt.Errorf("upsert relationship %d: %w", i, err)
		}
	}

	return nil
}
