package e2e

import (
	"context"
	"testing"
	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/oapi"
	"workspace-engine/test/integration"
	c "workspace-engine/test/integration/creators"
)

func TestEngine_JobAgentCreation(t *testing.T) {
	jobAgentID := "job-agent-1"

	engine := integration.NewTestWorkspace(
		t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID),
			integration.JobAgentName("Test Agent"),
			integration.JobAgentType("kubernetes"),
		),
	)

	// Verify job agent was created
	ja, exists := engine.Workspace().JobAgents().Get(jobAgentID)
	if !exists {
		t.Fatal("job agent not found")
	}

	if ja.Id != jobAgentID {
		t.Fatalf("job agent id mismatch: got %s, want %s", ja.Id, jobAgentID)
	}

	if ja.Name != "Test Agent" {
		t.Fatalf("job agent name mismatch: got %s, want Test Agent", ja.Name)
	}

	if ja.Type != "kubernetes" {
		t.Fatalf("job agent type mismatch: got %s, want kubernetes", ja.Type)
	}

	if ja.WorkspaceId != engine.Workspace().ID {
		t.Fatalf("job agent workspace id mismatch: got %s, want %s", ja.WorkspaceId, engine.Workspace().ID)
	}
}

func TestEngine_JobAgentMultipleCreation(t *testing.T) {
	jobAgentID1 := "job-agent-1"
	jobAgentID2 := "job-agent-2"
	jobAgentID3 := "job-agent-3"

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
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID3),
			integration.JobAgentName("Agent 3"),
			integration.JobAgentType("github-actions"),
		),
	)

	// Verify all job agents exist
	ja1, exists := engine.Workspace().JobAgents().Get(jobAgentID1)
	if !exists {
		t.Fatal("job agent 1 not found")
	}
	if ja1.Type != "kubernetes" {
		t.Fatalf("job agent 1 type mismatch: got %s, want kubernetes", ja1.Type)
	}

	ja2, exists := engine.Workspace().JobAgents().Get(jobAgentID2)
	if !exists {
		t.Fatal("job agent 2 not found")
	}
	if ja2.Type != "docker" {
		t.Fatalf("job agent 2 type mismatch: got %s, want docker", ja2.Type)
	}

	ja3, exists := engine.Workspace().JobAgents().Get(jobAgentID3)
	if !exists {
		t.Fatal("job agent 3 not found")
	}
	if ja3.Type != "github-actions" {
		t.Fatalf("job agent 3 type mismatch: got %s, want github-actions", ja3.Type)
	}

	// Verify total count
	allAgents := engine.Workspace().JobAgents().Items()
	if len(allAgents) != 3 {
		t.Fatalf("expected 3 job agents, got %d", len(allAgents))
	}
}

func TestEngine_JobAgentUpdate(t *testing.T) {
	jobAgentID := "job-agent-1"

	engine := integration.NewTestWorkspace(
		t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID),
			integration.JobAgentName("Original Name"),
			integration.JobAgentType("kubernetes"),
		),
	)

	ctx := context.Background()

	// Verify original values
	ja, _ := engine.Workspace().JobAgents().Get(jobAgentID)
	if ja.Name != "Original Name" {
		t.Fatalf("initial name mismatch: got %s, want Original Name", ja.Name)
	}

	// Update job agent
	ja.Name = "Updated Name"
	ja.Type = "docker"
	engine.PushEvent(ctx, handler.JobAgentUpdate, ja)

	// Verify updated values
	updatedJa, exists := engine.Workspace().JobAgents().Get(jobAgentID)
	if !exists {
		t.Fatal("job agent not found after update")
	}

	if updatedJa.Name != "Updated Name" {
		t.Fatalf("updated name mismatch: got %s, want Updated Name", updatedJa.Name)
	}

	if updatedJa.Type != "docker" {
		t.Fatalf("updated type mismatch: got %s, want docker", updatedJa.Type)
	}
}

func TestEngine_JobAgentUpdateReconcilesReleaseTargets(t *testing.T) {
	jobAgentID := "job-agent-1"
	deploymentID := "deployment-1"
	environmentID := "environment-1"
	resourceID := "resource-1"

	engine := integration.NewTestWorkspace(
		t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID),
			integration.JobAgentName("Original Name"),
			integration.JobAgentType("kubernetes"),
			integration.JobAgentConfig(map[string]any{
				"namespace": "default",
				"timeout":   300,
				"retries":   3,
			}),
		),
		integration.WithSystem(
			integration.WithDeployment(
				integration.DeploymentID(deploymentID),
				integration.DeploymentName("deployment-1"),
				integration.DeploymentJobAgent(jobAgentID),
				integration.DeploymentCelResourceSelector("true"),
				integration.WithDeploymentVersion(
					integration.DeploymentVersionTag("v1.0.0"),
				),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentID),
				integration.EnvironmentName("environment-1"),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceID(resourceID),
		),
	)

	ctx := context.Background()

	jobs := engine.Workspace().Jobs().GetPending()
	if len(jobs) != 1 {
		t.Fatalf("expected 1 pending job, got %d", len(jobs))
	}

	var job *oapi.Job
	for _, j := range jobs {
		job = j
		break
	}

	config, err := job.JobAgentConfig.AsFullCustomJobAgentConfig()
	if err != nil {
		t.Fatalf("failed to get job job agent config: %v", err)
	}

	if job.JobAgentId != jobAgentID {
		t.Fatalf("job agent mismatch: got %s, want %s", job.JobAgentId, jobAgentID)
	}

	if config.AdditionalProperties["namespace"] != "default" {
		t.Fatalf("job agent config namespace mismatch: got %s, want default", config.AdditionalProperties["namespace"])
	}

	if config.AdditionalProperties["timeout"] != float64(300) {
		t.Fatalf("job agent config timeout mismatch: got %v, want 300", config.AdditionalProperties["timeout"])
	}

	if config.AdditionalProperties["retries"] != float64(3) {
		t.Fatalf("job agent config retries mismatch: got %v, want 3", config.AdditionalProperties["retries"])
	}

	job.Status = oapi.JobStatusSuccessful
	engine.Workspace().Jobs().Upsert(ctx, job)

	ja := &oapi.JobAgent{
		Id: jobAgentID,
		Config: c.CustomJobAgentConfig(map[string]any{
			"namespace": "custom-namespace",
			"timeout":   600,
			"retries":   5,
		}),
	}

	engine.PushEvent(ctx, handler.JobAgentUpdate, ja)

	// Verify updated values
	pendingJobs := engine.Workspace().Jobs().GetPending()
	if len(pendingJobs) != 1 {
		t.Fatalf("expected 1 pending job, got %d", len(pendingJobs))
	}

	var updatedJob *oapi.Job
	for _, j := range pendingJobs {
		updatedJob = j
		break
	}

	if updatedJob.JobAgentId != jobAgentID {
		t.Fatalf("job agent mismatch: got %s, want %s", updatedJob.JobAgentId, jobAgentID)
	}

	updatedConfig, err := updatedJob.JobAgentConfig.AsFullCustomJobAgentConfig()
	if err != nil {
		t.Fatalf("failed to get job job agent config: %v", err)
	}

	if updatedConfig.AdditionalProperties["namespace"] != "custom-namespace" {
		t.Fatalf("job agent config namespace mismatch: got %s, want custom-namespace", updatedConfig.AdditionalProperties["namespace"])
	}

	if updatedConfig.AdditionalProperties["timeout"] != float64(600) {
		t.Fatalf("job agent config timeout mismatch: got %v, want 600", updatedConfig.AdditionalProperties["timeout"])
	}

	if updatedConfig.AdditionalProperties["retries"] != float64(5) {
		t.Fatalf("job agent config retries mismatch: got %v, want 5", updatedConfig.AdditionalProperties["retries"])
	}
}

func TestEngine_JobAgentDelete(t *testing.T) {
	jobAgentID := "job-agent-1"

	engine := integration.NewTestWorkspace(
		t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID),
			integration.JobAgentName("Test Agent"),
		),
	)

	ctx := context.Background()

	// Verify job agent exists
	_, exists := engine.Workspace().JobAgents().Get(jobAgentID)
	if !exists {
		t.Fatal("job agent not found")
	}

	// Delete job agent
	ja := &oapi.JobAgent{Id: jobAgentID}
	engine.PushEvent(ctx, handler.JobAgentDelete, ja)

	// Verify job agent was deleted
	_, exists = engine.Workspace().JobAgents().Get(jobAgentID)
	if exists {
		t.Fatal("job agent still exists after deletion")
	}

	allAgents := engine.Workspace().JobAgents().Items()
	if len(allAgents) != 0 {
		t.Fatalf("expected 0 job agents after deletion, got %d", len(allAgents))
	}
}

func TestEngine_JobAgentWithConfig(t *testing.T) {
	jobAgentID := "job-agent-1"

	engine := integration.NewTestWorkspace(t)
	ctx := context.Background()

	// Create job agent with custom config
	ja := c.NewJobAgent(engine.Workspace().ID)
	ja.Id = jobAgentID
	ja.Name = "Config Test Agent"
	ja.WorkspaceId = engine.Workspace().ID
	ja.Config = c.CustomJobAgentConfig(map[string]any{
		"namespace":     "default",
		"timeout":       300,
		"retries":       3,
		"cleanupPolicy": "always",
		"imageRegistry": "docker.io",
		"resources": map[string]any{
			"cpu":    "1000m",
			"memory": "2Gi",
		},
	})

	engine.PushEvent(ctx, handler.JobAgentCreate, ja)

	// Verify job agent config
	retrievedJa, exists := engine.Workspace().JobAgents().Get(jobAgentID)
	if !exists {
		t.Fatal("job agent not found")
	}

	config, err := retrievedJa.Config.AsCustomJobAgentConfig()
	if err != nil {
		t.Fatalf("failed to get job agent config: %v", err)
	}

	if config.AdditionalProperties["namespace"] != "default" {
		t.Fatalf("config namespace mismatch: got %v, want default", config.AdditionalProperties["namespace"])
	}

	if timeout, ok := config.AdditionalProperties["timeout"].(float64); !ok || timeout != 300 {
		t.Fatalf("config timeout mismatch: got %v, want 300", config.AdditionalProperties["timeout"])
	}

	if retries, ok := config.AdditionalProperties["retries"].(float64); !ok || retries != 3 {
		t.Fatalf("config retries mismatch: got %v, want 3", config.AdditionalProperties["retries"])
	}

	if config.AdditionalProperties["cleanupPolicy"] != "always" {
		t.Fatalf("config cleanupPolicy mismatch: got %v, want always", config.AdditionalProperties["cleanupPolicy"])
	}

	// Verify nested config
	resources, ok := config.AdditionalProperties["resources"].(map[string]any)
	if !ok {
		t.Fatal("config resources not found or wrong type")
	}

	if resources["cpu"] != "1000m" {
		t.Fatalf("config resources.cpu mismatch: got %v, want 1000m", resources["cpu"])
	}

	if resources["memory"] != "2Gi" {
		t.Fatalf("config resources.memory mismatch: got %v, want 2Gi", resources["memory"])
	}
}

func TestEngine_JobAgentConfigUpdate(t *testing.T) {
	jobAgentID := "job-agent-1"

	engine := integration.NewTestWorkspace(t)
	ctx := context.Background()

	// Create job agent with initial config
	ja := c.NewJobAgent(engine.Workspace().ID)
	ja.Id = jobAgentID
	ja.Name = "Config Update Test"
	ja.WorkspaceId = engine.Workspace().ID
	ja.Config = c.CustomJobAgentConfig(map[string]any{
		"timeout": 300,
		"retries": 3,
	})

	engine.PushEvent(ctx, handler.JobAgentCreate, ja)

	// Update config
	ja.Config = c.CustomJobAgentConfig(map[string]any{
		"timeout":  600,
		"retries":  5,
		"newField": "newValue",
	})

	engine.PushEvent(ctx, handler.JobAgentUpdate, ja)

	// Verify updated config
	updatedJa, _ := engine.Workspace().JobAgents().Get(jobAgentID)
	config, err := updatedJa.Config.AsCustomJobAgentConfig()
	if err != nil {
		t.Fatalf("failed to get job agent config: %v", err)
	}
	if timeout, ok := config.AdditionalProperties["timeout"].(float64); !ok || timeout != 600 {
		t.Fatalf("updated config timeout mismatch: got %v, want 600", config.AdditionalProperties["timeout"])
	}

	if retries, ok := config.AdditionalProperties["retries"].(float64); !ok || retries != 5 {
		t.Fatalf("updated config retries mismatch: got %v, want 5", config.AdditionalProperties["retries"])
	}

	if config.AdditionalProperties["newField"] != "newValue" {
		t.Fatalf("updated config newField mismatch: got %v, want newValue", config.AdditionalProperties["newField"])
	}
}

func TestEngine_JobAgentUsedByDeployment(t *testing.T) {
	jobAgentID := "job-agent-1"
	deploymentID := "deployment-1"

	engine := integration.NewTestWorkspace(
		t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID),
			integration.JobAgentName("Deployment Test Agent"),
		),
		integration.WithSystem(
			integration.SystemName("test-system"),
			integration.WithDeployment(
				integration.DeploymentID(deploymentID),
				integration.DeploymentName("test-deployment"),
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

	// Verify deployment is using the job agent
	deployment, _ := engine.Workspace().Deployments().Get(deploymentID)
	if *deployment.JobAgentId != jobAgentID {
		t.Fatalf("deployment job agent mismatch: got %s, want %s", *deployment.JobAgentId, jobAgentID)
	}

	// Verify job was created with the job agent
	pendingJobs := engine.Workspace().Jobs().GetPending()
	if len(pendingJobs) != 1 {
		t.Fatalf("expected 1 pending job, got %d", len(pendingJobs))
	}

	var job *oapi.Job
	for _, j := range pendingJobs {
		job = j
		break
	}

	if job.JobAgentId != jobAgentID {
		t.Fatalf("job job agent mismatch: got %s, want %s", job.JobAgentId, jobAgentID)
	}
}

func TestEngine_JobAgentDeleteAffectsDeployments(t *testing.T) {
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
				integration.DeploymentName("test-deployment"),
				integration.DeploymentJobAgent(jobAgentID),
			),
		),
	)

	ctx := context.Background()

	// Verify deployment is using the job agent
	deployment, _ := engine.Workspace().Deployments().Get(deploymentID)
	if *deployment.JobAgentId != jobAgentID {
		t.Fatalf("deployment should be using job agent %s", jobAgentID)
	}

	// Delete the job agent
	ja := &oapi.JobAgent{Id: jobAgentID}
	engine.PushEvent(ctx, handler.JobAgentDelete, ja)

	// Verify job agent was deleted
	_, exists := engine.Workspace().JobAgents().Get(jobAgentID)
	if exists {
		t.Fatal("job agent should be deleted")
	}

	// Note: Deployment still references the deleted job agent
	// This is expected behavior - deployments keep their references
	// but jobs won't be created when the agent doesn't exist
	deployment, _ = engine.Workspace().Deployments().Get(deploymentID)
	if *deployment.JobAgentId != jobAgentID {
		t.Fatal("deployment should still reference the job agent ID")
	}
}

func TestEngine_JobAgentTypes(t *testing.T) {
	testCases := []struct {
		name      string
		agentType string
	}{
		{"kubernetes", "kubernetes"},
		{"docker", "docker"},
		{"github-actions", "github-actions"},
		{"gitlab-ci", "gitlab-ci"},
		{"jenkins", "jenkins"},
		{"custom-agent", "custom-agent"},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			engine := integration.NewTestWorkspace(t)
			ctx := context.Background()

			ja := c.NewJobAgent(engine.Workspace().ID)
			ja.WorkspaceId = engine.Workspace().ID
			ja.Name = tc.name
			ja.Type = tc.agentType

			engine.PushEvent(ctx, handler.JobAgentCreate, ja)

			retrievedJa, exists := engine.Workspace().JobAgents().Get(ja.Id)
			if !exists {
				t.Fatalf("job agent %s not found", ja.Id)
			}

			if retrievedJa.Type != tc.agentType {
				t.Fatalf("job agent type mismatch: got %s, want %s", retrievedJa.Type, tc.agentType)
			}
		})
	}
}

func TestEngine_JobAgentSharedAcrossMultipleDeployments(t *testing.T) {
	jobAgentID := "shared-agent"
	deploymentID1 := "deployment-1"
	deploymentID2 := "deployment-2"
	deploymentID3 := "deployment-3"

	engine := integration.NewTestWorkspace(
		t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID),
			integration.JobAgentName("Shared Agent"),
			integration.JobAgentType("kubernetes"),
		),
		integration.WithSystem(
			integration.SystemName("test-system"),
			integration.WithDeployment(
				integration.DeploymentID(deploymentID1),
				integration.DeploymentName("deployment-1"),
				integration.DeploymentJobAgent(jobAgentID),
				integration.DeploymentCelResourceSelector("true"),
				integration.WithDeploymentVersion(
					integration.DeploymentVersionTag("v1.0.0"),
				),
			),
			integration.WithDeployment(
				integration.DeploymentID(deploymentID2),
				integration.DeploymentName("deployment-2"),
				integration.DeploymentJobAgent(jobAgentID),
				integration.DeploymentCelResourceSelector("true"),
				integration.WithDeploymentVersion(
					integration.DeploymentVersionTag("v1.0.0"),
				),
			),
			integration.WithDeployment(
				integration.DeploymentID(deploymentID3),
				integration.DeploymentName("deployment-3"),
				integration.DeploymentJobAgent(jobAgentID),
				integration.DeploymentCelResourceSelector("true"),
				integration.WithDeploymentVersion(
					integration.DeploymentVersionTag("v1.0.0"),
				),
			),
			integration.WithEnvironment(
				integration.EnvironmentName("production"),
			),
		),
		integration.WithResource(
			integration.ResourceName("resource-1"),
		),
	)

	// Verify all deployments use the same job agent
	d1, _ := engine.Workspace().Deployments().Get(deploymentID1)
	d2, _ := engine.Workspace().Deployments().Get(deploymentID2)
	d3, _ := engine.Workspace().Deployments().Get(deploymentID3)

	if *d1.JobAgentId != jobAgentID {
		t.Fatalf("deployment 1 should use agent %s, got %s", jobAgentID, *d1.JobAgentId)
	}
	if *d2.JobAgentId != jobAgentID {
		t.Fatalf("deployment 2 should use agent %s, got %s", jobAgentID, *d2.JobAgentId)
	}
	if *d3.JobAgentId != jobAgentID {
		t.Fatalf("deployment 3 should use agent %s, got %s", jobAgentID, *d3.JobAgentId)
	}

	// Verify all jobs use the same job agent
	pendingJobs := engine.Workspace().Jobs().GetPending()
	if len(pendingJobs) != 3 {
		t.Fatalf("expected 3 pending jobs, got %d", len(pendingJobs))
	}

	for _, job := range pendingJobs {
		if job.JobAgentId != jobAgentID {
			t.Fatalf("job should use agent %s, got %s", jobAgentID, job.JobAgentId)
		}
	}
}

func TestEngine_JobAgentEmptyConfig(t *testing.T) {
	jobAgentID := "job-agent-empty-config"

	engine := integration.NewTestWorkspace(t)
	ctx := context.Background()

	// Create job agent with nil/empty config
	ja := &oapi.JobAgent{
		Id:          jobAgentID,
		WorkspaceId: engine.Workspace().ID,
		Name:        "Empty Config Agent",
		Type:        "test",
		Config:      c.CustomJobAgentConfig(nil),
	}

	engine.PushEvent(ctx, handler.JobAgentCreate, ja)

	// Verify job agent was created
	retrievedJa, exists := engine.Workspace().JobAgents().Get(jobAgentID)
	if !exists {
		t.Fatal("job agent not found")
	}

	// Verify empty config doesn't cause issues
	config, err := retrievedJa.Config.AsCustomJobAgentConfig()
	if err != nil {
		t.Fatalf("failed to get job agent config: %v", err)
	}
	if len(config.AdditionalProperties) > 0 {
		t.Fatalf("expected empty config, got %v", config)
	}
}

func TestEngine_JobAgentNameUniqueness(t *testing.T) {
	// Note: Job agent names are NOT enforced to be unique in the engine
	// This test verifies that multiple agents can have the same name (by ID is what matters)
	engine := integration.NewTestWorkspace(t)
	ctx := context.Background()

	sameName := "Duplicate Name Agent"

	ja1 := c.NewJobAgent(engine.Workspace().ID)
	ja1.WorkspaceId = engine.Workspace().ID
	ja1.Name = sameName
	ja1.Type = "kubernetes"

	ja2 := c.NewJobAgent(engine.Workspace().ID)
	ja2.WorkspaceId = engine.Workspace().ID
	ja2.Name = sameName
	ja2.Type = "docker"

	engine.PushEvent(ctx, handler.JobAgentCreate, ja1)
	engine.PushEvent(ctx, handler.JobAgentCreate, ja2)

	// Verify both agents exist with the same name but different IDs
	allAgents := engine.Workspace().JobAgents().Items()
	if len(allAgents) != 2 {
		t.Fatalf("expected 2 job agents, got %d", len(allAgents))
	}

	retrievedJa1, _ := engine.Workspace().JobAgents().Get(ja1.Id)
	retrievedJa2, _ := engine.Workspace().JobAgents().Get(ja2.Id)

	if retrievedJa1.Name != sameName || retrievedJa2.Name != sameName {
		t.Fatal("both agents should have the same name")
	}

	if retrievedJa1.Id == retrievedJa2.Id {
		t.Fatal("agents should have different IDs")
	}
}
