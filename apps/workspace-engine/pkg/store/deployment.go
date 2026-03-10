package store

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/oapi"
	legacystore "workspace-engine/pkg/workspace/store"
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

type StoreDeploymentGetter struct {
	store *legacystore.Store
}

var _ DeploymentGetter = (*StoreDeploymentGetter)(nil)

func NewStoreDeploymentGetter(store *legacystore.Store) *StoreDeploymentGetter {
	return &StoreDeploymentGetter{store: store}
}

func (s *StoreDeploymentGetter) GetDeployment(
	ctx context.Context,
	deploymentID string,
) (*oapi.Deployment, error) {
	deployment, ok := s.store.Deployments.Get(deploymentID)
	if !ok {
		return nil, fmt.Errorf("deployment not found")
	}
	return deployment, nil
}

func (s *StoreDeploymentGetter) GetAllDeployments(
	ctx context.Context,
	_ string,
) (map[string]*oapi.Deployment, error) {
	deployments := s.store.Deployments.Items()
	return deployments, nil
}
