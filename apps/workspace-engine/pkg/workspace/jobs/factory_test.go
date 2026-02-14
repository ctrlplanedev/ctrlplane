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
		SystemIds:        []string{"system-1"},
		JobAgentId:       jobAgentId,
		JobAgentConfig:   jobAgentConfig,
		ResourceSelector: mustCreateResourceSelector(t),
	}
}

func createTestEnvironment(t *testing.T, id string, systemId string, name string) *oapi.Environment {
	t.Helper()
	return &oapi.Environment{
		Id:               id,
		Name:             name,
		SystemIds:        []string{systemId},
		Metadata:         map[string]string{},
		CreatedAt:        time.Now(),
		ResourceSelector: mustCreateResourceSelector(t),
	}
}

func createTestResource(t *testing.T, id string, name string, kind string, identifier string, config map[string]interface{}) *oapi.Resource {
	t.Helper()
	return &oapi.Resource{
		Id:         id,
		Name:       name,
		Kind:       kind,
		Identifier: identifier,
		Config:     config,
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
	environment := createTestEnvironment(t, "env-1", "system-1", "production")
	resource := createTestResource(t, "resource-1", "server-1", "server", "server-1", map[string]interface{}{})

	_, _ = st.Resources.Upsert(ctx, resource)
	st.JobAgents.Upsert(ctx, jobAgent)
	_ = st.Deployments.Upsert(ctx, deployment)
	_ = st.Environments.Upsert(ctx, environment)
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
	resource := createTestResource(t, "resource-1", "server-1", "server", "server-1", map[string]interface{}{})
	environment := createTestEnvironment(t, "env-1", "system-1", "production")

	_, _ = st.Resources.Upsert(ctx, resource)
	_ = st.Environments.Upsert(ctx, environment)
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
// Dispatch Context Tests (new factory responsibility)
// =============================================================================

func setupFullStore(t *testing.T) (*store.Store, string, string, string, string) {
	t.Helper()
	st := setupTestStore()
	ctx := context.Background()

	jobAgentId := "agent-1"
	deploymentId := "deploy-1"
	environmentId := "env-1"
	resourceId := "resource-1"

	jobAgent := createTestJobAgent(t, jobAgentId, "custom", mustCreateJobAgentConfig(t, `{"agent_key": "agent_val"}`))
	deployment := createTestDeployment(t, deploymentId, &jobAgentId, mustCreateJobAgentConfig(t, `{"deploy_key": "deploy_val"}`))

	environment := &oapi.Environment{
		Id:        environmentId,
		Name:      "production",
		SystemIds: []string{"system-1"},
		Metadata:  map[string]string{},
	}

	resource := &oapi.Resource{
		Id:         resourceId,
		Name:       "server-1",
		Kind:       "server",
		Identifier: "server-1",
		Config:     map[string]interface{}{},
		Metadata:   map[string]string{"region": "us-east-1"},
		CreatedAt:  time.Now(),
	}

	st.JobAgents.Upsert(ctx, jobAgent)
	_ = st.Deployments.Upsert(ctx, deployment)
	_ = st.Environments.Upsert(ctx, environment)
	st.Resources.Upsert(ctx, resource)

	return st, jobAgentId, deploymentId, environmentId, resourceId
}

func TestFactory_CreateJobForRelease_BuildsDispatchContext(t *testing.T) {
	st, _, deploymentId, environmentId, resourceId := setupFullStore(t)
	ctx := context.Background()

	release := createTestRelease(t, deploymentId, environmentId, resourceId, "version-1")

	factory := NewFactory(st)
	job, err := factory.CreateJobForRelease(ctx, release, nil)

	require.NoError(t, err)
	require.NotNil(t, job)
	require.NotNil(t, job.DispatchContext)

	dc := job.DispatchContext
	require.NotNil(t, dc.Release)
	require.NotNil(t, dc.Deployment)
	require.NotNil(t, dc.Environment)
	require.NotNil(t, dc.Resource)
	require.NotNil(t, dc.Version)
	require.Equal(t, "agent-1", dc.JobAgent.Id)
}

func TestFactory_CreateJobForRelease_DispatchContextHasCorrectEntities(t *testing.T) {
	st, _, deploymentId, environmentId, resourceId := setupFullStore(t)
	ctx := context.Background()

	release := createTestRelease(t, deploymentId, environmentId, resourceId, "version-1")

	factory := NewFactory(st)
	job, err := factory.CreateJobForRelease(ctx, release, nil)

	require.NoError(t, err)
	dc := job.DispatchContext

	require.Equal(t, deploymentId, dc.Deployment.Id)
	require.Equal(t, environmentId, dc.Environment.Id)
	require.Equal(t, resourceId, dc.Resource.Id)
	require.Equal(t, "v1.0.0", dc.Version.Tag)
}

func TestFactory_CreateJobForRelease_DispatchContextVariablesPointsToReleaseVariables(t *testing.T) {
	st, _, deploymentId, environmentId, resourceId := setupFullStore(t)
	ctx := context.Background()

	release := createTestRelease(t, deploymentId, environmentId, resourceId, "version-1")
	litVal := oapi.LiteralValue{}
	_ = litVal.FromStringValue("my-app")
	release.Variables = map[string]oapi.LiteralValue{
		"app_name": litVal,
	}

	factory := NewFactory(st)
	job, err := factory.CreateJobForRelease(ctx, release, nil)

	require.NoError(t, err)
	require.NotNil(t, job.DispatchContext.Variables)

	vars := *job.DispatchContext.Variables
	appName, exists := vars["app_name"]
	require.True(t, exists)
	val, err := appName.AsStringValue()
	require.NoError(t, err)
	require.Equal(t, "my-app", val)
}

func TestFactory_CreateJobForRelease_MergesJobAgentConfig(t *testing.T) {
	st := setupTestStore()
	ctx := context.Background()

	jobAgentId := "agent-1"

	agentConfig := mustCreateJobAgentConfig(t, `{"shared": "from_agent", "agent_only": "yes"}`)
	deployConfig := mustCreateJobAgentConfig(t, `{"shared": "from_deploy", "deploy_only": "yes"}`)
	versionConfig := oapi.JobAgentConfig{"shared": "from_version", "version_only": "yes"}

	jobAgent := createTestJobAgent(t, jobAgentId, "custom", agentConfig)
	deployment := createTestDeployment(t, "deploy-1", &jobAgentId, deployConfig)

	environment := &oapi.Environment{
		Id: "env-1", Name: "prod", SystemIds: []string{"system-1"}, Metadata: map[string]string{},
	}
	resource := &oapi.Resource{
		Id: "resource-1", Name: "server-1", Kind: "server", Identifier: "server-1",
		Config: map[string]interface{}{}, Metadata: map[string]string{}, CreatedAt: time.Now(),
	}

	st.JobAgents.Upsert(ctx, jobAgent)
	_ = st.Deployments.Upsert(ctx, deployment)
	_ = st.Environments.Upsert(ctx, environment)
	st.Resources.Upsert(ctx, resource)

	release := createTestReleaseWithJobAgentConfig(t, "deploy-1", "env-1", "resource-1", "version-1", versionConfig)

	factory := NewFactory(st)
	job, err := factory.CreateJobForRelease(ctx, release, nil)

	require.NoError(t, err)
	require.NotNil(t, job)

	// Version config wins for "shared" since it's applied last
	require.Equal(t, "from_version", job.JobAgentConfig["shared"])
	require.Equal(t, "yes", job.JobAgentConfig["agent_only"])
	require.Equal(t, "yes", job.JobAgentConfig["deploy_only"])
	require.Equal(t, "yes", job.JobAgentConfig["version_only"])
}

func TestFactory_CreateJobForRelease_DispatchContextEnvironmentNotFound(t *testing.T) {
	st := setupTestStore()
	ctx := context.Background()

	jobAgentId := "agent-1"
	jobAgent := createTestJobAgent(t, jobAgentId, "custom", mustCreateJobAgentConfig(t, `{}`))
	deployment := createTestDeployment(t, "deploy-1", &jobAgentId, mustCreateJobAgentConfig(t, `{}`))

	resource := &oapi.Resource{
		Id: "resource-1", Name: "server-1", Kind: "server", Identifier: "server-1",
		Config: map[string]interface{}{}, Metadata: map[string]string{}, CreatedAt: time.Now(),
	}

	st.JobAgents.Upsert(ctx, jobAgent)
	_ = st.Deployments.Upsert(ctx, deployment)
	st.Resources.Upsert(ctx, resource)
	// Deliberately not adding environment

	release := createTestRelease(t, "deploy-1", "env-missing", "resource-1", "version-1")

	factory := NewFactory(st)
	job, err := factory.CreateJobForRelease(ctx, release, nil)

	require.Error(t, err)
	require.Nil(t, job)
	require.Contains(t, err.Error(), "environment")
	require.Contains(t, err.Error(), "not found")
}

func TestFactory_CreateJobForRelease_DispatchContextResourceNotFound(t *testing.T) {
	st := setupTestStore()
	ctx := context.Background()

	jobAgentId := "agent-1"
	jobAgent := createTestJobAgent(t, jobAgentId, "custom", mustCreateJobAgentConfig(t, `{}`))
	deployment := createTestDeployment(t, "deploy-1", &jobAgentId, mustCreateJobAgentConfig(t, `{}`))

	environment := &oapi.Environment{
		Id: "env-1", Name: "prod", SystemIds: []string{"system-1"}, Metadata: map[string]string{},
	}

	st.JobAgents.Upsert(ctx, jobAgent)
	_ = st.Deployments.Upsert(ctx, deployment)
	_ = st.Environments.Upsert(ctx, environment)
	// Deliberately not adding resource

	release := createTestRelease(t, "deploy-1", "env-1", "resource-missing", "version-1")

	factory := NewFactory(st)
	job, err := factory.CreateJobForRelease(ctx, release, nil)

	require.Error(t, err)
	require.Nil(t, job)
	require.Contains(t, err.Error(), "resource")
	require.Contains(t, err.Error(), "not found")
}

// =============================================================================
// Workflow Job Tests
// =============================================================================

func setupWorkflowStore(t *testing.T) (*store.Store, *oapi.JobAgent) {
	t.Helper()
	st := setupTestStore()
	ctx := context.Background()

	jobAgent := createTestJobAgent(t, "agent-1", "custom", mustCreateJobAgentConfig(t, `{"agent_key": "agent_val"}`))
	st.JobAgents.Upsert(ctx, jobAgent)

	workflow := &oapi.Workflow{
		Id:   "workflow-1",
		Name: "test-workflow",
	}
	st.Workflows.Upsert(ctx, workflow)

	workflowRun := &oapi.WorkflowRun{
		Id:         "wf-run-1",
		WorkflowId: "workflow-1",
		Inputs:     map[string]interface{}{"key": "value"},
	}
	st.WorkflowRuns.Upsert(ctx, workflowRun)

	return st, jobAgent
}

func TestFactory_CreateJobForWorkflowJob_Success(t *testing.T) {
	st, jobAgent := setupWorkflowStore(t)
	ctx := context.Background()

	wfJob := &oapi.WorkflowJob{
		Id:            "wf-job-1",
		WorkflowRunId: "wf-run-1",
		Index:         0,
		Ref:           jobAgent.Id,
		Config:        map[string]interface{}{"wf_key": "wf_val"},
	}
	st.WorkflowJobs.Upsert(ctx, wfJob)

	factory := NewFactory(st)
	job, err := factory.CreateJobForWorkflowJob(ctx, wfJob)

	require.NoError(t, err)
	require.NotNil(t, job)
	require.Equal(t, oapi.JobStatusPending, job.Status)
	require.Equal(t, jobAgent.Id, job.JobAgentId)
	require.Equal(t, wfJob.Id, job.WorkflowJobId)
}

func TestFactory_CreateJobForWorkflowJob_BuildsDispatchContext(t *testing.T) {
	st, jobAgent := setupWorkflowStore(t)
	ctx := context.Background()

	wfJob := &oapi.WorkflowJob{
		Id:            "wf-job-1",
		WorkflowRunId: "wf-run-1",
		Index:         0,
		Ref:           jobAgent.Id,
		Config:        map[string]interface{}{"wf_key": "wf_val"},
	}
	st.WorkflowJobs.Upsert(ctx, wfJob)

	factory := NewFactory(st)
	job, err := factory.CreateJobForWorkflowJob(ctx, wfJob)

	require.NoError(t, err)
	dc := job.DispatchContext
	require.NotNil(t, dc)

	require.Equal(t, jobAgent.Id, dc.JobAgent.Id)
	require.NotNil(t, dc.WorkflowJob)
	require.Equal(t, wfJob.Id, dc.WorkflowJob.Id)
	require.NotNil(t, dc.WorkflowRun)
	require.Equal(t, "wf-run-1", dc.WorkflowRun.Id)
	require.NotNil(t, dc.Workflow)
	require.Equal(t, "workflow-1", dc.Workflow.Id)
}

func TestFactory_CreateJobForWorkflowJob_MergesConfig(t *testing.T) {
	st, jobAgent := setupWorkflowStore(t)
	ctx := context.Background()

	wfJob := &oapi.WorkflowJob{
		Id:            "wf-job-1",
		WorkflowRunId: "wf-run-1",
		Index:         0,
		Ref:           jobAgent.Id,
		Config:        map[string]interface{}{"agent_key": "overridden", "wf_only": "yes"},
	}
	st.WorkflowJobs.Upsert(ctx, wfJob)

	factory := NewFactory(st)
	job, err := factory.CreateJobForWorkflowJob(ctx, wfJob)

	require.NoError(t, err)
	// Workflow job config overrides agent config
	require.Equal(t, "overridden", job.JobAgentConfig["agent_key"])
	require.Equal(t, "yes", job.JobAgentConfig["wf_only"])
}

func TestFactory_CreateJobForWorkflowJob_AgentNotFound(t *testing.T) {
	st, _ := setupWorkflowStore(t)
	ctx := context.Background()

	wfJob := &oapi.WorkflowJob{
		Id:            "wf-job-1",
		WorkflowRunId: "wf-run-1",
		Index:         0,
		Ref:           "non-existent-agent",
		Config:        map[string]interface{}{},
	}

	factory := NewFactory(st)
	job, err := factory.CreateJobForWorkflowJob(ctx, wfJob)

	require.Error(t, err)
	require.Nil(t, job)
	require.Contains(t, err.Error(), "not found")
}

func TestFactory_CreateJobForWorkflowJob_WorkflowRunNotFound(t *testing.T) {
	st := setupTestStore()
	ctx := context.Background()

	jobAgent := createTestJobAgent(t, "agent-1", "custom", mustCreateJobAgentConfig(t, `{}`))
	st.JobAgents.Upsert(ctx, jobAgent)

	wfJob := &oapi.WorkflowJob{
		Id:            "wf-job-1",
		WorkflowRunId: "non-existent-run",
		Index:         0,
		Ref:           jobAgent.Id,
		Config:        map[string]interface{}{},
	}

	factory := NewFactory(st)
	job, err := factory.CreateJobForWorkflowJob(ctx, wfJob)

	require.Error(t, err)
	require.Nil(t, job)
	require.Contains(t, err.Error(), "workflow run")
	require.Contains(t, err.Error(), "not found")
}

func TestFactory_CreateJobForWorkflowJob_WorkflowNotFound(t *testing.T) {
	st := setupTestStore()
	ctx := context.Background()

	jobAgent := createTestJobAgent(t, "agent-1", "custom", mustCreateJobAgentConfig(t, `{}`))
	st.JobAgents.Upsert(ctx, jobAgent)

	// Create a workflow run that references a non-existent workflow
	workflowRun := &oapi.WorkflowRun{
		Id:         "wf-run-1",
		WorkflowId: "non-existent-workflow",
		Inputs:     map[string]interface{}{},
	}
	st.WorkflowRuns.Upsert(ctx, workflowRun)

	wfJob := &oapi.WorkflowJob{
		Id:            "wf-job-1",
		WorkflowRunId: "wf-run-1",
		Index:         0,
		Ref:           jobAgent.Id,
		Config:        map[string]interface{}{},
	}

	factory := NewFactory(st)
	job, err := factory.CreateJobForWorkflowJob(ctx, wfJob)

	require.Error(t, err)
	require.Nil(t, job)
	require.Contains(t, err.Error(), "workflow")
	require.Contains(t, err.Error(), "not found")
}

// =============================================================================
// Dispatch Context does not include release-only fields for workflow jobs
// =============================================================================

func TestFactory_CreateJobForWorkflowJob_DispatchContextHasNoReleaseFields(t *testing.T) {
	st, jobAgent := setupWorkflowStore(t)
	ctx := context.Background()

	wfJob := &oapi.WorkflowJob{
		Id:            "wf-job-1",
		WorkflowRunId: "wf-run-1",
		Index:         0,
		Ref:           jobAgent.Id,
		Config:        map[string]interface{}{},
	}
	st.WorkflowJobs.Upsert(ctx, wfJob)

	factory := NewFactory(st)
	job, err := factory.CreateJobForWorkflowJob(ctx, wfJob)

	require.NoError(t, err)
	dc := job.DispatchContext

	require.Nil(t, dc.Release)
	require.Nil(t, dc.Deployment)
	require.Nil(t, dc.Environment)
	require.Nil(t, dc.Resource)
	require.Nil(t, dc.Version)
	require.Nil(t, dc.Variables)
}

// =============================================================================
// Config Deep Merge Tests
// =============================================================================

func TestFactory_CreateJobForRelease_DeepMergesNestedConfig(t *testing.T) {
	st := setupTestStore()
	ctx := context.Background()

	jobAgentId := "agent-1"

	agentConfig := mustCreateJobAgentConfig(t, `{
		"nested": {"a": 1, "b": 2},
		"top_level": "agent"
	}`)
	deployConfig := mustCreateJobAgentConfig(t, `{
		"nested": {"b": 3, "c": 4}
	}`)

	jobAgent := createTestJobAgent(t, jobAgentId, "custom", agentConfig)
	deployment := createTestDeployment(t, "deploy-1", &jobAgentId, deployConfig)

	environment := &oapi.Environment{
		Id: "env-1", Name: "prod", SystemIds: []string{"system-1"}, Metadata: map[string]string{},
	}
	resource := &oapi.Resource{
		Id: "resource-1", Name: "server-1", Kind: "server", Identifier: "server-1",
		Config: map[string]interface{}{}, Metadata: map[string]string{}, CreatedAt: time.Now(),
	}

	st.JobAgents.Upsert(ctx, jobAgent)
	_ = st.Deployments.Upsert(ctx, deployment)
	_ = st.Environments.Upsert(ctx, environment)
	st.Resources.Upsert(ctx, resource)

	release := createTestRelease(t, "deploy-1", "env-1", "resource-1", "version-1")

	factory := NewFactory(st)
	job, err := factory.CreateJobForRelease(ctx, release, nil)

	require.NoError(t, err)

	nested, ok := job.JobAgentConfig["nested"].(map[string]any)
	require.True(t, ok)
	require.Equal(t, float64(1), nested["a"])
	require.Equal(t, float64(3), nested["b"]) // deployment overrides agent
	require.Equal(t, float64(4), nested["c"])
	require.Equal(t, "agent", job.JobAgentConfig["top_level"])
}
