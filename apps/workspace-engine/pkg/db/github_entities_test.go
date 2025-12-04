package db

import (
	"testing"
	"workspace-engine/pkg/oapi"

	"github.com/google/uuid"
)

func validateRetrievedGithubEntities(t *testing.T, actualEntities []*oapi.GithubEntity, expectedEntities []*oapi.GithubEntity) {
	t.Helper()
	if len(actualEntities) != len(expectedEntities) {
		t.Fatalf("expected %d github entities, got %d", len(expectedEntities), len(actualEntities))
	}

	for _, expectedEntity := range expectedEntities {
		var actualEntity *oapi.GithubEntity
		for _, ae := range actualEntities {
			if ae.InstallationId == expectedEntity.InstallationId &&
				ae.Slug == expectedEntity.Slug {
				actualEntity = ae
				break
			}
		}

		if actualEntity == nil {
			t.Fatalf("expected github entity with installation_id %v and slug %v not found", expectedEntity.InstallationId, expectedEntity.Slug)
			return
		}

		if actualEntity.InstallationId != expectedEntity.InstallationId {
			t.Fatalf("expected installation_id %v, got %v", expectedEntity.InstallationId, actualEntity.InstallationId)
		}

		if actualEntity.Slug != expectedEntity.Slug {
			t.Fatalf("expected slug %v, got %v", expectedEntity.Slug, actualEntity.Slug)
		}
	}
}

func TestDBGithubEntities_EmptyResult(t *testing.T) {
	workspaceID, conn := setupTestWithWorkspace(t)
	defer conn.Release()

	entities, err := getGithubEntities(t.Context(), workspaceID)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	if len(entities) != 0 {
		t.Fatalf("expected 0 github entities for new workspace, got %d", len(entities))
	}
}

func TestDBGithubEntities_SingleEntity(t *testing.T) {
	workspaceID, conn := setupTestWithWorkspace(t)
	defer conn.Release()

	// Create a user first (required for github_entity)
	userID := uuid.New().String()
	_, err := conn.Exec(t.Context(),
		`INSERT INTO "user" (id, name, email) VALUES ($1, $2, $3)`,
		userID, "Test User", "test@example.com")
	if err != nil {
		t.Fatalf("failed to create user: %v", err)
	}

	// Insert a github entity
	installationID := 12345
	slug := "test-org"
	_, err = conn.Exec(t.Context(),
		`INSERT INTO github_entity (id, installation_id, slug, type, added_by_user_id, workspace_id) 
		 VALUES ($1, $2, $3, $4, $5, $6)`,
		uuid.New().String(), installationID, slug, "organization", userID, workspaceID)
	if err != nil {
		t.Fatalf("failed to create github entity: %v", err)
	}

	entities, err := getGithubEntities(t.Context(), workspaceID)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	expectedEntities := []*oapi.GithubEntity{
		{
			InstallationId: installationID,
			Slug:           slug,
		},
	}

	validateRetrievedGithubEntities(t, entities, expectedEntities)
}

func TestDBGithubEntities_MultipleEntities(t *testing.T) {
	workspaceID, conn := setupTestWithWorkspace(t)
	defer conn.Release()

	// Create a user first
	userID := uuid.New().String()
	_, err := conn.Exec(t.Context(),
		`INSERT INTO "user" (id, name, email) VALUES ($1, $2, $3)`,
		userID, "Test User", "test@example.com")
	if err != nil {
		t.Fatalf("failed to create user: %v", err)
	}

	// Insert multiple github entities
	entities := []struct {
		installationID int
		slug           string
		entityType     string
	}{
		{12345, "test-org-1", "organization"},
		{67890, "test-org-2", "organization"},
		{11111, "test-user", "user"},
	}

	for _, entity := range entities {
		_, err = conn.Exec(t.Context(),
			`INSERT INTO github_entity (id, installation_id, slug, type, added_by_user_id, workspace_id) 
			 VALUES ($1, $2, $3, $4, $5, $6)`,
			uuid.New().String(), entity.installationID, entity.slug, entity.entityType, userID, workspaceID)
		if err != nil {
			t.Fatalf("failed to create github entity: %v", err)
		}
	}

	retrievedEntities, err := getGithubEntities(t.Context(), workspaceID)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	// Build expected entities
	expectedEntities := []*oapi.GithubEntity{}
	for _, entity := range entities {
		installationID := entity.installationID
		slug := entity.slug
		expectedEntities = append(expectedEntities, &oapi.GithubEntity{
			InstallationId: installationID,
			Slug:           slug,
		})
	}

	validateRetrievedGithubEntities(t, retrievedEntities, expectedEntities)
}

func TestDBGithubEntities_WorkspaceIsolation(t *testing.T) {
	// Create two separate workspaces
	workspaceID1, conn1 := setupTestWithWorkspace(t)
	defer conn1.Release()

	workspaceID2, conn2 := setupTestWithWorkspace(t)
	defer conn2.Release()

	// Create users
	userID1 := uuid.New().String()
	_, err := conn1.Exec(t.Context(),
		`INSERT INTO "user" (id, name, email) VALUES ($1, $2, $3)`,
		userID1, "Test User 1", "test1@example.com")
	if err != nil {
		t.Fatalf("failed to create user1: %v", err)
	}

	userID2 := uuid.New().String()
	_, err = conn2.Exec(t.Context(),
		`INSERT INTO "user" (id, name, email) VALUES ($1, $2, $3)`,
		userID2, "Test User 2", "test2@example.com")
	if err != nil {
		t.Fatalf("failed to create user2: %v", err)
	}

	// Insert entity into workspace 1
	installationID1 := 12345
	slug1 := "workspace1-org"
	_, err = conn1.Exec(t.Context(),
		`INSERT INTO github_entity (id, installation_id, slug, type, added_by_user_id, workspace_id) 
		 VALUES ($1, $2, $3, $4, $5, $6)`,
		uuid.New().String(), installationID1, slug1, "organization", userID1, workspaceID1)
	if err != nil {
		t.Fatalf("failed to create github entity for workspace1: %v", err)
	}

	// Insert entity into workspace 2
	installationID2 := 67890
	slug2 := "workspace2-org"
	_, err = conn2.Exec(t.Context(),
		`INSERT INTO github_entity (id, installation_id, slug, type, added_by_user_id, workspace_id) 
		 VALUES ($1, $2, $3, $4, $5, $6)`,
		uuid.New().String(), installationID2, slug2, "organization", userID2, workspaceID2)
	if err != nil {
		t.Fatalf("failed to create github entity for workspace2: %v", err)
	}

	// Verify workspace 1 only sees its entity
	entities1, err := getGithubEntities(t.Context(), workspaceID1)
	if err != nil {
		t.Fatalf("expected no errors for workspace1, got %v", err)
	}

	expectedEntities1 := []*oapi.GithubEntity{
		{
			InstallationId: installationID1,
			Slug:           slug1,
		},
	}
	validateRetrievedGithubEntities(t, entities1, expectedEntities1)

	// Verify workspace 2 only sees its entity
	entities2, err := getGithubEntities(t.Context(), workspaceID2)
	if err != nil {
		t.Fatalf("expected no errors for workspace2, got %v", err)
	}

	expectedEntities2 := []*oapi.GithubEntity{
		{
			InstallationId: installationID2,
			Slug:           slug2,
		},
	}
	validateRetrievedGithubEntities(t, entities2, expectedEntities2)
}

func TestDBGithubEntities_NonexistentWorkspace(t *testing.T) {
	// Setup test environment (needed for DB connection and skip logic)
	_, conn := setupTestWithWorkspace(t)
	defer conn.Release()

	// Try to get entities for a non-existent workspace
	nonExistentWorkspaceID := uuid.New().String()

	entities, err := getGithubEntities(t.Context(), nonExistentWorkspaceID)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	// Should return empty list, not error
	if len(entities) != 0 {
		t.Fatalf("expected 0 github entities for non-existent workspace, got %d", len(entities))
	}
}
