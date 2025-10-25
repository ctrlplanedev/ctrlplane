package persistence

import "time"

// ChangesBuilder builds a changes collection fluently
type ChangesBuilder struct {
	namespace string
	changes   Changes
}

// NewChangesBuilder creates a new changes builder
func NewChangesBuilder(namespace string) *ChangesBuilder {
	return &ChangesBuilder{
		namespace: namespace,
		changes:   make(Changes, 0),
	}
}

type ChangeOptions func(change *Change) *Change

func WithTimestamp(timestamp time.Time) ChangeOptions {
	return func(change *Change) *Change {
		change.Timestamp = timestamp
		return change
	}
}

// Set adds a set change (creates or updates an entity)
func (b *ChangesBuilder) Set(entity Entity, options ...ChangeOptions) *ChangesBuilder {
	change := &Change{
		Namespace:  b.namespace,
		ChangeType: ChangeTypeSet,
		Entity:     entity,
		Timestamp:  time.Now(),
	}
	for _, option := range options {
		option(change)
	}
	b.changes = append(b.changes, *change)
	return b
}

// Unset adds an unset change (deletes an entity)
func (b *ChangesBuilder) Unset(entity Entity, options ...ChangeOptions) *ChangesBuilder {
	change := &Change{
		Namespace:  b.namespace,
		ChangeType: ChangeTypeUnset,
		Entity:     entity,
		Timestamp:  time.Now(),
	}
	for _, option := range options {
		option(change)
	}
	b.changes = append(b.changes, *change)
	return b
}

// Build returns the built changes
func (b *ChangesBuilder) Build() Changes {
	return b.changes
}
