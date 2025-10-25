package persistence

import "time"

// ChangelogBuilder builds a changelog fluently
type ChangelogBuilder struct {
	workspaceID string
	changes     Changelog
}

// NewChangelogBuilder creates a new changelog builder
func NewChangelogBuilder(workspaceID string) *ChangelogBuilder {
	return &ChangelogBuilder{
		workspaceID: workspaceID,
		changes:     make(Changelog, 0),
	}
}

type ChangeOptions func(change *Change) *Change

func WithTimestamp(timestamp time.Time) ChangeOptions {
	return func(change *Change) *Change {
		change.Timestamp = timestamp
		return change
	}
}

// Create adds a create change
func (b *ChangelogBuilder) Create(entity Entity, options ...ChangeOptions) *ChangelogBuilder {
	change := &Change{
		WorkspaceID: b.workspaceID,
		ChangeType:  ChangeTypeCreate,
		Entity:      entity,
		Timestamp:   time.Now(),
	}
	for _, option := range options {
		option(change)
	}
	b.changes = append(b.changes, *change)
	return b
}

// Update adds an update change
func (b *ChangelogBuilder) Update(entity Entity, options ...ChangeOptions) *ChangelogBuilder {
	change := &Change{
		WorkspaceID: b.workspaceID,
		ChangeType:  ChangeTypeUpdate,
		Entity:      entity,
		Timestamp:   time.Now(),
	}
	for _, option := range options {
		option(change)
	}
	b.changes = append(b.changes, *change)
	return b
}

// Delete adds a delete change
func (b *ChangelogBuilder) Delete(entity Entity, options ...ChangeOptions) *ChangelogBuilder {
	change := &Change{
		WorkspaceID: b.workspaceID,
		ChangeType:  ChangeTypeDelete,
		Entity:      entity,
		Timestamp:   time.Now(),
	}
	for _, option := range options {
		option(change)
	}
	b.changes = append(b.changes, *change)
	return b
}

// Build returns the built changelog
func (b *ChangelogBuilder) Build() Changelog {
	return b.changes
}
