package deploymentwindow

import (
	"context"
	"fmt"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/store"

	"github.com/google/uuid"
)

type Getters interface {
	HasCurrentRelease(ctx context.Context, releaseTarget *oapi.ReleaseTarget) (bool, error)
}

var _ Getters = (*StoreGetters)(nil)

type StoreGetters struct {
	store *store.Store
}

func (s *StoreGetters) HasCurrentRelease(ctx context.Context, releaseTarget *oapi.ReleaseTarget) (bool, error) {
	_, _, err := s.store.ReleaseTargets.GetCurrentRelease(ctx, releaseTarget)
	return err == nil, err
}

var _ Getters = (*PostgresGetters)(nil)

type PostgresGetters struct {
	queries *db.Queries
}

func (g *PostgresGetters) HasCurrentRelease(ctx context.Context, releaseTarget *oapi.ReleaseTarget) (bool, error) {
	releases, err := db.GetQueries(ctx).ListReleasesByReleaseTarget(ctx, db.ListReleasesByReleaseTargetParams{
		ResourceID:    uuid.MustParse(releaseTarget.ResourceId),
		EnvironmentID: uuid.MustParse(releaseTarget.EnvironmentId),
		DeploymentID:  uuid.MustParse(releaseTarget.DeploymentId),
	})
	if err != nil {
		return false, fmt.Errorf("list releases for release target: %w", err)
	}
	return len(releases) > 0, nil
}
