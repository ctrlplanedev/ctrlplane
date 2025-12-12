package statechange

// UnionChangeSet writes to multiple ChangeSets simultaneously.
// All underlying changesets receive the same changes.
type UnionChangeSet[T any] struct {
	batch      *InMemoryChangeSet[T]
	changesets []ChangeSet[T]
}

// NewUnionChangeSet creates a ChangeSet that broadcasts to all provided changesets.
func NewUnionChangeSet[T any](changesets ...ChangeSet[T]) *UnionChangeSet[T] {
	return &UnionChangeSet[T]{
		batch:      NewChangeSet[T](),
		changesets: changesets,
	}
}

// RecordUpsert records an upsert to all underlying changesets.
func (u *UnionChangeSet[T]) RecordUpsert(entity T) {
	for _, cs := range u.changesets {
		cs.RecordUpsert(entity)
	}
}

// RecordDelete records a delete to all underlying changesets.
func (u *UnionChangeSet[T]) RecordDelete(entity T) {
	for _, cs := range u.changesets {
		cs.RecordDelete(entity)
	}
}

func (u *UnionChangeSet[T]) Ignore() {
	u.batch.Ignore()
	for _, cs := range u.changesets {
		cs.Ignore()
	}
}

func (u *UnionChangeSet[T]) Unignore() {
	u.batch.Unignore()
	for _, cs := range u.changesets {
		cs.Unignore()
	}
}

func (u *UnionChangeSet[T]) IsIgnored() bool {
	if u.batch.IsIgnored() {
		return true
	}
	for _, cs := range u.changesets {
		if cs.IsIgnored() {
			return true
		}
	}
	return false
}

func (u *UnionChangeSet[T]) Changes() []StateChange[T] {
	return u.batch.Changes()
}

func (u *UnionChangeSet[T]) Clear() {
	u.batch.Clear()
}

var _ BatchChangeSet[any] = (*UnionChangeSet[any])(nil)
