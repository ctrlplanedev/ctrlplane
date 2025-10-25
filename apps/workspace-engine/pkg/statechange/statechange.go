package statechange

import (
	"sync"
	"time"
)

// StateChangeType represents the type of state change
type StateChangeType string

const (
	StateChangeUpsert StateChangeType = "upsert"
	StateChangeDelete StateChangeType = "delete"
)

// StateChange represents a single state change to an entity
type StateChange[T any] struct {
	Type      StateChangeType
	Entity    T
	Timestamp time.Time
}

// ChangeSet tracks state changes for workspace entities
// This is purely for tracking what entities have been created, updated, or deleted
// and need to be persisted to the database.
type ChangeSet[T any] struct {
	changes []StateChange[T]
	mutex   sync.Mutex
}

// NewChangeSet creates a new workspace changeset
func NewChangeSet[T any]() *ChangeSet[T] {
	return &ChangeSet[T]{
		changes: make([]StateChange[T], 0),
	}
}

// RecordUpsert records that an entity was upserted
func (cs *ChangeSet[T]) RecordUpsert(entity T) {
	cs.mutex.Lock()
	defer cs.mutex.Unlock()

	cs.changes = append(cs.changes, StateChange[T]{
		Type:      StateChangeUpsert,
		Entity:    entity,
		Timestamp: time.Now(),
	})
}

// RecordDelete records that an entity was deleted
func (cs *ChangeSet[T]) RecordDelete(entity T) {
	cs.mutex.Lock()
	defer cs.mutex.Unlock()

	cs.changes = append(cs.changes, StateChange[T]{
		Type:      StateChangeDelete,
		Entity:    entity,
		Timestamp: time.Now(),
	})
}

// Changes returns a copy of all recorded changes
func (cs *ChangeSet[T]) Changes() []StateChange[T] {
	cs.mutex.Lock()
	defer cs.mutex.Unlock()

	result := make([]StateChange[T], len(cs.changes))
	copy(result, cs.changes)
	return result
}

// Clear removes all recorded changes
func (cs *ChangeSet[T]) Clear() {
	cs.mutex.Lock()
	defer cs.mutex.Unlock()

	cs.changes = make([]StateChange[T], 0)
}
