package jobeligibility

import (
	"context"
	"fmt"

	"workspace-engine/pkg/oapi"

	"github.com/google/uuid"
)

var _ Getter = (*PostgresGetter)(nil)

type PostgresGetter struct{}

func (g *PostgresGetter) ReleaseTargetExists(ctx context.Context, rt *ReleaseTarget) (bool, error) {
	return false, fmt.Errorf("not implemented")
}

func (g *PostgresGetter) GetDesiredRelease(ctx context.Context, rt *ReleaseTarget) (*oapi.Release, error) {
	return nil, fmt.Errorf("not implemented")
}

func (g *PostgresGetter) GetJobsForReleaseTarget(ctx context.Context, rt *ReleaseTarget) ([]*oapi.Job, error) {
	return nil, fmt.Errorf("not implemented")
}

func (g *PostgresGetter) GetPoliciesForReleaseTarget(ctx context.Context, rt *oapi.ReleaseTarget) ([]*oapi.Policy, error) {
	return nil, fmt.Errorf("not implemented")
}

func (g *PostgresGetter) GetDeployment(ctx context.Context, deploymentID uuid.UUID) (*oapi.Deployment, error) {
	return nil, fmt.Errorf("not implemented")
}

func (g *PostgresGetter) GetJobAgent(ctx context.Context, jobAgentID uuid.UUID) (*oapi.JobAgent, error) {
	return nil, fmt.Errorf("not implemented")
}

func (g *PostgresGetter) GetEnvironment(ctx context.Context, environmentID uuid.UUID) (*oapi.Environment, error) {
	return nil, fmt.Errorf("not implemented")
}

func (g *PostgresGetter) GetResource(ctx context.Context, resourceID uuid.UUID) (*oapi.Resource, error) {
	return nil, fmt.Errorf("not implemented")
}
