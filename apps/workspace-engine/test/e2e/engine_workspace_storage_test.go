package e2e

import (
	"context"
	"os"
	"testing"
	"workspace-engine/pkg/workspace"
	"workspace-engine/pkg/workspace/kafka"
	"workspace-engine/test/integration"

	"github.com/google/uuid"
)

func TestEngine_WorkspaceStorage_BasicSaveLoadRoundtrip(t *testing.T) {
	ctx := context.Background()
	
	resource1Id := uuid.New().String()
	resource2Id := uuid.New().String()
	systemId := uuid.New().String()
	jobAgentId := uuid.New().String()
	deploymentId := uuid.New().String()
	deploymentVersionId := uuid.New().String()
	env1Id := uuid.New().String()
	env2Id := uuid.New().String()
	
	// Create workspace and populate using integration helpers
	engine := integration.NewTestWorkspace(t,
		integration.WithResource(
			integration.ResourceID(resource1Id),
			integration.ResourceName("resource-1"),
		),
		integration.WithResource(
			integration.ResourceID(resource2Id),
			integration.ResourceName("resource-2"),
		),
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentId),
			integration.JobAgentName("test-job-agent"),
		),
		integration.WithSystem(
			integration.SystemID(systemId),
			integration.SystemName("test-system"),
			integration.WithDeployment(
				integration.DeploymentID(deploymentId),
				integration.DeploymentName("deployment-1"),
				integration.DeploymentJobAgent(jobAgentId),
				integration.WithDeploymentVersion(
					integration.DeploymentVersionID(deploymentVersionId),
					integration.DeploymentVersionTag("v1.0.0"),
				),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(env1Id),
				integration.EnvironmentName("env-prod"),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(env2Id),
				integration.EnvironmentName("env-dev"),
			),
		),
	)
	
	ws := engine.Workspace()
	workspaceID := ws.ID
	
	// Add some Kafka progress to verify it's preserved
	ws.KafkaProgress[kafka.TopicPartition{Topic: "events", Partition: 0}] = kafka.KafkaProgress{
		LastApplied:   100,
		LastTimestamp: 1234567890,
	}
	ws.KafkaProgress[kafka.TopicPartition{Topic: "events", Partition: 1}] = kafka.KafkaProgress{
		LastApplied:   200,
		LastTimestamp: 1234567900,
	}
	
	// Capture original state counts
	originalResources := len(ws.Resources().Items())
	originalDeployments := len(ws.Deployments().Items())
	originalSystems := len(ws.Systems().Items())
	originalJobAgents := len(ws.JobAgents().Items())
	originalEnvironments := len(ws.Environments().Items())
	originalDeploymentVersions := len(ws.DeploymentVersions().Items())
	
	// Create temporary directory for storage
	tempDir, err := os.MkdirTemp("", "workspace-storage-test-*")
	if err != nil {
		t.Fatalf("failed to create temp directory: %v", err)
	}
	defer os.RemoveAll(tempDir)
	
	// Save workspace to storage
	storage := workspace.NewFileStorage(tempDir)
	if err := ws.SaveToStorage(ctx, storage, "workspace.gob"); err != nil {
		t.Fatalf("failed to save workspace: %v", err)
	}
	
	// Load into new workspace
	newWs := workspace.New(workspaceID)
	if err := newWs.LoadFromStorage(ctx, storage, "workspace.gob"); err != nil {
		t.Fatalf("failed to load workspace: %v", err)
	}
	
	// Verify workspace ID
	if newWs.ID != workspaceID {
		t.Errorf("workspace ID mismatch: expected %s, got %s", workspaceID, newWs.ID)
	}
	
	// Verify KafkaProgress
	if len(newWs.KafkaProgress) != 2 {
		t.Errorf("expected 2 KafkaProgress entries, got %d", len(newWs.KafkaProgress))
	}
	
	tp0 := kafka.TopicPartition{Topic: "events", Partition: 0}
	if progress, ok := newWs.KafkaProgress[tp0]; !ok {
		t.Error("KafkaProgress for partition 0 not found")
	} else {
		if progress.LastApplied != 100 {
			t.Errorf("partition 0 LastApplied: expected 100, got %d", progress.LastApplied)
		}
		if progress.LastTimestamp != 1234567890 {
			t.Errorf("partition 0 LastTimestamp: expected 1234567890, got %d", progress.LastTimestamp)
		}
	}
	
	// Verify entity counts
	if len(newWs.Resources().Items()) != originalResources {
		t.Errorf("resources count mismatch: expected %d, got %d", originalResources, len(newWs.Resources().Items()))
	}
	
	if len(newWs.Deployments().Items()) != originalDeployments {
		t.Errorf("deployments count mismatch: expected %d, got %d", originalDeployments, len(newWs.Deployments().Items()))
	}
	
	if len(newWs.Systems().Items()) != originalSystems {
		t.Errorf("systems count mismatch: expected %d, got %d", originalSystems, len(newWs.Systems().Items()))
	}
	
	if len(newWs.JobAgents().Items()) != originalJobAgents {
		t.Errorf("job agents count mismatch: expected %d, got %d", originalJobAgents, len(newWs.JobAgents().Items()))
	}
	
	if len(newWs.Environments().Items()) != originalEnvironments {
		t.Errorf("environments count mismatch: expected %d, got %d", originalEnvironments, len(newWs.Environments().Items()))
	}
	
	if len(newWs.DeploymentVersions().Items()) != originalDeploymentVersions {
		t.Errorf("deployment versions count mismatch: expected %d, got %d", originalDeploymentVersions, len(newWs.DeploymentVersions().Items()))
	}
}

func TestEngine_WorkspaceStorage_EmptyWorkspace(t *testing.T) {
	ctx := context.Background()
	
	// Create empty workspace using integration helpers
	workspaceID := "test-empty-workspace"
	engine := integration.NewTestWorkspace(t,
		integration.WithWorkspaceID(workspaceID),
	)
	
	ws := engine.Workspace()
	
	// Create temporary directory for storage
	tempDir, err := os.MkdirTemp("", "workspace-storage-test-*")
	if err != nil {
		t.Fatalf("failed to create temp directory: %v", err)
	}
	defer os.RemoveAll(tempDir)
	
	// Save empty workspace
	storage := workspace.NewFileStorage(tempDir)
	if err := ws.SaveToStorage(ctx, storage, "empty.gob"); err != nil {
		t.Fatalf("failed to save empty workspace: %v", err)
	}
	
	// Load into new workspace
	newWs := workspace.New(workspaceID)
	if err := newWs.LoadFromStorage(ctx, storage, "empty.gob"); err != nil {
		t.Fatalf("failed to load empty workspace: %v", err)
	}
	
	// Verify it's still empty
	if newWs.ID != workspaceID {
		t.Errorf("workspace ID mismatch: expected %s, got %s", workspaceID, newWs.ID)
	}
	
	if len(newWs.Resources().Items()) != 0 {
		t.Errorf("expected 0 resources, got %d", len(newWs.Resources().Items()))
	}
	
	if len(newWs.Deployments().Items()) != 0 {
		t.Errorf("expected 0 deployments, got %d", len(newWs.Deployments().Items()))
	}
}

func TestEngine_WorkspaceStorage_MultipleResources(t *testing.T) {
	ctx := context.Background()
	
	resource1Id := uuid.New().String()
	resource2Id := uuid.New().String()
	resource3Id := uuid.New().String()
	systemId := uuid.New().String()
	
	// Create workspace and populate using integration helpers
	engine := integration.NewTestWorkspace(t,
		integration.WithSystem(
			integration.SystemID(systemId),
			integration.SystemName("test-system"),
		),
		integration.WithResource(
			integration.ResourceID(resource1Id),
			integration.ResourceName("resource-1"),
			integration.ResourceConfig(map[string]interface{}{"type": "server"}),
		),
		integration.WithResource(
			integration.ResourceID(resource2Id),
			integration.ResourceName("resource-2"),
			integration.ResourceConfig(map[string]interface{}{"type": "database"}),
		),
		integration.WithResource(
			integration.ResourceID(resource3Id),
			integration.ResourceName("resource-3"),
			integration.ResourceConfig(map[string]interface{}{"type": "cache"}),
		),
	)
	
	ws := engine.Workspace()
	workspaceID := ws.ID
	
	// Track resources
	resourceIds := []string{resource1Id, resource2Id, resource3Id}
	
	// Verify resources exist
	allResources := ws.Resources().Items()
	if len(allResources) != 3 {
		t.Fatalf("expected 3 resources, got %d", len(allResources))
	}
	
	// Create temporary directory for storage
	tempDir, err := os.MkdirTemp("", "workspace-storage-test-*")
	if err != nil {
		t.Fatalf("failed to create temp directory: %v", err)
	}
	defer os.RemoveAll(tempDir)
	
	// Save workspace
	storage := workspace.NewFileStorage(tempDir)
	if err := ws.SaveToStorage(ctx, storage, "workspace.gob"); err != nil {
		t.Fatalf("failed to save workspace: %v", err)
	}
	
	// Load into new workspace
	newWs := workspace.New(workspaceID)
	if err := newWs.LoadFromStorage(ctx, storage, "workspace.gob"); err != nil {
		t.Fatalf("failed to load workspace: %v", err)
	}
	
	// Verify all resources are preserved with their config
	for _, resourceId := range resourceIds {
		restoredResource, ok := newWs.Resources().Get(resourceId)
		if !ok {
			t.Errorf("resource %s not found after restore", resourceId)
			continue
		}
		
		// Verify config is preserved
		if restoredResource.Config == nil {
			t.Errorf("resource %s: config is nil after restore", resourceId)
		}
	}
	
	// Verify resource count
	restoredResources := newWs.Resources().Items()
	if len(restoredResources) != 3 {
		t.Errorf("expected 3 resources after restore, got %d", len(restoredResources))
	}
}

func TestEngine_WorkspaceStorage_ComplexEntities(t *testing.T) {
	ctx := context.Background()
	
	sysId := uuid.New().String()
	jobAgentId := uuid.New().String()
	deploymentId := uuid.New().String()
	deploymentVersionId := uuid.New().String()
	env1Id := uuid.New().String()
	env2Id := uuid.New().String()
	resource1Id := uuid.New().String()
	resource2Id := uuid.New().String()
	policyId := uuid.New().String()
	
	// Create workspace and populate using integration helpers
	engine := integration.NewTestWorkspace(t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentId),
			integration.JobAgentName("test-agent"),
		),
		integration.WithSystem(
			integration.SystemID(sysId),
			integration.SystemName("complex-system"),
			integration.WithDeployment(
				integration.DeploymentID(deploymentId),
				integration.DeploymentName("api-service"),
				integration.DeploymentJobAgent(jobAgentId),
				integration.WithDeploymentVersion(
					integration.DeploymentVersionID(deploymentVersionId),
					integration.DeploymentVersionTag("v1.0.0"),
				),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(env1Id),
				integration.EnvironmentName("production"),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(env2Id),
				integration.EnvironmentName("staging"),
			),
		),
		integration.WithResource(
			integration.ResourceID(resource1Id),
			integration.ResourceName("resource-1"),
		),
		integration.WithResource(
			integration.ResourceID(resource2Id),
			integration.ResourceName("resource-2"),
		),
		integration.WithPolicy(
			integration.PolicyID(policyId),
			integration.PolicyName("approval-policy"),
		),
	)
	
	ws := engine.Workspace()
	workspaceID := ws.ID
	
	// Create temporary directory for storage
	tempDir, err := os.MkdirTemp("", "workspace-storage-test-*")
	if err != nil {
		t.Fatalf("failed to create temp directory: %v", err)
	}
	defer os.RemoveAll(tempDir)
	
	// Save workspace
	storage := workspace.NewFileStorage(tempDir)
	if err := ws.SaveToStorage(ctx, storage, "workspace.gob"); err != nil {
		t.Fatalf("failed to save workspace: %v", err)
	}
	
	// Load into new workspace
	newWs := workspace.New(workspaceID)
	if err := newWs.LoadFromStorage(ctx, storage, "workspace.gob"); err != nil {
		t.Fatalf("failed to load workspace: %v", err)
	}
	
	// Verify system
	restoredSys, ok := newWs.Systems().Get(sysId)
	if !ok {
		t.Fatal("system not found in restored workspace")
	}
	if restoredSys.Name != "complex-system" {
		t.Errorf("system name mismatch: expected 'complex-system', got %s", restoredSys.Name)
	}
	
	// Verify deployment
	restoredDeployment, ok := newWs.Deployments().Get(deploymentId)
	if !ok {
		t.Fatal("deployment not found in restored workspace")
	}
	if restoredDeployment.Name != "api-service" {
		t.Errorf("deployment name mismatch: expected 'api-service', got %s", restoredDeployment.Name)
	}
	
	// Verify job agent
	restoredJobAgent, ok := newWs.JobAgents().Get(jobAgentId)
	if !ok {
		t.Fatal("job agent not found in restored workspace")
	}
	if restoredJobAgent.Name != "test-agent" {
		t.Errorf("job agent name mismatch: expected 'test-agent', got %s", restoredJobAgent.Name)
	}
	
	// Verify environments
	environments := newWs.Environments().Items()
	if len(environments) != 2 {
		t.Errorf("expected 2 environments, got %d", len(environments))
	}
	
	// Verify resources
	resources := newWs.Resources().Items()
	if len(resources) != 2 {
		t.Errorf("expected 2 resources, got %d", len(resources))
	}
	
	// Verify policies
	policies := newWs.Policies().Items()
	if len(policies) != 1 {
		t.Errorf("expected 1 policy, got %d", len(policies))
	}
}

func TestEngine_WorkspaceStorage_MultipleWorkspaces(t *testing.T) {
	ctx := context.Background()
	
	// Create temporary directory for storage
	tempDir, err := os.MkdirTemp("", "workspace-storage-test-*")
	if err != nil {
		t.Fatalf("failed to create temp directory: %v", err)
	}
	defer os.RemoveAll(tempDir)
	
	storage := workspace.NewFileStorage(tempDir)
	
	// Create and save multiple workspaces
	workspaceIDs := []string{"workspace-1", "workspace-2", "workspace-3"}
	
	for _, wsID := range workspaceIDs {
		engine := integration.NewTestWorkspace(t,
			integration.WithWorkspaceID(wsID),
		)
		
		ws := engine.Workspace()
		
		// Add some unique KafkaProgress for each workspace
		ws.KafkaProgress[kafka.TopicPartition{Topic: "events", Partition: 0}] = kafka.KafkaProgress{
			LastApplied:   int64(len(wsID)), // Use length as unique value
			LastTimestamp: 1234567890,
		}
		
		if err := ws.SaveToStorage(ctx, storage, wsID+".gob"); err != nil {
			t.Fatalf("failed to save workspace %s: %v", wsID, err)
		}
	}
	
	// Load each workspace and verify
	for _, wsID := range workspaceIDs {
		newWs := workspace.New(wsID)
		if err := newWs.LoadFromStorage(ctx, storage, wsID+".gob"); err != nil {
			t.Fatalf("failed to load workspace %s: %v", wsID, err)
		}
		
		if newWs.ID != wsID {
			t.Errorf("workspace ID mismatch: expected %s, got %s", wsID, newWs.ID)
		}
		
		tp := kafka.TopicPartition{Topic: "events", Partition: 0}
		if progress, ok := newWs.KafkaProgress[tp]; !ok {
			t.Errorf("KafkaProgress not found for workspace %s", wsID)
		} else {
			expectedValue := int64(len(wsID))
			if progress.LastApplied != expectedValue {
				t.Errorf("workspace %s: expected LastApplied %d, got %d", wsID, expectedValue, progress.LastApplied)
			}
		}
	}
}

func TestEngine_WorkspaceStorage_EnvironmentReleaseTargetsAndJobs(t *testing.T) {
	ctx := context.Background()
	
	systemId := uuid.New().String()
	jobAgentId := uuid.New().String()
	deploymentId := uuid.New().String()
	deploymentVersionId := uuid.New().String()
	env1Id := uuid.New().String()
	env2Id := uuid.New().String()
	resource1Id := uuid.New().String()
	resource2Id := uuid.New().String()
	
	// Create workspace with complex setup including jobs
	engine := integration.NewTestWorkspace(t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentId),
			integration.JobAgentName("test-agent"),
		),
		integration.WithSystem(
			integration.SystemID(systemId),
			integration.SystemName("test-system"),
			integration.WithDeployment(
				integration.DeploymentID(deploymentId),
				integration.DeploymentName("api-service"),
				integration.DeploymentJobAgent(jobAgentId),
				integration.WithDeploymentVersion(
					integration.DeploymentVersionID(deploymentVersionId),
					integration.DeploymentVersionTag("v1.0.0"),
				),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(env1Id),
				integration.EnvironmentName("production"),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(env2Id),
				integration.EnvironmentName("staging"),
			),
		),
		integration.WithResource(
			integration.ResourceID(resource1Id),
			integration.ResourceName("server-1"),
		),
		integration.WithResource(
			integration.ResourceID(resource2Id),
			integration.ResourceName("server-2"),
		),
	)
	
	ws := engine.Workspace()
	workspaceID := ws.ID
	
	// Wait for release targets to be computed
	releaseTargets, err := ws.ReleaseTargets().Items(ctx)
	if err != nil {
		t.Fatalf("failed to get release targets: %v", err)
	}
	
	// Should have 4 release targets: 1 deployment * 2 environments * 2 resources
	expectedReleaseTargets := 4
	if len(releaseTargets) != expectedReleaseTargets {
		t.Fatalf("expected %d release targets, got %d", expectedReleaseTargets, len(releaseTargets))
	}
	
	// Get jobs - should have been created by deployment version
	allJobs := ws.Jobs().Items()
	if len(allJobs) != expectedReleaseTargets {
		t.Fatalf("expected %d jobs, got %d", expectedReleaseTargets, len(allJobs))
	}
	
	// Track job IDs and their statuses
	jobIdsAndStatuses := make(map[string]string)
	for jobId, job := range allJobs {
		jobIdsAndStatuses[jobId] = string(job.Status)
	}
	
	// Track release target keys
	releaseTargetKeys := make(map[string]bool)
	for key := range releaseTargets {
		releaseTargetKeys[key] = true
	}
	
	// Create temporary directory for storage
	tempDir, err := os.MkdirTemp("", "workspace-storage-test-*")
	if err != nil {
		t.Fatalf("failed to create temp directory: %v", err)
	}
	defer os.RemoveAll(tempDir)
	
	// Save workspace to storage
	storage := workspace.NewFileStorage(tempDir)
	if err := ws.SaveToStorage(ctx, storage, "workspace.gob"); err != nil {
		t.Fatalf("failed to save workspace: %v", err)
	}
	
	// Load into new workspace
	newWs := workspace.New(workspaceID)
	if err := newWs.LoadFromStorage(ctx, storage, "workspace.gob"); err != nil {
		t.Fatalf("failed to load workspace: %v", err)
	}
	
	// Verify environments
	restoredEnv1, ok := newWs.Environments().Get(env1Id)
	if !ok {
		t.Fatal("environment 'production' not found after restore")
	}
	if restoredEnv1.Name != "production" {
		t.Errorf("environment name mismatch: expected 'production', got %s", restoredEnv1.Name)
	}
	
	restoredEnv2, ok := newWs.Environments().Get(env2Id)
	if !ok {
		t.Fatal("environment 'staging' not found after restore")
	}
	if restoredEnv2.Name != "staging" {
		t.Errorf("environment name mismatch: expected 'staging', got %s", restoredEnv2.Name)
	}
	
	// Verify release targets
	restoredReleaseTargets, err := newWs.ReleaseTargets().Items(ctx)
	if err != nil {
		t.Fatalf("failed to get restored release targets: %v", err)
	}
	
	if len(restoredReleaseTargets) != expectedReleaseTargets {
		t.Errorf("release targets count mismatch: expected %d, got %d", expectedReleaseTargets, len(restoredReleaseTargets))
	}
	
	// Verify each original release target key exists in restored targets
	for key := range releaseTargetKeys {
		if _, ok := restoredReleaseTargets[key]; !ok {
			t.Errorf("release target with key %s not found after restore", key)
		}
	}
	
	// Verify release target structure
	for key, rt := range restoredReleaseTargets {
		if rt.DeploymentId != deploymentId {
			t.Errorf("release target %s: deployment ID mismatch, got %s", key, rt.DeploymentId)
		}
		if rt.EnvironmentId != env1Id && rt.EnvironmentId != env2Id {
			t.Errorf("release target %s: unexpected environment ID %s", key, rt.EnvironmentId)
		}
		if rt.ResourceId != resource1Id && rt.ResourceId != resource2Id {
			t.Errorf("release target %s: unexpected resource ID %s", key, rt.ResourceId)
		}
	}
	
	// Verify jobs
	restoredJobs := newWs.Jobs().Items()
	if len(restoredJobs) != len(allJobs) {
		t.Errorf("jobs count mismatch: expected %d, got %d", len(allJobs), len(restoredJobs))
	}
	
	// Verify each original job exists with correct status
	for jobId, expectedStatus := range jobIdsAndStatuses {
		restoredJob, ok := restoredJobs[jobId]
		if !ok {
			t.Errorf("job %s not found after restore", jobId)
			continue
		}
		
		if string(restoredJob.Status) != expectedStatus {
			t.Errorf("job %s: status mismatch, expected %s, got %s", jobId, expectedStatus, restoredJob.Status)
		}
		
		// Verify job has correct job agent
		if restoredJob.JobAgentId != jobAgentId {
			t.Errorf("job %s: job agent mismatch, expected %s, got %s", jobId, jobAgentId, restoredJob.JobAgentId)
		}
		
		// Verify job has a release ID
		if restoredJob.ReleaseId == "" {
			t.Errorf("job %s: release ID is empty", jobId)
		}
	}
	
	// Verify pending jobs specifically
	pendingJobs := newWs.Jobs().GetPending()
	if len(pendingJobs) != expectedReleaseTargets {
		t.Errorf("expected %d pending jobs after restore, got %d", expectedReleaseTargets, len(pendingJobs))
	}
	
	// Verify job agent exists
	restoredJobAgent, ok := newWs.JobAgents().Get(jobAgentId)
	if !ok {
		t.Fatal("job agent not found after restore")
	}
	if restoredJobAgent.Name != "test-agent" {
		t.Errorf("job agent name mismatch: expected 'test-agent', got %s", restoredJobAgent.Name)
	}
}

