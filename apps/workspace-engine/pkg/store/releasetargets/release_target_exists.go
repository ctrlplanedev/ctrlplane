package releasetargets

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	gocache "github.com/patrickmn/go-cache"
	"workspace-engine/pkg/db"
)

type ReleaseTargetExists interface {
	ReleaseTargetExists(
		ctx context.Context,
		deploymentID, environmentID, resourceID string,
	) (bool, error)
}

var _ ReleaseTargetExists = (*PostgresReleaseTargetExists)(nil)

type PostgresReleaseTargetExists struct {
	cache *gocache.Cache
}

func NewReleaseTargetExists(opts ...Option) *PostgresReleaseTargetExists {
	return &PostgresReleaseTargetExists{cache: buildCache(opts)}
}

func (s *PostgresReleaseTargetExists) ReleaseTargetExists(
	ctx context.Context, deploymentID, environmentID, resourceID string,
) (bool, error) {
	ctx, span := tracer.Start(ctx, "Store.ReleaseTargetExists")
	defer span.End()

	cacheKey := deploymentID + ":" + environmentID + ":" + resourceID
	if s.cache != nil {
		if v, ok := s.cache.Get(cacheKey); ok {
			return v.(bool), nil
		}
	}

	depID, err := uuid.Parse(deploymentID)
	if err != nil {
		return false, fmt.Errorf("parse deployment id: %w", err)
	}

	envID, err := uuid.Parse(environmentID)
	if err != nil {
		return false, fmt.Errorf("parse environment id: %w", err)
	}

	resID, err := uuid.Parse(resourceID)
	if err != nil {
		return false, fmt.Errorf("parse resource id: %w", err)
	}

	exists, err := db.GetQueries(ctx).ReleaseTargetExists(ctx, db.ReleaseTargetExistsParams{
		DeploymentID:  depID,
		EnvironmentID: envID,
		ResourceID:    resID,
	})
	if err != nil {
		return false, fmt.Errorf("release target exists: %w", err)
	}

	if s.cache != nil {
		s.cache.SetDefault(cacheKey, exists)
	}

	return exists, nil
}
