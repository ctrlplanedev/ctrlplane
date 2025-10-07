package db

import (
	"context"
	"database/sql"
	"encoding/json"
	"time"

	"workspace-engine/pkg/pb"

	"github.com/jackc/pgx/v5"
	"google.golang.org/protobuf/types/known/structpb"
)

const RESOURCE_SELECT_QUERY = `
	SELECT
		r.id,
		r.version,
		r.name,
		r.kind,
		r.identifier,
		r.provider_id,
		r.workspace_id,
		r.config,
		r.created_at,
		r.locked_at,
		r.updated_at,
		r.deleted_at,
		COALESCE(
			json_object_agg(
				COALESCE(rm.key, ''), 
				COALESCE(rm.value, '')
			) FILTER (WHERE rm.key IS NOT NULL), 
			'{}'::json
		) as metadata
	FROM resource r
	LEFT JOIN resource_metadata rm ON rm.resource_id = r.id
	WHERE r.workspace_id = $1
	GROUP BY r.id, r.version, r.name, r.kind, r.identifier, r.provider_id, r.workspace_id, r.config, r.created_at, r.locked_at, r.updated_at, r.deleted_at
`

func GetResources(ctx context.Context, workspaceID string) ([]*pb.Resource, error) {
	db, err := GetDB(ctx)
	if err != nil {
		return nil, err
	}
	defer db.Release()

	rows, err := db.Query(ctx, RESOURCE_SELECT_QUERY, workspaceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	resources := make([]*pb.Resource, 0)
	for rows.Next() {
		resource, err := scanResourceRow(rows)
		if err != nil {
			return nil, err
		}
		resources = append(resources, resource)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return resources, nil
}

func scanResourceRow(row pgx.Row) (*pb.Resource, error) {
	var resource pb.Resource
	var configJSON []byte
	var metadataJSON []byte
	var providerID sql.NullString
	var createdAt time.Time
	var lockedAt, updatedAt, deletedAt *time.Time

	err := row.Scan(
		&resource.Id,
		&resource.Version,
		&resource.Name,
		&resource.Kind,
		&resource.Identifier,
		&providerID,
		&resource.WorkspaceId,
		&configJSON,
		&createdAt,
		&lockedAt,
		&updatedAt,
		&deletedAt,
		&metadataJSON,
	)
	if err != nil {
		return nil, err
	}

	setResourceTimestamps(&resource, createdAt, lockedAt, updatedAt, deletedAt)

	if providerID.Valid {
		resource.ProviderId = &providerID.String
	}

	if err := setResourceConfig(&resource, configJSON); err != nil {
		return nil, err
	}

	if err := setResourceMetadata(&resource, metadataJSON); err != nil {
		return nil, err
	}

	return &resource, nil
}

func setResourceTimestamps(resource *pb.Resource, createdAt time.Time, lockedAt, updatedAt, deletedAt *time.Time) {
	resource.CreatedAt = createdAt.Format(time.RFC3339)

	if lockedAt != nil {
		lockedAtStr := lockedAt.Format(time.RFC3339)
		resource.LockedAt = &lockedAtStr
	}
	if updatedAt != nil {
		updatedAtStr := updatedAt.Format(time.RFC3339)
		resource.UpdatedAt = &updatedAtStr
	}
	if deletedAt != nil {
		deletedAtStr := deletedAt.Format(time.RFC3339)
		resource.DeletedAt = &deletedAtStr
	}
}

func setResourceConfig(resource *pb.Resource, configJSON []byte) error {
	if len(configJSON) == 0 {
		return nil
	}

	var configMap map[string]interface{}
	if err := json.Unmarshal(configJSON, &configMap); err != nil {
		return err
	}

	configStruct, err := structpb.NewStruct(configMap)
	if err != nil {
		return err
	}

	resource.Config = configStruct
	return nil
}

func setResourceMetadata(resource *pb.Resource, metadataJSON []byte) error {
	if len(metadataJSON) == 0 {
		return nil
	}

	var metadataMap map[string]string
	if err := json.Unmarshal(metadataJSON, &metadataMap); err != nil {
		return err
	}

	resource.Metadata = metadataMap
	return nil
}
