package db

import (
	"fmt"
	"strings"
	"testing"
	"workspace-engine/pkg/oapi"

	"github.com/google/uuid"
)

func validateRetrievedDeploymentVariables(t *testing.T, actualVars []*oapi.DeploymentVariable, expectedVars []*oapi.DeploymentVariable) {
	t.Helper()
	if len(actualVars) != len(expectedVars) {
		t.Fatalf("expected %d deployment variables, got %d", len(expectedVars), len(actualVars))
	}
	for _, expected := range expectedVars {
		var actual *oapi.DeploymentVariable
		for _, av := range actualVars {
			if av.Id == expected.Id {
				actual = av
				break
			}
		}

		if actual == nil {
			t.Fatalf("expected deployment variable with id %s not found", expected.Id)
		}
		if actual.Id != expected.Id {
			t.Fatalf("expected deployment variable id %s, got %s", expected.Id, actual.Id)
		}
		if actual.Key != expected.Key {
			t.Fatalf("expected deployment variable key %s, got %s", expected.Key, actual.Key)
		}
		if actual.DeploymentId != expected.DeploymentId {
			t.Fatalf("expected deployment variable deployment_id %s, got %s", expected.DeploymentId, actual.DeploymentId)
		}
		compareStrPtr(t, actual.Description, expected.Description)
	}
}

func TestDBDeploymentVariables_BasicWrite(t *testing.T) {
	workspaceID, conn := setupTestWithWorkspace(t)

	tx, err := conn.Begin(t.Context())
	if err != nil {
		t.Fatalf("failed to begin tx: %v", err)
	}
	defer tx.Rollback(t.Context())

	// Create system and deployment
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
		t.Fatalf("failed to create deployment: %v", err)
	}

	// Create deployment variable
	varID := uuid.New().String()
	description := "test description"
	variable := &oapi.DeploymentVariable{
		Id:           varID,
		Key:          "DATABASE_URL",
		Description:  &description,
		DeploymentId: deploymentID,
	}

	err = writeDeploymentVariable(t.Context(), variable, tx)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	err = tx.Commit(t.Context())
	if err != nil {
		t.Fatalf("failed to commit: %v", err)
	}

	expectedVars := []*oapi.DeploymentVariable{variable}
	actualVars, err := getDeploymentVariables(t.Context(), workspaceID)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	validateRetrievedDeploymentVariables(t, actualVars, expectedVars)
}

func TestDBDeploymentVariables_BasicWriteAndDelete(t *testing.T) {
	workspaceID, conn := setupTestWithWorkspace(t)

	tx, err := conn.Begin(t.Context())
	if err != nil {
		t.Fatalf("failed to begin tx: %v", err)
	}
	defer tx.Rollback(t.Context())

	// Create system and deployment
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
		t.Fatalf("failed to create deployment: %v", err)
	}

	// Create deployment variable
	varID := uuid.New().String()
	varDescription := "test description"
	variable := &oapi.DeploymentVariable{
		Id:           varID,
		Key:          "API_KEY",
		Description:  &varDescription,
		DeploymentId: deploymentID,
	}

	err = writeDeploymentVariable(t.Context(), variable, tx)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	err = tx.Commit(t.Context())
	if err != nil {
		t.Fatalf("failed to commit: %v", err)
	}

	// Verify variable exists
	actualVars, err := getDeploymentVariables(t.Context(), workspaceID)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}
	validateRetrievedDeploymentVariables(t, actualVars, []*oapi.DeploymentVariable{variable})

	// Delete variable
	tx, err = conn.Begin(t.Context())
	if err != nil {
		t.Fatalf("failed to begin tx: %v", err)
	}
	defer tx.Rollback(t.Context())

	err = deleteDeploymentVariable(t.Context(), varID, tx)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	err = tx.Commit(t.Context())
	if err != nil {
		t.Fatalf("failed to commit: %v", err)
	}

	// Verify variable is deleted
	actualVars, err = getDeploymentVariables(t.Context(), workspaceID)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}
	validateRetrievedDeploymentVariables(t, actualVars, []*oapi.DeploymentVariable{})
}

func TestDBDeploymentVariables_BasicWriteAndUpdate(t *testing.T) {
	workspaceID, conn := setupTestWithWorkspace(t)

	tx, err := conn.Begin(t.Context())
	if err != nil {
		t.Fatalf("failed to begin tx: %v", err)
	}
	defer tx.Rollback(t.Context())

	// Create system and deployment
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
		t.Fatalf("failed to create deployment: %v", err)
	}

	// Create deployment variable
	varID := uuid.New().String()
	description := "initial description"
	variable := &oapi.DeploymentVariable{
		Id:           varID,
		Key:          "CONFIG_VAR",
		Description:  &description,
		DeploymentId: deploymentID,
	}

	err = writeDeploymentVariable(t.Context(), variable, tx)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	err = tx.Commit(t.Context())
	if err != nil {
		t.Fatalf("failed to commit: %v", err)
	}

	// Update variable
	tx, err = conn.Begin(t.Context())
	if err != nil {
		t.Fatalf("failed to begin tx: %v", err)
	}
	defer tx.Rollback(t.Context())

	updatedDescription := "updated description"
	variable.Key = "UPDATED_CONFIG_VAR"
	variable.Description = &updatedDescription

	err = writeDeploymentVariable(t.Context(), variable, tx)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	err = tx.Commit(t.Context())
	if err != nil {
		t.Fatalf("failed to commit: %v", err)
	}

	// Verify update
	actualVars, err := getDeploymentVariables(t.Context(), workspaceID)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}
	validateRetrievedDeploymentVariables(t, actualVars, []*oapi.DeploymentVariable{variable})
}

func TestDBDeploymentVariables_NonexistentDeploymentThrowsError(t *testing.T) {
	workspaceID, conn := setupTestWithWorkspace(t)

	tx, err := conn.Begin(t.Context())
	if err != nil {
		t.Fatalf("failed to begin tx: %v", err)
	}
	defer tx.Rollback(t.Context())

	varDescription := "test"
	variable := &oapi.DeploymentVariable{
		Id:           uuid.New().String(),
		Key:          "VAR",
		Description:  &varDescription,
		DeploymentId: uuid.New().String(), // Non-existent deployment
	}

	err = writeDeploymentVariable(t.Context(), variable, tx)
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

func TestDBDeploymentVariables_MultipleVariables(t *testing.T) {
	workspaceID, conn := setupTestWithWorkspace(t)

	tx, err := conn.Begin(t.Context())
	if err != nil {
		t.Fatalf("failed to begin tx: %v", err)
	}
	defer tx.Rollback(t.Context())

	// Create system and deployment
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
		t.Fatalf("failed to create deployment: %v", err)
	}

	// Create multiple variables
	desc1 := "desc1"
	desc2 := "desc2"
	desc3 := "desc3"
	variables := []*oapi.DeploymentVariable{
		{
			Id:           uuid.New().String(),
			Key:          "DATABASE_URL",
			Description:  &desc1,
			DeploymentId: deploymentID,
		},
		{
			Id:           uuid.New().String(),
			Key:          "API_KEY",
			Description:  &desc2,
			DeploymentId: deploymentID,
		},
		{
			Id:           uuid.New().String(),
			Key:          "SECRET_TOKEN",
			Description:  &desc3,
			DeploymentId: deploymentID,
		},
	}

	for _, variable := range variables {
		err = writeDeploymentVariable(t.Context(), variable, tx)
		if err != nil {
			t.Fatalf("expected no errors, got %v", err)
		}
	}

	err = tx.Commit(t.Context())
	if err != nil {
		t.Fatalf("failed to commit: %v", err)
	}

	// Verify all variables
	actualVars, err := getDeploymentVariables(t.Context(), workspaceID)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}
	validateRetrievedDeploymentVariables(t, actualVars, variables)
}
