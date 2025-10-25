package statechange

import (
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Test entity type
type TestEntity struct {
	ID   string
	Name string
}

func TestNewChangeSet(t *testing.T) {
	cs := NewChangeSet[TestEntity]()
	if cs == nil {
		t.Fatal("NewChangeSet returned nil")
	}

	changes := cs.Changes()
	if len(changes) != 0 {
		t.Errorf("Expected empty changeset, got %d changes", len(changes))
	}
}

func TestRecordUpsert(t *testing.T) {
	cs := NewChangeSet[TestEntity]()
	entity := TestEntity{ID: "1", Name: "Test"}

	cs.RecordUpsert(entity)

	changes := cs.Changes()
	require.Len(t, changes, 1)

	change := changes[0]
	assert.Equal(t, StateChangeUpsert, change.Type)
	assert.Equal(t, entity.ID, change.Entity.ID)
	assert.False(t, change.Timestamp.IsZero())
}

func TestRecordDelete(t *testing.T) {
	cs := NewChangeSet[TestEntity]()
	entity := TestEntity{ID: "1", Name: "Test"}

	cs.RecordDelete(entity)

	changes := cs.Changes()
	require.Len(t, changes, 1)

	change := changes[0]
	assert.Equal(t, StateChangeDelete, change.Type)
	assert.Equal(t, entity.ID, change.Entity.ID)
	assert.False(t, change.Timestamp.IsZero())
}

func TestMultipleChanges(t *testing.T) {
	cs := NewChangeSet[TestEntity]()

	entity1 := TestEntity{ID: "1", Name: "First"}
	entity2 := TestEntity{ID: "2", Name: "Second"}
	entity3 := TestEntity{ID: "3", Name: "Third"}

	cs.RecordUpsert(entity1)
	cs.RecordDelete(entity2)
	cs.RecordUpsert(entity3)

	changes := cs.Changes()
	require.Len(t, changes, 3)

	// Verify order is preserved
	assert.Equal(t, StateChangeUpsert, changes[0].Type)
	assert.Equal(t, "1", changes[0].Entity.ID)

	assert.Equal(t, StateChangeDelete, changes[1].Type)
	assert.Equal(t, "2", changes[1].Entity.ID)

	assert.Equal(t, StateChangeUpsert, changes[2].Type)
	assert.Equal(t, "3", changes[2].Entity.ID)
}

func TestClear(t *testing.T) {
	cs := NewChangeSet[TestEntity]()

	// Add some changes
	cs.RecordUpsert(TestEntity{ID: "1", Name: "First"})
	cs.RecordUpsert(TestEntity{ID: "2", Name: "Second"})
	cs.RecordDelete(TestEntity{ID: "3", Name: "Third"})

	// Verify changes exist
	changes := cs.Changes()
	require.Len(t, changes, 3)

	// Clear the changeset
	cs.Clear()

	// Verify changes are cleared
	changes = cs.Changes()
	assert.Empty(t, changes)
}

func TestClearMultipleTimes(t *testing.T) {
	cs := NewChangeSet[TestEntity]()

	cs.RecordUpsert(TestEntity{ID: "1", Name: "First"})
	cs.Clear()

	changes := cs.Changes()
	assert.Empty(t, changes)

	// Clear again on empty changeset
	cs.Clear()

	changes = cs.Changes()
	assert.Empty(t, changes)

	// Add new changes after clearing
	cs.RecordUpsert(TestEntity{ID: "2", Name: "Second"})

	changes = cs.Changes()
	assert.Len(t, changes, 1)
}

func TestChangesReturnsCopy(t *testing.T) {
	cs := NewChangeSet[TestEntity]()
	cs.RecordUpsert(TestEntity{ID: "1", Name: "Test"})

	// Get changes
	changes1 := cs.Changes()
	changes2 := cs.Changes()

	// Verify they are copies (different slices)
	require.Len(t, changes1, 1)
	require.Len(t, changes2, 1)

	// Modifying one shouldn't affect the other
	changes1[0].Entity.Name = "Modified"

	assert.NotEqual(t, "Modified", changes2[0].Entity.Name,
		"Changes() did not return a copy - modifications affected original")

	// Verify the changeset still has the original data
	changes3 := cs.Changes()
	assert.NotEqual(t, "Modified", changes3[0].Entity.Name,
		"Changeset was modified when it should have returned a copy")
}

func TestConcurrentAccess(t *testing.T) {
	cs := NewChangeSet[TestEntity]()
	var wg sync.WaitGroup

	// Number of goroutines
	numGoroutines := 10
	operationsPerGoroutine := 100

	// Concurrent upserts
	for i := range numGoroutines {
		wg.Add(1)
		go func(id int) {
			defer wg.Done()
			for j := 0; j < operationsPerGoroutine; j++ {
				cs.RecordUpsert(TestEntity{
					ID:   string(rune(id*operationsPerGoroutine + j)),
					Name: "Concurrent",
				})
			}
		}(i)
	}

	// Concurrent deletes
	for i := range numGoroutines {
		wg.Add(1)
		go func(id int) {
			defer wg.Done()
			for j := 0; j < operationsPerGoroutine; j++ {
				cs.RecordDelete(TestEntity{
					ID:   string(rune(id*operationsPerGoroutine + j + 1000)),
					Name: "Concurrent",
				})
			}
		}(i)
	}

	// Concurrent reads
	for range numGoroutines {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for j := 0; j < operationsPerGoroutine; j++ {
				_ = cs.Changes()
			}
		}()
	}

	wg.Wait()

	// Verify we got all the changes (upserts + deletes)
	changes := cs.Changes()
	expectedCount := numGoroutines * operationsPerGoroutine * 2 // *2 for upserts and deletes
	assert.Len(t, changes, expectedCount)
}

func TestTimestampOrdering(t *testing.T) {
	cs := NewChangeSet[TestEntity]()

	// Record changes with small delays
	cs.RecordUpsert(TestEntity{ID: "1", Name: "First"})
	time.Sleep(1 * time.Millisecond)

	cs.RecordUpsert(TestEntity{ID: "2", Name: "Second"})
	time.Sleep(1 * time.Millisecond)

	cs.RecordUpsert(TestEntity{ID: "3", Name: "Third"})

	changes := cs.Changes()

	// Verify timestamps are in order
	assert.True(t, changes[0].Timestamp.Before(changes[1].Timestamp),
		"Expected first change timestamp to be before second")
	assert.True(t, changes[1].Timestamp.Before(changes[2].Timestamp),
		"Expected second change timestamp to be before third")
}
