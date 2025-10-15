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
)

type Change[T any] struct {
	Type       ChangeType
	Entity     T
	Timestamp  time.Time
}

type ChangeSet[T any] struct {
	IsInitialLoad bool
	Changes       []Change[T]
	mutex         sync.Mutex
}

func NewChangeSet[T any]() *ChangeSet[T] {
	return &ChangeSet[T]{
		Changes: make([]Change[T], 0),
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

	cs.Changes = append(cs.Changes, Change[T]{
		Type:       changeType,
		Entity:     entity,
		Timestamp:  time.Now(),
	})
}

func (cs *ChangeSet[T]) Process() *Processor[T] {
	return NewProcessor(cs)
}
