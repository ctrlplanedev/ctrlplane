package targets

import (
	"context"
	"sync"
	"testing"
	"workspace-engine/pkg/changeset"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/store"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Helper to extract release targets from changeset by type
func getReleaseTargetsByType(changes *changeset.ChangeSet[*oapi.ReleaseTarget], changeType changeset.ChangeType) []*oapi.ReleaseTarget {
	return changes.Process().FilterByType(changeType).CollectEntities()
}

// setupTestStore creates a store with test data
func setupTestStore(t *testing.T) (*store.Store, string, string, string, string) {
	ctx := context.Background()
	st := store.New()

	workspaceID := uuid.New().String()
	systemID := uuid.New().String()
	environmentID := uuid.New().String()
	deploymentID := uuid.New().String()
	resourceID := uuid.New().String()

	// Create system
	system := createTestSystem(workspaceID, systemID, "test-system")
	if err := st.Systems.Upsert(ctx, system); err != nil {
		t.Fatalf("Failed to upsert system: %v", err)
	}

	// Create environment with selector that matches all resources
	env := createTestEnvironment(environmentID, systemID, "test-environment")
	selector := &oapi.Selector{}
	_ = selector.FromJsonSelector(oapi.JsonSelector{
		Json: map[string]any{
			"type":     "name",
			"operator": "starts-with",
			"value":    "",
		},
	})
	env.ResourceSelector = selector
	if err := st.Environments.Upsert(ctx, env); err != nil {
		t.Fatalf("Failed to upsert environment: %v", err)
	}

	// Create deployment
	deployment := createTestDeployment(deploymentID, systemID, "test-deployment")
	if err := st.Deployments.Upsert(ctx, deployment); err != nil {
		t.Fatalf("Failed to upsert deployment: %v", err)
	}

	// Create resource
	resource := createTestResource(workspaceID, resourceID, "test-resource")
	if _, err := st.Resources.Upsert(ctx, resource); err != nil {
		t.Fatalf("Failed to upsert resource: %v", err)
	}

	// Get release targets (this will wait if recompute is already running)
	// Don't call Recompute() directly as it may already be in progress
	if _, err := st.ReleaseTargets.Items(ctx); err != nil {
		t.Fatalf("Failed to get release targets: %v", err)
	}

	return st, systemID, environmentID, deploymentID, resourceID
}

func TestNew(t *testing.T) {
	st := store.New()
	manager := New(st)

	assert.NotNil(t, manager)
	assert.NotNil(t, manager.store)
	assert.NotNil(t, manager.currentTargets)
}

func TestManager_GetTargets(t *testing.T) {
	ctx := context.Background()
	st, _, environmentID, deploymentID, resourceID := setupTestStore(t)
	manager := New(st)

	// Get targets (should be computed automatically from environment, deployment, and resource)
	targets, err := manager.GetTargets(ctx)
	require.NoError(t, err)
	assert.Len(t, targets, 1)

	// Verify the target has the expected IDs using the standard Key() method
	expectedTarget := createTestReleaseTarget(environmentID, deploymentID, resourceID)
	assert.Contains(t, targets, expectedTarget.Key())
}

func TestManager_GetTargets_Empty(t *testing.T) {
	ctx := context.Background()
	st := store.New()
	manager := New(st)

	// Get targets from empty store
	targets, err := manager.GetTargets(ctx)
	require.NoError(t, err)
	assert.Len(t, targets, 0)
}

func TestManager_DetectChanges_NewTargets(t *testing.T) {
	ctx := context.Background()
	st, _, environmentID, deploymentID, resourceID := setupTestStore(t)
	manager := New(st)

	// Initially no targets
	manager.currentTargets = make(map[string]*oapi.ReleaseTarget)

	// Detect changes with empty changeset (store already has target from setup)
	cs := changeset.NewChangeSet[any]()
	changes, err := manager.DetectChanges(ctx, cs)
	require.NoError(t, err)

	// Should detect the new target as created
	created := getReleaseTargetsByType(changes, changeset.ChangeTypeCreate)

	assert.Len(t, created, 1)
	// Verify the target has the expected IDs
	assert.Equal(t, environmentID, created[0].EnvironmentId)
	assert.Equal(t, deploymentID, created[0].DeploymentId)
	assert.Equal(t, resourceID, created[0].ResourceId)
}

func TestManager_DetectChanges_DeletedTargets(t *testing.T) {
	ctx := context.Background()
	st := store.New()
	manager := New(st)

	// Setup current state with a target
	envID := uuid.New().String()
	depID := uuid.New().String()
	resID := uuid.New().String()
	target := createTestReleaseTarget(envID, depID, resID)
	manager.currentTargets = map[string]*oapi.ReleaseTarget{
		target.Key(): target,
	}

	// Store is now empty (no entities, so no targets computed)

	// Detect changes with empty changeset
	cs := changeset.NewChangeSet[any]()
	changes, err := manager.DetectChanges(ctx, cs)
	require.NoError(t, err)

	// Should detect the target as deleted
	deleted := getReleaseTargetsByType(changes, changeset.ChangeTypeDelete)

	assert.Len(t, deleted, 1)
	assert.Equal(t, target.Key(), deleted[0].Key())
}

func TestManager_DetectChanges_TaintedTargets(t *testing.T) {
	ctx := context.Background()
	st, _, environmentID, deploymentID, resourceID := setupTestStore(t)
	manager := New(st)

	// Get the computed target and set as current
	targets, _ := st.ReleaseTargets.Items(ctx)
	manager.currentTargets = targets

	// Create changeset with an environment change (should taint the target)
	cs := changeset.NewChangeSet[any]()
	env := createTestEnvironment(environmentID, uuid.New().String(), "test-environment")
	cs.Record(changeset.ChangeTypeUpdate, env)

	// Detect changes
	changes, err := manager.DetectChanges(ctx, cs)
	require.NoError(t, err)

	// Should detect the target as tainted
	tainted := getReleaseTargetsByType(changes, changeset.ChangeTypeTaint)

	assert.Len(t, tainted, 1)
	// Verify the target has the expected IDs
	assert.Equal(t, environmentID, tainted[0].EnvironmentId)
	assert.Equal(t, deploymentID, tainted[0].DeploymentId)
	assert.Equal(t, resourceID, tainted[0].ResourceId)
}

func TestManager_DetectChanges_MixedChanges(t *testing.T) {
	ctx := context.Background()
	st, _, environmentID, _, _ := setupTestStore(t)
	manager := New(st)

	// Setup current state with one target
	targets, _ := st.ReleaseTargets.Items(ctx)
	manager.currentTargets = targets

	// Create changeset with environment change (should taint existing target)
	cs := changeset.NewChangeSet[any]()
	env := createTestEnvironment(environmentID, uuid.New().String(), "test-environment")
	cs.Record(changeset.ChangeTypeUpdate, env)

	// Detect changes
	changes, err := manager.DetectChanges(ctx, cs)
	require.NoError(t, err)

	// Check tainted targets (existing target should be tainted by environment change)
	tainted := getReleaseTargetsByType(changes, changeset.ChangeTypeTaint)
	assert.Len(t, tainted, 1, "existing target should be tainted by environment change")

	// Verify it's the correct target
	assert.Equal(t, environmentID, tainted[0].EnvironmentId)
}

func TestManager_RefreshTargets(t *testing.T) {
	ctx := context.Background()
	st, _, environmentID, deploymentID, resourceID := setupTestStore(t)
	manager := New(st)

	// Refresh targets cache (targets are already computed from setup)
	err := manager.RefreshTargets(ctx)
	require.NoError(t, err)

	// Verify currentTargets was updated using the standard Key() method
	assert.Len(t, manager.currentTargets, 1)
	expectedTarget := createTestReleaseTarget(environmentID, deploymentID, resourceID)
	assert.Contains(t, manager.currentTargets, expectedTarget.Key())
}

func TestManager_RefreshTargets_Empty(t *testing.T) {
	ctx := context.Background()
	st := store.New()
	manager := New(st)

	// Refresh with empty store
	err := manager.RefreshTargets(ctx)
	require.NoError(t, err)

	// Verify currentTargets is empty
	assert.Len(t, manager.currentTargets, 0)
}

func TestManager_ConcurrentAccess(t *testing.T) {
	ctx := context.Background()
	st, _, environmentID, _, _ := setupTestStore(t)
	manager := New(st)

	// Get initial targets and set as current
	targets, _ := st.ReleaseTargets.Items(ctx)
	manager.currentTargets = targets

	// Run concurrent operations
	var wg sync.WaitGroup
	numGoroutines := 10

	for i := 0; i < numGoroutines; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()

			// Create changeset
			cs := changeset.NewChangeSet[any]()
			env := createTestEnvironment(environmentID, uuid.New().String(), "test-env")
			cs.Record(changeset.ChangeTypeUpdate, env)

			// Detect changes (this acquires the mutex)
			_, err := manager.DetectChanges(ctx, cs)
			assert.NoError(t, err)
		}()
	}

	for i := 0; i < numGoroutines; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()

			// Refresh targets cache (this acquires the mutex)
			err := manager.RefreshTargets(ctx)
			assert.NoError(t, err)
		}()
	}

	// Wait for all goroutines to complete
	wg.Wait()
}

func TestManager_DetectChanges_WithDeduplication(t *testing.T) {
	ctx := context.Background()
	st, _, environmentID, deploymentID, resourceID := setupTestStore(t)
	manager := New(st)

	// Setup current state with the computed target
	targets, _ := st.ReleaseTargets.Items(ctx)
	manager.currentTargets = targets

	// Create changeset with multiple changes affecting the same target
	cs := changeset.NewChangeSet[any]()
	env := createTestEnvironment(environmentID, uuid.New().String(), "test-environment")
	dep := createTestDeployment(deploymentID, uuid.New().String(), "test-deployment")
	resource := createTestResource(uuid.New().String(), resourceID, "test-resource")

	cs.Record(changeset.ChangeTypeUpdate, env)
	cs.Record(changeset.ChangeTypeUpdate, dep)
	cs.Record(changeset.ChangeTypeUpdate, resource)

	// Detect changes
	changes, err := manager.DetectChanges(ctx, cs)
	require.NoError(t, err)

	// Should have only one tainted entry (deduplicated)
	tainted := getReleaseTargetsByType(changes, changeset.ChangeTypeTaint)

	assert.Len(t, tainted, 1, "target should be deduplicated despite multiple changes")
	// Verify the target has the expected IDs
	assert.Equal(t, environmentID, tainted[0].EnvironmentId)
	assert.Equal(t, deploymentID, tainted[0].DeploymentId)
	assert.Equal(t, resourceID, tainted[0].ResourceId)
}

func TestManager_DetectChanges_PolicyChange_TaintsAll(t *testing.T) {
	ctx := context.Background()
	st, workspaceID, _, _, _ := setupTestStore(t)
	manager := New(st)

	// Setup current state with existing target
	targets, _ := st.ReleaseTargets.Items(ctx)
	manager.currentTargets = targets

	// Create changeset with policy change (should taint all targets)
	cs := changeset.NewChangeSet[any]()
	policy := createTestPolicy(uuid.New().String(), workspaceID, "test-policy")
	cs.Record(changeset.ChangeTypeCreate, policy)

	// Detect changes
	changes, err := manager.DetectChanges(ctx, cs)
	require.NoError(t, err)

	// All targets should be tainted
	tainted := getReleaseTargetsByType(changes, changeset.ChangeTypeTaint)

	assert.Len(t, tainted, 1, "all existing targets should be tainted by policy change")
}

func TestManager_DetectChanges_NoChanges(t *testing.T) {
	ctx := context.Background()
	st, _, _, _, _ := setupTestStore(t)
	manager := New(st)

	// Setup current state with the computed target
	targets, _ := st.ReleaseTargets.Items(ctx)
	manager.currentTargets = targets

	// Create empty changeset
	cs := changeset.NewChangeSet[any]()

	// Detect changes
	changes, err := manager.DetectChanges(ctx, cs)
	require.NoError(t, err)

	// Should have no changes
	allChanges := changes.Process().Collect()
	assert.Len(t, allChanges, 0, "should have no changes with empty changeset and no target changes")
}

func TestManager_DetectChanges_IgnoresIrrelevantChanges(t *testing.T) {
	ctx := context.Background()
	st, _, _, _, _ := setupTestStore(t)
	manager := New(st)

	// Setup current state with the computed target
	targets, _ := st.ReleaseTargets.Items(ctx)
	manager.currentTargets = targets

	// Create changeset with changes to different entities (different env, dep, resource)
	cs := changeset.NewChangeSet[any]()
	differentEnvID := uuid.New().String()
	env := createTestEnvironment(differentEnvID, uuid.New().String(), "different-env")
	cs.Record(changeset.ChangeTypeUpdate, env)

	// Detect changes
	changes, err := manager.DetectChanges(ctx, cs)
	require.NoError(t, err)

	// Should have no tainted targets (change was to a different environment)
	tainted := getReleaseTargetsByType(changes, changeset.ChangeTypeTaint)

	assert.Len(t, tainted, 0, "target should not be tainted by changes to unrelated entities")
}

// Benchmark tests for performance validation

func BenchmarkManager_DetectChanges_SmallChangeset(b *testing.B) {
	ctx := context.Background()
	// This is a simplified benchmark - in reality would need proper store setup
	st := store.New()
	manager := New(st)

	// Set empty targets for benchmark
	manager.currentTargets = make(map[string]*oapi.ReleaseTarget)

	// Create a small changeset with one environment change
	cs := changeset.NewChangeSet[any]()
	env := createTestEnvironment(uuid.New().String(), uuid.New().String(), "test-env")
	cs.Record(changeset.ChangeTypeUpdate, env)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, err := manager.DetectChanges(ctx, cs)
		if err != nil {
			b.Fatal(err)
		}
	}
}

func BenchmarkManager_DetectChanges_LargeChangeset(b *testing.B) {
	ctx := context.Background()
	// This is a simplified benchmark - in reality would need proper store setup
	st := store.New()
	manager := New(st)

	// Set empty targets for benchmark
	manager.currentTargets = make(map[string]*oapi.ReleaseTarget)

	// Create a changeset with 100 changes
	cs := changeset.NewChangeSet[any]()
	for i := 0; i < 100; i++ {
		env := createTestEnvironment(uuid.New().String(), uuid.New().String(), "test-env")
		cs.Record(changeset.ChangeTypeUpdate, env)
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, err := manager.DetectChanges(ctx, cs)
		if err != nil {
			b.Fatal(err)
		}
	}
}
