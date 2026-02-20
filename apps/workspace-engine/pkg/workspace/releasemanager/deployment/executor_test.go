package deployment

import (
	"context"
	"encoding/json"
	"testing"
	"time"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/statechange"
	"workspace-engine/pkg/workspace/jobagents"
	"workspace-engine/pkg/workspace/releasemanager/verification"
	"workspace-engine/pkg/workspace/store"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ===== Test Helper Functions =====

func setupTestExecutor(t *testing.T) (*Executor, *store.Store) {
	t.Helper()
	cs := statechange.NewChangeSet[any]()
	testStore := store.New("test-workspace", cs)
	testVerification := verification.NewManager(testStore)
	testJobAgentRegistry := jobagents.NewRegistry(testStore, testVerification)
	executor := NewExecutor(testStore, testJobAgentRegistry)
	return executor, testStore
}

func createTestJobAgent(id, workspaceID, name, agentType string) *oapi.JobAgent {
	customJobAgentConfig := oapi.JobAgentConfig{}
	_ = json.Unmarshal([]byte(`{"type": "custom"}`), &customJobAgentConfig)
	return &oapi.JobAgent{
		Id:          id,
		WorkspaceId: workspaceID,
		Name:        name,
		Type:        agentType,
		Config:      customJobAgentConfig,
	}
}

func createTestDeploymentForExecutor(id, systemID, name, jobAgentID string) *oapi.Deployment {
	selector := &oapi.Selector{}
	_ = selector.FromCelSelector(oapi.CelSelector{Cel: "true"})

	return &oapi.Deployment{
		Id:               id,
		Name:             name,
		Slug:             name,
		ResourceSelector: selector,
		JobAgentId:       &jobAgentID,
		JobAgentConfig:   oapi.JobAgentConfig{},
	}
}

func createTestEnvironmentForExecutor(id, systemID, name string) *oapi.Environment {
	selector := &oapi.Selector{}
	_ = selector.FromCelSelector(oapi.CelSelector{Cel: "true"})
	return &oapi.Environment{
		Id:               id,
		Name:             name,
		ResourceSelector: selector,
	}
}

func createTestResourceForExecutor(id, name, workspaceID string) *oapi.Resource {
	return &oapi.Resource{
		Id:          id,
		Name:        name,
		Kind:        "",
		Identifier:  name,
		CreatedAt:   time.Now(),
		Config:      map[string]any{},
		Metadata:    map[string]string{},
		WorkspaceId: workspaceID,
	}
}

func createTestRelease(deploymentID, environmentID, resourceID, versionID, versionTag string) *oapi.Release {
	return &oapi.Release{
		ReleaseTarget: oapi.ReleaseTarget{
			DeploymentId:  deploymentID,
			EnvironmentId: environmentID,
			ResourceId:    resourceID,
		},
		Version: oapi.DeploymentVersion{
			Id:  versionID,
			Tag: versionTag,
		},
		Variables:          map[string]oapi.LiteralValue{},
		EncryptedVariables: []string{},
		CreatedAt:          time.Now().Format(time.RFC3339),
	}
}

// ===== ExecuteRelease Tests =====

func TestExecuteRelease_Success(t *testing.T) {
	executor, testStore := setupTestExecutor(t)
	ctx := context.Background()

	// Setup test data
	workspaceID := uuid.New().String()
	systemID := uuid.New().String()
	deploymentID := uuid.New().String()
	environmentID := uuid.New().String()
	resourceID := uuid.New().String()
	versionID := uuid.New().String()
	jobAgentID := uuid.New().String()

	// Create necessary entities in store
	jobAgent := createTestJobAgent(jobAgentID, workspaceID, "test-agent", "test-runner")
	testStore.JobAgents.Upsert(ctx, jobAgent)

	deployment := createTestDeploymentForExecutor(deploymentID, systemID, "test-deployment", jobAgentID)
	_ = testStore.Deployments.Upsert(ctx, deployment)

	environment := createTestEnvironmentForExecutor(environmentID, systemID, "test-environment")
	_ = testStore.Environments.Upsert(ctx, environment)

	resource := createTestResourceForExecutor(resourceID, "test-resource", workspaceID)
	_, _ = testStore.Resources.Upsert(ctx, resource)

	// Create release
	release := createTestRelease(deploymentID, environmentID, resourceID, versionID, "v1.0.0")

	// Execute release
	jobs, err := executor.ExecuteRelease(ctx, release, nil)

	// Assertions
	require.NoError(t, err)
	require.Len(t, jobs, 1)
	job := jobs[0]
	assert.Equal(t, release.ID(), job.ReleaseId)
	assert.Equal(t, oapi.JobStatusPending, job.Status)
	assert.Equal(t, jobAgentID, job.JobAgentId)

	// Verify release was persisted
	storedRelease, exists := testStore.Releases.Get(release.ID())
	require.True(t, exists)
	assert.Equal(t, release.ID(), storedRelease.ID())

	// Verify job was persisted
	storedJob, exists := testStore.Jobs.Get(job.Id)
	require.True(t, exists)
	assert.Equal(t, job.Id, storedJob.Id)
	assert.Equal(t, job.ReleaseId, storedJob.ReleaseId)
}

func TestExecuteRelease_MultipleDeploymentJobAgents_MergesSelectedAgentConfig(t *testing.T) {
	executor, testStore := setupTestExecutor(t)
	ctx := context.Background()

	workspaceID := uuid.New().String()
	systemID := uuid.New().String()
	deploymentID := uuid.New().String()
	environmentID := uuid.New().String()
	resourceID := uuid.New().String()
	versionID := uuid.New().String()
	selectedAgentID := uuid.New().String()
	otherAgentID := uuid.New().String()

	selectedAgent := createTestJobAgent(selectedAgentID, workspaceID, "selected-agent", "argocd")
	selectedAgent.Config = oapi.JobAgentConfig{
		"template": "agent-template",
		"timeout":  30,
	}
	otherAgent := createTestJobAgent(otherAgentID, workspaceID, "other-agent", "argocd")
	otherAgent.Config = oapi.JobAgentConfig{
		"template": "other-template",
	}
	testStore.JobAgents.Upsert(ctx, selectedAgent)
	testStore.JobAgents.Upsert(ctx, otherAgent)

	deployment := createTestDeploymentForExecutor(deploymentID, systemID, "test-deployment", selectedAgentID)
	deployment.JobAgentConfig = oapi.JobAgentConfig{
		"template": "deployment-template",
		"retries":  3,
	}
	deployment.JobAgents = &[]oapi.DeploymentJobAgent{
		{
			Ref:      selectedAgentID,
			Selector: "true",
			Config: oapi.JobAgentConfig{
				"template": "selected-deployment-agent-template",
				"timeout":  60,
			},
		},
		{
			Ref:      otherAgentID,
			Selector: "false",
			Config: oapi.JobAgentConfig{
				"template": "should-not-be-used",
			},
		},
	}
	_ = testStore.Deployments.Upsert(ctx, deployment)

	environment := createTestEnvironmentForExecutor(environmentID, systemID, "test-environment")
	_ = testStore.Environments.Upsert(ctx, environment)

	resource := createTestResourceForExecutor(resourceID, "test-resource", workspaceID)
	_, _ = testStore.Resources.Upsert(ctx, resource)

	release := createTestRelease(deploymentID, environmentID, resourceID, versionID, "v1.0.0")

	jobs, err := executor.ExecuteRelease(ctx, release, nil)
	require.NoError(t, err)
	require.Len(t, jobs, 1)

	job := jobs[0]
	assert.Equal(t, selectedAgentID, job.JobAgentId)
	assert.Equal(t, "selected-deployment-agent-template", job.JobAgentConfig["template"])
	assert.Equal(t, 60, job.JobAgentConfig["timeout"])
	assert.Equal(t, 3, job.JobAgentConfig["retries"])
}

func TestExecuteRelease_NoJobAgentConfigured(t *testing.T) {
	executor, testStore := setupTestExecutor(t)
	ctx := context.Background()

	// Setup test data - deployment with no job agent
	deploymentID := uuid.New().String()
	environmentID := uuid.New().String()
	resourceID := uuid.New().String()
	versionID := uuid.New().String()

	// Create deployment without job agent
	selector := &oapi.Selector{}
	_ = selector.FromCelSelector(oapi.CelSelector{Cel: "true"})
	deployment := &oapi.Deployment{
		Id:               deploymentID,
		Name:             "test-deployment",
		ResourceSelector: selector,
		JobAgentId:       nil, // No job agent
		JobAgentConfig:   oapi.JobAgentConfig{},
	}
	_ = testStore.Deployments.Upsert(ctx, deployment)

	// Create release
	release := createTestRelease(deploymentID, environmentID, resourceID, versionID, "v1.0.0")

	// Execute release
	jobs, err := executor.ExecuteRelease(ctx, release, nil)

	require.NoError(t, err)
	require.Len(t, jobs, 1)
	require.Equal(t, oapi.JobStatusInvalidJobAgent, jobs[0].Status)

	// Verify release was still persisted
	_, exists := testStore.Releases.Get(release.ID())
	require.True(t, exists)
}

func TestExecuteRelease_DeploymentNotFound(t *testing.T) {
	executor, _ := setupTestExecutor(t)
	ctx := context.Background()

	// Create release with non-existent deployment
	deploymentID := uuid.New().String()
	environmentID := uuid.New().String()
	resourceID := uuid.New().String()
	versionID := uuid.New().String()

	release := createTestRelease(deploymentID, environmentID, resourceID, versionID, "v1.0.0")

	// Execute release - should fail because deployment doesn't exist
	jobs, err := executor.ExecuteRelease(ctx, release, nil)

	// Assertions
	require.Error(t, err)
	assert.Nil(t, jobs)
	assert.Contains(t, err.Error(), "deployment")
}

func TestExecuteRelease_SkipsDispatchForInvalidJobAgent(t *testing.T) {
	executor, testStore := setupTestExecutor(t)
	ctx := context.Background()

	// Setup test data - deployment with invalid job agent ID
	systemID := uuid.New().String()
	deploymentID := uuid.New().String()
	environmentID := uuid.New().String()
	resourceID := uuid.New().String()
	versionID := uuid.New().String()
	nonExistentJobAgentID := uuid.New().String()

	// Create deployment with non-existent job agent
	deployment := createTestDeploymentForExecutor(deploymentID, systemID, "test-deployment", nonExistentJobAgentID)
	_ = testStore.Deployments.Upsert(ctx, deployment)

	// Create release
	release := createTestRelease(deploymentID, environmentID, resourceID, versionID, "v1.0.0")

	// Execute release
	jobs, err := executor.ExecuteRelease(ctx, release, nil)

	// Assertions
	require.NoError(t, err)
	require.Len(t, jobs, 1)
	job := jobs[0]
	assert.Equal(t, oapi.JobStatusInvalidJobAgent, job.Status)

	// Give a moment for any async operations to complete
	time.Sleep(10 * time.Millisecond)

	// Verify job status is still InvalidJobAgent (dispatch was skipped)
	storedJob, exists := testStore.Jobs.Get(job.Id)
	require.True(t, exists)
	assert.Equal(t, oapi.JobStatusInvalidJobAgent, storedJob.Status)
}

func TestExecuteRelease_MultipleReleases(t *testing.T) {
	executor, testStore := setupTestExecutor(t)
	ctx := context.Background()

	// Setup test data
	workspaceID := uuid.New().String()
	systemID := uuid.New().String()
	deploymentID := uuid.New().String()
	environmentID := uuid.New().String()
	resourceID := uuid.New().String()
	jobAgentID := uuid.New().String()

	// Create necessary entities
	jobAgent := createTestJobAgent(jobAgentID, workspaceID, "test-agent", "test-runner")
	testStore.JobAgents.Upsert(ctx, jobAgent)

	deployment := createTestDeploymentForExecutor(deploymentID, systemID, "test-deployment", jobAgentID)
	_ = testStore.Deployments.Upsert(ctx, deployment)

	environment := createTestEnvironmentForExecutor(environmentID, systemID, "test-environment")
	_ = testStore.Environments.Upsert(ctx, environment)

	resource := createTestResourceForExecutor(resourceID, "test-resource", workspaceID)
	_, _ = testStore.Resources.Upsert(ctx, resource)

	// Create and execute multiple releases
	releases := []*oapi.Release{
		createTestRelease(deploymentID, environmentID, resourceID, uuid.New().String(), "v1.0.0"),
		createTestRelease(deploymentID, environmentID, resourceID, uuid.New().String(), "v2.0.0"),
		createTestRelease(deploymentID, environmentID, resourceID, uuid.New().String(), "v3.0.0"),
	}

	allJobs := make([]*oapi.Job, 0, len(releases))
	for _, release := range releases {
		jobs, err := executor.ExecuteRelease(ctx, release, nil)
		require.NoError(t, err)
		require.Len(t, jobs, 1)
		allJobs = append(allJobs, jobs[0])
	}

	// Verify all releases and jobs were persisted
	assert.Len(t, allJobs, 3)

	for i, job := range allJobs {
		// Verify each job has correct release ID
		assert.Equal(t, releases[i].ID(), job.ReleaseId)

		// Verify job was persisted
		storedJob, exists := testStore.Jobs.Get(job.Id)
		require.True(t, exists)
		assert.Equal(t, job.Id, storedJob.Id)

		// Verify release was persisted
		storedRelease, exists := testStore.Releases.Get(releases[i].ID())
		require.True(t, exists)
		assert.Equal(t, releases[i].ID(), storedRelease.ID())
	}
}

// ===== BuildRelease Tests =====

func TestBuildRelease_Success(t *testing.T) {
	ctx := context.Background()

	releaseTarget := &oapi.ReleaseTarget{
		DeploymentId:  uuid.New().String(),
		EnvironmentId: uuid.New().String(),
		ResourceId:    uuid.New().String(),
	}

	version := &oapi.DeploymentVersion{
		Id:  uuid.New().String(),
		Tag: "v1.0.0",
	}

	// Create test variables
	replicas := oapi.LiteralValue{}
	require.NoError(t, replicas.FromIntegerValue(3))

	region := oapi.LiteralValue{}
	require.NoError(t, region.FromStringValue("us-west-2"))

	variables := map[string]*oapi.LiteralValue{
		"replicas": &replicas,
		"region":   &region,
	}

	// Build release
	release := BuildRelease(ctx, releaseTarget, version, variables)

	// Assertions
	require.NotNil(t, release)
	assert.Equal(t, releaseTarget.DeploymentId, release.ReleaseTarget.DeploymentId)
	assert.Equal(t, releaseTarget.EnvironmentId, release.ReleaseTarget.EnvironmentId)
	assert.Equal(t, releaseTarget.ResourceId, release.ReleaseTarget.ResourceId)
	assert.Equal(t, version.Id, release.Version.Id)
	assert.Equal(t, version.Tag, release.Version.Tag)
	assert.Len(t, release.Variables, 2)
	assert.Contains(t, release.Variables, "replicas")
	assert.Contains(t, release.Variables, "region")
	assert.NotEmpty(t, release.CreatedAt)
	assert.Empty(t, release.EncryptedVariables)
}

func TestBuildRelease_EmptyVariables(t *testing.T) {
	ctx := context.Background()

	releaseTarget := &oapi.ReleaseTarget{
		DeploymentId:  uuid.New().String(),
		EnvironmentId: uuid.New().String(),
		ResourceId:    uuid.New().String(),
	}

	version := &oapi.DeploymentVersion{
		Id:  uuid.New().String(),
		Tag: "v2.0.0",
	}

	// Build release with no variables
	release := BuildRelease(ctx, releaseTarget, version, nil)

	// Assertions
	require.NotNil(t, release)
	assert.Empty(t, release.Variables)
	assert.Equal(t, version.Id, release.Version.Id)
	assert.Equal(t, version.Tag, release.Version.Tag)
}

func TestBuildRelease_VariableCloning(t *testing.T) {
	ctx := context.Background()

	releaseTarget := &oapi.ReleaseTarget{
		DeploymentId:  uuid.New().String(),
		EnvironmentId: uuid.New().String(),
		ResourceId:    uuid.New().String(),
	}

	version := &oapi.DeploymentVersion{
		Id:  uuid.New().String(),
		Tag: "v1.0.0",
	}

	// Create original variables
	replicas := oapi.LiteralValue{}
	require.NoError(t, replicas.FromIntegerValue(3))

	originalVars := map[string]*oapi.LiteralValue{
		"replicas": &replicas,
	}

	// Build release
	release := BuildRelease(ctx, releaseTarget, version, originalVars)

	// Modify original variables after building release
	newReplicas := oapi.LiteralValue{}
	require.NoError(t, newReplicas.FromIntegerValue(5))
	originalVars["replicas"] = &newReplicas
	originalVars["new_key"] = &newReplicas

	// Verify release variables are not affected by changes to original
	releaseReplicas, exists := release.Variables["replicas"]
	require.True(t, exists)

	replicasInt, err := releaseReplicas.AsIntegerValue()
	require.NoError(t, err)
	assert.Equal(t, int(3), replicasInt) // Original value

	// Verify new key doesn't exist in release
	_, exists = release.Variables["new_key"]
	assert.False(t, exists)
}

func TestBuildRelease_NilVariablePointers(t *testing.T) {
	ctx := context.Background()

	releaseTarget := &oapi.ReleaseTarget{
		DeploymentId:  uuid.New().String(),
		EnvironmentId: uuid.New().String(),
		ResourceId:    uuid.New().String(),
	}

	version := &oapi.DeploymentVersion{
		Id:  uuid.New().String(),
		Tag: "v1.0.0",
	}

	replicas := oapi.LiteralValue{}
	require.NoError(t, replicas.FromIntegerValue(3))

	// Create variables map with nil pointer
	variables := map[string]*oapi.LiteralValue{
		"replicas": &replicas,
		"empty":    nil, // Nil pointer
	}

	// Build release
	release := BuildRelease(ctx, releaseTarget, version, variables)

	// Assertions
	require.NotNil(t, release)
	// Only non-nil variables should be included
	assert.Len(t, release.Variables, 1)
	assert.Contains(t, release.Variables, "replicas")
	assert.NotContains(t, release.Variables, "empty")
}

func TestBuildRelease_DifferentVariableTypes(t *testing.T) {
	ctx := context.Background()

	releaseTarget := &oapi.ReleaseTarget{
		DeploymentId:  uuid.New().String(),
		EnvironmentId: uuid.New().String(),
		ResourceId:    uuid.New().String(),
	}

	version := &oapi.DeploymentVersion{
		Id:  uuid.New().String(),
		Tag: "v1.0.0",
	}

	// Create variables of different types
	intVar := oapi.LiteralValue{}
	require.NoError(t, intVar.FromIntegerValue(42))

	strVar := oapi.LiteralValue{}
	require.NoError(t, strVar.FromStringValue("test-value"))

	floatVar := oapi.LiteralValue{}
	require.NoError(t, floatVar.FromNumberValue(3.14))

	boolVar := oapi.LiteralValue{}
	require.NoError(t, boolVar.FromBooleanValue(true))

	variables := map[string]*oapi.LiteralValue{
		"int_var":   &intVar,
		"str_var":   &strVar,
		"float_var": &floatVar,
		"bool_var":  &boolVar,
	}

	// Build release
	release := BuildRelease(ctx, releaseTarget, version, variables)

	// Assertions
	require.NotNil(t, release)
	assert.Len(t, release.Variables, 4)

	// Verify each variable type
	intVal, err := release.Variables["int_var"].AsIntegerValue()
	require.NoError(t, err)
	assert.Equal(t, int(42), intVal)

	strVal, err := release.Variables["str_var"].AsStringValue()
	require.NoError(t, err)
	assert.Equal(t, "test-value", strVal)

	floatVal, err := release.Variables["float_var"].AsNumberValue()
	require.NoError(t, err)
	assert.InDelta(t, 3.14, floatVal, 0.0001)

	boolVal, err := release.Variables["bool_var"].AsBooleanValue()
	require.NoError(t, err)
	assert.True(t, boolVal)
}

func TestBuildRelease_ReleaseIDDetermination(t *testing.T) {
	ctx := context.Background()

	releaseTarget := &oapi.ReleaseTarget{
		DeploymentId:  "deployment-1",
		EnvironmentId: "env-1",
		ResourceId:    "resource-1",
	}

	version := &oapi.DeploymentVersion{
		Id:  "version-1",
		Tag: "v1.0.0",
	}

	replicas := oapi.LiteralValue{}
	require.NoError(t, replicas.FromIntegerValue(3))

	variables1 := map[string]*oapi.LiteralValue{
		"replicas": &replicas,
	}

	// Build first release
	release1 := BuildRelease(ctx, releaseTarget, version, variables1)

	// Build second release with same parameters
	release2 := BuildRelease(ctx, releaseTarget, version, variables1)

	// Same inputs should produce same release ID
	assert.Equal(t, release1.ID(), release2.ID())

	// Different variables should produce different release ID
	replicas2 := oapi.LiteralValue{}
	require.NoError(t, replicas2.FromIntegerValue(5))

	variables2 := map[string]*oapi.LiteralValue{
		"replicas": &replicas2,
	}

	release3 := BuildRelease(ctx, releaseTarget, version, variables2)
	assert.NotEqual(t, release1.ID(), release3.ID())
}
