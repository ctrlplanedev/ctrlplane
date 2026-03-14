package store

import (
	"context"
	"fmt"

	"workspace-engine/pkg/db"
	"workspace-engine/pkg/oapi"

	"github.com/google/uuid"
)

type DeploymentGetter interface {
	GetAllDeployments(ctx context.Context, workspaceID string) (map[string]*oapi.Deployment, error)
	GetDeployment(ctx context.Context, deploymentID string) (*oapi.Deployment, error)
}

var _ DeploymentGetter = (*PostgresDeploymentGetter)(nil)

type PostgresDeploymentGetter struct {
	queries *db.Queries
}

func NewPostgresDeploymentGetter(queries *db.Queries) *PostgresDeploymentGetter {
	return &PostgresDeploymentGetter{queries: queries}
}

func (g *PostgresDeploymentGetter) GetDeployment(
	ctx context.Context,
	deploymentID string,
) (*oapi.Deployment, error) {
	deployment, err := g.queries.GetDeploymentByID(ctx, uuid.MustParse(deploymentID))
	if err != nil {
		return nil, err
	}
	return db.ToOapiDeployment(deployment), nil
}

func (g *PostgresDeploymentGetter) GetAllDeployments(
	ctx context.Context,
	workspaceID string,
) (map[string]*oapi.Deployment, error) {
	id, err := uuid.Parse(workspaceID)
	if err != nil {
		return nil, fmt.Errorf("parse workspace id: %w", err)
	}
	deployments, err := g.queries.ListDeploymentsByWorkspaceID(
		ctx,
		db.ListDeploymentsByWorkspaceIDParams{
			WorkspaceID: id,
		},
	)
	if err != nil {
		return nil, err
	}
	result := make(map[string]*oapi.Deployment, len(deployments))
	for _, deployment := range deployments {
		result[deployment.ID.String()] = db.ToOapiDeployment(deployment)
	}
	return result, nil
}
