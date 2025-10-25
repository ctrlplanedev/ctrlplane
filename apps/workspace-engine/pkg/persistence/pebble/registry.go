package pebble

import (
	"encoding/json"
	"fmt"
	"sync"

	"workspace-engine/pkg/persistence"
)

// EntityFactory is a function that creates a new instance of an entity
type EntityFactory func() persistence.Entity

// EntityRegistry manages entity type registrations for marshaling/unmarshaling
type EntityRegistry struct {
	mu        sync.RWMutex
	factories map[string]EntityFactory
}

// NewEntityRegistry creates a new entity registry
func NewEntityRegistry() *EntityRegistry {
	return &EntityRegistry{
		factories: make(map[string]EntityFactory),
	}
}

// Register registers an entity type with its factory function
func (r *EntityRegistry) Register(entityType string, factory EntityFactory) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.factories[entityType] = factory
}

// Unmarshal unmarshals JSON data into the appropriate entity type
func (r *EntityRegistry) Unmarshal(entityType string, data json.RawMessage) (persistence.Entity, error) {
	r.mu.RLock()
	factory, exists := r.factories[entityType]
	r.mu.RUnlock()

	if !exists {
		return nil, fmt.Errorf("no factory registered for entity type: %s", entityType)
	}

	entity := factory()
	if err := json.Unmarshal(data, entity); err != nil {
		return nil, fmt.Errorf("failed to unmarshal entity: %w", err)
	}

	return entity, nil
}

// IsRegistered checks if an entity type is registered
func (r *EntityRegistry) IsRegistered(entityType string) bool {
	r.mu.RLock()
	defer r.mu.RUnlock()
	_, exists := r.factories[entityType]
	return exists
}

