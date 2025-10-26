package persistence

import (
	"encoding/json"
	"fmt"
	"sync"
)

// EntityFactory is a function that creates a new instance of an entity
type EntityFactory func() Entity

// JSONEntityRegistry manages entity type registrations for JSON marshaling/unmarshaling.
// It maps entity type names to factory functions that create empty instances,
// enabling deserialization of persisted JSON entities back into their concrete types.
type JSONEntityRegistry struct {
	mu        sync.RWMutex
	factories map[string]EntityFactory
}

// NewJSONEntityRegistry creates a new JSON entity registry
func NewJSONEntityRegistry() *JSONEntityRegistry {
	return &JSONEntityRegistry{
		factories: make(map[string]EntityFactory),
	}
}

// Register registers an entity type with its factory function
func (r *JSONEntityRegistry) Register(entityType string, factory EntityFactory) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.factories[entityType] = factory
}

// Unmarshal unmarshals JSON data into the appropriate entity type
func (r *JSONEntityRegistry) Unmarshal(entityType string, data json.RawMessage) (Entity, error) {
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
func (r *JSONEntityRegistry) IsRegistered(entityType string) bool {
	r.mu.RLock()
	defer r.mu.RUnlock()
	_, exists := r.factories[entityType]
	return exists
}

