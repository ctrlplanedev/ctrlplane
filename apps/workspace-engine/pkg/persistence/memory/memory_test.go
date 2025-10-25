package memory_test

import (
	"context"
	"testing"
	"time"

	"workspace-engine/pkg/persistence"
	"workspace-engine/pkg/persistence/memory"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

// Mock entity for testing
type mockEntity struct {
	mock.Mock
	id   string
	name string
}

func (m *mockEntity) CompactionKey() (string, string) {
	return "entity", m.id
}

func TestStore_SaveAndLoad(t *testing.T) {
	ctx := context.Background()
	store := memory.NewStore()
	namespace := "workspace-123"

	// Create some changes using fluent API
	changes := persistence.NewChangesBuilder(namespace).
		Set(&mockEntity{id: "entity-1", name: "Test Entity 1"}).
		Set(&mockEntity{id: "entity-1", name: "Test Entity 1 Updated"}).
		Build()

	// Save changes
	err := store.Save(ctx, changes)
	require.NoError(t, err)

	// Load snapshot back
	loaded, err := store.Load(ctx, namespace)
	require.NoError(t, err)

	// Verify count - should be 1 due to compaction (same entity, latest change)
	assert.Len(t, loaded, 1, "Should only have 1 entity after compaction")

	// Verify it's the set (latest change for entity-1)
	assert.Equal(t, persistence.ChangeTypeSet, loaded[0].ChangeType)
}

func TestStore_MultipleWorkspaces(t *testing.T) {
	ctx := context.Background()
	store := memory.NewStore()

	// Add changes for workspace 1 using fluent API
	changes1 := persistence.NewChangesBuilder("workspace-1").
		Set(&mockEntity{id: "e1", name: "Entity 1"}).
		Build()
	store.Save(ctx, changes1)

	// Add changes for workspace 2 using fluent API
	changes2 := persistence.NewChangesBuilder("workspace-2").
		Set(&mockEntity{id: "e2", name: "Entity 2"}).
		Set(&mockEntity{id: "e2", name: "Entity 2 Updated"}).
		Build()
	store.Save(ctx, changes2)

	// Verify workspace 1 has 1 entity
	loaded1, err := store.Load(ctx, "workspace-1")
	require.NoError(t, err)
	assert.Len(t, loaded1, 1)

	// Verify workspace 2 has 1 entity (compacted from 2 changes)
	loaded2, err := store.Load(ctx, "workspace-2")
	require.NoError(t, err)
	assert.Len(t, loaded2, 1, "Should only have 1 entity after compaction")

	// Verify workspace count
	assert.Equal(t, 2, store.NamespaceCount())
}

func TestStore_EmptyWorkspace(t *testing.T) {
	ctx := context.Background()
	store := memory.NewStore()

	// Load from non-existent workspace
	loaded, err := store.Load(ctx, "non-existent")
	require.NoError(t, err)
	assert.Empty(t, loaded)
}

func TestStore_AutoTimestamp(t *testing.T) {
	ctx := context.Background()
	store := memory.NewStore()

	// Create change using fluent API (timestamp set automatically)
	changes := persistence.NewChangesBuilder("workspace-123").
		Set(&mockEntity{id: "e1", name: "Entity 1"}).
		Build()

	before := time.Now().Add(-1 * time.Second) // Account for builder creation time
	store.Save(ctx, changes)
	after := time.Now()

	// Load back and verify timestamp was set
	loaded, _ := store.Load(ctx, "workspace-123")
	if loaded[0].Timestamp.IsZero() {
		t.Error("Timestamp was not set automatically")
	}

	if loaded[0].Timestamp.Before(before) || loaded[0].Timestamp.After(after) {
		t.Error("Timestamp is outside expected range")
	}
}

func TestStore_Clear(t *testing.T) {
	ctx := context.Background()
	store := memory.NewStore()

	// Add some changes using fluent API
	changes := persistence.NewChangesBuilder("workspace-123").
		Set(&mockEntity{id: "e1", name: "Entity 1"}).
		Build()
	err := store.Save(ctx, changes)
	require.NoError(t, err)

	// Verify changes exist
	assert.Equal(t, 1, store.NamespaceCount(), "Changes should be added")

	// Clear the store
	store.Clear()

	// Verify store is empty
	assert.Equal(t, 0, store.NamespaceCount(), "Store should be cleared")

	loaded, err := store.Load(ctx, "workspace-123")
	require.NoError(t, err)
	assert.Empty(t, loaded, "Changes should be cleared")
}

func TestStore_EntityCount(t *testing.T) {
	ctx := context.Background()
	store := memory.NewStore()

	namespace := "workspace-123"

	// Initially should be 0
	assert.Equal(t, 0, store.EntityCount(namespace), "Initial entity count should be 0")

	// Add 3 changes for the SAME entity (should be compacted to 1)
	for range 3 {
		changes := persistence.NewChangesBuilder(namespace).
			Set(&mockEntity{id: "e1", name: "Entity"}).
			Build()
		err := store.Save(ctx, changes)
		require.NoError(t, err)
	}

	// Verify count - should be 1 due to compaction
	assert.Equal(t, 1, store.EntityCount(namespace), "Should only have 1 entity after compaction")

	// Add a change for a different entity
	changes := persistence.NewChangesBuilder(namespace).
		Set(&mockEntity{id: "e2", name: "Entity 2"}).
		Build()
	err := store.Save(ctx, changes)
	require.NoError(t, err)

	// Now should have 2 entities
	assert.Equal(t, 2, store.EntityCount(namespace), "Should have 2 distinct entities")
}

func TestStore_ConcurrentAccess(t *testing.T) {
	ctx := context.Background()
	store := memory.NewStore()

	// Test concurrent writes to different workspaces
	done := make(chan bool)

	for i := range 10 {
		go func(id int) {
			namespace := "workspace-" + string(rune(id))
			changes := persistence.NewChangesBuilder(namespace).
				Set(&mockEntity{id: "e1", name: "Entity"}).
				Build()
			store.Save(ctx, changes)
			done <- true
		}(i)
	}

	// Wait for all goroutines
	for range 10 {
		<-done
	}

	// Store should be in a valid state (no race conditions)
	assert.Greater(t, store.NamespaceCount(), 0, "Concurrent writes should succeed")
}

func TestStore_Close(t *testing.T) {
	store := memory.NewStore()

	err := store.Close()
	assert.NoError(t, err, "Close should not return an error")
}
