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
	result := make(map[uuid.UUID][]db.System, len(deploymentIDs))

	for _, depID := range deploymentIDs {
		systemIDs, err := queries.GetSystemIDsForDeployment(ctx, depID)
		if err != nil {
			return nil, fmt.Errorf("get system ids for deployment %s: %w", depID, err)
		}

		systems := make([]db.System, 0, len(systemIDs))
		for _, sysID := range systemIDs {
			sys, err := queries.GetSystemByID(ctx, sysID)
			if err != nil {
				return nil, fmt.Errorf("get system %s: %w", sysID, err)
			}
			systems = append(systems, sys)
		}
		result[depID] = systems
	}

	return result, nil
}
