package changeset

import (
	"sync"
	"testing"
	"time"
)

// Test that recording changes works correctly
func TestChangeSet_Record(t *testing.T) {
	cs := NewChangeSet()

	// Record a change
	testEntity := map[string]string{"name": "test-resource"}
	cs.Record(EntityTypeResource, ChangeTypeInsert, "resource-1", testEntity)

	// Verify the change was recorded
	if len(cs.Changes) != 1 {
		t.Fatalf("expected 1 change, got %d", len(cs.Changes))
	}

	change := cs.Changes[0]
	if change.EntityType != EntityTypeResource {
		t.Errorf("expected EntityType %v, got %v", EntityTypeResource, change.EntityType)
	}
	if change.Type != ChangeTypeInsert {
		t.Errorf("expected ChangeType %v, got %v", ChangeTypeInsert, change.Type)
	}
	if change.ID != "resource-1" {
		t.Errorf("expected ID %s, got %s", "resource-1", change.ID)
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
	cs := NewChangeSet()

	// Record multiple changes
	cs.Record(EntityTypeResource, ChangeTypeInsert, "resource-1", nil)
	cs.Record(EntityTypeDeployment, ChangeTypeUpdate, "deployment-1", nil)
	cs.Record(EntityTypeEnvironment, ChangeTypeDelete, "env-1", nil)

	// Verify all changes were recorded
	if len(cs.Changes) != 3 {
		t.Fatalf("expected 3 changes, got %d", len(cs.Changes))
	}

	// Verify each change
	expectedChanges := []struct {
		entityType EntityType
		changeType ChangeType
		id         string
	}{
		{EntityTypeResource, ChangeTypeInsert, "resource-1"},
		{EntityTypeDeployment, ChangeTypeUpdate, "deployment-1"},
		{EntityTypeEnvironment, ChangeTypeDelete, "env-1"},
	}

	for i, expected := range expectedChanges {
		change := cs.Changes[i]
		if change.EntityType != expected.entityType {
			t.Errorf("change %d: expected EntityType %v, got %v", i, expected.entityType, change.EntityType)
		}
		if change.Type != expected.changeType {
			t.Errorf("change %d: expected ChangeType %v, got %v", i, expected.changeType, change.Type)
		}
		if change.ID != expected.id {
			t.Errorf("change %d: expected ID %s, got %s", i, expected.id, change.ID)
		}
	}
}

// Test thread safety of concurrent Record() calls
func TestChangeSet_ConcurrentRecord(t *testing.T) {
	cs := NewChangeSet()

	numGoroutines := 100
	changesPerGoroutine := 10

	var wg sync.WaitGroup
	wg.Add(numGoroutines)

	// Launch multiple goroutines that all record changes
	for i := 0; i < numGoroutines; i++ {
		go func(goroutineID int) {
			defer wg.Done()
			for j := 0; j < changesPerGoroutine; j++ {
				cs.Record(
					EntityTypeResource,
					ChangeTypeInsert,
					"resource-"+string(rune(goroutineID))+"-"+string(rune(j)),
					nil,
				)
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
		if change.EntityType != EntityTypeResource {
			t.Errorf("change %d: expected EntityType %v, got %v", i, EntityTypeResource, change.EntityType)
		}
		if change.Type != ChangeTypeInsert {
			t.Errorf("change %d: expected ChangeType %v, got %v", i, ChangeTypeInsert, change.Type)
		}
		if change.ID == "" {
			t.Errorf("change %d: expected non-empty ID", i)
		}
		if change.Timestamp.IsZero() {
			t.Errorf("change %d: expected non-zero Timestamp", i)
		}
	}
}

// Test that change ordering is preserved
func TestChangeSet_OrderingPreserved(t *testing.T) {
	cs := NewChangeSet()

	// Record changes with a small delay to ensure distinct timestamps
	changes := []struct {
		entityType EntityType
		changeType ChangeType
		id         string
	}{
		{EntityTypeResource, ChangeTypeInsert, "first"},
		{EntityTypeDeployment, ChangeTypeUpdate, "second"},
		{EntityTypeEnvironment, ChangeTypeDelete, "third"},
		{EntityTypeJob, ChangeTypeInsert, "fourth"},
		{EntityTypeRelease, ChangeTypeUpdate, "fifth"},
	}

	for _, c := range changes {
		cs.Record(c.entityType, c.changeType, c.id, nil)
		time.Sleep(1 * time.Millisecond) // Small delay to ensure distinct timestamps
	}

	// Verify ordering is preserved
	if len(cs.Changes) != len(changes) {
		t.Fatalf("expected %d changes, got %d", len(changes), len(cs.Changes))
	}

	for i, expected := range changes {
		change := cs.Changes[i]
		if change.ID != expected.id {
			t.Errorf("position %d: expected ID %s, got %s (ordering not preserved)", i, expected.id, change.ID)
		}
		if change.EntityType != expected.entityType {
			t.Errorf("position %d: expected EntityType %v, got %v", i, expected.entityType, change.EntityType)
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
