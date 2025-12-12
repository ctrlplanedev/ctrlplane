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

// ChangeRecorder is the write-only interface for recording state changes.
// Use this in entity stores that only need to record changes.
type ChangeRecorder[T any] interface {
	// RecordUpsert records that an entity was created or updated.
	RecordUpsert(entity T)

	// RecordDelete records that an entity was deleted.
	RecordDelete(entity T)

	// Ignore causes subsequent Record calls to be ignored.
	Ignore()

	// Unignore resumes recording of changes.
	Unignore()

	// IsIgnored returns whether recording is currently ignored.
	IsIgnored() bool

	// Flush forces any pending changes to be saved immediately.
	Commit()
}

// ChangeSet is the full interface for recording AND reading state changes.
// Use this when you need to access the accumulated changes.
type ChangeSet[T any] interface {
	ChangeRecorder[T]

	// Changes returns a copy of all recorded changes.
	Changes() []StateChange[T]
}
