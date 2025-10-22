package e2e

import (
	"context"
	"errors"
	"os"
	"strings"
	"sync"
	"testing"
	"time"
	"workspace-engine/pkg/oapi"
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

func TestEngine_WorkspaceStorage_JobsWithAllStatuses(t *testing.T) {
	ctx := context.Background()

	systemId := uuid.New().String()
	jobAgentId := uuid.New().String()
	deploymentId := uuid.New().String()
	deploymentVersionId := uuid.New().String()
	envId := uuid.New().String()
	resourceId := uuid.New().String()

	// Create workspace with deployment that generates jobs
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
				integration.DeploymentName("test-deployment"),
				integration.DeploymentJobAgent(jobAgentId),
				integration.WithDeploymentVersion(
					integration.DeploymentVersionID(deploymentVersionId),
					integration.DeploymentVersionTag("v1.0.0"),
				),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(envId),
				integration.EnvironmentName("test-env"),
			),
		),
		integration.WithResource(
			integration.ResourceID(resourceId),
			integration.ResourceName("test-resource"),
		),
	)

	ws := engine.Workspace()
	workspaceID := ws.ID

	// Get all jobs created by the deployment version
	allJobs := ws.Jobs().Items()
	if len(allJobs) == 0 {
		t.Fatal("expected at least one job to be created")
	}

	// All job statuses to test
	allStatuses := []oapi.JobStatus{
		oapi.Pending,
		oapi.InProgress,
		oapi.Successful,
		oapi.Cancelled,
		oapi.Skipped,
		oapi.Failure,
		oapi.ActionRequired,
		oapi.InvalidJobAgent,
		oapi.InvalidIntegration,
		oapi.ExternalRunNotFound,
	}

	// Manually set different statuses on jobs
	// We'll modify the first job to have each status, creating new jobs as needed
	jobsByStatus := make(map[oapi.JobStatus]string)
	jobIndex := 0

	for _, status := range allStatuses {
		var jobId string

		if jobIndex < len(allJobs) {
			// Use existing job
			for id := range allJobs {
				jobId = id
				break
			}
			delete(allJobs, jobId)
		} else {
			// Create new job
			jobId = uuid.New().String()
			releaseId := uuid.New().String()

			job := &oapi.Job{
				Id:             jobId,
				Status:         status,
				JobAgentId:     jobAgentId,
				ReleaseId:      releaseId,
				CreatedAt:      time.Now(),
				UpdatedAt:      time.Now(),
				JobAgentConfig: make(map[string]interface{}),
				Metadata:       make(map[string]string),
			}
			ws.Jobs().Upsert(ctx, job)
		}

		// Update job status
		job, _ := ws.Jobs().Get(jobId)
		job.Status = status
		ws.Jobs().Upsert(ctx, job)
		jobsByStatus[status] = jobId
		jobIndex++
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

	// Verify all job statuses are preserved
	for status, jobId := range jobsByStatus {
		restoredJob, ok := newWs.Jobs().Get(jobId)
		if !ok {
			t.Errorf("job %s with status %s not found after restore", jobId, status)
			continue
		}

		if restoredJob.Status != status {
			t.Errorf("job %s: expected status %s, got %s", jobId, status, restoredJob.Status)
		}
	}
}

func TestEngine_WorkspaceStorage_TimestampsAndTimeZones(t *testing.T) {
	ctx := context.Background()

	systemId := uuid.New().String()
	jobAgentId := uuid.New().String()
	deploymentId := uuid.New().String()
	deploymentVersionId := uuid.New().String()
	envId := uuid.New().String()
	resourceId := uuid.New().String()

	// Create workspace with jobs
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
				integration.DeploymentName("test-deployment"),
				integration.DeploymentJobAgent(jobAgentId),
				integration.WithDeploymentVersion(
					integration.DeploymentVersionID(deploymentVersionId),
					integration.DeploymentVersionTag("v1.0.0"),
				),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(envId),
				integration.EnvironmentName("test-env"),
			),
		),
		integration.WithResource(
			integration.ResourceID(resourceId),
			integration.ResourceName("test-resource"),
		),
	)

	ws := engine.Workspace()
	workspaceID := ws.ID

	// Define various timestamps with different timezones and edge cases
	utcLoc := time.UTC
	estLoc, _ := time.LoadLocation("America/New_York")
	pstLoc, _ := time.LoadLocation("America/Los_Angeles")

	testTimestamps := []struct {
		name      string
		createdAt time.Time
		updatedAt time.Time
		startedAt *time.Time
		completed *time.Time
	}{
		{
			name:      "utc-with-nanos",
			createdAt: time.Date(2023, 5, 15, 10, 30, 45, 123456789, utcLoc),
			updatedAt: time.Date(2023, 5, 15, 11, 30, 45, 987654321, utcLoc),
			startedAt: ptrTime(time.Date(2023, 5, 15, 10, 31, 0, 555555555, utcLoc)),
			completed: ptrTime(time.Date(2023, 5, 15, 11, 30, 0, 999999999, utcLoc)),
		},
		{
			name:      "est-timezone",
			createdAt: time.Date(2023, 6, 1, 9, 0, 0, 0, estLoc),
			updatedAt: time.Date(2023, 6, 1, 10, 0, 0, 0, estLoc),
			startedAt: ptrTime(time.Date(2023, 6, 1, 9, 5, 0, 0, estLoc)),
			completed: nil,
		},
		{
			name:      "pst-timezone",
			createdAt: time.Date(2023, 7, 4, 8, 0, 0, 0, pstLoc),
			updatedAt: time.Date(2023, 7, 4, 9, 0, 0, 0, pstLoc),
			startedAt: nil,
			completed: nil,
		},
		{
			name:      "far-future",
			createdAt: time.Date(2099, 12, 31, 23, 59, 59, 0, utcLoc),
			updatedAt: time.Date(2099, 12, 31, 23, 59, 59, 0, utcLoc),
			startedAt: nil,
			completed: nil,
		},
		{
			name:      "far-past",
			createdAt: time.Date(1970, 1, 1, 0, 0, 1, 0, utcLoc),
			updatedAt: time.Date(1970, 1, 1, 0, 0, 1, 0, utcLoc),
			startedAt: nil,
			completed: nil,
		},
	}

	jobTimestamps := make(map[string]struct {
		createdAt time.Time
		updatedAt time.Time
		startedAt *time.Time
		completed *time.Time
	})

	// Create jobs with specific timestamps
	for i, ts := range testTimestamps {
		jobId := uuid.New().String()
		releaseId := uuid.New().String()

		job := &oapi.Job{
			Id:             jobId,
			Status:         oapi.Pending,
			JobAgentId:     jobAgentId,
			ReleaseId:      releaseId,
			CreatedAt:      ts.createdAt,
			UpdatedAt:      ts.updatedAt,
			StartedAt:      ts.startedAt,
			CompletedAt:    ts.completed,
			JobAgentConfig: make(map[string]interface{}),
			Metadata:       map[string]string{"test": ts.name, "index": string(rune('0' + i))},
		}

		ws.Jobs().Upsert(ctx, job)
		jobTimestamps[jobId] = struct {
			createdAt time.Time
			updatedAt time.Time
			startedAt *time.Time
			completed *time.Time
		}{
			createdAt: ts.createdAt,
			updatedAt: ts.updatedAt,
			startedAt: ts.startedAt,
			completed: ts.completed,
		}
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

	// Verify all timestamps are preserved exactly
	for jobId, expectedTimestamps := range jobTimestamps {
		restoredJob, ok := newWs.Jobs().Get(jobId)
		if !ok {
			t.Errorf("job %s not found after restore", jobId)
			continue
		}

		// Check CreatedAt
		if !restoredJob.CreatedAt.Equal(expectedTimestamps.createdAt) {
			t.Errorf("job %s: CreatedAt mismatch, expected %v, got %v",
				jobId, expectedTimestamps.createdAt, restoredJob.CreatedAt)
		}

		// Verify nanoseconds are preserved
		if restoredJob.CreatedAt.Nanosecond() != expectedTimestamps.createdAt.Nanosecond() {
			t.Errorf("job %s: CreatedAt nanoseconds not preserved, expected %d, got %d",
				jobId, expectedTimestamps.createdAt.Nanosecond(), restoredJob.CreatedAt.Nanosecond())
		}

		// Check UpdatedAt
		if !restoredJob.UpdatedAt.Equal(expectedTimestamps.updatedAt) {
			t.Errorf("job %s: UpdatedAt mismatch, expected %v, got %v",
				jobId, expectedTimestamps.updatedAt, restoredJob.UpdatedAt)
		}

		// Check StartedAt
		if expectedTimestamps.startedAt == nil {
			if restoredJob.StartedAt != nil {
				t.Errorf("job %s: StartedAt should be nil, got %v", jobId, *restoredJob.StartedAt)
			}
		} else {
			if restoredJob.StartedAt == nil {
				t.Errorf("job %s: StartedAt is nil, expected %v", jobId, *expectedTimestamps.startedAt)
			} else if !restoredJob.StartedAt.Equal(*expectedTimestamps.startedAt) {
				t.Errorf("job %s: StartedAt mismatch, expected %v, got %v",
					jobId, *expectedTimestamps.startedAt, *restoredJob.StartedAt)
			}
		}

		// Check CompletedAt
		if expectedTimestamps.completed == nil {
			if restoredJob.CompletedAt != nil {
				t.Errorf("job %s: CompletedAt should be nil, got %v", jobId, *restoredJob.CompletedAt)
			}
		} else {
			if restoredJob.CompletedAt == nil {
				t.Errorf("job %s: CompletedAt is nil, expected %v", jobId, *expectedTimestamps.completed)
			} else if !restoredJob.CompletedAt.Equal(*expectedTimestamps.completed) {
				t.Errorf("job %s: CompletedAt mismatch, expected %v, got %v",
					jobId, *expectedTimestamps.completed, *restoredJob.CompletedAt)
			}
		}
	}
}

func TestEngine_WorkspaceStorage_LoadFromNonExistentFile(t *testing.T) {
	ctx := context.Background()

	// Create temporary directory for storage
	tempDir, err := os.MkdirTemp("", "workspace-storage-test-*")
	if err != nil {
		t.Fatalf("failed to create temp directory: %v", err)
	}
	defer os.RemoveAll(tempDir)

	storage := workspace.NewFileStorage(tempDir)

	// Create a workspace directly
	workspaceID := uuid.New().String()
	ws := workspace.New(workspaceID)

	// Add some KafkaProgress to verify workspace has data
	ws.KafkaProgress[kafka.TopicPartition{Topic: "events", Partition: 0}] = kafka.KafkaProgress{
		LastApplied:   100,
		LastTimestamp: 1234567890,
	}

	// Attempt to load from non-existent file
	err = ws.LoadFromStorage(ctx, storage, "non-existent-file.gob")

	// Verify error is returned
	if err == nil {
		t.Fatal("expected error when loading from non-existent file, got nil")
	}

	// Verify error message indicates file not found
	errMsg := err.Error()
	if !strings.Contains(errMsg, "no such file") && !strings.Contains(errMsg, "failed to read") {
		t.Errorf("expected error message to indicate file not found, got: %s", errMsg)
	}

	// Verify workspace state remains intact (KafkaProgress not overwritten)
	if len(ws.KafkaProgress) != 1 {
		t.Errorf("workspace state may be corrupted: expected 1 KafkaProgress entry, got %d", len(ws.KafkaProgress))
	}
}

func TestEngine_WorkspaceStorage_SaveWithInvalidWorkspaceID(t *testing.T) {
	ctx := context.Background()

	testCases := []struct {
		name        string
		workspaceID string
		shouldSave  bool // whether we expect save to succeed or fail
	}{
		{
			name:        "empty-string",
			workspaceID: "",
			shouldSave:  true, // gob encoding should handle this
		},
		{
			name:        "path-separator",
			workspaceID: "workspace/../attack",
			shouldSave:  true, // filepath.Join handles this
		},
		{
			name:        "very-long-id",
			workspaceID: strings.Repeat("a", 1000),
			shouldSave:  true,
		},
		{
			name:        "special-characters",
			workspaceID: "workspace\n\t\r",
			shouldSave:  true, // These are just string characters
		},
		{
			name:        "unicode-emoji",
			workspaceID: "workspace-🚀-test",
			shouldSave:  true,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			// Create temporary directory for storage
			tempDir, err := os.MkdirTemp("", "workspace-storage-test-*")
			if err != nil {
				t.Fatalf("failed to create temp directory: %v", err)
			}
			defer os.RemoveAll(tempDir)

			storage := workspace.NewFileStorage(tempDir)

			// Create workspace directly without integration helpers to test edge case IDs
			// Use NewNoFlush to avoid database interactions
			ws := workspace.NewNoFlush(tc.workspaceID)

			// Attempt to save
			err = ws.SaveToStorage(ctx, storage, "workspace.gob")

			if tc.shouldSave {
				if err != nil {
					t.Errorf("expected save to succeed, got error: %v", err)
					return
				}

				// Attempt to load back
				newWs := workspace.NewNoFlush("temp-id")
				err = newWs.LoadFromStorage(ctx, storage, "workspace.gob")
				if err != nil {
					t.Errorf("failed to load workspace after save: %v", err)
					return
				}

				// Verify workspace ID matches
				if newWs.ID != tc.workspaceID {
					t.Errorf("workspace ID mismatch: expected %q, got %q", tc.workspaceID, newWs.ID)
				}
			} else {
				if err == nil {
					t.Error("expected save to fail, but it succeeded")
				}
			}
		})
	}
}

func TestEngine_WorkspaceStorage_ConcurrentSaveOperations(t *testing.T) {
	ctx := context.Background()

	// Create workspace with known state
	workspaceID := uuid.New().String()
	ws := workspace.New(workspaceID)

	// Add some KafkaProgress to verify workspace has data
	ws.KafkaProgress[kafka.TopicPartition{Topic: "events", Partition: 0}] = kafka.KafkaProgress{
		LastApplied:   100,
		LastTimestamp: 1234567890,
	}
	ws.KafkaProgress[kafka.TopicPartition{Topic: "events", Partition: 1}] = kafka.KafkaProgress{
		LastApplied:   200,
		LastTimestamp: 1234567900,
	}

	// Create temporary directory for storage
	tempDir, err := os.MkdirTemp("", "workspace-storage-test-*")
	if err != nil {
		t.Fatalf("failed to create temp directory: %v", err)
	}
	defer os.RemoveAll(tempDir)

	storage := workspace.NewFileStorage(tempDir)

	// Launch multiple goroutines that simultaneously save workspace to same file
	const numGoroutines = 10
	var wg sync.WaitGroup
	errChan := make(chan error, numGoroutines)

	for i := 0; i < numGoroutines; i++ {
		wg.Add(1)
		go func(index int) {
			defer wg.Done()

			// Each goroutine saves the workspace
			if err := ws.SaveToStorage(ctx, storage, "concurrent.gob"); err != nil {
				errChan <- err
			}
		}(i)
	}

	// Wait for all goroutines to complete
	wg.Wait()
	close(errChan)

	// Check if any goroutine had errors
	for err := range errChan {
		t.Errorf("concurrent save operation failed: %v", err)
	}

	// Load workspace and verify it's valid (not corrupted)
	newWs := workspace.New(workspaceID)
	if err := newWs.LoadFromStorage(ctx, storage, "concurrent.gob"); err != nil {
		t.Fatalf("failed to load workspace after concurrent saves: %v", err)
	}

	// Verify workspace has valid data
	if newWs.ID != workspaceID {
		t.Errorf("workspace ID mismatch: expected %s, got %s", workspaceID, newWs.ID)
	}

	// Verify KafkaProgress data
	if len(newWs.KafkaProgress) != 2 {
		t.Errorf("expected 2 KafkaProgress entries, got %d", len(newWs.KafkaProgress))
	}

	// Verify specific KafkaProgress values
	tp0 := kafka.TopicPartition{Topic: "events", Partition: 0}
	if progress, ok := newWs.KafkaProgress[tp0]; !ok {
		t.Error("KafkaProgress for partition 0 not found")
	} else if progress.LastApplied != 100 {
		t.Errorf("partition 0 LastApplied: expected 100, got %d", progress.LastApplied)
	}
}

func TestEngine_WorkspaceStorage_DiskFullScenario(t *testing.T) {
	ctx := context.Background()

	// Create workspace
	workspaceID := uuid.New().String()
	ws := workspace.New(workspaceID)

	// Add some KafkaProgress data
	ws.KafkaProgress[kafka.TopicPartition{Topic: "events", Partition: 0}] = kafka.KafkaProgress{
		LastApplied:   100,
		LastTimestamp: 1234567890,
	}

	// Create mock storage that simulates disk full
	failingStorage := &FailingStorageClient{shouldFailPut: true}

	// Attempt to save workspace
	err := ws.SaveToStorage(ctx, failingStorage, "workspace.gob")

	// Verify error is returned
	if err == nil {
		t.Fatal("expected error when disk is full, got nil")
	}

	// Verify error message indicates storage issue
	errMsg := err.Error()
	if !strings.Contains(errMsg, "no space left") && !strings.Contains(errMsg, "failed to write") {
		t.Errorf("expected error message to indicate storage issue, got: %s", errMsg)
	}

	// Test load failure scenario
	failingStorage.shouldFailGet = true
	newWs := workspace.New(workspaceID)
	err = newWs.LoadFromStorage(ctx, failingStorage, "workspace.gob")

	// Verify error is returned
	if err == nil {
		t.Fatal("expected error when reading fails, got nil")
	}

	// Verify error message indicates read failure
	errMsg = err.Error()
	if !strings.Contains(errMsg, "disk full") && !strings.Contains(errMsg, "failed to read") {
		t.Errorf("expected error message to indicate read failure, got: %s", errMsg)
	}
}

// Helper function to create pointer to time.Time
func ptrTime(t time.Time) *time.Time {
	return &t
}

// Mock storage client that simulates failures
type FailingStorageClient struct {
	shouldFailGet bool
	shouldFailPut bool
}

func (f *FailingStorageClient) Get(ctx context.Context, path string) ([]byte, error) {
	if f.shouldFailGet {
		return nil, errors.New("disk full: cannot read file")
	}
	return nil, errors.New("file not found")
}

func (f *FailingStorageClient) Put(ctx context.Context, path string, data []byte) error {
	if f.shouldFailPut {
		return errors.New("no space left on device")
	}
	return nil
}
