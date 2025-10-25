package changeset

import (
	"sync"
	"time"
)

type ChangeType string

const (
	ChangeTypeCreate ChangeType = "create"
	ChangeTypeUpdate ChangeType = "update"
	ChangeTypeDelete ChangeType = "delete"
	ChangeTypeTaint  ChangeType = "taint"
	ChangeTypeUpsert ChangeType = "upsert"
)

type Change[T any] struct {
	Type      ChangeType
	Entity    T
	Timestamp time.Time
}

type ChangeSet[T any] struct {
	IsInitialLoad bool
	Changes       []Change[T]
	mutex         sync.Mutex
	keyFunc       func(T) string
	changeMap     map[string]Change[T] // for deduplication when keyFunc is provided
}

func NewChangeSet[T any]() *ChangeSet[T] {
	return &ChangeSet[T]{
		Changes: make([]Change[T], 0),
	}
}

// NewChangeSetWithDedup creates a changeset that deduplicates entries by key
// The keyFunc should return a unique identifier for each entity
func NewChangeSetWithDedup[T any](keyFunc func(T) string) *ChangeSet[T] {
	return &ChangeSet[T]{
		Changes:   make([]Change[T], 0),
		keyFunc:   keyFunc,
		changeMap: make(map[string]Change[T]),
	}
}

func (cs *ChangeSet[T]) Lock() {
	cs.mutex.Lock()
}

func (cs *ChangeSet[T]) Unlock() {
	cs.mutex.Unlock()
}

func (cs *ChangeSet[T]) Record(changeType ChangeType, entity T) {
	cs.mutex.Lock()
	defer cs.mutex.Unlock()

	change := Change[T]{
		Type:      changeType,
		Entity:    entity,
		Timestamp: time.Now(),
	}

	// If deduplication is enabled, use the map
	if cs.keyFunc != nil {
		key := cs.keyFunc(entity)
		cs.changeMap[key] = change
	} else {
		// No deduplication, just append
		cs.Changes = append(cs.Changes, change)
	}
}

// Finalize converts the internal map to the Changes slice (for dedup mode)
// Call this before accessing Changes when using deduplication
func (cs *ChangeSet[T]) Finalize() {
	cs.mutex.Lock()
	defer cs.mutex.Unlock()

	if cs.keyFunc != nil && len(cs.changeMap) > 0 {
		cs.Changes = make([]Change[T], 0, len(cs.changeMap))
		for _, change := range cs.changeMap {
			cs.Changes = append(cs.Changes, change)
		}
	}
}

func (cs *ChangeSet[T]) Process() *Processor[T] {
	// Auto-finalize if using deduplication
	if cs.keyFunc != nil {
		cs.Finalize()
	}
	return NewProcessor(cs)
}

// Count returns the number of changes (handles dedup mode automatically)
func (cs *ChangeSet[T]) Count() int {
	cs.mutex.Lock()
	defer cs.mutex.Unlock()

	if cs.keyFunc != nil {
		return len(cs.changeMap)
	}
	return len(cs.Changes)
}

// Clear resets the changeset, removing all recorded changes
func (cs *ChangeSet[T]) Clear() {
	cs.mutex.Lock()
	defer cs.mutex.Unlock()

	cs.Changes = make([]Change[T], 0)
	cs.IsInitialLoad = false

	if cs.keyFunc != nil {
		cs.changeMap = make(map[string]Change[T])
	}
}
