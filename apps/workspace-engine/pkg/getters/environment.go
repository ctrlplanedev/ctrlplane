package getters

import (
	"context"
	"fmt"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/store"

	"github.com/google/uuid"
)

type EnvironmentGetter interface {
	GetEnvironment(ctx context.Context, environmentID string) (*oapi.Environment, error)
}

var _ EnvironmentGetter = (*PostgresEnvironmentGetter)(nil)

type PostgresEnvironmentGetter struct {
	queries *db.Queries
}

func NewPostgresEnvironmentGetter(queries *db.Queries) *PostgresEnvironmentGetter {
	return &PostgresEnvironmentGetter{queries: queries}
}

// GetEnvironment implements [EnvironmentGetter].
func (e *PostgresEnvironmentGetter) GetEnvironment(ctx context.Context, environmentID string) (*oapi.Environment, error) {
	environment, err := e.queries.GetEnvironmentByID(ctx, uuid.MustParse(environmentID))
	if err != nil {
		return nil, err
	}
	return db.ToOapiEnvironment(environment), nil
}

type StoreEnvironmentGetter struct {
	store *store.Store
}

func NewStoreEnvironmentGetter(store *store.Store) *StoreEnvironmentGetter {
	return &StoreEnvironmentGetter{store: store}
}

func (s *StoreEnvironmentGetter) GetEnvironment(ctx context.Context, environmentID string) (*oapi.Environment, error) {
	environment, ok := s.store.Environments.Get(environmentID)
	if !ok {
		return nil, fmt.Errorf("environment not found")
	}
	return environment, nil
}