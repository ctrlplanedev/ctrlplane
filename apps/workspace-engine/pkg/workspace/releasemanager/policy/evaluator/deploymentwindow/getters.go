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

var _ Getters = (*storeGetters)(nil)

type storeGetters struct {
	store *store.Store
}

func (s *storeGetters) HasCurrentRelease(ctx context.Context, releaseTarget *oapi.ReleaseTarget) (bool, error) {
	_, _, err := s.store.ReleaseTargets.GetCurrentRelease(ctx, releaseTarget)
	return err == nil, nil
}

var _ Getters = (*postgresGetters)(nil)

type postgresGetters struct {
	queries *db.Queries
}

func NewPostgresGetters(queries *db.Queries) *postgresGetters {
	return &postgresGetters{queries: queries}
}

func (g *postgresGetters) HasCurrentRelease(ctx context.Context, releaseTarget *oapi.ReleaseTarget) (bool, error) {
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