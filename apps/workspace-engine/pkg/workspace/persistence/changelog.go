package persistence

import (
	"context"
	"time"
)

// Entity represents an object that can be tracked in a changelog
type Entity interface {
	// ChangelogKey returns the entity type and unique ID
	ChangelogKey() (entityType string, entityID string)
}

// ChangeType represents the type of change operation
type ChangeType string

const (
	ChangeTypeCreate ChangeType = "create"
	ChangeTypeUpdate ChangeType = "update"
	ChangeTypeDelete ChangeType = "delete"
)

// Change represents a single change event
type Change struct {
	WorkspaceID string
	ChangeType  ChangeType
	Entity      Entity
	Timestamp   time.Time
}

// Changelog is a collection of changes
type Changelog []Change

// Store is the main interface for persisting and loading changesets
type ChangelogStore interface {
	// Append adds changes to the changelog
	Append(ctx context.Context, changes Changelog) error

	// LoadAll retrieves all changes for a workspace
	LoadAll(ctx context.Context, workspaceID string) (Changelog, error)

	// Close closes any resources held by the store
	Close() error
}