package policysummary

import (
	"context"
	"fmt"

	"workspace-engine/pkg/oapi"

	"github.com/google/uuid"
)

type PostgresGetter struct{}

var _ Getter = (*PostgresGetter)(nil)

func (g *PostgresGetter) GetEnvironment(ctx context.Context, environmentID uuid.UUID) (*oapi.Environment, error) {
	// TODO: query environment by ID from postgres
	return nil, fmt.Errorf("not implemented")
}

func (g *PostgresGetter) GetDeployment(ctx context.Context, deploymentID uuid.UUID) (*oapi.Deployment, error) {
	// TODO: query deployment by ID from postgres
	return nil, fmt.Errorf("not implemented")
}

func (g *PostgresGetter) GetVersion(ctx context.Context, versionID uuid.UUID) (*oapi.DeploymentVersion, error) {
	// TODO: query deployment_version by ID from postgres
	return nil, fmt.Errorf("not implemented")
}

func (g *PostgresGetter) GetPoliciesForEnvironment(ctx context.Context, workspaceID, environmentID uuid.UUID) ([]*oapi.Policy, error) {
	// TODO: query policies whose selector matches this environment
	return nil, fmt.Errorf("not implemented")
}

func (g *PostgresGetter) GetPoliciesForDeployment(ctx context.Context, workspaceID, deploymentID uuid.UUID) ([]*oapi.Policy, error) {
	// TODO: query policies whose selector matches this deployment
	return nil, fmt.Errorf("not implemented")
}
