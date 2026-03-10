package policyeval

import (
	"context"

	"workspace-engine/pkg/db"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator/deploymentdependency"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator/gradualrollout"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator/versioncooldown"
)

var _ Getter = (*PostgresGetter)(nil)

// PostgresGetter satisfies the composite Getter interface by embedding
// *gradualrollout.PostgresGetters (which transitively promotes methods from
// approval, environmentprogression, deploymentwindow, and all store getters)
// and forwarding only the methods unique to versioncooldown and
// deploymentdependency.
type PostgresGetter struct {
	gradualrolloutGetter
	versioncooldown      *versioncooldown.PostgresGetters
	deploymentdependency *deploymentdependency.PostgresGetters
}

func NewPostgresGetter(queries *db.Queries) Getter {
	return &PostgresGetter{
		gradualrolloutGetter: gradualrollout.NewPostgresGetters(queries),
		versioncooldown:      versioncooldown.NewPostgresGetters(queries),
		deploymentdependency: deploymentdependency.NewPostgresGetters(queries),
	}
}

func (g *PostgresGetter) GetAllReleaseTargets(
	ctx context.Context,
	workspaceID string,
) ([]*oapi.ReleaseTarget, error) {
	return g.versioncooldown.GetAllReleaseTargets(ctx, workspaceID)
}

func (g *PostgresGetter) GetJobVerificationStatus(jobID string) oapi.JobVerificationStatus {
	return g.versioncooldown.GetJobVerificationStatus(jobID)
}

func (g *PostgresGetter) GetReleaseTargetsForResource(
	ctx context.Context,
	resourceID string,
) []*oapi.ReleaseTarget {
	return g.deploymentdependency.GetReleaseTargetsForResource(ctx, resourceID)
}

func (g *PostgresGetter) GetLatestCompletedJobForReleaseTarget(
	releaseTarget *oapi.ReleaseTarget,
) *oapi.Job {
	return g.deploymentdependency.GetLatestCompletedJobForReleaseTarget(releaseTarget)
}
