package db

import (
	"fmt"
	"strings"
	"testing"
	"workspace-engine/pkg/oapi"

	"github.com/google/uuid"
)

func validateRetrievedDeployments(t *testing.T, actualDeployments []*oapi.Deployment, expectedDeployments []*oapi.Deployment) {
	t.Helper()
	if len(actualDeployments) != len(expectedDeployments) {
		t.Fatalf("expected %d deployments, got %d", len(expectedDeployments), len(actualDeployments))
	}
	for _, expected := range expectedDeployments {
		var actual *oapi.Deployment
		for _, ad := range actualDeployments {
			if ad.Id == expected.Id {
				actual = ad
				break
			}
		}

		if actual == nil {
			t.Fatalf("expected deployment with id %s not found", expected.Id)
			return
		}
		if actual.Id != expected.Id {
			t.Fatalf("expected deployment id %s, got %s", expected.Id, actual.Id)
		}
		if actual.Name != expected.Name {
			t.Fatalf("expected deployment name %s, got %s", expected.Name, actual.Name)
		}
		if actual.Slug != expected.Slug {
			t.Fatalf("expected deployment slug %s, got %s", expected.Slug, actual.Slug)
		}
		if actual.SystemId != expected.SystemId {
			t.Fatalf("expected deployment system_id %s, got %s", expected.SystemId, actual.SystemId)
		}
		compareStrPtr(t, actual.Description, expected.Description)
		compareStrPtr(t, actual.JobAgentId, expected.JobAgentId)
		// Note: ResourceSelector is *Selector (complex type), comparing as pointers only
		if (actual.ResourceSelector == nil) != (expected.ResourceSelector == nil) {
			t.Fatalf("resource_selector nil mismatch: expected %v, got %v", expected.ResourceSelector == nil, actual.ResourceSelector == nil)
		}

		// Validate JobAgentConfig
		if len(expected.JobAgentConfig) != len(actual.JobAgentConfig) {
			t.Fatalf("expected %d job_agent_config entries, got %d", len(expected.JobAgentConfig), len(actual.JobAgentConfig))
		}
		for key, expectedValue := range expected.JobAgentConfig {
			actualValue, ok := actual.JobAgentConfig[key]
			if !ok {
				t.Fatalf("expected job_agent_config key %s not found", key)
			}
			if fmt.Sprintf("%v", actualValue) != fmt.Sprintf("%v", expectedValue) {
				t.Fatalf("expected job_agent_config[%s] = %v, got %v", key, expectedValue, actualValue)
			}
		}
	}
}

func TestDBDeployments_BasicWrite(t *testing.T) {
	workspaceID, conn := setupTestWithWorkspace(t)

	tx, err := conn.Begin(t.Context())
	if err != nil {
		t.Fatalf("failed to begin tx: %v", err)
	}
	defer func() { _ = tx.Rollback(t.Context()) }()

	// Create a system first
	systemID := uuid.New().String()
	systemDescription := fmt.Sprintf("desc-%s", systemID[:8])
	sys := &oapi.System{
		Id:          systemID,
		WorkspaceId: workspaceID,
		Name:        fmt.Sprintf("test-system-%s", systemID[:8]),
		Description: &systemDescription,
	}
	err = writeSystem(t.Context(), sys, tx)
	if err != nil {
		t.Fatalf("failed to create system: %v", err)
	}

	// Create deployment
	deploymentID := uuid.New().String()
	description := "test description"
	deployment := &oapi.Deployment{
		Id:               deploymentID,
		Name:             fmt.Sprintf("test-deployment-%s", deploymentID[:8]),
		Slug:             fmt.Sprintf("test-deployment-%s", deploymentID[:8]),
		SystemId:         systemID,
		Description:      &description,
		JobAgentConfig:   map[string]interface{}{},
		ResourceSelector: nil, // Selector is complex type, skipping for basic test
	}

	err = writeDeployment(t.Context(), deployment, tx)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	err = tx.Commit(t.Context())
	if err != nil {
		t.Fatalf("failed to commit: %v", err)
	}

	expectedDeployments := []*oapi.Deployment{deployment}
	actualDeployments, err := getDeployments(t.Context(), workspaceID)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	validateRetrievedDeployments(t, actualDeployments, expectedDeployments)
}

func TestDBDeployments_BasicWriteAndDelete(t *testing.T) {
	workspaceID, conn := setupTestWithWorkspace(t)

	tx, err := conn.Begin(t.Context())
	if err != nil {
		t.Fatalf("failed to begin tx: %v", err)
	}
	defer func() { _ = tx.Rollback(t.Context()) }()

	// Create a system first
	systemID := uuid.New().String()
	systemDescription := fmt.Sprintf("desc-%s", systemID[:8])
	sys := &oapi.System{
		Id:          systemID,
		WorkspaceId: workspaceID,
		Name:        fmt.Sprintf("test-system-%s", systemID[:8]),
		Description: &systemDescription,
	}
	err = writeSystem(t.Context(), sys, tx)
	if err != nil {
		t.Fatalf("failed to create system: %v", err)
	}

	// Create deployment
	deploymentID := uuid.New().String()
	deploymentDescription := fmt.Sprintf("deployment-desc-%s", deploymentID[:8])
	deployment := &oapi.Deployment{
		Id:             deploymentID,
		Name:           fmt.Sprintf("test-deployment-%s", deploymentID[:8]),
		Slug:           fmt.Sprintf("test-deployment-%s", deploymentID[:8]),
		SystemId:       systemID,
		Description:    &deploymentDescription,
		JobAgentConfig: map[string]interface{}{},
	}

	err = writeDeployment(t.Context(), deployment, tx)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	err = tx.Commit(t.Context())
	if err != nil {
		t.Fatalf("failed to commit: %v", err)
	}

	// Verify deployment exists
	actualDeployments, err := getDeployments(t.Context(), workspaceID)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}
	validateRetrievedDeployments(t, actualDeployments, []*oapi.Deployment{deployment})

	// Delete deployment
	tx, err = conn.Begin(t.Context())
	if err != nil {
		t.Fatalf("failed to begin tx: %v", err)
	}
	defer func() { _ = tx.Rollback(t.Context()) }()

	err = deleteDeployment(t.Context(), deploymentID, tx)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	err = tx.Commit(t.Context())
	if err != nil {
		t.Fatalf("failed to commit: %v", err)
	}

	// Verify deployment is deleted
	actualDeployments, err = getDeployments(t.Context(), workspaceID)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}
	validateRetrievedDeployments(t, actualDeployments, []*oapi.Deployment{})
}

func TestDBDeployments_BasicWriteAndUpdate(t *testing.T) {
	workspaceID, conn := setupTestWithWorkspace(t)

	tx, err := conn.Begin(t.Context())
	if err != nil {
		t.Fatalf("failed to begin tx: %v", err)
	}
	defer func() { _ = tx.Rollback(t.Context()) }()

	// Create a system first
	systemID := uuid.New().String()
	systemDescription := fmt.Sprintf("desc-%s", systemID[:8])
	sys := &oapi.System{
		Id:          systemID,
		WorkspaceId: workspaceID,
		Name:        fmt.Sprintf("test-system-%s", systemID[:8]),
		Description: &systemDescription,
	}
	err = writeSystem(t.Context(), sys, tx)
	if err != nil {
		t.Fatalf("failed to create system: %v", err)
	}

	// Create deployment
	deploymentID := uuid.New().String()
	description := "initial description"
	deployment := &oapi.Deployment{
		Id:             deploymentID,
		Name:           fmt.Sprintf("test-deployment-%s", deploymentID[:8]),
		Slug:           fmt.Sprintf("test-deployment-%s", deploymentID[:8]),
		SystemId:       systemID,
		Description:    &description,
		JobAgentConfig: map[string]interface{}{},
	}

	err = writeDeployment(t.Context(), deployment, tx)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	err = tx.Commit(t.Context())
	if err != nil {
		t.Fatalf("failed to commit: %v", err)
	}

	// Update deployment
	tx, err = conn.Begin(t.Context())
	if err != nil {
		t.Fatalf("failed to begin tx: %v", err)
	}
	defer func() { _ = tx.Rollback(t.Context()) }()

	updatedDescription := "updated description"
	deployment.Name = deployment.Name + "-updated"
	deployment.Description = &updatedDescription
	deployment.JobAgentConfig = map[string]interface{}{
		"key":  "value",
		"port": 8080.0,
	}

	err = writeDeployment(t.Context(), deployment, tx)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	err = tx.Commit(t.Context())
	if err != nil {
		t.Fatalf("failed to commit: %v", err)
	}

	// Verify update
	actualDeployments, err := getDeployments(t.Context(), workspaceID)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}
	validateRetrievedDeployments(t, actualDeployments, []*oapi.Deployment{deployment})
}

func TestDBDeployments_WithJobAgentConfig(t *testing.T) {
	workspaceID, conn := setupTestWithWorkspace(t)

	tx, err := conn.Begin(t.Context())
	if err != nil {
		t.Fatalf("failed to begin tx: %v", err)
	}
	defer func() { _ = tx.Rollback(t.Context()) }()

	// Create a system first
	systemID := uuid.New().String()
	systemDescription := fmt.Sprintf("desc-%s", systemID[:8])
	sys := &oapi.System{
		Id:          systemID,
		WorkspaceId: workspaceID,
		Name:        fmt.Sprintf("test-system-%s", systemID[:8]),
		Description: &systemDescription,
	}
	err = writeSystem(t.Context(), sys, tx)
	if err != nil {
		t.Fatalf("failed to create system: %v", err)
	}

	// Create deployment with job agent config
	deploymentID := uuid.New().String()
	deploymentDescription := fmt.Sprintf("deployment-desc-%s", deploymentID[:8])
	deployment := &oapi.Deployment{
		Id:          deploymentID,
		Name:        fmt.Sprintf("test-deployment-%s", deploymentID[:8]),
		Slug:        fmt.Sprintf("test-deployment-%s", deploymentID[:8]),
		SystemId:    systemID,
		Description: &deploymentDescription,
		JobAgentConfig: map[string]interface{}{
			"string": "value",
			"number": 42.0,
			"bool":   true,
			"nested": map[string]interface{}{
				"key": "value",
			},
			"array": []interface{}{"item1", "item2"},
		},
	}

	err = writeDeployment(t.Context(), deployment, tx)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	err = tx.Commit(t.Context())
	if err != nil {
		t.Fatalf("failed to commit: %v", err)
	}

	// Verify
	actualDeployments, err := getDeployments(t.Context(), workspaceID)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}
	validateRetrievedDeployments(t, actualDeployments, []*oapi.Deployment{deployment})
}

func TestDBDeployments_NonexistentSystemThrowsError(t *testing.T) {
	workspaceID, conn := setupTestWithWorkspace(t)

	tx, err := conn.Begin(t.Context())
	if err != nil {
		t.Fatalf("failed to begin tx: %v", err)
	}
	defer func() { _ = tx.Rollback(t.Context()) }()

	description := "test"
	deployment := &oapi.Deployment{
		Id:             uuid.New().String(),
		Name:           "test-deployment",
		Slug:           "test-deployment",
		SystemId:       uuid.New().String(), // Non-existent system
		Description:    &description,
		JobAgentConfig: map[string]interface{}{},
	}

	err = writeDeployment(t.Context(), deployment, tx)
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

func TestDBDeployments_WithJsonResourceSelector(t *testing.T) {
	workspaceID, conn := setupTestWithWorkspace(t)

	tx, err := conn.Begin(t.Context())
	if err != nil {
		t.Fatalf("failed to begin tx: %v", err)
	}
	defer func() { _ = tx.Rollback(t.Context()) }()

	// Create a system first
	systemID := uuid.New().String()
	systemDescription := fmt.Sprintf("desc-%s", systemID[:8])
	sys := &oapi.System{
		Id:          systemID,
		WorkspaceId: workspaceID,
		Name:        fmt.Sprintf("test-system-%s", systemID[:8]),
		Description: &systemDescription,
	}
	err = writeSystem(t.Context(), sys, tx)
	if err != nil {
		t.Fatalf("failed to create system: %v", err)
	}

	// Create deployment with JSON resource selector
	deploymentID := uuid.New().String()
	description := "test deployment with JSON selector"

	// Create a JSON selector
	resourceSelector := &oapi.Selector{}
	err = resourceSelector.FromJsonSelector(oapi.JsonSelector{
		Json: map[string]interface{}{
			"type":     "name",
			"operator": "equals",
			"value":    "test-resource",
		},
	})
	if err != nil {
		t.Fatalf("failed to create JSON selector: %v", err)
	}

	deployment := &oapi.Deployment{
		Id:               deploymentID,
		Name:             fmt.Sprintf("test-deployment-%s", deploymentID[:8]),
		Slug:             fmt.Sprintf("test-deployment-%s", deploymentID[:8]),
		SystemId:         systemID,
		Description:      &description,
		JobAgentConfig:   map[string]interface{}{},
		ResourceSelector: resourceSelector,
	}

	err = writeDeployment(t.Context(), deployment, tx)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	err = tx.Commit(t.Context())
	if err != nil {
		t.Fatalf("failed to commit: %v", err)
	}

	// Read back and validate
	actualDeployments, err := getDeployments(t.Context(), workspaceID)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	if len(actualDeployments) != 1 {
		t.Fatalf("expected 1 deployment, got %d", len(actualDeployments))
	}

	actualDeployment := actualDeployments[0]
	if actualDeployment.ResourceSelector == nil {
		t.Fatalf("expected resource selector to be non-nil")
	}

	// Validate the selector content
	jsonSelector, err := actualDeployment.ResourceSelector.AsJsonSelector()
	if err != nil {
		t.Fatalf("expected JSON selector, got error: %v", err)
	}

	expectedJson := map[string]interface{}{
		"type":     "name",
		"operator": "equals",
		"value":    "test-resource",
	}

	if jsonSelector.Json["type"] != expectedJson["type"] {
		t.Fatalf("expected type %v, got %v", expectedJson["type"], jsonSelector.Json["type"])
	}
	if jsonSelector.Json["operator"] != expectedJson["operator"] {
		t.Fatalf("expected operator %v, got %v", expectedJson["operator"], jsonSelector.Json["operator"])
	}
	if jsonSelector.Json["value"] != expectedJson["value"] {
		t.Fatalf("expected value %v, got %v", expectedJson["value"], jsonSelector.Json["value"])
	}
}

// TODO: Add CEL selector tests when CEL support is implemented
// func TestDBDeployments_WithCelResourceSelector(t *testing.T) { ... }

func TestDBDeployments_UpdateResourceSelector(t *testing.T) {
	workspaceID, conn := setupTestWithWorkspace(t)

	tx, err := conn.Begin(t.Context())
	if err != nil {
		t.Fatalf("failed to begin tx: %v", err)
	}
	defer func() { _ = tx.Rollback(t.Context()) }()

	// Create a system first
	systemID := uuid.New().String()
	systemDescription := fmt.Sprintf("desc-%s", systemID[:8])
	sys := &oapi.System{
		Id:          systemID,
		WorkspaceId: workspaceID,
		Name:        fmt.Sprintf("test-system-%s", systemID[:8]),
		Description: &systemDescription,
	}
	err = writeSystem(t.Context(), sys, tx)
	if err != nil {
		t.Fatalf("failed to create system: %v", err)
	}

	// Create deployment with JSON selector
	deploymentID := uuid.New().String()
	description := "test deployment"

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

	deployment := &oapi.Deployment{
		Id:               deploymentID,
		Name:             fmt.Sprintf("test-deployment-%s", deploymentID[:8]),
		Slug:             fmt.Sprintf("test-deployment-%s", deploymentID[:8]),
		SystemId:         systemID,
		Description:      &description,
		JobAgentConfig:   map[string]interface{}{},
		ResourceSelector: initialSelector,
	}

	err = writeDeployment(t.Context(), deployment, tx)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	err = tx.Commit(t.Context())
	if err != nil {
		t.Fatalf("failed to commit: %v", err)
	}

	// Update with a different JSON selector
	tx, err = conn.Begin(t.Context())
	if err != nil {
		t.Fatalf("failed to begin tx: %v", err)
	}
	defer func() { _ = tx.Rollback(t.Context()) }()

	updatedSelector := &oapi.Selector{}
	err = updatedSelector.FromJsonSelector(oapi.JsonSelector{
		Json: map[string]interface{}{
			"type":     "kind",
			"value":    "pod",
			"operator": "equals",
		},
	})
	if err != nil {
		t.Fatalf("failed to create updated JSON selector: %v", err)
	}

	deployment.ResourceSelector = updatedSelector

	err = writeDeployment(t.Context(), deployment, tx)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	err = tx.Commit(t.Context())
	if err != nil {
		t.Fatalf("failed to commit: %v", err)
	}

	// Verify update
	actualDeployments, err := getDeployments(t.Context(), workspaceID)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	if len(actualDeployments) != 1 {
		t.Fatalf("expected 1 deployment, got %d", len(actualDeployments))
	}

	actualDeployment := actualDeployments[0]
	if actualDeployment.ResourceSelector == nil {
		t.Fatalf("expected resource selector to be non-nil")
	}

	// Validate it's the updated JSON selector
	jsonSelector, err := actualDeployment.ResourceSelector.AsJsonSelector()
	if err != nil {
		t.Fatalf("expected JSON selector, got error: %v", err)
	}

	if jsonSelector.Json["type"] != "kind" {
		t.Fatalf("expected type 'kind', got %v", jsonSelector.Json["type"])
	}
	if jsonSelector.Json["value"] != "pod" {
		t.Fatalf("expected value 'pod', got %v", jsonSelector.Json["value"])
	}
}
