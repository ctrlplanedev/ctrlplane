package summaryeval

import (
	"context"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator/gradualrollout"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator/versioncooldown"
)

var _ Getter = (*PostgresGetter)(nil)

type PostgresGetter struct {
	gradualRolloutGetter
	versioncooldown *versioncooldown.PostgresGetters
}

func NewPostgresGetter(queries *db.Queries) *PostgresGetter {
	return &PostgresGetter{
		gradualRolloutGetter: gradualrollout.NewPostgresGetters(queries),
		versioncooldown:      versioncooldown.NewPostgresGetters(queries),
	}
}

func (g *PostgresGetter) GetJobVerificationStatus(jobID string) oapi.JobVerificationStatus {
	return g.versioncooldown.GetJobVerificationStatus(jobID)
}

func (g *PostgresGetter) GetAllReleaseTargets(ctx context.Context, workspaceID string) ([]*oapi.ReleaseTarget, error) {
	return g.versioncooldown.GetAllReleaseTargets(ctx, workspaceID)
}

func (g *PostgresGetter) GetJobsForReleaseTarget(releaseTarget *oapi.ReleaseTarget) map[string]*oapi.Job {
	return g.versioncooldown.GetJobsForReleaseTarget(releaseTarget)
}
