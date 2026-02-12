package e2e

import (
	"context"
	"testing"
	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/oapi"
	"workspace-engine/test/integration"
	c "workspace-engine/test/integration/creators"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestEngine_DispatchContextImmutability_EnvironmentUpdate(t *testing.T) {
	jobAgentID := uuid.New().String()
	deploymentID := uuid.New().String()
	environmentID := uuid.New().String()
	resourceID := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID),
			integration.JobAgentName("Test Agent"),
		),
		integration.WithSystem(
			integration.SystemName("test-system"),
			integration.WithDeployment(
				integration.DeploymentID(deploymentID),
				integration.DeploymentName("api-service"),
				integration.DeploymentJobAgent(jobAgentID),
				integration.DeploymentCelResourceSelector("true"),
				integration.WithDeploymentVersion(
					integration.DeploymentVersionTag("v1.0.0"),
				),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentID),
				integration.EnvironmentName("production"),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceID(resourceID),
			integration.ResourceName("server-1"),
		),
	)

	ctx := context.Background()

	pendingJobs := engine.Workspace().Jobs().GetPending()
	require.Len(t, pendingJobs, 1)

	var job *oapi.Job
	for _, j := range pendingJobs {
		job = j
		break
	}

	require.NotNil(t, job.DispatchContext)
	assert.Equal(t, "production", job.DispatchContext.Environment.Name)

	// Mutate the environment name in the store
	env, _ := engine.Workspace().Environments().Get(environmentID)
	env.Name = "staging-renamed"
	engine.PushEvent(ctx, handler.EnvironmentUpdate, env)

	// Re-fetch the job and verify DispatchContext is unchanged
	jobAfter, ok := engine.Workspace().Jobs().Get(job.Id)
	require.True(t, ok)
	require.NotNil(t, jobAfter.DispatchContext)
	assert.Equal(t, "production", jobAfter.DispatchContext.Environment.Name,
		"DispatchContext.Environment should retain original name after environment update")
}

func TestEngine_DispatchContextImmutability_ResourceUpdate(t *testing.T) {
	jobAgentID := uuid.New().String()
	deploymentID := uuid.New().String()
	environmentID := uuid.New().String()
	resourceID := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID),
			integration.JobAgentName("Test Agent"),
		),
		integration.WithSystem(
			integration.SystemName("test-system"),
			integration.WithDeployment(
				integration.DeploymentID(deploymentID),
				integration.DeploymentName("api-service"),
				integration.DeploymentJobAgent(jobAgentID),
				integration.DeploymentCelResourceSelector("true"),
				integration.WithDeploymentVersion(
					integration.DeploymentVersionTag("v1.0.0"),
				),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentID),
				integration.EnvironmentName("production"),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceID(resourceID),
			integration.ResourceName("server-1"),
			integration.ResourceMetadata(map[string]string{"region": "us-east-1"}),
		),
	)

	ctx := context.Background()

	pendingJobs := engine.Workspace().Jobs().GetPending()
	require.Len(t, pendingJobs, 1)

	var job *oapi.Job
	for _, j := range pendingJobs {
		job = j
		break
	}

	require.NotNil(t, job.DispatchContext)
	assert.Equal(t, "server-1", job.DispatchContext.Resource.Name)
	assert.Equal(t, "us-east-1", job.DispatchContext.Resource.Metadata["region"])

	// Mutate the resource in the store
	res, _ := engine.Workspace().Resources().Get(resourceID)
	updated := *res
	updated.Name = "server-1-renamed"
	updated.Metadata = map[string]string{"region": "eu-west-1"}
	engine.PushEvent(ctx, handler.ResourceUpdate, &updated)

	// Re-fetch the job and verify DispatchContext is unchanged
	jobAfter, ok := engine.Workspace().Jobs().Get(job.Id)
	require.True(t, ok)
	require.NotNil(t, jobAfter.DispatchContext)
	assert.Equal(t, "server-1", jobAfter.DispatchContext.Resource.Name,
		"DispatchContext.Resource.Name should retain original value")
	assert.Equal(t, "us-east-1", jobAfter.DispatchContext.Resource.Metadata["region"],
		"DispatchContext.Resource.Metadata should retain original value")
}

func TestEngine_DispatchContextImmutability_DeploymentUpdate(t *testing.T) {
	jobAgentID := uuid.New().String()
	deploymentID := uuid.New().String()
	environmentID := uuid.New().String()
	resourceID := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID),
			integration.JobAgentName("Test Agent"),
			integration.JobAgentConfig(map[string]any{
				"namespace": "default",
			}),
		),
		integration.WithSystem(
			integration.SystemName("test-system"),
			integration.WithDeployment(
				integration.DeploymentID(deploymentID),
				integration.DeploymentName("api-service"),
				integration.DeploymentJobAgent(jobAgentID),
				integration.DeploymentCelResourceSelector("true"),
				integration.DeploymentJobAgentConfig(map[string]any{
					"replicas": 3,
				}),
				integration.WithDeploymentVersion(
					integration.DeploymentVersionTag("v1.0.0"),
				),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentID),
				integration.EnvironmentName("production"),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceID(resourceID),
			integration.ResourceName("server-1"),
		),
	)

	ctx := context.Background()

	pendingJobs := engine.Workspace().Jobs().GetPending()
	require.Len(t, pendingJobs, 1)

	var job *oapi.Job
	for _, j := range pendingJobs {
		job = j
		break
	}

	require.NotNil(t, job.DispatchContext)
	assert.Equal(t, "api-service", job.DispatchContext.Deployment.Name)
	assert.Equal(t, float64(3), job.DispatchContext.JobAgentConfig["replicas"])

	// Mutate the deployment in the store
	dep, _ := engine.Workspace().Deployments().Get(deploymentID)
	dep.Name = "api-service-v2"
	dep.JobAgentConfig = oapi.JobAgentConfig{"replicas": 10}
	engine.PushEvent(ctx, handler.DeploymentUpdate, dep)

	// Re-fetch the job and verify DispatchContext is unchanged
	jobAfter, ok := engine.Workspace().Jobs().Get(job.Id)
	require.True(t, ok)
	require.NotNil(t, jobAfter.DispatchContext)
	assert.Equal(t, "api-service", jobAfter.DispatchContext.Deployment.Name,
		"DispatchContext.Deployment.Name should retain original value")
	assert.Equal(t, float64(3), jobAfter.DispatchContext.JobAgentConfig["replicas"],
		"DispatchContext.JobAgentConfig should retain original merged config")
}

func TestEngine_DispatchContextImmutability_JobAgentUpdate(t *testing.T) {
	jobAgentID := uuid.New().String()
	deploymentID := uuid.New().String()
	environmentID := uuid.New().String()
	resourceID := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID),
			integration.JobAgentName("Original Agent"),
			integration.JobAgentConfig(map[string]any{
				"timeout": 300,
			}),
		),
		integration.WithSystem(
			integration.SystemName("test-system"),
			integration.WithDeployment(
				integration.DeploymentID(deploymentID),
				integration.DeploymentName("api-service"),
				integration.DeploymentJobAgent(jobAgentID),
				integration.DeploymentCelResourceSelector("true"),
				integration.WithDeploymentVersion(
					integration.DeploymentVersionTag("v1.0.0"),
				),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentID),
				integration.EnvironmentName("production"),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceID(resourceID),
			integration.ResourceName("server-1"),
		),
	)

	ctx := context.Background()

	pendingJobs := engine.Workspace().Jobs().GetPending()
	require.Len(t, pendingJobs, 1)

	var job *oapi.Job
	for _, j := range pendingJobs {
		job = j
		break
	}

	require.NotNil(t, job.DispatchContext)
	assert.Equal(t, "Original Agent", job.DispatchContext.JobAgent.Name)
	assert.Equal(t, float64(300), job.DispatchContext.JobAgentConfig["timeout"])

	// Mark job as successful so the agent update doesn't retrigger
	job.Status = oapi.JobStatusSuccessful
	engine.Workspace().Jobs().Upsert(ctx, job)

	// Mutate the job agent in the store
	ja, _ := engine.Workspace().JobAgents().Get(jobAgentID)
	ja.Name = "Renamed Agent"
	ja.Config = oapi.JobAgentConfig{"timeout": 600}
	engine.PushEvent(ctx, handler.JobAgentUpdate, ja)

	// Re-fetch the original job and verify DispatchContext is unchanged
	jobAfter, ok := engine.Workspace().Jobs().Get(job.Id)
	require.True(t, ok)
	require.NotNil(t, jobAfter.DispatchContext)
	assert.Equal(t, "Original Agent", jobAfter.DispatchContext.JobAgent.Name,
		"DispatchContext.JobAgent.Name should retain original value")
	assert.Equal(t, float64(300), jobAfter.DispatchContext.JobAgentConfig["timeout"],
		"DispatchContext.JobAgentConfig should retain original merged config")
}

func TestEngine_DispatchContextImmutability_MultipleEntitiesUpdated(t *testing.T) {
	jobAgentID := uuid.New().String()
	deploymentID := uuid.New().String()
	environmentID := uuid.New().String()
	resourceID := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID),
			integration.JobAgentName("Test Agent"),
			integration.JobAgentConfig(map[string]any{
				"base_url": "https://api.example.com",
			}),
		),
		integration.WithSystem(
			integration.SystemName("test-system"),
			integration.WithDeployment(
				integration.DeploymentID(deploymentID),
				integration.DeploymentName("web-app"),
				integration.DeploymentJobAgent(jobAgentID),
				integration.DeploymentCelResourceSelector("true"),
				integration.DeploymentJobAgentConfig(map[string]any{
					"replicas": 2,
				}),
				integration.WithDeploymentVersion(
					integration.DeploymentVersionTag("v1.0.0"),
				),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentID),
				integration.EnvironmentName("staging"),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceID(resourceID),
			integration.ResourceName("cluster-a"),
			integration.ResourceMetadata(map[string]string{"cloud": "aws"}),
		),
	)

	ctx := context.Background()

	pendingJobs := engine.Workspace().Jobs().GetPending()
	require.Len(t, pendingJobs, 1)

	var job *oapi.Job
	for _, j := range pendingJobs {
		job = j
		break
	}

	// Snapshot original values
	require.NotNil(t, job.DispatchContext)
	originalEnvName := job.DispatchContext.Environment.Name
	originalResName := job.DispatchContext.Resource.Name
	originalResMetadata := job.DispatchContext.Resource.Metadata["cloud"]
	originalDepName := job.DispatchContext.Deployment.Name
	originalAgentName := job.DispatchContext.JobAgent.Name
	originalReplicas := job.DispatchContext.JobAgentConfig["replicas"]
	originalVersionTag := job.DispatchContext.Version.Tag

	assert.Equal(t, "staging", originalEnvName)
	assert.Equal(t, "cluster-a", originalResName)
	assert.Equal(t, "aws", originalResMetadata)
	assert.Equal(t, "web-app", originalDepName)
	assert.Equal(t, "Test Agent", originalAgentName)
	assert.Equal(t, float64(2), originalReplicas)
	assert.Equal(t, "v1.0.0", originalVersionTag)

	// Mutate everything
	env, _ := engine.Workspace().Environments().Get(environmentID)
	env.Name = "production-renamed"
	engine.PushEvent(ctx, handler.EnvironmentUpdate, env)

	res, _ := engine.Workspace().Resources().Get(resourceID)
	updatedRes := *res
	updatedRes.Name = "cluster-b"
	updatedRes.Metadata = map[string]string{"cloud": "gcp"}
	engine.PushEvent(ctx, handler.ResourceUpdate, &updatedRes)

	dep, _ := engine.Workspace().Deployments().Get(deploymentID)
	dep.Name = "web-app-v2"
	dep.JobAgentConfig = oapi.JobAgentConfig{"replicas": 99}
	engine.PushEvent(ctx, handler.DeploymentUpdate, dep)

	// Re-fetch job and verify the snapshot is untouched
	jobAfter, ok := engine.Workspace().Jobs().Get(job.Id)
	require.True(t, ok)
	require.NotNil(t, jobAfter.DispatchContext)

	assert.Equal(t, "staging", jobAfter.DispatchContext.Environment.Name)
	assert.Equal(t, "cluster-a", jobAfter.DispatchContext.Resource.Name)
	assert.Equal(t, "aws", jobAfter.DispatchContext.Resource.Metadata["cloud"])
	assert.Equal(t, "web-app", jobAfter.DispatchContext.Deployment.Name)
	assert.Equal(t, "Test Agent", jobAfter.DispatchContext.JobAgent.Name)
	assert.Equal(t, float64(2), jobAfter.DispatchContext.JobAgentConfig["replicas"])
	assert.Equal(t, "v1.0.0", jobAfter.DispatchContext.Version.Tag)
}

func TestEngine_DispatchContextImmutability_WorkflowJobUpdate(t *testing.T) {
	jobAgentID := uuid.New().String()
	workflowID := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID),
			integration.JobAgentName("Workflow Agent"),
		),
		integration.WithWorkflow(
			integration.WorkflowID(workflowID),
			integration.WithWorkflowJobTemplate(
				integration.WorkflowJobTemplateJobAgentID(jobAgentID),
				integration.WorkflowJobTemplateJobAgentConfig(map[string]any{
					"timeout": 60,
				}),
				integration.WorkflowJobTemplateName("deploy-step"),
			),
		),
	)

	ctx := context.Background()

	engine.PushEvent(ctx, handler.WorkflowRunCreate, &oapi.WorkflowRun{
		WorkflowId: workflowID,
		Inputs:     map[string]any{"env": "prod"},
	})

	workflowRuns := engine.Workspace().WorkflowRuns().GetByWorkflowId(workflowID)
	require.Len(t, workflowRuns, 1)

	var workflowRun *oapi.WorkflowRun
	for _, wr := range workflowRuns {
		workflowRun = wr
		break
	}

	workflowJobs := engine.Workspace().WorkflowJobs().GetByWorkflowRunId(workflowRun.Id)
	require.Len(t, workflowJobs, 1)

	jobs := engine.Workspace().Jobs().GetByWorkflowJobId(workflowJobs[0].Id)
	require.Len(t, jobs, 1)
	job := jobs[0]

	require.NotNil(t, job.DispatchContext)
	assert.NotNil(t, job.DispatchContext.Workflow)
	assert.Equal(t, workflowID, job.DispatchContext.Workflow.Id)
	assert.NotNil(t, job.DispatchContext.WorkflowRun)
	assert.Equal(t, workflowRun.Id, job.DispatchContext.WorkflowRun.Id)
	assert.NotNil(t, job.DispatchContext.WorkflowJob)
	originalWorkflowJobId := job.DispatchContext.WorkflowJob.Id
	originalRunInputs := job.DispatchContext.WorkflowRun.Inputs

	assert.Equal(t, map[string]any{"env": "prod"}, originalRunInputs)

	// Create a second workflow run (which adds more data to the store)
	engine.PushEvent(ctx, handler.WorkflowRunCreate, &oapi.WorkflowRun{
		WorkflowId: workflowID,
		Inputs:     map[string]any{"env": "staging"},
	})

	// Re-fetch original job and verify its DispatchContext is unchanged
	jobAfter, ok := engine.Workspace().Jobs().Get(job.Id)
	require.True(t, ok)
	require.NotNil(t, jobAfter.DispatchContext)
	assert.Equal(t, workflowID, jobAfter.DispatchContext.Workflow.Id)
	assert.Equal(t, originalWorkflowJobId, jobAfter.DispatchContext.WorkflowJob.Id)
	assert.Equal(t, map[string]any{"env": "prod"}, jobAfter.DispatchContext.WorkflowRun.Inputs,
		"DispatchContext.WorkflowRun.Inputs should retain original values")
}

func TestEngine_DispatchContextImmutability_VariablesUnchangedAfterResourceVariableUpdate(t *testing.T) {
	jobAgentID := uuid.New().String()
	deploymentID := uuid.New().String()
	environmentID := uuid.New().String()
	resourceID := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID),
			integration.JobAgentName("Test Agent"),
		),
		integration.WithSystem(
			integration.SystemName("test-system"),
			integration.WithDeployment(
				integration.DeploymentID(deploymentID),
				integration.DeploymentName("api"),
				integration.DeploymentJobAgent(jobAgentID),
				integration.DeploymentCelResourceSelector("true"),
				integration.WithDeploymentVariable(
					"app_name",
					integration.WithDeploymentVariableValue(
						integration.DeploymentVariableValueCelResourceSelector("true"),
						integration.DeploymentVariableValueStringValue("my-app"),
					),
				),
				integration.WithDeploymentVersion(
					integration.DeploymentVersionTag("v1.0.0"),
				),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentID),
				integration.EnvironmentName("production"),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceID(resourceID),
			integration.ResourceName("server-1"),
		),
	)

	ctx := context.Background()

	pendingJobs := engine.Workspace().Jobs().GetPending()
	require.Len(t, pendingJobs, 1)

	var job *oapi.Job
	for _, j := range pendingJobs {
		job = j
		break
	}

	require.NotNil(t, job.DispatchContext)
	require.NotNil(t, job.DispatchContext.Variables)
	assert.Equal(t, "my-app", (*job.DispatchContext.Variables)["app_name"])

	// Add a resource variable that would override the deployment variable on new jobs
	rv := c.NewResourceVariable(resourceID, "app_name")
	literalValue := &oapi.LiteralValue{}
	_ = literalValue.FromStringValue("overridden-app")
	value := &oapi.Value{}
	_ = value.FromLiteralValue(*literalValue)
	rv.Value = *value
	engine.PushEvent(ctx, handler.ResourceVariableCreate, rv)

	// Re-fetch the original job - its snapshot should be unchanged
	jobAfter, ok := engine.Workspace().Jobs().Get(job.Id)
	require.True(t, ok)
	require.NotNil(t, jobAfter.DispatchContext)
	require.NotNil(t, jobAfter.DispatchContext.Variables)
	assert.Equal(t, "my-app", (*jobAfter.DispatchContext.Variables)["app_name"],
		"DispatchContext.Variables should retain original values after resource variable update")
}
