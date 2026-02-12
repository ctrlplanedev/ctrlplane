// Package jobs handles job lifecycle management including creation and dispatch.
package jobs

import (
	"context"
	"encoding/json"
	"testing"
	"time"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/statechange"
	"workspace-engine/pkg/workspace/store"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
)

// Helper functions for creating typed configs

func mustCreateJobAgentConfig(t *testing.T, configJSON string) oapi.JobAgentConfig {
	t.Helper()
	var config oapi.JobAgentConfig
	err := json.Unmarshal([]byte(configJSON), &config)
	require.NoError(t, err)
	return config
}

// Helper functions for converting JobAgentConfig to specific typed configs
func getGithubJobAgentConfig(t *testing.T, config oapi.JobAgentConfig) *oapi.GithubJobAgentConfig {
	t.Helper()
	configJSON, err := json.Marshal(config)
	require.NoError(t, err)
	var fullConfig oapi.GithubJobAgentConfig
	err = json.Unmarshal(configJSON, &fullConfig)
	require.NoError(t, err)
	return &fullConfig
}

func getArgoCDJobAgentConfig(t *testing.T, config oapi.JobAgentConfig) *oapi.ArgoCDJobAgentConfig {
	t.Helper()
	configJSON, err := json.Marshal(config)
	require.NoError(t, err)
	var fullConfig oapi.ArgoCDJobAgentConfig
	err = json.Unmarshal(configJSON, &fullConfig)
	require.NoError(t, err)
	return &fullConfig
}

func getTerraformCloudJobAgentConfig(t *testing.T, config oapi.JobAgentConfig) *oapi.TerraformCloudJobAgentConfig {
	t.Helper()
	configJSON, err := json.Marshal(config)
	require.NoError(t, err)
	var fullConfig oapi.TerraformCloudJobAgentConfig
	err = json.Unmarshal(configJSON, &fullConfig)
	require.NoError(t, err)
	return &fullConfig
}

func getTestRunnerJobAgentConfig(t *testing.T, config oapi.JobAgentConfig) *oapi.TestRunnerJobAgentConfig {
	t.Helper()
	configJSON, err := json.Marshal(config)
	require.NoError(t, err)
	var fullConfig oapi.TestRunnerJobAgentConfig
	err = json.Unmarshal(configJSON, &fullConfig)
	require.NoError(t, err)
	return &fullConfig
}

func mustCreateResourceSelector(t *testing.T) *oapi.Selector {
	t.Helper()
	selector := &oapi.Selector{}
	err := selector.UnmarshalJSON([]byte(`{"type": "all"}`))
	require.NoError(t, err)
	return selector
}

// Test helpers for setting up store with test data

func setupTestStore() *store.Store {
	cs := statechange.NewChangeSet[any]()
	return store.New("test-workspace", cs)
}

func createTestDeployment(t *testing.T, id string, jobAgentId *string, jobAgentConfig oapi.JobAgentConfig) *oapi.Deployment {
	t.Helper()
	return &oapi.Deployment{
		Id:               id,
		Name:             "test-deployment",
		Slug:             "test-deployment",
		SystemId:         "system-1",
		JobAgentId:       jobAgentId,
		JobAgentConfig:   jobAgentConfig,
		ResourceSelector: mustCreateResourceSelector(t),
	}
}

func createTestJobAgent(t *testing.T, id string, agentType string, config oapi.JobAgentConfig) *oapi.JobAgent {
	t.Helper()
	return &oapi.JobAgent{
		Id:     id,
		Name:   "test-agent",
		Type:   agentType,
		Config: config,
	}
}

func createTestRelease(t *testing.T, deploymentId, environmentId, resourceId, versionId string) *oapi.Release {
	t.Helper()
	return createTestReleaseWithJobAgentConfig(t, deploymentId, environmentId, resourceId, versionId, nil)
}

func createTestReleaseWithJobAgentConfig(t *testing.T, deploymentId, environmentId, resourceId, versionId string, jobAgentConfig map[string]interface{}) *oapi.Release {
	t.Helper()
	return &oapi.Release{
		ReleaseTarget: oapi.ReleaseTarget{
			DeploymentId:  deploymentId,
			EnvironmentId: environmentId,
			ResourceId:    resourceId,
		},
		Version: oapi.DeploymentVersion{
			Id:             versionId,
			Tag:            "v1.0.0",
			DeploymentId:   deploymentId,
			Config:         map[string]interface{}{},
			Metadata:       map[string]string{},
			CreatedAt:      time.Now(),
			JobAgentConfig: jobAgentConfig,
		},
	}
}

// =============================================================================
// Error Cases
// =============================================================================

func TestFactory_CreateJobForRelease_NoJobAgentConfigured(t *testing.T) {
	st := setupTestStore()
	ctx := context.Background()

	// Deployment has no job agent configured
	deploymentConfig := mustCreateJobAgentConfig(t, `{"type": "custom"}`)
	deployment := createTestDeployment(t, "deploy-1", nil, deploymentConfig)

	_ = st.Deployments.Upsert(ctx, deployment)

	release := createTestRelease(t, "deploy-1", "env-1", "resource-1", "version-1")

	factory := NewFactory(st)
	job, err := factory.CreateJobForRelease(ctx, release, nil)

	// Should create a job with InvalidJobAgent status
	require.NoError(t, err)
	require.NotNil(t, job)
	require.Equal(t, oapi.JobStatusInvalidJobAgent, job.Status)
	require.NotNil(t, job.Message)
	require.Contains(t, *job.Message, "No job agent configured")
}

func TestFactory_CreateJobForRelease_JobAgentNotFound(t *testing.T) {
	st := setupTestStore()
	ctx := context.Background()

	// Deployment references a job agent that doesn't exist
	nonExistentAgentId := "non-existent-agent"
	deploymentConfig := mustCreateJobAgentConfig(t, `{"type": "custom"}`)
	deployment := createTestDeployment(t, "deploy-1", &nonExistentAgentId, deploymentConfig)

	_ = st.Deployments.Upsert(ctx, deployment)

	release := createTestRelease(t, "deploy-1", "env-1", "resource-1", "version-1")

	factory := NewFactory(st)
	job, err := factory.CreateJobForRelease(ctx, release, nil)

	// Should create a job with InvalidJobAgent status
	require.NoError(t, err)
	require.NotNil(t, job)
	require.Equal(t, oapi.JobStatusInvalidJobAgent, job.Status)
	require.Equal(t, nonExistentAgentId, job.JobAgentId)
	require.NotNil(t, job.Message)
	require.Contains(t, *job.Message, "not found")
}

func TestFactory_CreateJobForRelease_DeploymentNotFound(t *testing.T) {
	st := setupTestStore()
	ctx := context.Background()

	// Release references a deployment that doesn't exist
	release := createTestRelease(t, "non-existent-deploy", "env-1", "resource-1", "version-1")

	factory := NewFactory(st)
	job, err := factory.CreateJobForRelease(ctx, release, nil)

	// Should return an error
	require.Error(t, err)
	require.Nil(t, job)
	require.Contains(t, err.Error(), "not found")
}

// =============================================================================
// Job Creation Metadata Tests
// =============================================================================

func TestFactory_CreateJobForRelease_SetsCorrectJobFields(t *testing.T) {
	st := setupTestStore()
	ctx := context.Background()

	jobAgentId := "agent-1"

	jobAgentConfig := mustCreateJobAgentConfig(t, `{
		"type": "custom",
		"key": "value"
	}`)

	deploymentConfig := mustCreateJobAgentConfig(t, `{
		"type": "custom"
	}`)

	jobAgent := createTestJobAgent(t, jobAgentId, "custom", jobAgentConfig)
	deployment := createTestDeployment(t, "deploy-1", &jobAgentId, deploymentConfig)

	st.JobAgents.Upsert(ctx, jobAgent)
	_ = st.Deployments.Upsert(ctx, deployment)

	release := createTestRelease(t, "deploy-1", "env-1", "resource-1", "version-1")

	beforeCreation := time.Now()

	factory := NewFactory(st)
	job, err := factory.CreateJobForRelease(ctx, release, nil)

	afterCreation := time.Now()

	require.NoError(t, err)
	require.NotNil(t, job)

	// Verify job ID is a valid UUID
	_, err = uuid.Parse(job.Id)
	require.NoError(t, err)

	// Verify release ID is correct
	require.Equal(t, release.ID(), job.ReleaseId)

	// Verify job agent ID is correct
	require.Equal(t, jobAgentId, job.JobAgentId)

	// Verify status is Pending
	require.Equal(t, oapi.JobStatusPending, job.Status)

	// Verify timestamps are set correctly
	require.True(t, job.CreatedAt.After(beforeCreation) || job.CreatedAt.Equal(beforeCreation))
	require.True(t, job.CreatedAt.Before(afterCreation) || job.CreatedAt.Equal(afterCreation))
	require.True(t, job.UpdatedAt.After(beforeCreation) || job.UpdatedAt.Equal(beforeCreation))
	require.True(t, job.UpdatedAt.Before(afterCreation) || job.UpdatedAt.Equal(afterCreation))

	// Verify metadata is initialized
	require.NotNil(t, job.Metadata)
	require.Empty(t, job.Metadata)
}

// =============================================================================
// Multiple Jobs Creation Tests
// =============================================================================

func TestFactory_CreateJobForRelease_UniqueJobIds(t *testing.T) {
	st := setupTestStore()
	ctx := context.Background()

	jobAgentId := "agent-1"

	jobAgentConfig := mustCreateJobAgentConfig(t, `{
		"type": "custom"
	}`)

	deploymentConfig := mustCreateJobAgentConfig(t, `{
		"type": "custom"
	}`)

	jobAgent := createTestJobAgent(t, jobAgentId, "custom", jobAgentConfig)
	deployment := createTestDeployment(t, "deploy-1", &jobAgentId, deploymentConfig)

	st.JobAgents.Upsert(ctx, jobAgent)
	_ = st.Deployments.Upsert(ctx, deployment)

	factory := NewFactory(st)

	// Create multiple jobs for the same release
	jobIds := make(map[string]bool)
	for i := 0; i < 10; i++ {
		release := createTestRelease(t, "deploy-1", "env-1", "resource-1", "version-1")
		job, err := factory.CreateJobForRelease(ctx, release, nil)
		require.NoError(t, err)
		require.NotNil(t, job)

		// Each job should have a unique ID
		require.False(t, jobIds[job.Id], "Job ID should be unique")
		jobIds[job.Id] = true
	}
}

// =============================================================================
// Empty Job Agent ID Tests
// =============================================================================

func TestFactory_CreateJobForRelease_EmptyJobAgentId(t *testing.T) {
	st := setupTestStore()
	ctx := context.Background()

	// Deployment has empty string job agent ID
	emptyAgentId := ""
	deploymentConfig := mustCreateJobAgentConfig(t, `{"type": "custom"}`)
	deployment := createTestDeployment(t, "deploy-1", &emptyAgentId, deploymentConfig)

	_ = st.Deployments.Upsert(ctx, deployment)

	release := createTestRelease(t, "deploy-1", "env-1", "resource-1", "version-1")

	factory := NewFactory(st)
	job, err := factory.CreateJobForRelease(ctx, release, nil)

	// Should create a job with InvalidJobAgent status
	require.NoError(t, err)
	require.NotNil(t, job)
	require.Equal(t, oapi.JobStatusInvalidJobAgent, job.Status)
	require.NotNil(t, job.Message)
	require.Contains(t, *job.Message, "No job agent configured")
}
