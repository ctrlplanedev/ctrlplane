package db

import (
	"fmt"
	"strings"
	"testing"
	"time"
	"workspace-engine/pkg/oapi"

	"github.com/google/uuid"
)

func compareTimePtr(t *testing.T, actual *time.Time, expected *time.Time) {
	t.Helper()
	if actual == nil && expected == nil {
		return
	}
	if actual == nil || expected == nil {
		t.Fatalf("expected %v, got %v", expected, actual)
	}
	// Compare with some tolerance for database timestamp precision
	if actual.Unix() != expected.Unix() {
		t.Fatalf("expected %v, got %v", expected, actual)
	}
}

func validateRetrievedResources(t *testing.T, actualResources []*oapi.Resource, expectedResources []*oapi.Resource) {
	t.Helper()
	if len(actualResources) != len(expectedResources) {
		t.Fatalf("expected %d resources, got %d", len(expectedResources), len(actualResources))
	}
	for _, expectedResource := range expectedResources {
		var actualResource *oapi.Resource
		for _, ar := range actualResources {
			if ar.Id == expectedResource.Id {
				actualResource = ar
				break
			}
		}

		if actualResource == nil {
			t.Fatalf("expected resource with id %s not found", expectedResource.Id)
		}
		if actualResource.Id != expectedResource.Id {
			t.Fatalf("expected resource id %s, got %s", expectedResource.Id, actualResource.Id)
		}
		if actualResource.Version != expectedResource.Version {
			t.Fatalf("expected resource version %s, got %s", expectedResource.Version, actualResource.Version)
		}
		if actualResource.Name != expectedResource.Name {
			t.Fatalf("expected resource name %s, got %s", expectedResource.Name, actualResource.Name)
		}
		if actualResource.Kind != expectedResource.Kind {
			t.Fatalf("expected resource kind %s, got %s", expectedResource.Kind, actualResource.Kind)
		}
		if actualResource.Identifier != expectedResource.Identifier {
			t.Fatalf("expected resource identifier %s, got %s", expectedResource.Identifier, actualResource.Identifier)
		}
		compareStrPtr(t, actualResource.ProviderId, expectedResource.ProviderId)
		if actualResource.WorkspaceId != expectedResource.WorkspaceId {
			t.Fatalf("expected resource workspace_id %s, got %s", expectedResource.WorkspaceId, actualResource.WorkspaceId)
		}

		// Validate metadata
		if len(actualResource.Metadata) != len(expectedResource.Metadata) {
			t.Fatalf("expected %d metadata entries, got %d", len(expectedResource.Metadata), len(actualResource.Metadata))
		}
		for key, expectedValue := range expectedResource.Metadata {
			actualValue, ok := actualResource.Metadata[key]
			if !ok {
				t.Fatalf("expected metadata key %s not found", key)
			}
			if actualValue != expectedValue {
				t.Fatalf("expected metadata[%s] = %s, got %s", key, expectedValue, actualValue)
			}
		}

		// Validate config
		if len(actualResource.Config) != len(expectedResource.Config) {
			t.Fatalf("expected %d config entries, got %d", len(expectedResource.Config), len(actualResource.Config))
		}
		for key, expectedValue := range expectedResource.Config {
			actualValue, ok := actualResource.Config[key]
			if !ok {
				t.Fatalf("expected config key %s not found", key)
			}
			if fmt.Sprintf("%v", actualValue) != fmt.Sprintf("%v", expectedValue) {
				t.Fatalf("expected config[%s] = %v, got %v", key, expectedValue, actualValue)
			}
		}

		// Validate timestamps (basic presence check)
		if actualResource.CreatedAt.IsZero() {
			t.Fatalf("expected resource created_at to be set")
		}
		compareTimePtr(t, actualResource.LockedAt, expectedResource.LockedAt)
		// Note: updated_at can be set by DB on update, so we just check if expected is set
		if expectedResource.UpdatedAt != nil && actualResource.UpdatedAt == nil {
			t.Fatalf("expected resource updated_at to be set")
		}
		compareTimePtr(t, actualResource.DeletedAt, expectedResource.DeletedAt)
	}
}

func TestDBResources_BasicWrite(t *testing.T) {
	workspaceID, conn := setupTestWithWorkspace(t)
	// Note: conn.Release() is handled by t.Cleanup in setupTestWithWorkspace

	tx, err := conn.Begin(t.Context())
	if err != nil {
		t.Fatalf("failed to begin tx: %v", err)
	}
	defer tx.Rollback(t.Context())

	id := uuid.New().String()
	name := fmt.Sprintf("test-resource-%s", id[:8])
	createdAt := time.Now()
	resource := &oapi.Resource{
		Id:          id,
		Version:     "v1",
		Name:        name,
		Kind:        "test-kind",
		Identifier:  "test-identifier",
		WorkspaceId: workspaceID,
		Config: map[string]interface{}{
			"key1": "value1",
			"key2": 42.0,
		},
		Metadata: map[string]string{
			"env":  "test",
			"team": "platform",
		},
		CreatedAt: createdAt,
	}

	err = writeResource(t.Context(), resource, tx)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	err = tx.Commit(t.Context())
	if err != nil {
		t.Fatalf("failed to commit: %v", err)
	}

	expectedResources := []*oapi.Resource{resource}
	actualResources, err := getResources(t.Context(), workspaceID)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	validateRetrievedResources(t, actualResources, expectedResources)
}

func TestDBResources_BasicWriteAndDelete(t *testing.T) {
	workspaceID, conn := setupTestWithWorkspace(t)
	// Note: conn.Release() is handled by t.Cleanup in setupTestWithWorkspace

	tx, err := conn.Begin(t.Context())
	if err != nil {
		t.Fatalf("failed to begin tx: %v", err)
	}
	defer tx.Rollback(t.Context())

	id := uuid.New().String()
	name := fmt.Sprintf("test-resource-%s", id[:8])
	createdAt := time.Now()
	resource := &oapi.Resource{
		Id:          id,
		Version:     "v1",
		Name:        name,
		Kind:        "test-kind",
		Identifier:  "test-identifier",
		WorkspaceId: workspaceID,
		Config: map[string]interface{}{
			"key1": "value1",
		},
		Metadata: map[string]string{
			"env": "test",
		},
		CreatedAt: createdAt,
	}

	err = writeResource(t.Context(), resource, tx)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	err = tx.Commit(t.Context())
	if err != nil {
		t.Fatalf("failed to commit: %v", err)
	}

	tx, err = conn.Begin(t.Context())
	if err != nil {
		t.Fatalf("failed to begin tx: %v", err)
	}
	defer tx.Rollback(t.Context())

	expectedResources := []*oapi.Resource{resource}
	actualResources, err := getResources(t.Context(), workspaceID)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	validateRetrievedResources(t, actualResources, expectedResources)

	err = deleteResource(t.Context(), id, tx)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	err = tx.Commit(t.Context())
	if err != nil {
		t.Fatalf("failed to commit: %v", err)
	}

	actualResources, err = getResources(t.Context(), workspaceID)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	validateRetrievedResources(t, actualResources, []*oapi.Resource{})
}

func TestDBResources_BasicWriteAndUpdate(t *testing.T) {
	workspaceID, conn := setupTestWithWorkspace(t)
	// Note: conn.Release() is handled by t.Cleanup in setupTestWithWorkspace

	tx, err := conn.Begin(t.Context())
	if err != nil {
		t.Fatalf("failed to begin tx: %v", err)
	}
	defer tx.Rollback(t.Context())

	id := uuid.New().String()
	name := fmt.Sprintf("test-resource-%s", id[:8])
	createdAt := time.Now()
	resource := &oapi.Resource{
		Id:          id,
		Version:     "v1",
		Name:        name,
		Kind:        "test-kind",
		Identifier:  "test-identifier",
		WorkspaceId: workspaceID,
		Config: map[string]interface{}{
			"key1": "value1",
		},
		Metadata: map[string]string{
			"env": "test",
		},
		CreatedAt: createdAt,
	}

	err = writeResource(t.Context(), resource, tx)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	err = tx.Commit(t.Context())
	if err != nil {
		t.Fatalf("failed to commit: %v", err)
	}

	tx, err = conn.Begin(t.Context())
	if err != nil {
		t.Fatalf("failed to begin tx: %v", err)
	}
	defer tx.Rollback(t.Context())

	// Update the resource
	resource.Version = "v2"
	resource.Name = name + "-updated"
	resource.Config = map[string]interface{}{
		"key1": "value1-updated",
		"key2": true,
	}
	resource.Metadata = map[string]string{
		"env":    "production",
		"region": "us-west-2",
	}

	err = writeResource(t.Context(), resource, tx)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	err = tx.Commit(t.Context())
	if err != nil {
		t.Fatalf("failed to commit: %v", err)
	}

	actualResources, err := getResources(t.Context(), workspaceID)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	validateRetrievedResources(t, actualResources, []*oapi.Resource{resource})
}

func TestDBResources_MetadataUpdate(t *testing.T) {
	workspaceID, conn := setupTestWithWorkspace(t)
	// Note: conn.Release() is handled by t.Cleanup in setupTestWithWorkspace

	tx, err := conn.Begin(t.Context())
	if err != nil {
		t.Fatalf("failed to begin tx: %v", err)
	}
	defer tx.Rollback(t.Context())

	id := uuid.New().String()
	name := fmt.Sprintf("test-resource-%s", id[:8])
	createdAt := time.Now()
	resource := &oapi.Resource{
		Id:          id,
		Version:     "v1",
		Name:        name,
		Kind:        "test-kind",
		Identifier:  "test-identifier",
		WorkspaceId: workspaceID,
		Config:      map[string]interface{}{},
		Metadata: map[string]string{
			"key1": "value1",
			"key2": "value2",
			"key3": "value3",
		},
		CreatedAt: createdAt,
	}

	err = writeResource(t.Context(), resource, tx)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	err = tx.Commit(t.Context())
	if err != nil {
		t.Fatalf("failed to commit: %v", err)
	}

	// Update metadata - remove key2, update key1, add key4
	tx, err = conn.Begin(t.Context())
	if err != nil {
		t.Fatalf("failed to begin tx: %v", err)
	}
	defer tx.Rollback(t.Context())

	resource.Metadata = map[string]string{
		"key1": "value1-updated",
		"key3": "value3",
		"key4": "value4",
	}

	err = writeResource(t.Context(), resource, tx)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	err = tx.Commit(t.Context())
	if err != nil {
		t.Fatalf("failed to commit: %v", err)
	}

	actualResources, err := getResources(t.Context(), workspaceID)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	validateRetrievedResources(t, actualResources, []*oapi.Resource{resource})
}

func TestDBResources_EmptyMetadata(t *testing.T) {
	workspaceID, conn := setupTestWithWorkspace(t)
	// Note: conn.Release() is handled by t.Cleanup in setupTestWithWorkspace

	tx, err := conn.Begin(t.Context())
	if err != nil {
		t.Fatalf("failed to begin tx: %v", err)
	}
	defer tx.Rollback(t.Context())

	id := uuid.New().String()
	name := fmt.Sprintf("test-resource-%s", id[:8])
	createdAt := time.Now()
	resource := &oapi.Resource{
		Id:          id,
		Version:     "v1",
		Name:        name,
		Kind:        "test-kind",
		Identifier:  "test-identifier",
		WorkspaceId: workspaceID,
		Config:      map[string]interface{}{},
		Metadata:    map[string]string{},
		CreatedAt:   createdAt,
	}

	err = writeResource(t.Context(), resource, tx)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	err = tx.Commit(t.Context())
	if err != nil {
		t.Fatalf("failed to commit: %v", err)
	}

	actualResources, err := getResources(t.Context(), workspaceID)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	validateRetrievedResources(t, actualResources, []*oapi.Resource{resource})
}

func TestDBResources_WithTimestamps(t *testing.T) {
	workspaceID, conn := setupTestWithWorkspace(t)
	// Note: conn.Release() is handled by t.Cleanup in setupTestWithWorkspace

	tx, err := conn.Begin(t.Context())
	if err != nil {
		t.Fatalf("failed to begin tx: %v", err)
	}
	defer tx.Rollback(t.Context())

	id := uuid.New().String()
	name := fmt.Sprintf("test-resource-%s", id[:8])
	createdAt := time.Now().Add(-24 * time.Hour)
	lockedAt := time.Now().Add(-1 * time.Hour)
	updatedAt := time.Now()
	resource := &oapi.Resource{
		Id:          id,
		Version:     "v1",
		Name:        name,
		Kind:        "test-kind",
		Identifier:  "test-identifier",
		WorkspaceId: workspaceID,
		Config:      map[string]interface{}{},
		Metadata:    map[string]string{},
		CreatedAt:   createdAt,
		LockedAt:    &lockedAt,
		UpdatedAt:   &updatedAt,
	}

	err = writeResource(t.Context(), resource, tx)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	err = tx.Commit(t.Context())
	if err != nil {
		t.Fatalf("failed to commit: %v", err)
	}

	actualResources, err := getResources(t.Context(), workspaceID)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	validateRetrievedResources(t, actualResources, []*oapi.Resource{resource})
}

func TestDBResources_ComplexConfig(t *testing.T) {
	workspaceID, conn := setupTestWithWorkspace(t)
	// Note: conn.Release() is handled by t.Cleanup in setupTestWithWorkspace

	tx, err := conn.Begin(t.Context())
	if err != nil {
		t.Fatalf("failed to begin tx: %v", err)
	}
	defer tx.Rollback(t.Context())

	id := uuid.New().String()
	name := fmt.Sprintf("test-resource-%s", id[:8])
	createdAt := time.Now()
	resource := &oapi.Resource{
		Id:          id,
		Version:     "v1",
		Name:        name,
		Kind:        "test-kind",
		Identifier:  "test-identifier",
		WorkspaceId: workspaceID,
		Config: map[string]interface{}{
			"string": "value",
			"number": 42.0,
			"bool":   true,
			"nested": map[string]interface{}{
				"key": "value",
			},
			"array": []interface{}{"item1", "item2"},
		},
		Metadata:  map[string]string{},
		CreatedAt: createdAt,
	}

	err = writeResource(t.Context(), resource, tx)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	err = tx.Commit(t.Context())
	if err != nil {
		t.Fatalf("failed to commit: %v", err)
	}

	actualResources, err := getResources(t.Context(), workspaceID)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	validateRetrievedResources(t, actualResources, []*oapi.Resource{resource})
}

func TestDBResources_NonexistentWorkspaceThrowsError(t *testing.T) {
	_, conn := setupTestWithWorkspace(t)
	// Note: conn.Release() is handled by t.Cleanup in setupTestWithWorkspace

	tx, err := conn.Begin(t.Context())
	if err != nil {
		t.Fatalf("failed to begin tx: %v", err)
	}
	defer tx.Rollback(t.Context())

	createdAt := time.Now()
	resource := &oapi.Resource{
		Id:          uuid.New().String(),
		Version:     "v1",
		Name:        "test-resource",
		Kind:        "test-kind",
		Identifier:  "test-identifier",
		WorkspaceId: uuid.New().String(), // Non-existent workspace
		Config:      map[string]interface{}{},
		Metadata:    map[string]string{},
		CreatedAt:   createdAt,
	}

	err = writeResource(t.Context(), resource, tx)
	// should throw fk constraint error
	if err == nil {
		t.Fatalf("expected FK violation error, got nil")
	}

	// Check for foreign key violation (SQLSTATE 23503)
	if !strings.Contains(err.Error(), "23503") && !strings.Contains(err.Error(), "foreign key") {
		t.Fatalf("expected FK violation error, got: %v", err)
	}
}

func TestDBResources_MultipleResources(t *testing.T) {
	workspaceID, conn := setupTestWithWorkspace(t)
	// Note: conn.Release() is handled by t.Cleanup in setupTestWithWorkspace

	tx, err := conn.Begin(t.Context())
	if err != nil {
		t.Fatalf("failed to begin tx: %v", err)
	}
	defer tx.Rollback(t.Context())

	createdAt := time.Now()
	resources := []*oapi.Resource{
		{
			Id:          uuid.New().String(),
			Version:     "v1",
			Name:        "resource-1",
			Kind:        "kind-1",
			Identifier:  "identifier-1",
			WorkspaceId: workspaceID,
			Config:      map[string]interface{}{"key": "value1"},
			Metadata:    map[string]string{"env": "prod"},
			CreatedAt:   createdAt,
		},
		{
			Id:          uuid.New().String(),
			Version:     "v2",
			Name:        "resource-2",
			Kind:        "kind-2",
			Identifier:  "identifier-2",
			WorkspaceId: workspaceID,
			Config:      map[string]interface{}{"key": "value2"},
			Metadata:    map[string]string{"env": "dev"},
			CreatedAt:   createdAt,
		},
		{
			Id:          uuid.New().String(),
			Version:     "v1",
			Name:        "resource-3",
			Kind:        "kind-3",
			Identifier:  "identifier-3",
			WorkspaceId: workspaceID,
			Config:      map[string]interface{}{"key": "value3"},
			Metadata:    map[string]string{"env": "staging"},
			CreatedAt:   createdAt,
		},
	}

	for _, resource := range resources {
		err = writeResource(t.Context(), resource, tx)
		if err != nil {
			t.Fatalf("expected no errors, got %v", err)
		}
	}

	err = tx.Commit(t.Context())
	if err != nil {
		t.Fatalf("failed to commit: %v", err)
	}

	actualResources, err := getResources(t.Context(), workspaceID)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	validateRetrievedResources(t, actualResources, resources)
}

func TestDBResources_WorkspaceIsolation(t *testing.T) {
	// Create two separate workspaces
	workspaceID1, conn1 := setupTestWithWorkspace(t)
	workspaceID2, conn2 := setupTestWithWorkspace(t)
	// Note: conn.Release() is handled by t.Cleanup in setupTestWithWorkspace

	// Write a resource to workspace 1
	tx1, err := conn1.Begin(t.Context())
	if err != nil {
		t.Fatalf("failed to begin tx: %v", err)
	}
	defer tx1.Rollback(t.Context())

	createdAt := time.Now()
	resource1 := &oapi.Resource{
		Id:          uuid.New().String(),
		Version:     "v1",
		Name:        "workspace1-resource",
		Kind:        "test-kind",
		Identifier:  "identifier-1",
		WorkspaceId: workspaceID1,
		Config:      map[string]interface{}{"workspace": "1"},
		Metadata:    map[string]string{"workspace": "1"},
		CreatedAt:   createdAt,
	}

	err = writeResource(t.Context(), resource1, tx1)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	err = tx1.Commit(t.Context())
	if err != nil {
		t.Fatalf("failed to commit: %v", err)
	}

	// Write a different resource to workspace 2
	tx2, err := conn2.Begin(t.Context())
	if err != nil {
		t.Fatalf("failed to begin tx: %v", err)
	}
	defer tx2.Rollback(t.Context())

	resource2 := &oapi.Resource{
		Id:          uuid.New().String(),
		Version:     "v1",
		Name:        "workspace2-resource",
		Kind:        "test-kind",
		Identifier:  "identifier-2",
		WorkspaceId: workspaceID2,
		Config:      map[string]interface{}{"workspace": "2"},
		Metadata:    map[string]string{"workspace": "2"},
		CreatedAt:   createdAt,
	}

	err = writeResource(t.Context(), resource2, tx2)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	err = tx2.Commit(t.Context())
	if err != nil {
		t.Fatalf("failed to commit: %v", err)
	}

	// Verify workspace 1 only sees its own resource
	resources1, err := getResources(t.Context(), workspaceID1)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}
	if len(resources1) != 1 {
		t.Fatalf("expected 1 resource in workspace 1, got %d", len(resources1))
	}
	if resources1[0].Id != resource1.Id {
		t.Fatalf("expected resource %s in workspace 1, got %s", resource1.Id, resources1[0].Id)
	}

	// Verify workspace 2 only sees its own resource
	resources2, err := getResources(t.Context(), workspaceID2)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}
	if len(resources2) != 1 {
		t.Fatalf("expected 1 resource in workspace 2, got %d", len(resources2))
	}
	if resources2[0].Id != resource2.Id {
		t.Fatalf("expected resource %s in workspace 2, got %s", resource2.Id, resources2[0].Id)
	}
}

func TestDBResources_SoftDeleteFiltering(t *testing.T) {
	workspaceID, conn := setupTestWithWorkspace(t)
	// Note: conn.Release() is handled by t.Cleanup in setupTestWithWorkspace

	tx, err := conn.Begin(t.Context())
	if err != nil {
		t.Fatalf("failed to begin tx: %v", err)
	}
	defer tx.Rollback(t.Context())

	createdAt := time.Now()
	deletedAt := time.Now()

	// Create a resource with deleted_at set (soft deleted)
	softDeletedResource := &oapi.Resource{
		Id:          uuid.New().String(),
		Version:     "v1",
		Name:        "soft-deleted-resource",
		Kind:        "test-kind",
		Identifier:  "identifier-1",
		WorkspaceId: workspaceID,
		Config:      map[string]interface{}{},
		Metadata:    map[string]string{},
		CreatedAt:   createdAt,
		DeletedAt:   &deletedAt,
	}

	err = writeResource(t.Context(), softDeletedResource, tx)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	// Create a normal resource (not deleted)
	activeResource := &oapi.Resource{
		Id:          uuid.New().String(),
		Version:     "v1",
		Name:        "active-resource",
		Kind:        "test-kind",
		Identifier:  "identifier-2",
		WorkspaceId: workspaceID,
		Config:      map[string]interface{}{},
		Metadata:    map[string]string{},
		CreatedAt:   createdAt,
	}

	err = writeResource(t.Context(), activeResource, tx)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	err = tx.Commit(t.Context())
	if err != nil {
		t.Fatalf("failed to commit: %v", err)
	}

	// Verify only the active resource is returned (soft deleted should be filtered out)
	actualResources, err := getResources(t.Context(), workspaceID)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	if len(actualResources) != 1 {
		t.Fatalf("expected 1 resource (soft deleted should be filtered), got %d", len(actualResources))
	}

	if actualResources[0].Id != activeResource.Id {
		t.Fatalf("expected active resource %s, got %s", activeResource.Id, actualResources[0].Id)
	}

	// Verify the soft deleted resource is not in the results
	for _, r := range actualResources {
		if r.Id == softDeletedResource.Id {
			t.Fatalf("soft deleted resource %s should not be returned", softDeletedResource.Id)
		}
	}
}
