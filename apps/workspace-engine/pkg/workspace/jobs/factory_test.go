package jobs

import (
	"context"
	"encoding/json"
	"fmt"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
	"workspace-engine/pkg/oapi"
)

func newID() string { return uuid.New().String() }

func mustCreateJobAgentConfig(t *testing.T, configJSON string) oapi.JobAgentConfig {
	t.Helper()
	var config oapi.JobAgentConfig
	err := json.Unmarshal([]byte(configJSON), &config)
	require.NoError(t, err)
	return config
}

type mockGetters struct {
	deployments  map[string]*oapi.Deployment
	environments map[string]*oapi.Environment
	resources    map[string]*oapi.Resource
}

func newMockGetters() *mockGetters {
	return &mockGetters{
		deployments:  make(map[string]*oapi.Deployment),
		environments: make(map[string]*oapi.Environment),
		resources:    make(map[string]*oapi.Resource),
	}
}

func (m *mockGetters) GetDeployment(_ context.Context, id uuid.UUID) (*oapi.Deployment, error) {
	d, ok := m.deployments[id.String()]
	if !ok {
		return nil, fmt.Errorf("deployment %s not found", id)
	}
	return d, nil
}

func (m *mockGetters) GetEnvironment(_ context.Context, id uuid.UUID) (*oapi.Environment, error) {
	e, ok := m.environments[id.String()]
	if !ok {
		return nil, fmt.Errorf("environment %s not found", id)
	}
	return e, nil
}

func (m *mockGetters) GetResource(_ context.Context, id uuid.UUID) (*oapi.Resource, error) {
	r, ok := m.resources[id.String()]
	if !ok {
		return nil, fmt.Errorf("resource %s not found", id)
	}
	return r, nil
}

func createTestDeployment(
	t *testing.T,
	id string,
	jobAgentId *string,
	jobAgentConfig oapi.JobAgentConfig,
) *oapi.Deployment {
	t.Helper()
	resourceSelector := "true"
	return &oapi.Deployment{
		Id:               id,
		Name:             "test-deployment",
		Slug:             "test-deployment",
		JobAgentId:       jobAgentId,
		JobAgentConfig:   jobAgentConfig,
		ResourceSelector: &resourceSelector,
	}
}

func createTestEnvironment(
	t *testing.T,
	id string,
	name string,
) *oapi.Environment {
	t.Helper()
	resourceSelector := "true"
	return &oapi.Environment{
		Id:               id,
		Name:             name,
		Metadata:         map[string]string{},
		CreatedAt:        time.Now(),
		ResourceSelector: &resourceSelector,
	}
}

func createTestResource(
	t *testing.T,
	id string,
	name string,
	kind string,
	identifier string,
	config map[string]any,
) *oapi.Resource {
	t.Helper()
	return &oapi.Resource{
		Id:         id,
		Name:       name,
		Kind:       kind,
		Identifier: identifier,
		Config:     config,
	}
}

func createTestJobAgent(
	t *testing.T,
	id string,
	agentType string,
	config oapi.JobAgentConfig,
) *oapi.JobAgent {
	t.Helper()
	return &oapi.JobAgent{
		Id:     id,
		Name:   "test-agent",
		Type:   agentType,
		Config: config,
	}
}

func createTestRelease(
	t *testing.T,
	deploymentId, environmentId, resourceId, versionId string,
) *oapi.Release {
	t.Helper()
	return createTestReleaseWithJobAgentConfig(
		t,
		deploymentId,
		environmentId,
		resourceId,
		versionId,
		nil,
	)
}

func createTestReleaseWithJobAgentConfig(
	t *testing.T,
	deploymentId, environmentId, resourceId, versionId string,
	jobAgentConfig map[string]any,
) *oapi.Release {
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
			Config:         map[string]any{},
			Metadata:       map[string]string{},
			CreatedAt:      time.Now(),
			JobAgentConfig: jobAgentConfig,
		},
	}
}

// =============================================================================
// Error Cases
// =============================================================================

func TestFactory_CreateJobForRelease_DeploymentNotFound(t *testing.T) {
	mock := newMockGetters()
	ctx := context.Background()

	jobAgent := createTestJobAgent(t, newID(), "custom", mustCreateJobAgentConfig(t, `{}`))
	release := createTestRelease(t, newID(), newID(), newID(), newID())

	factory := NewFactoryFromGetters(mock)
	job, err := factory.CreateJobForRelease(ctx, release, jobAgent)

	require.Error(t, err)
	require.Nil(t, job)
	require.Contains(t, err.Error(), "not found")
}

// =============================================================================
// Job Creation Metadata Tests
// =============================================================================

func TestFactory_CreateJobForRelease_SetsCorrectJobFields(t *testing.T) {
	mock := newMockGetters()
	ctx := context.Background()

	jobAgentId := newID()
	deployID := newID()
	envID := newID()
	resourceID := newID()
	versionID := newID()

	jobAgentConfig := mustCreateJobAgentConfig(t, `{"type": "custom", "key": "value"}`)
	deploymentConfig := mustCreateJobAgentConfig(t, `{"type": "custom"}`)

	jobAgent := createTestJobAgent(t, jobAgentId, "custom", jobAgentConfig)
	deployment := createTestDeployment(t, deployID, &jobAgentId, deploymentConfig)
	environment := createTestEnvironment(t, envID, "production")
	resource := createTestResource(t, resourceID, "server-1", "server", "server-1", map[string]any{})

	mock.deployments[deployID] = deployment
	mock.environments[envID] = environment
	mock.resources[resourceID] = resource

	release := createTestRelease(t, deployID, envID, resourceID, versionID)

	beforeCreation := time.Now()

	factory := NewFactoryFromGetters(mock)
	job, err := factory.CreateJobForRelease(ctx, release, jobAgent)

	afterCreation := time.Now()

	require.NoError(t, err)
	require.NotNil(t, job)

	_, err = uuid.Parse(job.Id)
	require.NoError(t, err)
	require.Equal(t, release.Id.String(), job.ReleaseId)
	require.Equal(t, jobAgentId, job.JobAgentId)
	require.Equal(t, oapi.JobStatusPending, job.Status)
	require.True(t, job.CreatedAt.After(beforeCreation) || job.CreatedAt.Equal(beforeCreation))
	require.True(t, job.CreatedAt.Before(afterCreation) || job.CreatedAt.Equal(afterCreation))
	require.True(t, job.UpdatedAt.After(beforeCreation) || job.UpdatedAt.Equal(beforeCreation))
	require.True(t, job.UpdatedAt.Before(afterCreation) || job.UpdatedAt.Equal(afterCreation))
	require.NotNil(t, job.Metadata)
	require.Empty(t, job.Metadata)
}

// =============================================================================
// Multiple Jobs Creation Tests
// =============================================================================

func TestFactory_CreateJobForRelease_UniqueJobIds(t *testing.T) {
	mock := newMockGetters()
	ctx := context.Background()

	jobAgentId := newID()
	deployID := newID()
	envID := newID()
	resourceID := newID()
	versionID := newID()

	jobAgentConfig := mustCreateJobAgentConfig(t, `{"type": "custom"}`)
	deploymentConfig := mustCreateJobAgentConfig(t, `{"type": "custom"}`)

	jobAgent := createTestJobAgent(t, jobAgentId, "custom", jobAgentConfig)
	deployment := createTestDeployment(t, deployID, &jobAgentId, deploymentConfig)
	resource := createTestResource(t, resourceID, "server-1", "server", "server-1", map[string]any{})
	environment := createTestEnvironment(t, envID, "production")

	mock.deployments[deployID] = deployment
	mock.environments[envID] = environment
	mock.resources[resourceID] = resource

	factory := NewFactoryFromGetters(mock)

	jobIds := make(map[string]bool)
	for range 10 {
		release := createTestRelease(t, deployID, envID, resourceID, versionID)
		job, err := factory.CreateJobForRelease(ctx, release, jobAgent)
		require.NoError(t, err)
		require.NotNil(t, job)
		require.False(t, jobIds[job.Id], "Job ID should be unique")
		jobIds[job.Id] = true
	}
}

// =============================================================================
// Dispatch Context Tests (new factory responsibility)
// =============================================================================

func setupFullMock(t *testing.T) (*mockGetters, *oapi.JobAgent, string, string, string) {
	t.Helper()
	mock := newMockGetters()

	jobAgentId := newID()
	deploymentId := newID()
	environmentId := newID()
	resourceId := newID()

	jobAgent := createTestJobAgent(
		t,
		jobAgentId,
		"custom",
		mustCreateJobAgentConfig(t, `{"agent_key": "agent_val"}`),
	)
	deployment := createTestDeployment(
		t,
		deploymentId,
		&jobAgentId,
		mustCreateJobAgentConfig(t, `{"deploy_key": "deploy_val"}`),
	)
	environment := &oapi.Environment{
		Id:       environmentId,
		Name:     "production",
		Metadata: map[string]string{},
	}
	resource := &oapi.Resource{
		Id:         resourceId,
		Name:       "server-1",
		Kind:       "server",
		Identifier: "server-1",
		Config:     map[string]any{},
		Metadata:   map[string]string{"region": "us-east-1"},
		CreatedAt:  time.Now(),
	}

	mock.deployments[deploymentId] = deployment
	mock.environments[environmentId] = environment
	mock.resources[resourceId] = resource

	return mock, jobAgent, deploymentId, environmentId, resourceId
}

func TestFactory_CreateJobForRelease_BuildsDispatchContext(t *testing.T) {
	mock, jobAgent, deploymentId, environmentId, resourceId := setupFullMock(t)
	ctx := context.Background()

	release := createTestRelease(t, deploymentId, environmentId, resourceId, newID())

	factory := NewFactoryFromGetters(mock)
	job, err := factory.CreateJobForRelease(ctx, release, jobAgent)

	require.NoError(t, err)
	require.NotNil(t, job)
	require.NotNil(t, job.DispatchContext)

	dc := job.DispatchContext
	require.NotNil(t, dc.Release)
	require.NotNil(t, dc.Deployment)
	require.NotNil(t, dc.Environment)
	require.NotNil(t, dc.Resource)
	require.NotNil(t, dc.Version)
	require.Equal(t, jobAgent.Id, dc.JobAgent.Id)
}

func TestFactory_CreateJobForRelease_DispatchContextHasCorrectEntities(t *testing.T) {
	mock, jobAgent, deploymentId, environmentId, resourceId := setupFullMock(t)
	ctx := context.Background()

	release := createTestRelease(t, deploymentId, environmentId, resourceId, newID())

	factory := NewFactoryFromGetters(mock)
	job, err := factory.CreateJobForRelease(ctx, release, jobAgent)

	require.NoError(t, err)
	dc := job.DispatchContext

	require.Equal(t, deploymentId, dc.Deployment.Id)
	require.Equal(t, environmentId, dc.Environment.Id)
	require.Equal(t, resourceId, dc.Resource.Id)
	require.Equal(t, "v1.0.0", dc.Version.Tag)
}

func TestFactory_CreateJobForRelease_DispatchContextVariablesPointsToReleaseVariables(
	t *testing.T,
) {
	mock, jobAgent, deploymentId, environmentId, resourceId := setupFullMock(t)
	ctx := context.Background()

	release := createTestRelease(t, deploymentId, environmentId, resourceId, newID())
	litVal := oapi.LiteralValue{}
	_ = litVal.FromStringValue("my-app")
	release.Variables = map[string]oapi.LiteralValue{
		"app_name": litVal,
	}

	factory := NewFactoryFromGetters(mock)
	job, err := factory.CreateJobForRelease(ctx, release, jobAgent)

	require.NoError(t, err)
	require.NotNil(t, job.DispatchContext.Variables)

	vars := *job.DispatchContext.Variables
	appName, exists := vars["app_name"]
	require.True(t, exists)
	val, err := appName.AsStringValue()
	require.NoError(t, err)
	require.Equal(t, "my-app", val)
}

func TestFactory_CreateJobForRelease_UsesResolvedJobAgentConfig(t *testing.T) {
	mock := newMockGetters()
	ctx := context.Background()

	jobAgentId := newID()
	deployID := newID()
	envID := newID()
	resourceID := newID()

	agentConfig := mustCreateJobAgentConfig(t, `{"shared": "resolved", "agent_only": "yes"}`)
	deployConfig := mustCreateJobAgentConfig(t, `{"shared": "from_deploy", "deploy_only": "yes"}`)
	versionConfig := oapi.JobAgentConfig{"shared": "from_version", "version_only": "yes"}

	jobAgent := createTestJobAgent(t, jobAgentId, "custom", agentConfig)
	deployment := createTestDeployment(t, deployID, &jobAgentId, deployConfig)
	environment := &oapi.Environment{
		Id: envID, Name: "prod", Metadata: map[string]string{},
	}
	resource := &oapi.Resource{
		Id: resourceID, Name: "server-1", Kind: "server", Identifier: "server-1",
		Config: map[string]any{}, Metadata: map[string]string{}, CreatedAt: time.Now(),
	}

	mock.deployments[deployID] = deployment
	mock.environments[envID] = environment
	mock.resources[resourceID] = resource

	release := createTestReleaseWithJobAgentConfig(
		t,
		deployID,
		envID,
		resourceID,
		newID(),
		versionConfig,
	)

	factory := NewFactoryFromGetters(mock)
	job, err := factory.CreateJobForRelease(ctx, release, jobAgent)

	require.NoError(t, err)
	require.NotNil(t, job)

	require.Equal(t, "resolved", job.JobAgentConfig["shared"])
	require.Equal(t, "yes", job.JobAgentConfig["agent_only"])
	require.Nil(t, job.JobAgentConfig["deploy_only"])
	require.Nil(t, job.JobAgentConfig["version_only"])
}

func TestFactory_CreateJobForRelease_DeploymentTemplateOverridesAgentTemplate(t *testing.T) {
	mock := newMockGetters()
	ctx := context.Background()

	jobAgentId := newID()
	deployID := newID()
	envID := newID()
	resourceID := newID()

	agentConfig := mustCreateJobAgentConfig(t, `{
		"serverUrl": "argocd.example.com",
		"apiKey": "agent-token",
		"template": "agent-template"
	}`)
	deployConfig := mustCreateJobAgentConfig(t, `{"template": "deployment-template"}`)

	jobAgent := createTestJobAgent(t, jobAgentId, "argocd", agentConfig)
	deployment := createTestDeployment(t, deployID, &jobAgentId, deployConfig)
	environment := &oapi.Environment{
		Id: envID, Name: "prod", Metadata: map[string]string{},
	}
	resource := &oapi.Resource{
		Id: resourceID, Name: "server-1", Kind: "server", Identifier: "server-1",
		Config: map[string]any{}, Metadata: map[string]string{}, CreatedAt: time.Now(),
	}

	mock.deployments[deployID] = deployment
	mock.environments[envID] = environment
	mock.resources[resourceID] = resource

	release := createTestRelease(t, deployID, envID, resourceID, newID())

	factory := NewFactoryFromGetters(mock)
	job, err := factory.CreateJobForRelease(ctx, release, jobAgent)

	require.NoError(t, err)
	require.NotNil(t, job)
	require.Equal(t, "agent-template", job.JobAgentConfig["template"])
	require.Equal(t, "argocd.example.com", job.JobAgentConfig["serverUrl"])
	require.Equal(t, "agent-token", job.JobAgentConfig["apiKey"])
}

func TestFactory_CreateJobForRelease_VersionTemplateOverridesDeploymentAndAgentTemplate(
	t *testing.T,
) {
	mock := newMockGetters()
	ctx := context.Background()

	jobAgentID := newID()
	deployID := newID()
	envID := newID()
	resourceID := newID()

	agentConfig := mustCreateJobAgentConfig(t, `{
		"serverUrl": "argocd.example.com",
		"apiKey": "agent-token",
		"template": "agent-template"
	}`)
	deployConfig := mustCreateJobAgentConfig(t, `{"template": "deployment-template"}`)
	versionConfig := oapi.JobAgentConfig{"template": "version-template"}

	jobAgent := createTestJobAgent(t, jobAgentID, "argocd", agentConfig)
	deployment := createTestDeployment(t, deployID, &jobAgentID, deployConfig)
	environment := &oapi.Environment{
		Id: envID, Name: "prod", Metadata: map[string]string{},
	}
	resource := &oapi.Resource{
		Id: resourceID, Name: "server-1", Kind: "server", Identifier: "server-1",
		Config: map[string]any{}, Metadata: map[string]string{}, CreatedAt: time.Now(),
	}

	mock.deployments[deployID] = deployment
	mock.environments[envID] = environment
	mock.resources[resourceID] = resource

	release := createTestReleaseWithJobAgentConfig(
		t,
		deployID,
		envID,
		resourceID,
		newID(),
		versionConfig,
	)

	factory := NewFactoryFromGetters(mock)
	job, err := factory.CreateJobForRelease(ctx, release, jobAgent)

	require.NoError(t, err)
	require.NotNil(t, job)
	require.Equal(t, "agent-template", job.JobAgentConfig["template"])
	require.Equal(t, "argocd.example.com", job.JobAgentConfig["serverUrl"])
	require.Equal(t, "agent-token", job.JobAgentConfig["apiKey"])
}

func TestFactory_CreateJobForRelease_DeploymentTemplateOverrideWithMultipleDeploymentAgentsConfigured(
	t *testing.T,
) {
	mock := newMockGetters()
	ctx := context.Background()

	selectedAgentID := newID()
	otherAgentID := newID()
	deployID := newID()
	envID := newID()
	resourceID := newID()

	selectedAgentConfig := mustCreateJobAgentConfig(t, `{
		"serverUrl": "selected.example.com",
		"apiKey": "selected-token",
		"template": "selected-agent-template"
	}`)
	_ = createTestJobAgent(t, otherAgentID, "argocd", mustCreateJobAgentConfig(t, `{"template": "other-agent-template"}`))
	deployConfig := mustCreateJobAgentConfig(t, `{"template": "deployment-template"}`)

	selectedAgent := createTestJobAgent(t, selectedAgentID, "argocd", selectedAgentConfig)
	deployment := createTestDeployment(t, deployID, &selectedAgentID, deployConfig)
	deployment.JobAgents = &[]oapi.DeploymentJobAgent{
		{Ref: selectedAgentID, Selector: "true", Config: oapi.JobAgentConfig{}},
		{Ref: otherAgentID, Selector: "false", Config: oapi.JobAgentConfig{}},
	}

	environment := &oapi.Environment{
		Id: envID, Name: "prod", Metadata: map[string]string{},
	}
	resource := &oapi.Resource{
		Id: resourceID, Name: "server-1", Kind: "server", Identifier: "server-1",
		Config: map[string]any{}, Metadata: map[string]string{}, CreatedAt: time.Now(),
	}

	mock.deployments[deployID] = deployment
	mock.environments[envID] = environment
	mock.resources[resourceID] = resource

	release := createTestRelease(t, deployID, envID, resourceID, newID())

	factory := NewFactoryFromGetters(mock)
	job, err := factory.CreateJobForRelease(ctx, release, selectedAgent)

	require.NoError(t, err)
	require.NotNil(t, job)
	require.Equal(t, "selected-agent-template", job.JobAgentConfig["template"])
	require.Equal(t, "selected.example.com", job.JobAgentConfig["serverUrl"])
	require.Equal(t, "selected-token", job.JobAgentConfig["apiKey"])
}

func TestFactory_CreateJobForRelease_UsesResolvedConfigWithoutReMerge(t *testing.T) {
	mock := newMockGetters()
	ctx := context.Background()

	jobAgentID := newID()
	deployID := newID()
	envID := newID()
	resourceID := newID()

	deployConfig := mustCreateJobAgentConfig(t, `{"template": "deployment-template", "retries": 2}`)
	resolvedConfig := mustCreateJobAgentConfig(t, `{
		"template": "selected-deployment-agent-template",
		"timeout": 60,
		"retries": 2
	}`)

	jobAgent := createTestJobAgent(t, jobAgentID, "argocd", resolvedConfig)
	deployment := createTestDeployment(t, deployID, &jobAgentID, deployConfig)
	environment := &oapi.Environment{
		Id: envID, Name: "prod", Metadata: map[string]string{},
	}
	resource := &oapi.Resource{
		Id: resourceID, Name: "server-1", Kind: "server", Identifier: "server-1",
		Config: map[string]any{}, Metadata: map[string]string{}, CreatedAt: time.Now(),
	}

	mock.deployments[deployID] = deployment
	mock.environments[envID] = environment
	mock.resources[resourceID] = resource

	release := createTestRelease(t, deployID, envID, resourceID, newID())

	factory := NewFactoryFromGetters(mock)
	job, err := factory.CreateJobForRelease(ctx, release, jobAgent)

	require.NoError(t, err)
	require.NotNil(t, job)
	require.Equal(t, "selected-deployment-agent-template", job.JobAgentConfig["template"])
	require.InEpsilon(t, float64(60), job.JobAgentConfig["timeout"], 0)
	require.InEpsilon(t, float64(2), job.JobAgentConfig["retries"], 0)
}

func TestFactory_CreateJobForRelease_DispatchContextEnvironmentNotFound(t *testing.T) {
	mock := newMockGetters()
	ctx := context.Background()

	jobAgentId := newID()
	deployID := newID()
	resourceID := newID()
	missingEnvID := newID()

	agent := createTestJobAgent(t, jobAgentId, "custom", mustCreateJobAgentConfig(t, `{}`))
	deployment := createTestDeployment(t, deployID, &jobAgentId, mustCreateJobAgentConfig(t, `{}`))
	resource := &oapi.Resource{
		Id: resourceID, Name: "server-1", Kind: "server", Identifier: "server-1",
		Config: map[string]any{}, Metadata: map[string]string{}, CreatedAt: time.Now(),
	}

	mock.deployments[deployID] = deployment
	mock.resources[resourceID] = resource

	release := createTestRelease(t, deployID, missingEnvID, resourceID, newID())

	factory := NewFactoryFromGetters(mock)
	job, err := factory.CreateJobForRelease(ctx, release, agent)

	require.Error(t, err)
	require.Nil(t, job)
	require.Contains(t, err.Error(), "environment")
}

func TestFactory_CreateJobForRelease_DispatchContextResourceNotFound(t *testing.T) {
	mock := newMockGetters()
	ctx := context.Background()

	jobAgentId := newID()
	deployID := newID()
	envID := newID()
	missingResourceID := newID()

	agent := createTestJobAgent(t, jobAgentId, "custom", mustCreateJobAgentConfig(t, `{}`))
	deployment := createTestDeployment(t, deployID, &jobAgentId, mustCreateJobAgentConfig(t, `{}`))
	environment := &oapi.Environment{
		Id: envID, Name: "prod", Metadata: map[string]string{},
	}

	mock.deployments[deployID] = deployment
	mock.environments[envID] = environment

	release := createTestRelease(t, deployID, envID, missingResourceID, newID())

	factory := NewFactoryFromGetters(mock)
	job, err := factory.CreateJobForRelease(ctx, release, agent)

	require.Error(t, err)
	require.Nil(t, job)
	require.Contains(t, err.Error(), "resource")
}
