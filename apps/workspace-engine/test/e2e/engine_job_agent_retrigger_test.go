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

// TestEngine_JobAgentConfigurationRetriggersInvalidJobs verifies that when a job agent
// is configured for a deployment that previously had no job agent, new Pending jobs
// are created for releases that currently have InvalidJobAgent jobs.
func TestEngine_JobAgentConfigurationRetriggersInvalidJobs(t *testing.T) {
	deploymentID := uuid.New().String()

	// Step 1: Create workspace with deployment (no job agent), environment, and resource
	engine := integration.NewTestWorkspace(t,
		integration.WithSystem(
			integration.WithDeployment(
				integration.DeploymentID(deploymentID),
				integration.DeploymentName("test-deployment"),
				integration.DeploymentCelResourceSelector("true"),
				// No job agent specified
			),
			integration.WithEnvironment(
				integration.EnvironmentName("production"),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceName("server-1"),
		),
	)

	ctx := context.Background()

	// Step 2: Create deployment version - this should create InvalidJobAgent jobs
	dv := c.NewDeploymentVersion()
	dv.DeploymentId = deploymentID
	dv.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv)

	// Verify job was created with InvalidJobAgent status
	allJobs := engine.Workspace().Jobs().Items()
	require.Len(t, allJobs, 1, "expected 1 job without job agent")

	var originalJob *oapi.Job
	for _, j := range allJobs {
		originalJob = j
		break
	}

	assert.Equal(t, oapi.JobStatusInvalidJobAgent, originalJob.Status, "expected job status InvalidJobAgent")
	assert.Empty(t, originalJob.JobAgentId, "expected empty job agent ID")

	// Store original job details for later verification
	originalJobID := originalJob.Id
	originalReleaseID := originalJob.ReleaseId

	// Verify no pending jobs (InvalidJobAgent jobs are not pending)
	pendingJobs := engine.Workspace().Jobs().GetPending()
	assert.Empty(t, pendingJobs, "expected 0 pending jobs initially")

	// Step 3: Create and configure job agent
	jobAgentID := uuid.New().String()
	jobAgent := c.NewJobAgent(engine.Workspace().ID)
	jobAgent.Id = jobAgentID
	jobAgent.Name = "Test Agent"
	jobAgent.Type = "kubernetes"
	jobAgent.WorkspaceId = engine.Workspace().ID
	engine.PushEvent(ctx, handler.JobAgentCreate, jobAgent)

	// Update deployment to use the job agent
	deployment, exists := engine.Workspace().Deployments().Get(deploymentID)
	require.True(t, exists, "deployment not found")
	deployment.JobAgentId = &jobAgentID
	engine.PushEvent(ctx, handler.DeploymentUpdate, deployment)

	// Step 4: Verify new Pending jobs created
	allJobsAfterUpdate := engine.Workspace().Jobs().Items()
	require.Len(t, allJobsAfterUpdate, 2, "expected 2 jobs after job agent configuration (1 InvalidJobAgent + 1 Pending)")

	// Find the new Pending job
	var newPendingJob *oapi.Job
	for _, j := range allJobsAfterUpdate {
		if j.Status == oapi.JobStatusPending {
			newPendingJob = j
			break
		}
	}

	require.NotNil(t, newPendingJob, "expected to find a new Pending job after job agent configuration")

	// Verify new job has the same release ID as the original InvalidJobAgent job
	assert.Equal(t, originalReleaseID, newPendingJob.ReleaseId, "expected new job to have same release ID")

	// Verify new job uses the configured job agent
	assert.Equal(t, jobAgentID, newPendingJob.JobAgentId, "expected new job to use configured job agent")

	// Verify new job has different ID from original
	assert.NotEqual(t, originalJobID, newPendingJob.Id, "expected new job to have different ID from original InvalidJobAgent job")

	// Step 5: Verify original InvalidJobAgent jobs preserved
	originalJobStillExists := false
	for _, j := range allJobsAfterUpdate {
		if j.Id == originalJobID {
			originalJobStillExists = true
			assert.Equal(t, oapi.JobStatusInvalidJobAgent, j.Status, "expected original job to still have InvalidJobAgent status")
			break
		}
	}

	assert.True(t, originalJobStillExists, "expected original InvalidJobAgent job to still exist")

	// Verify we now have pending jobs
	pendingJobsAfterUpdate := engine.Workspace().Jobs().GetPending()
	assert.Len(t, pendingJobsAfterUpdate, 1, "expected 1 pending job after job agent configuration")
}

// TestEngine_JobAgentConfigUpdateRetriggersInvalidJobs verifies that updating
// a deployment's job agent config also triggers job creation for InvalidJobAgent jobs.
func TestEngine_JobAgentConfigUpdateRetriggersInvalidJobs(t *testing.T) {
	deploymentID := uuid.New().String()

	// Step 1: Create workspace with deployment (no job agent), environment, and resource
	engine := integration.NewTestWorkspace(t,
		integration.WithSystem(
			integration.WithDeployment(
				integration.DeploymentID(deploymentID),
				integration.DeploymentName("test-deployment"),
				integration.DeploymentCelResourceSelector("true"),
				// No job agent specified
			),
			integration.WithEnvironment(
				integration.EnvironmentName("production"),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceName("server-1"),
		),
	)

	ctx := context.Background()

	// Step 2: Create deployment version - this should create InvalidJobAgent jobs
	dv := c.NewDeploymentVersion()
	dv.DeploymentId = deploymentID
	dv.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv)

	// Verify initial InvalidJobAgent job
	allJobs := engine.Workspace().Jobs().Items()
	require.Len(t, allJobs, 1, "expected 1 job without job agent")

	var originalJob *oapi.Job
	for _, j := range allJobs {
		originalJob = j
		break
	}

	assert.Equal(t, oapi.JobStatusInvalidJobAgent, originalJob.Status, "expected job status InvalidJobAgent")

	originalJobID := originalJob.Id
	originalReleaseID := originalJob.ReleaseId

	// Step 3: Create job agent and configure deployment with both agent ID and config
	jobAgentID := uuid.New().String()
	jobAgent := c.NewJobAgent(engine.Workspace().ID)
	jobAgent.Id = jobAgentID
	jobAgent.Name = "Test Agent"
	jobAgent.Type = "kubernetes"
	jobAgent.WorkspaceId = engine.Workspace().ID
	jobAgent.Config = map[string]any{
		"namespace": "default",
		"timeout":   300,
	}
	engine.PushEvent(ctx, handler.JobAgentCreate, jobAgent)

	// Update deployment with both job agent ID and custom config
	deployment, exists := engine.Workspace().Deployments().Get(deploymentID)
	require.True(t, exists, "deployment not found")
	deployment.JobAgentId = &jobAgentID
	deployment.JobAgentConfig = map[string]any{
		"timeout":  600, // Override agent default
		"replicas": 3,   // Add deployment-specific config
	}
	engine.PushEvent(ctx, handler.DeploymentUpdate, deployment)

	// Step 4: Verify new Pending job created with merged config
	allJobsAfterUpdate := engine.Workspace().Jobs().Items()
	require.Len(t, allJobsAfterUpdate, 2, "expected 2 jobs after job agent configuration")

	var newPendingJob *oapi.Job
	for _, j := range allJobsAfterUpdate {
		if j.Status == oapi.JobStatusPending {
			newPendingJob = j
			break
		}
	}

	require.NotNil(t, newPendingJob, "expected to find a new Pending job after job agent configuration")

	// Verify new job has same release ID
	assert.Equal(t, originalReleaseID, newPendingJob.ReleaseId, "expected new job to have same release ID")

	// Verify new job uses the configured job agent
	assert.Equal(t, jobAgentID, newPendingJob.JobAgentId, "expected new job to use configured job agent")

	// Verify job agent config was merged correctly (deployment config overrides agent defaults)
	config := newPendingJob.JobAgentConfig
	timeout, ok := config["timeout"].(float64)
	assert.True(t, ok, "expected timeout to be a float64")
	assert.Equal(t, float64(600), timeout, "expected merged config timeout to be 600 (deployment override)")

	namespace, ok := config["namespace"].(string)
	assert.True(t, ok, "expected namespace to be a string")
	assert.Equal(t, "default", namespace, "expected merged config namespace to be 'default' (from agent)")

	replicas, ok := config["replicas"].(float64)
	assert.True(t, ok, "expected replicas to be a float64")
	assert.Equal(t, float64(3), replicas, "expected merged config replicas to be 3 (from deployment)")

	// Step 5: Verify original InvalidJobAgent job preserved
	originalJobStillExists := false
	for _, j := range allJobsAfterUpdate {
		if j.Id == originalJobID {
			originalJobStillExists = true
			assert.Equal(t, oapi.JobStatusInvalidJobAgent, j.Status, "expected original job to still have InvalidJobAgent status")
			break
		}
	}

	assert.True(t, originalJobStillExists, "expected original InvalidJobAgent job to still exist")
}

// TestEngine_JobAgentConfigurationWithMultipleResources verifies that when a job agent
// is configured for a deployment with multiple InvalidJobAgent jobs (multiple resources),
// new Pending jobs are created for all of them.
func TestEngine_JobAgentConfigurationWithMultipleResources(t *testing.T) {
	deploymentID := uuid.New().String()

	// Create workspace with deployment (no job agent), environment, and multiple resources
	engine := integration.NewTestWorkspace(t,
		integration.WithSystem(
			integration.WithDeployment(
				integration.DeploymentID(deploymentID),
				integration.DeploymentName("test-deployment"),
				integration.DeploymentCelResourceSelector("true"),
				// No job agent specified
			),
			integration.WithEnvironment(
				integration.EnvironmentName("production"),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceName("server-1"),
		),
		integration.WithResource(
			integration.ResourceName("server-2"),
		),
		integration.WithResource(
			integration.ResourceName("server-3"),
		),
	)

	ctx := context.Background()

	// Create deployment version - should create 3 InvalidJobAgent jobs
	dv := c.NewDeploymentVersion()
	dv.DeploymentId = deploymentID
	dv.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv)

	// Verify 3 jobs were created with InvalidJobAgent status
	allJobs := engine.Workspace().Jobs().Items()
	require.Len(t, allJobs, 3, "expected 3 jobs without job agent")

	invalidJobAgentCount := 0
	for _, j := range allJobs {
		if j.Status == oapi.JobStatusInvalidJobAgent {
			invalidJobAgentCount++
		}
	}

	assert.Equal(t, 3, invalidJobAgentCount, "expected 3 InvalidJobAgent jobs")

	// Create and configure job agent
	jobAgentID := uuid.New().String()
	jobAgent := c.NewJobAgent(engine.Workspace().ID)
	jobAgent.Id = jobAgentID
	jobAgent.Name = "Test Agent"
	jobAgent.WorkspaceId = engine.Workspace().ID
	engine.PushEvent(ctx, handler.JobAgentCreate, jobAgent)

	// Update deployment to use the job agent
	deployment, exists := engine.Workspace().Deployments().Get(deploymentID)
	require.True(t, exists, "deployment not found")
	deployment.JobAgentId = &jobAgentID
	engine.PushEvent(ctx, handler.DeploymentUpdate, deployment)

	// Verify new Pending jobs created for all resources
	allJobsAfterUpdate := engine.Workspace().Jobs().Items()
	// Should have 3 InvalidJobAgent + 3 Pending = 6 total
	require.Len(t, allJobsAfterUpdate, 6, "expected 6 jobs after job agent configuration (3 InvalidJobAgent + 3 Pending)")

	pendingJobsCount := 0
	invalidJobAgentCountAfter := 0
	for _, j := range allJobsAfterUpdate {
		switch j.Status {
		case oapi.JobStatusPending:
			pendingJobsCount++
			// Verify each pending job uses the configured job agent
			assert.Equal(t, jobAgentID, j.JobAgentId, "expected pending job to use configured job agent")
		case oapi.JobStatusInvalidJobAgent:
			invalidJobAgentCountAfter++
		}
	}

	assert.Equal(t, 3, pendingJobsCount, "expected 3 new Pending jobs")
	assert.Equal(t, 3, invalidJobAgentCountAfter, "expected 3 original InvalidJobAgent jobs to be preserved")

	// Verify pending jobs are retrievable
	pendingJobs := engine.Workspace().Jobs().GetPending()
	assert.Len(t, pendingJobs, 3, "expected 3 pending jobs")
}
