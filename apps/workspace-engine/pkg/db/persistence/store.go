package persistence

import (
	"context"
	"encoding/json"
	"fmt"
	"time"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/oapi"
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

	for rows.Next() {
		var entityType, entityID string
		var entityData []byte
		var createdAt time.Time

		if err := rows.Scan(&entityType, &entityID, &entityData, &createdAt); err != nil {
			return nil, fmt.Errorf("failed to scan row: %w", err)
		}

		// Unmarshal based on entity type
		entity, err := unmarshalEntity(entityType, entityData)
		if err != nil {
			return nil, fmt.Errorf("failed to unmarshal entity type %s with id %s: %w", entityType, entityID, err)
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

// unmarshalEntity unmarshals entity data based on entity type
func unmarshalEntity(entityType string, data []byte) (persistence.Entity, error) {
	switch entityType {
	case "resource":
		var entity oapi.Resource
		if err := json.Unmarshal(data, &entity); err != nil {
			return nil, err
		}
		return &entity, nil

	case "resource_provider":
		var entity oapi.ResourceProvider
		if err := json.Unmarshal(data, &entity); err != nil {
			return nil, err
		}
		return &entity, nil

	case "resource_variable":
		var entity oapi.ResourceVariable
		if err := json.Unmarshal(data, &entity); err != nil {
			return nil, err
		}
		return &entity, nil

	case "deployment":
		var entity oapi.Deployment
		if err := json.Unmarshal(data, &entity); err != nil {
			return nil, err
		}
		return &entity, nil

	case "deployment_version":
		var entity oapi.DeploymentVersion
		if err := json.Unmarshal(data, &entity); err != nil {
			return nil, err
		}
		return &entity, nil

	case "deployment_variable":
		var entity oapi.DeploymentVariable
		if err := json.Unmarshal(data, &entity); err != nil {
			return nil, err
		}
		return &entity, nil

	case "environment":
		var entity oapi.Environment
		if err := json.Unmarshal(data, &entity); err != nil {
			return nil, err
		}
		return &entity, nil

	case "policy":
		var entity oapi.Policy
		if err := json.Unmarshal(data, &entity); err != nil {
			return nil, err
		}
		return &entity, nil

	case "system":
		var entity oapi.System
		if err := json.Unmarshal(data, &entity); err != nil {
			return nil, err
		}
		return &entity, nil

	case "release":
		var entity oapi.Release
		if err := json.Unmarshal(data, &entity); err != nil {
			return nil, err
		}
		return &entity, nil

	case "job":
		var entity oapi.Job
		if err := json.Unmarshal(data, &entity); err != nil {
			return nil, err
		}
		return &entity, nil

	case "job_agent":
		var entity oapi.JobAgent
		if err := json.Unmarshal(data, &entity); err != nil {
			return nil, err
		}
		return &entity, nil

	case "user_approval_record":
		var entity oapi.UserApprovalRecord
		if err := json.Unmarshal(data, &entity); err != nil {
			return nil, err
		}
		return &entity, nil

	case "relationship_rule":
		var entity oapi.RelationshipRule
		if err := json.Unmarshal(data, &entity); err != nil {
			return nil, err
		}
		return &entity, nil

	case "github_entity":
		var entity oapi.GithubEntity
		if err := json.Unmarshal(data, &entity); err != nil {
			return nil, err
		}
		return &entity, nil

	default:
		return nil, fmt.Errorf("unknown entity type: %s", entityType)
	}
}

func (s *Store) Close() error {
	s.conn.Release()
	return nil
}
