package retry

import (
	"context"

	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/store"
)

type Getters interface {
	GetJobsForReleaseTarget(
		ctx context.Context,
		releaseTarget *oapi.ReleaseTarget,
	) map[string]*oapi.Job
}

var _ Getters = (*storeGetters)(nil)

type storeGetters struct {
	store *store.Store
}

func (s *storeGetters) GetJobsForReleaseTarget(
	_ context.Context,
	releaseTarget *oapi.ReleaseTarget,
) map[string]*oapi.Job {
	return s.store.Jobs.GetJobsForReleaseTarget(releaseTarget)
}
