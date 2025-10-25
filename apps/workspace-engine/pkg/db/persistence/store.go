package persistence

import (
	"context"
	"encoding/json"
	"fmt"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/persistence"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

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

func (s *Store) separateChangeTypes(changes persistence.Changes) (persistence.Changes, persistence.Changes) {
	var upsertChanges persistence.Changes
	var deleteChanges persistence.Changes
	for _, change := range changes {
		if change.ChangeType == persistence.ChangeTypeSet {
			upsertChanges = append(upsertChanges, change)
		}

		if change.ChangeType == persistence.ChangeTypeUnset {
			deleteChanges = append(deleteChanges, change)
		}
	}
	return upsertChanges, deleteChanges
}

func (s *Store) batchUpsertChangelogEntries(ctx context.Context, tx pgx.Tx, changes persistence.Changes) error {
	if len(changes) == 0 {
		return nil
	}

	// Use CopyFrom to efficiently batch upsert, but for simplicity, using INSERT ... ON CONFLICT
	sql := `
		INSERT INTO changelog_entry
			(workspace_id, entity_type, entity_id, entity_data, created_at)
		VALUES 
			%s
		ON CONFLICT (workspace_id, entity_type, entity_id)
		DO UPDATE SET 
			entity_data = EXCLUDED.entity_data,
			created_at = EXCLUDED.created_at
	`
	// Prepare the value placeholders and arguments
	valueStrings := make([]string, 0, len(changes))
	valueArgs := make([]any, 0, len(changes)*5)

	argIdx := 1
	for _, change := range changes {
		// Assumes change.Namespace is workspace_id, change.Entity.CompactionKey() -> entity_type, entity_id
		entityType, entityID := change.Entity.CompactionKey()
		valueStrings = append(valueStrings,
			fmt.Sprintf("($%d, $%d, $%d, $%d, $%d)", argIdx, argIdx+1, argIdx+2, argIdx+3, argIdx+4),
		)
		entityData, err := json.Marshal(change.Entity)
		if err != nil {
			return err
		}
		valueArgs = append(valueArgs,
			change.Namespace,
			entityType,
			entityID,
			entityData,
			change.Timestamp,
		)
		argIdx += 5
	}
	query := fmt.Sprintf(sql, joinValueStrings(valueStrings))

	_, err := tx.Exec(ctx, query, valueArgs...)
	return err
}

func (s *Store) batchDeleteChangelogEntries(ctx context.Context, tx pgx.Tx, changes persistence.Changes) error {
	if len(changes) == 0 {
		return nil
	}

	// Delete using the composite primary key
	sql := `
		DELETE FROM changelog_entry
		WHERE (workspace_id, entity_type, entity_id) IN (%s)
	`

	// Prepare the value placeholders and arguments
	valueStrings := make([]string, 0, len(changes))
	valueArgs := make([]any, 0, len(changes)*3)

	argIdx := 1
	for _, change := range changes {
		entityType, entityID := change.Entity.CompactionKey()
		valueStrings = append(valueStrings,
			fmt.Sprintf("($%d, $%d, $%d)", argIdx, argIdx+1, argIdx+2),
		)
		valueArgs = append(valueArgs,
			change.Namespace,
			entityType,
			entityID,
		)
		argIdx += 3
	}
	query := fmt.Sprintf(sql, joinValueStrings(valueStrings))

	_, err := tx.Exec(ctx, query, valueArgs...)
	return err
}

// joinValueStrings joins the slice with a comma
func joinValueStrings(in []string) string {
	out := ""
	for i, s := range in {
		if i > 0 {
			out += ","
		}
		out += s
	}
	return out
}

func (s *Store) Save(ctx context.Context, changes persistence.Changes) error {
	if len(changes) == 0 {
		return nil
	}

	tx, err := s.conn.Begin(ctx)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	upsertChanges, deleteChanges := s.separateChangeTypes(changes)

	if err := s.batchUpsertChangelogEntries(ctx, tx, upsertChanges); err != nil {
		return fmt.Errorf("failed to upsert changes: %w", err)
	}

	if err := s.batchDeleteChangelogEntries(ctx, tx, deleteChanges); err != nil {
		return fmt.Errorf("failed to delete changes: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	return nil
}

func (s *Store) Load(ctx context.Context, namespace string) (persistence.Changes, error) {
	return nil, nil
}

func (s *Store) Close() error {
	s.conn.Release()
	return nil
}
