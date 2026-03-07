package deploymentresourceselectoreval

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

func (g *PostgresGetter) GetDeploymentInfo(ctx context.Context, deploymentID uuid.UUID) (*DeploymentInfo, error) {
	row, err := db.GetQueries(ctx).GetDeploymentByID(ctx, deploymentID)
	if err != nil {
		return nil, fmt.Errorf("get deployment %s: %w", deploymentID, err)
	}

	return &DeploymentInfo{
		ResourceSelector: row.ResourceSelector.String,
		WorkspaceID:      row.WorkspaceID,
	}, nil
}

func (g *PostgresGetter) GetReleaseTargetsForDeployment(ctx context.Context, deploymentID uuid.UUID) ([]ReleaseTarget, error) {
	rows, err := db.GetQueries(ctx).GetReleaseTargetsForDeployment(ctx, deploymentID)
	if err != nil {
		return nil, fmt.Errorf("query release targets for deployment %s: %w", deploymentID, err)
	}
	targets := make([]ReleaseTarget, len(rows))
	for i, row := range rows {
		targets[i] = ReleaseTarget{
			DeploymentID:  row.DeploymentID,
			EnvironmentID: row.EnvironmentID,
			ResourceID:    row.ResourceID,
		}
	}
	return targets, nil
}
