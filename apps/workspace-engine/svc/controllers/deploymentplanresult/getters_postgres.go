package deploymentplanresult

import (
	"context"

	"workspace-engine/pkg/db"
	"workspace-engine/svc/controllers/jobdispatch/jobagents"
	"workspace-engine/svc/controllers/jobdispatch/jobagents/argo"
	"workspace-engine/svc/controllers/jobdispatch/jobagents/testrunner"

	"github.com/google/uuid"
)

type PostgresGetter struct{}

func (g *PostgresGetter) GetDeploymentPlanTargetResult(
	ctx context.Context,
	id uuid.UUID,
) (db.DeploymentPlanTargetResult, error) {
	return db.GetQueries(ctx).GetDeploymentPlanTargetResult(ctx, id)
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
	return registry
}
