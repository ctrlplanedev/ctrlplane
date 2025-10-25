package statechange

import (
	"sync"
	"time"
)

// StateChangeType represents the type of state change
type StateChangeType string

const (
	StateChangeCreate StateChangeType = "create"
	StateChangeUpdate StateChangeType = "update"
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

// RecordCreate records that an entity was created
func (cs *ChangeSet[T]) RecordCreate(entity T) {
	cs.mutex.Lock()
	defer cs.mutex.Unlock()

	cs.changes = append(cs.changes, StateChange[T]{
		Type:      StateChangeCreate,
		Entity:    entity,
		Timestamp: time.Now(),
	})
}

// RecordUpdate records that an entity was updated
func (cs *ChangeSet[T]) RecordUpdate(entity T) {
	cs.mutex.Lock()
	defer cs.mutex.Unlock()

	cs.changes = append(cs.changes, StateChange[T]{
		Type:      StateChangeUpdate,
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

// Count returns the number of changes recorded
func (cs *ChangeSet[T]) Count() int {
	cs.mutex.Lock()
	defer cs.mutex.Unlock()

	return len(cs.changes)
}

// Clear removes all recorded changes
func (cs *ChangeSet[T]) Clear() {
	cs.mutex.Lock()
	defer cs.mutex.Unlock()

	cs.changes = make([]StateChange[T], 0)
}

// IsEmpty returns true if no changes have been recorded
func (cs *ChangeSet[T]) IsEmpty() bool {
	cs.mutex.Lock()
	defer cs.mutex.Unlock()

	return len(cs.changes) == 0
}
