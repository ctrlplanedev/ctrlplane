package environmentresourceselectoreval

import (
	"context"
	"fmt"

	"workspace-engine/pkg/db"
	"workspace-engine/pkg/store/resources"

	"github.com/google/uuid"
)

type resourcesGetter = resources.GetResources

type PostgresGetter struct {
	resourcesGetter
}

func NewPostgresGetter(queries *db.Queries) *PostgresGetter {
	return &PostgresGetter{
		resourcesGetter: &resources.PostgresGetResources{},
	}
}

func (g *PostgresGetter) GetEnvironmentInfo(ctx context.Context, environmentID uuid.UUID) (*EnvironmentInfo, error) {
	row, err := db.GetQueries(ctx).GetEnvironmentByID(ctx, environmentID)
	if err != nil {
		return nil, fmt.Errorf("get environment %s: %w", environmentID, err)
	}

	return &EnvironmentInfo{
		ResourceSelector: row.ResourceSelector,
		WorkspaceID:      row.WorkspaceID,
	}, nil
}
