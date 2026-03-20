package store

import (
	"context"

	"github.com/google/uuid"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/oapi"
)

type ResourceGetter interface {
	GetResource(ctx context.Context, resourceID string) (*oapi.Resource, error)
}

var _ ResourceGetter = (*PostgresResourceGetter)(nil)

type PostgresResourceGetter struct {
	queries *db.Queries
}

func NewPostgresResourceGetter(queries *db.Queries) *PostgresResourceGetter {
	return &PostgresResourceGetter{queries: queries}
}

func (g *PostgresResourceGetter) GetResource(
	ctx context.Context,
	resourceID string,
) (*oapi.Resource, error) {
	resource, err := g.queries.GetResourceByID(ctx, uuid.MustParse(resourceID))
	if err != nil {
		return nil, err
	}
	return db.ToOapiResource(resource), nil
}
