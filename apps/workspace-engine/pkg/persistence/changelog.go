package persistence

import (
	"context"
	"time"
)

// Entity represents an object that can be persisted
type Entity interface {
	// CompactionKey returns the entity type and unique ID used for topic compaction.
	// Entities with the same compaction key will be deduplicated, keeping only the latest.
	CompactionKey() (entityType string, entityID string)
}

// ChangeType represents the type of change operation
type ChangeType string

const (
	ChangeTypeSet   ChangeType = "set"
	ChangeTypeUnset ChangeType = "unset"
)

// Change represents a single change event
type Change struct {
	Namespace  string
	ChangeType ChangeType
	Entity     Entity
	Timestamp  time.Time
}

// Changes is a collection of changes representing the current state.
// Conceptually, each entity should appear at most once with its latest state.
// This is NOT a full historical log - it's the minimal set of changes needed to reconstruct current state.
type Changes []Change

// Store is the main interface for persisting and loading state snapshots.
// Implementations use topic compaction (e.g., Kafka compacted topics) so that
// only the latest state of each entity is stored, not the full history.
type Store interface {
	// Save persists new changes, will be compacted with existing state per entity
	Save(ctx context.Context, changes Changes) error

	// Load retrieves the current state for a namespace.
	// NOTE: May contain duplicates if using async compaction (e.g., Kafka).
	// Consumers should keep only the latest change per entity (by timestamp).
	// This is NOT reading from "the beginning of time" - the store uses topic
	// compaction to minimize storage and only returns recent state per entity.
	Load(ctx context.Context, namespace string) (Changes, error)

	// Close closes any resources held by the store
	Close() error
}
