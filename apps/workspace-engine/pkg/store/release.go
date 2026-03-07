package store

import (
	"context"
	"fmt"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/oapi"
	legacystore "workspace-engine/pkg/workspace/store"

	"github.com/google/uuid"
)

type ReleaseGetter interface {
	GetRelease(ctx context.Context, releaseID string) (*oapi.Release, error)
}

var _ ReleaseGetter = (*PostgresReleaseGetter)(nil)

type PostgresReleaseGetter struct {
	queries *db.Queries
}

func NewPostgresReleaseGetter(queries *db.Queries) *PostgresReleaseGetter {
	return &PostgresReleaseGetter{queries: queries}
}

func (g *PostgresReleaseGetter) GetRelease(ctx context.Context, releaseID string) (*oapi.Release, error) {
	release, err := g.queries.GetReleaseByID(ctx, uuid.MustParse(releaseID))
	if err != nil {
		return nil, err
	}
	return db.ToOapiRelease(release), nil
}

type StoreReleaseGetter struct {
	store *legacystore.Store
}

func NewStoreReleaseGetter(store *legacystore.Store) *StoreReleaseGetter {
	return &StoreReleaseGetter{store: store}
}

func (s *StoreReleaseGetter) GetRelease(ctx context.Context, releaseID string) (*oapi.Release, error) {
	release, ok := s.store.Releases.Get(releaseID)
	if !ok {
		return nil, fmt.Errorf("release not found")
	}
	return release, nil
}
