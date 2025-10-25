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

func (m *mockEntity) ChangelogKey() (string, string) {
	return "entity", m.id
}

func TestStore_AppendAndLoad(t *testing.T) {
	ctx := context.Background()
	store := memory.NewStore()
	workspaceID := "workspace-123"

	// Create some changes using fluent API
	changes := persistence.NewChangelogBuilder(workspaceID).
		Create(&mockEntity{id: "entity-1", name: "Test Entity 1"}).
		Update(&mockEntity{id: "entity-1", name: "Test Entity 1 Updated"}).
		Build()

	// Append changes
	err := store.Append(ctx, changes)
	require.NoError(t, err)

	// Load changes back
	loaded, err := store.LoadAll(ctx, workspaceID)
	require.NoError(t, err)

	// Verify count
	assert.Len(t, loaded, 2)

	// Verify first change
	assert.Equal(t, persistence.ChangeTypeCreate, loaded[0].ChangeType)

	// Verify second change
	assert.Equal(t, persistence.ChangeTypeUpdate, loaded[1].ChangeType)
}

func TestStore_MultipleWorkspaces(t *testing.T) {
	ctx := context.Background()
	store := memory.NewStore()

	// Add changes for workspace 1 using fluent API
	changes1 := persistence.NewChangelogBuilder("workspace-1").
		Create(&mockEntity{id: "e1", name: "Entity 1"}).
		Build()
	store.Append(ctx, changes1)

	// Add changes for workspace 2 using fluent API
	changes2 := persistence.NewChangelogBuilder("workspace-2").
		Create(&mockEntity{id: "e2", name: "Entity 2"}).
		Update(&mockEntity{id: "e2", name: "Entity 2 Updated"}).
		Build()
	store.Append(ctx, changes2)

	// Verify workspace 1 has 1 change
	loaded1, err := store.LoadAll(ctx, "workspace-1")
	require.NoError(t, err)
	assert.Len(t, loaded1, 1)

	// Verify workspace 2 has 2 changes
	loaded2, err := store.LoadAll(ctx, "workspace-2")
	require.NoError(t, err)
	assert.Len(t, loaded2, 2)

	// Verify workspace count
	assert.Equal(t, 2, store.WorkspaceCount())
}

func TestStore_EmptyWorkspace(t *testing.T) {
	ctx := context.Background()
	store := memory.NewStore()

	// Load from non-existent workspace
	loaded, err := store.LoadAll(ctx, "non-existent")
	require.NoError(t, err)
	assert.Empty(t, loaded)
}

func TestStore_AutoTimestamp(t *testing.T) {
	ctx := context.Background()
	store := memory.NewStore()

	// Create change using fluent API (timestamp set automatically)
	changes := persistence.NewChangelogBuilder("workspace-123").
		Create(&mockEntity{id: "e1", name: "Entity 1"}).
		Build()

	before := time.Now().Add(-1 * time.Second) // Account for builder creation time
	store.Append(ctx, changes)
	after := time.Now()

	// Load back and verify timestamp was set
	loaded, _ := store.LoadAll(ctx, "workspace-123")
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
	changes := persistence.NewChangelogBuilder("workspace-123").
		Create(&mockEntity{id: "e1", name: "Entity 1"}).
		Build()
	err := store.Append(ctx, changes)
	require.NoError(t, err)

	// Verify changes exist
	assert.Equal(t, 1, store.WorkspaceCount(), "Changes should be added")

	// Clear the store
	store.Clear()

	// Verify store is empty
	assert.Equal(t, 0, store.WorkspaceCount(), "Store should be cleared")

	loaded, err := store.LoadAll(ctx, "workspace-123")
	require.NoError(t, err)
	assert.Empty(t, loaded, "Changes should be cleared")
}

func TestStore_ChangeCount(t *testing.T) {
	ctx := context.Background()
	store := memory.NewStore()

	workspaceID := "workspace-123"

	// Initially should be 0
	assert.Equal(t, 0, store.ChangeCount(workspaceID), "Initial change count should be 0")

	// Add 3 changes using fluent API
	for range 3 {
		changes := persistence.NewChangelogBuilder(workspaceID).
			Create(&mockEntity{id: "e1", name: "Entity"}).
			Build()
		err := store.Append(ctx, changes)
		require.NoError(t, err)
	}

	// Verify count
	assert.Equal(t, 3, store.ChangeCount(workspaceID))
}

func TestStore_ConcurrentAccess(t *testing.T) {
	ctx := context.Background()
	store := memory.NewStore()

	// Test concurrent writes to different workspaces
	done := make(chan bool)

	for i := range 10 {
		go func(id int) {
			workspaceID := "workspace-" + string(rune(id))
			changes := persistence.NewChangelogBuilder(workspaceID).
				Create(&mockEntity{id: "e1", name: "Entity"}).
				Build()
			store.Append(ctx, changes)
			done <- true
		}(i)
	}

	// Wait for all goroutines
	for range 10 {
		<-done
	}

	// Store should be in a valid state (no race conditions)
	assert.Greater(t, store.WorkspaceCount(), 0, "Concurrent writes should succeed")
}

func TestStore_Close(t *testing.T) {
	store := memory.NewStore()

	err := store.Close()
	assert.NoError(t, err, "Close should not return an error")
}
