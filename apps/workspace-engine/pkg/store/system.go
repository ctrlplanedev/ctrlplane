package store

import (
	"context"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/oapi"

	"github.com/google/uuid"
)

type SystemGetter interface {
	GetSystem(ctx context.Context, systemID string) (*oapi.System, error)
}

var _ SystemGetter = (*PostgresSystemGetter)(nil)

type PostgresSystemGetter struct {
	queries *db.Queries
}

func NewPostgresSystemGetter(queries *db.Queries) *PostgresSystemGetter {
	return &PostgresSystemGetter{queries: queries}
}

func (g *PostgresSystemGetter) GetSystem(ctx context.Context, systemID string) (*oapi.System, error) {
	system, err := g.queries.GetSystemByID(ctx, uuid.MustParse(systemID))
	if err != nil {
		return nil, err
	}
	return db.ToOapiSystem(system), nil
}
