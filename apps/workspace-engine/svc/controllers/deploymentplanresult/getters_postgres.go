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
