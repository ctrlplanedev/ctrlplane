package persistence

import (
	"context"
	"encoding/json"
	"os"
	"testing"
	"time"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/persistence"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	openapi_types "github.com/oapi-codegen/runtime/types"
)

// Mock entity types for testing
type mockResource struct {
	ID       string                 `json:"id"`
	Name     string                 `json:"name"`
	Kind     string                 `json:"kind"`
	Metadata map[string]interface{} `json:"metadata"`
}

func (m *mockResource) CompactionKey() (string, string) {
	return "mock_resource", m.ID
}

type mockDeployment struct {
	ID      string `json:"id"`
	Version string `json:"version"`
	Status  string `json:"status"`
}

func (m *mockDeployment) CompactionKey() (string, string) {
	return "mock_deployment", m.ID
}

func customJobAgentConfig(m map[string]interface{}) oapi.JobAgentConfig {
	// Minimal approach for tests: force discriminator, marshal, and rely on generated UnmarshalJSON.
	payload := map[string]interface{}{}
	for k, v := range m {
		payload[k] = v
	}
	payload["type"] = "custom"

	b, err := json.Marshal(payload)
	if err != nil {
		panic(err)
	}

	var cfg oapi.JobAgentConfig
	if err := json.Unmarshal(b, &cfg); err != nil {
		panic(err)
	}
	return cfg
}

func customFullJobAgentConfig(m map[string]interface{}) oapi.JobAgentConfig {
	// For Job.jobAgentConfig (resolved/merged config)
	payload := map[string]interface{}{}
	for k, v := range m {
		payload[k] = v
	}
	payload["type"] = "custom"

	b, err := json.Marshal(payload)
	if err != nil {
		panic(err)
	}

	var cfg oapi.JobAgentConfig
	if err := json.Unmarshal(b, &cfg); err != nil {
		panic(err)
	}
	return cfg
}

func customJobAgentDefaults(m map[string]interface{}) oapi.JobAgentConfig {
	// For JobAgent.config (agent default config)
	payload := map[string]interface{}{}
	for k, v := range m {
		payload[k] = v
	}
	payload["type"] = "custom"

	b, err := json.Marshal(payload)
	if err != nil {
		panic(err)
	}

	var cfg oapi.JobAgentConfig
	if err := json.Unmarshal(b, &cfg); err != nil {
		panic(err)
	}
	return cfg
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
	data := verifyChangelogEntry(t, ctx, conn, workspaceID, "mock_resource", resource.ID)

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
	data1 := verifyChangelogEntry(t, ctx, conn, workspaceID, "mock_resource", resource1.ID)
	if data1["name"] != "resource-1" {
		t.Errorf("Expected name resource-1, got %s", data1["name"])
	}

	data2 := verifyChangelogEntry(t, ctx, conn, workspaceID, "mock_resource", resource2.ID)
	if data2["name"] != "resource-2" {
		t.Errorf("Expected name resource-2, got %s", data2["name"])
	}

	data3 := verifyChangelogEntry(t, ctx, conn, workspaceID, "mock_deployment", deployment.ID)
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
	data1 := verifyChangelogEntry(t, ctx, conn, workspaceID, "mock_resource", resourceID)
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
	data2 := verifyChangelogEntry(t, ctx, conn, workspaceID, "mock_resource", resourceID)
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
		workspaceID, "mock_resource", resourceID,
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
	verifyChangelogEntry(t, ctx, conn, workspaceID, "mock_resource", resource.ID)

	// Now delete it
	changes2 := persistence.Changes{
		makeChange(workspaceID, persistence.ChangeTypeUnset, resource),
	}
	err = store.Save(ctx, changes2)
	if err != nil {
		t.Fatalf("Failed to delete entity: %v", err)
	}

	// Verify it was deleted
	verifyChangelogEntryNotExists(t, ctx, conn, workspaceID, "mock_resource", resource.ID)
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
	verifyChangelogEntryNotExists(t, ctx, conn, workspaceID, "mock_resource", resource1.ID)
	verifyChangelogEntryNotExists(t, ctx, conn, workspaceID, "mock_resource", resource2.ID)
	verifyChangelogEntryNotExists(t, ctx, conn, workspaceID, "mock_deployment", deployment.ID)
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
	data1 := verifyChangelogEntry(t, ctx, conn, workspaceID, "mock_resource", resource1.ID)
	if data1["name"] != "keep-me" {
		t.Errorf("Expected resource1 name keep-me, got %s", data1["name"])
	}

	// resource2 should be deleted
	verifyChangelogEntryNotExists(t, ctx, conn, workspaceID, "mock_resource", resource2.ID)

	// resource3 should be updated
	data3 := verifyChangelogEntry(t, ctx, conn, workspaceID, "mock_resource", resource3.ID)
	if data3["name"] != "updated-name" {
		t.Errorf("Expected resource3 name updated-name, got %s", data3["name"])
	}

	// resource4 should be created
	data4 := verifyChangelogEntry(t, ctx, conn, workspaceID, "mock_resource", resource4.ID)
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
	data1 := verifyChangelogEntry(t, ctx1, conn1, workspaceID1, "mock_resource", entityID)
	if data1["name"] != "workspace-1-resource" {
		t.Errorf("Expected workspace-1-resource, got %s", data1["name"])
	}

	data2 := verifyChangelogEntry(t, ctx2, conn2, workspaceID2, "mock_resource", entityID)
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
	verifyChangelogEntryNotExists(t, ctx, conn, workspaceID, "mock_resource", validResource.ID)
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

// Tests for Load function with all entity types

func TestStore_Load_EmptyWorkspace(t *testing.T) {
	ctx, workspaceID, conn := setupTestWithWorkspace(t)
	store := createTestStore(t, conn)

	// Load from empty workspace
	changes, err := store.Load(ctx, workspaceID)
	if err != nil {
		t.Fatalf("Load failed: %v", err)
	}

	if len(changes) != 0 {
		t.Errorf("Expected 0 changes, got %d", len(changes))
	}
}

func TestStore_SaveAndLoad_Resource(t *testing.T) {
	ctx, workspaceID, conn := setupTestWithWorkspace(t)
	store := createTestStore(t, conn)

	// Create resource entity using OAPI type
	resource := &oapi.Resource{
		Id:          uuid.New().String(),
		Identifier:  uuid.New().String(),
		Name:        "test-resource",
		Kind:        "pod",
		WorkspaceId: workspaceID,
		Config:      map[string]interface{}{"key": "value"},
		Metadata:    map[string]string{"label": "test"},
		Version:     "v1",
		CreatedAt:   time.Now(),
	}

	// Save
	changes := persistence.Changes{
		makeChange(workspaceID, persistence.ChangeTypeSet, resource),
	}
	err := store.Save(ctx, changes)
	if err != nil {
		t.Fatalf("Save failed: %v", err)
	}

	// Load
	loadedChanges, err := store.Load(ctx, workspaceID)
	if err != nil {
		t.Fatalf("Load failed: %v", err)
	}

	if len(loadedChanges) != 1 {
		t.Fatalf("Expected 1 change, got %d", len(loadedChanges))
	}

	// Verify entity type
	loadedResource, ok := loadedChanges[0].Entity.(*oapi.Resource)
	if !ok {
		t.Fatalf("Expected *oapi.Resource, got %T", loadedChanges[0].Entity)
	}

	// Verify data
	if loadedResource.Identifier != resource.Identifier {
		t.Errorf("Expected Identifier %s, got %s", resource.Identifier, loadedResource.Identifier)
	}
	if loadedResource.Name != resource.Name {
		t.Errorf("Expected Name %s, got %s", resource.Name, loadedResource.Name)
	}
	if loadedResource.Kind != resource.Kind {
		t.Errorf("Expected Kind %s, got %s", resource.Kind, loadedResource.Kind)
	}
}

func TestStore_SaveAndLoad_Deployment(t *testing.T) {
	ctx, workspaceID, conn := setupTestWithWorkspace(t)
	store := createTestStore(t, conn)

	// Create deployment entity using OAPI type
	deployment := &oapi.Deployment{
		Id:             uuid.New().String(),
		Name:           "test-deployment",
		Slug:           "test-deployment-slug",
		JobAgentConfig: customJobAgentConfig(map[string]interface{}{"version": "v1.2.3"}),
	}

	// Save
	changes := persistence.Changes{
		makeChange(workspaceID, persistence.ChangeTypeSet, deployment),
	}
	err := store.Save(ctx, changes)
	if err != nil {
		t.Fatalf("Save failed: %v", err)
	}

	// Load
	loadedChanges, err := store.Load(ctx, workspaceID)
	if err != nil {
		t.Fatalf("Load failed: %v", err)
	}

	if len(loadedChanges) != 1 {
		t.Fatalf("Expected 1 change, got %d", len(loadedChanges))
	}

	// Verify entity type
	loadedDeployment, ok := loadedChanges[0].Entity.(*oapi.Deployment)
	if !ok {
		t.Fatalf("Expected *oapi.Deployment, got %T", loadedChanges[0].Entity)
	}

	// Verify data
	if loadedDeployment.Id != deployment.Id {
		t.Errorf("Expected Id %s, got %s", deployment.Id, loadedDeployment.Id)
	}
	if loadedDeployment.Name != deployment.Name {
		t.Errorf("Expected Name %s, got %s", deployment.Name, loadedDeployment.Name)
	}
	if loadedDeployment.Slug != deployment.Slug {
		t.Errorf("Expected Slug %s, got %s", deployment.Slug, loadedDeployment.Slug)
	}
}

func TestStore_SaveAndLoad_MultipleEntities(t *testing.T) {
	ctx, workspaceID, conn := setupTestWithWorkspace(t)
	store := createTestStore(t, conn)

	// Create multiple entities using OAPI types
	resource1 := &oapi.Resource{
		Id:          uuid.New().String(),
		Identifier:  uuid.New().String(),
		Name:        "resource-1",
		Kind:        "pod",
		WorkspaceId: workspaceID,
		Config:      map[string]interface{}{},
		Metadata:    map[string]string{},
		Version:     "v1",
		CreatedAt:   time.Now(),
	}
	resource2 := &oapi.Resource{
		Id:          uuid.New().String(),
		Identifier:  uuid.New().String(),
		Name:        "resource-2",
		Kind:        "service",
		WorkspaceId: workspaceID,
		Config:      map[string]interface{}{},
		Metadata:    map[string]string{},
		Version:     "v1",
		CreatedAt:   time.Now(),
	}
	deployment := &oapi.Deployment{
		Id:             uuid.New().String(),
		Name:           "deployment-1",
		Slug:           "deployment-1",
		JobAgentConfig: customJobAgentConfig(nil),
	}

	// Save all
	changes := persistence.Changes{
		makeChange(workspaceID, persistence.ChangeTypeSet, resource1),
		makeChange(workspaceID, persistence.ChangeTypeSet, resource2),
		makeChange(workspaceID, persistence.ChangeTypeSet, deployment),
	}
	err := store.Save(ctx, changes)
	if err != nil {
		t.Fatalf("Save failed: %v", err)
	}

	// Load all
	loadedChanges, err := store.Load(ctx, workspaceID)
	if err != nil {
		t.Fatalf("Load failed: %v", err)
	}

	if len(loadedChanges) != 3 {
		t.Fatalf("Expected 3 changes, got %d", len(loadedChanges))
	}

	// Verify we got the right types (order may vary)
	resourceCount := 0
	deploymentCount := 0
	for _, change := range loadedChanges {
		switch change.Entity.(type) {
		case *oapi.Resource:
			resourceCount++
		case *oapi.Deployment:
			deploymentCount++
		}
	}

	if resourceCount != 2 {
		t.Errorf("Expected 2 resources, got %d", resourceCount)
	}
	if deploymentCount != 1 {
		t.Errorf("Expected 1 deployment, got %d", deploymentCount)
	}
}

func TestStore_SaveAndLoad_UpdatedEntity(t *testing.T) {
	ctx, workspaceID, conn := setupTestWithWorkspace(t)
	store := createTestStore(t, conn)

	identifier := uuid.New().String()

	// Save initial version
	resource1 := &oapi.Resource{
		Id:          uuid.New().String(),
		Identifier:  identifier,
		Name:        "original-name",
		Kind:        "pod",
		WorkspaceId: workspaceID,
		Config:      map[string]interface{}{},
		Metadata:    map[string]string{},
		Version:     "v1",
		CreatedAt:   time.Now(),
	}
	changes1 := persistence.Changes{
		makeChange(workspaceID, persistence.ChangeTypeSet, resource1),
	}
	err := store.Save(ctx, changes1)
	if err != nil {
		t.Fatalf("First save failed: %v", err)
	}

	// Update the entity
	resource2 := &oapi.Resource{
		Id:          resource1.Id,
		Identifier:  identifier,
		Name:        "updated-name",
		Kind:        "deployment",
		WorkspaceId: workspaceID,
		Config:      map[string]interface{}{"updated": true},
		Metadata:    map[string]string{},
		Version:     "v2",
		CreatedAt:   time.Now(),
	}
	changes2 := persistence.Changes{
		makeChange(workspaceID, persistence.ChangeTypeSet, resource2),
	}
	err = store.Save(ctx, changes2)
	if err != nil {
		t.Fatalf("Second save failed: %v", err)
	}

	// Load - should get updated version
	loadedChanges, err := store.Load(ctx, workspaceID)
	if err != nil {
		t.Fatalf("Load failed: %v", err)
	}

	if len(loadedChanges) != 1 {
		t.Fatalf("Expected 1 change (updated, not duplicated), got %d", len(loadedChanges))
	}

	loadedResource, ok := loadedChanges[0].Entity.(*oapi.Resource)
	if !ok {
		t.Fatalf("Expected *oapi.Resource, got %T", loadedChanges[0].Entity)
	}

	// Verify we got the updated version
	if loadedResource.Name != "updated-name" {
		t.Errorf("Expected updated name 'updated-name', got %s", loadedResource.Name)
	}
	if loadedResource.Kind != "deployment" {
		t.Errorf("Expected updated kind 'deployment', got %s", loadedResource.Kind)
	}
}

func TestStore_SaveAndLoad_DeletedEntity(t *testing.T) {
	ctx, workspaceID, conn := setupTestWithWorkspace(t)
	store := createTestStore(t, conn)

	// Create and save entities using OAPI types
	resource1 := &oapi.Resource{
		Id:          uuid.New().String(),
		Identifier:  uuid.New().String(),
		Name:        "keep-me",
		Kind:        "pod",
		WorkspaceId: workspaceID,
		Config:      map[string]interface{}{},
		Metadata:    map[string]string{},
		Version:     "v1",
		CreatedAt:   time.Now(),
	}
	resource2 := &oapi.Resource{
		Id:          uuid.New().String(),
		Identifier:  uuid.New().String(),
		Name:        "delete-me",
		Kind:        "service",
		WorkspaceId: workspaceID,
		Config:      map[string]interface{}{},
		Metadata:    map[string]string{},
		Version:     "v1",
		CreatedAt:   time.Now(),
	}

	createChanges := persistence.Changes{
		makeChange(workspaceID, persistence.ChangeTypeSet, resource1),
		makeChange(workspaceID, persistence.ChangeTypeSet, resource2),
	}
	err := store.Save(ctx, createChanges)
	if err != nil {
		t.Fatalf("Save failed: %v", err)
	}

	// Delete one entity
	deleteChanges := persistence.Changes{
		makeChange(workspaceID, persistence.ChangeTypeUnset, resource2),
	}
	err = store.Save(ctx, deleteChanges)
	if err != nil {
		t.Fatalf("Delete failed: %v", err)
	}

	// Load - should only get the remaining entity
	loadedChanges, err := store.Load(ctx, workspaceID)
	if err != nil {
		t.Fatalf("Load failed: %v", err)
	}

	if len(loadedChanges) != 1 {
		t.Fatalf("Expected 1 change (after deletion), got %d", len(loadedChanges))
	}

	loadedResource, ok := loadedChanges[0].Entity.(*oapi.Resource)
	if !ok {
		t.Fatalf("Expected *oapi.Resource, got %T", loadedChanges[0].Entity)
	}

	// Verify we got the correct entity
	if loadedResource.Identifier != resource1.Identifier {
		t.Errorf("Expected resource1 Identifier %s, got %s", resource1.Identifier, loadedResource.Identifier)
	}
	if loadedResource.Name != "keep-me" {
		t.Errorf("Expected name 'keep-me', got %s", loadedResource.Name)
	}
}

func TestStore_Load_WorkspaceIsolation(t *testing.T) {
	ctx1, workspaceID1, conn1 := setupTestWithWorkspace(t)
	ctx2, workspaceID2, conn2 := setupTestWithWorkspace(t)

	store1 := createTestStore(t, conn1)
	store2 := createTestStore(t, conn2)

	// Save entities to both workspaces using OAPI types
	resource1 := &oapi.Resource{
		Id:          uuid.New().String(),
		Identifier:  uuid.New().String(),
		Name:        "workspace-1-resource",
		Kind:        "pod",
		WorkspaceId: workspaceID1,
		Config:      map[string]interface{}{},
		Metadata:    map[string]string{},
		Version:     "v1",
		CreatedAt:   time.Now(),
	}
	resource2 := &oapi.Resource{
		Id:          uuid.New().String(),
		Identifier:  uuid.New().String(),
		Name:        "workspace-2-resource",
		Kind:        "service",
		WorkspaceId: workspaceID2,
		Config:      map[string]interface{}{},
		Metadata:    map[string]string{},
		Version:     "v1",
		CreatedAt:   time.Now(),
	}

	changes1 := persistence.Changes{
		makeChange(workspaceID1, persistence.ChangeTypeSet, resource1),
	}
	err := store1.Save(ctx1, changes1)
	if err != nil {
		t.Fatalf("Save to workspace 1 failed: %v", err)
	}

	changes2 := persistence.Changes{
		makeChange(workspaceID2, persistence.ChangeTypeSet, resource2),
	}
	err = store2.Save(ctx2, changes2)
	if err != nil {
		t.Fatalf("Save to workspace 2 failed: %v", err)
	}

	// Load from workspace 1
	loaded1, err := store1.Load(ctx1, workspaceID1)
	if err != nil {
		t.Fatalf("Load from workspace 1 failed: %v", err)
	}

	if len(loaded1) != 1 {
		t.Fatalf("Expected 1 change in workspace 1, got %d", len(loaded1))
	}

	r1, ok := loaded1[0].Entity.(*oapi.Resource)
	if !ok {
		t.Fatalf("Expected *oapi.Resource, got %T", loaded1[0].Entity)
	}
	if r1.Name != "workspace-1-resource" {
		t.Errorf("Expected 'workspace-1-resource', got %s", r1.Name)
	}

	// Load from workspace 2
	loaded2, err := store2.Load(ctx2, workspaceID2)
	if err != nil {
		t.Fatalf("Load from workspace 2 failed: %v", err)
	}

	if len(loaded2) != 1 {
		t.Fatalf("Expected 1 change in workspace 2, got %d", len(loaded2))
	}

	r2, ok := loaded2[0].Entity.(*oapi.Resource)
	if !ok {
		t.Fatalf("Expected *oapi.Resource, got %T", loaded2[0].Entity)
	}
	if r2.Name != "workspace-2-resource" {
		t.Errorf("Expected 'workspace-2-resource', got %s", r2.Name)
	}
}

// Tests for all OAPI entity types

func TestStore_SaveAndLoad_OAPIResource(t *testing.T) {
	ctx, workspaceID, conn := setupTestWithWorkspace(t)
	store := createTestStore(t, conn)

	now := time.Now()
	resource := &oapi.Resource{
		Id:          uuid.New().String(),
		Identifier:  uuid.New().String(), // Must be UUID for database schema
		Name:        "test-resource",
		Kind:        "kubernetes/pod",
		WorkspaceId: workspaceID,
		Config:      map[string]interface{}{"key": "value"},
		Metadata:    map[string]string{"label": "test"},
		Version:     "v1",
		CreatedAt:   now,
	}

	// Save
	changes := persistence.Changes{
		makeChange(workspaceID, persistence.ChangeTypeSet, resource),
	}
	if err := store.Save(ctx, changes); err != nil {
		t.Fatalf("Save failed: %v", err)
	}

	// Load
	loaded, err := store.Load(ctx, workspaceID)
	if err != nil {
		t.Fatalf("Load failed: %v", err)
	}

	if len(loaded) != 1 {
		t.Fatalf("Expected 1 change, got %d", len(loaded))
	}

	loadedResource, ok := loaded[0].Entity.(*oapi.Resource)
	if !ok {
		t.Fatalf("Expected *oapi.Resource, got %T", loaded[0].Entity)
	}

	if loadedResource.Identifier != resource.Identifier {
		t.Errorf("Expected Identifier %s, got %s", resource.Identifier, loadedResource.Identifier)
	}
	if loadedResource.Name != resource.Name {
		t.Errorf("Expected Name %s, got %s", resource.Name, loadedResource.Name)
	}
	if loadedResource.Kind != resource.Kind {
		t.Errorf("Expected Kind %s, got %s", resource.Kind, loadedResource.Kind)
	}
}

func TestStore_SaveAndLoad_OAPIResourceProvider(t *testing.T) {
	ctx, workspaceID, conn := setupTestWithWorkspace(t)
	store := createTestStore(t, conn)

	workspaceUUID, _ := uuid.Parse(workspaceID)
	rp := &oapi.ResourceProvider{
		Id:          uuid.New().String(),
		Name:        "test-provider",
		WorkspaceId: openapi_types.UUID(workspaceUUID),
		Metadata:    map[string]string{"type": "kubernetes"},
		CreatedAt:   time.Now(),
	}

	changes := persistence.Changes{
		makeChange(workspaceID, persistence.ChangeTypeSet, rp),
	}
	if err := store.Save(ctx, changes); err != nil {
		t.Fatalf("Save failed: %v", err)
	}

	loaded, err := store.Load(ctx, workspaceID)
	if err != nil {
		t.Fatalf("Load failed: %v", err)
	}

	if len(loaded) != 1 {
		t.Fatalf("Expected 1 change, got %d", len(loaded))
	}

	loadedRp, ok := loaded[0].Entity.(*oapi.ResourceProvider)
	if !ok {
		t.Fatalf("Expected *oapi.ResourceProvider, got %T", loaded[0].Entity)
	}

	if loadedRp.Id != rp.Id {
		t.Errorf("Expected Id %s, got %s", rp.Id, loadedRp.Id)
	}
	if loadedRp.Name != rp.Name {
		t.Errorf("Expected Name %s, got %s", rp.Name, loadedRp.Name)
	}
}

func TestStore_SaveAndLoad_OAPIDeployment(t *testing.T) {
	ctx, workspaceID, conn := setupTestWithWorkspace(t)
	store := createTestStore(t, conn)

	deployment := &oapi.Deployment{
		Id:             uuid.New().String(),
		Name:           "test-deployment",
		Slug:           "test-deployment-slug",
		JobAgentConfig: customJobAgentConfig(map[string]interface{}{"config": "value"}),
	}

	changes := persistence.Changes{
		makeChange(workspaceID, persistence.ChangeTypeSet, deployment),
	}
	if err := store.Save(ctx, changes); err != nil {
		t.Fatalf("Save failed: %v", err)
	}

	loaded, err := store.Load(ctx, workspaceID)
	if err != nil {
		t.Fatalf("Load failed: %v", err)
	}

	if len(loaded) != 1 {
		t.Fatalf("Expected 1 change, got %d", len(loaded))
	}

	loadedDeployment, ok := loaded[0].Entity.(*oapi.Deployment)
	if !ok {
		t.Fatalf("Expected *oapi.Deployment, got %T", loaded[0].Entity)
	}

	if loadedDeployment.Id != deployment.Id {
		t.Errorf("Expected Id %s, got %s", deployment.Id, loadedDeployment.Id)
	}
	if loadedDeployment.Name != deployment.Name {
		t.Errorf("Expected Name %s, got %s", deployment.Name, loadedDeployment.Name)
	}
	if loadedDeployment.Slug != deployment.Slug {
		t.Errorf("Expected Slug %s, got %s", deployment.Slug, loadedDeployment.Slug)
	}
}

func TestStore_SaveAndLoad_OAPIEnvironment(t *testing.T) {
	ctx, workspaceID, conn := setupTestWithWorkspace(t)
	store := createTestStore(t, conn)

	environment := &oapi.Environment{
		Id:        uuid.New().String(),
		Name:      "production",
		CreatedAt: time.Now(),
	}

	changes := persistence.Changes{
		makeChange(workspaceID, persistence.ChangeTypeSet, environment),
	}
	if err := store.Save(ctx, changes); err != nil {
		t.Fatalf("Save failed: %v", err)
	}

	loaded, err := store.Load(ctx, workspaceID)
	if err != nil {
		t.Fatalf("Load failed: %v", err)
	}

	if len(loaded) != 1 {
		t.Fatalf("Expected 1 change, got %d", len(loaded))
	}

	loadedEnv, ok := loaded[0].Entity.(*oapi.Environment)
	if !ok {
		t.Fatalf("Expected *oapi.Environment, got %T", loaded[0].Entity)
	}

	if loadedEnv.Id != environment.Id {
		t.Errorf("Expected Id %s, got %s", environment.Id, loadedEnv.Id)
	}
	if loadedEnv.Name != environment.Name {
		t.Errorf("Expected Name %s, got %s", environment.Name, loadedEnv.Name)
	}
}

func TestStore_SaveAndLoad_OAPISystem(t *testing.T) {
	ctx, workspaceID, conn := setupTestWithWorkspace(t)
	store := createTestStore(t, conn)

	system := &oapi.System{
		Id:          uuid.New().String(),
		Name:        "test-system",
		WorkspaceId: workspaceID,
	}

	changes := persistence.Changes{
		makeChange(workspaceID, persistence.ChangeTypeSet, system),
	}
	if err := store.Save(ctx, changes); err != nil {
		t.Fatalf("Save failed: %v", err)
	}

	loaded, err := store.Load(ctx, workspaceID)
	if err != nil {
		t.Fatalf("Load failed: %v", err)
	}

	if len(loaded) != 1 {
		t.Fatalf("Expected 1 change, got %d", len(loaded))
	}

	loadedSystem, ok := loaded[0].Entity.(*oapi.System)
	if !ok {
		t.Fatalf("Expected *oapi.System, got %T", loaded[0].Entity)
	}

	if loadedSystem.Id != system.Id {
		t.Errorf("Expected Id %s, got %s", system.Id, loadedSystem.Id)
	}
	if loadedSystem.Name != system.Name {
		t.Errorf("Expected Name %s, got %s", system.Name, loadedSystem.Name)
	}
}

func TestStore_SaveAndLoad_OAPIJob(t *testing.T) {
	ctx, workspaceID, conn := setupTestWithWorkspace(t)
	store := createTestStore(t, conn)

	job := &oapi.Job{
		Id:             uuid.New().String(),
		ReleaseId:      uuid.New().String(),
		JobAgentId:     uuid.New().String(),
		Status:         oapi.JobStatusPending,
		JobAgentConfig: customFullJobAgentConfig(map[string]interface{}{"config": "value"}),
		Metadata:       map[string]string{"key": "value"},
		CreatedAt:      time.Now(),
		UpdatedAt:      time.Now(),
	}

	changes := persistence.Changes{
		makeChange(workspaceID, persistence.ChangeTypeSet, job),
	}
	if err := store.Save(ctx, changes); err != nil {
		t.Fatalf("Save failed: %v", err)
	}

	loaded, err := store.Load(ctx, workspaceID)
	if err != nil {
		t.Fatalf("Load failed: %v", err)
	}

	if len(loaded) != 1 {
		t.Fatalf("Expected 1 change, got %d", len(loaded))
	}

	loadedJob, ok := loaded[0].Entity.(*oapi.Job)
	if !ok {
		t.Fatalf("Expected *oapi.Job, got %T", loaded[0].Entity)
	}

	if loadedJob.Id != job.Id {
		t.Errorf("Expected Id %s, got %s", job.Id, loadedJob.Id)
	}
	if loadedJob.Status != job.Status {
		t.Errorf("Expected Status %s, got %s", job.Status, loadedJob.Status)
	}
}

func TestStore_SaveAndLoad_OAPIJobAgent(t *testing.T) {
	ctx, workspaceID, conn := setupTestWithWorkspace(t)
	store := createTestStore(t, conn)

	jobAgent := &oapi.JobAgent{
		Id:          uuid.New().String(),
		Name:        "test-agent",
		Type:        "custom",
		WorkspaceId: workspaceID,
		Config:      customJobAgentDefaults(map[string]interface{}{"cluster": "prod"}),
	}

	changes := persistence.Changes{
		makeChange(workspaceID, persistence.ChangeTypeSet, jobAgent),
	}
	if err := store.Save(ctx, changes); err != nil {
		t.Fatalf("Save failed: %v", err)
	}

	loaded, err := store.Load(ctx, workspaceID)
	if err != nil {
		t.Fatalf("Load failed: %v", err)
	}

	if len(loaded) != 1 {
		t.Fatalf("Expected 1 change, got %d", len(loaded))
	}

	loadedAgent, ok := loaded[0].Entity.(*oapi.JobAgent)
	if !ok {
		t.Fatalf("Expected *oapi.JobAgent, got %T", loaded[0].Entity)
	}

	if loadedAgent.Id != jobAgent.Id {
		t.Errorf("Expected Id %s, got %s", jobAgent.Id, loadedAgent.Id)
	}
	if loadedAgent.Name != jobAgent.Name {
		t.Errorf("Expected Name %s, got %s", jobAgent.Name, loadedAgent.Name)
	}
}

func TestStore_SaveAndLoad_OAPIGithubEntity(t *testing.T) {
	ctx, workspaceID, conn := setupTestWithWorkspace(t)
	store := createTestStore(t, conn)

	githubEntity := &oapi.GithubEntity{
		Slug:           "owner/repo",
		InstallationId: 12345,
	}

	changes := persistence.Changes{
		makeChange(workspaceID, persistence.ChangeTypeSet, githubEntity),
	}
	if err := store.Save(ctx, changes); err != nil {
		t.Fatalf("Save failed: %v", err)
	}

	loaded, err := store.Load(ctx, workspaceID)
	if err != nil {
		t.Fatalf("Load failed: %v", err)
	}

	if len(loaded) != 1 {
		t.Fatalf("Expected 1 change, got %d", len(loaded))
	}

	loadedEntity, ok := loaded[0].Entity.(*oapi.GithubEntity)
	if !ok {
		t.Fatalf("Expected *oapi.GithubEntity, got %T", loaded[0].Entity)
	}

	if loadedEntity.Slug != githubEntity.Slug {
		t.Errorf("Expected Slug %s, got %s", githubEntity.Slug, loadedEntity.Slug)
	}
	if loadedEntity.InstallationId != githubEntity.InstallationId {
		t.Errorf("Expected InstallationId %d, got %d", githubEntity.InstallationId, loadedEntity.InstallationId)
	}
}

func TestStore_SaveAndLoad_AllOAPIEntityTypes(t *testing.T) {
	ctx, workspaceID, conn := setupTestWithWorkspace(t)
	store := createTestStore(t, conn)

	workspaceUUID, _ := uuid.Parse(workspaceID)

	// Create one of each entity type
	resource := &oapi.Resource{
		Id:          uuid.New().String(),
		Identifier:  "resource-1",
		Name:        "Resource 1",
		Kind:        "pod",
		WorkspaceId: workspaceID,
		Config:      map[string]interface{}{},
		Metadata:    map[string]string{},
		Version:     "v1",
		CreatedAt:   time.Now(),
	}

	resourceProvider := &oapi.ResourceProvider{
		Id:          uuid.New().String(),
		Name:        "Provider 1",
		WorkspaceId: openapi_types.UUID(workspaceUUID),
		Metadata:    map[string]string{},
		CreatedAt:   time.Now(),
	}

	deployment := &oapi.Deployment{
		Id:             uuid.New().String(),
		Name:           "Deployment 1",
		Slug:           "deployment-1",
		JobAgentConfig: customJobAgentConfig(nil),
	}

	environment := &oapi.Environment{
		Id:        uuid.New().String(),
		Name:      "Environment 1",
		CreatedAt: time.Now(),
	}

	system := &oapi.System{
		Id:          uuid.New().String(),
		Name:        "System 1",
		WorkspaceId: workspaceID,
	}

	job := &oapi.Job{
		Id:             uuid.New().String(),
		ReleaseId:      uuid.New().String(),
		JobAgentId:     uuid.New().String(),
		Status:         oapi.JobStatusPending,
		JobAgentConfig: customFullJobAgentConfig(nil),
		Metadata:       map[string]string{},
		CreatedAt:      time.Now(),
		UpdatedAt:      time.Now(),
	}

	jobAgent := &oapi.JobAgent{
		Id:          uuid.New().String(),
		Name:        "Agent 1",
		Type:        "custom",
		WorkspaceId: workspaceID,
		Config:      customJobAgentDefaults(nil),
	}

	githubEntity := &oapi.GithubEntity{
		Slug:           "owner/repo",
		InstallationId: 12345,
	}

	// Save all
	changes := persistence.Changes{
		makeChange(workspaceID, persistence.ChangeTypeSet, resource),
		makeChange(workspaceID, persistence.ChangeTypeSet, resourceProvider),
		makeChange(workspaceID, persistence.ChangeTypeSet, deployment),
		makeChange(workspaceID, persistence.ChangeTypeSet, environment),
		makeChange(workspaceID, persistence.ChangeTypeSet, system),
		makeChange(workspaceID, persistence.ChangeTypeSet, job),
		makeChange(workspaceID, persistence.ChangeTypeSet, jobAgent),
		makeChange(workspaceID, persistence.ChangeTypeSet, githubEntity),
	}

	if err := store.Save(ctx, changes); err != nil {
		t.Fatalf("Save failed: %v", err)
	}

	// Load all
	loaded, err := store.Load(ctx, workspaceID)
	if err != nil {
		t.Fatalf("Load failed: %v", err)
	}

	if len(loaded) != 8 {
		t.Fatalf("Expected 8 changes, got %d", len(loaded))
	}

	// Count entity types
	entityCounts := make(map[string]int)
	for _, change := range loaded {
		switch change.Entity.(type) {
		case *oapi.Resource:
			entityCounts["resource"]++
		case *oapi.ResourceProvider:
			entityCounts["resource_provider"]++
		case *oapi.Deployment:
			entityCounts["deployment"]++
		case *oapi.Environment:
			entityCounts["environment"]++
		case *oapi.System:
			entityCounts["system"]++
		case *oapi.Job:
			entityCounts["job"]++
		case *oapi.JobAgent:
			entityCounts["job_agent"]++
		case *oapi.GithubEntity:
			entityCounts["github_entity"]++
		default:
			t.Errorf("Unexpected entity type: %T", change.Entity)
		}
	}

	expectedCounts := map[string]int{
		"resource":          1,
		"resource_provider": 1,
		"deployment":        1,
		"environment":       1,
		"system":            1,
		"job":               1,
		"job_agent":         1,
		"github_entity":     1,
	}

	for entityType, expected := range expectedCounts {
		if entityCounts[entityType] != expected {
			t.Errorf("Expected %d %s entities, got %d", expected, entityType, entityCounts[entityType])
		}
	}
}
