package db

import (
	"fmt"
	"reflect"
	"strings"
	"testing"
	"workspace-engine/pkg/oapi"

	"github.com/google/uuid"
)

func validateRetrievedSystems(t *testing.T, actualSystems []*oapi.System, expectedSystems []*oapi.System) {
	if len(actualSystems) != len(expectedSystems) {
		t.Fatalf("expected %d systems, got %d", len(expectedSystems), len(actualSystems))
	}
	for _, expectedSystem := range expectedSystems {
		var actualSystem *oapi.System
		for _, as := range actualSystems {
			if as.Id == expectedSystem.Id {
				actualSystem = as
				break
			}
		}

		if actualSystem == nil {
			t.Fatalf("expected system %v, got %v", expectedSystem, actualSystem)
		}
		if actualSystem.Id != expectedSystem.Id {
			t.Fatalf("expected system %v, got %v", expectedSystem, actualSystem)
		}
		if actualSystem.Name != expectedSystem.Name {
			t.Fatalf("expected system %v, got %v", expectedSystem, actualSystem)
		}
		compareStrPtr(t, actualSystem.Description, expectedSystem.Description)
		if actualSystem.WorkspaceId != expectedSystem.WorkspaceId {
			t.Fatalf("expected system %v, got %v", expectedSystem, actualSystem)
		}
		expectedMetadata := expectedSystem.Metadata
		if expectedMetadata == nil {
			expectedMetadata = map[string]string{}
		}
		actualMetadata := actualSystem.Metadata
		if actualMetadata == nil {
			actualMetadata = map[string]string{}
		}
		if !reflect.DeepEqual(expectedMetadata, actualMetadata) {
			t.Fatalf("expected system metadata %v, got %v", expectedMetadata, actualMetadata)
		}
	}
}

func TestDBSystems_BasicWrite(t *testing.T) {
	workspaceID, conn := setupTestWithWorkspace(t)
	// Note: conn.Release() is handled by t.Cleanup in setupTestWithWorkspace

	tx, err := conn.Begin(t.Context())
	if err != nil {
		t.Fatalf("failed to begin tx: %v", err)
	}
	defer func() { _ = tx.Rollback(t.Context()) }()

	id := uuid.New().String()
	name := fmt.Sprintf("test-system-%s", id[:8])
	description := fmt.Sprintf("test-description-%s", id[:8])
	sys := &oapi.System{
		Id:          id,
		WorkspaceId: workspaceID,
		Name:        name,
		Description: &description,
		Metadata:    map[string]string{"owner": "platform"},
	}

	err = writeSystem(t.Context(), sys, tx)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	err = tx.Commit(t.Context())
	if err != nil {
		t.Fatalf("failed to commit: %v", err)
	}

	expectedSystems := []*oapi.System{sys}
	actualSystems, err := getSystems(t.Context(), workspaceID)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	validateRetrievedSystems(t, actualSystems, expectedSystems)
}

func TestDBSystems_BasicWriteAndDelete(t *testing.T) {
	workspaceID, conn := setupTestWithWorkspace(t)
	// Note: conn.Release() is handled by t.Cleanup in setupTestWithWorkspace

	tx, err := conn.Begin(t.Context())
	if err != nil {
		t.Fatalf("failed to begin tx: %v", err)
	}
	defer func() { _ = tx.Rollback(t.Context()) }()

	id := uuid.New().String()
	name := fmt.Sprintf("test-system-%s", id[:8])
	description := fmt.Sprintf("test-description-%s", id[:8])
	sys := &oapi.System{
		Id:          id,
		WorkspaceId: workspaceID,
		Name:        name,
		Description: &description,
	}

	err = writeSystem(t.Context(), sys, tx)
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
	defer func() { _ = tx.Rollback(t.Context()) }()

	expectedSystems := []*oapi.System{sys}
	actualSystems, err := getSystems(t.Context(), workspaceID)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	validateRetrievedSystems(t, actualSystems, expectedSystems)

	err = deleteSystem(t.Context(), id, tx)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	err = tx.Commit(t.Context())
	if err != nil {
		t.Fatalf("failed to commit: %v", err)
	}

	actualSystems, err = getSystems(t.Context(), workspaceID)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	validateRetrievedSystems(t, actualSystems, []*oapi.System{})
}

func TestDBSystems_BasicWriteAndUpdate(t *testing.T) {
	workspaceID, conn := setupTestWithWorkspace(t)
	// Note: conn.Release() is handled by t.Cleanup in setupTestWithWorkspace

	tx, err := conn.Begin(t.Context())
	if err != nil {
		t.Fatalf("failed to begin tx: %v", err)
	}
	defer func() { _ = tx.Rollback(t.Context()) }()

	id := uuid.New().String()
	name := fmt.Sprintf("test-system-%s", id[:8])
	description := fmt.Sprintf("test-description-%s", id[:8])
	sys := &oapi.System{
		Id:          id,
		WorkspaceId: workspaceID,
		Name:        name,
		Description: &description,
	}

	err = writeSystem(t.Context(), sys, tx)
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
	defer func() { _ = tx.Rollback(t.Context()) }()

	sys.Description = &description
	err = writeSystem(t.Context(), sys, tx)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	err = tx.Commit(t.Context())
	if err != nil {
		t.Fatalf("failed to commit: %v", err)
	}

	actualSystems, err := getSystems(t.Context(), workspaceID)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	validateRetrievedSystems(t, actualSystems, []*oapi.System{sys})
}

func TestDBSystems_NonexistentWorkspaceThrowsError(t *testing.T) {
	_, conn := setupTestWithWorkspace(t)
	// Note: conn.Release() is handled by t.Cleanup in setupTestWithWorkspace

	tx, err := conn.Begin(t.Context())
	if err != nil {
		t.Fatalf("failed to begin tx: %v", err)
	}
	defer func() { _ = tx.Rollback(t.Context()) }()

	description := "test-description"
	sys := &oapi.System{
		Id:          uuid.New().String(),
		WorkspaceId: uuid.New().String(),
		Name:        "test-system",
		Description: &description,
	}

	err = writeSystem(t.Context(), sys, tx)
	// should throw fk constraint error
	if err == nil {
		t.Fatalf("expected FK violation error, got nil")
	}

	// Check for foreign key violation (SQLSTATE 23503)
	if !strings.Contains(err.Error(), "23503") && !strings.Contains(err.Error(), "foreign key") {
		t.Fatalf("expected FK violation error, got: %v", err)
	}

}
