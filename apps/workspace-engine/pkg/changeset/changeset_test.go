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
