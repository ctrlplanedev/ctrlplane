package statechange

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestUnionChangeSet_Basic(t *testing.T) {
	main := NewChangeSet[TestEntity]()
	r1 := NewChangeSet[TestEntity]()
	r2 := NewChangeSet[TestEntity]()

	union := NewUnionChangeSet[TestEntity](main, r1, r2)

	// Record changes through union
	union.RecordUpsert(TestEntity{ID: "1", Name: "First"})
	union.RecordDelete(TestEntity{ID: "2", Name: "Second"})
	union.RecordUpsert(TestEntity{ID: "3", Name: "Third"})

	// All changesets should have the same changes
	for i, cs := range []*InMemoryChangeSet[TestEntity]{main, r1, r2} {
		changes := cs.Changes()
		assert.Len(t, changes, 3, "changeset %d should have 3 changes", i)

		assert.Equal(t, StateChangeUpsert, changes[0].Type)
		assert.Equal(t, "1", changes[0].Entity.ID)

		assert.Equal(t, StateChangeDelete, changes[1].Type)
		assert.Equal(t, "2", changes[1].Entity.ID)

		assert.Equal(t, StateChangeUpsert, changes[2].Type)
		assert.Equal(t, "3", changes[2].Entity.ID)
	}

	// Also verify union.Changes() returns the same
	assert.Len(t, union.Changes(), 3)
}

func TestUnionChangeSet_Empty(t *testing.T) {
	main := NewChangeSet[TestEntity]()
	union := NewUnionChangeSet[TestEntity](main)

	// Should not panic with no additional recorders
	union.RecordUpsert(TestEntity{ID: "1", Name: "Test"})
	union.RecordDelete(TestEntity{ID: "2", Name: "Test"})

	assert.Len(t, union.Changes(), 2)
}

func TestUnionChangeSet_NilChangeSet(t *testing.T) {
	union := NewUnionChangeSet[TestEntity](nil)

	// Should not panic with nil changeset
	union.RecordUpsert(TestEntity{ID: "1", Name: "Test"})
	union.RecordDelete(TestEntity{ID: "2", Name: "Test"})

	// Changes should return empty slice
	assert.Len(t, union.Changes(), 0)
}

func TestUnionChangeSet_Single(t *testing.T) {
	cs := NewChangeSet[TestEntity]()
	union := NewUnionChangeSet[TestEntity](cs)

	union.RecordUpsert(TestEntity{ID: "1", Name: "Test"})

	changes := cs.Changes()
	assert.Len(t, changes, 1)
	assert.Equal(t, "1", changes[0].Entity.ID)
}

func TestUnionChangeSet_IndependentClear(t *testing.T) {
	main := NewChangeSet[TestEntity]()
	recorder := NewChangeSet[TestEntity]()

	union := NewUnionChangeSet[TestEntity](main, recorder)

	union.RecordUpsert(TestEntity{ID: "1", Name: "Test"})

	// Clear only main
	main.Commit()

	// main should be empty, recorder should still have the change
	assert.Len(t, main.Changes(), 0)
	assert.Len(t, recorder.Changes(), 1)

	// union.Changes() reads from main, so it should be empty
	assert.Len(t, union.Changes(), 0)
}

func TestUnionChangeSet_Ignore(t *testing.T) {
	main := NewChangeSet[TestEntity]()
	recorder := NewChangeSet[TestEntity]()

	union := NewUnionChangeSet[TestEntity](main, recorder)

	// Initially not ignored
	assert.False(t, union.IsIgnored())

	// Record first change
	union.RecordUpsert(TestEntity{ID: "1", Name: "First"})

	// Ignore - should propagate to all inner changesets
	union.Ignore()
	assert.True(t, union.IsIgnored())
	assert.True(t, main.IsIgnored())
	assert.True(t, recorder.IsIgnored())

	// These should be ignored
	union.RecordUpsert(TestEntity{ID: "2", Name: "Ignored"})
	union.RecordDelete(TestEntity{ID: "3", Name: "Ignored"})

	// Unignore and record more
	union.Unignore()
	assert.False(t, union.IsIgnored())
	assert.False(t, main.IsIgnored())
	assert.False(t, recorder.IsIgnored())

	union.RecordUpsert(TestEntity{ID: "4", Name: "Fourth"})

	// Both should only have 1 and 4
	assert.Len(t, main.Changes(), 2)
	assert.Len(t, recorder.Changes(), 2)
	assert.Equal(t, "1", main.Changes()[0].Entity.ID)
	assert.Equal(t, "4", main.Changes()[1].Entity.ID)
}

func TestUnionChangeSet_IsIgnored_PartialIgnore(t *testing.T) {
	main := NewChangeSet[TestEntity]()
	recorder := NewChangeSet[TestEntity]()

	union := NewUnionChangeSet[TestEntity](main, recorder)

	// Ignore only one inner changeset directly
	main.Ignore()

	// Union should report ignored if main is ignored
	assert.True(t, union.IsIgnored())

	main.Unignore()
	assert.False(t, union.IsIgnored())

	// Now ignore recorder
	recorder.Ignore()
	assert.True(t, union.IsIgnored())

	recorder.Unignore()
	assert.False(t, union.IsIgnored())
}

func TestUnionChangeSet_IgnoreNil(t *testing.T) {
	union := NewUnionChangeSet[TestEntity](nil)

	// Should not panic with nil changeset
	union.Ignore()
	union.Unignore()
	assert.False(t, union.IsIgnored())
}

func TestUnionChangeSet_Clear(t *testing.T) {
	main := NewChangeSet[TestEntity]()
	union := NewUnionChangeSet[TestEntity](main)

	union.RecordUpsert(TestEntity{ID: "1", Name: "Test"})
	assert.Len(t, union.Changes(), 1)

	union.Commit()
	assert.Len(t, union.Changes(), 0)
}
