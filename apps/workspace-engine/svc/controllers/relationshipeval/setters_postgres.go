package relationshipeval

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"workspace-engine/pkg/db"
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

	existing, err := q.GetExistingRelationshipsForEntity(
		ctx,
		db.GetExistingRelationshipsForEntityParams{
			EntityType: pgtype.Text{String: entityType, Valid: true},
			EntityID:   entityID,
		},
	)
	if err != nil {
		return fmt.Errorf("get existing relationships for %s/%s: %w", entityType, entityID, err)
	}

	desiredSet := make(map[relKey]struct{}, len(relationships))
	for _, rel := range relationships {
		desiredSet[relKey(rel)] = struct{}{}
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
			toDelete = append(toDelete, db.BatchDeleteComputedEntityRelationshipByPKParams(row))
		}
	}

	var upsert db.BatchUpsertComputedEntityRelationshipParams
	for _, rel := range relationships {
		k := relKey(rel)
		if _, ok := existingSet[k]; !ok {
			upsert.RuleIds = append(upsert.RuleIds, rel.RuleID)
			upsert.FromEntityTypes = append(upsert.FromEntityTypes, rel.FromEntityType)
			upsert.FromEntityIds = append(upsert.FromEntityIds, rel.FromEntityID)
			upsert.ToEntityTypes = append(upsert.ToEntityTypes, rel.ToEntityType)
			upsert.ToEntityIds = append(upsert.ToEntityIds, rel.ToEntityID)
		}
	}

	for i := 0; i < len(toDelete); i += batchSize {
		end := min(i+batchSize, len(toDelete))
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

	if len(upsert.RuleIds) > 0 {
		if err := q.BatchUpsertComputedEntityRelationship(ctx, upsert); err != nil {
			return fmt.Errorf("batch upsert relationships: %w", err)
		}
	}

	return nil
}
