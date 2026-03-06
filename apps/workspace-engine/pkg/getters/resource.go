package getters

import (
	"context"
	"fmt"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/store"

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

// GetResource implements [ResourceGetter].
func (r *PostgresResourceGetter) GetResource(ctx context.Context, resourceID string) (*oapi.Resource, error) {
	resource, err := r.queries.GetResourceByID(ctx, uuid.MustParse(resourceID))
	if err != nil {
		return nil, err
	}
	return db.ToOapiResource(resource), nil
}

type StoreResourceGetter struct {
	store *store.Store
}

func NewStoreResourceGetter(store *store.Store) *StoreResourceGetter {
	return &StoreResourceGetter{store: store}
}

func (s *StoreResourceGetter) GetResource(ctx context.Context, resourceID string) (*oapi.Resource, error) {
	resource, ok := s.store.Resources.Get(resourceID)
	if !ok {
		return nil, fmt.Errorf("resource not found")
	}
	return resource, nil
}