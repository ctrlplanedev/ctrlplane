package releasetargets

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	gocache "github.com/patrickmn/go-cache"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/oapi"
)

type GetReleaseTargetsForDeployment interface {
	GetReleaseTargetsForDeployment(ctx context.Context, deploymentID string) ([]*oapi.ReleaseTarget, error)
}

var _ GetReleaseTargetsForDeployment = (*PostgresGetReleaseTargetsForDeployment)(nil)

type PostgresGetReleaseTargetsForDeployment struct {
	cache *gocache.Cache
}

func NewGetReleaseTargetsForDeployment(opts ...Option) *PostgresGetReleaseTargetsForDeployment {
	return &PostgresGetReleaseTargetsForDeployment{cache: buildCache(opts)}
}

func (s *PostgresGetReleaseTargetsForDeployment) GetReleaseTargetsForDeployment(
	ctx context.Context, deploymentID string,
) ([]*oapi.ReleaseTarget, error) {
	ctx, span := tracer.Start(ctx, "Store.GetReleaseTargetsForDeployment")
	defer span.End()

	if s.cache != nil {
		if v, ok := s.cache.Get(deploymentID); ok {
			return v.([]*oapi.ReleaseTarget), nil
		}
	}

	depID, err := uuid.Parse(deploymentID)
	if err != nil {
		return nil, fmt.Errorf("parse deployment id: %w", err)
	}

	rows, err := db.GetQueries(ctx).GetReleaseTargetsForDeployment(ctx, depID)
	if err != nil {
		return nil, fmt.Errorf("get release targets for deployment: %w", err)
	}

	targets := make([]*oapi.ReleaseTarget, 0, len(rows))
	for _, row := range rows {
		targets = append(targets, &oapi.ReleaseTarget{
			DeploymentId:  row.DeploymentID.String(),
			EnvironmentId: row.EnvironmentID.String(),
			ResourceId:    row.ResourceID.String(),
		})
	}

	if s.cache != nil {
		s.cache.SetDefault(deploymentID, targets)
	}

	return targets, nil
}
