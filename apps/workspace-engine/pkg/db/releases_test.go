package db

import (
	"encoding/json"
	"fmt"
	"testing"
	"workspace-engine/pkg/oapi"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Helper function to validate retrieved releases
func validateRetrievedReleases(t *testing.T, actualReleases []*oapi.Release, expectedReleases []*oapi.Release) {
	t.Helper()
	if len(actualReleases) != len(expectedReleases) {
		t.Fatalf("expected %d releases, got %d", len(expectedReleases), len(actualReleases))
	}

	for _, expectedRelease := range expectedReleases {
		var actualRelease *oapi.Release
		for _, ar := range actualReleases {
			// Match by release target and version
			if ar.ReleaseTarget.ResourceId == expectedRelease.ReleaseTarget.ResourceId &&
				ar.ReleaseTarget.EnvironmentId == expectedRelease.ReleaseTarget.EnvironmentId &&
				ar.ReleaseTarget.DeploymentId == expectedRelease.ReleaseTarget.DeploymentId &&
				ar.Version.Id == expectedRelease.Version.Id {
				actualRelease = ar
				break
			}
		}

		if actualRelease == nil {
			t.Fatalf("expected release with version %s for target (resource:%s, env:%s, deployment:%s) not found",
				expectedRelease.Version.Id,
				expectedRelease.ReleaseTarget.ResourceId,
				expectedRelease.ReleaseTarget.EnvironmentId,
				expectedRelease.ReleaseTarget.DeploymentId)
		}

		// Validate release target
		if actualRelease.ReleaseTarget.ResourceId != expectedRelease.ReleaseTarget.ResourceId {
			t.Fatalf("expected resource_id %s, got %s", expectedRelease.ReleaseTarget.ResourceId, actualRelease.ReleaseTarget.ResourceId)
		}
		if actualRelease.ReleaseTarget.EnvironmentId != expectedRelease.ReleaseTarget.EnvironmentId {
			t.Fatalf("expected environment_id %s, got %s", expectedRelease.ReleaseTarget.EnvironmentId, actualRelease.ReleaseTarget.EnvironmentId)
		}
		if actualRelease.ReleaseTarget.DeploymentId != expectedRelease.ReleaseTarget.DeploymentId {
			t.Fatalf("expected deployment_id %s, got %s", expectedRelease.ReleaseTarget.DeploymentId, actualRelease.ReleaseTarget.DeploymentId)
		}

		// Validate version
		if actualRelease.Version.Id != expectedRelease.Version.Id {
			t.Fatalf("expected version id %s, got %s", expectedRelease.Version.Id, actualRelease.Version.Id)
		}
		if actualRelease.Version.Name != expectedRelease.Version.Name {
			t.Fatalf("expected version name %s, got %s", expectedRelease.Version.Name, actualRelease.Version.Name)
		}
		if actualRelease.Version.Tag != expectedRelease.Version.Tag {
			t.Fatalf("expected version tag %s, got %s", expectedRelease.Version.Tag, actualRelease.Version.Tag)
		}

		// Validate variables
		if len(actualRelease.Variables) != len(expectedRelease.Variables) {
			t.Fatalf("expected %d variables, got %d", len(expectedRelease.Variables), len(actualRelease.Variables))
		}
		for key, expectedValue := range expectedRelease.Variables {
			actualValue, ok := actualRelease.Variables[key]
			if !ok {
				t.Fatalf("expected variable key %s not found", key)
			}
			// Normalize JSON by unmarshaling and remarshaling for consistent comparison
			var expectedNormalized, actualNormalized interface{}
			expectedJSON, _ := expectedValue.MarshalJSON()
			actualJSON, _ := actualValue.MarshalJSON()
			_ = json.Unmarshal(expectedJSON, &expectedNormalized)
			_ = json.Unmarshal(actualJSON, &actualNormalized)

			expectedNormalizedJSON, _ := json.Marshal(expectedNormalized)
			actualNormalizedJSON, _ := json.Marshal(actualNormalized)

			if string(expectedNormalizedJSON) != string(actualNormalizedJSON) {
				t.Fatalf("expected variable[%s] = %s, got %s", key, string(expectedNormalizedJSON), string(actualNormalizedJSON))
			}
		}

		// Validate created_at is set
		if actualRelease.CreatedAt == "" {
			t.Fatalf("expected release created_at to be set")
		}
	}
}

// Helper to create prerequisites for a release
func createReleasePrerequisites(t *testing.T, workspaceID string, conn *pgxpool.Conn) (systemID, deploymentID, versionID, resourceID, environmentID string) {
	t.Helper()

	ctx := t.Context()
	tx, err := conn.Begin(ctx)
	if err != nil {
		t.Fatalf("failed to begin tx: %v", err)
	}
	defer tx.Rollback(ctx)

	// Create system
	systemID = uuid.New().String()
	systemDescription := fmt.Sprintf("test-system-%s", systemID[:8])
	sys := &oapi.System{
		Id:          systemID,
		WorkspaceId: workspaceID,
		Name:        fmt.Sprintf("test-system-%s", systemID[:8]),
		Description: &systemDescription,
	}
	if err := writeSystem(ctx, sys, tx); err != nil {
		t.Fatalf("failed to create system: %v", err)
	}

	// Create deployment
	deploymentID = uuid.New().String()
	deploymentDescription := fmt.Sprintf("deployment-%s", deploymentID[:8])
	deployment := &oapi.Deployment{
		Id:             deploymentID,
		Name:           fmt.Sprintf("test-deployment-%s", deploymentID[:8]),
		Slug:           fmt.Sprintf("test-deployment-%s", deploymentID[:8]),
		SystemId:       systemID,
		Description:    &deploymentDescription,
		JobAgentConfig: map[string]interface{}{},
	}
	if err := writeDeployment(ctx, deployment, tx); err != nil {
		t.Fatalf("failed to create deployment: %v", err)
	}

	// Create deployment version
	versionID = uuid.New().String()
	version := &oapi.DeploymentVersion{
		Id:             versionID,
		Name:           fmt.Sprintf("version-%s", versionID[:8]),
		Tag:            "v1.0.0",
		DeploymentId:   deploymentID,
		Status:         oapi.DeploymentVersionStatusReady,
		Config:         map[string]interface{}{"image": "nginx:latest"},
		JobAgentConfig: map[string]interface{}{},
	}
	if err := writeDeploymentVersion(ctx, version, tx); err != nil {
		t.Fatalf("failed to create deployment version: %v", err)
	}

	// Create resource
	resourceID = uuid.New().String()
	resource := &oapi.Resource{
		Id:          resourceID,
		Version:     "v1",
		Name:        fmt.Sprintf("resource-%s", resourceID[:8]),
		Kind:        "kubernetes.pod",
		Identifier:  fmt.Sprintf("pod-%s", resourceID[:8]),
		WorkspaceId: workspaceID,
		Config:      map[string]interface{}{},
		Metadata:    map[string]string{},
	}
	if err := writeResource(ctx, resource, tx); err != nil {
		t.Fatalf("failed to create resource: %v", err)
	}

	// Create environment
	environmentID = uuid.New().String()
	environment := &oapi.Environment{
		Id:          environmentID,
		Name:        fmt.Sprintf("environment-%s", environmentID[:8]),
		Description: strPtr(fmt.Sprintf("env-%s", environmentID[:8])),
		SystemId:    systemID,
	}
	if err := writeEnvironment(ctx, environment, tx); err != nil {
		t.Fatalf("failed to create environment: %v", err)
	}

	// Create release target
	_, err = tx.Exec(ctx,
		"INSERT INTO release_target (resource_id, environment_id, deployment_id) VALUES ($1, $2, $3)",
		resourceID, environmentID, deploymentID)
	if err != nil {
		t.Fatalf("failed to create release target: %v", err)
	}

	if err := tx.Commit(ctx); err != nil {
		t.Fatalf("failed to commit: %v", err)
	}

	return systemID, deploymentID, versionID, resourceID, environmentID
}

func strPtr(s string) *string {
	return &s
}

// Helper to create literal values for tests
func stringLiteral(s string) oapi.LiteralValue {
	var v oapi.LiteralValue
	_ = v.FromStringValue(s)
	return v
}

func numberLiteral(n float32) oapi.LiteralValue {
	var v oapi.LiteralValue
	_ = v.FromNumberValue(n)
	return v
}

func boolLiteral(b bool) oapi.LiteralValue {
	var v oapi.LiteralValue
	_ = v.FromBooleanValue(b)
	return v
}

func objectLiteral(obj map[string]interface{}) oapi.LiteralValue {
	var v oapi.LiteralValue
	_ = v.FromObjectValue(oapi.ObjectValue{Object: obj})
	return v
}

func TestDBReleases_BasicWrite(t *testing.T) {
	workspaceID, conn := setupTestWithWorkspace(t)

	systemID, deploymentID, versionID, resourceID, environmentID := createReleasePrerequisites(
		t, workspaceID, conn)

	tx, err := conn.Begin(t.Context())
	if err != nil {
		t.Fatalf("failed to begin tx: %v", err)
	}
	defer tx.Rollback(t.Context())

	// Create a release
	release := &oapi.Release{
		ReleaseTarget: oapi.ReleaseTarget{
			ResourceId:    resourceID,
			EnvironmentId: environmentID,
			DeploymentId:  deploymentID,
		},
		Version: oapi.DeploymentVersion{
			Id:           versionID,
			Name:         fmt.Sprintf("version-%s", versionID[:8]),
			Tag:          "v1.0.0",
			DeploymentId: deploymentID,
			Status:       oapi.DeploymentVersionStatusReady,
		},
		Variables: map[string]oapi.LiteralValue{
			"ENV":      stringLiteral("production"),
			"REPLICAS": numberLiteral(3.0),
			"DEBUG":    boolLiteral(false),
		},
	}

	err = writeRelease(t.Context(), release, workspaceID, tx)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	err = tx.Commit(t.Context())
	if err != nil {
		t.Fatalf("failed to commit: %v", err)
	}

	// Verify release was created
	actualReleases, err := getReleases(t.Context(), workspaceID)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	validateRetrievedReleases(t, actualReleases, []*oapi.Release{release})

	// Keep systemID to avoid "declared but not used" error
	_ = systemID
}

func TestDBReleases_EmptyVariables(t *testing.T) {
	workspaceID, conn := setupTestWithWorkspace(t)

	systemID, deploymentID, versionID, resourceID, environmentID := createReleasePrerequisites(
		t, workspaceID, conn)

	tx, err := conn.Begin(t.Context())
	if err != nil {
		t.Fatalf("failed to begin tx: %v", err)
	}
	defer tx.Rollback(t.Context())

	// Create a release with no variables
	release := &oapi.Release{
		ReleaseTarget: oapi.ReleaseTarget{
			ResourceId:    resourceID,
			EnvironmentId: environmentID,
			DeploymentId:  deploymentID,
		},
		Version: oapi.DeploymentVersion{
			Id:           versionID,
			Name:         fmt.Sprintf("version-%s", versionID[:8]),
			Tag:          "v1.0.0",
			DeploymentId: deploymentID,
			Status:       oapi.DeploymentVersionStatusReady,
		},
		Variables: map[string]oapi.LiteralValue{},
	}

	err = writeRelease(t.Context(), release, workspaceID, tx)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	err = tx.Commit(t.Context())
	if err != nil {
		t.Fatalf("failed to commit: %v", err)
	}

	// Verify release was created
	actualReleases, err := getReleases(t.Context(), workspaceID)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	validateRetrievedReleases(t, actualReleases, []*oapi.Release{release})

	// Keep systemID to avoid "declared but not used" error
	_ = systemID
}

func TestDBReleases_ComplexVariables(t *testing.T) {
	workspaceID, conn := setupTestWithWorkspace(t)

	systemID, deploymentID, versionID, resourceID, environmentID := createReleasePrerequisites(
		t, workspaceID, conn)

	tx, err := conn.Begin(t.Context())
	if err != nil {
		t.Fatalf("failed to begin tx: %v", err)
	}
	defer tx.Rollback(t.Context())

	// Create a release with complex variables
	release := &oapi.Release{
		ReleaseTarget: oapi.ReleaseTarget{
			ResourceId:    resourceID,
			EnvironmentId: environmentID,
			DeploymentId:  deploymentID,
		},
		Version: oapi.DeploymentVersion{
			Id:           versionID,
			Name:         fmt.Sprintf("version-%s", versionID[:8]),
			Tag:          "v1.0.0",
			DeploymentId: deploymentID,
			Status:       oapi.DeploymentVersionStatusReady,
		},
		Variables: map[string]oapi.LiteralValue{
			"STRING_VAR": stringLiteral("value"),
			"NUMBER_VAR": numberLiteral(42.0),
			"BOOL_VAR":   boolLiteral(true),
			"OBJECT_VAR": objectLiteral(map[string]interface{}{
				"nested_key": "nested_value",
			}),
		},
	}

	err = writeRelease(t.Context(), release, workspaceID, tx)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	err = tx.Commit(t.Context())
	if err != nil {
		t.Fatalf("failed to commit: %v", err)
	}

	// Verify release was created
	actualReleases, err := getReleases(t.Context(), workspaceID)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	validateRetrievedReleases(t, actualReleases, []*oapi.Release{release})

	// Keep systemID to avoid "declared but not used" error
	_ = systemID
}

func TestDBReleases_SameTargetDifferentVersions(t *testing.T) {
	workspaceID, conn := setupTestWithWorkspace(t)

	systemID, deploymentID, versionID1, resourceID, environmentID := createReleasePrerequisites(
		t, workspaceID, conn)

	// Create a second version
	tx, err := conn.Begin(t.Context())
	if err != nil {
		t.Fatalf("failed to begin tx: %v", err)
	}
	defer tx.Rollback(t.Context())

	versionID2 := uuid.New().String()
	version2 := &oapi.DeploymentVersion{
		Id:             versionID2,
		Name:           fmt.Sprintf("version-%s", versionID2[:8]),
		Tag:            "v2.0.0",
		DeploymentId:   deploymentID,
		Status:         oapi.DeploymentVersionStatusReady,
		Config:         map[string]interface{}{"image": "nginx:v2"},
		JobAgentConfig: map[string]interface{}{},
	}
	if err := writeDeploymentVersion(t.Context(), version2, tx); err != nil {
		t.Fatalf("failed to create deployment version 2: %v", err)
	}

	err = tx.Commit(t.Context())
	if err != nil {
		t.Fatalf("failed to commit: %v", err)
	}

	// Create first release
	tx, err = conn.Begin(t.Context())
	if err != nil {
		t.Fatalf("failed to begin tx: %v", err)
	}
	defer tx.Rollback(t.Context())

	release1 := &oapi.Release{
		ReleaseTarget: oapi.ReleaseTarget{
			ResourceId:    resourceID,
			EnvironmentId: environmentID,
			DeploymentId:  deploymentID,
		},
		Version: oapi.DeploymentVersion{
			Id:           versionID1,
			Name:         fmt.Sprintf("version-%s", versionID1[:8]),
			Tag:          "v1.0.0",
			DeploymentId: deploymentID,
			Status:       oapi.DeploymentVersionStatusReady,
		},
		Variables: map[string]oapi.LiteralValue{
			"ENV": stringLiteral("staging"),
		},
	}

	err = writeRelease(t.Context(), release1, workspaceID, tx)
	if err != nil {
		t.Fatalf("expected no errors writing release 1, got %v", err)
	}

	err = tx.Commit(t.Context())
	if err != nil {
		t.Fatalf("failed to commit: %v", err)
	}

	// Create second release with same target but different version
	tx, err = conn.Begin(t.Context())
	if err != nil {
		t.Fatalf("failed to begin tx: %v", err)
	}
	defer tx.Rollback(t.Context())

	release2 := &oapi.Release{
		ReleaseTarget: oapi.ReleaseTarget{
			ResourceId:    resourceID,
			EnvironmentId: environmentID,
			DeploymentId:  deploymentID,
		},
		Version: oapi.DeploymentVersion{
			Id:           versionID2,
			Name:         fmt.Sprintf("version-%s", versionID2[:8]),
			Tag:          "v2.0.0",
			DeploymentId: deploymentID,
			Status:       oapi.DeploymentVersionStatusReady,
		},
		Variables: map[string]oapi.LiteralValue{
			"ENV": stringLiteral("production"),
		},
	}

	err = writeRelease(t.Context(), release2, workspaceID, tx)
	if err != nil {
		t.Fatalf("expected no errors writing release 2, got %v", err)
	}

	err = tx.Commit(t.Context())
	if err != nil {
		t.Fatalf("failed to commit: %v", err)
	}

	// Verify both releases exist
	actualReleases, err := getReleases(t.Context(), workspaceID)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	validateRetrievedReleases(t, actualReleases, []*oapi.Release{release1, release2})

	// Keep systemID to avoid "declared but not used" error
	_ = systemID
}

func TestDBReleases_WriteSameReleaseTwiceCreatesDuplicates(t *testing.T) {
	workspaceID, conn := setupTestWithWorkspace(t)

	systemID, deploymentID, versionID, resourceID, environmentID := createReleasePrerequisites(
		t, workspaceID, conn)

	// Create a release
	tx, err := conn.Begin(t.Context())
	if err != nil {
		t.Fatalf("failed to begin tx: %v", err)
	}
	defer tx.Rollback(t.Context())

	release := &oapi.Release{
		ReleaseTarget: oapi.ReleaseTarget{
			ResourceId:    resourceID,
			EnvironmentId: environmentID,
			DeploymentId:  deploymentID,
		},
		Version: oapi.DeploymentVersion{
			Id:           versionID,
			Name:         fmt.Sprintf("version-%s", versionID[:8]),
			Tag:          "v1.0.0",
			DeploymentId: deploymentID,
			Status:       oapi.DeploymentVersionStatusReady,
		},
		Variables: map[string]oapi.LiteralValue{
			"ENV": stringLiteral("production"),
		},
	}

	err = writeRelease(t.Context(), release, workspaceID, tx)
	if err != nil {
		t.Fatalf("expected no errors on first write, got %v", err)
	}

	err = tx.Commit(t.Context())
	if err != nil {
		t.Fatalf("failed to commit: %v", err)
	}

	// Write the exact same release again
	tx, err = conn.Begin(t.Context())
	if err != nil {
		t.Fatalf("failed to begin tx: %v", err)
	}
	defer tx.Rollback(t.Context())

	err = writeRelease(t.Context(), release, workspaceID, tx)
	if err != nil {
		t.Fatalf("expected no errors on second write, got %v", err)
	}

	err = tx.Commit(t.Context())
	if err != nil {
		t.Fatalf("failed to commit: %v", err)
	}

	// Verify two releases exist (duplicates are allowed)
	actualReleases, err := getReleases(t.Context(), workspaceID)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	// Should have 2 releases now since there's no uniqueness constraint
	if len(actualReleases) != 2 {
		t.Fatalf("expected 2 releases (duplicates allowed), got %d", len(actualReleases))
	}

	// Both should have the same data
	validateRetrievedReleases(t, actualReleases, []*oapi.Release{release, release})

	// Keep systemID to avoid "declared but not used" error
	_ = systemID
}

func TestDBReleases_MultipleResourcesSameDeployment(t *testing.T) {
	workspaceID, conn := setupTestWithWorkspace(t)

	systemID, deploymentID, versionID, resourceID1, environmentID := createReleasePrerequisites(
		t, workspaceID, conn)

	// Create a second resource
	tx, err := conn.Begin(t.Context())
	if err != nil {
		t.Fatalf("failed to begin tx: %v", err)
	}
	defer tx.Rollback(t.Context())

	resourceID2 := uuid.New().String()
	resource2 := &oapi.Resource{
		Id:          resourceID2,
		Version:     "v1",
		Name:        fmt.Sprintf("resource-%s", resourceID2[:8]),
		Kind:        "kubernetes.pod",
		Identifier:  fmt.Sprintf("pod-%s", resourceID2[:8]),
		WorkspaceId: workspaceID,
		Config:      map[string]interface{}{},
		Metadata:    map[string]string{},
	}
	if err := writeResource(t.Context(), resource2, tx); err != nil {
		t.Fatalf("failed to create resource 2: %v", err)
	}

	// Create release target for second resource
	_, err = tx.Exec(t.Context(),
		"INSERT INTO release_target (resource_id, environment_id, deployment_id) VALUES ($1, $2, $3)",
		resourceID2, environmentID, deploymentID)
	if err != nil {
		t.Fatalf("failed to create release target 2: %v", err)
	}

	err = tx.Commit(t.Context())
	if err != nil {
		t.Fatalf("failed to commit: %v", err)
	}

	// Create releases for both resources
	tx, err = conn.Begin(t.Context())
	if err != nil {
		t.Fatalf("failed to begin tx: %v", err)
	}
	defer tx.Rollback(t.Context())

	release1 := &oapi.Release{
		ReleaseTarget: oapi.ReleaseTarget{
			ResourceId:    resourceID1,
			EnvironmentId: environmentID,
			DeploymentId:  deploymentID,
		},
		Version: oapi.DeploymentVersion{
			Id:           versionID,
			Name:         fmt.Sprintf("version-%s", versionID[:8]),
			Tag:          "v1.0.0",
			DeploymentId: deploymentID,
			Status:       oapi.DeploymentVersionStatusReady,
		},
		Variables: map[string]oapi.LiteralValue{
			"RESOURCE": stringLiteral("resource1"),
		},
	}

	release2 := &oapi.Release{
		ReleaseTarget: oapi.ReleaseTarget{
			ResourceId:    resourceID2,
			EnvironmentId: environmentID,
			DeploymentId:  deploymentID,
		},
		Version: oapi.DeploymentVersion{
			Id:           versionID,
			Name:         fmt.Sprintf("version-%s", versionID[:8]),
			Tag:          "v1.0.0",
			DeploymentId: deploymentID,
			Status:       oapi.DeploymentVersionStatusReady,
		},
		Variables: map[string]oapi.LiteralValue{
			"RESOURCE": stringLiteral("resource2"),
		},
	}

	err = writeRelease(t.Context(), release1, workspaceID, tx)
	if err != nil {
		t.Fatalf("expected no errors writing release 1, got %v", err)
	}

	err = writeRelease(t.Context(), release2, workspaceID, tx)
	if err != nil {
		t.Fatalf("expected no errors writing release 2, got %v", err)
	}

	err = tx.Commit(t.Context())
	if err != nil {
		t.Fatalf("failed to commit: %v", err)
	}

	// Verify both releases exist
	actualReleases, err := getReleases(t.Context(), workspaceID)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	validateRetrievedReleases(t, actualReleases, []*oapi.Release{release1, release2})

	// Keep systemID to avoid "declared but not used" error
	_ = systemID
}

func TestDBReleases_WorkspaceIsolation(t *testing.T) {
	workspaceID1, conn1 := setupTestWithWorkspace(t)
	workspaceID2, conn2 := setupTestWithWorkspace(t)

	// Create prerequisites in workspace 1
	_, deploymentID1, versionID1, resourceID1, environmentID1 := createReleasePrerequisites(
		t, workspaceID1, conn1)

	// Create prerequisites in workspace 2
	_, deploymentID2, versionID2, resourceID2, environmentID2 := createReleasePrerequisites(
		t, workspaceID2, conn2)

	// Create release in workspace 1
	tx1, err := conn1.Begin(t.Context())
	if err != nil {
		t.Fatalf("failed to begin tx1: %v", err)
	}
	defer tx1.Rollback(t.Context())

	release1 := &oapi.Release{
		ReleaseTarget: oapi.ReleaseTarget{
			ResourceId:    resourceID1,
			EnvironmentId: environmentID1,
			DeploymentId:  deploymentID1,
		},
		Version: oapi.DeploymentVersion{
			Id:           versionID1,
			Name:         fmt.Sprintf("version-%s", versionID1[:8]),
			Tag:          "v1.0.0",
			DeploymentId: deploymentID1,
			Status:       oapi.DeploymentVersionStatusReady,
		},
		Variables: map[string]oapi.LiteralValue{
			"WORKSPACE": stringLiteral("workspace1"),
		},
	}

	err = writeRelease(t.Context(), release1, workspaceID1, tx1)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	err = tx1.Commit(t.Context())
	if err != nil {
		t.Fatalf("failed to commit tx1: %v", err)
	}

	// Create release in workspace 2
	tx2, err := conn2.Begin(t.Context())
	if err != nil {
		t.Fatalf("failed to begin tx2: %v", err)
	}
	defer tx2.Rollback(t.Context())

	release2 := &oapi.Release{
		ReleaseTarget: oapi.ReleaseTarget{
			ResourceId:    resourceID2,
			EnvironmentId: environmentID2,
			DeploymentId:  deploymentID2,
		},
		Version: oapi.DeploymentVersion{
			Id:           versionID2,
			Name:         fmt.Sprintf("version-%s", versionID2[:8]),
			Tag:          "v1.0.0",
			DeploymentId: deploymentID2,
			Status:       oapi.DeploymentVersionStatusReady,
		},
		Variables: map[string]oapi.LiteralValue{
			"WORKSPACE": stringLiteral("workspace2"),
		},
	}

	err = writeRelease(t.Context(), release2, workspaceID2, tx2)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	err = tx2.Commit(t.Context())
	if err != nil {
		t.Fatalf("failed to commit tx2: %v", err)
	}

	// Verify workspace 1 only sees its own release
	releases1, err := getReleases(t.Context(), workspaceID1)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}
	if len(releases1) != 1 {
		t.Fatalf("expected 1 release in workspace 1, got %d", len(releases1))
	}
	workspaceValue, _ := releases1[0].Variables["WORKSPACE"].AsStringValue()
	if workspaceValue != "workspace1" {
		t.Fatalf("expected workspace1 release, got %v", workspaceValue)
	}

	// Verify workspace 2 only sees its own release
	releases2, err := getReleases(t.Context(), workspaceID2)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}
	if len(releases2) != 1 {
		t.Fatalf("expected 1 release in workspace 2, got %d", len(releases2))
	}
	workspaceValue2, _ := releases2[0].Variables["WORKSPACE"].AsStringValue()
	if workspaceValue2 != "workspace2" {
		t.Fatalf("expected workspace2 release, got %v", workspaceValue2)
	}
}

func TestDBReleases_NonexistentReleaseTargetThrowsError(t *testing.T) {
	workspaceID, conn := setupTestWithWorkspace(t)

	systemID, deploymentID, versionID, _, _ := createReleasePrerequisites(
		t, workspaceID, conn)

	tx, err := conn.Begin(t.Context())
	if err != nil {
		t.Fatalf("failed to begin tx: %v", err)
	}
	defer tx.Rollback(t.Context())

	// Try to create a release with non-existent release target
	release := &oapi.Release{
		ReleaseTarget: oapi.ReleaseTarget{
			ResourceId:    uuid.New().String(), // Non-existent
			EnvironmentId: uuid.New().String(), // Non-existent
			DeploymentId:  deploymentID,
		},
		Version: oapi.DeploymentVersion{
			Id:           versionID,
			Name:         fmt.Sprintf("version-%s", versionID[:8]),
			Tag:          "v1.0.0",
			DeploymentId: deploymentID,
			Status:       oapi.DeploymentVersionStatusReady,
		},
		Variables: map[string]oapi.LiteralValue{},
	}

	err = writeRelease(t.Context(), release, workspaceID, tx)
	if err == nil {
		t.Fatalf("expected error for non-existent release target, got nil")
	}

	// Keep systemID to avoid "declared but not used" error
	_ = systemID
}

func TestDBReleases_VariableValueSnapshot_Deduplication(t *testing.T) {
	workspaceID, conn := setupTestWithWorkspace(t)

	systemID, deploymentID, versionID1, resourceID1, environmentID := createReleasePrerequisites(
		t, workspaceID, conn)

	// Create a second version and resource
	tx, err := conn.Begin(t.Context())
	if err != nil {
		t.Fatalf("failed to begin tx: %v", err)
	}
	defer tx.Rollback(t.Context())

	versionID2 := uuid.New().String()
	version2 := &oapi.DeploymentVersion{
		Id:             versionID2,
		Name:           fmt.Sprintf("version-%s", versionID2[:8]),
		Tag:            "v2.0.0",
		DeploymentId:   deploymentID,
		Status:         oapi.DeploymentVersionStatusReady,
		Config:         map[string]interface{}{"image": "nginx:v2"},
		JobAgentConfig: map[string]interface{}{},
	}
	if err := writeDeploymentVersion(t.Context(), version2, tx); err != nil {
		t.Fatalf("failed to create deployment version 2: %v", err)
	}

	resourceID2 := uuid.New().String()
	resource2 := &oapi.Resource{
		Id:          resourceID2,
		Version:     "v1",
		Name:        fmt.Sprintf("resource-%s", resourceID2[:8]),
		Kind:        "kubernetes.pod",
		Identifier:  fmt.Sprintf("pod-%s", resourceID2[:8]),
		WorkspaceId: workspaceID,
		Config:      map[string]interface{}{},
		Metadata:    map[string]string{},
	}
	if err := writeResource(t.Context(), resource2, tx); err != nil {
		t.Fatalf("failed to create resource 2: %v", err)
	}

	// Create release target for second resource
	_, err = tx.Exec(t.Context(),
		"INSERT INTO release_target (resource_id, environment_id, deployment_id) VALUES ($1, $2, $3)",
		resourceID2, environmentID, deploymentID)
	if err != nil {
		t.Fatalf("failed to create release target 2: %v", err)
	}

	err = tx.Commit(t.Context())
	if err != nil {
		t.Fatalf("failed to commit: %v", err)
	}

	// Create two releases with same variable values (should deduplicate snapshots)
	tx, err = conn.Begin(t.Context())
	if err != nil {
		t.Fatalf("failed to begin tx: %v", err)
	}
	defer tx.Rollback(t.Context())

	sharedVariables := map[string]oapi.LiteralValue{
		"ENV":      stringLiteral("production"),
		"REPLICAS": numberLiteral(3.0),
	}

	release1 := &oapi.Release{
		ReleaseTarget: oapi.ReleaseTarget{
			ResourceId:    resourceID1,
			EnvironmentId: environmentID,
			DeploymentId:  deploymentID,
		},
		Version: oapi.DeploymentVersion{
			Id:           versionID1,
			Name:         fmt.Sprintf("version-%s", versionID1[:8]),
			Tag:          "v1.0.0",
			DeploymentId: deploymentID,
			Status:       oapi.DeploymentVersionStatusReady,
		},
		Variables: sharedVariables,
	}

	release2 := &oapi.Release{
		ReleaseTarget: oapi.ReleaseTarget{
			ResourceId:    resourceID2,
			EnvironmentId: environmentID,
			DeploymentId:  deploymentID,
		},
		Version: oapi.DeploymentVersion{
			Id:           versionID2,
			Name:         fmt.Sprintf("version-%s", versionID2[:8]),
			Tag:          "v2.0.0",
			DeploymentId: deploymentID,
			Status:       oapi.DeploymentVersionStatusReady,
		},
		Variables: sharedVariables,
	}

	err = writeRelease(t.Context(), release1, workspaceID, tx)
	if err != nil {
		t.Fatalf("expected no errors writing release 1, got %v", err)
	}

	err = writeRelease(t.Context(), release2, workspaceID, tx)
	if err != nil {
		t.Fatalf("expected no errors writing release 2, got %v", err)
	}

	err = tx.Commit(t.Context())
	if err != nil {
		t.Fatalf("failed to commit: %v", err)
	}

	// Count variable_value_snapshots - should be deduplicated
	var snapshotCount int
	err = conn.QueryRow(t.Context(),
		"SELECT COUNT(DISTINCT id) FROM variable_value_snapshot WHERE workspace_id = $1",
		workspaceID).Scan(&snapshotCount)
	if err != nil {
		t.Fatalf("failed to count snapshots: %v", err)
	}

	// We expect 2 unique snapshots (one for "ENV" and one for "REPLICAS")
	// even though they're used in 2 different releases
	if snapshotCount != 2 {
		t.Fatalf("expected 2 deduplicated variable snapshots, got %d", snapshotCount)
	}

	// Verify both releases exist and have correct variables
	actualReleases, err := getReleases(t.Context(), workspaceID)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	validateRetrievedReleases(t, actualReleases, []*oapi.Release{release1, release2})

	// Keep systemID to avoid "declared but not used" error
	_ = systemID
}
