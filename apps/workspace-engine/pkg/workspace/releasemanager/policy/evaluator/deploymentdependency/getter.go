package deploymentdependency

import (
	"context"
	"log/slog"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/store"
	legacystore "workspace-engine/pkg/workspace/store"

	"github.com/google/uuid"
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
	rows, err := p.queries.GetReleaseTargetsForResource(ctx, uuid.MustParse(resourceID))
	if err != nil {
		slog.Error("failed to get release targets for resource", "resourceID", resourceID, "error", err)
		return nil
	}
	targets := make([]*oapi.ReleaseTarget, len(rows))
	for i, row := range rows {
		targets[i] = &oapi.ReleaseTarget{
			DeploymentId:  row.DeploymentID.String(),
			EnvironmentId: row.EnvironmentID.String(),
			ResourceId:    row.ResourceID.String(),
		}
	}
	return targets
}

func (p *PostgresGetters) GetLatestCompletedJobForReleaseTarget(releaseTarget *oapi.ReleaseTarget) *oapi.Job {
	if releaseTarget == nil {
		return nil
	}
	row, err := p.queries.GetLatestCompletedJobForReleaseTarget(context.Background(), db.GetLatestCompletedJobForReleaseTargetParams{
		DeploymentID:  uuid.MustParse(releaseTarget.DeploymentId),
		EnvironmentID: uuid.MustParse(releaseTarget.EnvironmentId),
		ResourceID:    uuid.MustParse(releaseTarget.ResourceId),
	})
	if err != nil {
		slog.Error("failed to get latest completed job for release target", "releaseTarget", releaseTarget.Key(), "error", err)
		return nil
	}
	return db.ToOapiJobFromLatestCompleted(row)
}
