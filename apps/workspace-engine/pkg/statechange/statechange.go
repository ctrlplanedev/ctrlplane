package statechange

import (
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

// ChangeSet is the minimal interface for recording state changes.
// Use this when you only need to record changes (e.g., in entity stores).
type ChangeSet[T any] interface {
	// RecordUpsert records that an entity was created or updated.
	RecordUpsert(entity T)

	// RecordDelete records that an entity was deleted.
	RecordDelete(entity T)

	Ignore()
	Unignore()
	IsIgnored() bool
}

// BatchChangeSet extends ChangeSet with methods for batch operations.
// Use this when you need to read or clear recorded changes.
type BatchChangeSet[T any] interface {
	ChangeSet[T]

	// Changes returns a copy of all recorded changes.
	Changes() []StateChange[T]

	// Clear removes all recorded changes.
	Clear()
}
