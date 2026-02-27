package deploymentresourceselectoreval

import (
	"context"
	"fmt"

	"workspace-engine/pkg/db"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

type PostgresGetter struct{}

func (g *PostgresGetter) GetDeploymentInfo(ctx context.Context, deploymentID uuid.UUID) (*DeploymentInfo, error) {
	row, err := db.GetQueries(ctx).GetDeploymentByID(ctx, deploymentID)
	if err != nil {
		return nil, fmt.Errorf("get deployment %s: %w", deploymentID, err)
	}

	return &DeploymentInfo{
		ResourceSelector: row.ResourceSelector.String,
		WorkspaceID:      row.WorkspaceID,
		Raw:              row,
	}, nil
}

const listResourcesSQL = `
SELECT id, version, name, kind, identifier, provider_id, workspace_id,
       config, created_at, updated_at, deleted_at, metadata
FROM resource
WHERE workspace_id = $1
`

func (g *PostgresGetter) StreamResources(ctx context.Context, workspaceID uuid.UUID, batchSize int, batches chan<- []ResourceInfo) error {
	defer close(batches)

	rows, err := db.GetPool(ctx).Query(ctx, listResourcesSQL, workspaceID)
	if err != nil {
		return fmt.Errorf("query resources for workspace %s: %w", workspaceID, err)
	}
	defer rows.Close()

	batch := make([]ResourceInfo, 0, batchSize)
	for rows.Next() {
		var (
			id         uuid.UUID
			version    string
			name       string
			kind       string
			identifier string
			providerID uuid.UUID
			wsID       uuid.UUID
			config     map[string]any
			createdAt  pgtype.Timestamptz
			updatedAt  pgtype.Timestamptz
			deletedAt  pgtype.Timestamptz
			metadata   map[string]string
		)
		if err := rows.Scan(
			&id, &version, &name, &kind, &identifier, &providerID, &wsID,
			&config, &createdAt, &updatedAt, &deletedAt, &metadata,
		); err != nil {
			return fmt.Errorf("scan resource row: %w", err)
		}

		batch = append(batch, ResourceInfo{
			ID: id,
			Raw: db.ListResourcesByWorkspaceIDRow{
				ID: id, Version: version, Name: name, Kind: kind,
				Identifier: identifier, ProviderID: providerID, WorkspaceID: wsID,
				Config: config, CreatedAt: createdAt, UpdatedAt: updatedAt,
				DeletedAt: deletedAt, Metadata: metadata,
			},
		})

		if len(batch) >= batchSize {
			select {
			case batches <- batch:
			case <-ctx.Done():
				return ctx.Err()
			}
			batch = make([]ResourceInfo, 0, batchSize)
		}
	}

	if err := rows.Err(); err != nil {
		return fmt.Errorf("iterate resources for workspace %s: %w", workspaceID, err)
	}

	if len(batch) > 0 {
		select {
		case batches <- batch:
		case <-ctx.Done():
			return ctx.Err()
		}
	}

	return nil
}
