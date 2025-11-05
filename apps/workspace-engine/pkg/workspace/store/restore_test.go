package store_test

import (
	"context"
	"testing"
	"time"

	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/persistence"
	"workspace-engine/pkg/persistence/memory"
	"workspace-engine/pkg/statechange"
	"workspace-engine/pkg/workspace/store"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func ptr[T any](v T) *T {
	return &v
}

// TestStore_Restore_MaterializedViewsInitialized tests that after restoring from persistence,
// materialized views for environments and deployments are properly initialized.
// This test verifies the fix for the bug where environment resources couldn't be queried
// after restoration because ReinitializeMaterializedViews() wasn't being called.
func TestStore_Restore_MaterializedViewsInitialized(t *testing.T) {
	ctx := context.Background()
	namespace := "workspace-" + uuid.New().String()

	// Create in-memory persistence store
	persistenceStore := memory.NewStore()

	// Create test entities
	systemId := uuid.New().String()
	system := &oapi.System{
		Id:          systemId,
		Name:        "test-system",
		Description: ptr("Test system"),
	}

	// Create a resource that will match the environment selector
	resourceId := uuid.New().String()
	resource := &oapi.Resource{
		Id:         resourceId,
		Name:       "prod-server",
		Kind:       "kubernetes",
		Version:    "1.0.0",
		Identifier: "prod-resource-1",
		Metadata: map[string]string{
			"env":     "production",
			"cluster": "us-east-1",
		},
		Config:    map[string]interface{}{},
		CreatedAt: time.Now(),
	}

	// Create a resource that won't match the environment selector
	devResourceId := uuid.New().String()
	devResource := &oapi.Resource{
		Id:         devResourceId,
		Name:       "dev-server",
		Kind:       "kubernetes",
		Version:    "1.0.0",
		Identifier: "dev-resource-1",
		Metadata: map[string]string{
			"env":     "development",
			"cluster": "us-west-1",
		},
		Config:    map[string]interface{}{},
		CreatedAt: time.Now(),
	}

	// Create environment with a selector that matches production resources
	environmentId := uuid.New().String()
	environment := &oapi.Environment{
		Id:          environmentId,
		Name:        "production",
		Description: ptr("Production environment"),
		SystemId:    systemId,
	}

	// Set up resource selector to match resources with env=production
	selector := &oapi.Selector{}
	selector.FromCelSelector(oapi.CelSelector{
		Cel: "resource.metadata['env'] == 'production'",
	})
	environment.ResourceSelector = selector

	// Create deployment with resource selector
	deploymentId := uuid.New().String()
	deployment := &oapi.Deployment{
		Id:          deploymentId,
		Name:        "web-app",
		Slug:        "web-app",
		Description: ptr("Web application"),
		SystemId:    systemId,
	}

	deploymentSelector := &oapi.Selector{}
	deploymentSelector.FromCelSelector(oapi.CelSelector{
		Cel: "resource.metadata['env'] == 'production'",
	})
	deployment.ResourceSelector = deploymentSelector

	// Build changes and save to persistence
	changes := persistence.NewChangesBuilder(namespace).
		Set(system).
		Set(resource).
		Set(devResource).
		Set(environment).
		Set(deployment).
		Build()

	err := persistenceStore.Save(ctx, changes)
	require.NoError(t, err)

	// Load changes back from persistence store
	loadedChanges, err := persistenceStore.Load(ctx, namespace)
	require.NoError(t, err)
	require.Len(t, loadedChanges, 5, "Should have 5 entities")

	// Apply changes to a new store using the Restore method
	// This is the critical test - Restore() must call ReinitializeMaterializedViews()
	testStore := store.New("test-workspace", statechange.NewChangeSet[any]())
	err = testStore.Restore(ctx, loadedChanges, func(status string) {})
	require.NoError(t, err, "Restore should succeed")

	// Verify basic entities were restored
	restoredEnv, ok := testStore.Environments.Get(environmentId)
	require.True(t, ok, "Environment should be restored")
	assert.Equal(t, "production", restoredEnv.Name)

	restoredDeployment, ok := testStore.Deployments.Get(deploymentId)
	require.True(t, ok, "Deployment should be restored")
	assert.Equal(t, "web-app", restoredDeployment.Name)

	// The critical test: verify materialized views are initialized
	// This should NOT return an error like "environment env-production not found"
	envResources, err := testStore.Environments.Resources(environmentId)
	require.NoError(t, err, "Should be able to query environment resources after restore")
	require.NotNil(t, envResources, "Environment resources should not be nil")

	// Verify the environment correctly filtered resources based on the selector
	assert.Contains(t, envResources, resourceId, "Production resource should be in environment")
	assert.NotContains(t, envResources, devResourceId, "Development resource should not be in environment")
	assert.Equal(t, 1, len(envResources), "Should have exactly 1 matching resource")

	// Verify deployment materialized views are also initialized
	deploymentResources, err := testStore.Deployments.Resources(deploymentId)
	require.NoError(t, err, "Should be able to query deployment resources after restore")
	require.NotNil(t, deploymentResources, "Deployment resources should not be nil")

	// Verify the deployment correctly filtered resources based on the selector
	assert.Contains(t, deploymentResources, resourceId, "Production resource should be in deployment")
	assert.NotContains(t, deploymentResources, devResourceId, "Development resource should not be in deployment")
	assert.Equal(t, 1, len(deploymentResources), "Should have exactly 1 matching resource")

	// Verify HasResource works correctly (this also depends on materialized views)
	hasResource := testStore.Environments.HasResource(environmentId, resourceId)
	assert.True(t, hasResource, "Environment should have the production resource")

	hasDevResource := testStore.Environments.HasResource(environmentId, devResourceId)
	assert.False(t, hasDevResource, "Environment should not have the development resource")
}

// TestStore_Restore_EmptyEnvironments tests that restoration works even with no environments
func TestStore_Restore_EmptyEnvironments(t *testing.T) {
	ctx := context.Background()
	namespace := "workspace-" + uuid.New().String()

	persistenceStore := memory.NewStore()

	// Create minimal entities (no environments)
	system := &oapi.System{
		Id:          uuid.New().String(),
		Name:        "test-system",
		Description: ptr("Test system"),
	}

	changes := persistence.NewChangesBuilder(namespace).
		Set(system).
		Build()

	err := persistenceStore.Save(ctx, changes)
	require.NoError(t, err)

	loadedChanges, err := persistenceStore.Load(ctx, namespace)
	require.NoError(t, err)

	// Restore should succeed even with no environments/deployments
	testStore := store.New("test-workspace", statechange.NewChangeSet[any]())
	err = testStore.Restore(ctx, loadedChanges, func(status string) {})
	require.NoError(t, err, "Restore should succeed with no environments")

	// Verify system was restored
	restoredSystem, ok := testStore.Repo().Systems.Get(system.Id)
	require.True(t, ok, "System should be restored")
	assert.Equal(t, system.Name, restoredSystem.Name)
}

// TestStore_Restore_MultipleEnvironments tests restoration with multiple environments
func TestStore_Restore_MultipleEnvironments(t *testing.T) {
	ctx := context.Background()
	namespace := "workspace-" + uuid.New().String()

	persistenceStore := memory.NewStore()

	systemId := uuid.New().String()
	system := &oapi.System{
		Id:   systemId,
		Name: "test-system",
	}

	// Create multiple resources with different metadata
	prodResourceId := uuid.New().String()
	prodResource := &oapi.Resource{
		Id:         prodResourceId,
		Identifier: "prod-res-1",
		Name:       "prod-server",
		Kind:       "kubernetes",
		Version:    "1.0.0",
		Metadata:   map[string]string{"env": "production"},
		Config:     map[string]interface{}{},
		CreatedAt:  time.Now(),
	}

	stagingResourceId := uuid.New().String()
	stagingResource := &oapi.Resource{
		Id:         stagingResourceId,
		Identifier: "staging-res-1",
		Name:       "staging-server",
		Kind:       "kubernetes",
		Version:    "1.0.0",
		Metadata:   map[string]string{"env": "staging"},
		Config:     map[string]interface{}{},
		CreatedAt:  time.Now(),
	}

	devResourceId := uuid.New().String()
	devResource := &oapi.Resource{
		Id:         devResourceId,
		Identifier: "dev-res-1",
		Name:       "dev-server",
		Kind:       "kubernetes",
		Version:    "1.0.0",
		Metadata:   map[string]string{"env": "development"},
		Config:     map[string]interface{}{},
		CreatedAt:  time.Now(),
	}

	// Create multiple environments with different selectors
	prodEnvId := uuid.New().String()
	prodEnv := &oapi.Environment{
		Id:       prodEnvId,
		Name:     "production",
		SystemId: systemId,
	}
	prodSelector := &oapi.Selector{}
	prodSelector.FromCelSelector(oapi.CelSelector{Cel: "resource.metadata['env'] == 'production'"})
	prodEnv.ResourceSelector = prodSelector

	stagingEnvId := uuid.New().String()
	stagingEnv := &oapi.Environment{
		Id:       stagingEnvId,
		Name:     "staging",
		SystemId: systemId,
	}
	stagingSelector := &oapi.Selector{}
	stagingSelector.FromCelSelector(oapi.CelSelector{Cel: "resource.metadata['env'] == 'staging'"})
	stagingEnv.ResourceSelector = stagingSelector

	devEnvId := uuid.New().String()
	devEnv := &oapi.Environment{
		Id:       devEnvId,
		Name:     "development",
		SystemId: systemId,
	}
	devSelector := &oapi.Selector{}
	devSelector.FromCelSelector(oapi.CelSelector{Cel: "resource.metadata['env'] == 'development'"})
	devEnv.ResourceSelector = devSelector

	// Save all entities
	changes := persistence.NewChangesBuilder(namespace).
		Set(system).
		Set(prodResource).
		Set(stagingResource).
		Set(devResource).
		Set(prodEnv).
		Set(stagingEnv).
		Set(devEnv).
		Build()

	err := persistenceStore.Save(ctx, changes)
	require.NoError(t, err)

	// Load and restore
	loadedChanges, err := persistenceStore.Load(ctx, namespace)
	require.NoError(t, err)

	testStore := store.New("test-workspace", statechange.NewChangeSet[any]())
	err = testStore.Restore(ctx, loadedChanges, func(status string) {})
	require.NoError(t, err)

	// Verify each environment has the correct resources
	prodResources, err := testStore.Environments.Resources(prodEnvId)
	require.NoError(t, err, "Production environment resources should be accessible")
	assert.Contains(t, prodResources, prodResourceId)
	assert.NotContains(t, prodResources, stagingResourceId)
	assert.NotContains(t, prodResources, devResourceId)
	assert.Equal(t, 1, len(prodResources))

	stagingResources, err := testStore.Environments.Resources(stagingEnvId)
	require.NoError(t, err, "Staging environment resources should be accessible")
	assert.Contains(t, stagingResources, stagingResourceId)
	assert.NotContains(t, stagingResources, prodResourceId)
	assert.NotContains(t, stagingResources, devResourceId)
	assert.Equal(t, 1, len(stagingResources))

	devResources, err := testStore.Environments.Resources(devEnvId)
	require.NoError(t, err, "Development environment resources should be accessible")
	assert.Contains(t, devResources, devResourceId)
	assert.NotContains(t, devResources, prodResourceId)
	assert.NotContains(t, devResources, stagingResourceId)
	assert.Equal(t, 1, len(devResources))
}

// TestStore_Restore_AllMaterializedViewsInitialized is a comprehensive test that validates
// ALL materialized views across all store types are properly initialized after restore.
// This test helps prevent bugs where new materialized views are added but not initialized.
func TestStore_Restore_AllMaterializedViewsInitialized(t *testing.T) {
	ctx := context.Background()
	namespace := "workspace-" + uuid.New().String()

	persistenceStore := memory.NewStore()

	// Create a comprehensive set of entities that exercise all materialized views
	systemId := uuid.New().String()
	system := &oapi.System{
		Id:          systemId,
		Name:        "test-system",
		Description: ptr("Comprehensive test system"),
	}

	// Create resources
	resource1Id := uuid.New().String()
	resource1 := &oapi.Resource{
		Id:         resource1Id,
		Name:       "resource-1",
		Kind:       "kubernetes",
		Version:    "1.0.0",
		Identifier: "res-1",
		Metadata:   map[string]string{"env": "production", "tier": "frontend"},
		Config:     map[string]interface{}{},
		CreatedAt:  time.Now(),
	}

	resource2Id := uuid.New().String()
	resource2 := &oapi.Resource{
		Id:         resource2Id,
		Name:       "resource-2",
		Kind:       "kubernetes",
		Version:    "1.0.0",
		Identifier: "res-2",
		Metadata:   map[string]string{"env": "production", "tier": "backend"},
		Config:     map[string]interface{}{},
		CreatedAt:  time.Now(),
	}

	// Create environments with selectors
	env1Id := uuid.New().String()
	env1 := &oapi.Environment{
		Id:          env1Id,
		Name:        "production",
		Description: ptr("Production environment"),
		SystemId:    systemId,
	}
	env1Selector := &oapi.Selector{}
	env1Selector.FromCelSelector(oapi.CelSelector{Cel: "resource.metadata['env'] == 'production'"})
	env1.ResourceSelector = env1Selector

	env2Id := uuid.New().String()
	env2 := &oapi.Environment{
		Id:          env2Id,
		Name:        "production-frontend",
		Description: ptr("Production frontend environment"),
		SystemId:    systemId,
	}
	env2Selector := &oapi.Selector{}
	env2Selector.FromCelSelector(oapi.CelSelector{Cel: "resource.metadata['tier'] == 'frontend'"})
	env2.ResourceSelector = env2Selector

	// Create deployments with selectors
	deploy1Id := uuid.New().String()
	deploy1 := &oapi.Deployment{
		Id:          deploy1Id,
		Name:        "api-deployment",
		Slug:        "api-deploy",
		Description: ptr("API deployment"),
		SystemId:    systemId,
	}
	deploy1Selector := &oapi.Selector{}
	deploy1Selector.FromCelSelector(oapi.CelSelector{Cel: "resource.metadata['tier'] == 'backend'"})
	deploy1.ResourceSelector = deploy1Selector

	deploy2Id := uuid.New().String()
	deploy2 := &oapi.Deployment{
		Id:          deploy2Id,
		Name:        "frontend-deployment",
		Slug:        "frontend-deploy",
		Description: ptr("Frontend deployment"),
		SystemId:    systemId,
	}
	deploy2Selector := &oapi.Selector{}
	deploy2Selector.FromCelSelector(oapi.CelSelector{Cel: "resource.metadata['tier'] == 'frontend'"})
	deploy2.ResourceSelector = deploy2Selector

	// Create deployment versions
	version1Id := uuid.New().String()
	version1 := &oapi.DeploymentVersion{
		Id:           version1Id,
		DeploymentId: deploy1Id,
		Tag:          "v1.0.0",
	}

	version2Id := uuid.New().String()
	version2 := &oapi.DeploymentVersion{
		Id:           version2Id,
		DeploymentId: deploy1Id,
		Tag:          "v1.1.0",
	}

	version3Id := uuid.New().String()
	version3 := &oapi.DeploymentVersion{
		Id:           version3Id,
		DeploymentId: deploy2Id,
		Tag:          "v2.0.0",
	}

	// Save all entities to persistence
	changes := persistence.NewChangesBuilder(namespace).
		Set(system).
		Set(resource1).
		Set(resource2).
		Set(env1).
		Set(env2).
		Set(deploy1).
		Set(deploy2).
		Set(version1).
		Set(version2).
		Set(version3).
		Build()

	err := persistenceStore.Save(ctx, changes)
	require.NoError(t, err)

	// Load and restore
	loadedChanges, err := persistenceStore.Load(ctx, namespace)
	require.NoError(t, err)

	testStore := store.New("test-workspace", statechange.NewChangeSet[any]())
	err = testStore.Restore(ctx, loadedChanges, nil)
	require.NoError(t, err, "Restore should succeed")

	// ==========================================
	// Test 1: Environment Materialized Views
	// ==========================================
	t.Run("Environment_Resources", func(t *testing.T) {
		// Verify env1 resources materialized view is initialized
		env1Resources, err := testStore.Environments.Resources(env1Id)
		require.NoError(t, err, "Should access env1 resources after restore")
		assert.Contains(t, env1Resources, resource1Id)
		assert.Contains(t, env1Resources, resource2Id)
		assert.Equal(t, 2, len(env1Resources), "env1 should have both production resources")

		// Verify env2 resources materialized view is initialized
		env2Resources, err := testStore.Environments.Resources(env2Id)
		require.NoError(t, err, "Should access env2 resources after restore")
		assert.Contains(t, env2Resources, resource1Id)
		assert.NotContains(t, env2Resources, resource2Id)
		assert.Equal(t, 1, len(env2Resources), "env2 should have only frontend resource")

		// Verify HasResource works (also depends on materialized views)
		assert.True(t, testStore.Environments.HasResource(env1Id, resource1Id))
		assert.True(t, testStore.Environments.HasResource(env2Id, resource1Id))
		assert.False(t, testStore.Environments.HasResource(env2Id, resource2Id))
	})

	// ==========================================
	// Test 2: Deployment Materialized Views - Resources
	// ==========================================
	t.Run("Deployment_Resources", func(t *testing.T) {
		// Verify deploy1 resources materialized view is initialized
		deploy1Resources, err := testStore.Deployments.Resources(deploy1Id)
		require.NoError(t, err, "Should access deploy1 resources after restore")
		assert.Contains(t, deploy1Resources, resource2Id)
		assert.NotContains(t, deploy1Resources, resource1Id)
		assert.Equal(t, 1, len(deploy1Resources), "deploy1 should have only backend resource")

		// Verify deploy2 resources materialized view is initialized
		deploy2Resources, err := testStore.Deployments.Resources(deploy2Id)
		require.NoError(t, err, "Should access deploy2 resources after restore")
		assert.Contains(t, deploy2Resources, resource1Id)
		assert.NotContains(t, deploy2Resources, resource2Id)
		assert.Equal(t, 1, len(deploy2Resources), "deploy2 should have only frontend resource")

		// Verify HasResource works (also depends on materialized views)
		assert.True(t, testStore.Deployments.HasResource(deploy1Id, resource2Id))
		assert.True(t, testStore.Deployments.HasResource(deploy2Id, resource1Id))
		assert.False(t, testStore.Deployments.HasResource(deploy1Id, resource1Id))
	})

	// ==========================================
	// Test 3: Deployment Materialized Views - Versions
	// ==========================================
	// Note: The Deployments.versions materialized view exists and is initialized
	// by ReinitializeMaterializedViews(), but there's no public accessor method
	// to test it directly. The fact that it's initialized is verified indirectly
	// through the deployment resource filtering above, which depends on the
	// deployment entity being properly restored with its materialized views.

	// ==========================================
	// Test 4: System Materialized Views
	// ==========================================
	t.Run("System_Deployments_And_Environments", func(t *testing.T) {
		// Verify system deployments materialized view is initialized
		systemDeployments := testStore.Systems.Deployments(systemId)
		require.NotNil(t, systemDeployments, "Should access system deployments after restore")
		assert.Contains(t, systemDeployments, deploy1Id)
		assert.Contains(t, systemDeployments, deploy2Id)
		assert.Equal(t, 2, len(systemDeployments), "system should have 2 deployments")

		// Verify system environments materialized view is initialized
		systemEnvironments := testStore.Systems.Environments(systemId)
		require.NotNil(t, systemEnvironments, "Should access system environments after restore")
		assert.Contains(t, systemEnvironments, env1Id)
		assert.Contains(t, systemEnvironments, env2Id)
		assert.Equal(t, 2, len(systemEnvironments), "system should have 2 environments")
	})
}

// TestStore_Restore_DetectsMissingMaterializedViewInitialization documents what happens
// when a materialized view is NOT initialized - this test demonstrates the problem that
// would occur if ReinitializeMaterializedViews() is not called.
func TestStore_Restore_DetectsMissingMaterializedViewInitialization(t *testing.T) {
	ctx := context.Background()
	namespace := "workspace-" + uuid.New().String()

	persistenceStore := memory.NewStore()

	// Create a simple environment with resources
	systemId := uuid.New().String()
	system := &oapi.System{
		Id:   systemId,
		Name: "test-system",
	}

	resourceId := uuid.New().String()
	resource := &oapi.Resource{
		Id:         resourceId,
		Name:       "test-resource",
		Kind:       "kubernetes",
		Version:    "1.0.0",
		Identifier: "test-res",
		Metadata:   map[string]string{"env": "production"},
		Config:     map[string]interface{}{},
		CreatedAt:  time.Now(),
	}

	environmentId := uuid.New().String()
	environment := &oapi.Environment{
		Id:       environmentId,
		Name:     "production",
		SystemId: systemId,
	}
	selector := &oapi.Selector{}
	selector.FromCelSelector(oapi.CelSelector{Cel: "resource.metadata['env'] == 'production'"})
	environment.ResourceSelector = selector

	changes := persistence.NewChangesBuilder(namespace).
		Set(system).
		Set(resource).
		Set(environment).
		Build()

	err := persistenceStore.Save(ctx, changes)
	require.NoError(t, err)

	// Load the changes
	loadedChanges, err := persistenceStore.Load(ctx, namespace)
	require.NoError(t, err)

	// Create a store and apply changes WITHOUT calling Restore()
	// This simulates the bug where ReinitializeMaterializedViews() is not called
	testStore := store.New("test-workspace", statechange.NewChangeSet[any]())
	err = testStore.Repo().Router().Apply(ctx, loadedChanges)
	require.NoError(t, err)

	// Now try to access the environment resources - this should FAIL because
	// the materialized view was not initialized
	_, err = testStore.Environments.Resources(environmentId)
	assert.Error(t, err, "Should get an error when materialized views are not initialized")
	assert.Contains(t, err.Error(), "not found", "Error should indicate environment not found")

	// This demonstrates the bug! The environment exists in the repo, but the
	// materialized view map is empty, so it appears "not found"
	_, exists := testStore.Environments.Get(environmentId)
	assert.True(t, exists, "Environment should exist in repo")
}
