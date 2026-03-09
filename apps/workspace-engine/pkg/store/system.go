package store

import (
	"context"
	"fmt"
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
	sysUUID, err := uuid.Parse(systemID)
	if err != nil {
		return nil, fmt.Errorf("parse system id: %w", err)
	}
	system, err := g.queries.GetSystemByID(ctx, sysUUID)
	if err != nil {
		return nil, err
	}
	return db.ToOapiSystem(system), nil
}
