package db

import (
	"testing"
	"time"
	"workspace-engine/pkg/oapi"

	"github.com/google/uuid"
)

func validateRetrievedResourceProviders(t *testing.T, actualProviders []*oapi.ResourceProvider, expectedProviders []*oapi.ResourceProvider) {
	t.Helper()
	if len(actualProviders) != len(expectedProviders) {
		t.Fatalf("expected %d resource providers, got %d", len(expectedProviders), len(actualProviders))
	}

	for _, expectedProvider := range expectedProviders {
		var actualProvider *oapi.ResourceProvider
		for _, ap := range actualProviders {
			if ap.Id == expectedProvider.Id {
				actualProvider = ap
				break
			}
		}

		if actualProvider == nil {
			t.Fatalf("expected resource provider with id %v not found", expectedProvider.Id)
			return
		}

		if actualProvider.Name != expectedProvider.Name {
			t.Fatalf("expected name %v, got %v", expectedProvider.Name, actualProvider.Name)
		}

		if actualProvider.WorkspaceId != expectedProvider.WorkspaceId {
			t.Fatalf("expected workspace_id %v, got %v", expectedProvider.WorkspaceId, actualProvider.WorkspaceId)
		}

		if actualProvider.CreatedAt.IsZero() {
			t.Fatalf("expected created_at to be set")
		}
	}
}

func TestDBResourceProvider_EmptyResult(t *testing.T) {
	workspaceID, conn := setupTestWithWorkspace(t)
	defer conn.Release()

	providers, err := getResourceProviders(t.Context(), workspaceID)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	if len(providers) != 0 {
		t.Fatalf("expected 0 resource providers for new workspace, got %d", len(providers))
	}
}

func TestDBResourceProvider_SingleProvider(t *testing.T) {
	workspaceID, conn := setupTestWithWorkspace(t)
	defer conn.Release()

	providerID := uuid.New().String()
	providerName := "test-provider"

	_, err := conn.Exec(t.Context(),
		`INSERT INTO resource_provider (id, name, workspace_id, created_at) VALUES ($1, $2, $3, $4)`,
		providerID, providerName, workspaceID, time.Now())
	if err != nil {
		t.Fatalf("failed to create resource provider: %v", err)
	}

	providers, err := getResourceProviders(t.Context(), workspaceID)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	workspaceUUID, _ := uuid.Parse(workspaceID)
	expectedProviders := []*oapi.ResourceProvider{
		{
			Id:          providerID,
			Name:        providerName,
			WorkspaceId: workspaceUUID,
		},
	}

	validateRetrievedResourceProviders(t, providers, expectedProviders)
}

func TestDBResourceProvider_MultipleProviders(t *testing.T) {
	workspaceID, conn := setupTestWithWorkspace(t)
	defer conn.Release()

	provider1ID := uuid.New().String()
	provider1Name := "provider-1"

	_, err := conn.Exec(t.Context(),
		`INSERT INTO resource_provider (id, name, workspace_id, created_at) VALUES ($1, $2, $3, $4)`,
		provider1ID, provider1Name, workspaceID, time.Now())
	if err != nil {
		t.Fatalf("failed to create provider 1: %v", err)
	}

	provider2ID := uuid.New().String()
	provider2Name := "provider-2"

	_, err = conn.Exec(t.Context(),
		`INSERT INTO resource_provider (id, name, workspace_id, created_at) VALUES ($1, $2, $3, $4)`,
		provider2ID, provider2Name, workspaceID, time.Now())
	if err != nil {
		t.Fatalf("failed to create provider 2: %v", err)
	}

	providers, err := getResourceProviders(t.Context(), workspaceID)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	workspaceUUID, _ := uuid.Parse(workspaceID)
	expectedProviders := []*oapi.ResourceProvider{
		{
			Id:          provider1ID,
			Name:        provider1Name,
			WorkspaceId: workspaceUUID,
		},
		{
			Id:          provider2ID,
			Name:        provider2Name,
			WorkspaceId: workspaceUUID,
		},
	}

	validateRetrievedResourceProviders(t, providers, expectedProviders)
}

func TestDBResourceProvider_WorkspaceIsolation(t *testing.T) {
	workspaceID1, conn1 := setupTestWithWorkspace(t)
	defer conn1.Release()

	workspaceID2, conn2 := setupTestWithWorkspace(t)
	defer conn2.Release()

	// Create provider in workspace 1
	provider1ID := uuid.New().String()
	provider1Name := "workspace-1-provider"

	_, err := conn1.Exec(t.Context(),
		`INSERT INTO resource_provider (id, name, workspace_id, created_at) VALUES ($1, $2, $3, $4)`,
		provider1ID, provider1Name, workspaceID1, time.Now())
	if err != nil {
		t.Fatalf("failed to create provider in workspace1: %v", err)
	}

	// Create provider in workspace 2
	provider2ID := uuid.New().String()
	provider2Name := "workspace-2-provider"

	_, err = conn2.Exec(t.Context(),
		`INSERT INTO resource_provider (id, name, workspace_id, created_at) VALUES ($1, $2, $3, $4)`,
		provider2ID, provider2Name, workspaceID2, time.Now())
	if err != nil {
		t.Fatalf("failed to create provider in workspace2: %v", err)
	}

	// Verify workspace 1 only sees its provider
	providers1, err := getResourceProviders(t.Context(), workspaceID1)
	if err != nil {
		t.Fatalf("expected no errors for workspace1, got %v", err)
	}

	workspace1UUID, _ := uuid.Parse(workspaceID1)
	expectedProviders1 := []*oapi.ResourceProvider{
		{
			Id:          provider1ID,
			Name:        provider1Name,
			WorkspaceId: workspace1UUID,
		},
	}
	validateRetrievedResourceProviders(t, providers1, expectedProviders1)

	// Verify workspace 2 only sees its provider
	providers2, err := getResourceProviders(t.Context(), workspaceID2)
	if err != nil {
		t.Fatalf("expected no errors for workspace2, got %v", err)
	}

	workspace2UUID, _ := uuid.Parse(workspaceID2)
	expectedProviders2 := []*oapi.ResourceProvider{
		{
			Id:          provider2ID,
			Name:        provider2Name,
			WorkspaceId: workspace2UUID,
		},
	}
	validateRetrievedResourceProviders(t, providers2, expectedProviders2)
}

func TestDBResourceProvider_NonexistentWorkspace(t *testing.T) {
	_, conn := setupTestWithWorkspace(t)
	defer conn.Release()

	nonExistentWorkspaceID := uuid.New().String()

	providers, err := getResourceProviders(t.Context(), nonExistentWorkspaceID)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	if len(providers) != 0 {
		t.Fatalf("expected 0 resource providers for non-existent workspace, got %d", len(providers))
	}
}

func TestDBResourceProvider_BasicWrite(t *testing.T) {
	workspaceID, conn := setupTestWithWorkspace(t)
	defer conn.Release()

	tx, err := conn.Begin(t.Context())
	if err != nil {
		t.Fatalf("failed to begin tx: %v", err)
	}
	defer func() { _ = tx.Rollback(t.Context()) }()

	providerID := uuid.New().String()
	providerName := "write-test-provider"
	workspaceUUID, _ := uuid.Parse(workspaceID)
	createdAt := time.Now()

	provider := &oapi.ResourceProvider{
		Id:          providerID,
		Name:        providerName,
		WorkspaceId: workspaceUUID,
		CreatedAt:   createdAt,
	}

	err = writeResourceProvider(t.Context(), provider, tx)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	err = tx.Commit(t.Context())
	if err != nil {
		t.Fatalf("failed to commit: %v", err)
	}

	// Verify the provider was created
	providers, err := getResourceProviders(t.Context(), workspaceID)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	expectedProviders := []*oapi.ResourceProvider{provider}
	validateRetrievedResourceProviders(t, providers, expectedProviders)
}

func TestDBResourceProvider_WriteUpsert(t *testing.T) {
	workspaceID, conn := setupTestWithWorkspace(t)
	defer conn.Release()

	providerID1 := uuid.New().String()
	providerName := "upsert-test-provider"
	workspaceUUID, _ := uuid.Parse(workspaceID)
	createdAt1 := time.Now()

	// Write initial provider
	tx, err := conn.Begin(t.Context())
	if err != nil {
		t.Fatalf("failed to begin tx: %v", err)
	}
	defer func() { _ = tx.Rollback(t.Context()) }()

	provider := &oapi.ResourceProvider{
		Id:          providerID1,
		Name:        providerName,
		WorkspaceId: workspaceUUID,
		CreatedAt:   createdAt1,
	}

	err = writeResourceProvider(t.Context(), provider, tx)
	if err != nil {
		t.Fatalf("expected no errors on first write, got %v", err)
	}

	err = tx.Commit(t.Context())
	if err != nil {
		t.Fatalf("failed to commit: %v", err)
	}

	// Update with new ID (upsert based on workspace_id + name)
	providerID2 := uuid.New().String()
	createdAt2 := time.Now().Add(time.Hour)

	tx, err = conn.Begin(t.Context())
	if err != nil {
		t.Fatalf("failed to begin tx: %v", err)
	}
	defer func() { _ = tx.Rollback(t.Context()) }()

	provider.Id = providerID2
	provider.CreatedAt = createdAt2

	err = writeResourceProvider(t.Context(), provider, tx)
	if err != nil {
		t.Fatalf("expected no errors on upsert, got %v", err)
	}

	err = tx.Commit(t.Context())
	if err != nil {
		t.Fatalf("failed to commit: %v", err)
	}

	// Verify only one provider exists with updated ID
	providers, err := getResourceProviders(t.Context(), workspaceID)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	if len(providers) != 1 {
		t.Fatalf("expected 1 provider after upsert, got %d", len(providers))
	}

	if providers[0].Id != providerID2 {
		t.Fatalf("expected provider id to be %s after upsert, got %s", providerID2, providers[0].Id)
	}

	if providers[0].Name != providerName {
		t.Fatalf("expected provider name to remain %s, got %s", providerName, providers[0].Name)
	}
}

func TestDBResourceProvider_BasicDelete(t *testing.T) {
	workspaceID, conn := setupTestWithWorkspace(t)
	defer conn.Release()

	providerID := uuid.New().String()
	providerName := "delete-test-provider"

	_, err := conn.Exec(t.Context(),
		`INSERT INTO resource_provider (id, name, workspace_id, created_at) VALUES ($1, $2, $3, $4)`,
		providerID, providerName, workspaceID, time.Now())
	if err != nil {
		t.Fatalf("failed to create provider: %v", err)
	}

	// Verify provider exists
	providers, err := getResourceProviders(t.Context(), workspaceID)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}
	if len(providers) != 1 {
		t.Fatalf("expected 1 provider before delete, got %d", len(providers))
	}

	// Delete the provider
	tx, err := conn.Begin(t.Context())
	if err != nil {
		t.Fatalf("failed to begin tx: %v", err)
	}
	defer func() { _ = tx.Rollback(t.Context()) }()

	err = deleteResourceProvider(t.Context(), providerID, tx)
	if err != nil {
		t.Fatalf("expected no errors on delete, got %v", err)
	}

	err = tx.Commit(t.Context())
	if err != nil {
		t.Fatalf("failed to commit: %v", err)
	}

	// Verify provider is deleted
	providers, err = getResourceProviders(t.Context(), workspaceID)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}
	if len(providers) != 0 {
		t.Fatalf("expected 0 providers after delete, got %d", len(providers))
	}
}

func TestDBResourceProvider_DeleteNonexistent(t *testing.T) {
	_, conn := setupTestWithWorkspace(t)
	defer conn.Release()

	nonExistentProviderID := uuid.New().String()

	// Try to delete a provider that doesn't exist
	tx, err := conn.Begin(t.Context())
	if err != nil {
		t.Fatalf("failed to begin tx: %v", err)
	}
	defer func() { _ = tx.Rollback(t.Context()) }()

	// Should not error when deleting non-existent provider
	err = deleteResourceProvider(t.Context(), nonExistentProviderID, tx)
	if err != nil {
		t.Fatalf("expected no errors when deleting non-existent provider, got %v", err)
	}

	err = tx.Commit(t.Context())
	if err != nil {
		t.Fatalf("failed to commit: %v", err)
	}
}

func TestDBResourceProvider_DeleteOneOfMany(t *testing.T) {
	workspaceID, conn := setupTestWithWorkspace(t)
	defer conn.Release()

	provider1ID := uuid.New().String()
	provider1Name := "provider-1"

	_, err := conn.Exec(t.Context(),
		`INSERT INTO resource_provider (id, name, workspace_id, created_at) VALUES ($1, $2, $3, $4)`,
		provider1ID, provider1Name, workspaceID, time.Now())
	if err != nil {
		t.Fatalf("failed to create provider 1: %v", err)
	}

	provider2ID := uuid.New().String()
	provider2Name := "provider-2"

	_, err = conn.Exec(t.Context(),
		`INSERT INTO resource_provider (id, name, workspace_id, created_at) VALUES ($1, $2, $3, $4)`,
		provider2ID, provider2Name, workspaceID, time.Now())
	if err != nil {
		t.Fatalf("failed to create provider 2: %v", err)
	}

	// Verify both providers exist
	providers, err := getResourceProviders(t.Context(), workspaceID)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}
	if len(providers) != 2 {
		t.Fatalf("expected 2 providers before delete, got %d", len(providers))
	}

	// Delete only provider 1
	tx, err := conn.Begin(t.Context())
	if err != nil {
		t.Fatalf("failed to begin tx: %v", err)
	}
	defer func() { _ = tx.Rollback(t.Context()) }()

	err = deleteResourceProvider(t.Context(), provider1ID, tx)
	if err != nil {
		t.Fatalf("expected no errors on delete, got %v", err)
	}

	err = tx.Commit(t.Context())
	if err != nil {
		t.Fatalf("failed to commit: %v", err)
	}

	// Verify only provider 2 remains
	providers, err = getResourceProviders(t.Context(), workspaceID)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}
	if len(providers) != 1 {
		t.Fatalf("expected 1 provider after delete, got %d", len(providers))
	}

	if providers[0].Id != provider2ID {
		t.Fatalf("expected remaining provider to be provider2, got provider %s", providers[0].Id)
	}

	if providers[0].Name != provider2Name {
		t.Fatalf("expected remaining provider name to be %s, got %s", provider2Name, providers[0].Name)
	}
}

func TestDBResourceProvider_UniqueNamePerWorkspace(t *testing.T) {
	workspaceID, conn := setupTestWithWorkspace(t)
	defer conn.Release()

	providerName := "unique-name-provider"

	// Create first provider with this name
	provider1ID := uuid.New().String()
	_, err := conn.Exec(t.Context(),
		`INSERT INTO resource_provider (id, name, workspace_id, created_at) VALUES ($1, $2, $3, $4)`,
		provider1ID, providerName, workspaceID, time.Now())
	if err != nil {
		t.Fatalf("failed to create first provider: %v", err)
	}

	// Try to create second provider with same name in same workspace
	provider2ID := uuid.New().String()
	_, err = conn.Exec(t.Context(),
		`INSERT INTO resource_provider (id, name, workspace_id, created_at) VALUES ($1, $2, $3, $4)`,
		provider2ID, providerName, workspaceID, time.Now())

	// Should fail due to unique constraint
	if err == nil {
		t.Fatalf("expected error when creating duplicate provider name in same workspace, got none")
	}
}

func TestDBResourceProvider_SameNameDifferentWorkspace(t *testing.T) {
	workspaceID1, conn1 := setupTestWithWorkspace(t)
	defer conn1.Release()

	workspaceID2, conn2 := setupTestWithWorkspace(t)
	defer conn2.Release()

	providerName := "shared-name-provider"

	// Create provider with this name in workspace 1
	provider1ID := uuid.New().String()
	_, err := conn1.Exec(t.Context(),
		`INSERT INTO resource_provider (id, name, workspace_id, created_at) VALUES ($1, $2, $3, $4)`,
		provider1ID, providerName, workspaceID1, time.Now())
	if err != nil {
		t.Fatalf("failed to create provider in workspace1: %v", err)
	}

	// Create provider with same name in workspace 2 (should succeed)
	provider2ID := uuid.New().String()
	_, err = conn2.Exec(t.Context(),
		`INSERT INTO resource_provider (id, name, workspace_id, created_at) VALUES ($1, $2, $3, $4)`,
		provider2ID, providerName, workspaceID2, time.Now())
	if err != nil {
		t.Fatalf("failed to create provider in workspace2: %v", err)
	}

	// Verify both workspaces have a provider with this name
	providers1, err := getResourceProviders(t.Context(), workspaceID1)
	if err != nil {
		t.Fatalf("expected no errors for workspace1, got %v", err)
	}
	if len(providers1) != 1 {
		t.Fatalf("expected 1 provider in workspace1, got %d", len(providers1))
	}
	if providers1[0].Name != providerName {
		t.Fatalf("expected provider name %s in workspace1, got %s", providerName, providers1[0].Name)
	}

	providers2, err := getResourceProviders(t.Context(), workspaceID2)
	if err != nil {
		t.Fatalf("expected no errors for workspace2, got %v", err)
	}
	if len(providers2) != 1 {
		t.Fatalf("expected 1 provider in workspace2, got %d", len(providers2))
	}
	if providers2[0].Name != providerName {
		t.Fatalf("expected provider name %s in workspace2, got %s", providerName, providers2[0].Name)
	}
}
