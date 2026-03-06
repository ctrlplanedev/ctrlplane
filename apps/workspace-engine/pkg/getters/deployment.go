package getters

import (
	"context"
	"fmt"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/store"

	"github.com/google/uuid"
)

type DeploymentGetter interface {
	GetDeployment(ctx context.Context, deploymentID string) (*oapi.Deployment, error)
}

var _ DeploymentGetter = (*PostgresDeploymentGetter)(nil)

type PostgresDeploymentGetter struct {
	queries *db.Queries
}

func NewPostgresDeploymentGetter(queries *db.Queries) *PostgresDeploymentGetter {
	return &PostgresDeploymentGetter{queries: queries}
}

// GetDeployment implements [DeploymentGetter].
func (d *PostgresDeploymentGetter) GetDeployment(ctx context.Context, deploymentID string) (*oapi.Deployment, error) {
	deployment, err := d.queries.GetDeploymentByID(ctx, uuid.MustParse(deploymentID))
	if err != nil {
		return nil, err
	}
	return db.ToOapiDeployment(deployment), nil
}

type StoreDeploymentGetter struct {
	store *store.Store
}

func NewStoreDeploymentGetter(store *store.Store) *StoreDeploymentGetter {
	return &StoreDeploymentGetter{store: store}
}

func (s *StoreDeploymentGetter) GetDeployment(ctx context.Context, deploymentID string) (*oapi.Deployment, error) {
	deployment, ok := s.store.Deployments.Get(deploymentID)
	if !ok {
		return nil, fmt.Errorf("deployment not found")
	}
	return deployment, nil
}