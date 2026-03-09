package jobeligibility

import (
	"context"
	"fmt"

	"workspace-engine/pkg/db"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/store/policies"

	"github.com/google/uuid"
)

var _ Getter = (*PostgresGetter)(nil)

type policiesGetter = policies.GetPoliciesForReleaseTarget

type PostgresGetter struct {
	policiesGetter
}

func NewPostgresGetter() *PostgresGetter {
	return &PostgresGetter{
		policiesGetter: &policies.PostgresGetPoliciesForReleaseTarget{},
	}
}

func (g *PostgresGetter) ReleaseTargetExists(ctx context.Context, rt *ReleaseTarget) (bool, error) {
	return db.GetQueries(ctx).ReleaseTargetExists(ctx, db.ReleaseTargetExistsParams{
		DeploymentID:  rt.DeploymentID,
		EnvironmentID: rt.EnvironmentID,
		ResourceID:    rt.ResourceID,
	})
}

func (g *PostgresGetter) GetDesiredRelease(ctx context.Context, rt *ReleaseTarget) (*oapi.Release, error) {
	// TODO: Implement once the desired_release DB schema and queries exist.
	return nil, fmt.Errorf("not implemented")
}

func (g *PostgresGetter) GetJobsForReleaseTarget(_ context.Context, releaseTarget *oapi.ReleaseTarget) map[string]*oapi.Job {
	// TODO: Implement with ListJobsByReleaseTarget query.
	return nil
}

func (g *PostgresGetter) GetJobsInProcessingStateForReleaseTarget(_ context.Context, releaseTarget *oapi.ReleaseTarget) map[string]*oapi.Job {
	// TODO: Implement with ListJobsByReleaseTarget query + processing state filter.
	return nil
}

func (g *PostgresGetter) GetDeployment(ctx context.Context, deploymentID uuid.UUID) (*oapi.Deployment, error) {
	row, err := db.GetQueries(ctx).GetDeploymentByID(ctx, deploymentID)
	if err != nil {
		return nil, err
	}
	return db.ToOapiDeployment(row), nil
}

func (g *PostgresGetter) GetJobAgent(ctx context.Context, jobAgentID uuid.UUID) (*oapi.JobAgent, error) {
	row, err := db.GetQueries(ctx).GetJobAgentByID(ctx, jobAgentID)
	if err != nil {
		return nil, err
	}
	return db.ToOapiJobAgent(row), nil
}

func (g *PostgresGetter) GetEnvironment(ctx context.Context, environmentID uuid.UUID) (*oapi.Environment, error) {
	row, err := db.GetQueries(ctx).GetEnvironmentByID(ctx, environmentID)
	if err != nil {
		return nil, err
	}
	return db.ToOapiEnvironment(row), nil
}

func (g *PostgresGetter) GetResource(ctx context.Context, resourceID uuid.UUID) (*oapi.Resource, error) {
	row, err := db.GetQueries(ctx).GetResourceByID(ctx, resourceID)
	if err != nil {
		return nil, err
	}
	return db.ToOapiResource(row), nil
}
