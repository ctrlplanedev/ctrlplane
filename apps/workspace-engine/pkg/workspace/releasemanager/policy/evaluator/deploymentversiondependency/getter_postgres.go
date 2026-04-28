package deploymentversiondependency

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/oapi"
)

var _ Getters = (*PostgresGetters)(nil)

type PostgresGetters struct {
	queries *db.Queries
}

func NewPostgresGetters(queries *db.Queries) *PostgresGetters {
	return &PostgresGetters{queries: queries}
}

func (p *PostgresGetters) GetDependencies(
	ctx context.Context,
	deploymentID string,
) ([]DependencyEdge, error) {
	rows, err := p.queries.GetDeploymentDependenciesByDeploymentID(
		ctx,
		uuid.MustParse(deploymentID),
	)
	if err != nil {
		return nil, err
	}
	edges := make([]DependencyEdge, len(rows))
	for i, row := range rows {
		edges[i] = DependencyEdge{
			DependencyDeploymentID: row.DependencyDeploymentID.String(),
			VersionSelector:        row.VersionSelector,
		}
	}
	return edges, nil
}

func (p *PostgresGetters) GetReleaseTargetForDeploymentResource(
	ctx context.Context,
	deploymentID string,
	resourceID string,
) (*oapi.ReleaseTarget, error) {
	row, err := p.queries.GetReleaseTargetForDeploymentResource(
		ctx,
		db.GetReleaseTargetForDeploymentResourceParams{
			DeploymentID: uuid.MustParse(deploymentID),
			ResourceID:   uuid.MustParse(resourceID),
		},
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return &oapi.ReleaseTarget{
		DeploymentId:  row.DeploymentID.String(),
		EnvironmentId: row.EnvironmentID.String(),
		ResourceId:    row.ResourceID.String(),
	}, nil
}

func (p *PostgresGetters) GetCurrentVersionForReleaseTarget(
	ctx context.Context,
	rt *oapi.ReleaseTarget,
) (*oapi.DeploymentVersion, error) {
	if rt == nil {
		return nil, nil
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
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
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
	return v, nil
}
