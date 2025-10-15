package changeset

import (
	"sync"
	"testing"
	"time"
)

// Test that recording changes works correctly
func TestChangeSet_Record(t *testing.T) {
	cs := NewChangeSet[any]()

	// Record a change
	testEntity := map[string]string{"name": "test-resource"}
	cs.Record(ChangeTypeCreate, testEntity)

	// Verify the change was recorded
	if len(cs.Changes) != 1 {
		t.Fatalf("expected 1 change, got %d", len(cs.Changes))
	}

	change := cs.Changes[0]
	if change.Type != ChangeTypeCreate {
		t.Errorf("expected ChangeType %v, got %v", ChangeTypeCreate, change.Type)
	}
	if change.Entity == nil {
		t.Error("expected Entity to be set, got nil")
	}
	if change.Timestamp.IsZero() {
		t.Error("expected Timestamp to be set, got zero value")
	}
}

// Test that recording multiple changes works correctly
func TestChangeSet_RecordMultiple(t *testing.T) {
	cs := NewChangeSet[any]()

	// Record multiple changes
	cs.Record(ChangeTypeCreate, "resource-1")
	cs.Record(ChangeTypeUpdate, "deployment-1")
	cs.Record(ChangeTypeDelete, "env-1")

	// Verify all changes were recorded
	if len(cs.Changes) != 3 {
		t.Fatalf("expected 3 changes, got %d", len(cs.Changes))
	}

	// Verify each change
	expectedChanges := []ChangeType{
		ChangeTypeCreate,
		ChangeTypeUpdate,
		ChangeTypeDelete,
	}

	for i, expected := range expectedChanges {
		change := cs.Changes[i]
		if change.Type != expected {
			t.Errorf("change %d: expected ChangeType %v, got %v", i, expected, change.Type)
		}
	}
}

// Test thread safety of concurrent Record() calls
func TestChangeSet_ConcurrentRecord(t *testing.T) {
	cs := NewChangeSet[any]()

	numGoroutines := 100
	changesPerGoroutine := 10

	var wg sync.WaitGroup
	wg.Add(numGoroutines)

	// Launch multiple goroutines that all record changes
	for i := 0; i < numGoroutines; i++ {
		go func(goroutineID int) {
			defer wg.Done()
			for j := 0; j < changesPerGoroutine; j++ {
				entity := map[string]int{"goroutine": goroutineID, "iteration": j}
				cs.Record(ChangeTypeCreate, entity)
			}
		}(i)
	}

	wg.Wait()

	// Verify total number of changes
	expectedTotal := numGoroutines * changesPerGoroutine
	if len(cs.Changes) != expectedTotal {
		t.Errorf("expected %d changes, got %d", expectedTotal, len(cs.Changes))
	}

	// Verify no changes were lost or corrupted
	for i, change := range cs.Changes {
		if change.Type != ChangeTypeCreate {
			t.Errorf("change %d: expected ChangeType %v, got %v", i, ChangeTypeCreate, change.Type)
		}
		if change.Entity == nil {
			t.Errorf("change %d: expected non-nil Entity", i)
		}
		if change.Timestamp.IsZero() {
			t.Errorf("change %d: expected non-zero Timestamp", i)
		}
	}
}

// Test that change ordering is preserved
func TestChangeSet_OrderingPreserved(t *testing.T) {
	cs := NewChangeSet[string]()

	// Record changes with a small delay to ensure distinct timestamps
	changes := []struct {
		changeType ChangeType
		entity     string
	}{
		{ChangeTypeCreate, "first"},
		{ChangeTypeUpdate, "second"},
		{ChangeTypeDelete, "third"},
		{ChangeTypeCreate, "fourth"},
		{ChangeTypeUpdate, "fifth"},
	}

	for _, c := range changes {
		cs.Record(c.changeType, c.entity)
		time.Sleep(1 * time.Millisecond) // Small delay to ensure distinct timestamps
	}

	// Verify ordering is preserved
	if len(cs.Changes) != len(changes) {
		t.Fatalf("expected %d changes, got %d", len(changes), len(cs.Changes))
	}

	for i, expected := range changes {
		change := cs.Changes[i]
		if change.Entity != expected.entity {
			t.Errorf("position %d: expected Entity %s, got %s (ordering not preserved)", i, expected.entity, change.Entity)
		}
		if change.Type != expected.changeType {
			t.Errorf("position %d: expected ChangeType %v, got %v", i, expected.changeType, change.Type)
		}

		// Verify timestamps are in increasing order
		if i > 0 && change.Timestamp.Before(cs.Changes[i-1].Timestamp) {
			t.Errorf("position %d: timestamp is before previous change (ordering violated)", i)
		}
	}
}

// Test that deduplication uses the latest change type
func TestChangeSetWithDedup_LatestChangeTypeWins(t *testing.T) {
	type testEntity struct {
		ID   string
		Name string
	}

	cs := NewChangeSetWithDedup(func(e testEntity) string {
		return e.ID
	})

	entity := testEntity{ID: "resource-1", Name: "Test Resource"}

	// Record multiple changes for the same entity
	cs.Record(ChangeTypeCreate, entity)
	cs.Record(ChangeTypeUpdate, entity)
	cs.Record(ChangeTypeTaint, entity)
	cs.Record(ChangeTypeDelete, entity)

	// Finalize to convert map to slice
	cs.Finalize()

	// Verify only one change exists
	if len(cs.Changes) != 1 {
		t.Fatalf("expected 1 change after deduplication, got %d", len(cs.Changes))
	}

	// Verify it's the last change type (Delete)
	change := cs.Changes[0]
	if change.Type != ChangeTypeDelete {
		t.Errorf("expected ChangeType %v (last recorded), got %v", ChangeTypeDelete, change.Type)
	}
	if change.Entity.ID != "resource-1" {
		t.Errorf("expected entity ID 'resource-1', got %v", change.Entity.ID)
	}
}

// Test that deduplication with different entities keeps all
func TestChangeSetWithDedup_DifferentEntities(t *testing.T) {
	type testEntity struct {
		ID   string
		Name string
	}

	cs := NewChangeSetWithDedup(func(e testEntity) string {
		return e.ID
	})

	// Record changes for different entities
	cs.Record(ChangeTypeCreate, testEntity{ID: "resource-1", Name: "Resource 1"})
	cs.Record(ChangeTypeCreate, testEntity{ID: "resource-2", Name: "Resource 2"})
	cs.Record(ChangeTypeCreate, testEntity{ID: "resource-3", Name: "Resource 3"})

	cs.Finalize()

	// Verify all three changes exist
	if len(cs.Changes) != 3 {
		t.Fatalf("expected 3 changes, got %d", len(cs.Changes))
	}

	// Verify all are create types
	for i, change := range cs.Changes {
		if change.Type != ChangeTypeCreate {
			t.Errorf("change %d: expected ChangeType %v, got %v", i, ChangeTypeCreate, change.Type)
		}
	}
}

// Test that deduplication with mixed entities works correctly
func TestChangeSetWithDedup_MixedEntities(t *testing.T) {
	type testEntity struct {
		ID   string
		Name string
	}

	cs := NewChangeSetWithDedup(func(e testEntity) string {
		return e.ID
	})

	// Record changes for multiple entities with some duplicates
	cs.Record(ChangeTypeCreate, testEntity{ID: "resource-1", Name: "Resource 1"})
	cs.Record(ChangeTypeCreate, testEntity{ID: "resource-2", Name: "Resource 2"})
	cs.Record(ChangeTypeUpdate, testEntity{ID: "resource-1", Name: "Resource 1 Updated"}) // Duplicate
	cs.Record(ChangeTypeCreate, testEntity{ID: "resource-3", Name: "Resource 3"})
	cs.Record(ChangeTypeTaint, testEntity{ID: "resource-2", Name: "Resource 2"})  // Duplicate
	cs.Record(ChangeTypeDelete, testEntity{ID: "resource-1", Name: "Resource 1"}) // Duplicate again

	cs.Finalize()

	// Verify only 3 changes exist (one per unique ID)
	if len(cs.Changes) != 3 {
		t.Fatalf("expected 3 changes after deduplication, got %d", len(cs.Changes))
	}

	// Build a map to verify the final state of each entity
	finalStates := make(map[string]ChangeType)
	for _, change := range cs.Changes {
		finalStates[change.Entity.ID] = change.Type
	}

	// Verify the latest change type for each entity
	expectedStates := map[string]ChangeType{
		"resource-1": ChangeTypeDelete, // Last was Delete
		"resource-2": ChangeTypeTaint,  // Last was Taint
		"resource-3": ChangeTypeCreate, // Only had Create
	}

	for id, expectedType := range expectedStates {
		actualType, exists := finalStates[id]
		if !exists {
			t.Errorf("expected entity %s to exist in final changes", id)
			continue
		}
		if actualType != expectedType {
			t.Errorf("entity %s: expected final ChangeType %v, got %v", id, expectedType, actualType)
		}
	}
}

// Test Count() method with deduplication
func TestChangeSetWithDedup_Count(t *testing.T) {
	type testEntity struct {
		ID string
	}

	cs := NewChangeSetWithDedup(func(e testEntity) string {
		return e.ID
	})

	// Record multiple changes for the same entities
	cs.Record(ChangeTypeCreate, testEntity{ID: "1"})
	cs.Record(ChangeTypeCreate, testEntity{ID: "2"})
	cs.Record(ChangeTypeUpdate, testEntity{ID: "1"}) // Duplicate
	cs.Record(ChangeTypeCreate, testEntity{ID: "3"})
	cs.Record(ChangeTypeTaint, testEntity{ID: "2"}) // Duplicate

	// Count should reflect deduplicated count (3 unique entities)
	count := cs.Count()
	if count != 3 {
		t.Errorf("expected Count() to return 3, got %d", count)
	}
}

// Test Process() auto-finalizes deduplication
func TestChangeSetWithDedup_ProcessAutoFinalizes(t *testing.T) {
	type testEntity struct {
		ID   string
		Name string
	}

	cs := NewChangeSetWithDedup(func(e testEntity) string {
		return e.ID
	})

	// Record multiple changes for the same entity
	cs.Record(ChangeTypeCreate, testEntity{ID: "resource-1", Name: "Resource 1"})
	cs.Record(ChangeTypeUpdate, testEntity{ID: "resource-1", Name: "Resource 1 Updated"})
	cs.Record(ChangeTypeDelete, testEntity{ID: "resource-1", Name: "Resource 1"})

	// Process should auto-finalize
	processor := cs.Process()
	if processor == nil {
		t.Fatal("expected non-nil processor")
	}

	// Verify Changes slice was populated
	if len(cs.Changes) != 1 {
		t.Errorf("expected 1 change after Process(), got %d", len(cs.Changes))
	}

	// Verify it's the last change
	if cs.Changes[0].Type != ChangeTypeDelete {
		t.Errorf("expected ChangeType %v, got %v", ChangeTypeDelete, cs.Changes[0].Type)
	}
}

// Test concurrent recording with deduplication
func TestChangeSetWithDedup_ConcurrentRecord(t *testing.T) {
	type testEntity struct {
		ID    string
		Value int
	}

	cs := NewChangeSetWithDedup(func(e testEntity) string {
		return e.ID
	})

	numGoroutines := 50
	changesPerGoroutine := 20
	numUniqueEntities := 10

	var wg sync.WaitGroup
	wg.Add(numGoroutines)

	// Launch multiple goroutines that record changes
	// Each goroutine cycles through the same set of entity IDs
	for i := 0; i < numGoroutines; i++ {
		go func(goroutineID int) {
			defer wg.Done()
			for j := 0; j < changesPerGoroutine; j++ {
				entityID := j % numUniqueEntities // Cycle through entity IDs
				entity := testEntity{
					ID:    string(rune('A' + entityID)),
					Value: goroutineID*1000 + j,
				}
				changeType := []ChangeType{
					ChangeTypeCreate,
					ChangeTypeUpdate,
					ChangeTypeTaint,
					ChangeTypeDelete,
				}[j%4]
				cs.Record(changeType, entity)
			}
		}(i)
	}

	wg.Wait()

	// Finalize to get final state
	cs.Finalize()

	// Should have exactly numUniqueEntities entries (deduplicated)
	if len(cs.Changes) != numUniqueEntities {
		t.Errorf("expected %d unique changes after deduplication, got %d", numUniqueEntities, len(cs.Changes))
	}
}

// Test that regular changeset (without dedup) still works
func TestChangeSet_NoDedup(t *testing.T) {
	type testEntity struct {
		ID string
	}

	cs := NewChangeSet[testEntity]()

	// Record multiple changes for the same entity
	cs.Record(ChangeTypeCreate, testEntity{ID: "resource-1"})
	cs.Record(ChangeTypeUpdate, testEntity{ID: "resource-1"})
	cs.Record(ChangeTypeDelete, testEntity{ID: "resource-1"})

	// All changes should be present (no deduplication)
	if len(cs.Changes) != 3 {
		t.Errorf("expected 3 changes without deduplication, got %d", len(cs.Changes))
	}
}

// Test timestamp is updated on each duplicate
func TestChangeSetWithDedup_TimestampUpdated(t *testing.T) {
	type testEntity struct {
		ID string
	}

	cs := NewChangeSetWithDedup(func(e testEntity) string {
		return e.ID
	})

	entity := testEntity{ID: "resource-1"}

	// Record first change
	cs.Record(ChangeTypeCreate, entity)
	time.Sleep(10 * time.Millisecond)

	// Record second change for same entity
	cs.Record(ChangeTypeUpdate, entity)

	cs.Finalize()

	// Verify the timestamp is from the second record
	if len(cs.Changes) != 1 {
		t.Fatalf("expected 1 change, got %d", len(cs.Changes))
	}

	change := cs.Changes[0]
	now := time.Now()
	timeDiff := now.Sub(change.Timestamp)

	// Timestamp should be very recent (within 1 second)
	if timeDiff > time.Second {
		t.Errorf("timestamp seems to be from first record, not updated on second record")
	}
}
