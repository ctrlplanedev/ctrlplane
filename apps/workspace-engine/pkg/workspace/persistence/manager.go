package persistence

import (
	"context"
	"errors"
)

// Manager orchestrates loading changesets and applying them
type Manager struct {
	store    ChangelogStore
	registry *ApplyRegistry
}

func NewManager(store ChangelogStore, registry *ApplyRegistry) *Manager {
	return &Manager{
		store:    store,
		registry: registry,
	}
}

// Restore loads and applies all changes for a workspace
func (m *Manager) Restore(ctx context.Context, workspaceID string) error {
	changes, err := m.store.LoadAll(ctx, workspaceID)
	if err != nil {
		return err
	}

	return m.registry.Apply(ctx, changes)
}

// Persist appends new changes to the store
func (m *Manager) Persist(ctx context.Context, changes Changelog) error {
	return m.store.Append(ctx, changes)
}

// ManagerBuilder builds a manager fluently
type ManagerBuilder struct {
	store    ChangelogStore
	registry *ApplyRegistry
}

// NewManagerBuilder creates a new manager builder
func NewManagerBuilder() *ManagerBuilder {
	return &ManagerBuilder{
		registry: NewApplyRegistry(),
	}
}

// WithStore sets the store
func (b *ManagerBuilder) WithStore(store ChangelogStore) *ManagerBuilder {
	b.store = store
	return b
}

// RegisterRepository registers a repository
func (b *ManagerBuilder) RegisterRepository(entityType string, repo Repository[any]) *ManagerBuilder {
	b.registry.Register(entityType, repo)
	return b
}

// Build creates the manager
func (b *ManagerBuilder) Build() (*Manager, error) {
	if b.store == nil {
		return nil, errors.New("store is required")
	}
	return NewManager(b.store, b.registry), nil
}