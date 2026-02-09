package persistence

import (
	"context"
	"encoding/json"
	"fmt"
	"time"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/persistence"
	"workspace-engine/pkg/workspace/store/repository"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
)

var tracer = otel.Tracer("persistence/store")

var _ persistence.Store = (*Store)(nil)

type Store struct {
	conn *pgxpool.Conn
}

func NewStore(ctx context.Context) (*Store, error) {
	conn, err := db.GetDB(ctx)
	if err != nil {
		return nil, err
	}
	return &Store{conn: conn}, nil
}

func (s *Store) upsertChangelogEntry(ctx context.Context, tx pgx.Tx, change persistence.Change) error {
	ctx, span := tracer.Start(ctx, "upsertChangelogEntry")
	defer span.End()

	span.SetAttributes(attribute.String("change.type", string(change.ChangeType)))
	span.SetAttributes(attribute.String("change.entity", fmt.Sprintf("%T: %+v", change.Entity, change.Entity)))
	span.SetAttributes(attribute.Int64("change.timestamp", change.Timestamp.Unix()))

	entityType, entityID := change.Entity.CompactionKey()

	entityData, err := json.Marshal(change.Entity)
	if err != nil {
		return fmt.Errorf("failed to marshal entity: %w", err)
	}

	sql := `
		INSERT INTO changelog_entry
			(workspace_id, entity_type, entity_id, entity_data, created_at)
		VALUES 
			($1, $2, $3, $4, $5)
		ON CONFLICT (workspace_id, entity_type, entity_id)
		DO UPDATE SET 
			entity_data = EXCLUDED.entity_data
	`

	_, err = tx.Exec(ctx, sql,
		change.Namespace,
		entityType,
		entityID,
		entityData,
		change.Timestamp,
	)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "failed to upsert changelog entry")
	}
	return err
}

func (s *Store) deleteChangelogEntry(ctx context.Context, tx pgx.Tx, change persistence.Change) error {
	ctx, span := tracer.Start(ctx, "deleteChangelogEntry")
	defer span.End()

	span.SetAttributes(attribute.String("change.type", string(change.ChangeType)))
	span.SetAttributes(attribute.String("change.entity", fmt.Sprintf("%T: %+v", change.Entity, change.Entity)))
	span.SetAttributes(attribute.Int64("change.timestamp", change.Timestamp.Unix()))

	entityType, entityID := change.Entity.CompactionKey()

	sql := `
		DELETE FROM changelog_entry
		WHERE workspace_id = $1 AND entity_type = $2 AND entity_id = $3
	`

	_, err := tx.Exec(ctx, sql,
		change.Namespace,
		entityType,
		entityID,
	)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "failed to delete changelog entry")
	}
	return err
}

func (s *Store) Save(ctx context.Context, changes persistence.Changes) error {
	ctx, span := tracer.Start(ctx, "Save")
	defer span.End()

	span.SetAttributes(attribute.Int("changes.count", len(changes)))
	if len(changes) == 0 {
		return nil
	}

	tx, err := s.conn.Begin(ctx)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	for _, change := range changes {
		switch change.ChangeType {
		case persistence.ChangeTypeSet:
			if err := s.upsertChangelogEntry(ctx, tx, change); err != nil {
				span.RecordError(err)
				span.SetStatus(codes.Error, "failed to upsert change")
				return fmt.Errorf("failed to upsert change: %w", err)
			}
		case persistence.ChangeTypeUnset:
			if err := s.deleteChangelogEntry(ctx, tx, change); err != nil {
				span.RecordError(err)
				span.SetStatus(codes.Error, "failed to delete change")
				return fmt.Errorf("failed to delete change: %w", err)
			}
		default:
			span.RecordError(fmt.Errorf("unknown change type: %s", change.ChangeType))
			span.SetStatus(codes.Error, "unknown change type")
			return fmt.Errorf("unknown change type: %s", change.ChangeType)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "failed to commit transaction")
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	return nil
}

func (s *Store) Load(ctx context.Context, namespace string) (persistence.Changes, error) {
	sql := `
		SELECT entity_type, entity_id, entity_data, created_at
		FROM changelog_entry
		WHERE workspace_id = $1
		ORDER BY created_at ASC
	`

	rows, err := s.conn.Query(ctx, sql, namespace)
	if err != nil {
		return nil, fmt.Errorf("failed to query changelog entries: %w", err)
	}
	defer rows.Close()

	var changes persistence.Changes

	jsonEntityRegistry := repository.GlobalRegistry()

	for rows.Next() {
		var entityType, entityID string
		var entityData []byte
		var createdAt time.Time

		if err := rows.Scan(&entityType, &entityID, &entityData, &createdAt); err != nil {
			return nil, fmt.Errorf("failed to scan row: %w", err)
		}

		entity, err := jsonEntityRegistry.Unmarshal(entityType, entityData)
		if err != nil {
			continue
		}

		changes = append(changes, persistence.Change{
			Namespace:  namespace,
			ChangeType: persistence.ChangeTypeSet, // All loaded entities are "set" type
			Entity:     entity,
			Timestamp:  createdAt,
		})
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating rows: %w", err)
	}

	return changes, nil
}

func (s *Store) Close() error {
	s.conn.Release()
	return nil
}
