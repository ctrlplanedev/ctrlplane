package db

import (
	"context"
	"time"
	"workspace-engine/pkg/oapi"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

const RESOURCE_PROVIDER_SELECT_QUERY = `
	SELECT
		id,
		name,
		created_at,
		workspace_id
	FROM resource_provider
	WHERE workspace_id = $1
`

func getResourceProviders(ctx context.Context, workspaceID string) ([]*oapi.ResourceProvider, error) {
	db, err := GetDB(ctx)
	if err != nil {
		return nil, err
	}
	defer db.Release()

	rows, err := db.Query(ctx, RESOURCE_PROVIDER_SELECT_QUERY, workspaceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	resourceProviders := make([]*oapi.ResourceProvider, 0)
	for rows.Next() {
		resourceProvider, err := scanResourceProviderRow(rows)
		if err != nil {
			return nil, err
		}
		resourceProviders = append(resourceProviders, resourceProvider)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return resourceProviders, nil
}

func scanResourceProviderRow(rows pgx.Rows) (*oapi.ResourceProvider, error) {
	var resourceProvider oapi.ResourceProvider
	var createdAt time.Time
	var workspaceID string
	err := rows.Scan(&resourceProvider.Id, &resourceProvider.Name, &createdAt, &workspaceID)
	if err != nil {
		return nil, err
	}
	resourceProvider.CreatedAt = createdAt
	workspaceUUID, err := uuid.Parse(workspaceID)
	if err != nil {
		return nil, err
	}
	resourceProvider.WorkspaceId = workspaceUUID
	return &resourceProvider, nil
}

const RESOURCE_PROVIDER_UPSERT_QUERY = `
	INSERT INTO resource_provider (id, name, created_at, workspace_id)
	VALUES ($1, $2, $3, $4)
	ON CONFLICT (workspace_id, name) DO UPDATE SET
		id = EXCLUDED.id,
		created_at = EXCLUDED.created_at
`

func writeResourceProvider(ctx context.Context, resourceProvider *oapi.ResourceProvider, tx pgx.Tx) error {
	if _, err := tx.Exec(ctx, RESOURCE_PROVIDER_UPSERT_QUERY, resourceProvider.Id, resourceProvider.Name, resourceProvider.CreatedAt, resourceProvider.WorkspaceId); err != nil {
		return err
	}
	return nil
}

const DELETE_RESOURCE_PROVIDER_QUERY = `
	DELETE FROM resource_provider WHERE id = $1
`

func deleteResourceProvider(ctx context.Context, resourceProviderId string, tx pgx.Tx) error {
	if _, err := tx.Exec(ctx, DELETE_RESOURCE_PROVIDER_QUERY, resourceProviderId); err != nil {
		return err
	}
	return nil
}
