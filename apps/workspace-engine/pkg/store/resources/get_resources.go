package resources

import (
	"context"
	"fmt"
	"time"
	"workspace-engine/pkg/celutil"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/oapi"

	"github.com/charmbracelet/log"
	"github.com/google/uuid"
	"go.opentelemetry.io/otel"
)

var tracer = otel.Tracer("workspace-engine/pkg/store/resources")

var celEnv, _ = celutil.NewEnvBuilder().
	WithMapVariables("resource").
	WithStandardExtensions().
	BuildCached(12 * time.Hour)

type GetResourcesOptions struct {
	CEL string
}

type GetResources interface {
	GetResources(ctx context.Context, workspaceID string, options GetResourcesOptions) ([]*oapi.Resource, error)
}

var _ GetResources = (*PostgresGetResources)(nil)

type PostgresGetResources struct{}

func (p *PostgresGetResources) GetResources(ctx context.Context, workspaceID string, options GetResourcesOptions) ([]*oapi.Resource, error) {
	ctx, span := tracer.Start(ctx, "Store.GetResources")
	defer span.End()
	wsID, err := uuid.Parse(workspaceID)
	if err != nil {
		return nil, fmt.Errorf("parse workspace id: %w", err)
	}

	baseQuery := `SELECT 
		id, version, name, kind, identifier, provider_id, workspace_id,
		config, created_at, updated_at, metadata
	FROM resource
	WHERE workspace_id = $1 AND deleted_at IS NULL`
	args := []any{wsID}

	if options.CEL != "" {
		filter, err := celutil.ExtractResourceFilter(options.CEL, 2)
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

	program, err := celEnv.Compile(options.CEL)
	if err != nil {
		return nil, fmt.Errorf("compile CEL program: %w", err)
	}

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
		resource := db.ToOapiResource(r)

		if options.CEL == "" {
			resources = append(resources, resource)
			continue
		}
		resourceMap, err := celutil.EntityToMap(resource)
		if err != nil {
			continue
		}
		celCtx := map[string]any{
			"resource": resourceMap,
		}

		ok, err := celutil.EvalBool(program, celCtx)
		if err != nil {
			continue
		}
		if ok {
			resources = append(resources, resource)
		}
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate resources: %w", err)
	}

	return resources, nil
}
