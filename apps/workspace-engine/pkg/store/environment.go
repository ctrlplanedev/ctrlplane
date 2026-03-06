package store

import (
	"context"
	"fmt"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/oapi"
	legacystore "workspace-engine/pkg/workspace/store"

	"github.com/google/uuid"
)

type EnvironmentGetter interface {
	GetEnvironment(ctx context.Context, environmentID string) (*oapi.Environment, error)
	GetAllEnvironments(ctx context.Context, workspaceID string) (map[string]*oapi.Environment, error)
}

var _ EnvironmentGetter = (*PostgresEnvironmentGetter)(nil)

type PostgresEnvironmentGetter struct {
	queries *db.Queries
}

func NewPostgresEnvironmentGetter(queries *db.Queries) *PostgresEnvironmentGetter {
	return &PostgresEnvironmentGetter{queries: queries}
}

func (g *PostgresEnvironmentGetter) GetEnvironment(ctx context.Context, environmentID string) (*oapi.Environment, error) {
	env, err := g.queries.GetEnvironmentByID(ctx, uuid.MustParse(environmentID))
	if err != nil {
		return nil, err
	}
	return db.ToOapiEnvironment(env), nil
}

func (g *PostgresEnvironmentGetter) GetAllEnvironments(ctx context.Context, workspaceID string) (map[string]*oapi.Environment, error) {
	envs, err := g.queries.ListEnvironmentsByWorkspaceID(ctx, db.ListEnvironmentsByWorkspaceIDParams{
		WorkspaceID: uuid.MustParse(workspaceID),
	})
	if err != nil {
		return nil, err
	}
	result := make(map[string]*oapi.Environment, len(envs))
	for _, env := range envs {
		result[env.ID.String()] = db.ToOapiEnvironment(env)
	}
	return result, nil
}

var _ EnvironmentGetter = (*StoreEnvironmentGetter)(nil)

type StoreEnvironmentGetter struct {
	store *legacystore.Store
}

func NewStoreEnvironmentGetter(store *legacystore.Store) EnvironmentGetter {
	return &StoreEnvironmentGetter{store: store}
}

func (s *StoreEnvironmentGetter) GetEnvironment(ctx context.Context, environmentID string) (*oapi.Environment, error) {
	env, ok := s.store.Environments.Get(environmentID)
	if !ok {
		return nil, fmt.Errorf("environment not found")
	}
	return env, nil
}

func (s *StoreEnvironmentGetter) GetAllEnvironments(ctx context.Context, _ string) (map[string]*oapi.Environment, error) {
	envs := s.store.Environments.Items()
	return envs, nil
}
