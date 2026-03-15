package deploymentplan

import (
	"context"

	"github.com/google/uuid"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/oapi"
	"workspace-engine/svc/controllers/desiredrelease/variableresolver"
)

type PostgresGetter struct{}

func (g *PostgresGetter) GetDeploymentPlan(ctx context.Context, id uuid.UUID) (db.DeploymentPlan, error) {
	return db.GetQueries(ctx).GetDeploymentPlan(ctx, id)
}

func (g *PostgresGetter) GetDeployment(ctx context.Context, id uuid.UUID) (*oapi.Deployment, error) {
	row, err := db.GetQueries(ctx).GetDeploymentByID(ctx, id)
	if err != nil {
		return nil, err
	}
	return db.ToOapiDeployment(row), nil
}

func (g *PostgresGetter) GetReleaseTargets(ctx context.Context, deploymentID uuid.UUID) ([]ReleaseTarget, error) {
	rows, err := db.GetQueries(ctx).GetReleaseTargetsForDeployment(ctx, deploymentID)
	if err != nil {
		return nil, err
	}
	targets := make([]ReleaseTarget, len(rows))
	for i, r := range rows {
		targets[i] = ReleaseTarget{EnvironmentID: r.EnvironmentID, ResourceID: r.ResourceID}
	}
	return targets, nil
}

func (g *PostgresGetter) GetEnvironment(ctx context.Context, id uuid.UUID) (*oapi.Environment, error) {
	row, err := db.GetQueries(ctx).GetEnvironmentByID(ctx, id)
	if err != nil {
		return nil, err
	}
	return db.ToOapiEnvironment(row), nil
}

func (g *PostgresGetter) GetResource(ctx context.Context, id uuid.UUID) (*oapi.Resource, error) {
	row, err := db.GetQueries(ctx).GetResourceByID(ctx, id)
	if err != nil {
		return nil, err
	}
	return db.ToOapiResource(row), nil
}

func (g *PostgresGetter) GetJobAgent(ctx context.Context, id uuid.UUID) (*oapi.JobAgent, error) {
	row, err := db.GetQueries(ctx).GetJobAgentByID(ctx, id)
	if err != nil {
		return nil, err
	}
	return db.ToOapiJobAgent(row), nil
}

type PostgresVarResolver struct {
	getter variableresolver.Getter
}

func NewPostgresVarResolver(getter variableresolver.Getter) *PostgresVarResolver {
	return &PostgresVarResolver{getter: getter}
}

func (r *PostgresVarResolver) Resolve(ctx context.Context, scope *variableresolver.Scope, deploymentID, resourceID string) (map[string]oapi.LiteralValue, error) {
	return variableresolver.Resolve(ctx, r.getter, scope, deploymentID, resourceID)
}
