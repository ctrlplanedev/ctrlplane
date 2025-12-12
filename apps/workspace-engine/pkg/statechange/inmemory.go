package statechange

import (
	"context"
	"fmt"
	"sync"
	"time"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
)

var tracer = otel.Tracer("statechange")

// InMemoryChangeSet is an in-memory implementation of ChangeSet.
// Thread-safe and suitable for tracking changes during request processing.
type InMemoryChangeSet[T any] struct {
	changes  []StateChange[T]
	mutex    sync.Mutex
	ignored  bool
	ignoreMu sync.RWMutex
}

// NewChangeSet creates a new in-memory changeset.
func NewChangeSet[T any]() *InMemoryChangeSet[T] {
	return &InMemoryChangeSet[T]{
		changes: make([]StateChange[T], 0),
	}
}

// Ignore causes subsequent RecordUpsert and RecordDelete calls to be ignored.
func (cs *InMemoryChangeSet[T]) Ignore() {
	cs.ignoreMu.Lock()
	defer cs.ignoreMu.Unlock()
	cs.ignored = true
}

// Unignore resumes recording of changes.
func (cs *InMemoryChangeSet[T]) Unignore() {
	cs.ignoreMu.Lock()
	defer cs.ignoreMu.Unlock()
	cs.ignored = false
}

// IsIgnored returns whether recording is currently ignored.
func (cs *InMemoryChangeSet[T]) IsIgnored() bool {
	cs.ignoreMu.RLock()
	defer cs.ignoreMu.RUnlock()
	return cs.ignored
}

// RecordUpsert records that an entity was upserted.
func (cs *InMemoryChangeSet[T]) RecordUpsert(entity T) {
	cs.ignoreMu.RLock()
	if cs.ignored {
		cs.ignoreMu.RUnlock()
		return
	}
	cs.ignoreMu.RUnlock()

	cs.mutex.Lock()
	defer cs.mutex.Unlock()

	ctx := context.Background()

	_, span := tracer.Start(ctx, "RecordUpsert")
	defer span.End()

	span.SetAttributes(attribute.String("entity.type", fmt.Sprintf("%T", entity)))
	span.SetAttributes(attribute.String("entity.data", fmt.Sprintf("%+v", entity)))
	span.SetAttributes(attribute.String("entity.id", fmt.Sprintf("%v", entity)))
	span.SetAttributes(attribute.String("entity.timestamp", time.Now().Format(time.RFC3339)))

	cs.changes = append(cs.changes, StateChange[T]{
		Type:      StateChangeUpsert,
		Entity:    entity,
		Timestamp: time.Now(),
	})
}

// RecordDelete records that an entity was deleted.
func (cs *InMemoryChangeSet[T]) RecordDelete(entity T) {
	cs.ignoreMu.RLock()
	if cs.ignored {
		cs.ignoreMu.RUnlock()
		return
	}
	cs.ignoreMu.RUnlock()

	cs.mutex.Lock()
	defer cs.mutex.Unlock()

	cs.changes = append(cs.changes, StateChange[T]{
		Type:      StateChangeDelete,
		Entity:    entity,
		Timestamp: time.Now(),
	})
}

// Changes returns a copy of all recorded changes.
func (cs *InMemoryChangeSet[T]) Changes() []StateChange[T] {
	cs.mutex.Lock()
	defer cs.mutex.Unlock()

	result := make([]StateChange[T], len(cs.changes))
	copy(result, cs.changes)
	return result
}

// Clear removes all recorded changes.
func (cs *InMemoryChangeSet[T]) Commit() {
	cs.mutex.Lock()
	defer cs.mutex.Unlock()

	cs.changes = make([]StateChange[T], 0)
}

// Flush forces any pending changes to be saved immediately.
func (cs *InMemoryChangeSet[T]) Flush() {
	// No-op for in-memory changeset
}

var _ ChangeSet[any] = (*InMemoryChangeSet[any])(nil)
