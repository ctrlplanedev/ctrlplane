package deploymentdependency

import (
	"context"
	"errors"
	"log/slog"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/store"
)

type deploymentGetter = store.DeploymentGetter

type Getters interface {
	deploymentGetter
	GetReleaseTargetsForResource(ctx context.Context, resourceID string) []*oapi.ReleaseTarget
	GetCurrentlyDeployedVersion(ctx context.Context, rt *oapi.ReleaseTarget) *oapi.DeploymentVersion
}

var _ Getters = (*PostgresGetters)(nil)

type PostgresGetters struct {
	deploymentGetter
	queries *db.Queries
}

func NewPostgresGetters(queries *db.Queries) *PostgresGetters {
	return &PostgresGetters{
		queries:          queries,
		deploymentGetter: store.NewPostgresDeploymentGetter(queries),
	}
}

func (p *PostgresGetters) GetReleaseTargetsForResource(
	ctx context.Context,
	resourceID string,
) []*oapi.ReleaseTarget {
	rows, err := p.queries.GetReleaseTargetsForResource(ctx, uuid.MustParse(resourceID))
	if err != nil {
		slog.Error(
			"failed to get release targets for resource",
			"resourceID",
			resourceID,
			"error",
			err,
		)
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

func (p *PostgresGetters) GetCurrentlyDeployedVersion(
	ctx context.Context,
	rt *oapi.ReleaseTarget,
) *oapi.DeploymentVersion {
	if rt == nil {
		return nil
	}
	row, err := p.queries.GetCurrentReleaseByReleaseTarget(
		ctx,
		db.GetCurrentReleaseByReleaseTargetParams{
			ResourceID:    uuid.MustParse(rt.ResourceId),
			EnvironmentID: uuid.MustParse(rt.EnvironmentId),
			DeploymentID:  uuid.MustParse(rt.DeploymentId),
		},
	)
	if err != nil {
		if !errors.Is(err, pgx.ErrNoRows) {
			slog.Error(
				"failed to get current release for release target",
				"releaseTarget",
				rt.Key(),
				"error",
				err,
			)
		}
		return nil
	}
	v := &oapi.DeploymentVersion{
		Id:           row.VersionID.String(),
		Name:         row.VersionName,
		Tag:          row.VersionTag,
		DeploymentId: row.DeploymentID.String(),
		Status:       oapi.DeploymentVersionStatus(row.VersionStatus),
		Metadata:     row.VersionMetadata,
	}
	if row.VersionCreatedAt.Valid {
		v.CreatedAt = row.VersionCreatedAt.Time
	}
	if row.VersionMessage.Valid {
		v.Message = &row.VersionMessage.String
	}
	return v
}
