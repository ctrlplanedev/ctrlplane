package pebble

import (
	"context"
	"testing"
	"time"

	"workspace-engine/pkg/persistence"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Test entity implementation
type testEntity struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

func (e *testEntity) CompactionKey() (string, string) {
	return "test-entity", e.ID
}

func TestPebbleStore_SaveAndLoad(t *testing.T) {
	// Create temp directory
	tempDir := t.TempDir()

	// Create registry and register entity type
	registry := persistence.NewJSONEntityRegistry()
	registry.Register("test-entity", func() persistence.Entity {
		return &testEntity{}
	})

	store, err := NewStore(tempDir, registry)
	require.NoError(t, err)
	defer store.Close()

	ctx := context.Background()

	// Create changes
	changes := persistence.NewChangesBuilder("workspace-1").
		Set(&testEntity{ID: "e1", Name: "Entity 1"}).
		Set(&testEntity{ID: "e2", Name: "Entity 2"}).
		Build()

	// Save changes
	err = store.Save(ctx, changes)
	require.NoError(t, err)

	// Load changes
	loaded, err := store.Load(ctx, "workspace-1")
	require.NoError(t, err)
	assert.Len(t, loaded, 2)

	// Verify entities - check IDs, names, and values are preserved
	entities := make(map[string]*testEntity)
	for _, change := range loaded {
		e := change.Entity.(*testEntity)
		entities[e.ID] = e
	}

	// Verify Entity 1
	require.NotNil(t, entities["e1"], "Entity e1 should exist")
	assert.Equal(t, "e1", entities["e1"].ID, "Entity ID should be preserved")
	assert.Equal(t, "Entity 1", entities["e1"].Name, "Entity name should be preserved")

	// Verify Entity 2
	require.NotNil(t, entities["e2"], "Entity e2 should exist")
	assert.Equal(t, "e2", entities["e2"].ID, "Entity ID should be preserved")
	assert.Equal(t, "Entity 2", entities["e2"].Name, "Entity name should be preserved")
}

func TestPebbleStore_Compaction(t *testing.T) {
	tempDir := t.TempDir()

	// Create registry and register entity type
	registry := persistence.NewJSONEntityRegistry()
	registry.Register("test-entity", func() persistence.Entity {
		return &testEntity{}
	})

	store, err := NewStore(tempDir, registry)
	require.NoError(t, err)
	defer store.Close()

	ctx := context.Background()

	// Save multiple versions of the same entity
	time1 := time.Now()
	changes1 := persistence.NewChangesBuilder("workspace-1").
		Set(&testEntity{ID: "e1", Name: "Version 1"}, persistence.WithTimestamp(time1)).
		Build()

	err = store.Save(ctx, changes1)
	require.NoError(t, err)

	time2 := time1.Add(time.Second)
	changes2 := persistence.NewChangesBuilder("workspace-1").
		Set(&testEntity{ID: "e1", Name: "Version 2"}, persistence.WithTimestamp(time2)).
		Build()

	err = store.Save(ctx, changes2)
	require.NoError(t, err)

	time3 := time2.Add(time.Second)
	changes3 := persistence.NewChangesBuilder("workspace-1").
		Set(&testEntity{ID: "e1", Name: "Version 3"}, persistence.WithTimestamp(time3)).
		Build()

	err = store.Save(ctx, changes3)
	require.NoError(t, err)

	// Load - should return only latest version (automatic compaction via key overwrite)
	loaded, err := store.Load(ctx, "workspace-1")
	require.NoError(t, err)
	assert.Len(t, loaded, 1)

	entity := loaded[0].Entity.(*testEntity)
	assert.Equal(t, "e1", entity.ID, "Entity ID should be preserved")
	assert.Equal(t, "Version 3", entity.Name, "Latest version name should be preserved")
	assert.True(t, time3.Equal(loaded[0].Timestamp), "timestamps should be equal")
}

func TestPebbleStore_MultipleNamespaces(t *testing.T) {
	tempDir := t.TempDir()

	// Create registry and register entity type
	registry := persistence.NewJSONEntityRegistry()
	registry.Register("test-entity", func() persistence.Entity {
		return &testEntity{}
	})

	store, err := NewStore(tempDir, registry)
	require.NoError(t, err)
	defer store.Close()

	ctx := context.Background()

	// Save to different namespaces
	changes1 := persistence.NewChangesBuilder("workspace-1").
		Set(&testEntity{ID: "e1", Name: "Workspace 1 Entity"}).
		Build()

	changes2 := persistence.NewChangesBuilder("workspace-2").
		Set(&testEntity{ID: "e1", Name: "Workspace 2 Entity"}).
		Build()

	err = store.Save(ctx, changes1)
	require.NoError(t, err)

	err = store.Save(ctx, changes2)
	require.NoError(t, err)

	// Load from each namespace
	loaded1, err := store.Load(ctx, "workspace-1")
	require.NoError(t, err)
	assert.Len(t, loaded1, 1)
	entity1 := loaded1[0].Entity.(*testEntity)
	assert.Equal(t, "e1", entity1.ID, "Workspace 1 entity ID should be preserved")
	assert.Equal(t, "Workspace 1 Entity", entity1.Name, "Workspace 1 entity name should be preserved")
	assert.Equal(t, "workspace-1", loaded1[0].Namespace, "Namespace should match")

	loaded2, err := store.Load(ctx, "workspace-2")
	require.NoError(t, err)
	assert.Len(t, loaded2, 1)
	entity2 := loaded2[0].Entity.(*testEntity)
	assert.Equal(t, "e1", entity2.ID, "Workspace 2 entity ID should be preserved")
	assert.Equal(t, "Workspace 2 Entity", entity2.Name, "Workspace 2 entity name should be preserved")
	assert.Equal(t, "workspace-2", loaded2[0].Namespace, "Namespace should match")
}

func TestPebbleStore_EmptyNamespace(t *testing.T) {
	tempDir := t.TempDir()

	// Create registry
	registry := persistence.NewJSONEntityRegistry()

	store, err := NewStore(tempDir, registry)
	require.NoError(t, err)
	defer store.Close()

	ctx := context.Background()

	// Load from non-existent namespace
	loaded, err := store.Load(ctx, "non-existent")
	require.NoError(t, err)
	assert.Empty(t, loaded)
}

func TestPebbleStore_ListNamespaces(t *testing.T) {
	tempDir := t.TempDir()

	// Create registry and register entity type
	registry := persistence.NewJSONEntityRegistry()
	registry.Register("test-entity", func() persistence.Entity {
		return &testEntity{}
	})

	store, err := NewStore(tempDir, registry)
	require.NoError(t, err)
	defer store.Close()

	ctx := context.Background()

	// Initially empty
	namespaces, err := store.ListNamespaces()
	require.NoError(t, err)
	assert.Empty(t, namespaces)

	// Add some namespaces
	for _, ns := range []string{"workspace-1", "workspace-2", "workspace-3"} {
		changes := persistence.NewChangesBuilder(ns).
			Set(&testEntity{ID: "e1", Name: "Entity"}).
			Build()
		err = store.Save(ctx, changes)
		require.NoError(t, err)
	}

	// List namespaces
	namespaces, err = store.ListNamespaces()
	require.NoError(t, err)
	assert.Len(t, namespaces, 3)
	assert.Contains(t, namespaces, "workspace-1")
	assert.Contains(t, namespaces, "workspace-2")
	assert.Contains(t, namespaces, "workspace-3")
}

func TestPebbleStore_DeleteNamespace(t *testing.T) {
	tempDir := t.TempDir()

	// Create registry and register entity type
	registry := persistence.NewJSONEntityRegistry()
	registry.Register("test-entity", func() persistence.Entity {
		return &testEntity{}
	})

	store, err := NewStore(tempDir, registry)
	require.NoError(t, err)
	defer store.Close()

	ctx := context.Background()

	// Create data in multiple namespaces
	changes1 := persistence.NewChangesBuilder("workspace-1").
		Set(&testEntity{ID: "e1", Name: "Entity 1"}).
		Set(&testEntity{ID: "e2", Name: "Entity 2"}).
		Build()

	changes2 := persistence.NewChangesBuilder("workspace-2").
		Set(&testEntity{ID: "e1", Name: "Entity 1"}).
		Build()

	err = store.Save(ctx, changes1)
	require.NoError(t, err)

	err = store.Save(ctx, changes2)
	require.NoError(t, err)

	// Verify both namespaces exist with correct data
	loaded1, err := store.Load(ctx, "workspace-1")
	require.NoError(t, err)
	assert.Len(t, loaded1, 2)

	// Verify workspace-1 entities
	ws1Entities := make(map[string]*testEntity)
	for _, change := range loaded1 {
		e := change.Entity.(*testEntity)
		ws1Entities[e.ID] = e
	}
	assert.Equal(t, "e1", ws1Entities["e1"].ID)
	assert.Equal(t, "Entity 1", ws1Entities["e1"].Name)
	assert.Equal(t, "e2", ws1Entities["e2"].ID)
	assert.Equal(t, "Entity 2", ws1Entities["e2"].Name)

	loaded2, err := store.Load(ctx, "workspace-2")
	require.NoError(t, err)
	assert.Len(t, loaded2, 1)

	// Verify workspace-2 entity
	entity2 := loaded2[0].Entity.(*testEntity)
	assert.Equal(t, "e1", entity2.ID)
	assert.Equal(t, "Entity 1", entity2.Name)

	// Delete workspace-1
	err = store.DeleteNamespace("workspace-1")
	require.NoError(t, err)

	// Verify workspace-1 is empty
	loaded1, err = store.Load(ctx, "workspace-1")
	require.NoError(t, err)
	assert.Empty(t, loaded1)

	// Verify workspace-2 is unchanged
	loaded2, err = store.Load(ctx, "workspace-2")
	require.NoError(t, err)
	assert.Len(t, loaded2, 1)
}

func TestPebbleStore_UnsetChangeType(t *testing.T) {
	tempDir := t.TempDir()

	// Create registry and register entity type
	registry := persistence.NewJSONEntityRegistry()
	registry.Register("test-entity", func() persistence.Entity {
		return &testEntity{}
	})

	store, err := NewStore(tempDir, registry)
	require.NoError(t, err)
	defer store.Close()

	ctx := context.Background()

	// Add entity
	changes := persistence.NewChangesBuilder("workspace-1").
		Set(&testEntity{ID: "e1", Name: "Entity 1"}).
		Build()

	err = store.Save(ctx, changes)
	require.NoError(t, err)

	// Unset entity
	unsetChanges := persistence.NewChangesBuilder("workspace-1").
		Unset(&testEntity{ID: "e1"},
			persistence.WithTimestamp(time.Now().Add(time.Second))).
		Build()

	err = store.Save(ctx, unsetChanges)
	require.NoError(t, err)

	// Load - should return the unset change (latest state)
	loaded, err := store.Load(ctx, "workspace-1")
	require.NoError(t, err)
	assert.Len(t, loaded, 1)
	assert.Equal(t, persistence.ChangeTypeUnset, loaded[0].ChangeType)

	// Verify the entity ID is preserved in the unset change
	unsetEntity := loaded[0].Entity.(*testEntity)
	assert.Equal(t, "e1", unsetEntity.ID, "Entity ID should be preserved in unset change")
}

func TestPebbleStore_ConcurrentAccess(t *testing.T) {
	tempDir := t.TempDir()

	// Create registry and register entity type
	registry := persistence.NewJSONEntityRegistry()
	registry.Register("test-entity", func() persistence.Entity {
		return &testEntity{}
	})

	store, err := NewStore(tempDir, registry)
	require.NoError(t, err)
	defer store.Close()

	ctx := context.Background()

	// Concurrent writes
	done := make(chan bool)
	for i := 0; i < 10; i++ {
		go func(id int) {
			changes := persistence.NewChangesBuilder("workspace-1").
				Set(&testEntity{ID: "concurrent", Name: "Entity"}).
				Build()
			store.Save(ctx, changes)
			done <- true
		}(i)
	}

	// Wait for all writes
	for i := 0; i < 10; i++ {
		<-done
	}

	// Should be able to load - verify concurrent writes resulted in one entity
	loaded, err := store.Load(ctx, "workspace-1")
	require.NoError(t, err)
	assert.Len(t, loaded, 1)

	// Verify the entity has correct ID and name
	entity := loaded[0].Entity.(*testEntity)
	assert.Equal(t, "concurrent", entity.ID, "Entity ID should be 'concurrent'")
	assert.Equal(t, "Entity", entity.Name, "Entity name should be preserved")
}

// otherEntity is a second test entity type
type otherEntity struct {
	ID    string `json:"id"`
	Value int    `json:"value"`
}

func (e *otherEntity) CompactionKey() (string, string) {
	return "other-entity", e.ID
}

func TestPebbleStore_MultipleEntityTypes(t *testing.T) {
	tempDir := t.TempDir()

	// Create registry and register both entity types
	registry := persistence.NewJSONEntityRegistry()
	registry.Register("test-entity", func() persistence.Entity {
		return &testEntity{}
	})
	registry.Register("other-entity", func() persistence.Entity {
		return &otherEntity{}
	})

	store, err := NewStore(tempDir, registry)
	require.NoError(t, err)
	defer store.Close()

	ctx := context.Background()

	// Save mixed entity types
	changes := []persistence.Change{
		{
			Namespace:  "workspace-1",
			ChangeType: persistence.ChangeTypeSet,
			Entity:     &testEntity{ID: "e1", Name: "Test Entity"},
		},
		{
			Namespace:  "workspace-1",
			ChangeType: persistence.ChangeTypeSet,
			Entity:     &otherEntity{ID: "o1", Value: 42},
		},
	}

	err = store.Save(ctx, changes)
	require.NoError(t, err)

	// Load and verify
	loaded, err := store.Load(ctx, "workspace-1")
	require.NoError(t, err)
	assert.Len(t, loaded, 2)

	// Verify both entity types and their values
	var loadedTestEntity *testEntity
	var loadedOtherEntity *otherEntity

	for _, change := range loaded {
		switch e := change.Entity.(type) {
		case *testEntity:
			loadedTestEntity = e
		case *otherEntity:
			loadedOtherEntity = e
		}
	}

	// Verify testEntity was loaded with correct values
	require.NotNil(t, loadedTestEntity, "testEntity should be loaded")
	assert.Equal(t, "e1", loadedTestEntity.ID, "testEntity ID should be preserved")
	assert.Equal(t, "Test Entity", loadedTestEntity.Name, "testEntity name should be preserved")

	// Verify otherEntity was loaded with correct values
	require.NotNil(t, loadedOtherEntity, "otherEntity should be loaded")
	assert.Equal(t, "o1", loadedOtherEntity.ID, "otherEntity ID should be preserved")
	assert.Equal(t, 42, loadedOtherEntity.Value, "otherEntity value should be preserved")
}

func BenchmarkPebbleStore_Save(b *testing.B) {
	tempDir := b.TempDir()

	// Create registry and register entity type
	registry := persistence.NewJSONEntityRegistry()
	registry.Register("test-entity", func() persistence.Entity {
		return &testEntity{}
	})

	store, err := NewStore(tempDir, registry)
	require.NoError(b, err)
	defer store.Close()

	ctx := context.Background()

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		changes := persistence.NewChangesBuilder("workspace-1").
			Set(&testEntity{ID: "e1", Name: "Entity"}).
			Build()
		store.Save(ctx, changes)
	}
}

func BenchmarkPebbleStore_Load(b *testing.B) {
	tempDir := b.TempDir()

	// Create registry and register entity type
	registry := persistence.NewJSONEntityRegistry()
	registry.Register("test-entity", func() persistence.Entity {
		return &testEntity{}
	})

	store, err := NewStore(tempDir, registry)
	require.NoError(b, err)
	defer store.Close()

	ctx := context.Background()

	// Setup: Save some data
	for i := 0; i < 100; i++ {
		changes := persistence.NewChangesBuilder("workspace-1").
			Set(&testEntity{ID: "e1", Name: "Entity"}).
			Build()
		store.Save(ctx, changes)
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		store.Load(ctx, "workspace-1")
	}
}
