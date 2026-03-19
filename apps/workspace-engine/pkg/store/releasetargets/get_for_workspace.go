package releasetargets

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	gocache "github.com/patrickmn/go-cache"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/oapi"
)

type GetAllReleaseTargets interface {
	GetAllReleaseTargets(ctx context.Context, workspaceID string) ([]oapi.ReleaseTarget, error)
}

var _ GetAllReleaseTargets = (*PostgresGetAllReleaseTargets)(nil)

type PostgresGetAllReleaseTargets struct {
	cache *gocache.Cache
}

func NewGetAllReleaseTargets(opts ...Option) *PostgresGetAllReleaseTargets {
	return &PostgresGetAllReleaseTargets{cache: buildCache(opts)}
}

func (s *PostgresGetAllReleaseTargets) GetAllReleaseTargets(
	ctx context.Context, workspaceID string,
) ([]oapi.ReleaseTarget, error) {
	ctx, span := tracer.Start(ctx, "Store.GetAllReleaseTargets")
	defer span.End()

	if s.cache != nil {
		if v, ok := s.cache.Get(workspaceID); ok {
			return v.([]oapi.ReleaseTarget), nil
		}
	}

	wsID, err := uuid.Parse(workspaceID)
	if err != nil {
		return nil, fmt.Errorf("parse workspace id: %w", err)
	}

	rows, err := db.GetQueries(ctx).GetReleaseTargetsForWorkspace(ctx, wsID)
	if err != nil {
		return nil, fmt.Errorf("get release targets for workspace: %w", err)
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
		s.cache.SetDefault(workspaceID, targets)
	}

	return targets, nil
}
