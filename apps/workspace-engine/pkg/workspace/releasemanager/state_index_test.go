package releasemanager

import (
	"context"
	"testing"
	"time"
	"workspace-engine/pkg/oapi"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// seedStoreWithReleaseTarget puts a release target and its supporting entities
// (environment, deployment, resource) into the store WITHOUT registering
// anything in the state index.  This simulates a persistence-restore scenario.
func seedStoreWithReleaseTarget(t *testing.T, m *Manager) *oapi.ReleaseTarget {
	t.Helper()
	ctx := context.Background()

	envID := uuid.New().String()
	depID := uuid.New().String()
	resID := uuid.New().String()

	m.store.Environments.Upsert(ctx, &oapi.Environment{Id: envID, Name: "prod"})
	m.store.Deployments.Upsert(ctx, &oapi.Deployment{Id: depID, Name: "api"})
	m.store.Resources.Upsert(ctx, &oapi.Resource{Id: resID, Name: "res-1"})

	rt := &oapi.ReleaseTarget{
		DeploymentId:  depID,
		EnvironmentId: envID,
		ResourceId:    resID,
	}
	_ = m.store.ReleaseTargets.Upsert(ctx, rt)
	return rt
}

// --------------------------------------------------------------------------
// RestoreAll — eager boot-time registration
// --------------------------------------------------------------------------

// TestRestoreAll_RegistersAllTargets verifies that RestoreAll registers every
// release target in the store so that subsequent Get calls succeed.
func TestRestoreAll_RegistersAllTargets(t *testing.T) {
	manager, _ := setupTestManager(t)
	ctx := context.Background()

	rt1 := seedStoreWithReleaseTarget(t, manager)
	rt2 := seedStoreWithReleaseTarget(t, manager)

	// Before RestoreAll, Get returns empty state (no desired/current/latest).
	stateBefore := manager.stateIndex.Get(*rt1)
	require.NotNil(t, stateBefore)
	assert.Nil(t, stateBefore.DesiredRelease)
	assert.Nil(t, stateBefore.CurrentRelease)
	assert.Nil(t, stateBefore.LatestJob)

	// Restore — simulates boot.
	manager.stateIndex.RestoreAll(ctx)

	// After RestoreAll, Get should return valid state for both targets.
	state1 := manager.stateIndex.Get(*rt1)
	require.NotNil(t, state1)

	state2 := manager.stateIndex.Get(*rt2)
	require.NotNil(t, state2)
}

// TestRestoreAll_ComputesLatestJob verifies that RestoreAll correctly computes
// LatestJob for release targets that have jobs in the store.
func TestRestoreAll_ComputesLatestJob(t *testing.T) {
	manager, testStore := setupTestManager(t)
	ctx := context.Background()
	rt := seedStoreWithReleaseTarget(t, manager)

	// Create a release and a job in the store.
	release := &oapi.Release{
		ReleaseTarget: *rt,
		Version: oapi.DeploymentVersion{
			Id:           uuid.New().String(),
			DeploymentId: rt.DeploymentId,
			Tag:          "v1.0.0",
			Status:       oapi.DeploymentVersionStatusReady,
			CreatedAt:    time.Now(),
		},
		Variables: map[string]oapi.LiteralValue{},
	}
	_ = testStore.Releases.Upsert(ctx, release)

	now := time.Now()
	job := &oapi.Job{
		Id:          uuid.New().String(),
		ReleaseId:   release.ID(),
		Status:      oapi.JobStatusSuccessful,
		CreatedAt:   now,
		UpdatedAt:   now,
		CompletedAt: &now,
	}
	testStore.Jobs.Upsert(ctx, job)

	// Simulate boot.
	manager.stateIndex.RestoreAll(ctx)

	state := manager.stateIndex.Get(*rt)
	require.NotNil(t, state)
	require.NotNil(t, state.LatestJob,
		"LatestJob should be populated after RestoreAll when a job exists")
	assert.Equal(t, job.Id, state.LatestJob.Job.Id)
	assert.Equal(t, oapi.JobStatusSuccessful, state.LatestJob.Job.Status)
}

// TestRestoreAll_Idempotent verifies that calling RestoreAll multiple times
// does not corrupt state.
func TestRestoreAll_Idempotent(t *testing.T) {
	manager, _ := setupTestManager(t)
	ctx := context.Background()
	rt := seedStoreWithReleaseTarget(t, manager)

	manager.stateIndex.RestoreAll(ctx)
	state1 := manager.stateIndex.Get(*rt)

	manager.stateIndex.RestoreAll(ctx)
	state2 := manager.stateIndex.Get(*rt)

	require.NotNil(t, state1)
	require.NotNil(t, state2)
}

// --------------------------------------------------------------------------
// Manager.Restore — integration with the boot sequence
// --------------------------------------------------------------------------

// TestManagerRestore_PopulatesStateIndex verifies that the Manager.Restore
// method (called during boot) populates the state index.
func TestManagerRestore_PopulatesStateIndex(t *testing.T) {
	manager, _ := setupTestManager(t)
	ctx := context.Background()
	rt := seedStoreWithReleaseTarget(t, manager)

	// Simulate the boot sequence: call Restore.
	err := manager.Restore(ctx)
	require.NoError(t, err)

	// The public API should now return a valid state.
	state, err := manager.GetReleaseTargetState(ctx, rt)
	require.NoError(t, err)
	require.NotNil(t, state)
}

// --------------------------------------------------------------------------
// GetReleaseTargetState — public API used by OpenAPI endpoints
// --------------------------------------------------------------------------

// TestGetReleaseTargetState_AfterRestore verifies the Manager's public
// GetReleaseTargetState method works after Restore.
func TestGetReleaseTargetState_AfterRestore(t *testing.T) {
	manager, testStore := setupTestManager(t)
	ctx := context.Background()
	rt := seedStoreWithReleaseTarget(t, manager)

	// Add a job so we can verify state is fully populated.
	release := &oapi.Release{
		ReleaseTarget: *rt,
		Version: oapi.DeploymentVersion{
			Id:           uuid.New().String(),
			DeploymentId: rt.DeploymentId,
			Tag:          "v1.0.0",
			Status:       oapi.DeploymentVersionStatusReady,
			CreatedAt:    time.Now(),
		},
		Variables: map[string]oapi.LiteralValue{},
	}
	_ = testStore.Releases.Upsert(ctx, release)

	now := time.Now()
	job := &oapi.Job{
		Id:        uuid.New().String(),
		ReleaseId: release.ID(),
		Status:    oapi.JobStatusPending,
		CreatedAt: now,
		UpdatedAt: now,
	}
	testStore.Jobs.Upsert(ctx, job)

	// Boot.
	err := manager.Restore(ctx)
	require.NoError(t, err)

	state, err := manager.GetReleaseTargetState(ctx, rt)
	require.NoError(t, err)
	require.NotNil(t, state)
	require.NotNil(t, state.LatestJob)
	assert.Equal(t, job.Id, state.LatestJob.Job.Id)
}

// --------------------------------------------------------------------------
// RecomputeEntity — bypass-cache endpoint
// --------------------------------------------------------------------------

// TestRecomputeEntity_RefreshesAfterRestore verifies that RecomputeEntity
// picks up new data added after boot (the bypass-cache path).
func TestRecomputeEntity_RefreshesAfterRestore(t *testing.T) {
	manager, testStore := setupTestManager(t)
	ctx := context.Background()
	rt := seedStoreWithReleaseTarget(t, manager)

	// Boot — no jobs yet.
	manager.stateIndex.RestoreAll(ctx)

	state := manager.stateIndex.Get(*rt)
	require.NotNil(t, state)
	assert.Nil(t, state.LatestJob, "no jobs yet")

	// Now add a job to the store (simulates a new job arriving after boot).
	release := &oapi.Release{
		ReleaseTarget: *rt,
		Version: oapi.DeploymentVersion{
			Id:           uuid.New().String(),
			DeploymentId: rt.DeploymentId,
			Tag:          "v1.0.0",
			Status:       oapi.DeploymentVersionStatusReady,
			CreatedAt:    time.Now(),
		},
		Variables: map[string]oapi.LiteralValue{},
	}
	_ = testStore.Releases.Upsert(ctx, release)

	now := time.Now()
	job := &oapi.Job{
		Id:        uuid.New().String(),
		ReleaseId: release.ID(),
		Status:    oapi.JobStatusInProgress,
		CreatedAt: now,
		UpdatedAt: now,
	}
	testStore.Jobs.Upsert(ctx, job)

	// RecomputeEntity should refresh the cached state.
	manager.stateIndex.RecomputeEntity(ctx, *rt)

	state = manager.stateIndex.Get(*rt)
	require.NotNil(t, state)
	require.NotNil(t, state.LatestJob,
		"LatestJob should appear after RecomputeEntity refreshes a registered entity")
	assert.Equal(t, job.Id, state.LatestJob.Job.Id)
}
