package summaryeval

import (
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator"
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

func (g *PostgresGetter) NewVersionCooldownEvaluator(rule *oapi.PolicyRule) evaluator.Evaluator {
	return g.versioncooldown.NewVersionCooldownEvaluator(rule)
}

func (g *PostgresGetter) GetReleaseTargets() ([]*oapi.ReleaseTarget, error) {
	return g.versioncooldown.GetReleaseTargets()
}

func (g *PostgresGetter) GetJobsForReleaseTarget(releaseTarget *oapi.ReleaseTarget) map[string]*oapi.Job {
	return g.versioncooldown.GetJobsForReleaseTarget(releaseTarget)
}
