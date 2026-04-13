package deployments

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"workspace-engine/pkg/db"
)

type Getter interface {
	GetAllDeploymentsByWorkspaceID(
		ctx context.Context,
		workspaceID uuid.UUID,
	) ([]db.Deployment, error)
	GetSystemsByDeploymentIDs(
		ctx context.Context,
		deploymentIDs []uuid.UUID,
	) (map[uuid.UUID][]db.System, error)
}

type PostgresGetter struct{}

var _ Getter = &PostgresGetter{}

func (g *PostgresGetter) GetAllDeploymentsByWorkspaceID(
	ctx context.Context,
	workspaceID uuid.UUID,
) ([]db.Deployment, error) {
	queries := db.GetQueries(ctx)
	deployments, err := queries.ListDeploymentsByWorkspaceID(
		ctx,
		db.ListDeploymentsByWorkspaceIDParams{
			WorkspaceID: workspaceID,
		},
	)
	if err != nil {
		return nil, fmt.Errorf("list deployments: %w", err)
	}
	return deployments, nil
}

func (g *PostgresGetter) GetSystemsByDeploymentIDs(
	ctx context.Context,
	deploymentIDs []uuid.UUID,
) (map[uuid.UUID][]db.System, error) {
	if len(deploymentIDs) == 0 {
		return make(map[uuid.UUID][]db.System), nil
	}

	queries := db.GetQueries(ctx)
	rows, err := queries.GetSystemsByDeploymentIDs(ctx, deploymentIDs)
	if err != nil {
		return nil, fmt.Errorf("get systems by deployment ids: %w", err)
	}

	result := make(map[uuid.UUID][]db.System, len(deploymentIDs))
	for _, row := range rows {
		result[row.DeploymentID] = append(result[row.DeploymentID], db.System{
			ID:          row.ID,
			Name:        row.Name,
			Description: row.Description,
			WorkspaceID: row.WorkspaceID,
			Metadata:    row.Metadata,
		})
	}

	return result, nil
}
