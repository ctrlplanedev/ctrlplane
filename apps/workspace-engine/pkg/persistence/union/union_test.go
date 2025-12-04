package union_test

import (
	"context"
	"testing"
	"time"

	"workspace-engine/pkg/persistence"
	"workspace-engine/pkg/persistence/memory"
	"workspace-engine/pkg/persistence/union"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Mock entity for testing
type mockEntity struct {
	id   string
	name string
}

func (m *mockEntity) CompactionKey() (string, string) {
	return "entity", m.id
}

func TestUnionStore_SaveToAll(t *testing.T) {
	ctx := context.Background()
	namespace := "workspace-1"

	// Create multiple stores
	store1 := memory.NewStore()
	store2 := memory.NewStore()
	store3 := memory.NewStore()

	// Create union store
	unionStore := union.New(store1, store2, store3)

	// Save changes
	changes := persistence.NewChangesBuilder(namespace).
		Set(&mockEntity{id: "e1", name: "Entity 1"}).
		Build()

	err := unionStore.Save(ctx, changes)
	require.NoError(t, err)

	// Verify all stores received the changes
	loaded1, _ := store1.Load(ctx, namespace)
	assert.Len(t, loaded1, 1)

	loaded2, _ := store2.Load(ctx, namespace)
	assert.Len(t, loaded2, 1)

	loaded3, _ := store3.Load(ctx, namespace)
	assert.Len(t, loaded3, 1)
}

func TestUnionStore_LoadMergesFromAll(t *testing.T) {
	ctx := context.Background()
	namespace := "workspace-1"

	// Create multiple stores with different data
	store1 := memory.NewStore()
	store2 := memory.NewStore()

	// Store1 has entity e1
	changes1 := persistence.NewChangesBuilder(namespace).
		Set(&mockEntity{id: "e1", name: "Entity 1"}).
		Build()
	_ = store1.Save(ctx, changes1)

	// Store2 has entity e2
	changes2 := persistence.NewChangesBuilder(namespace).
		Set(&mockEntity{id: "e2", name: "Entity 2"}).
		Build()
	_ = store2.Save(ctx, changes2)

	// Create union store
	unionStore := union.New(store1, store2)

	// Load should merge both
	loaded, err := unionStore.Load(ctx, namespace)
	require.NoError(t, err)
	assert.Len(t, loaded, 2, "Should have entities from both stores")
}

func TestUnionStore_KeepsLatestByTimestamp(t *testing.T) {
	ctx := context.Background()
	namespace := "workspace-1"

	// Create multiple stores
	store1 := memory.NewStore()
	store2 := memory.NewStore()

	now := time.Now()

	// Store1 has older version
	changes1 := persistence.NewChangesBuilder(namespace).
		Set(&mockEntity{id: "e1", name: "Old Version"}, persistence.WithTimestamp(now.Add(-1*time.Hour))).
		Build()
	_ = store1.Save(ctx, changes1)

	// Store2 has newer version
	changes2 := persistence.NewChangesBuilder(namespace).
		Set(&mockEntity{id: "e1", name: "New Version"}, persistence.WithTimestamp(now)).
		Build()
	_ = store2.Save(ctx, changes2)

	// Create union store
	unionStore := union.New(store1, store2)

	// Load should keep the newer version
	loaded, err := unionStore.Load(ctx, namespace)
	require.NoError(t, err)
	assert.Len(t, loaded, 1, "Should have only 1 entity after compaction")

	entity := loaded[0].Entity.(*mockEntity)
	assert.Equal(t, "New Version", entity.name, "Should keep the newer version")
}

func TestUnionStore_EmptyStores(t *testing.T) {
	ctx := context.Background()
	namespace := "workspace-1"

	// Create union of empty stores
	unionStore := union.New(memory.NewStore(), memory.NewStore())

	// Load from empty stores
	loaded, err := unionStore.Load(ctx, namespace)
	require.NoError(t, err)
	assert.Empty(t, loaded)
}

func TestUnionStore_SingleStore(t *testing.T) {
	ctx := context.Background()
	namespace := "workspace-1"

	// Create union with single store
	store := memory.NewStore()
	unionStore := union.New(store)

	changes := persistence.NewChangesBuilder(namespace).
		Set(&mockEntity{id: "e1", name: "Entity 1"}).
		Build()

	err := unionStore.Save(ctx, changes)
	require.NoError(t, err)

	loaded, err := unionStore.Load(ctx, namespace)
	require.NoError(t, err)
	assert.Len(t, loaded, 1)
}

func TestUnionStore_Close(t *testing.T) {
	// Create multiple stores
	store1 := memory.NewStore()
	store2 := memory.NewStore()

	unionStore := union.New(store1, store2)

	err := unionStore.Close()
	assert.NoError(t, err)
}

func TestUnionStore_StoreCount(t *testing.T) {
	unionStore := union.New(
		memory.NewStore(),
		memory.NewStore(),
		memory.NewStore(),
	)

	assert.Equal(t, 3, unionStore.StoreCount())
}

func TestUnionStore_CompactionAcrossStores(t *testing.T) {
	ctx := context.Background()
	namespace := "workspace-1"

	// Create multiple stores
	store1 := memory.NewStore()
	store2 := memory.NewStore()
	store3 := memory.NewStore()

	now := time.Now()

	// Different stores have different versions of same entities at different times
	changes1 := persistence.NewChangesBuilder(namespace).
		Set(&mockEntity{id: "e1", name: "v1"}, persistence.WithTimestamp(now.Add(-2*time.Hour))).
		Set(&mockEntity{id: "e2", name: "v1"}, persistence.WithTimestamp(now.Add(-2*time.Hour))).
		Build()
	_ = store1.Save(ctx, changes1)

	changes2 := persistence.NewChangesBuilder(namespace).
		Set(&mockEntity{id: "e1", name: "v2"}, persistence.WithTimestamp(now.Add(-1*time.Hour))).
		Set(&mockEntity{id: "e3", name: "v1"}, persistence.WithTimestamp(now.Add(-1*time.Hour))).
		Build()
	_ = store2.Save(ctx, changes2)

	changes3 := persistence.NewChangesBuilder(namespace).
		Set(&mockEntity{id: "e2", name: "v2"}, persistence.WithTimestamp(now)).
		Build()
	_ = store3.Save(ctx, changes3)

	// Create union store
	unionStore := union.New(store1, store2, store3)

	// Load should compact to latest version of each entity
	loaded, err := unionStore.Load(ctx, namespace)
	require.NoError(t, err)
	assert.Len(t, loaded, 3, "Should have 3 distinct entities")

	// Verify we got the latest versions
	entities := make(map[string]string)
	for _, change := range loaded {
		entity := change.Entity.(*mockEntity)
		entities[entity.id] = entity.name
	}

	assert.Equal(t, "v2", entities["e1"], "e1 should be from store2")
	assert.Equal(t, "v2", entities["e2"], "e2 should be from store3")
	assert.Equal(t, "v1", entities["e3"], "e3 should be from store2")
}
