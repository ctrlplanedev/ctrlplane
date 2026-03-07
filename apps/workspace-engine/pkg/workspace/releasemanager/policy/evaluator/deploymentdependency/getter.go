package deploymentdependency

import (
	"context"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/store"
	legacystore "workspace-engine/pkg/workspace/store"
)

type deploymentGetter = store.DeploymentGetter

type Getters interface {
	deploymentGetter
	GetReleaseTargetsForResource(ctx context.Context, resourceID string) []*oapi.ReleaseTarget
	GetLatestCompletedJobForReleaseTarget(releaseTarget *oapi.ReleaseTarget) *oapi.Job
}

var _ Getters = (*StoreGetters)(nil)

type StoreGetters struct {
	deploymentGetter
	store *legacystore.Store
}

func NewStoreGetters(ls *legacystore.Store) *StoreGetters {
	return &StoreGetters{store: ls, deploymentGetter: store.NewStoreDeploymentGetter(ls)}
}

func (s *StoreGetters) GetReleaseTargetsForResource(ctx context.Context, resourceID string) []*oapi.ReleaseTarget {
	return s.store.ReleaseTargets.GetForResource(ctx, resourceID)
}

func (s *StoreGetters) GetLatestCompletedJobForReleaseTarget(releaseTarget *oapi.ReleaseTarget) *oapi.Job {
	return s.store.Jobs.GetLatestCompletedJobForReleaseTarget(releaseTarget)
}

var _ Getters = (*PostgresGetters)(nil)

type PostgresGetters struct {
	deploymentGetter
	queries *db.Queries
}

func NewPostgresGetters(queries *db.Queries) *PostgresGetters {
	return &PostgresGetters{queries: queries, deploymentGetter: store.NewPostgresDeploymentGetter(queries)}
}

func (p *PostgresGetters) GetReleaseTargetsForResource(ctx context.Context, resourceID string) []*oapi.ReleaseTarget {
	panic("unimplemented")
}

func (p *PostgresGetters) GetLatestCompletedJobForReleaseTarget(releaseTarget *oapi.ReleaseTarget) *oapi.Job {
	panic("unimplemented")
}
