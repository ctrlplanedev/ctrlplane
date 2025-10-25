package e2e

import (
	"context"
	"testing"
	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/oapi"
	"workspace-engine/test/integration"
	c "workspace-engine/test/integration/creators"

	"github.com/stretchr/testify/require"
)

func TestEngine_DeploymentCreation(t *testing.T) {
	deploymentID1 := "1"
	deploymentID2 := "2"

	engine := integration.NewTestWorkspace(
		t,
		integration.WithSystem(
			integration.SystemName("test-system"),
			integration.WithDeployment(
				integration.DeploymentID(deploymentID1),
				integration.DeploymentName("deployment-has-filter"),
				integration.DeploymentJsonResourceSelector(map[string]any{
					"type":     "metadata",
					"operator": "equals",
					"value":    "dev",
					"key":      "env",
				}),
			),
			integration.WithDeployment(
				integration.DeploymentID(deploymentID2),
				integration.DeploymentName("deployment-has-no-filter"),
				integration.DeploymentCelResourceSelector("true"),
			),
		),
	)

	// Wait for all events to be processed
	engine.Flush()

	engineD1, _ := engine.Workspace().Deployments().Get(deploymentID1)
	engineD2, _ := engine.Workspace().Deployments().Get(deploymentID2)

	if engineD1.Id != deploymentID1 {
		t.Fatalf("deployments have the same id")
	}

	if engineD2.Id != deploymentID2 {
		t.Fatalf("deployments have the same id")
	}

	ctx := context.Background()
	releaseTargets, err := engine.Workspace().ReleaseTargets().Items(ctx)
	if err != nil {
		t.Fatalf("failed to get release targets")
	}

	if len(releaseTargets) != 0 {
		t.Fatalf("release targets count is %d, want 0", len(releaseTargets))
	}

	r1 := c.NewResource(engine.Workspace().ID)
	r1.Id = "r1"
	r1.Name = "r1"
	r1.Metadata = map[string]string{"env": "dev"}
	engine.PushEvent(ctx, handler.ResourceCreate, r1)

	r2 := c.NewResource(engine.Workspace().ID)
	r2.Id = "r2"
	r2.Name = "r2"
	r2.Metadata = map[string]string{"env": "qa"}
	engine.PushEvent(ctx, handler.ResourceCreate, r2)

	// Wait for resource events to be processed
	engine.Flush()

	releaseTargets, err = engine.Workspace().ReleaseTargets().Items(ctx)
	if err != nil {
		t.Fatalf("failed to get release targets")
	}

	if len(releaseTargets) != 0 {
		// We have no environments yet, so no release targets
		t.Fatalf("release targets count is %d, want 0", len(releaseTargets))
	}

	d1Resources, err := engine.Workspace().Deployments().Resources(deploymentID1)
	if err != nil {
		t.Fatalf("failed to get deployment resources")
	}
	d2Resources, err := engine.Workspace().Deployments().Resources(deploymentID2)
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
	jobAgentID1 := "job-agent-1"
	jobAgentID2 := "job-agent-2"
	deploymentID1 := "deployment-with-agent-1"
	deploymentID2 := "deployment-with-agent-2"
	deploymentID3 := "deployment-no-agent"

	engine := integration.NewTestWorkspace(
		t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID1),
			integration.JobAgentName("Agent 1"),
			integration.JobAgentType("kubernetes"),
		),
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID2),
			integration.JobAgentName("Agent 2"),
			integration.JobAgentType("docker"),
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

	// Wait for all events to be processed
	engine.Flush()

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
	jobAgentID := "job-agent-1"
	deploymentIDWithAgent := "deployment-with-agent"
	deploymentIDNoAgent := "deployment-no-agent"

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

	// Wait for all events to be processed
	engine.Flush()

	ctx := context.Background()
    rt, err := engine.Workspace().ReleaseTargets().Items(ctx)
	require.NoError(t, err)
	require.Equal(t, 2, len(rt), "should have 2 release targets (one per deployment)")

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
	jobAgentID := "job-agent-1"
	deploymentID := "deployment-1"

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

	// Wait for all events to be processed
	engine.Flush()

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
}

func TestEngine_DeploymentJobAgentUpdate(t *testing.T) {
	jobAgentID1 := "job-agent-1"
	jobAgentID2 := "job-agent-2"
	deploymentID := "deployment-1"

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

	// Wait for all events to be processed
	engine.Flush()

	ctx := context.Background()

	// Verify initial job agent assignment
	d, _ := engine.Workspace().Deployments().Get(deploymentID)
	if *d.JobAgentId != jobAgentID1 {
		t.Fatalf("deployment job agent mismatch: got %s, want %s", *d.JobAgentId, jobAgentID1)
	}

	// Update deployment to use different job agent
	*d.JobAgentId = jobAgentID2
	engine.PushEvent(ctx, handler.DeploymentUpdate, d)

	// Wait for update event to be processed
	engine.Flush()

	// Verify job agent was updated
	d, _ = engine.Workspace().Deployments().Get(deploymentID)
	if *d.JobAgentId != jobAgentID2 {
		t.Fatalf("deployment job agent after update mismatch: got %s, want %s", *d.JobAgentId, jobAgentID2)
	}
}

func TestEngine_DeploymentMultipleJobAgents(t *testing.T) {
	// Test scenario: Multiple deployments in the same system with different job agents
	// should create jobs with their respective job agents
	jobAgentK8s := "job-agent-k8s"
	jobAgentDocker := "job-agent-docker"
	deploymentK8s := "deployment-k8s"
	deploymentDocker := "deployment-docker"

	engine := integration.NewTestWorkspace(
		t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentK8s),
			integration.JobAgentName("Kubernetes Agent"),
			integration.JobAgentType("kubernetes"),
		),
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentDocker),
			integration.JobAgentName("Docker Agent"),
			integration.JobAgentType("docker"),
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

	// Wait for all events to be processed
	engine.Flush()

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
		}
		if release.ReleaseTarget.DeploymentId == deploymentDocker {
			dockerJobFound = true
			if job.JobAgentId != jobAgentDocker {
				t.Fatalf("docker deployment job has wrong agent: got %s, want %s", job.JobAgentId, jobAgentDocker)
			}
		}
	}

	if !k8sJobFound {
		t.Fatal("no job found for k8s deployment")
	}
	if !dockerJobFound {
		t.Fatal("no job found for docker deployment")
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
		engine.PushEvent(ctx, handler.DeploymentCreate, c.NewDeployment(workspaceID))
	}
}
