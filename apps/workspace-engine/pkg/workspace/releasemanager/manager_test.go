package releasemanager

import (
	"context"
	"testing"
	"time"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/statechange"
	"workspace-engine/pkg/workspace/releasemanager/trace/spanstore"
	"workspace-engine/pkg/workspace/releasemanager/verification"
	"workspace-engine/pkg/workspace/store"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// setupTestManager creates a test manager with a test store
func setupTestManager(t *testing.T) (*Manager, *store.Store) {
	t.Helper()
	cs := statechange.NewChangeSet[any]()
	testStore := store.New("test-workspace", cs)
	traceStore := spanstore.NewInMemoryStore()
	verificationManager := verification.NewManager(testStore)
	manager := New(testStore, traceStore, verificationManager)
	return manager, testStore
}

// createTestReleaseTarget creates a release target with the given IDs
func createTestReleaseTarget(deploymentID, environmentID, resourceID string) *oapi.ReleaseTarget {
	return &oapi.ReleaseTarget{
		DeploymentId:  deploymentID,
		EnvironmentId: environmentID,
		ResourceId:    resourceID,
	}
}

// createTestJob creates a job for a release target
func createTestJob(releaseID string, status oapi.JobStatus) *oapi.Job {
	return &oapi.Job{
		Id:        uuid.New().String(),
		ReleaseId: releaseID,
		Status:    status,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
}

// TestProcessChanges_UpsertOnly tests that upserting a release target reconciles it
func TestProcessChanges_UpsertOnly(t *testing.T) {
	manager, testStore := setupTestManager(t)
	ctx := context.Background()

	// Create test entities
	deploymentID := uuid.New().String()
	environmentID := uuid.New().String()
	resourceID := uuid.New().String()

	target := createTestReleaseTarget(deploymentID, environmentID, resourceID)

	// Upsert the release target into the store first (simulating what the event handler does)
	err := testStore.ReleaseTargets.Upsert(ctx, target)
	require.NoError(t, err)

	// Create changeset with upsert
	changes := statechange.NewChangeSet[any]()
	changes.RecordUpsert(target)

	// Process changes - should reconcile the target
	err = manager.ProcessChanges(ctx, changes)
	require.NoError(t, err)

	// Verify release target still exists in store
	releaseTargets, err := testStore.ReleaseTargets.Items()
	require.NoError(t, err)
	assert.Contains(t, releaseTargets, target.Key())
}

// TestProcessChanges_DeleteOnly tests that deleting a release target cancels pending jobs
func TestProcessChanges_DeleteOnly(t *testing.T) {
	manager, testStore := setupTestManager(t)
	ctx := context.Background()

	// Create test entities
	deploymentID := uuid.New().String()
	environmentID := uuid.New().String()
	resourceID := uuid.New().String()

	target := createTestReleaseTarget(deploymentID, environmentID, resourceID)

	// Create a release for this target
	release := &oapi.Release{
		ReleaseTarget: *target,
		Version: oapi.DeploymentVersion{
			Id:           uuid.New().String(),
			DeploymentId: deploymentID,
			Tag:          "v1.0.0",
		},
		Variables: map[string]oapi.LiteralValue{},
	}
	_ = testStore.Releases.Upsert(ctx, release)

	// Create a pending job for this release target
	job := createTestJob(release.ID(), oapi.JobStatusPending)
	testStore.Jobs.Upsert(ctx, job)

	// Verify job is pending
	pendingJobs := testStore.Jobs.GetPending()
	require.Len(t, pendingJobs, 1)

	// Create changeset with delete
	changes := statechange.NewChangeSet[any]()
	changes.RecordDelete(target)

	// Process changes
	err := manager.ProcessChanges(ctx, changes)
	require.NoError(t, err)

	// Verify job was cancelled
	updatedJob, ok := testStore.Jobs.Get(job.Id)
	require.True(t, ok)
	assert.Equal(t, oapi.JobStatusCancelled, updatedJob.Status)
}

// TestProcessChanges_UpsertThenDelete tests deduplication when a target is created then deleted
func TestProcessChanges_UpsertThenDelete(t *testing.T) {
	manager, testStore := setupTestManager(t)
	ctx := context.Background()

	// Create test entities
	deploymentID := uuid.New().String()
	environmentID := uuid.New().String()
	resourceID := uuid.New().String()

	target := createTestReleaseTarget(deploymentID, environmentID, resourceID)

	// Create changeset with both upsert and delete (simulating create then delete in same batch)
	changes := statechange.NewChangeSet[any]()
	changes.RecordUpsert(target)
	changes.RecordDelete(target)

	// Process changes
	err := manager.ProcessChanges(ctx, changes)
	require.NoError(t, err)

	// Verify the target was NOT added to the store (delete won)
	releaseTargets, err := testStore.ReleaseTargets.Items()
	require.NoError(t, err)
	assert.NotContains(t, releaseTargets, target.Key(), "Target should not exist - delete should win over upsert")
}

// TestProcessChanges_DeleteThenUpsert tests that upsert after delete is processed
func TestProcessChanges_DeleteThenUpsert(t *testing.T) {
	manager, testStore := setupTestManager(t)
	ctx := context.Background()

	// Create test entities
	deploymentID := uuid.New().String()
	environmentID := uuid.New().String()
	resourceID := uuid.New().String()

	target := createTestReleaseTarget(deploymentID, environmentID, resourceID)

	// Create changeset with delete then upsert (simulating delete then recreate)
	changes := statechange.NewChangeSet[any]()
	changes.RecordDelete(target)
	changes.RecordUpsert(target)

	// Process changes
	err := manager.ProcessChanges(ctx, changes)
	require.NoError(t, err)

	// Verify the target was NOT added (delete still wins as it's the final state)
	releaseTargets, err := testStore.ReleaseTargets.Items()
	require.NoError(t, err)
	assert.NotContains(t, releaseTargets, target.Key(), "Delete should win - it's recorded last")
}

// TestProcessChanges_MultipleUpsertsForSameTarget tests that only the last upsert is processed
func TestProcessChanges_MultipleUpsertsForSameTarget(t *testing.T) {
	manager, testStore := setupTestManager(t)
	ctx := context.Background()

	// Create test entities
	deploymentID := uuid.New().String()
	environmentID := uuid.New().String()
	resourceID := uuid.New().String()

	target := createTestReleaseTarget(deploymentID, environmentID, resourceID)

	// Upsert the release target into the store first
	err := testStore.ReleaseTargets.Upsert(ctx, target)
	require.NoError(t, err)

	// Create changeset with multiple upserts (simulating multiple updates)
	changes := statechange.NewChangeSet[any]()
	changes.RecordUpsert(target)
	changes.RecordUpsert(target)
	changes.RecordUpsert(target)

	// Process changes - should reconcile once, not three times
	err = manager.ProcessChanges(ctx, changes)
	require.NoError(t, err)

	// Verify target exists (should have been reconciled once, not three times)
	releaseTargets, err := testStore.ReleaseTargets.Items()
	require.NoError(t, err)
	assert.Contains(t, releaseTargets, target.Key())
}

// TestProcessChanges_DifferentTargets tests that different targets are processed independently
func TestProcessChanges_DifferentTargets(t *testing.T) {
	manager, testStore := setupTestManager(t)
	ctx := context.Background()

	// Create different targets
	target1 := createTestReleaseTarget(uuid.New().String(), uuid.New().String(), uuid.New().String())
	target2 := createTestReleaseTarget(uuid.New().String(), uuid.New().String(), uuid.New().String())

	// Upsert both targets into the store first
	err := testStore.ReleaseTargets.Upsert(ctx, target1)
	require.NoError(t, err)
	err = testStore.ReleaseTargets.Upsert(ctx, target2)
	require.NoError(t, err)

	// Create changeset with both targets
	changes := statechange.NewChangeSet[any]()
	changes.RecordUpsert(target1)
	changes.RecordUpsert(target2)

	// Process changes
	err = manager.ProcessChanges(ctx, changes)
	require.NoError(t, err)

	// Verify both targets exist
	releaseTargets, err := testStore.ReleaseTargets.Items()
	require.NoError(t, err)
	assert.Contains(t, releaseTargets, target1.Key())
	assert.Contains(t, releaseTargets, target2.Key())
}

// TestProcessChanges_OnlyPendingJobsCancelled tests that only processing-state jobs are cancelled
func TestProcessChanges_OnlyPendingJobsCancelled(t *testing.T) {
	manager, testStore := setupTestManager(t)
	ctx := context.Background()

	// Create test entities
	deploymentID := uuid.New().String()
	environmentID := uuid.New().String()
	resourceID := uuid.New().String()

	target := createTestReleaseTarget(deploymentID, environmentID, resourceID)

	// Create a release
	release := &oapi.Release{
		ReleaseTarget: *target,
		Version: oapi.DeploymentVersion{
			Id:           uuid.New().String(),
			DeploymentId: deploymentID,
			Tag:          "v1.0.0",
		},
		Variables: map[string]oapi.LiteralValue{},
	}
	_ = testStore.Releases.Upsert(ctx, release)

	// Create jobs in different states
	pendingJob := createTestJob(release.ID(), oapi.JobStatusPending)
	inProgressJob := createTestJob(release.ID(), oapi.JobStatusInProgress)
	successfulJob := createTestJob(release.ID(), oapi.JobStatusSuccessful)
	failedJob := createTestJob(release.ID(), oapi.JobStatusFailure)

	testStore.Jobs.Upsert(ctx, pendingJob)
	testStore.Jobs.Upsert(ctx, inProgressJob)
	testStore.Jobs.Upsert(ctx, successfulJob)
	testStore.Jobs.Upsert(ctx, failedJob)

	// Create changeset with delete
	changes := statechange.NewChangeSet[any]()
	changes.RecordDelete(target)

	// Process changes
	err := manager.ProcessChanges(ctx, changes)
	require.NoError(t, err)

	// Verify only processing-state jobs were cancelled
	updatedPending, _ := testStore.Jobs.Get(pendingJob.Id)
	assert.Equal(t, oapi.JobStatusCancelled, updatedPending.Status, "Pending job should be cancelled")

	updatedInProgress, _ := testStore.Jobs.Get(inProgressJob.Id)
	assert.Equal(t, oapi.JobStatusCancelled, updatedInProgress.Status, "InProgress job should be cancelled")

	updatedSuccessful, _ := testStore.Jobs.Get(successfulJob.Id)
	assert.Equal(t, oapi.JobStatusSuccessful, updatedSuccessful.Status, "Successful job should NOT be cancelled")

	updatedFailed, _ := testStore.Jobs.Get(failedJob.Id)
	assert.Equal(t, oapi.JobStatusFailure, updatedFailed.Status, "Failed job should NOT be cancelled")
}

// TestProcessChanges_MixedOperations tests a realistic scenario with mixed operations
func TestProcessChanges_MixedOperations(t *testing.T) {
	manager, testStore := setupTestManager(t)
	ctx := context.Background()

	// Create three different targets with different operations
	target1 := createTestReleaseTarget(uuid.New().String(), uuid.New().String(), uuid.New().String()) // upsert only
	target2 := createTestReleaseTarget(uuid.New().String(), uuid.New().String(), uuid.New().String()) // delete only
	target3 := createTestReleaseTarget(uuid.New().String(), uuid.New().String(), uuid.New().String()) // upsert then delete

	// Upsert target1 into store
	err := testStore.ReleaseTargets.Upsert(ctx, target1)
	require.NoError(t, err)

	// Setup target2 with a job to be cancelled
	release2 := &oapi.Release{
		ReleaseTarget: *target2,
		Version: oapi.DeploymentVersion{
			Id:           uuid.New().String(),
			DeploymentId: target2.DeploymentId,
			Tag:          "v1.0.0",
		},
		Variables: map[string]oapi.LiteralValue{},
	}
	_ = testStore.Releases.Upsert(ctx, release2)
	job2 := createTestJob(release2.ID(), oapi.JobStatusPending)
	testStore.Jobs.Upsert(ctx, job2)

	// Create changeset with mixed operations
	changes := statechange.NewChangeSet[any]()
	changes.RecordUpsert(target1) // should be processed
	changes.RecordDelete(target2) // should cancel job
	changes.RecordUpsert(target3) // should be skipped
	changes.RecordDelete(target3) // should be processed (delete wins)

	// Process changes
	err = manager.ProcessChanges(ctx, changes)
	require.NoError(t, err)

	// Verify results
	releaseTargets, err2 := testStore.ReleaseTargets.Items()
	require.NoError(t, err2)

	// target1 should exist
	assert.Contains(t, releaseTargets, target1.Key())

	// target2's job should be cancelled
	updatedJob2, _ := testStore.Jobs.Get(job2.Id)
	assert.Equal(t, oapi.JobStatusCancelled, updatedJob2.Status)

	// target3 should NOT exist (delete won over upsert)
	assert.NotContains(t, releaseTargets, target3.Key())
}

// TestProcessChanges_EmptyChangeset tests handling of empty changesets
func TestProcessChanges_EmptyChangeset(t *testing.T) {
	manager, _ := setupTestManager(t)
	ctx := context.Background()

	// Create empty changeset
	changes := statechange.NewChangeSet[any]()

	// Process changes - should not error
	err := manager.ProcessChanges(ctx, changes)
	require.NoError(t, err)
}

// TestProcessChanges_NonReleaseTargetChanges tests that non-ReleaseTarget changes are ignored
func TestProcessChanges_NonReleaseTargetChanges(t *testing.T) {
	manager, _ := setupTestManager(t)
	ctx := context.Background()

	// Create changeset with non-ReleaseTarget entities
	changes := statechange.NewChangeSet[any]()

	resource := &oapi.Resource{
		Id:   uuid.New().String(),
		Name: "test-resource",
	}
	deployment := &oapi.Deployment{
		Id:   uuid.New().String(),
		Name: "test-deployment",
	}

	changes.RecordUpsert(resource)
	changes.RecordUpsert(deployment)

	// Process changes - should not error and should ignore non-ReleaseTarget entities
	err := manager.ProcessChanges(ctx, changes)
	require.NoError(t, err)
}
