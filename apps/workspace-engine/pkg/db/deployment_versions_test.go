package db

import (
	"fmt"
	"strings"
	"testing"
	"workspace-engine/pkg/oapi"

	"github.com/google/uuid"
)

func validateRetrievedDeploymentVersions(t *testing.T, actualVersions []*oapi.DeploymentVersion, expectedVersions []*oapi.DeploymentVersion) {
	t.Helper()
	if len(actualVersions) != len(expectedVersions) {
		t.Fatalf("expected %d deployment versions, got %d", len(expectedVersions), len(actualVersions))
	}
	for _, expected := range expectedVersions {
		var actual *oapi.DeploymentVersion
		for _, av := range actualVersions {
			if av.Id == expected.Id {
				actual = av
				break
			}
		}

		if actual == nil {
			t.Fatalf("expected deployment version with id %s not found", expected.Id)
		}
		if actual.Id != expected.Id {
			t.Fatalf("expected deployment version id %s, got %s", expected.Id, actual.Id)
		}
		if actual.Name != expected.Name {
			t.Fatalf("expected deployment version name %s, got %s", expected.Name, actual.Name)
		}
		if actual.Tag != expected.Tag {
			t.Fatalf("expected deployment version tag %s, got %s", expected.Tag, actual.Tag)
		}
		if actual.DeploymentId != expected.DeploymentId {
			t.Fatalf("expected deployment version deployment_id %s, got %s", expected.DeploymentId, actual.DeploymentId)
		}
		if actual.Status != expected.Status {
			t.Fatalf("expected deployment version status %v, got %v", expected.Status, actual.Status)
		}
		compareStrPtr(t, actual.Message, expected.Message)

		// Validate config
		if expected.Config != nil {
			if actual.Config == nil {
				t.Fatalf("expected config to be set, got nil")
			}
			if len(actual.Config) != len(expected.Config) {
				t.Fatalf("expected %d config entries, got %d", len(expected.Config), len(actual.Config))
			}
			for key, expectedValue := range expected.Config {
				actualValue, ok := actual.Config[key]
				if !ok {
					t.Fatalf("expected config key %s not found", key)
				}
				if fmt.Sprintf("%v", actualValue) != fmt.Sprintf("%v", expectedValue) {
					t.Fatalf("expected config[%s] = %v, got %v", key, expectedValue, actualValue)
				}
			}
		}

		// Validate job agent config
		if expected.JobAgentConfig != nil {
			if actual.JobAgentConfig == nil {
				t.Fatalf("expected job_agent_config to be set, got nil")
			}
			if len(actual.JobAgentConfig) != len(expected.JobAgentConfig) {
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
}

func TestDBDeploymentVersions_BasicWrite(t *testing.T) {
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

	// Create deployment version
	versionID := uuid.New().String()
	message := "test message"
	config := map[string]interface{}{
		"image": "nginx:latest",
		"port":  80.0,
	}
	jobAgentConfig := map[string]interface{}{
		"namespace": "default",
	}
	version := &oapi.DeploymentVersion{
		Id:             versionID,
		Name:           fmt.Sprintf("test-version-%s", versionID[:8]),
		Tag:            "v1.0.0",
		DeploymentId:   deploymentID,
		Status:         oapi.DeploymentVersionStatusReady,
		Message:        &message,
		Config:         config,
		JobAgentConfig: jobAgentConfig,
	}

	err = writeDeploymentVersion(t.Context(), version, tx)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	err = tx.Commit(t.Context())
	if err != nil {
		t.Fatalf("failed to commit: %v", err)
	}

	expectedVersions := []*oapi.DeploymentVersion{version}
	actualVersions, err := getDeploymentVersions(t.Context(), workspaceID)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	validateRetrievedDeploymentVersions(t, actualVersions, expectedVersions)
}

func TestDBDeploymentVersions_BasicWriteAndDelete(t *testing.T) {
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

	// Create deployment version
	versionID := uuid.New().String()
	version := &oapi.DeploymentVersion{
		Id:             versionID,
		Name:           fmt.Sprintf("test-version-%s", versionID[:8]),
		Tag:            "v1.0.0",
		DeploymentId:   deploymentID,
		Status:         oapi.DeploymentVersionStatusBuilding,
		Config:         map[string]interface{}{},
		JobAgentConfig: map[string]interface{}{},
	}

	err = writeDeploymentVersion(t.Context(), version, tx)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	err = tx.Commit(t.Context())
	if err != nil {
		t.Fatalf("failed to commit: %v", err)
	}

	// Verify version exists
	actualVersions, err := getDeploymentVersions(t.Context(), workspaceID)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}
	validateRetrievedDeploymentVersions(t, actualVersions, []*oapi.DeploymentVersion{version})

	// Delete version
	tx, err = conn.Begin(t.Context())
	if err != nil {
		t.Fatalf("failed to begin tx: %v", err)
	}
	defer tx.Rollback(t.Context())

	err = deleteDeploymentVersion(t.Context(), versionID, tx)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	err = tx.Commit(t.Context())
	if err != nil {
		t.Fatalf("failed to commit: %v", err)
	}

	// Verify version is deleted
	actualVersions, err = getDeploymentVersions(t.Context(), workspaceID)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}
	validateRetrievedDeploymentVersions(t, actualVersions, []*oapi.DeploymentVersion{})
}

func TestDBDeploymentVersions_AllStatuses(t *testing.T) {
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

	// Create versions with different statuses
	versions := []*oapi.DeploymentVersion{
		{
			Id:             uuid.New().String(),
			Name:           "version-building",
			Tag:            "v1.0.0",
			DeploymentId:   deploymentID,
			Status:         oapi.DeploymentVersionStatusBuilding,
			Config:         map[string]interface{}{},
			JobAgentConfig: map[string]interface{}{},
		},
		{
			Id:             uuid.New().String(),
			Name:           "version-ready",
			Tag:            "v2.0.0",
			DeploymentId:   deploymentID,
			Status:         oapi.DeploymentVersionStatusReady,
			Config:         map[string]interface{}{},
			JobAgentConfig: map[string]interface{}{},
		},
		{
			Id:             uuid.New().String(),
			Name:           "version-failed",
			Tag:            "v3.0.0",
			DeploymentId:   deploymentID,
			Status:         oapi.DeploymentVersionStatusFailed,
			Config:         map[string]interface{}{},
			JobAgentConfig: map[string]interface{}{},
		},
		{
			Id:             uuid.New().String(),
			Name:           "version-rejected",
			Tag:            "v4.0.0",
			DeploymentId:   deploymentID,
			Status:         oapi.DeploymentVersionStatusRejected,
			Config:         map[string]interface{}{},
			JobAgentConfig: map[string]interface{}{},
		},
	}

	for _, version := range versions {
		err = writeDeploymentVersion(t.Context(), version, tx)
		if err != nil {
			t.Fatalf("expected no errors, got %v", err)
		}
	}

	err = tx.Commit(t.Context())
	if err != nil {
		t.Fatalf("failed to commit: %v", err)
	}

	// Verify all versions
	actualVersions, err := getDeploymentVersions(t.Context(), workspaceID)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}
	validateRetrievedDeploymentVersions(t, actualVersions, versions)
}

func TestDBDeploymentVersions_BasicWriteAndUpdate(t *testing.T) {
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

	// Create deployment version
	versionID := uuid.New().String()
	message := "initial message"
	version := &oapi.DeploymentVersion{
		Id:           versionID,
		Name:         fmt.Sprintf("test-version-%s", versionID[:8]),
		Tag:          "v1.0.0",
		DeploymentId: deploymentID,
		Status:       oapi.DeploymentVersionStatusBuilding,
		Message:      &message,
		Config: map[string]interface{}{
			"key": "value",
		},
		JobAgentConfig: map[string]interface{}{},
	}

	err = writeDeploymentVersion(t.Context(), version, tx)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	err = tx.Commit(t.Context())
	if err != nil {
		t.Fatalf("failed to commit: %v", err)
	}

	// Update version
	tx, err = conn.Begin(t.Context())
	if err != nil {
		t.Fatalf("failed to begin tx: %v", err)
	}
	defer tx.Rollback(t.Context())

	updatedMessage := "updated message"
	version.Status = oapi.DeploymentVersionStatusReady
	version.Message = &updatedMessage
	version.Config = map[string]interface{}{
		"key":     "value-updated",
		"new_key": "new_value",
	}
	version.JobAgentConfig = map[string]interface{}{
		"namespace": "production",
	}

	err = writeDeploymentVersion(t.Context(), version, tx)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	err = tx.Commit(t.Context())
	if err != nil {
		t.Fatalf("failed to commit: %v", err)
	}

	// Verify update
	actualVersions, err := getDeploymentVersions(t.Context(), workspaceID)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}
	validateRetrievedDeploymentVersions(t, actualVersions, []*oapi.DeploymentVersion{version})
}

func TestDBDeploymentVersions_NonexistentDeploymentThrowsError(t *testing.T) {
	workspaceID, conn := setupTestWithWorkspace(t)

	tx, err := conn.Begin(t.Context())
	if err != nil {
		t.Fatalf("failed to begin tx: %v", err)
	}
	defer tx.Rollback(t.Context())

	version := &oapi.DeploymentVersion{
		Id:             uuid.New().String(),
		Name:           "test-version",
		Tag:            "v1.0.0",
		DeploymentId:   uuid.New().String(), // Non-existent deployment
		Status:         oapi.DeploymentVersionStatusReady,
		Config:         map[string]interface{}{},
		JobAgentConfig: map[string]interface{}{},
	}

	err = writeDeploymentVersion(t.Context(), version, tx)
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
