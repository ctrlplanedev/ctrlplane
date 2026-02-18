package persistence

import (
	"context"
	"encoding/json"
	"fmt"
	"workspace-engine/pkg/concurrency"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/persistence"
	"workspace-engine/pkg/workspace/store/repository/memory"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
)

var tracer = otel.Tracer("persistence/store")

const saveBatchSize = 500

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

func (s *Store) upsertChangelogEntries(ctx context.Context, queries *db.Queries, changes []persistence.Change) error {
	ctx, span := tracer.Start(ctx, "upsertChangelogEntries")
	defer span.End()

	span.SetAttributes(attribute.Int("batch.size", len(changes)))

	if len(changes) == 0 {
		return nil
	}

	params := make([]db.UpsertChangelogEntryParams, 0, len(changes))
	for _, change := range changes {
		workspaceID, err := uuid.Parse(change.Namespace)
		if err != nil {
			return fmt.Errorf("failed to parse workspace ID: %w", err)
		}

		entityType, entityID := change.Entity.CompactionKey()

		entityData, err := json.Marshal(change.Entity)
		if err != nil {
			return fmt.Errorf("failed to marshal entity: %w", err)
		}

		params = append(params, db.UpsertChangelogEntryParams{
			WorkspaceID: workspaceID,
			EntityType:  entityType,
			EntityID:    entityID,
			EntityData:  entityData,
			CreatedAt:   pgtype.Timestamptz{Time: change.Timestamp, Valid: true},
		})
	}

	results := queries.UpsertChangelogEntry(ctx, params)
	var batchErr error
	results.Exec(func(i int, err error) {
		if err != nil && batchErr == nil {
			batchErr = err
		}
	})
	if batchErr != nil {
		span.RecordError(batchErr)
		span.SetStatus(codes.Error, "failed to upsert changelog entry")
		return fmt.Errorf("failed to upsert changelog entry: %w", batchErr)
	}

	return nil
}

func (s *Store) deleteChangelogEntries(ctx context.Context, queries *db.Queries, changes []persistence.Change) error {
	ctx, span := tracer.Start(ctx, "deleteChangelogEntries")
	defer span.End()

	span.SetAttributes(attribute.Int("batch.size", len(changes)))

	if len(changes) == 0 {
		return nil
	}

	params := make([]db.DeleteChangelogEntryParams, 0, len(changes))
	for _, change := range changes {
		workspaceID, err := uuid.Parse(change.Namespace)
		if err != nil {
			return fmt.Errorf("failed to parse workspace ID: %w", err)
		}

		entityType, entityID := change.Entity.CompactionKey()

		params = append(params, db.DeleteChangelogEntryParams{
			WorkspaceID: workspaceID,
			EntityType:  entityType,
			EntityID:    entityID,
		})
	}

	results := queries.DeleteChangelogEntry(ctx, params)
	var batchErr error
	results.Exec(func(i int, err error) {
		if err != nil && batchErr == nil {
			batchErr = err
		}
	})
	if batchErr != nil {
		span.RecordError(batchErr)
		span.SetStatus(codes.Error, "failed to delete changelog entry")
		return fmt.Errorf("failed to delete changelog entry: %w", batchErr)
	}

	return nil
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

	setEntries := make([]persistence.Change, 0)
	unsetEntries := make([]persistence.Change, 0)

	for _, change := range changes {
		switch change.ChangeType {
		case persistence.ChangeTypeSet:
			setEntries = append(setEntries, change)
		case persistence.ChangeTypeUnset:
			unsetEntries = append(unsetEntries, change)
		default:
			span.RecordError(fmt.Errorf("unknown change type: %s", change.ChangeType))
			span.SetStatus(codes.Error, "unknown change type")
			return fmt.Errorf("unknown change type: %s", change.ChangeType)
		}
	}

	queries := db.New(tx)

	for _, chunk := range concurrency.Chunk(setEntries, saveBatchSize) {
		if err := s.upsertChangelogEntries(ctx, queries, chunk); err != nil {
			span.RecordError(err)
			span.SetStatus(codes.Error, "failed to upsert changes")
			return fmt.Errorf("failed to upsert changes: %w", err)
		}
	}

	for _, chunk := range concurrency.Chunk(unsetEntries, saveBatchSize) {
		if err := s.deleteChangelogEntries(ctx, queries, chunk); err != nil {
			span.RecordError(err)
			span.SetStatus(codes.Error, "failed to delete changes")
			return fmt.Errorf("failed to delete changes: %w", err)
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
	ctx, span := tracer.Start(ctx, "PersistenceStore.Load")
	defer span.End()

	span.SetAttributes(attribute.String("namespace", namespace))

	workspaceID, err := uuid.Parse(namespace)
	if err != nil {
		return nil, fmt.Errorf("failed to parse workspace ID: %w", err)
	}

	queries := db.New(s.conn)
	rows, err := queries.ListChangelogEntriesByWorkspace(ctx, workspaceID)
	if err != nil {
		return nil, fmt.Errorf("failed to query changelog entries: %w", err)
	}

	var changes persistence.Changes
	jsonEntityRegistry := memory.GlobalRegistry()

	for _, row := range rows {
		entity, err := jsonEntityRegistry.Unmarshal(row.EntityType, row.EntityData)
		if err != nil {
			continue
		}

		changes = append(changes, persistence.Change{
			Namespace:  namespace,
			ChangeType: persistence.ChangeTypeSet, // All loaded entities are "set" type
			Entity:     entity,
			Timestamp:  row.CreatedAt.Time,
		})
	}

	return changes, nil
}

func (s *Store) Close() error {
	s.conn.Release()
	return nil
}
