package store

import (
	"context"
	"fmt"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/oapi"
	legacystore "workspace-engine/pkg/workspace/store"

	"github.com/google/uuid"
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

func (g *PostgresResourceGetter) GetResource(ctx context.Context, resourceID string) (*oapi.Resource, error) {
	resUUID, err := uuid.Parse(resourceID)
	if err != nil {
		return nil, fmt.Errorf("parse resource id: %w", err)
	}
	resource, err := g.queries.GetResourceByID(ctx, resUUID)
	if err != nil {
		return nil, err
	}
	return db.ToOapiResource(resource), nil
}

type StoreResourceGetter struct {
	store *legacystore.Store
}

func NewStoreResourceGetter(store *legacystore.Store) *StoreResourceGetter {
	return &StoreResourceGetter{store: store}
}

func (s *StoreResourceGetter) GetResource(ctx context.Context, resourceID string) (*oapi.Resource, error) {
	resource, ok := s.store.Resources.Get(resourceID)
	if !ok {
		return nil, fmt.Errorf("resource not found")
	}
	return resource, nil
}
