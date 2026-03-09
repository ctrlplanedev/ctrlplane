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

func NewStoreGetters(store *store.Store) *StoreGetters {
	return &StoreGetters{store: store}
}

type StoreGetters struct {
	store *store.Store
}

func (s *StoreGetters) HasCurrentRelease(ctx context.Context, releaseTarget *oapi.ReleaseTarget) (bool, error) {
	_, _, err := s.store.ReleaseTargets.GetCurrentRelease(ctx, releaseTarget)
	if err != nil {
		return false, nil
	}
	return true, nil
}

var _ Getters = (*PostgresGetters)(nil)

func NewPostgresGetters(queries *db.Queries) *PostgresGetters {
	return &PostgresGetters{
		queries: queries,
	}
}

type PostgresGetters struct {
	queries *db.Queries
}

func (g *PostgresGetters) HasCurrentRelease(ctx context.Context, releaseTarget *oapi.ReleaseTarget) (bool, error) {
	resourceUUID, err := uuid.Parse(releaseTarget.ResourceId)
	if err != nil {
		return false, fmt.Errorf("parse resource id: %w", err)
	}
	envUUID, err := uuid.Parse(releaseTarget.EnvironmentId)
	if err != nil {
		return false, fmt.Errorf("parse environment id: %w", err)
	}
	depUUID, err := uuid.Parse(releaseTarget.DeploymentId)
	if err != nil {
		return false, fmt.Errorf("parse deployment id: %w", err)
	}
	releases, err := db.GetQueries(ctx).ListReleasesByReleaseTarget(ctx, db.ListReleasesByReleaseTargetParams{
		ResourceID:    resourceUUID,
		EnvironmentID: envUUID,
		DeploymentID:  depUUID,
	})
	if err != nil {
		return false, fmt.Errorf("list releases for release target: %w", err)
	}
	return len(releases) > 0, nil
}
