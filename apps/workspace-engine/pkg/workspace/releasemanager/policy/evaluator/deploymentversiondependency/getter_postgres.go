package deploymentversiondependency

import (
	"context"
	"errors"
	"fmt"

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
	deploymentVersionID string,
) ([]DependencyEdge, error) {
	versionID, err := uuid.Parse(deploymentVersionID)
	if err != nil {
		return nil, fmt.Errorf("parse deployment version id: %w", err)
	}
	rows, err := p.queries.GetDeploymentDependenciesByVersionID(ctx, versionID)
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
	depID, err := uuid.Parse(deploymentID)
	if err != nil {
		return nil, fmt.Errorf("parse deployment id: %w", err)
	}
	resID, err := uuid.Parse(resourceID)
	if err != nil {
		return nil, fmt.Errorf("parse resource id: %w", err)
	}
	row, err := p.queries.GetReleaseTargetForDeploymentResource(
		ctx,
		db.GetReleaseTargetForDeploymentResourceParams{
			DeploymentID: depID,
			ResourceID:   resID,
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
	resID, err := uuid.Parse(rt.ResourceId)
	if err != nil {
		return nil, fmt.Errorf("parse resource id: %w", err)
	}
	envID, err := uuid.Parse(rt.EnvironmentId)
	if err != nil {
		return nil, fmt.Errorf("parse environment id: %w", err)
	}
	depID, err := uuid.Parse(rt.DeploymentId)
	if err != nil {
		return nil, fmt.Errorf("parse deployment id: %w", err)
	}
	row, err := p.queries.GetCurrentReleaseByReleaseTarget(
		ctx,
		db.GetCurrentReleaseByReleaseTargetParams{
			ResourceID:    resID,
			EnvironmentID: envID,
			DeploymentID:  depID,
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
