package policyeval

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator"
	pevalgetters "workspace-engine/svc/controllers/desiredrelease/policyeval"
)

var _ Getter = (*PostgresGetter)(nil)

type PostgresGetter struct {
	policyEvalGetter
}

func NewPostgresGetter(queries *db.Queries) *PostgresGetter {
	return &PostgresGetter{
		policyEvalGetter: pevalgetters.NewPostgresGetter(queries),
	}
}

func (g *PostgresGetter) GetVersion(
	ctx context.Context,
	versionID uuid.UUID,
) (*oapi.DeploymentVersion, error) {
	row, err := db.GetQueries(ctx).GetDeploymentVersionByID(ctx, versionID)
	if err != nil {
		return nil, fmt.Errorf("get version %s: %w", versionID, err)
	}
	return db.ToOapiDeploymentVersion(row), nil
}

func (g *PostgresGetter) GetReleaseTargetScope(
	ctx context.Context,
	rt *ReleaseTarget,
) (*evaluator.EvaluatorScope, error) {
	q := db.GetQueries(ctx)

	depRow, err := q.GetDeploymentByID(ctx, rt.DeploymentID)
	if err != nil {
		return nil, fmt.Errorf("get deployment %s: %w", rt.DeploymentID, err)
	}

	envRow, err := q.GetEnvironmentByID(ctx, rt.EnvironmentID)
	if err != nil {
		return nil, fmt.Errorf("get environment %s: %w", rt.EnvironmentID, err)
	}

	resRow, err := q.GetResourceByID(ctx, rt.ResourceID)
	if err != nil {
		return nil, fmt.Errorf("get resource %s: %w", rt.ResourceID, err)
	}

	return &evaluator.EvaluatorScope{
		Deployment:  db.ToOapiDeployment(depRow),
		Environment: db.ToOapiEnvironment(envRow),
		Resource:    db.ToOapiResource(resRow),
	}, nil
}
