package deploymentplanresult

import (
	"context"

	"github.com/google/uuid"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/jobagents"
	"workspace-engine/pkg/jobagents/argo"
	"workspace-engine/pkg/jobagents/terraformcloud"
	"workspace-engine/pkg/jobagents/testrunner"
)

type PostgresGetter struct{}

func (g *PostgresGetter) GetDeploymentPlanTargetResult(
	ctx context.Context,
	id uuid.UUID,
) (db.DeploymentPlanTargetResult, error) {
	return db.GetQueries(ctx).GetDeploymentPlanTargetResult(ctx, id)
}

func (g *PostgresGetter) GetTargetContextByResultID(
	ctx context.Context,
	resultID uuid.UUID,
) (db.GetTargetContextByResultIDRow, error) {
	return db.GetQueries(ctx).GetTargetContextByResultID(ctx, resultID)
}

func (g *PostgresGetter) ListDeploymentPlanTargetResultsByTargetID(
	ctx context.Context,
	targetID uuid.UUID,
) ([]db.ListDeploymentPlanTargetResultsByTargetIDRow, error) {
	return db.GetQueries(ctx).ListDeploymentPlanTargetResultsByTargetID(ctx, targetID)
}

func (g *PostgresGetter) ListPlanTargetResultValidationsByTargetID(
	ctx context.Context,
	targetID uuid.UUID,
) ([]db.PlanTargetResultValidation, error) {
	return db.GetQueries(ctx).ListPlanTargetResultValidationsByTargetID(ctx, targetID)
}

func (g *PostgresGetter) ListPlanValidationRulesByWorkspaceID(
	ctx context.Context,
	workspaceID uuid.UUID,
) ([]db.ListPlanValidationRulesByWorkspaceIDRow, error) {
	return db.GetQueries(ctx).ListPlanValidationRulesByWorkspaceID(ctx, workspaceID)
}

type PostgresValidatorGetter struct{}

func (g *PostgresValidatorGetter) ListPlanValidationRulesByWorkspaceID(
	ctx context.Context,
	workspaceID uuid.UUID,
) ([]db.ListPlanValidationRulesByWorkspaceIDRow, error) {
	return db.GetQueries(ctx).ListPlanValidationRulesByWorkspaceID(ctx, workspaceID)
}

func (g *PostgresValidatorGetter) GetVersionByReleaseID(
	ctx context.Context,
	releaseID uuid.UUID,
) (db.VersionByReleaseIDRow, error) {
	return db.GetQueries(ctx).GetVersionByReleaseID(ctx, releaseID)
}

func newRegistry() *jobagents.Registry {
	registry := jobagents.NewRegistry(nil, nil)
	registry.Register(
		argo.NewArgoCDPlanner(
			&argo.GoApplicationUpserter{},
			&argo.GoApplicationDeleter{},
			&argo.GoManifestGetter{},
		),
	)
	registry.Register(testrunner.New(nil))
	registry.Register(
		terraformcloud.NewTFCPlanner(
			&terraformcloud.GoWorkspaceSetup{},
			&terraformcloud.GoSpeculativeRunner{},
		),
	)
	return registry
}
