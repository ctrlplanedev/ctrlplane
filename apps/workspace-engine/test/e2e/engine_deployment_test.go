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

func TestEngine_DeploymentCreation(t *testing.T) {
	deploymentID1 := uuid.New().String()
	deploymentID2 := uuid.New().String()

	engine := integration.NewTestWorkspace(
		t,
		integration.WithSystem(
			integration.SystemName("test-system"),
			integration.WithDeployment(
				integration.DeploymentID(deploymentID1),
				integration.DeploymentName("deployment-has-filter"),
				integration.DeploymentCelResourceSelector(`resource.metadata["env"] == "dev"`),
			),
			integration.WithDeployment(
				integration.DeploymentID(deploymentID2),
				integration.DeploymentName("deployment-has-no-filter"),
				integration.DeploymentCelResourceSelector("true"),
			),
		),
	)

	engineD1, _ := engine.Workspace().Deployments().Get(deploymentID1)
	engineD2, _ := engine.Workspace().Deployments().Get(deploymentID2)

	if engineD1.Id != deploymentID1 {
		t.Fatalf("deployments have the same id")
	}

	if engineD2.Id != deploymentID2 {
		t.Fatalf("deployments have the same id")
	}

	ctx := context.Background()
	releaseTargets, err := engine.Workspace().ReleaseTargets().Items()
	if err != nil {
		t.Fatalf("failed to get release targets")
	}

	if len(releaseTargets) != 0 {
		t.Fatalf("release targets count is %d, want 0", len(releaseTargets))
	}

	r1 := c.NewResource(engine.Workspace().ID)
	r1.Name = "r1"
	r1.Metadata = map[string]string{"env": "dev"}
	engine.PushEvent(ctx, handler.ResourceCreate, r1)

	r2 := c.NewResource(engine.Workspace().ID)
	r2.Name = "r2"
	r2.Metadata = map[string]string{"env": "qa"}
	engine.PushEvent(ctx, handler.ResourceCreate, r2)

	releaseTargets, err = engine.Workspace().ReleaseTargets().Items()
	if err != nil {
		t.Fatalf("failed to get release targets")
	}

	if len(releaseTargets) != 0 {
		// We have no environments yet, so no release targets
		t.Fatalf("release targets count is %d, want 0", len(releaseTargets))
	}

	d1Resources, err := engine.Workspace().Deployments().Resources(ctx, deploymentID1)
	if err != nil {
		t.Fatalf("failed to get deployment resources")
	}
	d2Resources, err := engine.Workspace().Deployments().Resources(ctx, deploymentID2)
	if err != nil {
		t.Fatalf("failed to get deployment resources")
	}

	if len(d1Resources) != 1 {
		t.Fatalf("resources count is %d, want 1", len(d1Resources))
	}

	if len(d2Resources) != 2 {
		t.Fatalf("resources count is %d, want 2", len(d2Resources))
	}
}

func TestEngine_DeploymentJobAgentConfiguration(t *testing.T) {
	jobAgentID1 := uuid.New().String()
	jobAgentID2 := uuid.New().String()
	deploymentID1 := uuid.New().String()
	deploymentID2 := uuid.New().String()
	deploymentID3 := uuid.New().String()

	engine := integration.NewTestWorkspace(
		t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID1),
			integration.JobAgentName("Agent 1"),
		),
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID2),
			integration.JobAgentName("Agent 2"),
		),
		integration.WithSystem(
			integration.SystemName("test-system"),
			integration.WithDeployment(
				integration.DeploymentID(deploymentID1),
				integration.DeploymentName("deployment-with-agent-1"),
				integration.DeploymentJobAgent(jobAgentID1),
			),
			integration.WithDeployment(
				integration.DeploymentID(deploymentID2),
				integration.DeploymentName("deployment-with-agent-2"),
				integration.DeploymentJobAgent(jobAgentID2),
			),
			integration.WithDeployment(
				integration.DeploymentID(deploymentID3),
				integration.DeploymentName("deployment-no-agent"),
				// No job agent configured
			),
		),
	)

	// Verify job agent assignments
	d1, _ := engine.Workspace().Deployments().Get(deploymentID1)
	if *d1.JobAgentId != jobAgentID1 {
		t.Fatalf("deployment 1 job agent mismatch: got %s, want %s", *d1.JobAgentId, jobAgentID1)
	}

	d2, _ := engine.Workspace().Deployments().Get(deploymentID2)
	if *d2.JobAgentId != jobAgentID2 {
		t.Fatalf("deployment 2 job agent mismatch: got %s, want %s", *d2.JobAgentId, jobAgentID2)
	}

	d3, _ := engine.Workspace().Deployments().Get(deploymentID3)
	if d3.JobAgentId != nil {
		t.Fatalf("deployment 3 should have no job agent, got %s", *d3.JobAgentId)
	}

	// Verify job agents exist
	ja1, exists := engine.Workspace().JobAgents().Get(jobAgentID1)
	if !exists {
		t.Fatalf("job agent 1 not found")
	}
	if ja1.Name != "Agent 1" {
		t.Fatalf("job agent 1 name mismatch: got %s, want Agent 1", ja1.Name)
	}

	ja2, exists := engine.Workspace().JobAgents().Get(jobAgentID2)
	if !exists {
		t.Fatalf("job agent 2 not found")
	}
	if ja2.Name != "Agent 2" {
		t.Fatalf("job agent 2 name mismatch: got %s, want Agent 2", ja2.Name)
	}
}

func TestEngine_DeploymentJobAgentCreatesJobs(t *testing.T) {
	jobAgentID := uuid.New().String()
	deploymentIDWithAgent := uuid.New().String()
	deploymentIDNoAgent := uuid.New().String()

	engine := integration.NewTestWorkspace(
		t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID),
			integration.JobAgentName("Test Agent"),
		),
		integration.WithSystem(
			integration.SystemName("test-system"),
			integration.WithDeployment(
				integration.DeploymentID(deploymentIDWithAgent),
				integration.DeploymentName("deployment-with-agent"),
				integration.DeploymentJobAgent(jobAgentID),
				integration.DeploymentCelResourceSelector("true"),
				integration.WithDeploymentVersion(
					integration.DeploymentVersionTag("v1.0.0"),
				),
			),
			integration.WithDeployment(
				integration.DeploymentID(deploymentIDNoAgent),
				integration.DeploymentName("deployment-no-agent"),
				integration.DeploymentCelResourceSelector("true"),
				// No job agent configured
				integration.WithDeploymentVersion(
					integration.DeploymentVersionTag("v1.0.0"),
				),
			),
			integration.WithEnvironment(
				integration.EnvironmentName("production"),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceName("resource-1"),
		),
	)

	// Get pending jobs
	pendingJobs := engine.Workspace().Jobs().GetPending()

	// Count jobs for each deployment
	jobsWithAgent := 0
	jobsNoAgent := 0
	for _, job := range pendingJobs {
		release, ok := engine.Workspace().Releases().Get(job.ReleaseId)
		if !ok {
			t.Fatalf("release not found")
		}

		if release.ReleaseTarget.DeploymentId == deploymentIDWithAgent {
			jobsWithAgent++
			// Verify job has correct job agent
			if job.JobAgentId != jobAgentID {
				t.Fatalf("job for deployment with agent has wrong job agent: got %s, want %s", job.JobAgentId, jobAgentID)
			}

			assert.NotNil(t, job.DispatchContext, "dispatched job should have DispatchContext")
			assert.Equal(t, jobAgentID, job.DispatchContext.JobAgent.Id)
			assert.NotNil(t, job.DispatchContext.Release)
			assert.NotNil(t, job.DispatchContext.Deployment)
			assert.Equal(t, deploymentIDWithAgent, job.DispatchContext.Deployment.Id)
			assert.NotNil(t, job.DispatchContext.Environment)
			assert.NotNil(t, job.DispatchContext.Resource)
			assert.NotNil(t, job.DispatchContext.Version)
		}
		if release.ReleaseTarget.DeploymentId == deploymentIDNoAgent {
			jobsNoAgent++
		}
	}

	// Deployment with job agent should create a job
	if jobsWithAgent != 1 {
		t.Fatalf("expected 1 job for deployment with agent, got %d", jobsWithAgent)
	}

	// Deployment without job agent should not create a job
	if jobsNoAgent != 0 {
		t.Fatalf("expected 0 jobs for deployment without agent, got %d", jobsNoAgent)
	}
}

func TestEngine_DeploymentJobAgentConfigMerging(t *testing.T) {
	jobAgentID := uuid.New().String()
	deploymentID := uuid.New().String()

	engine := integration.NewTestWorkspace(
		t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID),
			integration.JobAgentName("Test Agent"),
		),
		integration.WithSystem(
			integration.SystemName("test-system"),
			integration.WithDeployment(
				integration.DeploymentID(deploymentID),
				integration.DeploymentName("deployment-1"),
				integration.DeploymentJobAgent(jobAgentID),
				integration.DeploymentCelResourceSelector("true"),
				integration.DeploymentJobAgentConfig(map[string]any{
					"namespace": "custom-namespace",
					"timeout":   300,
				}),
				integration.WithDeploymentVersion(
					integration.DeploymentVersionTag("v1.0.0"),
				),
			),
			integration.WithEnvironment(
				integration.EnvironmentName("production"),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceName("resource-1"),
		),
	)

	// Verify deployment has job agent config
	d, _ := engine.Workspace().Deployments().Get(deploymentID)
	config := d.JobAgentConfig

	if config["namespace"] != "custom-namespace" {
		t.Fatalf("deployment job agent config namespace mismatch: got %v, want custom-namespace", config["namespace"])
	}

	if timeout, ok := config["timeout"].(float64); !ok || timeout != 300 {
		t.Fatalf("deployment job agent config timeout mismatch: got %v, want 300", config["timeout"])
	}

	// Verify job was created with merged config
	pendingJobs := engine.Workspace().Jobs().GetPending()
	if len(pendingJobs) != 1 {
		t.Fatalf("expected 1 pending job, got %d", len(pendingJobs))
	}

	var job *oapi.Job
	for _, j := range pendingJobs {
		job = j
		break
	}
	jobConfig := job.JobAgentConfig

	// Verify merged config includes deployment-specific settings
	if jobConfig["namespace"] != "custom-namespace" {
		t.Fatalf("job config namespace mismatch: got %v, want custom-namespace", jobConfig["namespace"])
	}

	if timeout, ok := jobConfig["timeout"].(float64); !ok || timeout != 300 {
		t.Fatalf("job config timeout mismatch: got %v, want 300", jobConfig["timeout"])
	}

	// Verify DispatchContext is populated with correct config
	assert.NotNil(t, job.DispatchContext)
	assert.Equal(t, jobAgentID, job.DispatchContext.JobAgent.Id)
	assert.Equal(t, "custom-namespace", job.DispatchContext.JobAgentConfig["namespace"])
	assert.Equal(t, float64(300), job.DispatchContext.JobAgentConfig["timeout"])
	assert.NotNil(t, job.DispatchContext.Release)
	assert.NotNil(t, job.DispatchContext.Deployment)
	assert.Equal(t, deploymentID, job.DispatchContext.Deployment.Id)
	assert.NotNil(t, job.DispatchContext.Environment)
	assert.NotNil(t, job.DispatchContext.Resource)
	assert.NotNil(t, job.DispatchContext.Version)
}

func TestEngine_DeploymentJobAgentUpdate(t *testing.T) {
	jobAgentID1 := uuid.New().String()
	jobAgentID2 := uuid.New().String()
	deploymentID := uuid.New().String()

	engine := integration.NewTestWorkspace(
		t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID1),
			integration.JobAgentName("Agent 1"),
		),
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID2),
			integration.JobAgentName("Agent 2"),
		),
		integration.WithSystem(
			integration.SystemName("test-system"),
			integration.WithDeployment(
				integration.DeploymentID(deploymentID),
				integration.DeploymentName("deployment-1"),
				integration.DeploymentJobAgent(jobAgentID1),
			),
		),
	)

	ctx := context.Background()

	// Verify initial job agent assignment
	d, _ := engine.Workspace().Deployments().Get(deploymentID)
	if *d.JobAgentId != jobAgentID1 {
		t.Fatalf("deployment job agent mismatch: got %s, want %s", *d.JobAgentId, jobAgentID1)
	}

	// Update deployment to use different job agent
	*d.JobAgentId = jobAgentID2
	engine.PushEvent(ctx, handler.DeploymentUpdate, d)

	// Verify job agent was updated
	d, _ = engine.Workspace().Deployments().Get(deploymentID)
	if *d.JobAgentId != jobAgentID2 {
		t.Fatalf("deployment job agent after update mismatch: got %s, want %s", *d.JobAgentId, jobAgentID2)
	}
}

func TestEngine_DeploymentMultipleJobAgents(t *testing.T) {
	jobAgentK8s := uuid.New().String()
	jobAgentDocker := uuid.New().String()
	deploymentK8s := uuid.New().String()
	deploymentDocker := uuid.New().String()

	engine := integration.NewTestWorkspace(
		t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentK8s),
			integration.JobAgentName("Kubernetes Agent"),
		),
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentDocker),
			integration.JobAgentName("Docker Agent"),
		),
		integration.WithSystem(
			integration.SystemName("test-system"),
			integration.WithDeployment(
				integration.DeploymentID(deploymentK8s),
				integration.DeploymentName("k8s-deployment"),
				integration.DeploymentJobAgent(jobAgentK8s),
				integration.DeploymentCelResourceSelector("true"),
				integration.WithDeploymentVersion(
					integration.DeploymentVersionTag("v1.0.0"),
				),
			),
			integration.WithDeployment(
				integration.DeploymentID(deploymentDocker),
				integration.DeploymentName("docker-deployment"),
				integration.DeploymentJobAgent(jobAgentDocker),
				integration.DeploymentCelResourceSelector("true"),
				integration.WithDeploymentVersion(
					integration.DeploymentVersionTag("v1.0.0"),
				),
			),
			integration.WithEnvironment(
				integration.EnvironmentName("production"),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceName("resource-1"),
		),
	)

	// Should have 2 jobs (one for each deployment)
	pendingJobs := engine.Workspace().Jobs().GetPending()
	if len(pendingJobs) != 2 {
		t.Fatalf("expected 2 pending jobs, got %d", len(pendingJobs))
	}

	// Verify each job has the correct job agent
	k8sJobFound := false
	dockerJobFound := false

	for _, job := range pendingJobs {
		release, ok := engine.Workspace().Releases().Get(job.ReleaseId)
		if !ok {
			t.Fatalf("release not found")
		}
		if release.ReleaseTarget.DeploymentId == deploymentK8s {
			k8sJobFound = true
			if job.JobAgentId != jobAgentK8s {
				t.Fatalf("k8s deployment job has wrong agent: got %s, want %s", job.JobAgentId, jobAgentK8s)
			}
			assert.NotNil(t, job.DispatchContext)
			assert.Equal(t, jobAgentK8s, job.DispatchContext.JobAgent.Id)
			assert.NotNil(t, job.DispatchContext.Deployment)
			assert.Equal(t, deploymentK8s, job.DispatchContext.Deployment.Id)
		}
		if release.ReleaseTarget.DeploymentId == deploymentDocker {
			dockerJobFound = true
			if job.JobAgentId != jobAgentDocker {
				t.Fatalf("docker deployment job has wrong agent: got %s, want %s", job.JobAgentId, jobAgentDocker)
			}
			assert.NotNil(t, job.DispatchContext)
			assert.Equal(t, jobAgentDocker, job.DispatchContext.JobAgent.Id)
			assert.NotNil(t, job.DispatchContext.Deployment)
			assert.Equal(t, deploymentDocker, job.DispatchContext.Deployment.Id)
		}
	}

	if !k8sJobFound {
		t.Fatal("no job found for k8s deployment")
	}
	if !dockerJobFound {
		t.Fatal("no job found for docker deployment")
	}
}

func TestEngine_AddingAgentToDeploymentRetriggersInvalidJobs(t *testing.T) {
	jobAgentID := uuid.New().String()
	deploymentID := uuid.New().String()

	engine := integration.NewTestWorkspace(
		t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID),
			integration.JobAgentName("Test Agent"),
		),
		integration.WithSystem(
			integration.SystemName("test-system"),
			integration.WithDeployment(
				integration.DeploymentID(deploymentID),
				integration.DeploymentName("deployment-1"),
				integration.DeploymentCelResourceSelector("true"),
				// No job agent configured
				integration.WithDeploymentVersion(
					integration.DeploymentVersionTag("v1.0.0"),
				),
			),
			integration.WithEnvironment(
				integration.EnvironmentName("production"),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceName("resource-1"),
		),
	)

	ctx := context.Background()

	allJobs := engine.Workspace().Jobs().Items()
	invalidJobAgentJobs := 0

	for _, job := range allJobs {
		if job.Status == oapi.JobStatusInvalidJobAgent {
			invalidJobAgentJobs++
		}
	}

	assert.Equal(t, 1, invalidJobAgentJobs, "expected 1 invalid job agent job")

	// Add job agent to deployment
	d, _ := engine.Workspace().Deployments().Get(deploymentID)
	if d == nil {
		t.Fatalf("deployment not found")
		return
	}
	dep := *d
	dep.JobAgentId = &jobAgentID
	engine.PushEvent(ctx, handler.DeploymentUpdate, &dep)

	allJobs = engine.Workspace().Jobs().Items()

	invalidJobAgentJobs = 0
	for _, job := range allJobs {
		if job.Status == oapi.JobStatusInvalidJobAgent {
			invalidJobAgentJobs++
		}
	}

	pendingJobs := engine.Workspace().Jobs().GetPending()

	assert.Equal(t, 1, invalidJobAgentJobs, "expected 1 invalid job agent job (the old one should be preserved)")
	assert.Equal(t, 1, len(pendingJobs), "expected 1 pending job (the new one should be created, i.e. 'retriggered')")

	// Verify the retriggered pending job has DispatchContext
	for _, job := range pendingJobs {
		assert.NotNil(t, job.DispatchContext, "retriggered job should have DispatchContext")
		assert.Equal(t, jobAgentID, job.DispatchContext.JobAgent.Id)
		assert.NotNil(t, job.DispatchContext.Release)
		assert.NotNil(t, job.DispatchContext.Deployment)
		assert.Equal(t, deploymentID, job.DispatchContext.Deployment.Id)
	}
}

func TestEngine_FutureUpdatesDoNotRetriggerPreviouslyRetriggeredJobs(t *testing.T) {
	jobAgentID := uuid.New().String()
	deploymentID := uuid.New().String()

	engine := integration.NewTestWorkspace(
		t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID),
			integration.JobAgentName("Test Agent"),
		),
		integration.WithSystem(
			integration.SystemName("test-system"),
			integration.WithDeployment(
				integration.DeploymentID(deploymentID),
				integration.DeploymentName("deployment-1"),
				integration.DeploymentCelResourceSelector("true"),
				// No job agent configured
				integration.WithDeploymentVersion(
					integration.DeploymentVersionTag("v1.0.0"),
				),
			),
			integration.WithEnvironment(
				integration.EnvironmentName("production"),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceName("resource-1"),
		),
	)

	ctx := context.Background()

	allJobs := engine.Workspace().Jobs().Items()
	invalidJobAgentJobs := 0

	for _, job := range allJobs {
		if job.Status == oapi.JobStatusInvalidJobAgent {
			invalidJobAgentJobs++
		}
	}

	assert.Equal(t, 1, invalidJobAgentJobs, "expected 1 invalid job agent job")

	// Add job agent to deployment
	d, _ := engine.Workspace().Deployments().Get(deploymentID)
	if d == nil {
		t.Fatalf("deployment not found")
		return
	}
	dep := *d
	dep.JobAgentId = &jobAgentID
	engine.PushEvent(ctx, handler.DeploymentUpdate, &dep)

	allJobs = engine.Workspace().Jobs().Items()

	invalidJobAgentJobs = 0
	for _, job := range allJobs {
		if job.Status == oapi.JobStatusInvalidJobAgent {
			invalidJobAgentJobs++
		}
	}

	pendingJobs := engine.Workspace().Jobs().GetPending()

	assert.Equal(t, 1, invalidJobAgentJobs, "expected 1 invalid job agent job (the old one should be preserved)")
	assert.Equal(t, 1, len(pendingJobs), "expected 1 pending job (the new one should be created, i.e. 'retriggered')")

	// Update random field on the deployment
	d.Name = "deployment-2"
	engine.PushEvent(ctx, handler.DeploymentUpdate, d)

	allJobs = engine.Workspace().Jobs().Items()

	invalidJobAgentJobs = 0
	for _, job := range allJobs {
		if job.Status == oapi.JobStatusInvalidJobAgent {
			invalidJobAgentJobs++
		}
	}

	pendingJobs = engine.Workspace().Jobs().GetPending()

	// no new jobs should be created
	assert.Equal(t, 1, invalidJobAgentJobs, "expected 1 invalid job agent job (the old one should be preserved)")
	assert.Equal(t, 1, len(pendingJobs), "expected 1 pending job (the new one should be created, i.e. 'retriggered')")
}

func TestEngine_DeploymentRemoval(t *testing.T) {
	deploymentID1 := uuid.New().String()
	deploymentID2 := uuid.New().String()

	engine := integration.NewTestWorkspace(
		t,
		integration.WithSystem(
			integration.SystemName("test-system"),
			integration.WithDeployment(
				integration.DeploymentID(deploymentID1),
				integration.DeploymentName("deployment-1"),
			),
			integration.WithDeployment(
				integration.DeploymentID(deploymentID2),
				integration.DeploymentName("deployment-2"),
			),
		),
	)

	ctx := context.Background()

	// Verify both deployments exist
	d1, exists := engine.Workspace().Deployments().Get(deploymentID1)
	if !exists {
		t.Fatalf("deployment 1 not found")
	}
	if d1.Id != deploymentID1 {
		t.Fatalf("deployment 1 id mismatch: got %s, want %s", d1.Id, deploymentID1)
	}

	_, exists = engine.Workspace().Deployments().Get(deploymentID2)
	if !exists {
		t.Fatalf("deployment 2 not found")
	}

	// Remove deployment 1
	engine.PushEvent(ctx, handler.DeploymentDelete, d1)

	// Verify deployment 1 is gone
	_, exists = engine.Workspace().Deployments().Get(deploymentID1)
	if exists {
		t.Fatalf("deployment 1 should be deleted")
	}

	// Verify deployment 2 still exists
	d2After, exists := engine.Workspace().Deployments().Get(deploymentID2)
	if !exists {
		t.Fatalf("deployment 2 should still exist")
	}
	if d2After.Id != deploymentID2 {
		t.Fatalf("deployment 2 id mismatch after deletion: got %s, want %s", d2After.Id, deploymentID2)
	}
}

func TestEngine_DeploymentRemovalWithReleaseTargets(t *testing.T) {
	deploymentID := uuid.New().String()

	engine := integration.NewTestWorkspace(
		t,
		integration.WithSystem(
			integration.SystemName("test-system"),
			integration.WithDeployment(
				integration.DeploymentID(deploymentID),
				integration.DeploymentName("deployment-to-remove"),
				integration.DeploymentCelResourceSelector("true"),
				integration.WithDeploymentVersion(
					integration.DeploymentVersionTag("v1.0.0"),
				),
			),
			integration.WithEnvironment(
				integration.EnvironmentName("production"),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceName("resource-1"),
		),
	)

	ctx := context.Background()

	// Verify release targets were created
	releaseTargets, err := engine.Workspace().ReleaseTargets().Items()
	if err != nil {
		t.Fatalf("failed to get release targets: %v", err)
	}

	initialReleaseTargetCount := len(releaseTargets)
	if initialReleaseTargetCount == 0 {
		t.Fatalf("expected at least 1 release target, got 0")
	}

	// Count release targets for this deployment
	deploymentReleaseTargets := 0
	for _, rt := range releaseTargets {
		if rt.DeploymentId == deploymentID {
			deploymentReleaseTargets++
		}
	}

	if deploymentReleaseTargets == 0 {
		t.Fatalf("expected release targets for deployment, got 0")
	}

	// Remove deployment
	d, _ := engine.Workspace().Deployments().Get(deploymentID)
	engine.PushEvent(ctx, handler.DeploymentDelete, d)

	// Verify deployment is gone
	_, exists := engine.Workspace().Deployments().Get(deploymentID)
	if exists {
		t.Fatalf("deployment should be deleted")
	}

	// Verify release targets for this deployment are gone
	releaseTargetsAfter, err := engine.Workspace().ReleaseTargets().Items()
	if err != nil {
		t.Fatalf("failed to get release targets after deletion: %v", err)
	}

	for _, rt := range releaseTargetsAfter {
		if rt.DeploymentId == deploymentID {
			t.Fatalf("release target for deleted deployment still exists: deployment=%s, environment=%s, resource=%s", rt.DeploymentId, rt.EnvironmentId, rt.ResourceId)
		}
	}
}

func TestEngine_DeploymentRemovalWithJobs(t *testing.T) {
	jobAgentID := uuid.New().String()
	deploymentID := uuid.New().String()

	engine := integration.NewTestWorkspace(
		t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID),
			integration.JobAgentName("Test Agent"),
		),
		integration.WithSystem(
			integration.SystemName("test-system"),
			integration.WithDeployment(
				integration.DeploymentID(deploymentID),
				integration.DeploymentName("deployment-with-jobs"),
				integration.DeploymentJobAgent(jobAgentID),
				integration.DeploymentCelResourceSelector("true"),
				integration.WithDeploymentVersion(
					integration.DeploymentVersionTag("v1.0.0"),
				),
			),
			integration.WithEnvironment(
				integration.EnvironmentName("production"),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceName("resource-1"),
		),
	)

	ctx := context.Background()

	// Verify jobs were created
	pendingJobs := engine.Workspace().Jobs().GetPending()
	if len(pendingJobs) == 0 {
		t.Fatalf("expected at least 1 pending job, got 0")
	}

	// Count jobs for this deployment
	deploymentJobs := 0
	var jobsForDeployment []string
	for _, job := range pendingJobs {
		release, ok := engine.Workspace().Releases().Get(job.ReleaseId)
		if !ok {
			continue
		}
		if release.ReleaseTarget.DeploymentId == deploymentID {
			deploymentJobs++
			jobsForDeployment = append(jobsForDeployment, job.Id)

			assert.NotNil(t, job.DispatchContext, "pending job should have DispatchContext")
			assert.Equal(t, jobAgentID, job.DispatchContext.JobAgent.Id)
			assert.NotNil(t, job.DispatchContext.Release)
			assert.NotNil(t, job.DispatchContext.Deployment)
			assert.Equal(t, deploymentID, job.DispatchContext.Deployment.Id)
		}
	}

	if deploymentJobs == 0 {
		t.Fatalf("expected jobs for deployment, got 0")
	}

	// Remove deployment
	d, _ := engine.Workspace().Deployments().Get(deploymentID)
	engine.PushEvent(ctx, handler.DeploymentDelete, d)

	// Verify deployment is gone
	_, exists := engine.Workspace().Deployments().Get(deploymentID)
	if exists {
		t.Fatalf("deployment should be deleted")
	}

	// Verify jobs for this deployment are gone
	pendingJobsAfter := engine.Workspace().Jobs().GetPending()
	for _, job := range pendingJobsAfter {
		for _, jobID := range jobsForDeployment {
			if job.Id == jobID {
				t.Fatalf("job %s for deleted deployment still exists", jobID)
			}
		}
	}
}

func TestEngine_DeploymentRemovalWithResources(t *testing.T) {
	deploymentID1 := uuid.New().String()
	deploymentID2 := uuid.New().String()
	resourceID := uuid.New().String()

	engine := integration.NewTestWorkspace(
		t,
		integration.WithSystem(
			integration.SystemName("test-system"),
			integration.WithDeployment(
				integration.DeploymentID(deploymentID1),
				integration.DeploymentName("deployment-1"),
				integration.DeploymentCelResourceSelector(`resource.metadata["tier"] == "web"`),
			),
			integration.WithDeployment(
				integration.DeploymentID(deploymentID2),
				integration.DeploymentName("deployment-2"),
				integration.DeploymentCelResourceSelector("true"),
			),
		),
	)

	ctx := context.Background()

	d1, _ := engine.Workspace().Deployments().Get(deploymentID1)

	// Create a resource that matches both deployments
	r1 := c.NewResource(engine.Workspace().ID)
	r1.Id = resourceID
	r1.Name = "resource-1"
	r1.Metadata = map[string]string{"tier": "web"}
	engine.PushEvent(ctx, handler.ResourceCreate, r1)

	// Verify both deployments have the resource
	d1Resources, err := engine.Workspace().Deployments().Resources(ctx, deploymentID1)
	if err != nil {
		t.Fatalf("failed to get deployment 1 resources: %v", err)
	}
	if len(d1Resources) != 1 {
		t.Fatalf("deployment 1 resources count is %d, want 1", len(d1Resources))
	}

	d2Resources, err := engine.Workspace().Deployments().Resources(ctx, deploymentID2)
	if err != nil {
		t.Fatalf("failed to get deployment 2 resources: %v", err)
	}
	if len(d2Resources) != 1 {
		t.Fatalf("deployment 2 resources count is %d, want 1", len(d2Resources))
	}

	// Remove deployment 1
	engine.PushEvent(ctx, handler.DeploymentDelete, d1)

	// Verify deployment 1 is gone
	_, exists := engine.Workspace().Deployments().Get(deploymentID1)
	if exists {
		t.Fatalf("deployment 1 should be deleted")
	}

	// Verify resource still exists and is still linked to deployment 2
	resource, exists := engine.Workspace().Resources().Get(resourceID)
	if !exists {
		t.Fatalf("resource should still exist")
	}
	if resource.Id != resourceID {
		t.Fatalf("resource id mismatch: got %s, want %s", resource.Id, resourceID)
	}

	// Verify deployment 2 still has the resource
	d2ResourcesAfter, err := engine.Workspace().Deployments().Resources(ctx, deploymentID2)
	if err != nil {
		t.Fatalf("failed to get deployment 2 resources after deletion: %v", err)
	}
	if len(d2ResourcesAfter) != 1 {
		t.Fatalf("deployment 2 resources count after deletion is %d, want 1", len(d2ResourcesAfter))
	}
}

func TestEngine_DeploymentRemovalMultiple(t *testing.T) {
	deployment1 := uuid.New().String()
	deployment2 := uuid.New().String()
	deployment3 := uuid.New().String()

	engine := integration.NewTestWorkspace(
		t,
		integration.WithSystem(
			integration.SystemName("test-system"),
			integration.WithDeployment(
				integration.DeploymentID(deployment1),
				integration.DeploymentName("deployment-1"),
			),
			integration.WithDeployment(
				integration.DeploymentID(deployment2),
				integration.DeploymentName("deployment-2"),
			),
			integration.WithDeployment(
				integration.DeploymentID(deployment3),
				integration.DeploymentName("deployment-3"),
			),
		),
	)

	ctx := context.Background()

	// Verify all deployments exist
	initialDeployments := engine.Workspace().Deployments().Items()
	if len(initialDeployments) != 3 {
		t.Fatalf("expected 3 deployments, got %d", len(initialDeployments))
	}

	// Remove deployments 1 and 2
	d1, _ := engine.Workspace().Deployments().Get(deployment1)
	d2, _ := engine.Workspace().Deployments().Get(deployment2)
	engine.PushEvent(ctx, handler.DeploymentDelete, d1)
	engine.PushEvent(ctx, handler.DeploymentDelete, d2)

	// Verify only deployment 3 remains
	remainingDeployments := engine.Workspace().Deployments().Items()
	if len(remainingDeployments) != 1 {
		t.Fatalf("expected 1 remaining deployment, got %d", len(remainingDeployments))
	}

	d3, exists := engine.Workspace().Deployments().Get(deployment3)
	if !exists {
		t.Fatalf("deployment 3 should still exist")
	}
	if d3.Id != deployment3 {
		t.Fatalf("remaining deployment id mismatch: got %s, want %s", d3.Id, deployment3)
	}
}

func BenchmarkEngine_DeploymentCreation(b *testing.B) {
	engine := integration.NewTestWorkspace(nil)
	workspaceID := engine.Workspace().ID
	ctx := context.Background()

	for range 100 {
		engine.PushEvent(ctx, handler.DeploymentCreate, c.NewResource(workspaceID))
	}

	b.ResetTimer()
	for b.Loop() {
		deployment := c.NewDeployment(workspaceID)
		engine.PushDeploymentCreateWithLink(ctx, workspaceID, deployment)
	}
}

func BenchmarkEngine_DeploymentRemoval(b *testing.B) {
	engine := integration.NewTestWorkspace(nil)
	workspaceID := engine.Workspace().ID
	ctx := context.Background()

	// Create deployments to remove
	deployments := make([]*oapi.Deployment, b.N)
	for i := range b.N {
		deployment := c.NewDeployment(workspaceID)
		deployments[i] = deployment
		engine.PushDeploymentCreateWithLink(ctx, workspaceID, deployment)
	}

	b.ResetTimer()
	for i := range b.N {
		engine.PushEvent(ctx, handler.DeploymentDelete, deployments[i])
	}
}

// ===== Multi-Agent (JobAgents array) E2E Tests =====

func TestEngine_DeploymentJobAgentsArray_AllAgentsNoCondition(t *testing.T) {
	agentK8s := uuid.New().String()
	agentDocker := uuid.New().String()
	deploymentID := uuid.New().String()

	engine := integration.NewTestWorkspace(
		t,
		integration.WithJobAgent(
			integration.JobAgentID(agentK8s),
			integration.JobAgentName("Kubernetes Agent"),
		),
		integration.WithJobAgent(
			integration.JobAgentID(agentDocker),
			integration.JobAgentName("Docker Agent"),
		),
		integration.WithSystem(
			integration.SystemName("test-system"),
			integration.WithDeployment(
				integration.DeploymentID(deploymentID),
				integration.DeploymentName("multi-agent-deploy"),
				integration.DeploymentCelResourceSelector("true"),
				integration.DeploymentJobAgents([]oapi.DeploymentJobAgent{
					{Ref: agentK8s, Config: oapi.JobAgentConfig{}},
					{Ref: agentDocker, Config: oapi.JobAgentConfig{}},
				}),
				integration.WithDeploymentVersion(
					integration.DeploymentVersionTag("v1.0.0"),
				),
			),
			integration.WithEnvironment(
				integration.EnvironmentName("production"),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceName("resource-1"),
		),
	)

	pendingJobs := engine.Workspace().Jobs().GetPending()

	jobAgentIDs := map[string]bool{}
	for _, job := range pendingJobs {
		release, ok := engine.Workspace().Releases().Get(job.ReleaseId)
		if !ok {
			t.Fatalf("release not found for job %s", job.Id)
		}
		if release.ReleaseTarget.DeploymentId == deploymentID {
			jobAgentIDs[job.JobAgentId] = true
		}
	}

	assert.True(t, jobAgentIDs[agentK8s], "should have a job for the Kubernetes agent")
	assert.True(t, jobAgentIDs[agentDocker], "should have a job for the Docker agent")
	assert.Equal(t, 2, len(jobAgentIDs), "should have exactly 2 jobs (one per agent)")
}

func TestEngine_DeploymentJobAgentsArray_WithIfConditionFilters(t *testing.T) {
	agentK8s := uuid.New().String()
	agentDocker := uuid.New().String()
	deploymentID := uuid.New().String()

	engine := integration.NewTestWorkspace(
		t,
		integration.WithJobAgent(
			integration.JobAgentID(agentK8s),
			integration.JobAgentName("Kubernetes Agent"),
		),
		integration.WithJobAgent(
			integration.JobAgentID(agentDocker),
			integration.JobAgentName("Docker Agent"),
		),
		integration.WithSystem(
			integration.SystemName("test-system"),
			integration.WithDeployment(
				integration.DeploymentID(deploymentID),
				integration.DeploymentName("conditional-deploy"),
				integration.DeploymentCelResourceSelector("true"),
				integration.DeploymentJobAgents([]oapi.DeploymentJobAgent{
					{Ref: agentK8s, Selector: `resource.metadata.cloud == "gcp"`, Config: oapi.JobAgentConfig{}},
					{Ref: agentDocker, Selector: "true", Config: oapi.JobAgentConfig{}},
				}),
				integration.WithDeploymentVersion(
					integration.DeploymentVersionTag("v1.0.0"),
				),
			),
			integration.WithEnvironment(
				integration.EnvironmentName("production"),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceName("gcp-resource"),
			integration.ResourceMetadata(map[string]string{"cloud": "gcp"}),
		),
	)

	pendingJobs := engine.Workspace().Jobs().GetPending()

	jobAgentIDs := map[string]bool{}
	for _, job := range pendingJobs {
		release, ok := engine.Workspace().Releases().Get(job.ReleaseId)
		if !ok {
			t.Fatalf("release not found for job %s", job.Id)
		}
		if release.ReleaseTarget.DeploymentId == deploymentID {
			jobAgentIDs[job.JobAgentId] = true
		}
	}

	assert.True(t, jobAgentIDs[agentK8s], "k8s agent should match (resource cloud=gcp)")
	assert.True(t, jobAgentIDs[agentDocker], "docker agent should match (if=true)")
	assert.Equal(t, 2, len(jobAgentIDs), "both agents should produce jobs")
}

func TestEngine_DeploymentJobAgentsArray_IfConditionExcludesAgent(t *testing.T) {
	agentK8s := uuid.New().String()
	agentDocker := uuid.New().String()
	deploymentID := uuid.New().String()

	engine := integration.NewTestWorkspace(
		t,
		integration.WithJobAgent(
			integration.JobAgentID(agentK8s),
			integration.JobAgentName("Kubernetes Agent"),
		),
		integration.WithJobAgent(
			integration.JobAgentID(agentDocker),
			integration.JobAgentName("Docker Agent"),
		),
		integration.WithSystem(
			integration.SystemName("test-system"),
			integration.WithDeployment(
				integration.DeploymentID(deploymentID),
				integration.DeploymentName("filtered-deploy"),
				integration.DeploymentCelResourceSelector("true"),
				integration.DeploymentJobAgents([]oapi.DeploymentJobAgent{
					{Ref: agentK8s, Selector: `resource.metadata.cloud == "gcp"`, Config: oapi.JobAgentConfig{}},
					{Ref: agentDocker, Selector: `resource.metadata.cloud == "aws"`, Config: oapi.JobAgentConfig{}},
				}),
				integration.WithDeploymentVersion(
					integration.DeploymentVersionTag("v1.0.0"),
				),
			),
			integration.WithEnvironment(
				integration.EnvironmentName("production"),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceName("gcp-resource"),
			integration.ResourceMetadata(map[string]string{"cloud": "gcp"}),
		),
	)

	pendingJobs := engine.Workspace().Jobs().GetPending()

	jobAgentIDs := map[string]bool{}
	for _, job := range pendingJobs {
		release, ok := engine.Workspace().Releases().Get(job.ReleaseId)
		if !ok {
			t.Fatalf("release not found for job %s", job.Id)
		}
		if release.ReleaseTarget.DeploymentId == deploymentID {
			jobAgentIDs[job.JobAgentId] = true
		}
	}

	assert.True(t, jobAgentIDs[agentK8s], "k8s agent should match (cloud=gcp)")
	assert.False(t, jobAgentIDs[agentDocker], "docker agent should NOT match (cloud!=aws)")
	assert.Equal(t, 1, len(jobAgentIDs), "only one agent should produce a job")
}

func TestEngine_DeploymentJobAgentsArray_SelectedAgentConfigMergedIntoFinalJobConfig(t *testing.T) {
	agentGCP := uuid.New().String()
	agentAWS := uuid.New().String()
	deploymentID := uuid.New().String()

	engine := integration.NewTestWorkspace(
		t,
		integration.WithJobAgent(
			integration.JobAgentID(agentGCP),
			integration.JobAgentName("GCP Agent"),
			integration.JobAgentConfig(map[string]any{
				"template":  "agent-template",
				"serverUrl": "https://argocd.example.com",
				"apiKey":    "token-abc",
				"shared":    "agent",
				"agentOnly": "yes",
			}),
		),
		integration.WithJobAgent(
			integration.JobAgentID(agentAWS),
			integration.JobAgentName("AWS Agent"),
			integration.JobAgentConfig(map[string]any{
				"template": "aws-agent-template",
			}),
		),
		integration.WithSystem(
			integration.SystemName("test-system"),
			integration.WithDeployment(
				integration.DeploymentID(deploymentID),
				integration.DeploymentName("multi-agent-merge-deploy"),
				integration.DeploymentCelResourceSelector("true"),
				integration.DeploymentJobAgents([]oapi.DeploymentJobAgent{
					{
						Ref:      agentGCP,
						Selector: `resource.metadata.cloud == "gcp"`,
						Config: oapi.JobAgentConfig{
							"template":     "selected-template",
							"shared":       "selected",
							"selectorOnly": "yes",
							"timeout":      120,
						},
					},
					{
						Ref:      agentAWS,
						Selector: `resource.metadata.cloud == "aws"`,
						Config: oapi.JobAgentConfig{
							"template":     "should-not-be-used",
							"selectorOnly": "no",
						},
					},
				}),
				integration.WithDeploymentVersion(
					integration.DeploymentVersionTag("v1.0.0"),
				),
			),
			integration.WithEnvironment(
				integration.EnvironmentName("production"),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceName("gcp-resource"),
			integration.ResourceMetadata(map[string]string{"cloud": "gcp"}),
		),
	)

	pendingJobs := engine.Workspace().Jobs().GetPending()

	var deploymentJobs []*oapi.Job
	for _, job := range pendingJobs {
		release, ok := engine.Workspace().Releases().Get(job.ReleaseId)
		if !ok {
			t.Fatalf("release not found for job %s", job.Id)
		}
		if release.ReleaseTarget.DeploymentId == deploymentID {
			deploymentJobs = append(deploymentJobs, job)
		}
	}

	require.Len(t, deploymentJobs, 1, "only the selected deployment agent should create one job")
	job := deploymentJobs[0]
	assert.Equal(t, agentGCP, job.JobAgentId)

	// Final config should merge:
	// jobAgent.Config + selected DeploymentJobAgent.Config
	assert.Equal(t, "selected-template", job.JobAgentConfig["template"])
	assert.Equal(t, "selected", job.JobAgentConfig["shared"])
	assert.Equal(t, "yes", job.JobAgentConfig["agentOnly"])
	assert.Equal(t, "yes", job.JobAgentConfig["selectorOnly"])
	assert.Equal(t, float64(120), job.JobAgentConfig["timeout"])

	require.NotNil(t, job.DispatchContext)
	assert.Equal(t, agentGCP, job.DispatchContext.JobAgent.Id)
	assert.Equal(t, "selected-template", job.DispatchContext.JobAgentConfig["template"])
	assert.Equal(t, "selected", job.DispatchContext.JobAgentConfig["shared"])
}

func TestEngine_DeploymentJobAgentsArray_AllConditionsFalse(t *testing.T) {
	agentA := uuid.New().String()
	agentB := uuid.New().String()
	deploymentID := uuid.New().String()

	engine := integration.NewTestWorkspace(
		t,
		integration.WithJobAgent(
			integration.JobAgentID(agentA),
			integration.JobAgentName("Agent A"),
		),
		integration.WithJobAgent(
			integration.JobAgentID(agentB),
			integration.JobAgentName("Agent B"),
		),
		integration.WithSystem(
			integration.SystemName("test-system"),
			integration.WithDeployment(
				integration.DeploymentID(deploymentID),
				integration.DeploymentName("no-match-deploy"),
				integration.DeploymentCelResourceSelector("true"),
				integration.DeploymentJobAgents([]oapi.DeploymentJobAgent{
					{Ref: agentA, Selector: `environment.name == "staging"`, Config: oapi.JobAgentConfig{}},
					{Ref: agentB, Selector: `environment.name == "staging"`, Config: oapi.JobAgentConfig{}},
				}),
				integration.WithDeploymentVersion(
					integration.DeploymentVersionTag("v1.0.0"),
				),
			),
			integration.WithEnvironment(
				integration.EnvironmentName("production"),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceName("resource-1"),
		),
	)

	allJobs := engine.Workspace().Jobs().Items()

	deploymentJobs := 0
	for _, job := range allJobs {
		release, ok := engine.Workspace().Releases().Get(job.ReleaseId)
		if !ok {
			continue
		}
		if release.ReleaseTarget.DeploymentId == deploymentID {
			deploymentJobs++
			assert.Equal(t, oapi.JobStatusInvalidJobAgent, job.Status,
				"when no agents match, should create an InvalidJobAgent job")
		}
	}

	assert.Equal(t, 1, deploymentJobs, "should have 1 job with InvalidJobAgent status")
}

func TestEngine_DeploymentJobAgentsArray_MultipleResourcesDifferentAgents(t *testing.T) {
	agentGCP := uuid.New().String()
	agentAWS := uuid.New().String()
	deploymentID := uuid.New().String()

	engine := integration.NewTestWorkspace(
		t,
		integration.WithJobAgent(
			integration.JobAgentID(agentGCP),
			integration.JobAgentName("GCP Agent"),
		),
		integration.WithJobAgent(
			integration.JobAgentID(agentAWS),
			integration.JobAgentName("AWS Agent"),
		),
		integration.WithSystem(
			integration.SystemName("test-system"),
			integration.WithDeployment(
				integration.DeploymentID(deploymentID),
				integration.DeploymentName("multi-cloud-deploy"),
				integration.DeploymentCelResourceSelector("true"),
				integration.DeploymentJobAgents([]oapi.DeploymentJobAgent{
					{Ref: agentGCP, Selector: `resource.metadata.cloud == "gcp"`, Config: oapi.JobAgentConfig{}},
					{Ref: agentAWS, Selector: `resource.metadata.cloud == "aws"`, Config: oapi.JobAgentConfig{}},
				}),
				integration.WithDeploymentVersion(
					integration.DeploymentVersionTag("v1.0.0"),
				),
			),
			integration.WithEnvironment(
				integration.EnvironmentName("production"),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceName("gcp-server"),
			integration.ResourceMetadata(map[string]string{"cloud": "gcp"}),
		),
		integration.WithResource(
			integration.ResourceName("aws-server"),
			integration.ResourceMetadata(map[string]string{"cloud": "aws"}),
		),
	)

	pendingJobs := engine.Workspace().Jobs().GetPending()

	type jobInfo struct {
		agentID    string
		resourceID string
	}
	var jobs []jobInfo
	for _, job := range pendingJobs {
		release, ok := engine.Workspace().Releases().Get(job.ReleaseId)
		if !ok {
			t.Fatalf("release not found for job %s", job.Id)
		}
		if release.ReleaseTarget.DeploymentId == deploymentID {
			jobs = append(jobs, jobInfo{
				agentID:    job.JobAgentId,
				resourceID: release.ReleaseTarget.ResourceId,
			})
		}
	}

	// 2 resources x 1 matching agent each = 2 pending jobs
	assert.Equal(t, 2, len(jobs), "should have 2 pending jobs (one per resource)")

	gcpJobs := 0
	awsJobs := 0
	for _, j := range jobs {
		if j.agentID == agentGCP {
			gcpJobs++
		}
		if j.agentID == agentAWS {
			awsJobs++
		}
	}

	assert.Equal(t, 1, gcpJobs, "GCP agent should have 1 job (for gcp-server)")
	assert.Equal(t, 1, awsJobs, "AWS agent should have 1 job (for aws-server)")
}

// ===== Error / Edge Case E2E Tests =====

func TestEngine_DeploymentJobAgentsArray_NonExistentAgentRef(t *testing.T) {
	realAgentID := uuid.New().String()
	fakeAgentID := uuid.New().String()
	deploymentID := uuid.New().String()

	engine := integration.NewTestWorkspace(
		t,
		integration.WithJobAgent(
			integration.JobAgentID(realAgentID),
			integration.JobAgentName("Real Agent"),
		),
		integration.WithSystem(
			integration.SystemName("test-system"),
			integration.WithDeployment(
				integration.DeploymentID(deploymentID),
				integration.DeploymentName("bad-ref-deploy"),
				integration.DeploymentCelResourceSelector("true"),
				integration.DeploymentJobAgents([]oapi.DeploymentJobAgent{
					{Ref: realAgentID, Config: oapi.JobAgentConfig{}},
					{Ref: fakeAgentID, Config: oapi.JobAgentConfig{}},
				}),
				integration.WithDeploymentVersion(
					integration.DeploymentVersionTag("v1.0.0"),
				),
			),
			integration.WithEnvironment(
				integration.EnvironmentName("production"),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceName("resource-1"),
		),
	)

	allJobs := engine.Workspace().Jobs().Items()

	deploymentJobs := 0
	for _, job := range allJobs {
		release, ok := engine.Workspace().Releases().Get(job.ReleaseId)
		if !ok {
			continue
		}
		if release.ReleaseTarget.DeploymentId == deploymentID {
			deploymentJobs++
			assert.Equal(t, oapi.JobStatusInvalidJobAgent, job.Status,
				"should create an InvalidJobAgent job when agent ref doesn't exist")
			assert.NotNil(t, job.Message)
		}
	}

	assert.Equal(t, 1, deploymentJobs,
		"should have exactly 1 job with InvalidJobAgent status for the failed selector")
}

func TestEngine_DeploymentJobAgentsArray_AllRefsNonExistent(t *testing.T) {
	fakeAgent1 := uuid.New().String()
	fakeAgent2 := uuid.New().String()
	deploymentID := uuid.New().String()

	engine := integration.NewTestWorkspace(
		t,
		integration.WithSystem(
			integration.SystemName("test-system"),
			integration.WithDeployment(
				integration.DeploymentID(deploymentID),
				integration.DeploymentName("all-bad-refs-deploy"),
				integration.DeploymentCelResourceSelector("true"),
				integration.DeploymentJobAgents([]oapi.DeploymentJobAgent{
					{Ref: fakeAgent1, Config: oapi.JobAgentConfig{}},
					{Ref: fakeAgent2, Config: oapi.JobAgentConfig{}},
				}),
				integration.WithDeploymentVersion(
					integration.DeploymentVersionTag("v1.0.0"),
				),
			),
			integration.WithEnvironment(
				integration.EnvironmentName("production"),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceName("resource-1"),
		),
	)

	allJobs := engine.Workspace().Jobs().Items()

	deploymentJobs := 0
	for _, job := range allJobs {
		release, ok := engine.Workspace().Releases().Get(job.ReleaseId)
		if !ok {
			continue
		}
		if release.ReleaseTarget.DeploymentId == deploymentID {
			deploymentJobs++
			assert.Equal(t, oapi.JobStatusInvalidJobAgent, job.Status)
			assert.NotNil(t, job.Message)
		}
	}

	assert.Equal(t, 1, deploymentJobs,
		"should have 1 InvalidJobAgent job when all agent refs are non-existent")
}

func TestEngine_DeploymentJobAgentsArray_InvalidCelSelector(t *testing.T) {
	agentID := uuid.New().String()
	deploymentID := uuid.New().String()

	engine := integration.NewTestWorkspace(
		t,
		integration.WithJobAgent(
			integration.JobAgentID(agentID),
			integration.JobAgentName("Valid Agent"),
		),
		integration.WithSystem(
			integration.SystemName("test-system"),
			integration.WithDeployment(
				integration.DeploymentID(deploymentID),
				integration.DeploymentName("bad-cel-deploy"),
				integration.DeploymentCelResourceSelector("true"),
				integration.DeploymentJobAgents([]oapi.DeploymentJobAgent{
					{Ref: agentID, Selector: "this is not valid cel !!!", Config: oapi.JobAgentConfig{}},
				}),
				integration.WithDeploymentVersion(
					integration.DeploymentVersionTag("v1.0.0"),
				),
			),
			integration.WithEnvironment(
				integration.EnvironmentName("production"),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceName("resource-1"),
		),
	)

	allJobs := engine.Workspace().Jobs().Items()

	deploymentJobs := 0
	for _, job := range allJobs {
		release, ok := engine.Workspace().Releases().Get(job.ReleaseId)
		if !ok {
			continue
		}
		if release.ReleaseTarget.DeploymentId == deploymentID {
			deploymentJobs++
			assert.Equal(t, oapi.JobStatusInvalidJobAgent, job.Status,
				"invalid CEL selector should produce an InvalidJobAgent job")
			assert.NotNil(t, job.Message)
		}
	}

	assert.Equal(t, 1, deploymentJobs,
		"should have 1 InvalidJobAgent job for invalid CEL selector")
}

func TestEngine_DeploymentJobAgentsArray_ValidAgentFollowedByNonExistent(t *testing.T) {
	validAgentID := uuid.New().String()
	fakeAgentID := uuid.New().String()
	deploymentID := uuid.New().String()

	engine := integration.NewTestWorkspace(
		t,
		integration.WithJobAgent(
			integration.JobAgentID(validAgentID),
			integration.JobAgentName("Valid Agent"),
		),
		integration.WithSystem(
			integration.SystemName("test-system"),
			integration.WithDeployment(
				integration.DeploymentID(deploymentID),
				integration.DeploymentName("mixed-agents-deploy"),
				integration.DeploymentCelResourceSelector("true"),
				integration.DeploymentJobAgents([]oapi.DeploymentJobAgent{
					{Ref: validAgentID, Selector: "true", Config: oapi.JobAgentConfig{}},
					{Ref: fakeAgentID, Selector: "true", Config: oapi.JobAgentConfig{}},
				}),
				integration.WithDeploymentVersion(
					integration.DeploymentVersionTag("v1.0.0"),
				),
			),
			integration.WithEnvironment(
				integration.EnvironmentName("production"),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceName("resource-1"),
		),
	)

	allJobs := engine.Workspace().Jobs().Items()

	deploymentJobs := 0
	for _, job := range allJobs {
		release, ok := engine.Workspace().Releases().Get(job.ReleaseId)
		if !ok {
			continue
		}
		if release.ReleaseTarget.DeploymentId == deploymentID {
			deploymentJobs++
			assert.Equal(t, oapi.JobStatusInvalidJobAgent, job.Status,
				"when any agent ref fails, the entire selection fails with InvalidJobAgent")
		}
	}

	assert.Equal(t, 1, deploymentJobs,
		"should have 1 InvalidJobAgent job — the non-existent ref poisons the whole batch")
}

func TestEngine_DeploymentJobAgentsArray_NonExistentAgentFilteredOutBySelector(t *testing.T) {
	validAgentID := uuid.New().String()
	fakeAgentID := uuid.New().String()
	deploymentID := uuid.New().String()

	engine := integration.NewTestWorkspace(
		t,
		integration.WithJobAgent(
			integration.JobAgentID(validAgentID),
			integration.JobAgentName("Valid Agent"),
		),
		integration.WithSystem(
			integration.SystemName("test-system"),
			integration.WithDeployment(
				integration.DeploymentID(deploymentID),
				integration.DeploymentName("filtered-bad-ref-deploy"),
				integration.DeploymentCelResourceSelector("true"),
				integration.DeploymentJobAgents([]oapi.DeploymentJobAgent{
					{Ref: validAgentID, Selector: "true", Config: oapi.JobAgentConfig{}},
					{Ref: fakeAgentID, Selector: `resource.metadata.cloud == "aws"`, Config: oapi.JobAgentConfig{}},
				}),
				integration.WithDeploymentVersion(
					integration.DeploymentVersionTag("v1.0.0"),
				),
			),
			integration.WithEnvironment(
				integration.EnvironmentName("production"),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceName("gcp-resource"),
			integration.ResourceMetadata(map[string]string{"cloud": "gcp"}),
		),
	)

	pendingJobs := engine.Workspace().Jobs().GetPending()

	deploymentJobs := 0
	for _, job := range pendingJobs {
		release, ok := engine.Workspace().Releases().Get(job.ReleaseId)
		if !ok {
			continue
		}
		if release.ReleaseTarget.DeploymentId == deploymentID {
			deploymentJobs++
			assert.Equal(t, validAgentID, job.JobAgentId,
				"only the valid agent should have a pending job")
		}
	}

	assert.Equal(t, 1, deploymentJobs,
		"non-existent agent filtered out by selector should not cause an error")
}

func TestEngine_DeploymentLegacyJobAgent_NonExistentRef(t *testing.T) {
	fakeAgentID := uuid.New().String()
	deploymentID := uuid.New().String()

	engine := integration.NewTestWorkspace(
		t,
		integration.WithSystem(
			integration.SystemName("test-system"),
			integration.WithDeployment(
				integration.DeploymentID(deploymentID),
				integration.DeploymentName("legacy-bad-ref"),
				integration.DeploymentJobAgent(fakeAgentID),
				integration.DeploymentCelResourceSelector("true"),
				integration.WithDeploymentVersion(
					integration.DeploymentVersionTag("v1.0.0"),
				),
			),
			integration.WithEnvironment(
				integration.EnvironmentName("production"),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceName("resource-1"),
		),
	)

	allJobs := engine.Workspace().Jobs().Items()

	deploymentJobs := 0
	for _, job := range allJobs {
		release, ok := engine.Workspace().Releases().Get(job.ReleaseId)
		if !ok {
			continue
		}
		if release.ReleaseTarget.DeploymentId == deploymentID {
			deploymentJobs++
			assert.Equal(t, oapi.JobStatusInvalidJobAgent, job.Status,
				"legacy JobAgentId pointing to non-existent agent should produce InvalidJobAgent")
			assert.NotNil(t, job.Message)
		}
	}

	assert.Equal(t, 1, deploymentJobs,
		"should have 1 InvalidJobAgent job for non-existent legacy agent ref")
}

func TestEngine_DeploymentJobAgentsArray_EmptyArray(t *testing.T) {
	deploymentID := uuid.New().String()

	engine := integration.NewTestWorkspace(
		t,
		integration.WithSystem(
			integration.SystemName("test-system"),
			integration.WithDeployment(
				integration.DeploymentID(deploymentID),
				integration.DeploymentName("empty-agents-deploy"),
				integration.DeploymentCelResourceSelector("true"),
				integration.DeploymentJobAgents([]oapi.DeploymentJobAgent{}),
				integration.WithDeploymentVersion(
					integration.DeploymentVersionTag("v1.0.0"),
				),
			),
			integration.WithEnvironment(
				integration.EnvironmentName("production"),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceName("resource-1"),
		),
	)

	allJobs := engine.Workspace().Jobs().Items()

	deploymentJobs := 0
	for _, job := range allJobs {
		release, ok := engine.Workspace().Releases().Get(job.ReleaseId)
		if !ok {
			continue
		}
		if release.ReleaseTarget.DeploymentId == deploymentID {
			deploymentJobs++
			assert.Equal(t, oapi.JobStatusInvalidJobAgent, job.Status,
				"empty agents array should produce InvalidJobAgent (no agent configured)")
		}
	}

	assert.Equal(t, 1, deploymentJobs,
		"should have 1 InvalidJobAgent job for empty agents array")
}
