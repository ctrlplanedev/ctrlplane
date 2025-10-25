package persistence_test

import (
	"context"
	"fmt"
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

// TestPersistence_BasicSaveAndLoad tests basic save and load roundtrip
// using the persistence layer with in-memory store
func TestPersistence_BasicSaveAndLoad(t *testing.T) {
	ctx := context.Background()
	namespace := "workspace-" + uuid.New().String()

	// Create in-memory persistence store
	persistenceStore := memory.NewStore()

	// Initialize store (needed for restoration)
	testStore := store.New(statechange.NewChangeSet[any]())

	// Create some test entities
	system := &oapi.System{
		Id:          uuid.New().String(),
		Name:        "test-system",
		Description: ptr("Test system description"),
	}

	resource := &oapi.Resource{
		Id:         uuid.New().String(),
		Name:       "test-resource",
		Kind:       "kubernetes",
		Version:    "1.0.0",
		Identifier: "test-resource-1",
		Metadata:   map[string]string{"env": "production"},
		Config:     map[string]interface{}{},
		CreatedAt:  time.Now(),
	}

	deployment := &oapi.Deployment{
		Id:          uuid.New().String(),
		Name:        "test-deployment",
		Slug:        "test-dep",
		Description: ptr("Test deployment"),
		SystemId:    system.Id,
	}

	environment := &oapi.Environment{
		Id:          uuid.New().String(),
		Name:        "production",
		Description: ptr("Production environment"),
		SystemId:    system.Id,
	}

	// Build changes using the persistence builder
	changes := persistence.NewChangesBuilder(namespace).
		Set(system).
		Set(resource).
		Set(deployment).
		Set(environment).
		Build()

	// Save to persistence store
	err := persistenceStore.Save(ctx, changes)
	require.NoError(t, err)

	// Verify entities are in the store
	assert.Equal(t, 4, persistenceStore.EntityCount(namespace))

	// Load changes back from persistence store
	loadedChanges, err := persistenceStore.Load(ctx, namespace)
	require.NoError(t, err)
	require.Len(t, loadedChanges, 4)

	// Apply changes to a fresh store
	err = testStore.Repo().ApplyRegistry().Apply(ctx, loadedChanges)
	require.NoError(t, err)

	// Verify entities were restored correctly
	restoredSystem, ok := testStore.Repo().Systems.Get(system.Id)
	require.True(t, ok, "System should be restored")
	assert.Equal(t, system.Name, restoredSystem.Name)
	assert.Equal(t, system.Description, restoredSystem.Description)

	restoredResource, ok := testStore.Repo().Resources.Get(resource.Identifier)
	require.True(t, ok, "Resource should be restored")
	assert.Equal(t, resource.Name, restoredResource.Name)
	assert.Equal(t, resource.Kind, restoredResource.Kind)
	assert.Equal(t, resource.Version, restoredResource.Version)
	assert.Equal(t, resource.Metadata["env"], restoredResource.Metadata["env"])

	restoredDeployment, ok := testStore.Repo().Deployments.Get(deployment.Id)
	require.True(t, ok, "Deployment should be restored")
	assert.Equal(t, deployment.Name, restoredDeployment.Name)
	assert.Equal(t, deployment.Slug, restoredDeployment.Slug)

	restoredEnvironment, ok := testStore.Repo().Environments.Get(environment.Id)
	require.True(t, ok, "Environment should be restored")
	assert.Equal(t, environment.Name, restoredEnvironment.Name)
}

// TestPersistence_UpdateAndCompaction tests that updates are properly compacted
func TestPersistence_UpdateAndCompaction(t *testing.T) {
	ctx := context.Background()
	namespace := "workspace-" + uuid.New().String()

	persistenceStore := memory.NewStore()

	resourceId := uuid.New().String()
	resourceIdentifier := "test-resource-identifier"

	// Create initial resource
	resource1 := &oapi.Resource{
		Id:         resourceId,
		Name:       "initial-name",
		Kind:       "kubernetes",
		Version:    "1.0.0",
		Identifier: resourceIdentifier,
		Metadata:   map[string]string{},
		Config:     map[string]interface{}{},
		CreatedAt:  time.Now(),
	}

	changes1 := persistence.NewChangesBuilder(namespace).
		Set(resource1).
		Build()

	err := persistenceStore.Save(ctx, changes1)
	require.NoError(t, err)

	// Wait a moment to ensure timestamp difference
	time.Sleep(2 * time.Millisecond)

	// Update resource with same Identifier (for compaction)
	resource2 := &oapi.Resource{
		Id:         uuid.New().String(), // Different ID is OK
		Name:       "updated-name",
		Kind:       "kubernetes",
		Version:    "2.0.0",
		Identifier: resourceIdentifier, // Same Identifier for compaction
		Metadata:   map[string]string{},
		Config:     map[string]interface{}{},
		CreatedAt:  time.Now(),
	}

	changes2 := persistence.NewChangesBuilder(namespace).
		Set(resource2).
		Build()

	err = persistenceStore.Save(ctx, changes2)
	require.NoError(t, err)

	// Should still have only 1 entity due to compaction
	assert.Equal(t, 1, persistenceStore.EntityCount(namespace))

	// Load and verify we get the latest version
	loadedChanges, err := persistenceStore.Load(ctx, namespace)
	require.NoError(t, err)
	require.Len(t, loadedChanges, 1)

	// Apply to store and check it's the updated version
	testStore := store.New(statechange.NewChangeSet[any]())
	err = testStore.Repo().ApplyRegistry().Apply(ctx, loadedChanges)
	require.NoError(t, err)

	restoredResource, ok := testStore.Repo().Resources.Get(resourceIdentifier)
	require.True(t, ok)
	assert.Equal(t, "updated-name", restoredResource.Name)
	assert.Equal(t, "2.0.0", restoredResource.Version)
}

// TestPersistence_DeleteEntity tests that entity deletion is tracked
func TestPersistence_DeleteEntity(t *testing.T) {
	ctx := context.Background()
	namespace := "workspace-" + uuid.New().String()

	persistenceStore := memory.NewStore()

	resourceIdentifier := "test-resource-delete"

	// Create resource
	resource := &oapi.Resource{
		Id:         uuid.New().String(),
		Name:       "test-resource",
		Kind:       "kubernetes",
		Version:    "1.0.0",
		Identifier: resourceIdentifier,
		Metadata:   map[string]string{},
		Config:     map[string]interface{}{},
		CreatedAt:  time.Now(),
	}

	changes1 := persistence.NewChangesBuilder(namespace).
		Set(resource).
		Build()

	err := persistenceStore.Save(ctx, changes1)
	require.NoError(t, err)
	assert.Equal(t, 1, persistenceStore.EntityCount(namespace))

	// Delete resource
	changes2 := persistence.NewChangesBuilder(namespace).
		Unset(resource).
		Build()

	err = persistenceStore.Save(ctx, changes2)
	require.NoError(t, err)

	// Load and verify delete change is tracked
	loadedChanges, err := persistenceStore.Load(ctx, namespace)
	require.NoError(t, err)
	require.Len(t, loadedChanges, 1)
	assert.Equal(t, persistence.ChangeTypeUnset, loadedChanges[0].ChangeType)

	// Apply to store and verify resource is removed
	testStore := store.New(statechange.NewChangeSet[any]())
	// First add it
	testStore.Repo().Resources.Set(resourceIdentifier, resource)
	require.True(t, testStore.Repo().Resources.Has(resourceIdentifier))

	// Now apply the unset change
	err = testStore.Repo().ApplyRegistry().Apply(ctx, loadedChanges)
	require.NoError(t, err)

	// Resource should be removed
	assert.False(t, testStore.Repo().Resources.Has(resourceIdentifier))
}

// TestPersistence_MultipleNamespaces tests isolation between namespaces
func TestPersistence_MultipleNamespaces(t *testing.T) {
	ctx := context.Background()
	persistenceStore := memory.NewStore()

	namespace1 := "workspace-1"
	namespace2 := "workspace-2"

	// Create entities in namespace 1
	system1 := &oapi.System{
		Id:   uuid.New().String(),
		Name: "system-1",
	}

	changes1 := persistence.NewChangesBuilder(namespace1).
		Set(system1).
		Build()

	err := persistenceStore.Save(ctx, changes1)
	require.NoError(t, err)

	// Create entities in namespace 2
	system2 := &oapi.System{
		Id:   uuid.New().String(),
		Name: "system-2",
	}

	changes2 := persistence.NewChangesBuilder(namespace2).
		Set(system2).
		Build()

	err = persistenceStore.Save(ctx, changes2)
	require.NoError(t, err)

	// Verify namespace counts
	assert.Equal(t, 2, persistenceStore.NamespaceCount())
	assert.Equal(t, 1, persistenceStore.EntityCount(namespace1))
	assert.Equal(t, 1, persistenceStore.EntityCount(namespace2))

	// Load from namespace 1
	loaded1, err := persistenceStore.Load(ctx, namespace1)
	require.NoError(t, err)
	require.Len(t, loaded1, 1)

	// Load from namespace 2
	loaded2, err := persistenceStore.Load(ctx, namespace2)
	require.NoError(t, err)
	require.Len(t, loaded2, 1)

	// Verify correct entities in each namespace
	testStore1 := store.New(statechange.NewChangeSet[any]())
	err = testStore1.Repo().ApplyRegistry().Apply(ctx, loaded1)
	require.NoError(t, err)

	restoredSystem1, ok := testStore1.Repo().Systems.Get(system1.Id)
	require.True(t, ok)
	assert.Equal(t, "system-1", restoredSystem1.Name)

	testStore2 := store.New(statechange.NewChangeSet[any]())
	err = testStore2.Repo().ApplyRegistry().Apply(ctx, loaded2)
	require.NoError(t, err)

	restoredSystem2, ok := testStore2.Repo().Systems.Get(system2.Id)
	require.True(t, ok)
	assert.Equal(t, "system-2", restoredSystem2.Name)
}

// TestPersistence_AllEntityTypes tests all entity types can be persisted
func TestPersistence_AllEntityTypes(t *testing.T) {
	ctx := context.Background()
	namespace := "workspace-" + uuid.New().String()

	persistenceStore := memory.NewStore()

	systemId := uuid.New().String()
	deploymentId := uuid.New().String()
	resourceId := uuid.New().String()

	// Create one of each entity type
	system := &oapi.System{
		Id:   systemId,
		Name: "test-system",
	}

	resource := &oapi.Resource{
		Id:         resourceId,
		Name:       "test-resource",
		Kind:       "kubernetes",
		Version:    "1.0.0",
		Identifier: "test-res",
		Metadata:   map[string]string{},
		Config:     map[string]interface{}{},
		CreatedAt:  time.Now(),
	}

	providerId := uuid.New().String()
	workspaceUUID := uuid.New()
	resourceProvider := &oapi.ResourceProvider{
		Id:          providerId,
		Name:        "test-provider",
		Metadata:    map[string]string{},
		CreatedAt:   time.Now(),
		WorkspaceId: workspaceUUID,
	}

	literalValue := oapi.LiteralValue{}
	literalValue.FromStringValue("test-value")
	value := oapi.Value{}
	value.FromLiteralValue(literalValue)

	resourceVariable := &oapi.ResourceVariable{
		ResourceId: resourceId,
		Key:        "test-key",
		Value:      value,
	}

	deployment := &oapi.Deployment{
		Id:       deploymentId,
		Name:     "test-deployment",
		Slug:     "test-dep",
		SystemId: systemId,
	}

	deploymentVersion := &oapi.DeploymentVersion{
		Id:           uuid.New().String(),
		DeploymentId: deploymentId,
		Tag:          "v1.0.0",
	}

	deploymentVariable := &oapi.DeploymentVariable{
		Id:           uuid.New().String(),
		DeploymentId: deploymentId,
		Key:          "VAR",
	}

	environment := &oapi.Environment{
		Id:       uuid.New().String(),
		Name:     "production",
		SystemId: systemId,
	}

	policy := &oapi.Policy{
		Id:          uuid.New().String(),
		Name:        "test-policy",
		Description: ptr("Test policy"),
		WorkspaceId: uuid.New().String(),
		CreatedAt:   time.Now().Format(time.RFC3339),
		Metadata:    map[string]string{},
		Rules:       []oapi.PolicyRule{},
		Selectors:   []oapi.PolicyTargetSelector{},
	}

	jobAgent := &oapi.JobAgent{
		Id:   uuid.New().String(),
		Name: "test-agent",
		Type: "kubernetes",
	}

	job := &oapi.Job{
		Id:        uuid.New().String(),
		Status:    "pending",
		ReleaseId: uuid.New().String(),
	}

	matcher := oapi.RelationshipRule_Matcher{}
	relationshipRule := &oapi.RelationshipRule{
		Id:               uuid.New().String(),
		Name:             "test-relationship",
		Description:      ptr("Test relationship"),
		FromType:         "resource",
		ToType:           "deployment",
		Reference:        "test-ref",
		RelationshipType: "uses",
		Matcher:          matcher,
		Metadata:         map[string]string{},
		WorkspaceId:      uuid.New().String(),
	}

	githubEntity := &oapi.GithubEntity{
		Slug:           "test-repo",
		InstallationId: 12345,
	}

	userApprovalRecord := &oapi.UserApprovalRecord{
		VersionId:     uuid.New().String(),
		UserId:        "user-123",
		EnvironmentId: uuid.New().String(),
		Status:        "approved",
		CreatedAt:     time.Now().Format(time.RFC3339),
	}

	// Build changes with all entity types
	changes := persistence.NewChangesBuilder(namespace).
		Set(system).
		Set(resource).
		Set(resourceProvider).
		Set(resourceVariable).
		Set(deployment).
		Set(deploymentVersion).
		Set(deploymentVariable).
		Set(environment).
		Set(policy).
		Set(jobAgent).
		Set(job).
		Set(relationshipRule).
		Set(githubEntity).
		Set(userApprovalRecord).
		Build()

	// Save all entities
	err := persistenceStore.Save(ctx, changes)
	require.NoError(t, err)

	// Verify count
	assert.Equal(t, 14, persistenceStore.EntityCount(namespace))

	// Load everything back
	loadedChanges, err := persistenceStore.Load(ctx, namespace)
	require.NoError(t, err)
	require.Len(t, loadedChanges, 14)

	// Apply to fresh store
	testStore := store.New(statechange.NewChangeSet[any]())
	err = testStore.Repo().ApplyRegistry().Apply(ctx, loadedChanges)
	require.NoError(t, err)

	// Verify each entity type was restored
	_, ok := testStore.Repo().Systems.Get(systemId)
	assert.True(t, ok, "System should be restored")

	_, ok = testStore.Repo().Resources.Get(resource.Identifier)
	assert.True(t, ok, "Resource should be restored")

	_, ok = testStore.Repo().ResourceProviders.Get(resourceProvider.Id)
	assert.True(t, ok, "ResourceProvider should be restored")

	_, ok = testStore.Repo().ResourceVariables.Get(resourceVariable.ID())
	assert.True(t, ok, "ResourceVariable should be restored")

	_, ok = testStore.Repo().Deployments.Get(deploymentId)
	assert.True(t, ok, "Deployment should be restored")

	_, ok = testStore.Repo().DeploymentVersions.Get(deploymentVersion.Id)
	assert.True(t, ok, "DeploymentVersion should be restored")

	_, ok = testStore.Repo().DeploymentVariables.Get(deploymentVariable.Id)
	assert.True(t, ok, "DeploymentVariable should be restored")

	_, ok = testStore.Repo().Environments.Get(environment.Id)
	assert.True(t, ok, "Environment should be restored")

	_, ok = testStore.Repo().Policies.Get(policy.Id)
	assert.True(t, ok, "Policy should be restored")

	_, ok = testStore.Repo().JobAgents.Get(jobAgent.Id)
	assert.True(t, ok, "JobAgent should be restored")

	_, ok = testStore.Repo().Jobs.Get(job.Id)
	assert.True(t, ok, "Job should be restored")

	_, ok = testStore.Repo().RelationshipRules.Get(relationshipRule.Id)
	assert.True(t, ok, "RelationshipRule should be restored")

	githubEntityKey := githubEntity.Slug + "-" + fmt.Sprintf("%d", githubEntity.InstallationId)
	_, ok = testStore.Repo().GithubEntities.Get(githubEntityKey)
	assert.True(t, ok, "GithubEntity should be restored")

	_, ok = testStore.Repo().UserApprovalRecords.Get(userApprovalRecord.Key())
	assert.True(t, ok, "UserApprovalRecord should be restored")
}

// TestPersistence_ComplexWorkspaceWithComputedValues tests persistence of a
// full workspace including releases, jobs, and verifies computed values are
// correctly restored
func TestPersistence_ComplexWorkspaceWithComputedValues(t *testing.T) {
	ctx := context.Background()
	namespace := "workspace-" + uuid.New().String()

	persistenceStore := memory.NewStore()

	// Create a complete workspace structure
	systemId := uuid.New().String()
	deploymentId := uuid.New().String()
	envId := uuid.New().String()
	resourceId := uuid.New().String()
	versionId := uuid.New().String()
	jobAgentId := uuid.New().String()

	// Create system
	system := &oapi.System{
		Id:   systemId,
		Name: "production-system",
	}

	// Create deployment
	deployment := &oapi.Deployment{
		Id:       deploymentId,
		Name:     "web-app",
		Slug:     "web-app",
		SystemId: systemId,
	}

	// Create environment
	environment := &oapi.Environment{
		Id:       envId,
		Name:     "production",
		SystemId: systemId,
	}

	// Create resource
	resource := &oapi.Resource{
		Id:         resourceId,
		Name:       "web-server-1",
		Kind:       "kubernetes",
		Version:    "1.0.0",
		Identifier: "web-server-1",
		Metadata:   map[string]string{"cluster": "us-east-1"},
		Config:     map[string]interface{}{},
		CreatedAt:  time.Now(),
	}

	// Create deployment version
	deploymentVersion := &oapi.DeploymentVersion{
		Id:           versionId,
		DeploymentId: deploymentId,
		Tag:          "v1.2.3",
	}

	// Create job agent
	jobAgent := &oapi.JobAgent{
		Id:   jobAgentId,
		Name: "k8s-agent",
		Type: "kubernetes",
	}

	// Create release
	releaseId := uuid.New().String()
	replicasValue := oapi.LiteralValue{}
	replicasValue.FromStringValue("3")

	release := &oapi.Release{
		Version: oapi.DeploymentVersion{
			Id:           versionId,
			DeploymentId: deploymentId,
			Tag:          "v1.2.3",
		},
		ReleaseTarget: oapi.ReleaseTarget{
			ResourceId:    resourceId,
			EnvironmentId: envId,
			DeploymentId:  deploymentId,
		},
		Variables: map[string]oapi.LiteralValue{
			"replicas": replicasValue,
		},
		CreatedAt:          time.Now().Format(time.RFC3339),
		EncryptedVariables: []string{},
	}

	// Create jobs with different statuses
	jobPending := &oapi.Job{
		Id:        uuid.New().String(),
		Status:    "pending",
		ReleaseId: releaseId,
	}

	jobInProgress := &oapi.Job{
		Id:        uuid.New().String(),
		Status:    "in_progress",
		ReleaseId: releaseId,
	}

	jobCompleted := &oapi.Job{
		Id:        uuid.New().String(),
		Status:    "completed",
		ReleaseId: releaseId,
	}

	// Build and save all changes
	changes := persistence.NewChangesBuilder(namespace).
		Set(system).
		Set(deployment).
		Set(environment).
		Set(resource).
		Set(deploymentVersion).
		Set(jobAgent).
		Set(release).
		Set(jobPending).
		Set(jobInProgress).
		Set(jobCompleted).
		Build()

	err := persistenceStore.Save(ctx, changes)
	require.NoError(t, err)

	// Verify all entities were saved
	assert.Equal(t, 10, persistenceStore.EntityCount(namespace))

	// Now load into a fresh workspace store
	loadedChanges, err := persistenceStore.Load(ctx, namespace)
	require.NoError(t, err)
	require.Len(t, loadedChanges, 10)

	// Apply to a new store
	newStore := store.New(statechange.NewChangeSet[any]())
	err = newStore.Repo().ApplyRegistry().Apply(ctx, loadedChanges)
	require.NoError(t, err)

	// Verify all base entities are restored
	restoredSystem, ok := newStore.Repo().Systems.Get(systemId)
	require.True(t, ok, "System should be restored")
	assert.Equal(t, "production-system", restoredSystem.Name)

	restoredDeployment, ok := newStore.Repo().Deployments.Get(deploymentId)
	require.True(t, ok, "Deployment should be restored")
	assert.Equal(t, "web-app", restoredDeployment.Name)

	restoredEnv, ok := newStore.Repo().Environments.Get(envId)
	require.True(t, ok, "Environment should be restored")
	assert.Equal(t, "production", restoredEnv.Name)

	restoredResource, ok := newStore.Repo().Resources.Get(resource.Identifier)
	require.True(t, ok, "Resource should be restored")
	assert.Equal(t, "web-server-1", restoredResource.Name)
	assert.Equal(t, "us-east-1", restoredResource.Metadata["cluster"])

	restoredVersion, ok := newStore.Repo().DeploymentVersions.Get(versionId)
	require.True(t, ok, "DeploymentVersion should be restored")
	assert.Equal(t, "v1.2.3", restoredVersion.Tag)

	restoredJobAgent, ok := newStore.Repo().JobAgents.Get(jobAgentId)
	require.True(t, ok, "JobAgent should be restored")
	assert.Equal(t, "k8s-agent", restoredJobAgent.Name)

	restoredRelease, ok := newStore.Repo().Releases.Get(release.ID())
	require.True(t, ok, "Release should be restored")
	assert.Equal(t, "v1.2.3", restoredRelease.Version.Tag)

	// Verify all jobs are restored with their statuses
	restoredJobPending, ok := newStore.Repo().Jobs.Get(jobPending.Id)
	require.True(t, ok, "Pending job should be restored")
	assert.Equal(t, "pending", string(restoredJobPending.Status))

	restoredJobInProgress, ok := newStore.Repo().Jobs.Get(jobInProgress.Id)
	require.True(t, ok, "In-progress job should be restored")
	assert.Equal(t, "in_progress", string(restoredJobInProgress.Status))

	restoredJobCompleted, ok := newStore.Repo().Jobs.Get(jobCompleted.Id)
	require.True(t, ok, "Completed job should be restored")
	assert.Equal(t, "completed", string(restoredJobCompleted.Status))

	// Verify all jobs are present
	assert.Equal(t, 3, newStore.Repo().Jobs.Count(), "All 3 jobs should be restored")
}

// TestPersistence_ConcurrentSaveAndLoad tests thread-safety of persistence operations
func TestPersistence_ConcurrentSaveAndLoad(t *testing.T) {
	ctx := context.Background()
	persistenceStore := memory.NewStore()

	numWorkspaces := 10
	entitiesPerWorkspace := 5

	// Concurrently save to multiple workspaces
	for i := range numWorkspaces {
		go func(workspaceNum int) {
			namespace := fmt.Sprintf("workspace-%d", workspaceNum)

			for j := range entitiesPerWorkspace {
				system := &oapi.System{
					Id:   fmt.Sprintf("sys-%d-%d", workspaceNum, j),
					Name: fmt.Sprintf("System %d-%d", workspaceNum, j),
				}

				changes := persistence.NewChangesBuilder(namespace).
					Set(system).
					Build()

				_ = persistenceStore.Save(ctx, changes)
			}
		}(i)
	}

	// Give goroutines time to complete
	time.Sleep(100 * time.Millisecond)

	// Verify all workspaces and entities
	assert.Equal(t, numWorkspaces, persistenceStore.NamespaceCount())

	// Verify each workspace has the right number of entities
	for i := range numWorkspaces {
		namespace := fmt.Sprintf("workspace-%d", i)
		assert.Equal(t, entitiesPerWorkspace, persistenceStore.EntityCount(namespace),
			"Workspace %s should have %d entities", namespace, entitiesPerWorkspace)
	}
}

// Helper function to create string pointers
func ptr(s string) *string {
	return &s
}
