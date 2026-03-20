package store

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/oapi"
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

func (g *PostgresReleaseGetter) GetRelease(
	ctx context.Context,
	releaseID string,
) (*oapi.Release, error) {
	releaseIDUUID, err := uuid.Parse(releaseID)
	if err != nil {
		return nil, fmt.Errorf("parse release id: %w", err)
	}
	release, err := g.queries.GetReleaseByID(ctx, releaseIDUUID)
	if err != nil {
		return nil, err
	}
	return db.ToOapiRelease(release), nil
}
