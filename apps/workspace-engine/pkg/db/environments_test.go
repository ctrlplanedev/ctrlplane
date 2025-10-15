package db

import (
	"fmt"
	"strings"
	"testing"
	"workspace-engine/pkg/oapi"

	"github.com/google/uuid"
)

func validateRetrievedEnvironments(t *testing.T, actualEnvironments []*oapi.Environment, expectedEnvironments []*oapi.Environment) {
	t.Helper()
	if len(actualEnvironments) != len(expectedEnvironments) {
		t.Fatalf("expected %d environments, got %d", len(expectedEnvironments), len(actualEnvironments))
	}
	for _, expectedEnv := range expectedEnvironments {
		var actualEnv *oapi.Environment
		for _, ae := range actualEnvironments {
			if ae.Id == expectedEnv.Id {
				actualEnv = ae
				break
			}
		}

		if actualEnv == nil {
			t.Fatalf("expected environment with id %s not found", expectedEnv.Id)
		}
		if actualEnv.Id != expectedEnv.Id {
			t.Fatalf("expected environment id %s, got %s", expectedEnv.Id, actualEnv.Id)
		}
		if actualEnv.Name != expectedEnv.Name {
			t.Fatalf("expected environment name %s, got %s", expectedEnv.Name, actualEnv.Name)
		}
		if actualEnv.SystemId != expectedEnv.SystemId {
			t.Fatalf("expected environment system_id %s, got %s", expectedEnv.SystemId, actualEnv.SystemId)
		}
		compareStrPtr(t, actualEnv.Description, expectedEnv.Description)
		// Note: ResourceSelector is *Selector (complex type), comparing as pointers only
		if (actualEnv.ResourceSelector == nil) != (expectedEnv.ResourceSelector == nil) {
			t.Fatalf("resource_selector nil mismatch: expected %v, got %v", expectedEnv.ResourceSelector == nil, actualEnv.ResourceSelector == nil)
		}
		if actualEnv.CreatedAt == "" {
			t.Fatalf("expected environment created_at to be set")
		}
	}
}

func TestDBEnvironments_BasicWrite(t *testing.T) {
	workspaceID, conn := setupTestWithWorkspace(t)

	tx, err := conn.Begin(t.Context())
	if err != nil {
		t.Fatalf("failed to begin tx: %v", err)
	}
	defer tx.Rollback(t.Context())

	// Create a system first (required for environment)
	systemID := uuid.New().String()
	systemName := fmt.Sprintf("test-system-%s", systemID[:8])
	systemDescription := fmt.Sprintf("desc-%s", systemID[:8])
	sys := &oapi.System{
		Id:          systemID,
		WorkspaceId: workspaceID,
		Name:        systemName,
		Description: &systemDescription,
	}

	err = writeSystem(t.Context(), sys, tx)
	if err != nil {
		t.Fatalf("failed to create system: %v", err)
	}

	// Create environment
	envID := uuid.New().String()
	envName := fmt.Sprintf("test-env-%s", envID[:8])
	description := fmt.Sprintf("test-description-%s", envID[:8])
	env := &oapi.Environment{
		Id:               envID,
		Name:             envName,
		SystemId:         systemID,
		Description:      &description,
		ResourceSelector: nil, // Selector is complex type, skipping for test
	}

	err = writeEnvironment(t.Context(), env, tx)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	err = tx.Commit(t.Context())
	if err != nil {
		t.Fatalf("failed to commit: %v", err)
	}

	expectedEnvironments := []*oapi.Environment{env}
	actualEnvironments, err := getEnvironments(t.Context(), workspaceID)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	validateRetrievedEnvironments(t, actualEnvironments, expectedEnvironments)
}

func TestDBEnvironments_BasicWriteAndDelete(t *testing.T) {
	workspaceID, conn := setupTestWithWorkspace(t)

	tx, err := conn.Begin(t.Context())
	if err != nil {
		t.Fatalf("failed to begin tx: %v", err)
	}
	defer tx.Rollback(t.Context())

	// Create a system first
	systemID := uuid.New().String()
	systemName := fmt.Sprintf("test-system-%s", systemID[:8])
	systemDescription := fmt.Sprintf("desc-%s", systemID[:8])
	sys := &oapi.System{
		Id:          systemID,
		WorkspaceId: workspaceID,
		Name:        systemName,
		Description: &systemDescription,
	}

	err = writeSystem(t.Context(), sys, tx)
	if err != nil {
		t.Fatalf("failed to create system: %v", err)
	}

	// Create environment
	envID := uuid.New().String()
	envName := fmt.Sprintf("test-env-%s", envID[:8])
	env := &oapi.Environment{
		Id:       envID,
		Name:     envName,
		SystemId: systemID,
	}

	err = writeEnvironment(t.Context(), env, tx)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	err = tx.Commit(t.Context())
	if err != nil {
		t.Fatalf("failed to commit: %v", err)
	}

	// Verify environment exists
	actualEnvironments, err := getEnvironments(t.Context(), workspaceID)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}
	validateRetrievedEnvironments(t, actualEnvironments, []*oapi.Environment{env})

	// Delete environment
	tx, err = conn.Begin(t.Context())
	if err != nil {
		t.Fatalf("failed to begin tx: %v", err)
	}
	defer tx.Rollback(t.Context())

	err = deleteEnvironment(t.Context(), envID, tx)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	err = tx.Commit(t.Context())
	if err != nil {
		t.Fatalf("failed to commit: %v", err)
	}

	// Verify environment is deleted
	actualEnvironments, err = getEnvironments(t.Context(), workspaceID)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}
	validateRetrievedEnvironments(t, actualEnvironments, []*oapi.Environment{})
}

func TestDBEnvironments_BasicWriteAndUpdate(t *testing.T) {
	workspaceID, conn := setupTestWithWorkspace(t)

	tx, err := conn.Begin(t.Context())
	if err != nil {
		t.Fatalf("failed to begin tx: %v", err)
	}
	defer tx.Rollback(t.Context())

	// Create a system first
	systemID := uuid.New().String()
	systemName := fmt.Sprintf("test-system-%s", systemID[:8])
	systemDescription := fmt.Sprintf("desc-%s", systemID[:8])
	sys := &oapi.System{
		Id:          systemID,
		WorkspaceId: workspaceID,
		Name:        systemName,
		Description: &systemDescription,
	}

	err = writeSystem(t.Context(), sys, tx)
	if err != nil {
		t.Fatalf("failed to create system: %v", err)
	}

	// Create environment
	envID := uuid.New().String()
	envName := fmt.Sprintf("test-env-%s", envID[:8])
	description := "initial-description"
	env := &oapi.Environment{
		Id:          envID,
		Name:        envName,
		SystemId:    systemID,
		Description: &description,
	}

	err = writeEnvironment(t.Context(), env, tx)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	err = tx.Commit(t.Context())
	if err != nil {
		t.Fatalf("failed to commit: %v", err)
	}

	// Update environment
	tx, err = conn.Begin(t.Context())
	if err != nil {
		t.Fatalf("failed to begin tx: %v", err)
	}
	defer tx.Rollback(t.Context())

	updatedDescription := "updated-description"
	env.Name = envName + "-updated"
	env.Description = &updatedDescription

	err = writeEnvironment(t.Context(), env, tx)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	err = tx.Commit(t.Context())
	if err != nil {
		t.Fatalf("failed to commit: %v", err)
	}

	// Verify update
	actualEnvironments, err := getEnvironments(t.Context(), workspaceID)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}
	validateRetrievedEnvironments(t, actualEnvironments, []*oapi.Environment{env})
}

func TestDBEnvironments_NonexistentSystemThrowsError(t *testing.T) {
	workspaceID, conn := setupTestWithWorkspace(t)

	tx, err := conn.Begin(t.Context())
	if err != nil {
		t.Fatalf("failed to begin tx: %v", err)
	}
	defer tx.Rollback(t.Context())

	// Try to create environment with non-existent system
	env := &oapi.Environment{
		Id:       uuid.New().String(),
		Name:     "test-env",
		SystemId: uuid.New().String(), // Non-existent system
	}

	err = writeEnvironment(t.Context(), env, tx)
	// should throw fk constraint error
	if err == nil {
		t.Fatalf("expected FK violation error, got nil")
	}

	// Check for foreign key violation (SQLSTATE 23503)
	if !strings.Contains(err.Error(), "23503") && !strings.Contains(err.Error(), "foreign key") {
		t.Fatalf("expected FK violation error, got: %v", err)
	}

	// Keep workspaceID to avoid "declared but not used" error
	_ = workspaceID
}

func TestDBEnvironments_MultipleEnvironments(t *testing.T) {
	workspaceID, conn := setupTestWithWorkspace(t)

	tx, err := conn.Begin(t.Context())
	if err != nil {
		t.Fatalf("failed to begin tx: %v", err)
	}
	defer tx.Rollback(t.Context())

	// Create a system first
	systemID := uuid.New().String()
	systemName := fmt.Sprintf("test-system-%s", systemID[:8])
	systemDescription := fmt.Sprintf("desc-%s", systemID[:8])
	sys := &oapi.System{
		Id:          systemID,
		WorkspaceId: workspaceID,
		Name:        systemName,
		Description: &systemDescription,
	}

	err = writeSystem(t.Context(), sys, tx)
	if err != nil {
		t.Fatalf("failed to create system: %v", err)
	}

	// Create multiple environments
	environments := []*oapi.Environment{
		{
			Id:       uuid.New().String(),
			Name:     "env-production",
			SystemId: systemID,
		},
		{
			Id:       uuid.New().String(),
			Name:     "env-staging",
			SystemId: systemID,
		},
		{
			Id:       uuid.New().String(),
			Name:     "env-development",
			SystemId: systemID,
		},
	}

	for _, env := range environments {
		err = writeEnvironment(t.Context(), env, tx)
		if err != nil {
			t.Fatalf("expected no errors, got %v", err)
		}
	}

	err = tx.Commit(t.Context())
	if err != nil {
		t.Fatalf("failed to commit: %v", err)
	}

	// Verify all environments
	actualEnvironments, err := getEnvironments(t.Context(), workspaceID)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}
	validateRetrievedEnvironments(t, actualEnvironments, environments)
}

func TestDBEnvironments_WithJsonResourceSelector(t *testing.T) {
	workspaceID, conn := setupTestWithWorkspace(t)

	tx, err := conn.Begin(t.Context())
	if err != nil {
		t.Fatalf("failed to begin tx: %v", err)
	}
	defer tx.Rollback(t.Context())

	// Create a system first
	systemID := uuid.New().String()
	systemName := fmt.Sprintf("test-system-%s", systemID[:8])
	systemDescription := fmt.Sprintf("desc-%s", systemID[:8])
	sys := &oapi.System{
		Id:          systemID,
		WorkspaceId: workspaceID,
		Name:        systemName,
		Description: &systemDescription,
	}

	err = writeSystem(t.Context(), sys, tx)
	if err != nil {
		t.Fatalf("failed to create system: %v", err)
	}

	// Create environment with JSON resource selector
	envID := uuid.New().String()
	envName := fmt.Sprintf("test-env-%s", envID[:8])
	description := fmt.Sprintf("test-description-%s", envID[:8])

	// Create a JSON selector
	resourceSelector := &oapi.Selector{}
	err = resourceSelector.FromJsonSelector(oapi.JsonSelector{
		Json: map[string]interface{}{
			"type":     "metadata",
			"operator": "contains",
			"key":      "region",
			"value":    "us-west",
		},
	})
	if err != nil {
		t.Fatalf("failed to create JSON selector: %v", err)
	}

	env := &oapi.Environment{
		Id:               envID,
		Name:             envName,
		SystemId:         systemID,
		Description:      &description,
		ResourceSelector: resourceSelector,
	}

	err = writeEnvironment(t.Context(), env, tx)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	err = tx.Commit(t.Context())
	if err != nil {
		t.Fatalf("failed to commit: %v", err)
	}

	// Read back and validate
	actualEnvironments, err := getEnvironments(t.Context(), workspaceID)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	if len(actualEnvironments) != 1 {
		t.Fatalf("expected 1 environment, got %d", len(actualEnvironments))
	}

	actualEnv := actualEnvironments[0]
	if actualEnv.ResourceSelector == nil {
		t.Fatalf("expected resource selector to be non-nil")
	}

	// Validate the selector content
	jsonSelector, err := actualEnv.ResourceSelector.AsJsonSelector()
	if err != nil {
		t.Fatalf("expected JSON selector, got error: %v", err)
	}

	expectedJson := map[string]interface{}{
		"type":     "metadata",
		"operator": "contains",
		"key":      "region",
		"value":    "us-west",
	}

	if jsonSelector.Json["type"] != expectedJson["type"] {
		t.Fatalf("expected type %v, got %v", expectedJson["type"], jsonSelector.Json["type"])
	}
	if jsonSelector.Json["operator"] != expectedJson["operator"] {
		t.Fatalf("expected operator %v, got %v", expectedJson["operator"], jsonSelector.Json["operator"])
	}
	if jsonSelector.Json["key"] != expectedJson["key"] {
		t.Fatalf("expected key %v, got %v", expectedJson["key"], jsonSelector.Json["key"])
	}
	if jsonSelector.Json["value"] != expectedJson["value"] {
		t.Fatalf("expected value %v, got %v", expectedJson["value"], jsonSelector.Json["value"])
	}
}

func TestDBEnvironments_WithCelResourceSelector(t *testing.T) {
	workspaceID, conn := setupTestWithWorkspace(t)

	tx, err := conn.Begin(t.Context())
	if err != nil {
		t.Fatalf("failed to begin tx: %v", err)
	}
	defer tx.Rollback(t.Context())

	// Create a system first
	systemID := uuid.New().String()
	systemName := fmt.Sprintf("test-system-%s", systemID[:8])
	systemDescription := fmt.Sprintf("desc-%s", systemID[:8])
	sys := &oapi.System{
		Id:          systemID,
		WorkspaceId: workspaceID,
		Name:        systemName,
		Description: &systemDescription,
	}

	err = writeSystem(t.Context(), sys, tx)
	if err != nil {
		t.Fatalf("failed to create system: %v", err)
	}

	// Create environment with CEL resource selector
	envID := uuid.New().String()
	envName := fmt.Sprintf("test-env-%s", envID[:8])
	description := fmt.Sprintf("test-description-%s", envID[:8])

	// Create a CEL selector
	resourceSelector := &oapi.Selector{}
	celExpression := "resource.metadata.environment == 'staging' && resource.kind == 'deployment'"
	err = resourceSelector.FromCelSelector(oapi.CelSelector{
		Cel: celExpression,
	})
	if err != nil {
		t.Fatalf("failed to create CEL selector: %v", err)
	}

	env := &oapi.Environment{
		Id:               envID,
		Name:             envName,
		SystemId:         systemID,
		Description:      &description,
		ResourceSelector: resourceSelector,
	}

	err = writeEnvironment(t.Context(), env, tx)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	err = tx.Commit(t.Context())
	if err != nil {
		t.Fatalf("failed to commit: %v", err)
	}

	// Read back and validate
	actualEnvironments, err := getEnvironments(t.Context(), workspaceID)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	if len(actualEnvironments) != 1 {
		t.Fatalf("expected 1 environment, got %d", len(actualEnvironments))
	}

	actualEnv := actualEnvironments[0]
	if actualEnv.ResourceSelector == nil {
		t.Fatalf("expected resource selector to be non-nil")
	}

	// Validate the selector content
	celSelector, err := actualEnv.ResourceSelector.AsCelSelector()
	if err != nil {
		t.Fatalf("expected CEL selector, got error: %v", err)
	}

	if celSelector.Cel != celExpression {
		t.Fatalf("expected CEL expression %s, got %s", celExpression, celSelector.Cel)
	}
}

func TestDBEnvironments_UpdateResourceSelector(t *testing.T) {
	workspaceID, conn := setupTestWithWorkspace(t)

	tx, err := conn.Begin(t.Context())
	if err != nil {
		t.Fatalf("failed to begin tx: %v", err)
	}
	defer tx.Rollback(t.Context())

	// Create a system first
	systemID := uuid.New().String()
	systemName := fmt.Sprintf("test-system-%s", systemID[:8])
	systemDescription := fmt.Sprintf("desc-%s", systemID[:8])
	sys := &oapi.System{
		Id:          systemID,
		WorkspaceId: workspaceID,
		Name:        systemName,
		Description: &systemDescription,
	}

	err = writeSystem(t.Context(), sys, tx)
	if err != nil {
		t.Fatalf("failed to create system: %v", err)
	}

	// Create environment with JSON selector
	envID := uuid.New().String()
	envName := fmt.Sprintf("test-env-%s", envID[:8])
	description := "test environment"

	initialSelector := &oapi.Selector{}
	err = initialSelector.FromJsonSelector(oapi.JsonSelector{
		Json: map[string]interface{}{
			"type":  "name",
			"value": "initial",
		},
	})
	if err != nil {
		t.Fatalf("failed to create initial JSON selector: %v", err)
	}

	env := &oapi.Environment{
		Id:               envID,
		Name:             envName,
		SystemId:         systemID,
		Description:      &description,
		ResourceSelector: initialSelector,
	}

	err = writeEnvironment(t.Context(), env, tx)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	err = tx.Commit(t.Context())
	if err != nil {
		t.Fatalf("failed to commit: %v", err)
	}

	// Update with CEL selector
	tx, err = conn.Begin(t.Context())
	if err != nil {
		t.Fatalf("failed to begin tx: %v", err)
	}
	defer tx.Rollback(t.Context())

	updatedSelector := &oapi.Selector{}
	celExpression := "resource.metadata.tier == 'backend'"
	err = updatedSelector.FromCelSelector(oapi.CelSelector{
		Cel: celExpression,
	})
	if err != nil {
		t.Fatalf("failed to create CEL selector: %v", err)
	}

	env.ResourceSelector = updatedSelector

	err = writeEnvironment(t.Context(), env, tx)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	err = tx.Commit(t.Context())
	if err != nil {
		t.Fatalf("failed to commit: %v", err)
	}

	// Verify update
	actualEnvironments, err := getEnvironments(t.Context(), workspaceID)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	if len(actualEnvironments) != 1 {
		t.Fatalf("expected 1 environment, got %d", len(actualEnvironments))
	}

	actualEnv := actualEnvironments[0]
	if actualEnv.ResourceSelector == nil {
		t.Fatalf("expected resource selector to be non-nil")
	}

	// Validate it's now a CEL selector
	celSelector, err := actualEnv.ResourceSelector.AsCelSelector()
	if err != nil {
		t.Fatalf("expected CEL selector, got error: %v", err)
	}

	if celSelector.Cel != celExpression {
		t.Fatalf("expected CEL expression %s, got %s", celExpression, celSelector.Cel)
	}
}
