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
	err := config.UnmarshalJSON([]byte(configJSON))
	require.NoError(t, err)
	return config
}

func mustCreateDeploymentJobAgentConfig(t *testing.T, configJSON string) oapi.DeploymentJobAgentConfig {
	t.Helper()
	var config oapi.DeploymentJobAgentConfig
	err := config.UnmarshalJSON([]byte(configJSON))
	require.NoError(t, err)
	return config
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

func createTestDeployment(t *testing.T, id string, jobAgentId *string, jobAgentConfig oapi.DeploymentJobAgentConfig) *oapi.Deployment {
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
	jobAgentConfig := mustCreateJobAgentConfig(t, `{
		"type": "github-app",
		"installationId": 12345,
		"owner": "my-org"
	}`)

	// Deployment has repo, workflowId, and ref (deployment overrides)
	deploymentConfig := mustCreateDeploymentJobAgentConfig(t, `{
		"type": "github-app",
		"repo": "my-repo",
		"workflowId": 67890,
		"ref": "main"
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
	require.Equal(t, oapi.JobStatusPending, job.Status)
	require.Equal(t, jobAgentId, job.JobAgentId)

	// Verify the merged config has all fields
	fullConfig, err := job.JobAgentConfig.AsFullGithubJobAgentConfig()
	require.NoError(t, err)

	// From JobAgent
	require.Equal(t, 12345, fullConfig.InstallationId)
	require.Equal(t, "my-org", fullConfig.Owner)

	// From Deployment
	require.Equal(t, "my-repo", fullConfig.Repo)
	require.Equal(t, int64(67890), fullConfig.WorkflowId)
	require.NotNil(t, fullConfig.Ref)
	require.Equal(t, "main", *fullConfig.Ref)

	// Type discriminator should be set
	require.Equal(t, oapi.FullGithubJobAgentConfigType("github-app"), fullConfig.Type)
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
	deploymentConfig := mustCreateDeploymentJobAgentConfig(t, `{
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

	fullConfig, err := job.JobAgentConfig.AsFullGithubJobAgentConfig()
	require.NoError(t, err)

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
	deploymentConfig := mustCreateDeploymentJobAgentConfig(t, `{
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
	fullConfig, err := job.JobAgentConfig.AsFullArgoCDJobAgentConfig()
	require.NoError(t, err)

	// From JobAgent
	require.Equal(t, "secret-api-key", fullConfig.ApiKey)
	require.Equal(t, "https://argocd.example.com", fullConfig.ServerUrl)

	// From Version
	require.Contains(t, fullConfig.Template, "argoproj.io/v1alpha1")
	require.Contains(t, fullConfig.Template, "{{ .deployment.name }}")

	// Type discriminator should be set
	require.Equal(t, oapi.FullArgoCDJobAgentConfigType("argo-cd"), fullConfig.Type)
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
	deploymentConfig := mustCreateDeploymentJobAgentConfig(t, `{
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
	fullConfig, err := job.JobAgentConfig.AsFullTerraformCloudJobAgentConfig()
	require.NoError(t, err)

	// From JobAgent
	require.Equal(t, "https://app.terraform.io", fullConfig.Address)
	require.Equal(t, "my-org", fullConfig.Organization)
	require.Equal(t, "secret-token", fullConfig.Token)

	// From Deployment
	require.Contains(t, fullConfig.Template, "{{ .deployment.name }}")
	require.Contains(t, fullConfig.Template, "/terraform")

	// Type discriminator should be set
	require.Equal(t, oapi.FullTerraformCloudJobAgentConfigType("tfe"), fullConfig.Type)
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
	deploymentConfig := mustCreateDeploymentJobAgentConfig(t, `{
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

	fullConfig, err := job.JobAgentConfig.AsFullTerraformCloudJobAgentConfig()
	require.NoError(t, err)

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
	deploymentConfig := mustCreateDeploymentJobAgentConfig(t, `{
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
	configJSON, err := job.JobAgentConfig.MarshalJSON()
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
	deploymentConfig := mustCreateDeploymentJobAgentConfig(t, `{
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

	configJSON, err := job.JobAgentConfig.MarshalJSON()
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
	deploymentConfig := mustCreateDeploymentJobAgentConfig(t, `{
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

	configJSON, err := job.JobAgentConfig.MarshalJSON()
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

func TestFactory_CreateJobForRelease_MismatchedDiscriminator(t *testing.T) {
	st := setupTestStore()
	ctx := context.Background()

	jobAgentId := "agent-1"

	// JobAgent is github-app type
	jobAgentConfig := mustCreateJobAgentConfig(t, `{
		"type": "github-app",
		"installationId": 12345,
		"owner": "my-org"
	}`)

	// Deployment is argo-cd type (MISMATCH!)
	deploymentConfig := mustCreateDeploymentJobAgentConfig(t, `{
		"type": "argo-cd",
		"template": "some-template"
	}`)

	jobAgent := createTestJobAgent(t, jobAgentId, "github-app", jobAgentConfig)
	deployment := createTestDeployment(t, "deploy-1", &jobAgentId, deploymentConfig)

	st.JobAgents.Upsert(ctx, jobAgent)
	_ = st.Deployments.Upsert(ctx, deployment)

	release := createTestRelease(t, "deploy-1", "env-1", "resource-1", "version-1")

	factory := NewFactory(st)
	job, err := factory.CreateJobForRelease(ctx, release, nil)

	// Should create a job with InvalidJobAgent status due to type mismatch
	require.NoError(t, err)
	require.NotNil(t, job)
	require.Equal(t, oapi.JobStatusInvalidJobAgent, job.Status)
	require.Equal(t, jobAgentId, job.JobAgentId)
	require.NotNil(t, job.Message)
	require.Contains(t, *job.Message, "does not match")
}

func TestFactory_CreateJobForRelease_InvalidDeploymentDiscriminator(t *testing.T) {
	st := setupTestStore()
	ctx := context.Background()

	jobAgentId := "agent-1"

	// JobAgent with valid github-app config
	jobAgentConfig := mustCreateJobAgentConfig(t, `{
		"type": "github-app",
		"installationId": 12345,
		"owner": "my-org"
	}`)

	// Deployment has empty/invalid discriminator value
	var deploymentConfig oapi.DeploymentJobAgentConfig
	// Force an empty discriminator by creating an empty union
	_ = deploymentConfig.UnmarshalJSON([]byte(`{}`))

	jobAgent := createTestJobAgent(t, jobAgentId, "github-app", jobAgentConfig)
	deployment := createTestDeployment(t, "deploy-1", &jobAgentId, deploymentConfig)

	st.JobAgents.Upsert(ctx, jobAgent)
	_ = st.Deployments.Upsert(ctx, deployment)

	release := createTestRelease(t, "deploy-1", "env-1", "resource-1", "version-1")

	factory := NewFactory(st)
	job, err := factory.CreateJobForRelease(ctx, release, nil)

	// Should create a job with InvalidJobAgent status due to invalid config
	require.NoError(t, err)
	require.NotNil(t, job)
	require.Equal(t, oapi.JobStatusInvalidJobAgent, job.Status)
	require.Equal(t, jobAgentId, job.JobAgentId)
	require.NotNil(t, job.Message)
	require.Contains(t, *job.Message, "Failed to merge job agent config")
}

func TestFactory_CreateJobForRelease_NoJobAgentConfigured(t *testing.T) {
	st := setupTestStore()
	ctx := context.Background()

	// Deployment has no job agent configured
	deploymentConfig := mustCreateDeploymentJobAgentConfig(t, `{"type": "custom"}`)
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
	deploymentConfig := mustCreateDeploymentJobAgentConfig(t, `{"type": "custom"}`)
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

	// Deployment config - test-runner type isn't in DeploymentJobAgentConfig,
	// so we use custom type that matches the discriminator check
	// Note: The deployment config type must match the job agent config type
	// Since test-runner is not a valid DeploymentJobAgentConfig type,
	// we'll use custom as a workaround for this test
	deploymentConfig := mustCreateDeploymentJobAgentConfig(t, `{
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
	fullConfig, err := job.JobAgentConfig.AsFullTestRunnerJobAgentConfig()
	require.NoError(t, err)

	require.NotNil(t, fullConfig.DelaySeconds)
	require.Equal(t, 5, *fullConfig.DelaySeconds)
	require.NotNil(t, fullConfig.Status)
	require.Equal(t, oapi.TestRunnerJobAgentConfigStatus("completed"), *fullConfig.Status)
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

	deploymentConfig := mustCreateDeploymentJobAgentConfig(t, `{
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

	deploymentConfig := mustCreateDeploymentJobAgentConfig(t, `{
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
	deploymentConfig := mustCreateDeploymentJobAgentConfig(t, `{"type": "custom"}`)
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

	deploymentConfig := mustCreateDeploymentJobAgentConfig(t, `{
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

	configJSON, err := job.JobAgentConfig.MarshalJSON()
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

	deploymentConfig := mustCreateDeploymentJobAgentConfig(t, `{
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

	configJSON, err := job.JobAgentConfig.MarshalJSON()
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

	deploymentConfig := mustCreateDeploymentJobAgentConfig(t, `{
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

	configJSON, err := job.JobAgentConfig.MarshalJSON()
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

	deploymentConfig := mustCreateDeploymentJobAgentConfig(t, `{
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

	configJSON, err := job.JobAgentConfig.MarshalJSON()
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

	deploymentConfig := mustCreateDeploymentJobAgentConfig(t, `{
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

	configJSON, err := job.JobAgentConfig.MarshalJSON()
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

	deploymentConfig := mustCreateDeploymentJobAgentConfig(t, `{
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

	fullConfig, err := job.JobAgentConfig.AsFullGithubJobAgentConfig()
	require.NoError(t, err)

	require.Equal(t, 12345, fullConfig.InstallationId)
	require.Equal(t, "my-org", fullConfig.Owner)
	require.Equal(t, "my-repo", fullConfig.Repo)
	require.Equal(t, int64(67890), fullConfig.WorkflowId)
	require.NotNil(t, fullConfig.Ref)
	require.Equal(t, "release-v2", *fullConfig.Ref)
}
