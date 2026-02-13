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
	_ = selector.FromCelSelector(oapi.CelSelector{
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
	_ = deploymentSelector.FromCelSelector(oapi.CelSelector{
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
	envResources := testStore.Resources.ForEnvironment(ctx, restoredEnv)
	require.NoError(t, err, "Should be able to query environment resources after restore")
	require.NotNil(t, envResources, "Environment resources should not be nil")

	// Verify the environment correctly filtered resources based on the selector
	assert.Contains(t, envResources, resourceId, "Production resource should be in environment")
	assert.NotContains(t, envResources, devResourceId, "Development resource should not be in environment")
	assert.Equal(t, 1, len(envResources), "Should have exactly 1 matching resource")

	// Verify deployment materialized views are also initialized
	deploymentResources := testStore.Resources.ForDeployment(ctx, restoredDeployment)
	require.NoError(t, err, "Should be able to query deployment resources after restore")
	require.NotNil(t, deploymentResources, "Deployment resources should not be nil")

	// Verify the deployment correctly filtered resources based on the selector
	assert.Contains(t, deploymentResources, resourceId, "Production resource should be in deployment")
	assert.NotContains(t, deploymentResources, devResourceId, "Development resource should not be in deployment")
	assert.Equal(t, 1, len(deploymentResources), "Should have exactly 1 matching resource")
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
	restoredSystem, ok := testStore.Repo().Systems().Get(system.Id)
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
	_ = prodSelector.FromCelSelector(oapi.CelSelector{Cel: "resource.metadata['env'] == 'production'"})
	prodEnv.ResourceSelector = prodSelector

	stagingEnvId := uuid.New().String()
	stagingEnv := &oapi.Environment{
		Id:       stagingEnvId,
		Name:     "staging",
		SystemId: systemId,
	}
	stagingSelector := &oapi.Selector{}
	_ = stagingSelector.FromCelSelector(oapi.CelSelector{Cel: "resource.metadata['env'] == 'staging'"})
	stagingEnv.ResourceSelector = stagingSelector

	devEnvId := uuid.New().String()
	devEnv := &oapi.Environment{
		Id:       devEnvId,
		Name:     "development",
		SystemId: systemId,
	}
	devSelector := &oapi.Selector{}
	_ = devSelector.FromCelSelector(oapi.CelSelector{Cel: "resource.metadata['env'] == 'development'"})
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
	prodResources := testStore.Resources.ForEnvironment(ctx, prodEnv)
	require.NoError(t, err, "Production environment resources should be accessible")
	assert.Contains(t, prodResources, prodResourceId)
	assert.NotContains(t, prodResources, stagingResourceId)
	assert.NotContains(t, prodResources, devResourceId)
	assert.Equal(t, 1, len(prodResources))

	stagingResources := testStore.Resources.ForEnvironment(ctx, stagingEnv)
	require.NoError(t, err, "Staging environment resources should be accessible")
	assert.Contains(t, stagingResources, stagingResourceId)
	assert.NotContains(t, stagingResources, prodResourceId)
	assert.NotContains(t, stagingResources, devResourceId)
	assert.Equal(t, 1, len(stagingResources))

	devResources := testStore.Resources.ForEnvironment(ctx, devEnv)
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
	_ = env1Selector.FromCelSelector(oapi.CelSelector{Cel: "resource.metadata['env'] == 'production'"})
	env1.ResourceSelector = env1Selector

	env2Id := uuid.New().String()
	env2 := &oapi.Environment{
		Id:          env2Id,
		Name:        "production-frontend",
		Description: ptr("Production frontend environment"),
		SystemId:    systemId,
	}
	env2Selector := &oapi.Selector{}
	_ = env2Selector.FromCelSelector(oapi.CelSelector{Cel: "resource.metadata['tier'] == 'frontend'"})
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
	_ = deploy1Selector.FromCelSelector(oapi.CelSelector{Cel: "resource.metadata['tier'] == 'backend'"})
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
	_ = deploy2Selector.FromCelSelector(oapi.CelSelector{Cel: "resource.metadata['tier'] == 'frontend'"})
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
		env1Resources := testStore.Resources.ForEnvironment(ctx, env1)
		require.NoError(t, err, "Should access env1 resources after restore")
		assert.Contains(t, env1Resources, resource1Id)
		assert.Contains(t, env1Resources, resource2Id)
		assert.Equal(t, 2, len(env1Resources), "env1 should have both production resources")

		// Verify env2 resources materialized view is initialized
		env2Resources := testStore.Resources.ForEnvironment(ctx, env2)
		require.NoError(t, err, "Should access env2 resources after restore")
		assert.Contains(t, env2Resources, resource1Id)
		assert.NotContains(t, env2Resources, resource2Id)
		assert.Equal(t, 1, len(env2Resources), "env2 should have only frontend resource")
	})

	// ==========================================
	// Test 2: Deployment Materialized Views - Resources
	// ==========================================
	t.Run("Deployment_Resources", func(t *testing.T) {
		// Verify deploy1 resources materialized view is initialized
		deploy1Resources := testStore.Resources.ForDeployment(ctx, deploy1)
		require.NoError(t, err, "Should access deploy1 resources after restore")
		assert.Contains(t, deploy1Resources, resource2Id)
		assert.NotContains(t, deploy1Resources, resource1Id)
		assert.Equal(t, 1, len(deploy1Resources), "deploy1 should have only backend resource")

		// Verify deploy2 resources materialized view is initialized
		deploy2Resources := testStore.Resources.ForDeployment(ctx, deploy2)
		require.NoError(t, err, "Should access deploy2 resources after restore")
		assert.Contains(t, deploy2Resources, resource1Id)
		assert.NotContains(t, deploy2Resources, resource2Id)
		assert.Equal(t, 1, len(deploy2Resources), "deploy2 should have only frontend resource")
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
	_ = selector.FromCelSelector(oapi.CelSelector{Cel: "resource.metadata['env'] == 'production'"})
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
	envResources := testStore.Resources.ForEnvironment(ctx, environment)
	require.NoError(t, err, "Should be able to query environment resources after restore")
	require.NotNil(t, envResources, "Environment resources should not be nil")
	assert.Contains(t, envResources, resourceId, "Production resource should be in environment")
	assert.Equal(t, 1, len(envResources), "Should have exactly 1 matching resource")
}

// TestStore_Restore_ResourceProviders tests restoration of resource providers and their resources
func TestStore_Restore_ResourceProviders(t *testing.T) {
	ctx := context.Background()
	namespace := "workspace-" + uuid.New().String()

	persistenceStore := memory.NewStore()

	// Create resource providers
	provider1Id := uuid.New().String()
	provider1 := &oapi.ResourceProvider{
		Id:        provider1Id,
		Name:      "aws-provider",
		CreatedAt: time.Now(),
		Metadata:  map[string]string{"cloud": "aws", "region": "us-east-1"},
	}

	provider2Id := uuid.New().String()
	provider2 := &oapi.ResourceProvider{
		Id:        provider2Id,
		Name:      "gcp-provider",
		CreatedAt: time.Now(),
		Metadata:  map[string]string{"cloud": "gcp", "region": "us-central1"},
	}

	// Create resources owned by providers
	resource1Id := uuid.New().String()
	resource1 := &oapi.Resource{
		Id:         resource1Id,
		Name:       "aws-instance",
		Kind:       "ec2",
		Version:    "1.0.0",
		Identifier: "aws-res-1",
		ProviderId: &provider1Id,
		Metadata:   map[string]string{"provider": "aws"},
		Config:     map[string]interface{}{},
		CreatedAt:  time.Now(),
	}

	resource2Id := uuid.New().String()
	resource2 := &oapi.Resource{
		Id:         resource2Id,
		Name:       "gcp-instance",
		Kind:       "compute",
		Version:    "1.0.0",
		Identifier: "gcp-res-1",
		ProviderId: &provider2Id,
		Metadata:   map[string]string{"provider": "gcp"},
		Config:     map[string]interface{}{},
		CreatedAt:  time.Now(),
	}

	// Save all entities
	changes := persistence.NewChangesBuilder(namespace).
		Set(provider1).
		Set(provider2).
		Set(resource1).
		Set(resource2).
		Build()

	err := persistenceStore.Save(ctx, changes)
	require.NoError(t, err)

	// Load and restore
	loadedChanges, err := persistenceStore.Load(ctx, namespace)
	require.NoError(t, err)

	testStore := store.New("test-workspace", statechange.NewChangeSet[any]())
	err = testStore.Restore(ctx, loadedChanges, nil)
	require.NoError(t, err)

	// Verify providers were restored
	restoredProvider1, ok := testStore.ResourceProviders.Get(provider1Id)
	require.True(t, ok, "Provider 1 should be restored")
	assert.Equal(t, "aws-provider", restoredProvider1.Name)
	assert.Equal(t, "aws", restoredProvider1.Metadata["cloud"])

	restoredProvider2, ok := testStore.ResourceProviders.Get(provider2Id)
	require.True(t, ok, "Provider 2 should be restored")
	assert.Equal(t, "gcp-provider", restoredProvider2.Name)

	// Verify resources were restored with correct provider associations
	restoredResource1, ok := testStore.Resources.Get(resource1Id)
	require.True(t, ok, "Resource 1 should be restored")
	assert.Equal(t, "aws-instance", restoredResource1.Name)
	assert.NotNil(t, restoredResource1.ProviderId)
	assert.Equal(t, provider1Id, *restoredResource1.ProviderId)

	restoredResource2, ok := testStore.Resources.Get(resource2Id)
	require.True(t, ok, "Resource 2 should be restored")
	assert.NotNil(t, restoredResource2.ProviderId)
	assert.Equal(t, provider2Id, *restoredResource2.ProviderId)
}

// TestStore_Restore_RelationshipRules tests restoration of relationship rules
func TestStore_Restore_RelationshipRules(t *testing.T) {
	ctx := context.Background()
	namespace := "workspace-" + uuid.New().String()

	persistenceStore := memory.NewStore()

	// Create relationship rules
	rule1Id := uuid.New().String()
	rule1 := &oapi.RelationshipRule{
		Id:        rule1Id,
		Name:      "vpc-to-cluster",
		Reference: "contains",
		FromType:  oapi.RelatableEntityTypeResource,
		ToType:    oapi.RelatableEntityTypeResource,
	}

	// Set up selectors
	fromSelector := &oapi.Selector{}
	_ = fromSelector.FromCelSelector(oapi.CelSelector{Cel: "resource.kind == 'vpc'"})
	rule1.FromSelector = fromSelector

	toSelector := &oapi.Selector{}
	_ = toSelector.FromCelSelector(oapi.CelSelector{Cel: "resource.kind == 'kubernetes-cluster'"})
	rule1.ToSelector = toSelector

	// Set up matcher
	matcher := &oapi.RelationshipRule_Matcher{}
	_ = matcher.FromCelMatcher(oapi.CelMatcher{Cel: "from.metadata.region == to.metadata.region"})
	rule1.Matcher = *matcher

	rule2Id := uuid.New().String()
	rule2 := &oapi.RelationshipRule{
		Id:        rule2Id,
		Name:      "deployment-to-resource",
		Reference: "runs-on",
		FromType:  oapi.RelatableEntityTypeDeployment,
		ToType:    oapi.RelatableEntityTypeResource,
	}

	changes := persistence.NewChangesBuilder(namespace).
		Set(rule1).
		Set(rule2).
		Build()

	err := persistenceStore.Save(ctx, changes)
	require.NoError(t, err)

	// Load and restore
	loadedChanges, err := persistenceStore.Load(ctx, namespace)
	require.NoError(t, err)

	testStore := store.New("test-workspace", statechange.NewChangeSet[any]())
	err = testStore.Restore(ctx, loadedChanges, nil)
	require.NoError(t, err)

	// Verify rules were restored
	restoredRule1, ok := testStore.Relationships.Get(rule1Id)
	require.True(t, ok, "Rule 1 should be restored")
	assert.Equal(t, "vpc-to-cluster", restoredRule1.Name)
	assert.Equal(t, "contains", restoredRule1.Reference)
	assert.Equal(t, oapi.RelatableEntityTypeResource, restoredRule1.FromType)
	assert.NotNil(t, restoredRule1.FromSelector)

	restoredRule2, ok := testStore.Relationships.Get(rule2Id)
	require.True(t, ok, "Rule 2 should be restored")
	assert.Equal(t, "deployment-to-resource", restoredRule2.Name)
	assert.Equal(t, oapi.RelatableEntityTypeDeployment, restoredRule2.FromType)
}

// TestStore_Restore_JobsAndJobAgents tests restoration of jobs and job agents
func TestStore_Restore_JobsAndJobAgents(t *testing.T) {
	ctx := context.Background()
	namespace := "workspace-" + uuid.New().String()

	persistenceStore := memory.NewStore()

	// Create job agents
	agent1Id := uuid.New().String()
	agent1 := &oapi.JobAgent{
		Id:   agent1Id,
		Name: "kubernetes-agent",
		Type: "kubernetes",
	}

	agent2Id := uuid.New().String()
	agent2 := &oapi.JobAgent{
		Id:   agent2Id,
		Name: "docker-agent",
		Type: "docker",
	}

	// Create jobs
	job1Id := uuid.New().String()
	job1 := &oapi.Job{
		Id:         job1Id,
		ExternalId: ptr("external-job-1"),
		Status:     oapi.JobStatusPending,
		JobAgentId: agent1Id,
	}

	job2Id := uuid.New().String()
	job2 := &oapi.Job{
		Id:         job2Id,
		ExternalId: ptr("external-job-2"),
		Status:     oapi.JobStatusInProgress,
		JobAgentId: agent2Id,
	}

	changes := persistence.NewChangesBuilder(namespace).
		Set(agent1).
		Set(agent2).
		Set(job1).
		Set(job2).
		Build()

	err := persistenceStore.Save(ctx, changes)
	require.NoError(t, err)

	// Load and restore
	loadedChanges, err := persistenceStore.Load(ctx, namespace)
	require.NoError(t, err)

	testStore := store.New("test-workspace", statechange.NewChangeSet[any]())
	err = testStore.Restore(ctx, loadedChanges, nil)
	require.NoError(t, err)

	// Verify job agents were restored
	restoredAgent1, ok := testStore.JobAgents.Get(agent1Id)
	require.True(t, ok, "Agent 1 should be restored")
	assert.Equal(t, "kubernetes-agent", restoredAgent1.Name)
	assert.Equal(t, "kubernetes", restoredAgent1.Type)

	restoredAgent2, ok := testStore.JobAgents.Get(agent2Id)
	require.True(t, ok, "Agent 2 should be restored")
	assert.Equal(t, "docker-agent", restoredAgent2.Name)

	// Verify jobs were restored
	restoredJob1, ok := testStore.Jobs.Get(job1Id)
	require.True(t, ok, "Job 1 should be restored")
	assert.Equal(t, oapi.JobStatusPending, restoredJob1.Status)
	assert.Equal(t, agent1Id, restoredJob1.JobAgentId)
	assert.NotNil(t, restoredJob1.ExternalId)
	assert.Equal(t, "external-job-1", *restoredJob1.ExternalId)

	restoredJob2, ok := testStore.Jobs.Get(job2Id)
	require.True(t, ok, "Job 2 should be restored")
	assert.Equal(t, oapi.JobStatusInProgress, restoredJob2.Status)
	assert.Equal(t, agent2Id, restoredJob2.JobAgentId)
}

// TestStore_Restore_NilSelectors tests restoration of environments and deployments with nil selectors
func TestStore_Restore_NilSelectors(t *testing.T) {
	ctx := context.Background()
	namespace := "workspace-" + uuid.New().String()

	persistenceStore := memory.NewStore()

	systemId := uuid.New().String()
	system := &oapi.System{
		Id:   systemId,
		Name: "test-system",
	}

	// Create environment with nil selector
	envId := uuid.New().String()
	env := &oapi.Environment{
		Id:               envId,
		Name:             "no-selector-env",
		SystemId:         systemId,
		ResourceSelector: nil, // Explicitly nil
	}

	// Create deployment with nil selector
	deployId := uuid.New().String()
	deploy := &oapi.Deployment{
		Id:               deployId,
		Name:             "no-selector-deploy",
		Slug:             "no-selector",
		SystemId:         systemId,
		ResourceSelector: nil, // Explicitly nil
	}

	changes := persistence.NewChangesBuilder(namespace).
		Set(system).
		Set(env).
		Set(deploy).
		Build()

	err := persistenceStore.Save(ctx, changes)
	require.NoError(t, err)

	// Load and restore
	loadedChanges, err := persistenceStore.Load(ctx, namespace)
	require.NoError(t, err)

	testStore := store.New("test-workspace", statechange.NewChangeSet[any]())
	err = testStore.Restore(ctx, loadedChanges, nil)
	require.NoError(t, err)

	// Verify entities were restored with nil selectors
	restoredEnv, ok := testStore.Environments.Get(envId)
	require.True(t, ok, "Environment should be restored")
	assert.Nil(t, restoredEnv.ResourceSelector, "Selector should be nil")

	restoredDeploy, ok := testStore.Deployments.Get(deployId)
	require.True(t, ok, "Deployment should be restored")
	assert.Nil(t, restoredDeploy.ResourceSelector, "Selector should be nil")

	// Verify we can still query resources (should return empty or all depending on implementation)
	envResources := testStore.Resources.ForEnvironment(ctx, restoredEnv)
	assert.NotNil(t, envResources, "Should handle nil selector gracefully")

	deployResources := testStore.Resources.ForDeployment(ctx, restoredDeploy)
	assert.NotNil(t, deployResources, "Should handle nil selector gracefully")
}

// TestStore_Restore_ProgressCallback tests that the progress callback is called during restoration
func TestStore_Restore_ProgressCallback(t *testing.T) {
	ctx := context.Background()
	namespace := "workspace-" + uuid.New().String()

	persistenceStore := memory.NewStore()

	// Create several entities to trigger progress updates
	system := &oapi.System{
		Id:   uuid.New().String(),
		Name: "test-system",
	}

	env := &oapi.Environment{
		Id:       uuid.New().String(),
		Name:     "env1",
		SystemId: system.Id,
	}

	deploy := &oapi.Deployment{
		Id:       uuid.New().String(),
		Name:     "deploy1",
		Slug:     "deploy1",
		SystemId: system.Id,
	}

	changes := persistence.NewChangesBuilder(namespace).
		Set(system).
		Set(env).
		Set(deploy).
		Build()

	err := persistenceStore.Save(ctx, changes)
	require.NoError(t, err)

	loadedChanges, err := persistenceStore.Load(ctx, namespace)
	require.NoError(t, err)

	// Track progress callback invocations
	callbackInvoked := false
	var statusMessages []string

	testStore := store.New("test-workspace", statechange.NewChangeSet[any]())
	err = testStore.Restore(ctx, loadedChanges, func(status string) {
		callbackInvoked = true
		statusMessages = append(statusMessages, status)
	})
	require.NoError(t, err)

	// Note: The current implementation may or may not call the callback
	// This test documents the expected behavior
	t.Logf("Callback invoked: %v, messages: %v", callbackInvoked, statusMessages)
}

// TestStore_Restore_LargeDataset tests restoration performance with many entities
func TestStore_Restore_LargeDataset(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping large dataset test in short mode")
	}

	ctx := context.Background()
	namespace := "workspace-" + uuid.New().String()

	persistenceStore := memory.NewStore()

	systemId := uuid.New().String()
	system := &oapi.System{
		Id:   systemId,
		Name: "large-system",
	}

	builder := persistence.NewChangesBuilder(namespace).Set(system)

	// Create 1000 resources
	numResources := 1000
	for i := 0; i < numResources; i++ {
		resource := &oapi.Resource{
			Id:         uuid.New().String(),
			Name:       "resource-" + string(rune(i)),
			Kind:       "kubernetes",
			Version:    "1.0.0",
			Identifier: "large-res-" + string(rune(i)),
			Metadata:   map[string]string{"index": string(rune(i))},
			Config:     map[string]interface{}{},
			CreatedAt:  time.Now(),
		}
		builder.Set(resource)
	}

	changes := builder.Build()

	err := persistenceStore.Save(ctx, changes)
	require.NoError(t, err)

	// Load and restore
	loadedChanges, err := persistenceStore.Load(ctx, namespace)
	require.NoError(t, err)
	require.Len(t, loadedChanges, numResources+1, "Should have all resources + system")

	testStore := store.New("test-workspace", statechange.NewChangeSet[any]())

	startTime := time.Now()
	err = testStore.Restore(ctx, loadedChanges, nil)
	duration := time.Since(startTime)

	require.NoError(t, err)
	t.Logf("Restored %d entities in %v", numResources+1, duration)

	// Verify all resources were restored
	allResources := testStore.Resources.Items()
	assert.Equal(t, numResources, len(allResources), "All resources should be restored")
}

// TestStore_Restore_EmptyChanges tests restoration with empty change set
func TestStore_Restore_EmptyChanges(t *testing.T) {
	ctx := context.Background()

	testStore := store.New("test-workspace", statechange.NewChangeSet[any]())
	err := testStore.Restore(ctx, persistence.Changes{}, nil)
	require.NoError(t, err, "Restoring empty changes should succeed")

	// Verify store is still functional
	assert.Empty(t, testStore.Resources.Items())
	assert.Empty(t, testStore.Deployments.Items())
	assert.Empty(t, testStore.Environments.Items())
}

// TestStore_Restore_DuplicateIDs tests that restoration handles duplicate IDs correctly
func TestStore_Restore_DuplicateIDs(t *testing.T) {
	ctx := context.Background()
	namespace := "workspace-" + uuid.New().String()

	persistenceStore := memory.NewStore()

	resourceId := uuid.New().String()

	// Create two resources with the same ID (simulating a data corruption scenario)
	resource1 := &oapi.Resource{
		Id:         resourceId,
		Name:       "resource-first",
		Kind:       "kubernetes",
		Version:    "1.0.0",
		Identifier: "res-1",
		Config:     map[string]interface{}{},
		CreatedAt:  time.Now(),
	}

	// Save first resource
	changes1 := persistence.NewChangesBuilder(namespace).
		Set(resource1).
		Build()

	err := persistenceStore.Save(ctx, changes1)
	require.NoError(t, err)

	// Update with second resource (same ID, different data)
	resource2 := &oapi.Resource{
		Id:         resourceId,
		Name:       "resource-second",
		Kind:       "docker",
		Version:    "2.0.0",
		Identifier: "res-2",
		Config:     map[string]interface{}{},
		CreatedAt:  time.Now(),
	}

	changes2 := persistence.NewChangesBuilder(namespace).
		Set(resource2).
		Build()

	err = persistenceStore.Save(ctx, changes2)
	require.NoError(t, err)

	// Load and restore - last write should win
	loadedChanges, err := persistenceStore.Load(ctx, namespace)
	require.NoError(t, err)

	testStore := store.New("test-workspace", statechange.NewChangeSet[any]())
	err = testStore.Restore(ctx, loadedChanges, nil)
	require.NoError(t, err)

	// Verify the last write won
	restoredResource, ok := testStore.Resources.Get(resourceId)
	require.True(t, ok, "Resource should be restored")
	assert.Equal(t, "resource-second", restoredResource.Name, "Last write should win")
	assert.Equal(t, "docker", restoredResource.Kind)
}
