package persistence

import (
	"encoding/json"
	"fmt"
	"sync"
)

// EntityFactory is a function that creates a new instance of an entity
type EntityFactory func() Entity

// MigrationFunc is a function that migrates data from one version to another.
type MigrationFunc func(entityType string, data map[string]any) (map[string]any, error)

// Migration transforms raw JSON data before deserialization. Migrations are
// applied in registration order, allowing incremental schema evolution.
type Migration struct {
	Name    string
	Migrate MigrationFunc
}

// JSONEntityRegistry manages entity type registrations for JSON marshaling/unmarshaling.
// It maps entity type names to factory functions that create empty instances,
// enabling deserialization of persisted JSON entities back into their concrete types.
// It also supports migrations that transform raw JSON before deserialization.
type JSONEntityRegistry struct {
	mu         sync.RWMutex
	factories  map[string]EntityFactory
	migrations map[string][]Migration
}

// NewJSONEntityRegistry creates a new JSON entity registry
func NewJSONEntityRegistry() *JSONEntityRegistry {
	return &JSONEntityRegistry{
		factories:  make(map[string]EntityFactory),
		migrations: make(map[string][]Migration),
	}
}

// Register registers an entity type with its factory function
func (r *JSONEntityRegistry) Register(entityType string, factory EntityFactory) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.factories[entityType] = factory
}

// RegisterMigration appends a migration for the given entity type. Migrations
// run in the order they are registered during Unmarshal and MigrateRaw.
func (r *JSONEntityRegistry) RegisterMigration(entityType string, m Migration) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.migrations[entityType] = append(r.migrations[entityType], m)
}

// MigrateRaw applies all registered migrations for entityType to the raw JSON
// data. It returns the (possibly transformed) JSON. If no migrations are
// registered the data is returned unchanged.
func (r *JSONEntityRegistry) MigrateRaw(entityType string, data json.RawMessage) (json.RawMessage, error) {
	r.mu.RLock()
	migrations := append([]Migration(nil), r.migrations[entityType]...)
	r.mu.RUnlock()

	if len(migrations) == 0 {
		return data, nil
	}

	var m map[string]any
	if err := json.Unmarshal(data, &m); err != nil {
		return nil, fmt.Errorf("failed to unmarshal raw JSON for migration: %w", err)
	}

	for _, mig := range migrations {
		migrated, err := mig.Migrate(entityType, m)
		if err != nil {
			return nil, fmt.Errorf("migration %q failed: %w", mig.Name, err)
		}
		m = migrated
	}

	result, err := json.Marshal(m)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal migrated data: %w", err)
	}
	return result, nil
}

// Unmarshal deserializes JSON data into the appropriate entity type. Registered
// migrations are applied to the raw JSON before the entity is constructed.
func (r *JSONEntityRegistry) Unmarshal(entityType string, data json.RawMessage) (Entity, error) {
	migrated, err := r.MigrateRaw(entityType, data)
	if err != nil {
		return nil, err
	}

	r.mu.RLock()
	factory, exists := r.factories[entityType]
	r.mu.RUnlock()

	if !exists {
		return nil, fmt.Errorf("no factory registered for entity type: %s", entityType)
	}

	entity := factory()
	if err := json.Unmarshal(migrated, entity); err != nil {
		return nil, fmt.Errorf("failed to unmarshal entity: %w", err)
	}

	return entity, nil
}

// IsRegistered checks if an entity type is registered
func (r *JSONEntityRegistry) IsRegistered(entityType string) bool {
	r.mu.RLock()
	defer r.mu.RUnlock()
	_, exists := r.factories[entityType]
	return exists
}
