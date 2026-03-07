package summaryeval

import (
	"context"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator/gradualrollout"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator/versioncooldown"
	legacystore "workspace-engine/pkg/workspace/store"
)

var _ Getter = (*StoreGetter)(nil)

type StoreGetter struct {
	gradualRolloutGetter
	versioncooldown versioncooldown.Getters
}

func NewStoreGetter(store *legacystore.Store) *StoreGetter {
	return &StoreGetter{
		gradualRolloutGetter: gradualrollout.NewStoreGetters(store),
		versioncooldown:      versioncooldown.NewStoreGetters(store),
	}
}

func (g *StoreGetter) GetJobVerificationStatus(jobID string) oapi.JobVerificationStatus {
	return g.versioncooldown.GetJobVerificationStatus(jobID)
}

func (g *StoreGetter) GetAllReleaseTargets(ctx context.Context, workspaceID string) ([]*oapi.ReleaseTarget, error) {
	return g.versioncooldown.GetAllReleaseTargets(ctx, workspaceID)
}

func (g *StoreGetter) GetJobsForReleaseTarget(releaseTarget *oapi.ReleaseTarget) map[string]*oapi.Job {
	return g.versioncooldown.GetJobsForReleaseTarget(releaseTarget)
}
