package persistence

import (
	"context"
)

// Manager orchestrates loading snapshots and applying them
type Manager struct {
	store    Store
	registry *ApplyRegistry
}

func NewManager(store Store, registry *ApplyRegistry) *Manager {
	return &Manager{
		store:    store,
		registry: registry,
	}
}

func (m *Manager) ApplyRegistry() *ApplyRegistry {
	return m.registry
}

func (m *Manager) Store() Store {
	return m.store
}

// Restore loads and applies the current state snapshot for a namespace
func (m *Manager) Restore(ctx context.Context, namespace string) error {
	changes, err := m.store.Load(ctx, namespace)
	if err != nil {
		return err
	}

	return m.registry.Apply(ctx, changes)
}

// Persist saves new changes to the store (will be compacted per entity)
func (m *Manager) Persist(ctx context.Context, changes Changes) error {
	return m.store.Save(ctx, changes)
}

// ManagerBuilder builds a manager fluently
type ManagerBuilder struct {
	store    Store
	registry *ApplyRegistry
}

// NewManagerBuilder creates a new manager builder
func NewManagerBuilder() *ManagerBuilder {
	return &ManagerBuilder{
		registry: NewApplyRegistry(),
	}
}

// WithStore sets the store
func (b *ManagerBuilder) WithStore(store Store) *ManagerBuilder {
	b.store = store
	return b
}

// RegisterRepository registers a repository
func (b *ManagerBuilder) RegisterRepository(entityType string, repo Repository[any]) *ManagerBuilder {
	b.registry.Register(entityType, repo)
	return b
}

// Build creates the manager
func (b *ManagerBuilder) Build() *Manager {
	return NewManager(b.store, b.registry)
}
