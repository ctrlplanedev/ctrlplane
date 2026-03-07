package resources

import (
	"context"
	"fmt"
	"workspace-engine/pkg/celutil"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/oapi"

	"github.com/charmbracelet/log"
	"github.com/google/uuid"
)

type GetResourcesOptions struct {
	BestEffortCEL string
}

type GetResources interface {
	GetResources(ctx context.Context, workspaceID string, options GetResourcesOptions) ([]*oapi.Resource, error)
}

var _ GetResources = (*PostgresGetResources)(nil)

type PostgresGetResources struct{}

func (p *PostgresGetResources) GetResources(ctx context.Context, workspaceID string, options GetResourcesOptions) ([]*oapi.Resource, error) {
	wsID := uuid.MustParse(workspaceID)

	baseQuery := `SELECT 
		id, version, name, kind, identifier, provider_id, workspace_id,
		config, created_at, updated_at, metadata
	FROM resource
	WHERE workspace_id = $1 AND deleted_at IS NULL`
	args := []any{wsID}

	if options.BestEffortCEL != "" {
		filter, err := celutil.ExtractResourceFilter(options.BestEffortCEL, 2)
		if err != nil {
			return nil, fmt.Errorf("extract resource filter: %w", err)
		}
		if filter.Clause != "" {
			baseQuery += " AND " + filter.Clause
			args = append(args, filter.Args...)

			log.Info("get resources optimization sql filter: %s", "filter", filter.Clause)
		}
	}

	rows, err := db.GetPool(ctx).Query(ctx, baseQuery, args...)
	if err != nil {
		return nil, fmt.Errorf("list resources: %w", err)
	}
	defer rows.Close()

	var resources []*oapi.Resource
	for rows.Next() {
		var r db.GetResourceByIDRow
		if err := rows.Scan(
			&r.ID, &r.Version, &r.Name, &r.Kind, &r.Identifier,
			&r.ProviderID, &r.WorkspaceID, &r.Config,
			&r.CreatedAt, &r.UpdatedAt, &r.Metadata,
		); err != nil {
			return nil, fmt.Errorf("scan resource: %w", err)
		}
		resources = append(resources, db.ToOapiResource(r))
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate resources: %w", err)
	}

	return resources, nil
}
