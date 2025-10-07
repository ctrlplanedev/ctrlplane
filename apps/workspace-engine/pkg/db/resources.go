package db

import (
	"context"
	"database/sql"
	"encoding/json"

	"workspace-engine/pkg/pb"

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
		var resource pb.Resource
		var configJSON []byte
		var metadataJSON []byte
		var providerID sql.NullString
		var lockedAt, updatedAt, deletedAt sql.NullString

		err := rows.Scan(
			&resource.Id,
			&resource.Version,
			&resource.Name,
			&resource.Kind,
			&resource.Identifier,
			&providerID,
			&resource.WorkspaceId,
			&configJSON,
			&resource.CreatedAt,
			&lockedAt,
			&updatedAt,
			&deletedAt,
			&metadataJSON,
		)
		if err != nil {
			return nil, err
		}

		// Handle nullable fields
		if providerID.Valid {
			resource.ProviderId = &providerID.String
		}
		if lockedAt.Valid {
			resource.LockedAt = &lockedAt.String
		}
		if updatedAt.Valid {
			resource.UpdatedAt = &updatedAt.String
		}
		if deletedAt.Valid {
			resource.DeletedAt = &deletedAt.String
		}

		// Parse config JSON
		if len(configJSON) > 0 {
			var configMap map[string]interface{}
			if err := json.Unmarshal(configJSON, &configMap); err == nil {
				if configStruct, err := structpb.NewStruct(configMap); err == nil {
					resource.Config = configStruct
				}
			}
		}

		// Parse metadata JSON
		if len(metadataJSON) > 0 {
			var metadataMap map[string]string
			if err := json.Unmarshal(metadataJSON, &metadataMap); err == nil {
				resource.Metadata = metadataMap
			}
		}

		resources = append(resources, &resource)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return resources, nil
}
