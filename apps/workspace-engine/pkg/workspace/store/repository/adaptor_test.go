package repository

import (
	"context"
	"testing"
	"workspace-engine/pkg/cmap"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// mockEntity implements persistence.Entity interface for testing
type mockEntity struct {
	id   string
	name string
}

func (m *mockEntity) CompactionKey() (string, string) {
	return "mock_entity", m.id
}

func TestRepositoryAdapter_Create(t *testing.T) {
	ctx := context.Background()
	cm := cmap.New[*mockEntity]()
	adapter := &TypedStoreAdapter[*mockEntity]{store: &cm}

	entity := &mockEntity{id: "entity-1", name: "Test Entity"}

	// Test Create
	err := adapter.Set(ctx, entity)
	require.NoError(t, err, "Create should not fail")

	// Verify entity was stored
	stored, ok := cm.Get("entity-1")
	require.True(t, ok, "Entity should be stored in the map")
	assert.Equal(t, "Test Entity", stored.name, "Entity name should match")
}

func TestRepositoryAdapter_Update(t *testing.T) {
	ctx := context.Background()
	cm := cmap.New[*mockEntity]()
	adapter := &TypedStoreAdapter[*mockEntity]{store: &cm}

	// Create initial entity
	entity := &mockEntity{id: "entity-1", name: "Original Name"}
	require.NoError(t, adapter.Set(ctx, entity))

	// Update entity
	updatedEntity := &mockEntity{id: "entity-1", name: "Updated Name"}
	err := adapter.Set(ctx, updatedEntity)
	require.NoError(t, err, "Update should not fail")

	// Verify entity was updated
	stored, ok := cm.Get("entity-1")
	require.True(t, ok, "Entity should be found after update")
	assert.Equal(t, "Updated Name", stored.name, "Entity name should be updated")
}

func TestRepositoryAdapter_Delete(t *testing.T) {
	ctx := context.Background()
	cm := cmap.New[*mockEntity]()
	adapter := &TypedStoreAdapter[*mockEntity]{store: &cm}

	// Create entity
	entity := &mockEntity{id: "entity-1", name: "Test Entity"}
	require.NoError(t, adapter.Set(ctx, entity))

	// Verify it exists
	_, ok := cm.Get("entity-1")
	require.True(t, ok, "Entity should be created")

	// Delete entity
	err := adapter.Unset(ctx, entity)
	require.NoError(t, err, "Delete should not fail")

	// Verify entity was removed
	_, ok = cm.Get("entity-1")
	assert.False(t, ok, "Entity should be deleted from the map")
}

func TestRepositoryAdapter_MultipleEntities(t *testing.T) {
	ctx := context.Background()
	cm := cmap.New[*mockEntity]()
	adapter := &TypedStoreAdapter[*mockEntity]{store: &cm}

	// Create multiple entities
	entities := []*mockEntity{
		{id: "entity-1", name: "Entity 1"},
		{id: "entity-2", name: "Entity 2"},
		{id: "entity-3", name: "Entity 3"},
	}

	for _, entity := range entities {
		err := adapter.Set(ctx, entity)
		require.NoError(t, err, "Should create entity %s", entity.id)
	}

	// Verify all entities exist
	assert.Equal(t, 3, cm.Count(), "Should have 3 entities")

	// Delete one entity
	err := adapter.Unset(ctx, entities[1])
	require.NoError(t, err, "Should delete entity")

	// Verify count decreased
	assert.Equal(t, 2, cm.Count(), "Should have 2 entities after deletion")
}
