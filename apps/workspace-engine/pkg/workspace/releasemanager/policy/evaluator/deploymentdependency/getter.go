package deploymentdependency

import (
	"context"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/store"
)

type Getters interface {
	GetDeployments(ctx context.Context) ([]*oapi.Deployment, error)
	GetReleaseTargetsForResource(ctx context.Context, resourceID string) []*oapi.ReleaseTarget
	GetLatestCompletedJobForReleaseTarget(releaseTarget *oapi.ReleaseTarget) *oapi.Job
}

var _ Getters = (*StoreGetters)(nil)

type StoreGetters struct {
	store *store.Store
}

func NewStoreGetters(store *store.Store) *StoreGetters {
	return &StoreGetters{store: store}
}

func (s *StoreGetters) GetDeployments(ctx context.Context) ([]*oapi.Deployment, error) {
	items := s.store.Deployments.Items()
	deployments := make([]*oapi.Deployment, 0, len(items))
	for _, d := range items {
		deployments = append(deployments, d)
	}
	return deployments, nil
}

func (s *StoreGetters) GetReleaseTargetsForResource(ctx context.Context, resourceID string) []*oapi.ReleaseTarget {
	return s.store.ReleaseTargets.GetForResource(ctx, resourceID)
}

func (s *StoreGetters) GetLatestCompletedJobForReleaseTarget(releaseTarget *oapi.ReleaseTarget) *oapi.Job {
	return s.store.Jobs.GetLatestCompletedJobForReleaseTarget(releaseTarget)
}
