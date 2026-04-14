package forcedeploy

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/oapi"
)

var _ Getter = (*PostgresGetter)(nil)

type PostgresGetter struct{}

func (g *PostgresGetter) ReleaseTargetExists(ctx context.Context, rt *ReleaseTarget) (bool, error) {
	return db.GetQueries(ctx).ReleaseTargetExists(ctx, db.ReleaseTargetExistsParams{
		DeploymentID:  rt.DeploymentID,
		EnvironmentID: rt.EnvironmentID,
		ResourceID:    rt.ResourceID,
	})
}

func (g *PostgresGetter) GetDesiredRelease(
	ctx context.Context,
	rt *ReleaseTarget,
) (*oapi.Release, error) {
	row, err := db.GetQueries(ctx).
		GetDesiredReleaseByReleaseTarget(ctx, db.GetDesiredReleaseByReleaseTargetParams{
			ResourceID:    rt.ResourceID,
			EnvironmentID: rt.EnvironmentID,
			DeploymentID:  rt.DeploymentID,
		})
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return db.ToOapiFullRelease(row), nil
}

func (g *PostgresGetter) GetActiveJobsForReleaseTarget(
	ctx context.Context,
	rt *oapi.ReleaseTarget,
) ([]*oapi.Job, error) {
	deploymentID, err := uuid.Parse(rt.DeploymentId)
	if err != nil {
		return nil, err
	}
	environmentID, err := uuid.Parse(rt.EnvironmentId)
	if err != nil {
		return nil, err
	}
	resourceID, err := uuid.Parse(rt.ResourceId)
	if err != nil {
		return nil, err
	}

	rows, err := db.GetQueries(ctx).
		ListJobsByReleaseTargetWithStatuses(ctx, db.ListJobsByReleaseTargetWithStatusesParams{
			DeploymentID:  deploymentID,
			EnvironmentID: environmentID,
			ResourceID:    resourceID,
			Statuses:      []string{"in_progress", "action_required", "pending"},
		})
	if err != nil {
		return nil, err
	}

	jobs := make([]*oapi.Job, len(rows))
	for i, row := range rows {
		jobs[i] = db.ToOapiJob(db.ListJobsByReleaseIDRow(row))
	}
	return jobs, nil
}

func (g *PostgresGetter) GetDeployment(
	ctx context.Context,
	deploymentID uuid.UUID,
) (*oapi.Deployment, error) {
	row, err := db.GetQueries(ctx).GetDeploymentByID(ctx, deploymentID)
	if err != nil {
		return nil, err
	}
	return db.ToOapiDeployment(row), nil
}

func (g *PostgresGetter) GetEnvironment(
	ctx context.Context,
	environmentID uuid.UUID,
) (*oapi.Environment, error) {
	row, err := db.GetQueries(ctx).GetEnvironmentByID(ctx, environmentID)
	if err != nil {
		return nil, err
	}
	return db.ToOapiEnvironment(row), nil
}

func (g *PostgresGetter) GetResource(
	ctx context.Context,
	resourceID uuid.UUID,
) (*oapi.Resource, error) {
	row, err := db.GetQueries(ctx).GetResourceByID(ctx, resourceID)
	if err != nil {
		return nil, err
	}
	return db.ToOapiResource(row), nil
}

func (g *PostgresGetter) ListJobAgentsByWorkspaceID(
	ctx context.Context,
	workspaceID uuid.UUID,
) ([]oapi.JobAgent, error) {
	rows, err := db.GetQueries(ctx).ListJobAgentsByWorkspaceID(ctx, workspaceID)
	if err != nil {
		return nil, err
	}
	agents := make([]oapi.JobAgent, len(rows))
	for i, row := range rows {
		agents[i] = *db.ToOapiJobAgent(row)
	}
	return agents, nil
}
