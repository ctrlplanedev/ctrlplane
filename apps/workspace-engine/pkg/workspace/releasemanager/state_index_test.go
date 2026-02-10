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
// StateIndex.Get — lazy registration
// --------------------------------------------------------------------------

// TestStateIndex_Get_LazilyRegistersUnknownEntity verifies that Get returns a
// valid (non-nil) ReleaseTargetState even when the release target was never
// registered via AddReleaseTarget. This is the critical path for release
// targets loaded from persistence.
func TestStateIndex_Get_LazilyRegistersUnknownEntity(t *testing.T) {
	manager, _ := setupTestManager(t)
	ctx := context.Background()
	rt := seedStoreWithReleaseTarget(t, manager)

	// Confirm the entity is NOT in the state index yet.
	assert.False(t, manager.stateIndex.isComputed(*rt),
		"entity should not be computed before Get is called")

	// Call Get — should lazily register + compute.
	state := manager.stateIndex.Get(ctx, *rt)

	require.NotNil(t, state,
		"Get must return a non-nil state even for a previously-unregistered entity")

	// After Get, the entity should be registered.
	assert.True(t, manager.stateIndex.isComputed(*rt),
		"entity should be computed after Get")
}

// TestStateIndex_Get_ReturnsDataForUnregisteredEntityWithJob verifies that
// Get correctly computes and returns LatestJob for an unregistered entity
// when jobs exist in the store.
func TestStateIndex_Get_ReturnsDataForUnregisteredEntityWithJob(t *testing.T) {
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

	// Do NOT register the entity — simulate persistence load.
	state := manager.stateIndex.Get(ctx, *rt)

	require.NotNil(t, state)
	require.NotNil(t, state.LatestJob,
		"LatestJob should be populated for unregistered entity when a job exists in the store")
	assert.Equal(t, oapi.JobStatusSuccessful, state.LatestJob.Job.Status)
	assert.Equal(t, job.Id, state.LatestJob.Job.Id)
}

// TestStateIndex_Get_SkipsRegistrationForKnownEntity confirms that Get does
// NOT re-register an entity that was already registered through the normal
// ProcessChanges path.
func TestStateIndex_Get_SkipsRegistrationForKnownEntity(t *testing.T) {
	manager, _ := setupTestManager(t)
	ctx := context.Background()
	rt := seedStoreWithReleaseTarget(t, manager)

	// Register normally (like ProcessChanges would).
	manager.stateIndex.AddReleaseTarget(*rt)
	manager.stateIndex.Recompute(ctx)

	assert.True(t, manager.stateIndex.isComputed(*rt))

	// Calling Get should return immediately without re-registering.
	state := manager.stateIndex.Get(ctx, *rt)
	require.NotNil(t, state)
}

// --------------------------------------------------------------------------
// GetReleaseTargetState — public API used by OpenAPI endpoints
// --------------------------------------------------------------------------

// TestGetReleaseTargetState_WorksForUnregisteredEntity verifies the Manager's
// public GetReleaseTargetState method (called by every OpenAPI endpoint) works
// for release targets that were never registered in the state index.
func TestGetReleaseTargetState_WorksForUnregisteredEntity(t *testing.T) {
	manager, _ := setupTestManager(t)
	ctx := context.Background()
	rt := seedStoreWithReleaseTarget(t, manager)

	// Do NOT register. Call the public API directly.
	state, err := manager.GetReleaseTargetState(ctx, rt)
	require.NoError(t, err)
	require.NotNil(t, state,
		"GetReleaseTargetState must return a non-nil state for an unregistered entity")
}

// --------------------------------------------------------------------------
// RecomputeEntity — used by the BypassCache endpoint param
// --------------------------------------------------------------------------

// TestRecomputeEntity_WorksForUnregisteredEntity verifies that
// RecomputeEntity (used by the ?bypassCache=true endpoint parameter) works
// even when the entity was never registered.
func TestRecomputeEntity_WorksForUnregisteredEntity(t *testing.T) {
	manager, testStore := setupTestManager(t)
	ctx := context.Background()
	rt := seedStoreWithReleaseTarget(t, manager)

	// Add a job so we can verify the recompute picked it up.
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

	// Do NOT register. Call RecomputeEntity (the BypassCache path).
	manager.stateIndex.RecomputeEntity(ctx, *rt)

	// Verify the entity is now registered and has data.
	assert.True(t, manager.stateIndex.isComputed(*rt))

	state := manager.stateIndex.Get(ctx, *rt)
	require.NotNil(t, state)
	require.NotNil(t, state.LatestJob,
		"LatestJob should be populated after RecomputeEntity")
	assert.Equal(t, job.Id, state.LatestJob.Job.Id)
}

// TestRecomputeEntity_RefreshesRegisteredEntity verifies that
// RecomputeEntity forces fresh data even when the entity is already
// registered (normal bypass-cache behaviour).
func TestRecomputeEntity_RefreshesRegisteredEntity(t *testing.T) {
	manager, testStore := setupTestManager(t)
	ctx := context.Background()
	rt := seedStoreWithReleaseTarget(t, manager)

	// Register normally — no jobs yet.
	manager.stateIndex.AddReleaseTarget(*rt)
	manager.stateIndex.Recompute(ctx)

	state := manager.stateIndex.Get(ctx, *rt)
	require.NotNil(t, state)
	assert.Nil(t, state.LatestJob, "no jobs yet")

	// Now add a job to the store.
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

	state = manager.stateIndex.Get(ctx, *rt)
	require.NotNil(t, state)
	require.NotNil(t, state.LatestJob,
		"LatestJob should appear after RecomputeEntity refreshes a registered entity")
	assert.Equal(t, job.Id, state.LatestJob.Job.Id)
}
