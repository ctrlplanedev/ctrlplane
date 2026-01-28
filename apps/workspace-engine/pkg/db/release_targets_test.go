package db

import (
	"testing"
	"workspace-engine/pkg/oapi"

	"github.com/google/uuid"
)

// TestReleaseTarget_WriteAndDelete tests that we can
// create and delete release targets using their natural key
func TestReleaseTarget_WriteAndDelete(t *testing.T) {
	workspaceID, conn := setupTestWithWorkspace(t)
	ctx := t.Context()

	// Create prerequisites (note: createReleasePrerequisites already creates a release target)
	systemID, deploymentID, _, resourceID, environmentID := createReleasePrerequisites(
		t, workspaceID, conn)

	// Verify the release target exists (created by createReleasePrerequisites)
	var count int
	err := conn.QueryRow(ctx,
		"SELECT COUNT(*) FROM release_target WHERE resource_id = $1 AND environment_id = $2 AND deployment_id = $3",
		resourceID, environmentID, deploymentID).Scan(&count)
	if err != nil {
		t.Fatalf("failed to query release target: %v", err)
	}

	if count != 1 {
		t.Fatalf("expected 1 release target, got %d", count)
	}

	// Delete the release target using only its natural key (resource_id, environment_id, deployment_id)
	releaseTarget := &oapi.ReleaseTarget{
		ResourceId:    resourceID,
		EnvironmentId: environmentID,
		DeploymentId:  deploymentID,
	}

	tx, err := conn.Begin(ctx)
	if err != nil {
		t.Fatalf("failed to begin tx for deletion: %v", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	err = deleteReleaseTarget(ctx, releaseTarget, tx)
	if err != nil {
		t.Fatalf("failed to delete release target: %v", err)
	}

	err = tx.Commit(ctx)
	if err != nil {
		t.Fatalf("failed to commit deletion tx: %v", err)
	}

	// Verify the release target was deleted
	err = conn.QueryRow(ctx,
		"SELECT COUNT(*) FROM release_target WHERE resource_id = $1 AND environment_id = $2 AND deployment_id = $3",
		resourceID, environmentID, deploymentID).Scan(&count)
	if err != nil {
		t.Fatalf("failed to query release target after deletion: %v", err)
	}

	if count != 0 {
		t.Fatalf("expected 0 release targets after deletion, got %d", count)
	}

	// Keep systemID to avoid "declared but not used" error
	_ = systemID
}

// TestReleaseTarget_MultipleWritesAndDeletes tests that we can write and
// delete the same release target multiple times
func TestReleaseTarget_MultipleWritesAndDeletes(t *testing.T) {
	workspaceID, conn := setupTestWithWorkspace(t)
	ctx := t.Context()

	// Create prerequisites (but delete the automatically created release target)
	systemID, deploymentID, _, resourceID, environmentID := createReleasePrerequisites(
		t, workspaceID, conn)

	releaseTarget := &oapi.ReleaseTarget{
		ResourceId:    resourceID,
		EnvironmentId: environmentID,
		DeploymentId:  deploymentID,
	}

	// First, delete the release target created by createReleasePrerequisites
	tx, err := conn.Begin(ctx)
	if err != nil {
		t.Fatalf("failed to begin initial delete tx: %v", err)
	}

	err = deleteReleaseTarget(ctx, releaseTarget, tx)
	if err != nil {
		_ = tx.Rollback(ctx)
		t.Fatalf("failed to delete initial release target: %v", err)
	}

	err = tx.Commit(ctx)
	if err != nil {
		t.Fatalf("failed to commit initial delete tx: %v", err)
	}

	// Write, delete, write, delete multiple times
	for i := 0; i < 3; i++ {
		// Write
		tx, err := conn.Begin(ctx)
		if err != nil {
			t.Fatalf("iteration %d: failed to begin write tx: %v", i, err)
		}

		err = writeReleaseTarget(ctx, releaseTarget, tx)
		if err != nil {
			_ = tx.Rollback(ctx)
			t.Fatalf("iteration %d: failed to write release target: %v", i, err)
		}

		err = tx.Commit(ctx)
		if err != nil {
			t.Fatalf("iteration %d: failed to commit write tx: %v", i, err)
		}

		// Verify it exists
		var count int
		err = conn.QueryRow(ctx,
			"SELECT COUNT(*) FROM release_target WHERE resource_id = $1 AND environment_id = $2 AND deployment_id = $3",
			resourceID, environmentID, deploymentID).Scan(&count)
		if err != nil {
			t.Fatalf("iteration %d: failed to query release target: %v", i, err)
		}

		if count != 1 {
			t.Fatalf("iteration %d: expected 1 release target after write, got %d", i, count)
		}

		// Delete
		tx, err = conn.Begin(ctx)
		if err != nil {
			t.Fatalf("iteration %d: failed to begin delete tx: %v", i, err)
		}

		err = deleteReleaseTarget(ctx, releaseTarget, tx)
		if err != nil {
			_ = tx.Rollback(ctx)
			t.Fatalf("iteration %d: failed to delete release target: %v", i, err)
		}

		err = tx.Commit(ctx)
		if err != nil {
			t.Fatalf("iteration %d: failed to commit delete tx: %v", i, err)
		}

		// Verify it's deleted
		err = conn.QueryRow(ctx,
			"SELECT COUNT(*) FROM release_target WHERE resource_id = $1 AND environment_id = $2 AND deployment_id = $3",
			resourceID, environmentID, deploymentID).Scan(&count)
		if err != nil {
			t.Fatalf("iteration %d: failed to query release target after deletion: %v", i, err)
		}

		if count != 0 {
			t.Fatalf("iteration %d: expected 0 release targets after deletion, got %d", i, count)
		}
	}

	// Keep systemID to avoid "declared but not used" error
	_ = systemID
}

// TestReleaseTarget_WriteIsIdempotent tests that writing the same
// release target multiple times is idempotent (succeeds without error due to ON CONFLICT DO NOTHING)
func TestReleaseTarget_WriteIsIdempotent(t *testing.T) {
	workspaceID, conn := setupTestWithWorkspace(t)
	ctx := t.Context()

	// Create prerequisites (but delete the automatically created release target)
	systemID, deploymentID, _, resourceID, environmentID := createReleasePrerequisites(
		t, workspaceID, conn)

	releaseTarget := &oapi.ReleaseTarget{
		ResourceId:    resourceID,
		EnvironmentId: environmentID,
		DeploymentId:  deploymentID,
	}

	// First, delete the release target created by createReleasePrerequisites
	tx, err := conn.Begin(ctx)
	if err != nil {
		t.Fatalf("failed to begin initial delete tx: %v", err)
	}

	err = deleteReleaseTarget(ctx, releaseTarget, tx)
	if err != nil {
		_ = tx.Rollback(ctx)
		t.Fatalf("failed to delete initial release target: %v", err)
	}

	err = tx.Commit(ctx)
	if err != nil {
		t.Fatalf("failed to commit initial delete tx: %v", err)
	}

	// Write the release target
	tx, err = conn.Begin(ctx)
	if err != nil {
		t.Fatalf("failed to begin tx: %v", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	err = writeReleaseTarget(ctx, releaseTarget, tx)
	if err != nil {
		t.Fatalf("failed to write release target first time: %v", err)
	}

	// Write the same release target multiple times - should succeed due to ON CONFLICT DO NOTHING
	for i := 0; i < 3; i++ {
		err = writeReleaseTarget(ctx, releaseTarget, tx)
		if err != nil {
			t.Fatalf("iteration %d: expected idempotent write to succeed, got error: %v", i, err)
		}
	}

	err = tx.Commit(ctx)
	if err != nil {
		t.Fatalf("failed to commit tx: %v", err)
	}

	// Verify only one release target exists despite multiple writes
	var count int
	err = conn.QueryRow(ctx,
		"SELECT COUNT(*) FROM release_target WHERE resource_id = $1 AND environment_id = $2 AND deployment_id = $3",
		resourceID, environmentID, deploymentID).Scan(&count)
	if err != nil {
		t.Fatalf("failed to query release target: %v", err)
	}

	if count != 1 {
		t.Fatalf("expected 1 release target after multiple idempotent writes, got %d", count)
	}

	// Keep systemID to avoid "declared but not used" error
	_ = systemID
}

// TestReleaseTarget_DeleteNonexistent tests that deleting a non-existent
// release target doesn't error (it's idempotent)
func TestReleaseTarget_DeleteNonexistent(t *testing.T) {
	workspaceID, conn := setupTestWithWorkspace(t)
	ctx := t.Context()

	// Create prerequisites
	systemID, deploymentID, _, resourceID, environmentID := createReleasePrerequisites(
		t, workspaceID, conn)

	releaseTarget := &oapi.ReleaseTarget{
		ResourceId:    resourceID,
		EnvironmentId: environmentID,
		DeploymentId:  deploymentID,
	}

	// Delete a release target that was never created
	tx, err := conn.Begin(ctx)
	if err != nil {
		t.Fatalf("failed to begin tx: %v", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	// This should not error, just delete 0 rows
	err = deleteReleaseTarget(ctx, releaseTarget, tx)
	if err != nil {
		t.Fatalf("expected no error deleting non-existent release target, got: %v", err)
	}

	err = tx.Commit(ctx)
	if err != nil {
		t.Fatalf("failed to commit tx: %v", err)
	}

	// Keep systemID to avoid "declared but not used" error
	_ = systemID
}

// TestReleaseTarget_WriteMultipleDifferent tests that we can write
// multiple different release targets
func TestReleaseTarget_WriteMultipleDifferent(t *testing.T) {
	workspaceID, conn := setupTestWithWorkspace(t)
	ctx := t.Context()

	// Create prerequisites for first release target (but delete the automatically created one)
	systemID, deploymentID1, _, resourceID1, environmentID1 := createReleasePrerequisites(
		t, workspaceID, conn)

	// Delete the release target created by createReleasePrerequisites
	releaseTargetToDelete := &oapi.ReleaseTarget{
		ResourceId:    resourceID1,
		EnvironmentId: environmentID1,
		DeploymentId:  deploymentID1,
	}

	tx, err := conn.Begin(ctx)
	if err != nil {
		t.Fatalf("failed to begin initial delete tx: %v", err)
	}

	err = deleteReleaseTarget(ctx, releaseTargetToDelete, tx)
	if err != nil {
		_ = tx.Rollback(ctx)
		t.Fatalf("failed to delete initial release target: %v", err)
	}

	err = tx.Commit(ctx)
	if err != nil {
		t.Fatalf("failed to commit initial delete tx: %v", err)
	}

	// Create a second deployment
	tx, err = conn.Begin(ctx)
	if err != nil {
		t.Fatalf("failed to begin tx: %v", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	deploymentID2 := uuid.New().String()
	deploymentDescription2 := "deployment-2"
	deployment2 := &oapi.Deployment{
		Id:             deploymentID2,
		Name:           "test-deployment-2",
		Slug:           "test-deployment-2",
		SystemId:       systemID,
		Description:    &deploymentDescription2,
		JobAgentConfig: oapi.JobAgentConfig{},
	}
	if err := writeDeployment(ctx, deployment2, tx); err != nil {
		t.Fatalf("failed to create deployment 2: %v", err)
	}

	err = tx.Commit(ctx)
	if err != nil {
		t.Fatalf("failed to commit: %v", err)
	}

	// Create two release targets
	releaseTarget1 := &oapi.ReleaseTarget{
		ResourceId:    resourceID1,
		EnvironmentId: environmentID1,
		DeploymentId:  deploymentID1,
	}

	releaseTarget2 := &oapi.ReleaseTarget{
		ResourceId:    resourceID1,
		EnvironmentId: environmentID1,
		DeploymentId:  deploymentID2,
	}

	// Write both release targets
	tx, err = conn.Begin(ctx)
	if err != nil {
		t.Fatalf("failed to begin tx: %v", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	err = writeReleaseTarget(ctx, releaseTarget1, tx)
	if err != nil {
		t.Fatalf("failed to write release target 1: %v", err)
	}

	err = writeReleaseTarget(ctx, releaseTarget2, tx)
	if err != nil {
		t.Fatalf("failed to write release target 2: %v", err)
	}

	err = tx.Commit(ctx)
	if err != nil {
		t.Fatalf("failed to commit tx: %v", err)
	}

	// Verify both exist
	var count int
	err = conn.QueryRow(ctx,
		"SELECT COUNT(*) FROM release_target WHERE resource_id = $1 AND environment_id = $2",
		resourceID1, environmentID1).Scan(&count)
	if err != nil {
		t.Fatalf("failed to query release targets: %v", err)
	}

	if count != 2 {
		t.Fatalf("expected 2 release targets, got %d", count)
	}

	// Delete one and verify only one remains
	tx, err = conn.Begin(ctx)
	if err != nil {
		t.Fatalf("failed to begin delete tx: %v", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	err = deleteReleaseTarget(ctx, releaseTarget1, tx)
	if err != nil {
		t.Fatalf("failed to delete release target 1: %v", err)
	}

	err = tx.Commit(ctx)
	if err != nil {
		t.Fatalf("failed to commit delete tx: %v", err)
	}

	// Verify only one remains
	err = conn.QueryRow(ctx,
		"SELECT COUNT(*) FROM release_target WHERE resource_id = $1 AND environment_id = $2",
		resourceID1, environmentID1).Scan(&count)
	if err != nil {
		t.Fatalf("failed to query release targets after deletion: %v", err)
	}

	if count != 1 {
		t.Fatalf("expected 1 release target after deletion, got %d", count)
	}

	// Verify the correct one remains
	err = conn.QueryRow(ctx,
		"SELECT COUNT(*) FROM release_target WHERE resource_id = $1 AND environment_id = $2 AND deployment_id = $3",
		resourceID1, environmentID1, deploymentID2).Scan(&count)
	if err != nil {
		t.Fatalf("failed to query release target 2: %v", err)
	}

	if count != 1 {
		t.Fatalf("expected release target 2 to remain, but it doesn't exist")
	}
}
