package releasetargets

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	gocache "github.com/patrickmn/go-cache"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/oapi"
)

type GetReleaseTargetsForResource interface {
	GetReleaseTargetsForResource(
		ctx context.Context,
		resourceID string,
	) ([]oapi.ReleaseTarget, error)
}

var _ GetReleaseTargetsForResource = (*PostgresGetReleaseTargetsForResource)(nil)

type PostgresGetReleaseTargetsForResource struct {
	cache *gocache.Cache
}

func NewGetReleaseTargetsForResource(opts ...Option) *PostgresGetReleaseTargetsForResource {
	return &PostgresGetReleaseTargetsForResource{cache: buildCache(opts)}
}

func (s *PostgresGetReleaseTargetsForResource) GetReleaseTargetsForResource(
	ctx context.Context, resourceID string,
) ([]oapi.ReleaseTarget, error) {
	ctx, span := tracer.Start(ctx, "Store.GetReleaseTargetsForResource")
	defer span.End()

	if s.cache != nil {
		if v, ok := s.cache.Get(resourceID); ok {
			return v.([]oapi.ReleaseTarget), nil
		}
	}

	resID, err := uuid.Parse(resourceID)
	if err != nil {
		return nil, fmt.Errorf("parse resource id: %w", err)
	}

	rows, err := db.GetQueries(ctx).GetReleaseTargetsForResource(ctx, resID)
	if err != nil {
		return nil, fmt.Errorf("get release targets for resource: %w", err)
	}

	targets := make([]oapi.ReleaseTarget, 0, len(rows))
	for _, row := range rows {
		targets = append(targets, oapi.ReleaseTarget{
			DeploymentId:  row.DeploymentID.String(),
			EnvironmentId: row.EnvironmentID.String(),
			ResourceId:    row.ResourceID.String(),
		})
	}

	if s.cache != nil {
		s.cache.SetDefault(resourceID, targets)
	}

	return targets, nil
}
