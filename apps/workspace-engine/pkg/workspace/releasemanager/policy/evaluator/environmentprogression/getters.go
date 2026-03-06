package environmentprogression

import (
	"context"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/store"
)

type Getters interface {
	GetEnvironments() map[string]*oapi.Environment
	GetSystemIDsForEnvironment(environmentID string) []string
	GetReleaseTargetsForEnvironment(ctx context.Context, environmentID string) ([]*oapi.ReleaseTarget, error)
	GetJobsForReleaseTarget(releaseTarget *oapi.ReleaseTarget) map[string]*oapi.Job
	GetRelease(releaseID string) (*oapi.Release, bool)
}

var _ Getters = (*storeGetters)(nil)

type storeGetters struct {
	store *store.Store
}

func (s *storeGetters) GetEnvironments() map[string]*oapi.Environment {
	return s.store.Environments.Items()
}

func (s *storeGetters) GetSystemIDsForEnvironment(environmentID string) []string {
	return s.store.SystemEnvironments.GetSystemIDsForEnvironment(environmentID)
}

func (s *storeGetters) GetReleaseTargetsForEnvironment(ctx context.Context, environmentID string) ([]*oapi.ReleaseTarget, error) {
	return s.store.ReleaseTargets.GetForEnvironment(ctx, environmentID)
}

func (s *storeGetters) GetJobsForReleaseTarget(releaseTarget *oapi.ReleaseTarget) map[string]*oapi.Job {
	return s.store.Jobs.GetJobsForReleaseTarget(releaseTarget)
}

func (s *storeGetters) GetRelease(releaseID string) (*oapi.Release, bool) {
	return s.store.Releases.Get(releaseID)
}
