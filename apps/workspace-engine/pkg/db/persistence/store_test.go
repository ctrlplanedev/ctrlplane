package persistence

import (
	"context"
	"encoding/json"
	"os"
	"testing"
	"time"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/persistence"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Mock entity types for testing
type mockResource struct {
	ID       string                 `json:"id"`
	Name     string                 `json:"name"`
	Kind     string                 `json:"kind"`
	Metadata map[string]interface{} `json:"metadata"`
}

func (m *mockResource) CompactionKey() (string, string) {
	return "resource", m.ID
}

type mockDeployment struct {
	ID      string `json:"id"`
	Version string `json:"version"`
	Status  string `json:"status"`
}

func (m *mockDeployment) CompactionKey() (string, string) {
	return "deployment", m.ID
}

// Test setup helpers

const testPostgresURL = "postgresql://ctrlplane:ctrlplane@localhost:5432/ctrlplane"

func TestMain(m *testing.M) {
	// Set default POSTGRES_URL if not already set
	if os.Getenv("POSTGRES_URL") == "" {
		os.Setenv("POSTGRES_URL", testPostgresURL)
	}

	// Run tests
	code := m.Run()

	// Cleanup
	db.Close()
	os.Exit(code)
}

// setupTestWithWorkspace creates a workspace and returns its ID along with a DB connection
func setupTestWithWorkspace(t *testing.T) (context.Context, string, *pgxpool.Conn) {
	t.Helper()
	ctx := context.Background()

	// Verify database connection
	pool := db.GetPool(ctx)
	if err := pool.Ping(ctx); err != nil {
		t.Skipf("Database not available (tried %s): %v", os.Getenv("POSTGRES_URL"), err)
	}

	// Create unique workspace ID
	workspaceID := uuid.New().String()

	// Insert workspace
	tempDB, err := db.GetDB(ctx)
	if err != nil {
		t.Fatalf("Failed to get DB connection: %v", err)
	}
	defer tempDB.Release()

	_, err = tempDB.Exec(ctx,
		"INSERT INTO workspace (id, name, slug) VALUES ($1, $2, $3)",
		workspaceID, "test_"+workspaceID[:8], "test-"+workspaceID[:8])
	if err != nil {
		t.Fatalf("Failed to create test workspace: %v", err)
	}

	// Get a fresh connection for the test
	testDB, err := db.GetDB(ctx)
	if err != nil {
		t.Fatalf("Failed to get test DB connection: %v", err)
	}

	// Register cleanup
	t.Cleanup(func() {
		testDB.Release()

		cleanupDB, err := db.GetDB(ctx)
		if err != nil {
			t.Logf("Cleanup: Failed to get DB connection: %v", err)
			return
		}
		defer cleanupDB.Release()

		// Delete workspace (cascades to related tables including changelog_entry)
		_, err = cleanupDB.Exec(ctx, "DELETE FROM workspace WHERE id = $1", workspaceID)
		if err != nil {
			t.Logf("Cleanup: Failed to delete workspace: %v", err)
		}
	})

	return ctx, workspaceID, testDB
}

// createTestStore creates a Store instance for testing
func createTestStore(t *testing.T, conn *pgxpool.Conn) *Store {
	t.Helper()
	return &Store{conn: conn}
}

// Helper to create a change
func makeChange(namespace string, changeType persistence.ChangeType, entity persistence.Entity) persistence.Change {
	return persistence.Change{
		Namespace:  namespace,
		ChangeType: changeType,
		Entity:     entity,
		Timestamp:  time.Now(),
	}
}

// Helper to verify changelog entry exists in DB
func verifyChangelogEntry(t *testing.T, ctx context.Context, conn *pgxpool.Conn, workspaceID, entityType, entityID string) map[string]interface{} {
	t.Helper()

	var entityData []byte
	var createdAt time.Time

	err := conn.QueryRow(ctx,
		"SELECT entity_data, created_at FROM changelog_entry WHERE workspace_id = $1 AND entity_type = $2 AND entity_id = $3",
		workspaceID, entityType, entityID,
	).Scan(&entityData, &createdAt)

	if err != nil {
		t.Fatalf("Failed to query changelog entry: %v", err)
	}

	var data map[string]interface{}
	if err := json.Unmarshal(entityData, &data); err != nil {
		t.Fatalf("Failed to unmarshal entity data: %v", err)
	}

	return data
}

// Helper to verify changelog entry does not exist in DB
func verifyChangelogEntryNotExists(t *testing.T, ctx context.Context, conn *pgxpool.Conn, workspaceID, entityType, entityID string) {
	t.Helper()

	var count int
	err := conn.QueryRow(ctx,
		"SELECT COUNT(*) FROM changelog_entry WHERE workspace_id = $1 AND entity_type = $2 AND entity_id = $3",
		workspaceID, entityType, entityID,
	).Scan(&count)

	if err != nil {
		t.Fatalf("Failed to query changelog entry count: %v", err)
	}

	if count != 0 {
		t.Fatalf("Expected changelog entry to not exist, but found %d entries", count)
	}
}

// Tests

func TestStore_Save_Upsert_SingleEntity(t *testing.T) {
	ctx, workspaceID, conn := setupTestWithWorkspace(t)
	store := createTestStore(t, conn)

	resource := &mockResource{
		ID:   uuid.New().String(),
		Name: "test-resource",
		Kind: "pod",
		Metadata: map[string]interface{}{
			"namespace": "default",
			"labels":    map[string]string{"app": "test"},
		},
	}

	changes := persistence.Changes{
		makeChange(workspaceID, persistence.ChangeTypeSet, resource),
	}

	// Save the changes
	err := store.Save(ctx, changes)
	if err != nil {
		t.Fatalf("Save failed: %v", err)
	}

	// Verify the entry was created
	data := verifyChangelogEntry(t, ctx, conn, workspaceID, "resource", resource.ID)

	// Verify the data
	if data["id"] != resource.ID {
		t.Errorf("Expected id %s, got %s", resource.ID, data["id"])
	}
	if data["name"] != resource.Name {
		t.Errorf("Expected name %s, got %s", resource.Name, data["name"])
	}
}

func TestStore_Save_Upsert_MultipleEntities(t *testing.T) {
	ctx, workspaceID, conn := setupTestWithWorkspace(t)
	store := createTestStore(t, conn)

	resource1 := &mockResource{
		ID:   uuid.New().String(),
		Name: "resource-1",
		Kind: "pod",
	}

	resource2 := &mockResource{
		ID:   uuid.New().String(),
		Name: "resource-2",
		Kind: "service",
	}

	deployment := &mockDeployment{
		ID:      uuid.New().String(),
		Version: "v1.0.0",
		Status:  "running",
	}

	changes := persistence.Changes{
		makeChange(workspaceID, persistence.ChangeTypeSet, resource1),
		makeChange(workspaceID, persistence.ChangeTypeSet, resource2),
		makeChange(workspaceID, persistence.ChangeTypeSet, deployment),
	}

	// Save the changes
	err := store.Save(ctx, changes)
	if err != nil {
		t.Fatalf("Save failed: %v", err)
	}

	// Verify all entries were created
	data1 := verifyChangelogEntry(t, ctx, conn, workspaceID, "resource", resource1.ID)
	if data1["name"] != "resource-1" {
		t.Errorf("Expected name resource-1, got %s", data1["name"])
	}

	data2 := verifyChangelogEntry(t, ctx, conn, workspaceID, "resource", resource2.ID)
	if data2["name"] != "resource-2" {
		t.Errorf("Expected name resource-2, got %s", data2["name"])
	}

	data3 := verifyChangelogEntry(t, ctx, conn, workspaceID, "deployment", deployment.ID)
	if data3["version"] != "v1.0.0" {
		t.Errorf("Expected version v1.0.0, got %s", data3["version"])
	}
}

func TestStore_Save_Upsert_UpdateExisting(t *testing.T) {
	ctx, workspaceID, conn := setupTestWithWorkspace(t)
	store := createTestStore(t, conn)

	resourceID := uuid.New().String()

	// First save
	resource1 := &mockResource{
		ID:   resourceID,
		Name: "original-name",
		Kind: "pod",
	}

	changes1 := persistence.Changes{
		makeChange(workspaceID, persistence.ChangeTypeSet, resource1),
	}

	err := store.Save(ctx, changes1)
	if err != nil {
		t.Fatalf("First save failed: %v", err)
	}

	// Verify first save
	data1 := verifyChangelogEntry(t, ctx, conn, workspaceID, "resource", resourceID)
	if data1["name"] != "original-name" {
		t.Errorf("Expected name original-name, got %s", data1["name"])
	}

	// Update the same entity
	resource2 := &mockResource{
		ID:   resourceID,
		Name: "updated-name",
		Kind: "deployment",
		Metadata: map[string]interface{}{
			"updated": true,
		},
	}

	changes2 := persistence.Changes{
		makeChange(workspaceID, persistence.ChangeTypeSet, resource2),
	}

	err = store.Save(ctx, changes2)
	if err != nil {
		t.Fatalf("Second save failed: %v", err)
	}

	// Verify the entry was updated
	data2 := verifyChangelogEntry(t, ctx, conn, workspaceID, "resource", resourceID)
	if data2["name"] != "updated-name" {
		t.Errorf("Expected name updated-name, got %s", data2["name"])
	}
	if data2["kind"] != "deployment" {
		t.Errorf("Expected kind deployment, got %s", data2["kind"])
	}

	// Verify only one entry exists (not duplicated)
	var count int
	err = conn.QueryRow(ctx,
		"SELECT COUNT(*) FROM changelog_entry WHERE workspace_id = $1 AND entity_type = $2 AND entity_id = $3",
		workspaceID, "resource", resourceID,
	).Scan(&count)
	if err != nil {
		t.Fatalf("Failed to count entries: %v", err)
	}
	if count != 1 {
		t.Errorf("Expected 1 entry, got %d", count)
	}
}

func TestStore_Save_Delete_SingleEntity(t *testing.T) {
	ctx, workspaceID, conn := setupTestWithWorkspace(t)
	store := createTestStore(t, conn)

	resource := &mockResource{
		ID:   uuid.New().String(),
		Name: "to-be-deleted",
		Kind: "pod",
	}

	// First create the entity
	changes1 := persistence.Changes{
		makeChange(workspaceID, persistence.ChangeTypeSet, resource),
	}
	err := store.Save(ctx, changes1)
	if err != nil {
		t.Fatalf("Failed to create entity: %v", err)
	}

	// Verify it exists
	verifyChangelogEntry(t, ctx, conn, workspaceID, "resource", resource.ID)

	// Now delete it
	changes2 := persistence.Changes{
		makeChange(workspaceID, persistence.ChangeTypeUnset, resource),
	}
	err = store.Save(ctx, changes2)
	if err != nil {
		t.Fatalf("Failed to delete entity: %v", err)
	}

	// Verify it was deleted
	verifyChangelogEntryNotExists(t, ctx, conn, workspaceID, "resource", resource.ID)
}

func TestStore_Save_Delete_MultipleEntities(t *testing.T) {
	ctx, workspaceID, conn := setupTestWithWorkspace(t)
	store := createTestStore(t, conn)

	resource1 := &mockResource{ID: uuid.New().String(), Name: "resource-1"}
	resource2 := &mockResource{ID: uuid.New().String(), Name: "resource-2"}
	deployment := &mockDeployment{ID: uuid.New().String(), Version: "v1.0.0"}

	// Create entities
	createChanges := persistence.Changes{
		makeChange(workspaceID, persistence.ChangeTypeSet, resource1),
		makeChange(workspaceID, persistence.ChangeTypeSet, resource2),
		makeChange(workspaceID, persistence.ChangeTypeSet, deployment),
	}
	err := store.Save(ctx, createChanges)
	if err != nil {
		t.Fatalf("Failed to create entities: %v", err)
	}

	// Delete all entities
	deleteChanges := persistence.Changes{
		makeChange(workspaceID, persistence.ChangeTypeUnset, resource1),
		makeChange(workspaceID, persistence.ChangeTypeUnset, resource2),
		makeChange(workspaceID, persistence.ChangeTypeUnset, deployment),
	}
	err = store.Save(ctx, deleteChanges)
	if err != nil {
		t.Fatalf("Failed to delete entities: %v", err)
	}

	// Verify all were deleted
	verifyChangelogEntryNotExists(t, ctx, conn, workspaceID, "resource", resource1.ID)
	verifyChangelogEntryNotExists(t, ctx, conn, workspaceID, "resource", resource2.ID)
	verifyChangelogEntryNotExists(t, ctx, conn, workspaceID, "deployment", deployment.ID)
}

func TestStore_Save_MixedOperations(t *testing.T) {
	ctx, workspaceID, conn := setupTestWithWorkspace(t)
	store := createTestStore(t, conn)

	// Create some initial entities
	resource1 := &mockResource{ID: uuid.New().String(), Name: "keep-me"}
	resource2 := &mockResource{ID: uuid.New().String(), Name: "delete-me"}
	resource3 := &mockResource{ID: uuid.New().String(), Name: "update-me"}

	initialChanges := persistence.Changes{
		makeChange(workspaceID, persistence.ChangeTypeSet, resource1),
		makeChange(workspaceID, persistence.ChangeTypeSet, resource2),
		makeChange(workspaceID, persistence.ChangeTypeSet, resource3),
	}
	err := store.Save(ctx, initialChanges)
	if err != nil {
		t.Fatalf("Failed to create initial entities: %v", err)
	}

	// Mixed operations: update resource3, delete resource2, create resource4
	resource3Updated := &mockResource{ID: resource3.ID, Name: "updated-name"}
	resource4 := &mockResource{ID: uuid.New().String(), Name: "new-resource"}

	mixedChanges := persistence.Changes{
		makeChange(workspaceID, persistence.ChangeTypeSet, resource3Updated),
		makeChange(workspaceID, persistence.ChangeTypeUnset, resource2),
		makeChange(workspaceID, persistence.ChangeTypeSet, resource4),
	}
	err = store.Save(ctx, mixedChanges)
	if err != nil {
		t.Fatalf("Failed to save mixed changes: %v", err)
	}

	// Verify results
	// resource1 should still exist unchanged
	data1 := verifyChangelogEntry(t, ctx, conn, workspaceID, "resource", resource1.ID)
	if data1["name"] != "keep-me" {
		t.Errorf("Expected resource1 name keep-me, got %s", data1["name"])
	}

	// resource2 should be deleted
	verifyChangelogEntryNotExists(t, ctx, conn, workspaceID, "resource", resource2.ID)

	// resource3 should be updated
	data3 := verifyChangelogEntry(t, ctx, conn, workspaceID, "resource", resource3.ID)
	if data3["name"] != "updated-name" {
		t.Errorf("Expected resource3 name updated-name, got %s", data3["name"])
	}

	// resource4 should be created
	data4 := verifyChangelogEntry(t, ctx, conn, workspaceID, "resource", resource4.ID)
	if data4["name"] != "new-resource" {
		t.Errorf("Expected resource4 name new-resource, got %s", data4["name"])
	}
}

func TestStore_Save_EmptyChanges(t *testing.T) {
	ctx, _, conn := setupTestWithWorkspace(t)
	store := createTestStore(t, conn)

	// Save empty changes should not error
	err := store.Save(ctx, persistence.Changes{})
	if err != nil {
		t.Fatalf("Save with empty changes failed: %v", err)
	}
}

func TestStore_Save_WorkspaceIsolation(t *testing.T) {
	ctx1, workspaceID1, conn1 := setupTestWithWorkspace(t)
	ctx2, workspaceID2, conn2 := setupTestWithWorkspace(t)

	store1 := createTestStore(t, conn1)
	store2 := createTestStore(t, conn2)

	// Same entity ID but different workspaces
	entityID := uuid.New().String()

	resource1 := &mockResource{ID: entityID, Name: "workspace-1-resource"}
	resource2 := &mockResource{ID: entityID, Name: "workspace-2-resource"}

	// Save to workspace 1
	changes1 := persistence.Changes{
		makeChange(workspaceID1, persistence.ChangeTypeSet, resource1),
	}
	err := store1.Save(ctx1, changes1)
	if err != nil {
		t.Fatalf("Failed to save to workspace 1: %v", err)
	}

	// Save to workspace 2
	changes2 := persistence.Changes{
		makeChange(workspaceID2, persistence.ChangeTypeSet, resource2),
	}
	err = store2.Save(ctx2, changes2)
	if err != nil {
		t.Fatalf("Failed to save to workspace 2: %v", err)
	}

	// Verify both exist with correct data
	data1 := verifyChangelogEntry(t, ctx1, conn1, workspaceID1, "resource", entityID)
	if data1["name"] != "workspace-1-resource" {
		t.Errorf("Expected workspace-1-resource, got %s", data1["name"])
	}

	data2 := verifyChangelogEntry(t, ctx2, conn2, workspaceID2, "resource", entityID)
	if data2["name"] != "workspace-2-resource" {
		t.Errorf("Expected workspace-2-resource, got %s", data2["name"])
	}
}

func TestStore_Save_TransactionRollback(t *testing.T) {
	ctx, workspaceID, conn := setupTestWithWorkspace(t)
	store := createTestStore(t, conn)

	// Create a valid entity
	validResource := &mockResource{
		ID:   uuid.New().String(),
		Name: "valid-resource",
	}

	// Create an entity with an invalid workspace ID (should cause FK constraint violation)
	invalidWorkspaceResource := &mockResource{
		ID:   uuid.New().String(),
		Name: "invalid-workspace-resource",
	}

	changes := persistence.Changes{
		makeChange(workspaceID, persistence.ChangeTypeSet, validResource),
		makeChange("00000000-0000-0000-0000-000000000000", persistence.ChangeTypeSet, invalidWorkspaceResource),
	}

	// Save should fail due to FK constraint
	err := store.Save(ctx, changes)
	if err == nil {
		t.Fatal("Expected Save to fail with FK constraint violation, but it succeeded")
	}

	// Verify that the valid resource was NOT saved (transaction rolled back)
	verifyChangelogEntryNotExists(t, ctx, conn, workspaceID, "resource", validResource.ID)
}

func TestStore_Close(t *testing.T) {
	_, _, conn := setupTestWithWorkspace(t)
	store := createTestStore(t, conn)

	// Close should not error
	err := store.Close()
	if err != nil {
		t.Fatalf("Close failed: %v", err)
	}
}
