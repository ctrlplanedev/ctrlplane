package statechange

// UnionChangeSet writes to multiple ChangeRecorders simultaneously.
// It also maintains its own batch of changes for reading.
type UnionChangeSet[T any] struct {
	changeSet ChangeSet[T]
	recorders []ChangeRecorder[T]
}

// NewUnionChangeSet creates a ChangeSet that broadcasts to all provided recorders.
// The recorders only need write access (ChangeRecorder), while the UnionChangeSet
// itself implements full ChangeSet for reading the accumulated changes.
func NewUnionChangeSet[T any](changeSet ChangeSet[T], recorders ...ChangeRecorder[T]) *UnionChangeSet[T] {
	return &UnionChangeSet[T]{
		changeSet: changeSet,
		recorders: recorders,
	}
}

// RecordUpsert records an upsert to the batch and all underlying recorders.
func (u *UnionChangeSet[T]) RecordUpsert(entity T) {
	if u.changeSet != nil {
		u.changeSet.RecordUpsert(entity)
	}
	for _, r := range u.recorders {
		r.RecordUpsert(entity)
	}
}

// RecordDelete records a delete to the batch and all underlying recorders.
func (u *UnionChangeSet[T]) RecordDelete(entity T) {
	if u.changeSet != nil {
		u.changeSet.RecordDelete(entity)
	}
	for _, r := range u.recorders {
		r.RecordDelete(entity)
	}
}

// Ignore causes subsequent Record calls to be ignored.
func (u *UnionChangeSet[T]) Ignore() {
	if u.changeSet != nil {
		u.changeSet.Ignore()
	}
	for _, r := range u.recorders {
		r.Ignore()
	}
}

// Unignore resumes recording of changes.
func (u *UnionChangeSet[T]) Unignore() {
	if u.changeSet != nil {
		u.changeSet.Unignore()
	}
	for _, r := range u.recorders {
		r.Unignore()
	}
}

// IsIgnored returns whether recording is currently ignored.
// Returns true if the batch OR any inner recorder is ignored.
func (u *UnionChangeSet[T]) IsIgnored() bool {
	if u.changeSet != nil && u.changeSet.IsIgnored() {
		return true
	}
	for _, r := range u.recorders {
		if r.IsIgnored() {
			return true
		}
	}
	return false
}

// Changes returns a copy of all recorded changes from the internal batch.
func (u *UnionChangeSet[T]) Changes() []StateChange[T] {
	if u.changeSet != nil {
		return u.changeSet.Changes()
	}
	return []StateChange[T]{}
}


func (u *UnionChangeSet[T]) Commit() {
	if u.changeSet != nil {
		u.changeSet.Commit()
	}
	for _, r := range u.recorders {
		r.Commit()
	}
}

var _ ChangeSet[any] = (*UnionChangeSet[any])(nil)
