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
// GitHub App Config Merging Tests
// =============================================================================

func TestFactory_MergeJobAgentConfig_GithubApp_BasicMerge(t *testing.T) {
	st := setupTestStore()
	ctx := context.Background()

	jobAgentId := "agent-1"

	// JobAgent has installationId and owner (base config)
	jobAgentConfig := oapi.JobAgentConfig{
		"type":           "github-app",
		"installationId": 12345,
		"owner":          "my-org",
	}

	// Deployment has repo, workflowId, and ref (deployment overrides)
	deploymentConfig := oapi.JobAgentConfig{
		"type":       "github-app",
		"repo":       "my-repo",
		"workflowId": 67890,
		"ref":        "main",
	}

	jobAgent := createTestJobAgent(t, jobAgentId, "github-app", jobAgentConfig)
	deployment := createTestDeployment(t, "deploy-1", &jobAgentId, deploymentConfig)

	st.JobAgents.Upsert(ctx, jobAgent)
	_ = st.Deployments.Upsert(ctx, deployment)

	release := createTestRelease(t, "deploy-1", "env-1", "resource-1", "version-1")

	factory := NewFactory(st)
	job, err := factory.CreateJobForRelease(ctx, release, nil)

	require.NoError(t, err)
	require.NotNil(t, job)
	require.Equal(t, oapi.JobStatusPending, job.Status)
	require.Equal(t, jobAgentId, job.JobAgentId)

	// Verify the merged config has all fields
	fullConfig := getGithubJobAgentConfig(t, job.JobAgentConfig)

	// From JobAgent
	require.Equal(t, 12345, fullConfig.InstallationId)
	require.Equal(t, "my-org", fullConfig.Owner)

	// From Deployment
	require.Equal(t, "my-repo", fullConfig.Repo)
	require.Equal(t, int64(67890), fullConfig.WorkflowId)
	require.NotNil(t, fullConfig.Ref)
	require.Equal(t, "main", *fullConfig.Ref)

}

func TestFactory_MergeJobAgentConfig_GithubApp_DeploymentOverridesRef(t *testing.T) {
	st := setupTestStore()
	ctx := context.Background()

	jobAgentId := "agent-1"

	// JobAgent config (no ref)
	jobAgentConfig := mustCreateJobAgentConfig(t, `{
		"type": "github-app",
		"installationId": 12345,
		"owner": "my-org"
	}`)

	// Deployment overrides with specific ref
	deploymentConfig := mustCreateJobAgentConfig(t, `{
		"type": "github-app",
		"repo": "my-repo",
		"workflowId": 67890,
		"ref": "feature-branch"
	}`)

	jobAgent := createTestJobAgent(t, jobAgentId, "github-app", jobAgentConfig)
	deployment := createTestDeployment(t, "deploy-1", &jobAgentId, deploymentConfig)

	st.JobAgents.Upsert(ctx, jobAgent)
	_ = st.Deployments.Upsert(ctx, deployment)

	release := createTestRelease(t, "deploy-1", "env-1", "resource-1", "version-1")

	factory := NewFactory(st)
	job, err := factory.CreateJobForRelease(ctx, release, nil)

	require.NoError(t, err)
	require.NotNil(t, job)

	fullConfig := getGithubJobAgentConfig(t, job.JobAgentConfig)

	require.NotNil(t, fullConfig.Ref)
	require.Equal(t, "feature-branch", *fullConfig.Ref)
}

// =============================================================================
// ArgoCD Config Merging Tests
// =============================================================================

func TestFactory_MergeJobAgentConfig_ArgoCD_BasicMerge(t *testing.T) {
	st := setupTestStore()
	ctx := context.Background()

	jobAgentId := "agent-1"

	// JobAgent has apiKey and serverUrl (base config)
	jobAgentConfig := mustCreateJobAgentConfig(t, `{
		"type": "argo-cd",
		"apiKey": "secret-api-key",
		"serverUrl": "https://argocd.example.com"
	}`)

	// Deployment has type only (no template - template comes from version)
	deploymentConfig := mustCreateJobAgentConfig(t, `{
		"type": "argo-cd"
	}`)

	jobAgent := createTestJobAgent(t, jobAgentId, "argo-cd", jobAgentConfig)
	deployment := createTestDeployment(t, "deploy-1", &jobAgentId, deploymentConfig)

	st.JobAgents.Upsert(ctx, jobAgent)
	_ = st.Deployments.Upsert(ctx, deployment)

	// Version has template (version override)
	versionJobAgentConfig := map[string]interface{}{
		"type":     "argo-cd",
		"template": "apiVersion: argoproj.io/v1alpha1\nkind: Application\nmetadata:\n  name: {{ .deployment.name }}",
	}
	release := createTestReleaseWithJobAgentConfig(t, "deploy-1", "env-1", "resource-1", "version-1", versionJobAgentConfig)

	factory := NewFactory(st)
	job, err := factory.CreateJobForRelease(ctx, release, nil)

	require.NoError(t, err)
	require.NotNil(t, job)
	require.Equal(t, oapi.JobStatusPending, job.Status)

	// Verify the merged config has all fields
	fullConfig := getArgoCDJobAgentConfig(t, job.JobAgentConfig)

	// From JobAgent
	require.Equal(t, "secret-api-key", fullConfig.ApiKey)
	require.Equal(t, "https://argocd.example.com", fullConfig.ServerUrl)

	// From Version
	require.Contains(t, fullConfig.Template, "argoproj.io/v1alpha1")
	require.Contains(t, fullConfig.Template, "{{ .deployment.name }}")

}

// =============================================================================
// Terraform Cloud Config Merging Tests
// =============================================================================

func TestFactory_MergeJobAgentConfig_TerraformCloud_BasicMerge(t *testing.T) {
	st := setupTestStore()
	ctx := context.Background()

	jobAgentId := "agent-1"

	// JobAgent has address, organization, token (base config)
	jobAgentConfig := mustCreateJobAgentConfig(t, `{
		"type": "tfe",
		"address": "https://app.terraform.io",
		"organization": "my-org",
		"token": "secret-token"
	}`)

	// Deployment has template (deployment override)
	deploymentConfig := mustCreateJobAgentConfig(t, `{
		"type": "tfe",
		"template": "name: {{ .deployment.name }}\nworkingDirectory: /terraform"
	}`)

	jobAgent := createTestJobAgent(t, jobAgentId, "tfe", jobAgentConfig)
	deployment := createTestDeployment(t, "deploy-1", &jobAgentId, deploymentConfig)

	st.JobAgents.Upsert(ctx, jobAgent)
	_ = st.Deployments.Upsert(ctx, deployment)

	release := createTestRelease(t, "deploy-1", "env-1", "resource-1", "version-1")

	factory := NewFactory(st)
	job, err := factory.CreateJobForRelease(ctx, release, nil)

	require.NoError(t, err)
	require.NotNil(t, job)
	require.Equal(t, oapi.JobStatusPending, job.Status)

	// Verify the merged config has all fields
	fullConfig := getTerraformCloudJobAgentConfig(t, job.JobAgentConfig)

	// From JobAgent
	require.Equal(t, "https://app.terraform.io", fullConfig.Address)
	require.Equal(t, "my-org", fullConfig.Organization)
	require.Equal(t, "secret-token", fullConfig.Token)

	// From Deployment
	require.Contains(t, fullConfig.Template, "{{ .deployment.name }}")
	require.Contains(t, fullConfig.Template, "/terraform")

}

func TestFactory_MergeJobAgentConfig_TerraformCloud_DeploymentOverridesTemplate(t *testing.T) {
	st := setupTestStore()
	ctx := context.Background()

	jobAgentId := "agent-1"

	// JobAgent has a default template
	jobAgentConfig := mustCreateJobAgentConfig(t, `{
		"type": "tfe",
		"address": "https://app.terraform.io",
		"organization": "my-org",
		"token": "secret-token",
		"template": "default-template"
	}`)

	// Deployment overrides the template
	deploymentConfig := mustCreateJobAgentConfig(t, `{
		"type": "tfe",
		"template": "deployment-specific-template"
	}`)

	jobAgent := createTestJobAgent(t, jobAgentId, "tfe", jobAgentConfig)
	deployment := createTestDeployment(t, "deploy-1", &jobAgentId, deploymentConfig)

	st.JobAgents.Upsert(ctx, jobAgent)
	_ = st.Deployments.Upsert(ctx, deployment)

	release := createTestRelease(t, "deploy-1", "env-1", "resource-1", "version-1")

	factory := NewFactory(st)
	job, err := factory.CreateJobForRelease(ctx, release, nil)

	require.NoError(t, err)
	require.NotNil(t, job)

	fullConfig := getTerraformCloudJobAgentConfig(t, job.JobAgentConfig)

	// Deployment template should override job agent template
	require.Equal(t, "deployment-specific-template", fullConfig.Template)

	// But other fields from JobAgent should still be present
	require.Equal(t, "https://app.terraform.io", fullConfig.Address)
	require.Equal(t, "my-org", fullConfig.Organization)
	require.Equal(t, "secret-token", fullConfig.Token)
}

// =============================================================================
// Custom Config Merging Tests
// =============================================================================

func TestFactory_MergeJobAgentConfig_Custom_BasicMerge(t *testing.T) {
	st := setupTestStore()
	ctx := context.Background()

	jobAgentId := "agent-1"

	// JobAgent has some custom properties
	jobAgentConfig := mustCreateJobAgentConfig(t, `{
		"type": "custom",
		"baseUrl": "https://api.example.com",
		"timeout": 30
	}`)

	// Deployment has additional custom properties
	deploymentConfig := mustCreateJobAgentConfig(t, `{
		"type": "custom",
		"endpoint": "/deploy",
		"retries": 3
	}`)

	jobAgent := createTestJobAgent(t, jobAgentId, "custom", jobAgentConfig)
	deployment := createTestDeployment(t, "deploy-1", &jobAgentId, deploymentConfig)

	st.JobAgents.Upsert(ctx, jobAgent)
	_ = st.Deployments.Upsert(ctx, deployment)

	release := createTestRelease(t, "deploy-1", "env-1", "resource-1", "version-1")

	factory := NewFactory(st)
	job, err := factory.CreateJobForRelease(ctx, release, nil)

	require.NoError(t, err)
	require.NotNil(t, job)
	require.Equal(t, oapi.JobStatusPending, job.Status)

	// Verify the merged config has all fields by parsing as JSON
	configJSON, err := json.Marshal(job.JobAgentConfig)
	require.NoError(t, err)

	var configMap map[string]any
	err = json.Unmarshal(configJSON, &configMap)
	require.NoError(t, err)

	// From JobAgent
	require.Equal(t, "https://api.example.com", configMap["baseUrl"])
	require.Equal(t, float64(30), configMap["timeout"])

	// From Deployment
	require.Equal(t, "/deploy", configMap["endpoint"])
	require.Equal(t, float64(3), configMap["retries"])

	// Type discriminator should be set
	require.Equal(t, "custom", configMap["type"])
}

func TestFactory_MergeJobAgentConfig_Custom_DeploymentOverridesValues(t *testing.T) {
	st := setupTestStore()
	ctx := context.Background()

	jobAgentId := "agent-1"

	// JobAgent has default values
	jobAgentConfig := mustCreateJobAgentConfig(t, `{
		"type": "custom",
		"baseUrl": "https://api.example.com",
		"timeout": 30,
		"env": "production"
	}`)

	// Deployment overrides some values
	deploymentConfig := mustCreateJobAgentConfig(t, `{
		"type": "custom",
		"timeout": 60,
		"env": "staging"
	}`)

	jobAgent := createTestJobAgent(t, jobAgentId, "custom", jobAgentConfig)
	deployment := createTestDeployment(t, "deploy-1", &jobAgentId, deploymentConfig)

	st.JobAgents.Upsert(ctx, jobAgent)
	_ = st.Deployments.Upsert(ctx, deployment)

	release := createTestRelease(t, "deploy-1", "env-1", "resource-1", "version-1")

	factory := NewFactory(st)
	job, err := factory.CreateJobForRelease(ctx, release, nil)

	require.NoError(t, err)
	require.NotNil(t, job)

	configJSON, err := json.Marshal(job.JobAgentConfig)
	require.NoError(t, err)

	var configMap map[string]any
	err = json.Unmarshal(configJSON, &configMap)
	require.NoError(t, err)

	// BaseUrl from JobAgent (not overridden)
	require.Equal(t, "https://api.example.com", configMap["baseUrl"])

	// Deployment overrides
	require.Equal(t, float64(60), configMap["timeout"])
	require.Equal(t, "staging", configMap["env"])
}

func TestFactory_MergeJobAgentConfig_Custom_DeepNestedMerge(t *testing.T) {
	st := setupTestStore()
	ctx := context.Background()

	jobAgentId := "agent-1"

	// JobAgent has nested config
	jobAgentConfig := mustCreateJobAgentConfig(t, `{
		"type": "custom",
		"settings": {
			"debug": false,
			"logging": {
				"level": "info",
				"format": "json"
			}
		}
	}`)

	// Deployment overrides nested values
	deploymentConfig := mustCreateJobAgentConfig(t, `{
		"type": "custom",
		"settings": {
			"debug": true,
			"logging": {
				"level": "debug"
			}
		}
	}`)

	jobAgent := createTestJobAgent(t, jobAgentId, "custom", jobAgentConfig)
	deployment := createTestDeployment(t, "deploy-1", &jobAgentId, deploymentConfig)

	st.JobAgents.Upsert(ctx, jobAgent)
	_ = st.Deployments.Upsert(ctx, deployment)

	release := createTestRelease(t, "deploy-1", "env-1", "resource-1", "version-1")

	factory := NewFactory(st)
	job, err := factory.CreateJobForRelease(ctx, release, nil)

	require.NoError(t, err)
	require.NotNil(t, job)

	configJSON, err := json.Marshal(job.JobAgentConfig)
	require.NoError(t, err)

	var configMap map[string]any
	err = json.Unmarshal(configJSON, &configMap)
	require.NoError(t, err)

	settings := configMap["settings"].(map[string]any)

	// debug should be overridden to true
	require.Equal(t, true, settings["debug"])

	logging := settings["logging"].(map[string]any)

	// level should be overridden to "debug"
	require.Equal(t, "debug", logging["level"])

	// format should be preserved from JobAgent (deep merge)
	require.Equal(t, "json", logging["format"])
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
// Test Runner Config Tests (No deployment override - agent only)
// =============================================================================

func TestFactory_MergeJobAgentConfig_TestRunner_PassthroughConfig(t *testing.T) {
	st := setupTestStore()
	ctx := context.Background()

	jobAgentId := "agent-1"

	// TestRunner config on JobAgent
	jobAgentConfig := mustCreateJobAgentConfig(t, `{
		"type": "test-runner",
		"delaySeconds": 5,
		"status": "completed",
		"message": "Deployment completed"
	}`)

	// Deployment config with test-runner type
	deploymentConfig := mustCreateJobAgentConfig(t, `{
		"type": "test-runner"
	}`)

	jobAgent := createTestJobAgent(t, jobAgentId, "test-runner", jobAgentConfig)
	deployment := createTestDeployment(t, "deploy-1", &jobAgentId, deploymentConfig)

	st.JobAgents.Upsert(ctx, jobAgent)
	_ = st.Deployments.Upsert(ctx, deployment)

	release := createTestRelease(t, "deploy-1", "env-1", "resource-1", "version-1")

	factory := NewFactory(st)
	job, err := factory.CreateJobForRelease(ctx, release, nil)

	require.NoError(t, err)
	require.NotNil(t, job)
	require.Equal(t, oapi.JobStatusPending, job.Status)

	// Verify the config has test-runner fields from JobAgent
	fullConfig := getTestRunnerJobAgentConfig(t, job.JobAgentConfig)

	require.NotNil(t, fullConfig.DelaySeconds)
	require.Equal(t, 5, *fullConfig.DelaySeconds)
	require.NotNil(t, fullConfig.Status)
	require.Equal(t, "completed", *fullConfig.Status)
	require.NotNil(t, fullConfig.Message)
	require.Equal(t, "Deployment completed", *fullConfig.Message)
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

// =============================================================================
// Version JobAgentConfig Override Tests
// =============================================================================

func TestFactory_MergeJobAgentConfig_VersionOverridesDeployment(t *testing.T) {
	st := setupTestStore()
	ctx := context.Background()

	jobAgentId := "agent-1"

	jobAgentConfig := mustCreateJobAgentConfig(t, `{
		"type": "custom",
		"baseUrl": "https://api.example.com"
	}`)

	deploymentConfig := mustCreateJobAgentConfig(t, `{
		"type": "custom",
		"timeout": 30,
		"env": "production"
	}`)

	jobAgent := createTestJobAgent(t, jobAgentId, "custom", jobAgentConfig)
	deployment := createTestDeployment(t, "deploy-1", &jobAgentId, deploymentConfig)

	st.JobAgents.Upsert(ctx, jobAgent)
	_ = st.Deployments.Upsert(ctx, deployment)

	versionJobAgentConfig := map[string]interface{}{
		"type":    "custom",
		"timeout": 60,
		"env":     "staging",
	}
	release := createTestReleaseWithJobAgentConfig(t, "deploy-1", "env-1", "resource-1", "version-1", versionJobAgentConfig)

	factory := NewFactory(st)
	job, err := factory.CreateJobForRelease(ctx, release, nil)

	require.NoError(t, err)
	require.NotNil(t, job)
	require.Equal(t, oapi.JobStatusPending, job.Status)

	configJSON, err := json.Marshal(job.JobAgentConfig)
	require.NoError(t, err)

	var configMap map[string]any
	err = json.Unmarshal(configJSON, &configMap)
	require.NoError(t, err)

	require.Equal(t, "https://api.example.com", configMap["baseUrl"])
	require.Equal(t, float64(60), configMap["timeout"])
	require.Equal(t, "staging", configMap["env"])
}

func TestFactory_MergeJobAgentConfig_VersionAddsNewFields(t *testing.T) {
	st := setupTestStore()
	ctx := context.Background()

	jobAgentId := "agent-1"

	jobAgentConfig := mustCreateJobAgentConfig(t, `{
		"type": "custom",
		"baseUrl": "https://api.example.com"
	}`)

	deploymentConfig := mustCreateJobAgentConfig(t, `{
		"type": "custom",
		"timeout": 30
	}`)

	jobAgent := createTestJobAgent(t, jobAgentId, "custom", jobAgentConfig)
	deployment := createTestDeployment(t, "deploy-1", &jobAgentId, deploymentConfig)

	st.JobAgents.Upsert(ctx, jobAgent)
	_ = st.Deployments.Upsert(ctx, deployment)

	versionJobAgentConfig := map[string]interface{}{
		"type":      "custom",
		"versionId": "v1.2.3",
		"extra":     "field",
	}
	release := createTestReleaseWithJobAgentConfig(t, "deploy-1", "env-1", "resource-1", "version-1", versionJobAgentConfig)

	factory := NewFactory(st)
	job, err := factory.CreateJobForRelease(ctx, release, nil)

	require.NoError(t, err)
	require.NotNil(t, job)

	configJSON, err := json.Marshal(job.JobAgentConfig)
	require.NoError(t, err)

	var configMap map[string]any
	err = json.Unmarshal(configJSON, &configMap)
	require.NoError(t, err)

	require.Equal(t, "https://api.example.com", configMap["baseUrl"])
	require.Equal(t, float64(30), configMap["timeout"])
	require.Equal(t, "v1.2.3", configMap["versionId"])
	require.Equal(t, "field", configMap["extra"])
}

func TestFactory_MergeJobAgentConfig_EmptyVersionConfig_IsNoop(t *testing.T) {
	st := setupTestStore()
	ctx := context.Background()

	jobAgentId := "agent-1"

	jobAgentConfig := mustCreateJobAgentConfig(t, `{
		"type": "custom",
		"baseUrl": "https://api.example.com"
	}`)

	deploymentConfig := mustCreateJobAgentConfig(t, `{
		"type": "custom",
		"timeout": 30,
		"env": "production"
	}`)

	jobAgent := createTestJobAgent(t, jobAgentId, "custom", jobAgentConfig)
	deployment := createTestDeployment(t, "deploy-1", &jobAgentId, deploymentConfig)

	st.JobAgents.Upsert(ctx, jobAgent)
	_ = st.Deployments.Upsert(ctx, deployment)

	release := createTestRelease(t, "deploy-1", "env-1", "resource-1", "version-1")

	factory := NewFactory(st)
	job, err := factory.CreateJobForRelease(ctx, release, nil)

	require.NoError(t, err)
	require.NotNil(t, job)
	require.Equal(t, oapi.JobStatusPending, job.Status)

	configJSON, err := json.Marshal(job.JobAgentConfig)
	require.NoError(t, err)

	var configMap map[string]any
	err = json.Unmarshal(configJSON, &configMap)
	require.NoError(t, err)

	require.Equal(t, "https://api.example.com", configMap["baseUrl"])
	require.Equal(t, float64(30), configMap["timeout"])
	require.Equal(t, "production", configMap["env"])
}

func TestFactory_MergeJobAgentConfig_NilVersionConfig_IsNoop(t *testing.T) {
	st := setupTestStore()
	ctx := context.Background()

	jobAgentId := "agent-1"

	jobAgentConfig := mustCreateJobAgentConfig(t, `{
		"type": "custom",
		"baseUrl": "https://api.example.com"
	}`)

	deploymentConfig := mustCreateJobAgentConfig(t, `{
		"type": "custom",
		"timeout": 30
	}`)

	jobAgent := createTestJobAgent(t, jobAgentId, "custom", jobAgentConfig)
	deployment := createTestDeployment(t, "deploy-1", &jobAgentId, deploymentConfig)

	st.JobAgents.Upsert(ctx, jobAgent)
	_ = st.Deployments.Upsert(ctx, deployment)

	release := createTestReleaseWithJobAgentConfig(t, "deploy-1", "env-1", "resource-1", "version-1", nil)

	factory := NewFactory(st)
	job, err := factory.CreateJobForRelease(ctx, release, nil)

	require.NoError(t, err)
	require.NotNil(t, job)
	require.Equal(t, oapi.JobStatusPending, job.Status)

	configJSON, err := json.Marshal(job.JobAgentConfig)
	require.NoError(t, err)

	var configMap map[string]any
	err = json.Unmarshal(configJSON, &configMap)
	require.NoError(t, err)

	require.Equal(t, "https://api.example.com", configMap["baseUrl"])
	require.Equal(t, float64(30), configMap["timeout"])
}

func TestFactory_MergeJobAgentConfig_VersionDeepNestedOverride(t *testing.T) {
	st := setupTestStore()
	ctx := context.Background()

	jobAgentId := "agent-1"

	jobAgentConfig := mustCreateJobAgentConfig(t, `{
		"type": "custom",
		"settings": {
			"debug": false,
			"logging": {
				"level": "info",
				"format": "json"
			}
		}
	}`)

	deploymentConfig := mustCreateJobAgentConfig(t, `{
		"type": "custom",
		"settings": {
			"debug": true,
			"logging": {
				"level": "debug"
			}
		}
	}`)

	jobAgent := createTestJobAgent(t, jobAgentId, "custom", jobAgentConfig)
	deployment := createTestDeployment(t, "deploy-1", &jobAgentId, deploymentConfig)

	st.JobAgents.Upsert(ctx, jobAgent)
	_ = st.Deployments.Upsert(ctx, deployment)

	versionJobAgentConfig := map[string]interface{}{
		"type": "custom",
		"settings": map[string]interface{}{
			"logging": map[string]interface{}{
				"level": "warn",
			},
		},
	}
	release := createTestReleaseWithJobAgentConfig(t, "deploy-1", "env-1", "resource-1", "version-1", versionJobAgentConfig)

	factory := NewFactory(st)
	job, err := factory.CreateJobForRelease(ctx, release, nil)

	require.NoError(t, err)
	require.NotNil(t, job)

	configJSON, err := json.Marshal(job.JobAgentConfig)
	require.NoError(t, err)

	var configMap map[string]any
	err = json.Unmarshal(configJSON, &configMap)
	require.NoError(t, err)

	settings := configMap["settings"].(map[string]any)
	require.Equal(t, true, settings["debug"])

	logging := settings["logging"].(map[string]any)
	require.Equal(t, "warn", logging["level"])
	require.Equal(t, "json", logging["format"])
}

func TestFactory_MergeJobAgentConfig_VersionOverridesAll_GithubApp(t *testing.T) {
	st := setupTestStore()
	ctx := context.Background()

	jobAgentId := "agent-1"

	jobAgentConfig := mustCreateJobAgentConfig(t, `{
		"type": "github-app",
		"installationId": 12345,
		"owner": "my-org"
	}`)

	deploymentConfig := mustCreateJobAgentConfig(t, `{
		"type": "github-app",
		"repo": "my-repo",
		"workflowId": 67890,
		"ref": "main"
	}`)

	jobAgent := createTestJobAgent(t, jobAgentId, "github-app", jobAgentConfig)
	deployment := createTestDeployment(t, "deploy-1", &jobAgentId, deploymentConfig)

	st.JobAgents.Upsert(ctx, jobAgent)
	_ = st.Deployments.Upsert(ctx, deployment)

	versionJobAgentConfig := map[string]interface{}{
		"type": "github-app",
		"ref":  "release-v2",
	}
	release := createTestReleaseWithJobAgentConfig(t, "deploy-1", "env-1", "resource-1", "version-1", versionJobAgentConfig)

	factory := NewFactory(st)
	job, err := factory.CreateJobForRelease(ctx, release, nil)

	require.NoError(t, err)
	require.NotNil(t, job)
	require.Equal(t, oapi.JobStatusPending, job.Status)

	fullConfig := getGithubJobAgentConfig(t, job.JobAgentConfig)

	require.Equal(t, 12345, fullConfig.InstallationId)
	require.Equal(t, "my-org", fullConfig.Owner)
	require.Equal(t, "my-repo", fullConfig.Repo)
	require.Equal(t, int64(67890), fullConfig.WorkflowId)
	require.NotNil(t, fullConfig.Ref)
	require.Equal(t, "release-v2", *fullConfig.Ref)
}

// =============================================================================
// JobAgentConfig Merge Ordering Tests
// =============================================================================
// These tests verify that the merge order is correct:
// 1. JobAgent config (base defaults)
// 2. Deployment config (deployment-specific overrides)
// 3. Version config (version-specific overrides)
// Each layer can override values from previous layers, and deep nested
// objects are merged recursively.

func TestFactory_MergeJobAgentConfig_ThreeLevelMergeOrder(t *testing.T) {
	// This test verifies the complete 3-level merge:
	// JobAgent -> Deployment -> Version
	// Each level can add new fields or override existing ones.
	st := setupTestStore()
	ctx := context.Background()

	jobAgentId := "agent-1"

	// Level 1: JobAgent provides base config with some defaults
	jobAgentConfig := mustCreateJobAgentConfig(t, `{
		"type": "custom",
		"agentOnly": "from-agent",
		"sharedField": "agent-value",
		"overriddenByDeployment": "agent-value",
		"overriddenByVersion": "agent-value",
		"overriddenByBoth": "agent-value"
	}`)

	// Level 2: Deployment adds new fields and overrides some
	deploymentConfig := mustCreateJobAgentConfig(t, `{
		"type": "custom",
		"deploymentOnly": "from-deployment",
		"overriddenByDeployment": "deployment-value",
		"overriddenByVersion": "deployment-value",
		"overriddenByBoth": "deployment-value"
	}`)

	jobAgent := createTestJobAgent(t, jobAgentId, "custom", jobAgentConfig)
	deployment := createTestDeployment(t, "deploy-1", &jobAgentId, deploymentConfig)

	st.JobAgents.Upsert(ctx, jobAgent)
	_ = st.Deployments.Upsert(ctx, deployment)

	// Level 3: Version adds new fields and overrides some
	versionJobAgentConfig := map[string]interface{}{
		"type":                "custom",
		"versionOnly":         "from-version",
		"overriddenByVersion": "version-value",
		"overriddenByBoth":    "version-value",
	}
	release := createTestReleaseWithJobAgentConfig(t, "deploy-1", "env-1", "resource-1", "version-1", versionJobAgentConfig)

	factory := NewFactory(st)
	job, err := factory.CreateJobForRelease(ctx, release, nil)

	require.NoError(t, err)
	require.NotNil(t, job)
	require.Equal(t, oapi.JobStatusPending, job.Status)

	configJSON, err := json.Marshal(job.JobAgentConfig)
	require.NoError(t, err)

	var configMap map[string]any
	err = json.Unmarshal(configJSON, &configMap)
	require.NoError(t, err)

	// Fields unique to each level should be preserved
	require.Equal(t, "from-agent", configMap["agentOnly"], "agentOnly should come from JobAgent")
	require.Equal(t, "from-deployment", configMap["deploymentOnly"], "deploymentOnly should come from Deployment")
	require.Equal(t, "from-version", configMap["versionOnly"], "versionOnly should come from Version")

	// Shared field not overridden should stay from JobAgent
	require.Equal(t, "agent-value", configMap["sharedField"], "sharedField should remain from JobAgent")

	// Fields overridden at different levels
	require.Equal(t, "deployment-value", configMap["overriddenByDeployment"], "overriddenByDeployment should come from Deployment")
	require.Equal(t, "version-value", configMap["overriddenByVersion"], "overriddenByVersion should come from Version")
	require.Equal(t, "version-value", configMap["overriddenByBoth"], "overriddenByBoth should come from Version (last wins)")

	// Type discriminator should always be present
	require.Equal(t, "custom", configMap["type"])
}

func TestFactory_MergeJobAgentConfig_DeepNestedThreeLevelMerge(t *testing.T) {
	// This test verifies that deep nested objects are merged correctly
	// at all three levels.
	st := setupTestStore()
	ctx := context.Background()

	jobAgentId := "agent-1"

	// Level 1: JobAgent with deep nested config
	jobAgentConfig := mustCreateJobAgentConfig(t, `{
		"type": "custom",
		"settings": {
			"agent": {
				"onlyInAgent": "agent-value"
			},
			"shared": {
				"level1": {
					"fromAgent": "agent",
					"overrideByDeployment": "agent",
					"overrideByVersion": "agent"
				}
			}
		}
	}`)

	// Level 2: Deployment adds to nested structure and overrides some
	deploymentConfig := mustCreateJobAgentConfig(t, `{
		"type": "custom",
		"settings": {
			"deployment": {
				"onlyInDeployment": "deployment-value"
			},
			"shared": {
				"level1": {
					"fromDeployment": "deployment",
					"overrideByDeployment": "deployment",
					"overrideByVersion": "deployment"
				}
			}
		}
	}`)

	jobAgent := createTestJobAgent(t, jobAgentId, "custom", jobAgentConfig)
	deployment := createTestDeployment(t, "deploy-1", &jobAgentId, deploymentConfig)

	st.JobAgents.Upsert(ctx, jobAgent)
	_ = st.Deployments.Upsert(ctx, deployment)

	// Level 3: Version adds more nested structure and overrides
	versionJobAgentConfig := map[string]interface{}{
		"type": "custom",
		"settings": map[string]interface{}{
			"version": map[string]interface{}{
				"onlyInVersion": "version-value",
			},
			"shared": map[string]interface{}{
				"level1": map[string]interface{}{
					"fromVersion":       "version",
					"overrideByVersion": "version",
				},
			},
		},
	}
	release := createTestReleaseWithJobAgentConfig(t, "deploy-1", "env-1", "resource-1", "version-1", versionJobAgentConfig)

	factory := NewFactory(st)
	job, err := factory.CreateJobForRelease(ctx, release, nil)

	require.NoError(t, err)
	require.NotNil(t, job)

	configJSON, err := json.Marshal(job.JobAgentConfig)
	require.NoError(t, err)

	var configMap map[string]any
	err = json.Unmarshal(configJSON, &configMap)
	require.NoError(t, err)

	settings := configMap["settings"].(map[string]any)

	// Each level's unique nested object should be preserved
	agent := settings["agent"].(map[string]any)
	require.Equal(t, "agent-value", agent["onlyInAgent"], "Agent-only nested field should be preserved")

	deployment2 := settings["deployment"].(map[string]any)
	require.Equal(t, "deployment-value", deployment2["onlyInDeployment"], "Deployment-only nested field should be preserved")

	version := settings["version"].(map[string]any)
	require.Equal(t, "version-value", version["onlyInVersion"], "Version-only nested field should be preserved")

	// Verify deep merge in shared object
	shared := settings["shared"].(map[string]any)
	level1 := shared["level1"].(map[string]any)

	require.Equal(t, "agent", level1["fromAgent"], "Agent field in deep nest should be preserved")
	require.Equal(t, "deployment", level1["fromDeployment"], "Deployment field in deep nest should be preserved")
	require.Equal(t, "version", level1["fromVersion"], "Version field in deep nest should be preserved")
	require.Equal(t, "deployment", level1["overrideByDeployment"], "Deployment should override agent in deep nest")
	require.Equal(t, "version", level1["overrideByVersion"], "Version should override deployment in deep nest")
}

func TestFactory_MergeJobAgentConfig_VersionOverridesNull(t *testing.T) {
	// This test verifies that version can override values to null
	st := setupTestStore()
	ctx := context.Background()

	jobAgentId := "agent-1"

	jobAgentConfig := mustCreateJobAgentConfig(t, `{
		"type": "custom",
		"field": "agent-value"
	}`)

	deploymentConfig := mustCreateJobAgentConfig(t, `{
		"type": "custom",
		"field": "deployment-value",
		"extra": "extra-value"
	}`)

	jobAgent := createTestJobAgent(t, jobAgentId, "custom", jobAgentConfig)
	deployment := createTestDeployment(t, "deploy-1", &jobAgentId, deploymentConfig)

	st.JobAgents.Upsert(ctx, jobAgent)
	_ = st.Deployments.Upsert(ctx, deployment)

	// Version explicitly sets field to null
	versionJobAgentConfig := map[string]interface{}{
		"type":  "custom",
		"field": nil,
	}
	release := createTestReleaseWithJobAgentConfig(t, "deploy-1", "env-1", "resource-1", "version-1", versionJobAgentConfig)

	factory := NewFactory(st)
	job, err := factory.CreateJobForRelease(ctx, release, nil)

	require.NoError(t, err)
	require.NotNil(t, job)

	configJSON, err := json.Marshal(job.JobAgentConfig)
	require.NoError(t, err)

	var configMap map[string]any
	err = json.Unmarshal(configJSON, &configMap)
	require.NoError(t, err)

	// Field should be overridden to null
	require.Nil(t, configMap["field"], "field should be nil when version sets it to null")
	// Extra field from deployment should still be present
	require.Equal(t, "extra-value", configMap["extra"])
}

func TestFactory_MergeJobAgentConfig_ArraysNotDeepMerged(t *testing.T) {
	// This test verifies that arrays are replaced, not merged
	st := setupTestStore()
	ctx := context.Background()

	jobAgentId := "agent-1"

	jobAgentConfig := mustCreateJobAgentConfig(t, `{
		"type": "custom",
		"items": ["agent-item-1", "agent-item-2"]
	}`)

	deploymentConfig := mustCreateJobAgentConfig(t, `{
		"type": "custom",
		"items": ["deployment-item-1"]
	}`)

	jobAgent := createTestJobAgent(t, jobAgentId, "custom", jobAgentConfig)
	deployment := createTestDeployment(t, "deploy-1", &jobAgentId, deploymentConfig)

	st.JobAgents.Upsert(ctx, jobAgent)
	_ = st.Deployments.Upsert(ctx, deployment)

	release := createTestRelease(t, "deploy-1", "env-1", "resource-1", "version-1")

	factory := NewFactory(st)
	job, err := factory.CreateJobForRelease(ctx, release, nil)

	require.NoError(t, err)
	require.NotNil(t, job)

	configJSON, err := json.Marshal(job.JobAgentConfig)
	require.NoError(t, err)

	var configMap map[string]any
	err = json.Unmarshal(configJSON, &configMap)
	require.NoError(t, err)

	// Arrays should be replaced, not merged
	items := configMap["items"].([]any)
	require.Len(t, items, 1, "Array should be replaced, not merged")
	require.Equal(t, "deployment-item-1", items[0], "Array should contain deployment value")
}

func TestFactory_MergeJobAgentConfig_VersionArrayOverride(t *testing.T) {
	// This test verifies that version can override arrays
	st := setupTestStore()
	ctx := context.Background()

	jobAgentId := "agent-1"

	jobAgentConfig := mustCreateJobAgentConfig(t, `{
		"type": "custom",
		"tags": ["base-tag"]
	}`)

	deploymentConfig := mustCreateJobAgentConfig(t, `{
		"type": "custom",
		"tags": ["deployment-tag-1", "deployment-tag-2"]
	}`)

	jobAgent := createTestJobAgent(t, jobAgentId, "custom", jobAgentConfig)
	deployment := createTestDeployment(t, "deploy-1", &jobAgentId, deploymentConfig)

	st.JobAgents.Upsert(ctx, jobAgent)
	_ = st.Deployments.Upsert(ctx, deployment)

	versionJobAgentConfig := map[string]interface{}{
		"type": "custom",
		"tags": []string{"version-tag"},
	}
	release := createTestReleaseWithJobAgentConfig(t, "deploy-1", "env-1", "resource-1", "version-1", versionJobAgentConfig)

	factory := NewFactory(st)
	job, err := factory.CreateJobForRelease(ctx, release, nil)

	require.NoError(t, err)
	require.NotNil(t, job)

	configJSON, err := json.Marshal(job.JobAgentConfig)
	require.NoError(t, err)

	var configMap map[string]any
	err = json.Unmarshal(configJSON, &configMap)
	require.NoError(t, err)

	// Version array should completely replace deployment array
	tags := configMap["tags"].([]any)
	require.Len(t, tags, 1)
	require.Equal(t, "version-tag", tags[0])
}

func TestFactory_MergeJobAgentConfig_PreservesTypeDiscriminator(t *testing.T) {
	// This test verifies that the type discriminator is always set
	// to the JobAgent's type, regardless of what deployment/version specify
	st := setupTestStore()
	ctx := context.Background()

	jobAgentId := "agent-1"

	// JobAgent has custom type
	jobAgentConfig := mustCreateJobAgentConfig(t, `{
		"type": "custom",
		"field": "value"
	}`)

	// Deployment might try to set a different type (though shouldn't)
	deploymentConfig := mustCreateJobAgentConfig(t, `{
		"type": "custom"
	}`)

	jobAgent := createTestJobAgent(t, jobAgentId, "custom", jobAgentConfig)
	deployment := createTestDeployment(t, "deploy-1", &jobAgentId, deploymentConfig)

	st.JobAgents.Upsert(ctx, jobAgent)
	_ = st.Deployments.Upsert(ctx, deployment)

	release := createTestRelease(t, "deploy-1", "env-1", "resource-1", "version-1")

	factory := NewFactory(st)
	job, err := factory.CreateJobForRelease(ctx, release, nil)

	require.NoError(t, err)
	require.NotNil(t, job)

	configJSON, err := json.Marshal(job.JobAgentConfig)
	require.NoError(t, err)

	var configMap map[string]any
	err = json.Unmarshal(configJSON, &configMap)
	require.NoError(t, err)

	// Type discriminator must always be from JobAgent
	require.Equal(t, "custom", configMap["type"])
}

func TestFactory_MergeJobAgentConfig_EmptyDeploymentConfig(t *testing.T) {
	// This test verifies that an empty deployment config doesn't
	// affect the agent config
	st := setupTestStore()
	ctx := context.Background()

	jobAgentId := "agent-1"

	jobAgentConfig := mustCreateJobAgentConfig(t, `{
		"type": "custom",
		"baseUrl": "https://api.example.com",
		"timeout": 30,
		"nested": {
			"key": "value"
		}
	}`)

	// Empty deployment config (just type)
	deploymentConfig := mustCreateJobAgentConfig(t, `{
		"type": "custom"
	}`)

	jobAgent := createTestJobAgent(t, jobAgentId, "custom", jobAgentConfig)
	deployment := createTestDeployment(t, "deploy-1", &jobAgentId, deploymentConfig)

	st.JobAgents.Upsert(ctx, jobAgent)
	_ = st.Deployments.Upsert(ctx, deployment)

	release := createTestRelease(t, "deploy-1", "env-1", "resource-1", "version-1")

	factory := NewFactory(st)
	job, err := factory.CreateJobForRelease(ctx, release, nil)

	require.NoError(t, err)
	require.NotNil(t, job)

	configJSON, err := json.Marshal(job.JobAgentConfig)
	require.NoError(t, err)

	var configMap map[string]any
	err = json.Unmarshal(configJSON, &configMap)
	require.NoError(t, err)

	// All agent config should be preserved
	require.Equal(t, "https://api.example.com", configMap["baseUrl"])
	require.Equal(t, float64(30), configMap["timeout"])
	nested := configMap["nested"].(map[string]any)
	require.Equal(t, "value", nested["key"])
}

func TestFactory_MergeJobAgentConfig_AllThreeLevelsEmpty(t *testing.T) {
	// This test verifies behavior when all configs are minimal
	st := setupTestStore()
	ctx := context.Background()

	jobAgentId := "agent-1"

	// Minimal configs at all levels
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

	release := createTestRelease(t, "deploy-1", "env-1", "resource-1", "version-1")

	factory := NewFactory(st)
	job, err := factory.CreateJobForRelease(ctx, release, nil)

	require.NoError(t, err)
	require.NotNil(t, job)
	require.Equal(t, oapi.JobStatusPending, job.Status)

	configJSON, err := json.Marshal(job.JobAgentConfig)
	require.NoError(t, err)

	var configMap map[string]any
	err = json.Unmarshal(configJSON, &configMap)
	require.NoError(t, err)

	// Should only have the type discriminator
	require.Equal(t, "custom", configMap["type"])
}

// =============================================================================
// MergeJobAgentConfig Direct Unit Tests
// =============================================================================
// These tests call MergeJobAgentConfig directly to test the merge logic
// in isolation, without going through CreateJobForRelease.

func createTestVersion(t *testing.T, deploymentId string, jobAgentConfig map[string]interface{}) *oapi.DeploymentVersion {
	t.Helper()
	return &oapi.DeploymentVersion{
		Id:             "version-1",
		Tag:            "v1.0.0",
		DeploymentId:   deploymentId,
		Config:         map[string]interface{}{},
		Metadata:       map[string]string{},
		CreatedAt:      time.Now(),
		JobAgentConfig: jobAgentConfig,
	}
}

func TestMergeJobAgentConfig_BasicMerge_Custom(t *testing.T) {
	factory := NewFactory(nil) // Store not needed for direct merge tests

	jobAgentConfig := mustCreateJobAgentConfig(t, `{
		"type": "custom",
		"agentField": "agent-value",
		"shared": "from-agent"
	}`)

	deploymentConfig := mustCreateJobAgentConfig(t, `{
		"type": "custom",
		"deploymentField": "deployment-value",
		"shared": "from-deployment"
	}`)

	jobAgent := createTestJobAgent(t, "agent-1", "custom", jobAgentConfig)
	deployment := createTestDeployment(t, "deploy-1", nil, deploymentConfig)
	version := createTestVersion(t, "deploy-1", map[string]interface{}{
		"type":         "custom",
		"versionField": "version-value",
		"shared":       "from-version",
	})

	result, err := factory.MergeJobAgentConfig(deployment, jobAgent, version)
	require.NoError(t, err)

	configJSON, err := json.Marshal(result)
	require.NoError(t, err)

	var configMap map[string]any
	err = json.Unmarshal(configJSON, &configMap)
	require.NoError(t, err)

	// Each level's unique field should be present
	require.Equal(t, "agent-value", configMap["agentField"])
	require.Equal(t, "deployment-value", configMap["deploymentField"])
	require.Equal(t, "version-value", configMap["versionField"])

	// Shared field should have version's value (last wins)
	require.Equal(t, "from-version", configMap["shared"])

	// Type discriminator should be set
	require.Equal(t, "custom", configMap["type"])
}

func TestMergeJobAgentConfig_MergeOrder_VersionOverridesDeploymentOverridesAgent(t *testing.T) {
	factory := NewFactory(nil)

	jobAgentConfig := mustCreateJobAgentConfig(t, `{
		"type": "custom",
		"level1": "agent",
		"level2": "agent",
		"level3": "agent"
	}`)

	deploymentConfig := mustCreateJobAgentConfig(t, `{
		"type": "custom",
		"level2": "deployment",
		"level3": "deployment"
	}`)

	jobAgent := createTestJobAgent(t, "agent-1", "custom", jobAgentConfig)
	deployment := createTestDeployment(t, "deploy-1", nil, deploymentConfig)
	version := createTestVersion(t, "deploy-1", map[string]interface{}{
		"type":   "custom",
		"level3": "version",
	})

	result, err := factory.MergeJobAgentConfig(deployment, jobAgent, version)
	require.NoError(t, err)

	configJSON, err := json.Marshal(result)
	require.NoError(t, err)

	var configMap map[string]any
	err = json.Unmarshal(configJSON, &configMap)
	require.NoError(t, err)

	// level1: only in agent, should be "agent"
	require.Equal(t, "agent", configMap["level1"], "level1 should come from agent (not overridden)")

	// level2: agent + deployment, should be "deployment"
	require.Equal(t, "deployment", configMap["level2"], "level2 should come from deployment (overrides agent)")

	// level3: agent + deployment + version, should be "version"
	require.Equal(t, "version", configMap["level3"], "level3 should come from version (overrides deployment)")
}

func TestMergeJobAgentConfig_DeepMerge_NestedObjects(t *testing.T) {
	factory := NewFactory(nil)

	jobAgentConfig := mustCreateJobAgentConfig(t, `{
		"type": "custom",
		"settings": {
			"agent": {
				"key": "agent-value"
			},
			"shared": {
				"fromAgent": true,
				"override": "agent"
			}
		}
	}`)

	deploymentConfig := mustCreateJobAgentConfig(t, `{
		"type": "custom",
		"settings": {
			"deployment": {
				"key": "deployment-value"
			},
			"shared": {
				"fromDeployment": true,
				"override": "deployment"
			}
		}
	}`)

	jobAgent := createTestJobAgent(t, "agent-1", "custom", jobAgentConfig)
	deployment := createTestDeployment(t, "deploy-1", nil, deploymentConfig)
	version := createTestVersion(t, "deploy-1", map[string]interface{}{
		"type": "custom",
		"settings": map[string]interface{}{
			"version": map[string]interface{}{
				"key": "version-value",
			},
			"shared": map[string]interface{}{
				"fromVersion": true,
				"override":    "version",
			},
		},
	})

	result, err := factory.MergeJobAgentConfig(deployment, jobAgent, version)
	require.NoError(t, err)

	configJSON, err := json.Marshal(result)
	require.NoError(t, err)

	var configMap map[string]any
	err = json.Unmarshal(configJSON, &configMap)
	require.NoError(t, err)

	settings := configMap["settings"].(map[string]any)

	// Each level's nested object should be preserved
	agent := settings["agent"].(map[string]any)
	require.Equal(t, "agent-value", agent["key"])

	deploymentSettings := settings["deployment"].(map[string]any)
	require.Equal(t, "deployment-value", deploymentSettings["key"])

	versionSettings := settings["version"].(map[string]any)
	require.Equal(t, "version-value", versionSettings["key"])

	// Shared nested object should have all keys merged
	shared := settings["shared"].(map[string]any)
	require.Equal(t, true, shared["fromAgent"], "fromAgent should be preserved from agent")
	require.Equal(t, true, shared["fromDeployment"], "fromDeployment should be preserved from deployment")
	require.Equal(t, true, shared["fromVersion"], "fromVersion should be preserved from version")
	require.Equal(t, "version", shared["override"], "override should be from version (last wins)")
}

func TestMergeJobAgentConfig_NilVersionConfig(t *testing.T) {
	factory := NewFactory(nil)

	jobAgentConfig := mustCreateJobAgentConfig(t, `{
		"type": "custom",
		"field": "agent-value"
	}`)

	deploymentConfig := mustCreateJobAgentConfig(t, `{
		"type": "custom",
		"field": "deployment-value"
	}`)

	jobAgent := createTestJobAgent(t, "agent-1", "custom", jobAgentConfig)
	deployment := createTestDeployment(t, "deploy-1", nil, deploymentConfig)
	version := createTestVersion(t, "deploy-1", nil) // nil version config

	result, err := factory.MergeJobAgentConfig(deployment, jobAgent, version)
	require.NoError(t, err)

	configJSON, err := json.Marshal(result)
	require.NoError(t, err)

	var configMap map[string]any
	err = json.Unmarshal(configJSON, &configMap)
	require.NoError(t, err)

	// Should have deployment value since version is nil
	require.Equal(t, "deployment-value", configMap["field"])
}

func TestMergeJobAgentConfig_EmptyVersionConfig(t *testing.T) {
	factory := NewFactory(nil)

	jobAgentConfig := mustCreateJobAgentConfig(t, `{
		"type": "custom",
		"field": "agent-value"
	}`)

	deploymentConfig := mustCreateJobAgentConfig(t, `{
		"type": "custom",
		"field": "deployment-value"
	}`)

	jobAgent := createTestJobAgent(t, "agent-1", "custom", jobAgentConfig)
	deployment := createTestDeployment(t, "deploy-1", nil, deploymentConfig)
	version := createTestVersion(t, "deploy-1", map[string]interface{}{}) // empty map

	result, err := factory.MergeJobAgentConfig(deployment, jobAgent, version)
	require.NoError(t, err)

	configJSON, err := json.Marshal(result)
	require.NoError(t, err)

	var configMap map[string]any
	err = json.Unmarshal(configJSON, &configMap)
	require.NoError(t, err)

	// Should have deployment value since version is empty
	require.Equal(t, "deployment-value", configMap["field"])
}

func TestMergeJobAgentConfig_GithubApp_FullMerge(t *testing.T) {
	factory := NewFactory(nil)

	// JobAgent provides installationId and owner
	jobAgentConfig := mustCreateJobAgentConfig(t, `{
		"type": "github-app",
		"installationId": 12345,
		"owner": "my-org"
	}`)

	// Deployment provides repo, workflowId, and ref
	deploymentConfig := mustCreateJobAgentConfig(t, `{
		"type": "github-app",
		"repo": "my-repo",
		"workflowId": 67890,
		"ref": "main"
	}`)

	jobAgent := createTestJobAgent(t, "agent-1", "github-app", jobAgentConfig)
	deployment := createTestDeployment(t, "deploy-1", nil, deploymentConfig)
	version := createTestVersion(t, "deploy-1", map[string]interface{}{
		"type": "github-app",
		"ref":  "release-v2", // Version overrides ref
	})

	result, err := factory.MergeJobAgentConfig(deployment, jobAgent, version)
	require.NoError(t, err)

	fullConfig := getGithubJobAgentConfig(t, result)

	// From JobAgent
	require.Equal(t, 12345, fullConfig.InstallationId)
	require.Equal(t, "my-org", fullConfig.Owner)

	// From Deployment
	require.Equal(t, "my-repo", fullConfig.Repo)
	require.Equal(t, int64(67890), fullConfig.WorkflowId)

	// From Version (overrides deployment)
	require.NotNil(t, fullConfig.Ref)
	require.Equal(t, "release-v2", *fullConfig.Ref)

}

func TestMergeJobAgentConfig_ArgoCD_SkipsDeploymentConfig(t *testing.T) {
	// ArgoCD type skips deployment config (only uses agent + version)
	factory := NewFactory(nil)

	jobAgentConfig := mustCreateJobAgentConfig(t, `{
		"type": "argo-cd",
		"apiKey": "secret-key",
		"serverUrl": "https://argocd.example.com"
	}`)

	// This deployment config should be ignored for argo-cd type
	deploymentConfig := mustCreateJobAgentConfig(t, `{
		"type": "argo-cd"
	}`)

	jobAgent := createTestJobAgent(t, "agent-1", "argo-cd", jobAgentConfig)
	deployment := createTestDeployment(t, "deploy-1", nil, deploymentConfig)
	version := createTestVersion(t, "deploy-1", map[string]interface{}{
		"type":     "argo-cd",
		"template": "apiVersion: argoproj.io/v1alpha1\nkind: Application",
	})

	result, err := factory.MergeJobAgentConfig(deployment, jobAgent, version)
	require.NoError(t, err)

	fullConfig := getArgoCDJobAgentConfig(t, result)

	// From JobAgent
	require.Equal(t, "secret-key", fullConfig.ApiKey)
	require.Equal(t, "https://argocd.example.com", fullConfig.ServerUrl)

	// From Version
	require.Contains(t, fullConfig.Template, "argoproj.io/v1alpha1")
}

func TestMergeJobAgentConfig_TestRunner_SkipsDeploymentConfig(t *testing.T) {
	// TestRunner type skips deployment config (only uses agent + version)
	factory := NewFactory(nil)

	jobAgentConfig := mustCreateJobAgentConfig(t, `{
		"type": "test-runner",
		"delaySeconds": 5,
		"status": "completed"
	}`)

	deploymentConfig := mustCreateJobAgentConfig(t, `{
		"type": "test-runner"
	}`)

	jobAgent := createTestJobAgent(t, "agent-1", "test-runner", jobAgentConfig)
	deployment := createTestDeployment(t, "deploy-1", nil, deploymentConfig)
	version := createTestVersion(t, "deploy-1", map[string]interface{}{
		"type":    "test-runner",
		"message": "Custom message from version",
	})

	result, err := factory.MergeJobAgentConfig(deployment, jobAgent, version)
	require.NoError(t, err)

	fullConfig := getTestRunnerJobAgentConfig(t, result)

	// From JobAgent
	require.NotNil(t, fullConfig.DelaySeconds)
	require.Equal(t, 5, *fullConfig.DelaySeconds)
	require.NotNil(t, fullConfig.Status)
	require.Equal(t, "completed", *fullConfig.Status)

	// From Version
	require.NotNil(t, fullConfig.Message)
	require.Equal(t, "Custom message from version", *fullConfig.Message)
}

func TestMergeJobAgentConfig_TerraformCloud_FullMerge(t *testing.T) {
	factory := NewFactory(nil)

	jobAgentConfig := mustCreateJobAgentConfig(t, `{
		"type": "tfe",
		"address": "https://app.terraform.io",
		"organization": "my-org",
		"token": "secret-token"
	}`)

	deploymentConfig := mustCreateJobAgentConfig(t, `{
		"type": "tfe",
		"template": "default-template"
	}`)

	jobAgent := createTestJobAgent(t, "agent-1", "tfe", jobAgentConfig)
	deployment := createTestDeployment(t, "deploy-1", nil, deploymentConfig)
	version := createTestVersion(t, "deploy-1", map[string]interface{}{
		"type":     "tfe",
		"template": "version-template", // Override deployment template
	})

	result, err := factory.MergeJobAgentConfig(deployment, jobAgent, version)
	require.NoError(t, err)

	fullConfig := getTerraformCloudJobAgentConfig(t, result)

	// From JobAgent
	require.Equal(t, "https://app.terraform.io", fullConfig.Address)
	require.Equal(t, "my-org", fullConfig.Organization)
	require.Equal(t, "secret-token", fullConfig.Token)

	// From Version (overrides deployment)
	require.Equal(t, "version-template", fullConfig.Template)
}

func TestMergeJobAgentConfig_ArraysAreReplaced(t *testing.T) {
	factory := NewFactory(nil)

	jobAgentConfig := mustCreateJobAgentConfig(t, `{
		"type": "custom",
		"tags": ["agent-tag-1", "agent-tag-2"]
	}`)

	deploymentConfig := mustCreateJobAgentConfig(t, `{
		"type": "custom",
		"tags": ["deployment-tag"]
	}`)

	jobAgent := createTestJobAgent(t, "agent-1", "custom", jobAgentConfig)
	deployment := createTestDeployment(t, "deploy-1", nil, deploymentConfig)
	version := createTestVersion(t, "deploy-1", nil)

	result, err := factory.MergeJobAgentConfig(deployment, jobAgent, version)
	require.NoError(t, err)

	configJSON, err := json.Marshal(result)
	require.NoError(t, err)

	var configMap map[string]any
	err = json.Unmarshal(configJSON, &configMap)
	require.NoError(t, err)

	// Arrays should be replaced, not merged
	tags := configMap["tags"].([]any)
	require.Len(t, tags, 1, "Arrays should be replaced, not merged")
	require.Equal(t, "deployment-tag", tags[0])
}

func TestMergeJobAgentConfig_VersionArrayOverridesDeployment(t *testing.T) {
	factory := NewFactory(nil)

	jobAgentConfig := mustCreateJobAgentConfig(t, `{
		"type": "custom",
		"tags": ["agent-tag"]
	}`)

	deploymentConfig := mustCreateJobAgentConfig(t, `{
		"type": "custom",
		"tags": ["deployment-tag-1", "deployment-tag-2"]
	}`)

	jobAgent := createTestJobAgent(t, "agent-1", "custom", jobAgentConfig)
	deployment := createTestDeployment(t, "deploy-1", nil, deploymentConfig)
	version := createTestVersion(t, "deploy-1", map[string]interface{}{
		"type": "custom",
		"tags": []string{"version-tag"},
	})

	result, err := factory.MergeJobAgentConfig(deployment, jobAgent, version)
	require.NoError(t, err)

	configJSON, err := json.Marshal(result)
	require.NoError(t, err)

	var configMap map[string]any
	err = json.Unmarshal(configJSON, &configMap)
	require.NoError(t, err)

	tags := configMap["tags"].([]any)
	require.Len(t, tags, 1)
	require.Equal(t, "version-tag", tags[0])
}

func TestMergeJobAgentConfig_DeeplyNestedOverride(t *testing.T) {
	factory := NewFactory(nil)

	jobAgentConfig := mustCreateJobAgentConfig(t, `{
		"type": "custom",
		"level1": {
			"level2": {
				"level3": {
					"fromAgent": "agent",
					"override": "agent"
				}
			}
		}
	}`)

	deploymentConfig := mustCreateJobAgentConfig(t, `{
		"type": "custom",
		"level1": {
			"level2": {
				"level3": {
					"fromDeployment": "deployment",
					"override": "deployment"
				}
			}
		}
	}`)

	jobAgent := createTestJobAgent(t, "agent-1", "custom", jobAgentConfig)
	deployment := createTestDeployment(t, "deploy-1", nil, deploymentConfig)
	version := createTestVersion(t, "deploy-1", map[string]interface{}{
		"type": "custom",
		"level1": map[string]interface{}{
			"level2": map[string]interface{}{
				"level3": map[string]interface{}{
					"fromVersion": "version",
					"override":    "version",
				},
			},
		},
	})

	result, err := factory.MergeJobAgentConfig(deployment, jobAgent, version)
	require.NoError(t, err)

	configJSON, err := json.Marshal(result)
	require.NoError(t, err)

	var configMap map[string]any
	err = json.Unmarshal(configJSON, &configMap)
	require.NoError(t, err)

	level1 := configMap["level1"].(map[string]any)
	level2 := level1["level2"].(map[string]any)
	level3 := level2["level3"].(map[string]any)

	// All sources should be merged
	require.Equal(t, "agent", level3["fromAgent"])
	require.Equal(t, "deployment", level3["fromDeployment"])
	require.Equal(t, "version", level3["fromVersion"])

	// Override should be from version (last wins)
	require.Equal(t, "version", level3["override"])
}

func TestMergeJobAgentConfig_NullOverridesValue(t *testing.T) {
	factory := NewFactory(nil)

	jobAgentConfig := mustCreateJobAgentConfig(t, `{
		"type": "custom",
		"field": "agent-value",
		"keepThis": "keep"
	}`)

	deploymentConfig := mustCreateJobAgentConfig(t, `{
		"type": "custom"
	}`)

	jobAgent := createTestJobAgent(t, "agent-1", "custom", jobAgentConfig)
	deployment := createTestDeployment(t, "deploy-1", nil, deploymentConfig)
	version := createTestVersion(t, "deploy-1", map[string]interface{}{
		"type":  "custom",
		"field": nil, // Explicitly set to nil
	})

	result, err := factory.MergeJobAgentConfig(deployment, jobAgent, version)
	require.NoError(t, err)

	configJSON, err := json.Marshal(result)
	require.NoError(t, err)

	var configMap map[string]any
	err = json.Unmarshal(configJSON, &configMap)
	require.NoError(t, err)

	// Field should be nil (overridden by version)
	require.Nil(t, configMap["field"])

	// Other fields should be preserved
	require.Equal(t, "keep", configMap["keepThis"])
}

// =============================================================================
// toMap Function Unit Tests
// =============================================================================

func TestToMap_NilInput(t *testing.T) {
	result, err := toMap(nil)
	require.NoError(t, err)
	require.NotNil(t, result)
	require.Empty(t, result)
}

func TestToMap_MapStringAnyInput(t *testing.T) {
	input := map[string]any{
		"key1": "value1",
		"key2": 42,
		"key3": true,
	}

	result, err := toMap(input)
	require.NoError(t, err)
	require.Equal(t, input, result)
}

func TestToMap_EmptyMapInput(t *testing.T) {
	input := map[string]any{}

	result, err := toMap(input)
	require.NoError(t, err)
	require.NotNil(t, result)
	require.Empty(t, result)
}

func TestToMap_StructInput(t *testing.T) {
	type testStruct struct {
		Name  string `json:"name"`
		Value int    `json:"value"`
	}

	input := testStruct{
		Name:  "test",
		Value: 123,
	}

	result, err := toMap(input)
	require.NoError(t, err)
	require.Equal(t, "test", result["name"])
	require.Equal(t, float64(123), result["value"]) // JSON numbers become float64
}

func TestToMap_StructPointerInput(t *testing.T) {
	type testStruct struct {
		Name  string `json:"name"`
		Value int    `json:"value"`
	}

	input := &testStruct{
		Name:  "test-ptr",
		Value: 456,
	}

	result, err := toMap(input)
	require.NoError(t, err)
	require.Equal(t, "test-ptr", result["name"])
	require.Equal(t, float64(456), result["value"])
}

func TestToMap_NestedStructInput(t *testing.T) {
	type inner struct {
		InnerKey string `json:"innerKey"`
	}
	type outer struct {
		OuterKey string `json:"outerKey"`
		Nested   inner  `json:"nested"`
	}

	input := outer{
		OuterKey: "outer-value",
		Nested: inner{
			InnerKey: "inner-value",
		},
	}

	result, err := toMap(input)
	require.NoError(t, err)
	require.Equal(t, "outer-value", result["outerKey"])

	nested, ok := result["nested"].(map[string]any)
	require.True(t, ok, "nested should be a map")
	require.Equal(t, "inner-value", nested["innerKey"])
}

func TestToMap_MapStringInterfaceInput(t *testing.T) {
	// map[string]interface{} is equivalent to map[string]any
	input := map[string]interface{}{
		"key1": "value1",
		"key2": 42,
	}

	result, err := toMap(input)
	require.NoError(t, err)
	require.Equal(t, "value1", result["key1"])
	require.Equal(t, 42, result["key2"])
}

func TestToMap_NestedMapInput(t *testing.T) {
	input := map[string]any{
		"level1": map[string]any{
			"level2": map[string]any{
				"deep": "value",
			},
		},
	}

	result, err := toMap(input)
	require.NoError(t, err)

	level1, ok := result["level1"].(map[string]any)
	require.True(t, ok)

	level2, ok := level1["level2"].(map[string]any)
	require.True(t, ok)

	require.Equal(t, "value", level2["deep"])
}

func TestToMap_WithNilValues(t *testing.T) {
	input := map[string]any{
		"key1":    "value1",
		"nullKey": nil,
	}

	result, err := toMap(input)
	require.NoError(t, err)
	require.Equal(t, "value1", result["key1"])
	require.Nil(t, result["nullKey"])
}

func TestToMap_WithArrayValues(t *testing.T) {
	input := map[string]any{
		"tags": []string{"tag1", "tag2", "tag3"},
	}

	result, err := toMap(input)
	require.NoError(t, err)

	tags, ok := result["tags"].([]string)
	require.True(t, ok)
	require.Len(t, tags, 3)
	require.Equal(t, []string{"tag1", "tag2", "tag3"}, tags)
}

func TestToMap_StructWithOmitEmpty(t *testing.T) {
	type testStruct struct {
		Name    string  `json:"name"`
		Empty   string  `json:"empty,omitempty"`
		Pointer *string `json:"pointer,omitempty"`
	}

	input := testStruct{
		Name:    "test",
		Empty:   "",
		Pointer: nil,
	}

	result, err := toMap(input)
	require.NoError(t, err)
	require.Equal(t, "test", result["name"])

	// omitempty fields should not be present
	_, hasEmpty := result["empty"]
	require.False(t, hasEmpty, "empty field with omitempty should not be present")

	_, hasPointer := result["pointer"]
	require.False(t, hasPointer, "nil pointer with omitempty should not be present")
}

func TestToMap_StructWithAllTypes(t *testing.T) {
	type testStruct struct {
		String  string         `json:"string"`
		Int     int            `json:"int"`
		Float   float64        `json:"float"`
		Bool    bool           `json:"bool"`
		Slice   []string       `json:"slice"`
		Map     map[string]int `json:"map"`
		Pointer *string        `json:"pointer"`
	}

	strPtr := "pointer-value"
	input := testStruct{
		String:  "hello",
		Int:     42,
		Float:   3.14,
		Bool:    true,
		Slice:   []string{"a", "b"},
		Map:     map[string]int{"x": 1, "y": 2},
		Pointer: &strPtr,
	}

	result, err := toMap(input)
	require.NoError(t, err)

	require.Equal(t, "hello", result["string"])
	require.Equal(t, float64(42), result["int"]) // JSON numbers are float64
	require.Equal(t, 3.14, result["float"])
	require.Equal(t, true, result["bool"])
	require.Equal(t, "pointer-value", result["pointer"])

	slice, ok := result["slice"].([]any)
	require.True(t, ok)
	require.Len(t, slice, 2)

	mapVal, ok := result["map"].(map[string]any)
	require.True(t, ok)
	require.Equal(t, float64(1), mapVal["x"])
	require.Equal(t, float64(2), mapVal["y"])
}

func TestToMap_EmptyStruct(t *testing.T) {
	type emptyStruct struct{}

	input := emptyStruct{}

	result, err := toMap(input)
	require.NoError(t, err)
	require.NotNil(t, result)
	require.Empty(t, result)
}

func TestToMap_AnonymousStruct(t *testing.T) {
	input := struct {
		Field1 string `json:"field1"`
		Field2 int    `json:"field2"`
	}{
		Field1: "anonymous",
		Field2: 999,
	}

	result, err := toMap(input)
	require.NoError(t, err)
	require.Equal(t, "anonymous", result["field1"])
	require.Equal(t, float64(999), result["field2"])
}

func TestToMap_UnexportedFields(t *testing.T) {
	type testStruct struct {
		Exported   string `json:"exported"`
		unexported string //nolint:unused
	}

	input := testStruct{
		Exported:   "visible",
		unexported: "hidden",
	}

	result, err := toMap(input)
	require.NoError(t, err)
	require.Equal(t, "visible", result["exported"])

	// unexported field should not be present
	_, hasUnexported := result["unexported"]
	require.False(t, hasUnexported, "unexported field should not be in result")
}

func TestToMap_PrimitiveString(t *testing.T) {
	// A primitive string cannot be converted to a map
	input := "just a string"

	_, err := toMap(input)
	require.Error(t, err, "primitive string should fail to convert to map")
}

func TestToMap_PrimitiveInt(t *testing.T) {
	// A primitive int cannot be converted to a map
	input := 42

	_, err := toMap(input)
	require.Error(t, err, "primitive int should fail to convert to map")
}

func TestToMap_SliceInput(t *testing.T) {
	// A slice at the top level cannot be converted to a map
	input := []string{"a", "b", "c"}

	_, err := toMap(input)
	require.Error(t, err, "slice should fail to convert to map")
}
