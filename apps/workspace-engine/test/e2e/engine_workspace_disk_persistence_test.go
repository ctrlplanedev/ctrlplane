package e2e

import (
	"context"
	"fmt"
	"os"
	"sync"
	"testing"
	"time"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace"
	"workspace-engine/test/integration"

	"github.com/google/uuid"
)

// These tests validate workspace persistence including:
// - Storage layer operations (file/GCS Put/Get)
// - Gob encoding/decoding
// - All entity fields are preserved (metadata, config, timestamps, etc.)
// Helper functions are in engine_workspace_persistence_helpers_test.go

func TestEngine_Persistence_BasicSaveLoadRoundtrip(t *testing.T) {
	ctx := context.Background()

	resource1Id := uuid.New().String()
	resource2Id := uuid.New().String()
	systemId := uuid.New().String()
	jobAgentId := uuid.New().String()
	deploymentId := uuid.New().String()

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
				integration.DeploymentCelResourceSelector("true"),
			),
		),
	)

	ws := engine.Workspace()
	workspaceID := ws.ID

	// Capture original state
	originalResources := ws.Resources().Items()
	originalDeployments := ws.Deployments().Items()
	originalSystems := ws.Systems().Items()
	originalJobAgents := ws.JobAgents().Items()

	// Create temporary directory for storage
	tempDir, err := os.MkdirTemp("", "workspace-persistence-test-*")
	if err != nil {
		t.Fatalf("failed to create temp directory: %v", err)
	}
	defer os.RemoveAll(tempDir)

	// Save workspace to storage
	storage := workspace.NewFileStorage(tempDir)

	// Encode workspace
	data, err := ws.GobEncode()
	if err != nil {
		t.Fatalf("failed to encode workspace: %v", err)
	}

	// Write to storage
	if err := storage.Put(ctx, "workspace.gob", data); err != nil {
		t.Fatalf("failed to write workspace: %v", err)
	}

	// Create a new workspace and load from storage
	newWs := workspace.New(workspaceID)

	// Read from storage
	loadedData, err := storage.Get(ctx, "workspace.gob")
	if err != nil {
		t.Fatalf("failed to read workspace: %v", err)
	}

	// Decode workspace
	if err := newWs.GobDecode(loadedData); err != nil {
		t.Fatalf("failed to decode workspace: %v", err)
	}

	// Verify workspace ID
	if newWs.ID != workspaceID {
		t.Errorf("workspace ID mismatch: expected %s, got %s", workspaceID, newWs.ID)
	}

	// Verify all resources with full field comparison
	loadedResources := newWs.Resources().Items()
	if len(loadedResources) != len(originalResources) {
		t.Errorf("resources count mismatch: expected %d, got %d", len(originalResources), len(loadedResources))
	}
	for id, original := range originalResources {
		loaded, ok := loadedResources[id]
		if !ok {
			t.Errorf("resource %s not found after load", id)
			continue
		}
		verifyResourcesEqual(t, original, loaded, "resource "+id)
	}

	// Verify all deployments
	loadedDeployments := newWs.Deployments().Items()
	if len(loadedDeployments) != len(originalDeployments) {
		t.Errorf("deployments count mismatch: expected %d, got %d", len(originalDeployments), len(loadedDeployments))
	}
	for id, original := range originalDeployments {
		loaded, ok := loadedDeployments[id]
		if !ok {
			t.Errorf("deployment %s not found after load", id)
			continue
		}
		verifyDeploymentsEqual(t, original, loaded, "deployment "+id)
	}

	// Verify all systems
	loadedSystems := newWs.Systems().Items()
	if len(loadedSystems) != len(originalSystems) {
		t.Errorf("systems count mismatch: expected %d, got %d", len(originalSystems), len(loadedSystems))
	}
	for id, original := range originalSystems {
		loaded, ok := loadedSystems[id]
		if !ok {
			t.Errorf("system %s not found after load", id)
			continue
		}
		verifySystemsEqual(t, original, loaded, "system "+id)
	}

	// Verify all job agents
	loadedJobAgents := newWs.JobAgents().Items()
	if len(loadedJobAgents) != len(originalJobAgents) {
		t.Errorf("job agents count mismatch: expected %d, got %d", len(originalJobAgents), len(loadedJobAgents))
	}
	for id, original := range originalJobAgents {
		loaded, ok := loadedJobAgents[id]
		if !ok {
			t.Errorf("job agent %s not found after load", id)
			continue
		}
		verifyJobAgentsEqual(t, original, loaded, "job agent "+id)
	}
}

func TestEngine_Persistence_EmptyWorkspace(t *testing.T) {
	ctx := context.Background()

	// Create empty workspace using integration helpers
	workspaceID := "test-empty-workspace"
	engine := integration.NewTestWorkspace(t,
		integration.WithWorkspaceID(workspaceID),
	)

	ws := engine.Workspace()

	// Create temporary directory for storage
	tempDir, err := os.MkdirTemp("", "workspace-persistence-test-*")
	if err != nil {
		t.Fatalf("failed to create temp directory: %v", err)
	}
	defer os.RemoveAll(tempDir)

	// Save empty workspace
	storage := workspace.NewFileStorage(tempDir)

	// Encode workspace
	data, err := ws.GobEncode()
	if err != nil {
		t.Fatalf("failed to encode workspace: %v", err)
	}

	// Write to storage
	if err := storage.Put(ctx, "empty.gob", data); err != nil {
		t.Fatalf("failed to write workspace: %v", err)
	}

	// Load into new workspace
	newWs := workspace.New(workspaceID)

	// Read from storage
	loadedData, err := storage.Get(ctx, "empty.gob")
	if err != nil {
		t.Fatalf("failed to read workspace: %v", err)
	}

	// Decode workspace
	if err := newWs.GobDecode(loadedData); err != nil {
		t.Fatalf("failed to decode workspace: %v", err)
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

func TestEngine_Persistence_MultipleResources(t *testing.T) {
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
	tempDir, err := os.MkdirTemp("", "workspace-persistence-test-*")
	if err != nil {
		t.Fatalf("failed to create temp directory: %v", err)
	}
	defer os.RemoveAll(tempDir)

	// Save workspace
	storage := workspace.NewFileStorage(tempDir)

	// Encode workspace
	data, err := ws.GobEncode()
	if err != nil {
		t.Fatalf("failed to encode workspace: %v", err)
	}

	// Write to storage
	if err := storage.Put(ctx, "workspace.gob", data); err != nil {
		t.Fatalf("failed to write workspace: %v", err)
	}

	// Load into new workspace
	newWs := workspace.New(workspaceID)

	// Read from storage
	loadedData, err := storage.Get(ctx, "workspace.gob")
	if err != nil {
		t.Fatalf("failed to read workspace: %v", err)
	}

	// Decode workspace
	if err := newWs.GobDecode(loadedData); err != nil {
		t.Fatalf("failed to decode workspace: %v", err)
	}

	// Verify all resources are preserved with full field comparison
	originalResources := ws.Resources().Items()
	restoredResources := newWs.Resources().Items()

	if len(restoredResources) != 3 {
		t.Errorf("expected 3 resources after restore, got %d", len(restoredResources))
	}

	for _, resourceId := range resourceIds {
		originalResource := originalResources[resourceId]
		restoredResource, ok := restoredResources[resourceId]
		if !ok {
			t.Errorf("resource %s not found after restore", resourceId)
			continue
		}

		verifyResourcesEqual(t, originalResource, restoredResource, "resource "+resourceId)
	}
}

func TestEngine_Persistence_ComplexEntities(t *testing.T) {
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
	tempDir, err := os.MkdirTemp("", "workspace-persistence-test-*")
	if err != nil {
		t.Fatalf("failed to create temp directory: %v", err)
	}
	defer os.RemoveAll(tempDir)

	// Save workspace
	storage := workspace.NewFileStorage(tempDir)

	// Encode workspace
	data, err := ws.GobEncode()
	if err != nil {
		t.Fatalf("failed to encode workspace: %v", err)
	}

	// Write to storage
	if err := storage.Put(ctx, "workspace.gob", data); err != nil {
		t.Fatalf("failed to write workspace: %v", err)
	}

	// Load into new workspace
	newWs := workspace.New(workspaceID)

	// Read from storage
	loadedData, err := storage.Get(ctx, "workspace.gob")
	if err != nil {
		t.Fatalf("failed to read workspace: %v", err)
	}

	// Decode workspace
	if err := newWs.GobDecode(loadedData); err != nil {
		t.Fatalf("failed to decode workspace: %v", err)
	}

	// Capture original entities for deep comparison
	originalSys, _ := ws.Systems().Get(sysId)
	originalDeployment, _ := ws.Deployments().Get(deploymentId)
	originalJobAgent, _ := ws.JobAgents().Get(jobAgentId)
	originalEnv1, _ := ws.Environments().Get(env1Id)
	originalEnv2, _ := ws.Environments().Get(env2Id)
	originalResource1, _ := ws.Resources().Get(resource1Id)
	originalResource2, _ := ws.Resources().Get(resource2Id)
	originalPolicy, _ := ws.Policies().Get(policyId)

	// Verify system with full field comparison
	restoredSys, ok := newWs.Systems().Get(sysId)
	if !ok {
		t.Fatal("system not found in restored workspace")
	}
	verifySystemsEqual(t, originalSys, restoredSys, "system "+sysId)

	// Verify deployment with full field comparison
	restoredDeployment, ok := newWs.Deployments().Get(deploymentId)
	if !ok {
		t.Fatal("deployment not found in restored workspace")
	}
	verifyDeploymentsEqual(t, originalDeployment, restoredDeployment, "deployment "+deploymentId)

	// Verify job agent with full field comparison
	restoredJobAgent, ok := newWs.JobAgents().Get(jobAgentId)
	if !ok {
		t.Fatal("job agent not found in restored workspace")
	}
	verifyJobAgentsEqual(t, originalJobAgent, restoredJobAgent, "job agent "+jobAgentId)

	// Verify environments
	environments := newWs.Environments().Items()
	if len(environments) != 2 {
		t.Errorf("expected 2 environments, got %d", len(environments))
	}

	restoredEnv1, ok := newWs.Environments().Get(env1Id)
	if !ok {
		t.Error("environment production not found")
	} else {
		verifyEnvironmentsEqual(t, originalEnv1, restoredEnv1, "environment "+env1Id)
	}

	restoredEnv2, ok := newWs.Environments().Get(env2Id)
	if !ok {
		t.Error("environment staging not found")
	} else {
		verifyEnvironmentsEqual(t, originalEnv2, restoredEnv2, "environment "+env2Id)
	}

	// Verify resources
	resources := newWs.Resources().Items()
	if len(resources) != 2 {
		t.Errorf("expected 2 resources, got %d", len(resources))
	}

	restoredResource1, ok := newWs.Resources().Get(resource1Id)
	if !ok {
		t.Error("resource 1 not found")
	} else {
		verifyResourcesEqual(t, originalResource1, restoredResource1, "resource "+resource1Id)
	}

	restoredResource2, ok := newWs.Resources().Get(resource2Id)
	if !ok {
		t.Error("resource 2 not found")
	} else {
		verifyResourcesEqual(t, originalResource2, restoredResource2, "resource "+resource2Id)
	}

	// Verify policies
	policies := newWs.Policies().Items()
	if len(policies) != 1 {
		t.Errorf("expected 1 policy, got %d", len(policies))
	}

	restoredPolicy, ok := newWs.Policies().Get(policyId)
	if !ok {
		t.Error("policy not found")
	} else {
		verifyPoliciesEqual(t, originalPolicy, restoredPolicy, "policy "+policyId)
	}
}

func TestEngine_Persistence_JobsWithStatuses(t *testing.T) {
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
				integration.DeploymentCelResourceSelector("true"),
				integration.WithDeploymentVersion(
					integration.DeploymentVersionID(deploymentVersionId),
					integration.DeploymentVersionTag("v1.0.0"),
				),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(envId),
				integration.EnvironmentName("test-env"),
				integration.EnvironmentCelResourceSelector("true"),
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

	// Update job statuses
	jobsByStatus := make(map[oapi.JobStatus]string)
	testStatuses := []oapi.JobStatus{
		oapi.Pending,
		oapi.InProgress,
		oapi.Successful,
	}

	jobIndex := 0
	for _, status := range testStatuses {
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
	tempDir, err := os.MkdirTemp("", "workspace-persistence-test-*")
	if err != nil {
		t.Fatalf("failed to create temp directory: %v", err)
	}
	defer os.RemoveAll(tempDir)

	// Save workspace
	storage := workspace.NewFileStorage(tempDir)

	// Encode workspace
	data, err := ws.GobEncode()
	if err != nil {
		t.Fatalf("failed to encode workspace: %v", err)
	}

	// Write to storage
	if err := storage.Put(ctx, "workspace.gob", data); err != nil {
		t.Fatalf("failed to write workspace: %v", err)
	}

	// Load into new workspace
	newWs := workspace.New(workspaceID)

	// Read from storage
	loadedData, err := storage.Get(ctx, "workspace.gob")
	if err != nil {
		t.Fatalf("failed to read workspace: %v", err)
	}

	// Decode workspace
	if err := newWs.GobDecode(loadedData); err != nil {
		t.Fatalf("failed to decode workspace: %v", err)
	}

	// Verify all jobs with full field comparison
	for status, jobId := range jobsByStatus {
		originalJob, _ := ws.Jobs().Get(jobId)
		restoredJob, ok := newWs.Jobs().Get(jobId)
		if !ok {
			t.Errorf("job %s with status %s not found after restore", jobId, status)
			continue
		}

		verifyJobsEqual(t, originalJob, restoredJob, "job "+jobId)
	}
}

func TestEngine_Persistence_MultipleWorkspaces(t *testing.T) {
	ctx := context.Background()

	// Create temporary directory for storage
	tempDir, err := os.MkdirTemp("", "workspace-persistence-test-*")
	if err != nil {
		t.Fatalf("failed to create temp directory: %v", err)
	}
	defer os.RemoveAll(tempDir)

	storage := workspace.NewFileStorage(tempDir)

	// Create and save multiple different workspaces (using NewNoFlush to avoid DB interaction)
	workspaceIDs := []string{uuid.New().String(), uuid.New().String(), uuid.New().String()}

	for i, wsID := range workspaceIDs {
		ws := workspace.NewNoFlush(wsID)

		// Encode and save
		data, err := ws.GobEncode()
		if err != nil {
			t.Fatalf("failed to encode workspace %s: %v", wsID, err)
		}

		filename := fmt.Sprintf("workspace-%d.gob", i)
		if err := storage.Put(ctx, filename, data); err != nil {
			t.Fatalf("failed to save workspace %s: %v", wsID, err)
		}
	}

	// Load each workspace and verify they're distinct
	for i, wsID := range workspaceIDs {
		newWs := workspace.NewNoFlush("temp")

		filename := fmt.Sprintf("workspace-%d.gob", i)
		loadedData, err := storage.Get(ctx, filename)
		if err != nil {
			t.Fatalf("failed to load workspace %s: %v", wsID, err)
		}

		if err := newWs.GobDecode(loadedData); err != nil {
			t.Fatalf("failed to decode workspace %s: %v", wsID, err)
		}

		// Verify workspace ID is correct
		if newWs.ID != wsID {
			t.Errorf("workspace ID mismatch: expected %s, got %s", wsID, newWs.ID)
		}
	}
}

func TestEngine_Persistence_TimestampsAndTimeZones(t *testing.T) {
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
				integration.DeploymentCelResourceSelector("true"),
				integration.WithDeploymentVersion(
					integration.DeploymentVersionID(deploymentVersionId),
					integration.DeploymentVersionTag("v1.0.0"),
				),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(envId),
				integration.EnvironmentName("test-env"),
				integration.EnvironmentCelResourceSelector("true"),
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
	tempDir, err := os.MkdirTemp("", "workspace-persistence-test-*")
	if err != nil {
		t.Fatalf("failed to create temp directory: %v", err)
	}
	defer os.RemoveAll(tempDir)

	// Save workspace
	storage := workspace.NewFileStorage(tempDir)

	data, err := ws.GobEncode()
	if err != nil {
		t.Fatalf("failed to encode workspace: %v", err)
	}

	if err := storage.Put(ctx, "workspace.gob", data); err != nil {
		t.Fatalf("failed to save workspace: %v", err)
	}

	// Load into new workspace
	newWs := workspace.New(workspaceID)

	loadedData, err := storage.Get(ctx, "workspace.gob")
	if err != nil {
		t.Fatalf("failed to load workspace: %v", err)
	}

	if err := newWs.GobDecode(loadedData); err != nil {
		t.Fatalf("failed to decode workspace: %v", err)
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

func TestEngine_Persistence_LoadFromNonExistentFile(t *testing.T) {
	ctx := context.Background()

	// Create temporary directory for storage
	tempDir, err := os.MkdirTemp("", "workspace-persistence-test-*")
	if err != nil {
		t.Fatalf("failed to create temp directory: %v", err)
	}
	defer os.RemoveAll(tempDir)

	storage := workspace.NewFileStorage(tempDir)

	// Attempt to load from non-existent file
	_, err = storage.Get(ctx, "non-existent-file.gob")

	// Verify error is returned
	if err == nil {
		t.Fatal("expected error when loading from non-existent file, got nil")
	}
}

func TestEngine_Persistence_ConcurrentWrites(t *testing.T) {
	ctx := context.Background()

	// Create workspace with known state (using NewNoFlush to avoid DB interaction)
	workspaceID := uuid.New().String()
	ws := workspace.NewNoFlush(workspaceID)

	// Create temporary directory for storage
	tempDir, err := os.MkdirTemp("", "workspace-persistence-test-*")
	if err != nil {
		t.Fatalf("failed to create temp directory: %v", err)
	}
	defer os.RemoveAll(tempDir)

	storage := workspace.NewFileStorage(tempDir)

	// Encode once to reuse
	data, err := ws.GobEncode()
	if err != nil {
		t.Fatalf("failed to encode workspace: %v", err)
	}

	// Launch multiple goroutines that simultaneously write to the same file
	const numGoroutines = 10
	var wg sync.WaitGroup
	errChan := make(chan error, numGoroutines)

	for i := 0; i < numGoroutines; i++ {
		wg.Add(1)
		go func(index int) {
			defer wg.Done()

			// Each goroutine writes the same data
			if err := storage.Put(ctx, "concurrent.gob", data); err != nil {
				errChan <- err
			}
		}(i)
	}

	// Wait for all goroutines to complete
	wg.Wait()
	close(errChan)

	// Check if any goroutine had errors
	for err := range errChan {
		t.Errorf("concurrent write operation failed: %v", err)
	}

	// Load workspace and verify it's valid (not corrupted)
	newWs := workspace.NewNoFlush("temp")

	loadedData, err := storage.Get(ctx, "concurrent.gob")
	if err != nil {
		t.Fatalf("failed to load workspace after concurrent writes: %v", err)
	}

	if err := newWs.GobDecode(loadedData); err != nil {
		t.Fatalf("failed to decode workspace after concurrent writes: %v", err)
	}

	// Verify workspace has valid data
	if newWs.ID != workspaceID {
		t.Errorf("workspace ID mismatch: expected %s, got %s", workspaceID, newWs.ID)
	}
}

func TestEngine_Persistence_FileStorageOperations(t *testing.T) {
	ctx := context.Background()

	// Create temporary directory for storage
	tempDir, err := os.MkdirTemp("", "workspace-persistence-test-*")
	if err != nil {
		t.Fatalf("failed to create temp directory: %v", err)
	}
	defer os.RemoveAll(tempDir)

	storage := workspace.NewFileStorage(tempDir)

	// Test basic Put/Get operations
	testData := []byte("test data content")
	testPath := "test/path/file.dat"

	// Put data
	if err := storage.Put(ctx, testPath, testData); err != nil {
		t.Fatalf("failed to put data: %v", err)
	}

	// Get data
	retrievedData, err := storage.Get(ctx, testPath)
	if err != nil {
		t.Fatalf("failed to get data: %v", err)
	}

	// Verify data matches
	if string(retrievedData) != string(testData) {
		t.Errorf("data mismatch: expected %q, got %q", string(testData), string(retrievedData))
	}
}
