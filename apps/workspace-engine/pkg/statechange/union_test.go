package statechange

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestUnionChangeSet_Basic(t *testing.T) {
	cs1 := NewChangeSet[TestEntity]()
	cs2 := NewChangeSet[TestEntity]()
	cs3 := NewChangeSet[TestEntity]()

	union := NewUnionChangeSet[TestEntity](cs1, cs2, cs3)

	// Record changes through union
	union.RecordUpsert(TestEntity{ID: "1", Name: "First"})
	union.RecordDelete(TestEntity{ID: "2", Name: "Second"})
	union.RecordUpsert(TestEntity{ID: "3", Name: "Third"})

	// All changesets should have the same changes
	for i, cs := range []*InMemoryChangeSet[TestEntity]{cs1, cs2, cs3} {
		changes := cs.Changes()
		assert.Len(t, changes, 3, "changeset %d should have 3 changes", i)

		assert.Equal(t, StateChangeUpsert, changes[0].Type)
		assert.Equal(t, "1", changes[0].Entity.ID)

		assert.Equal(t, StateChangeDelete, changes[1].Type)
		assert.Equal(t, "2", changes[1].Entity.ID)

		assert.Equal(t, StateChangeUpsert, changes[2].Type)
		assert.Equal(t, "3", changes[2].Entity.ID)
	}
}

func TestUnionChangeSet_Empty(t *testing.T) {
	union := NewUnionChangeSet[TestEntity]()

	// Should not panic with no changesets
	union.RecordUpsert(TestEntity{ID: "1", Name: "Test"})
	union.RecordDelete(TestEntity{ID: "2", Name: "Test"})
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
	cs1 := NewChangeSet[TestEntity]()
	cs2 := NewChangeSet[TestEntity]()

	union := NewUnionChangeSet[TestEntity](cs1, cs2)

	union.RecordUpsert(TestEntity{ID: "1", Name: "Test"})

	// Clear only cs1
	cs1.Clear()

	// cs1 should be empty, cs2 should still have the change
	assert.Len(t, cs1.Changes(), 0)
	assert.Len(t, cs2.Changes(), 1)
}

func TestUnionChangeSet_Ignore(t *testing.T) {
	cs1 := NewChangeSet[TestEntity]()
	cs2 := NewChangeSet[TestEntity]()

	union := NewUnionChangeSet[TestEntity](cs1, cs2)

	// Initially not ignored
	assert.False(t, union.IsIgnored())

	// Record first change
	union.RecordUpsert(TestEntity{ID: "1", Name: "First"})

	// Ignore - should propagate to all inner changesets
	union.Ignore()
	assert.True(t, union.IsIgnored())
	assert.True(t, cs1.IsIgnored())
	assert.True(t, cs2.IsIgnored())

	// These should be ignored
	union.RecordUpsert(TestEntity{ID: "2", Name: "Ignored"})
	union.RecordDelete(TestEntity{ID: "3", Name: "Ignored"})

	// Unignore and record more
	union.Unignore()
	assert.False(t, union.IsIgnored())
	assert.False(t, cs1.IsIgnored())
	assert.False(t, cs2.IsIgnored())

	union.RecordUpsert(TestEntity{ID: "4", Name: "Fourth"})

	// Both should only have 1 and 4
	assert.Len(t, cs1.Changes(), 2)
	assert.Len(t, cs2.Changes(), 2)
	assert.Equal(t, "1", cs1.Changes()[0].Entity.ID)
	assert.Equal(t, "4", cs1.Changes()[1].Entity.ID)
}

func TestUnionChangeSet_IsIgnored_PartialIgnore(t *testing.T) {
	cs1 := NewChangeSet[TestEntity]()
	cs2 := NewChangeSet[TestEntity]()

	union := NewUnionChangeSet[TestEntity](cs1, cs2)

	// Ignore only one inner changeset directly
	cs1.Ignore()

	// Union should report ignored if any inner is ignored
	assert.True(t, union.IsIgnored())

	cs1.Unignore()
	assert.False(t, union.IsIgnored())
}

func TestUnionChangeSet_IgnoreEmpty(t *testing.T) {
	union := NewUnionChangeSet[TestEntity]()

	// Should not panic with no changesets
	union.Ignore()
	union.Unignore()
	assert.False(t, union.IsIgnored())
}
