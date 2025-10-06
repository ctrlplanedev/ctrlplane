package e2e

import (
	"bytes"
	"context"
	"encoding/gob"
	"testing"
	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/pb"
	"workspace-engine/pkg/workspace"
	"workspace-engine/test/integration"
	c "workspace-engine/test/integration/creators"

	"github.com/google/uuid"
)

func TestEngine_WorkspaceStoreAndRestore_BasicJobs(t *testing.T) {
	// Create original workspace with jobs
	engine := integration.NewTestWorkspace(t,
		integration.WithJobAgent(integration.JobAgentName("test-job-agent")),
		integration.WithSystem(integration.SystemName("test-system")),
		integration.WithSystem(
			integration.WithDeployment(
				integration.DeploymentName("deployment-1"),
				integration.WithDeploymentVersion(integration.DeploymentVersionName("v1.0.0")),
				integration.WithDeploymentVersion(integration.DeploymentVersionName("v1.0.1")),
				integration.WithDeploymentVersion(integration.DeploymentVersionName("v1.0.2")),
				integration.WithDeploymentVersion(integration.DeploymentVersionName("v1.0.3")),
			),
			integration.WithEnvironment(integration.EnvironmentName("env-prod")),
		),
		integration.WithResource(integration.ResourceName("resource-1")),
		integration.WithResource(integration.ResourceName("resource-2")),
	)
	

	ws := engine.Workspace()

	// Save workspace to buffer using gob
	var buf bytes.Buffer
	if err := gob.NewEncoder(&buf).Encode(ws); err != nil {
		t.Fatalf("failed to encode workspace: %v", err)
	}

	// Restore workspace from buffer
	var restoredWs workspace.Workspace
	if err := gob.NewDecoder(bytes.NewReader(buf.Bytes())).Decode(&restoredWs); err != nil {
		t.Fatalf("failed to decode workspace: %v", err)
	}

	// Count resources
	if len(restoredWs.Resources().Items()) != len(ws.Resources().Items()) {
		t.Errorf("expected %d resources, got %d", len(ws.Resources().Items()), len(restoredWs.Resources().Items()))
	}

	if len(restoredWs.Deployments().Items()) != len(ws.Deployments().Items()) {
		t.Errorf("expected %d deployments, got %d", len(ws.Deployments().Items()), len(restoredWs.Deployments().Items()))
	}

	if len(restoredWs.Systems().Items()) != len(ws.Systems().Items()) {
		t.Errorf("expected %d systems, got %d", len(ws.Systems().Items()), len(restoredWs.Systems().Items()))
	}

	if len(restoredWs.JobAgents().Items()) != len(ws.JobAgents().Items()) {
		t.Errorf("expected %d job agents, got %d", len(ws.JobAgents().Items()), len(restoredWs.JobAgents().Items()))
	}

	if len(restoredWs.Jobs().Items()) != len(ws.Jobs().Items()) {
		t.Errorf("expected %d jobs, got %d", len(ws.Jobs().Items()), len(restoredWs.Jobs().Items()))
	}

	if len(restoredWs.DeploymentVersions().Items()) != len(ws.DeploymentVersions().Items()) {
		t.Errorf("expected %d deployment versions, got %d", len(ws.DeploymentVersions().Items()), len(restoredWs.DeploymentVersions().Items()))
	}

	if len(restoredWs.Environments().Items()) != len(ws.Environments().Items()) {
		t.Errorf("expected %d environments, got %d", len(ws.Environments().Items()), len(restoredWs.Environments().Items()))
	}

	if len(restoredWs.Policies().Items()) != len(ws.Policies().Items()) {
		t.Errorf("expected %d policies, got %d", len(ws.Policies().Items()), len(restoredWs.Policies().Items()))
	}
}

func TestEngine_WorkspaceStoreAndRestore_MultipleJobStates(t *testing.T) {
	jobAgentId := uuid.New().String()
	// Create workspace with jobs in various states
	engine := integration.NewTestWorkspace(t,
		integration.WithJobAgent(integration.JobAgentID(jobAgentId)),
		integration.WithSystem(
			integration.SystemName("test-system"),
			integration.WithDeployment(
				integration.DeploymentJobAgent(jobAgentId),
				integration.DeploymentName("deployment-1"),
				integration.WithDeploymentVersion(integration.DeploymentVersionName("v1.0.0")),
			),
			integration.WithEnvironment(integration.EnvironmentName("env-prod")),
		),

		integration.WithResource(integration.ResourceName("resource-1")),
		integration.WithResource(integration.ResourceName("resource-2")),
		integration.WithResource(integration.ResourceName("resource-3")),
		integration.WithResource(integration.ResourceName("resource-4")),
		integration.WithResource(integration.ResourceName("resource-5")),
	)
	workspaceID := engine.Workspace().ID
	ctx := context.Background()

	// Get all created jobs
	pendingJobs := engine.Workspace().Jobs().GetPending()
	if len(pendingJobs) != 5 {
		t.Fatalf("expected 5 pending jobs, got %d", len(pendingJobs))
	}

	// Set different statuses for jobs
	jobStatuses := []pb.JobStatus{
		pb.JobStatus_JOB_STATUS_PENDING,
		pb.JobStatus_JOB_STATUS_IN_PROGRESS,
		pb.JobStatus_JOB_STATUS_SUCCESSFUL,
		pb.JobStatus_JOB_STATUS_FAILURE,
		pb.JobStatus_JOB_STATUS_CANCELLED,
	}

	jobStatesMap := make(map[string]pb.JobStatus)
	i := 0
	for jobID, job := range pendingJobs {
		status := jobStatuses[i%len(jobStatuses)]
		job.Status = status
		engine.Workspace().Jobs().Upsert(ctx, job)
		jobStatesMap[jobID] = status
		i++
	}

	// Encode workspace
	encodedData, err := engine.Workspace().GobEncode()
	if err != nil {
		t.Fatalf("failed to encode workspace: %v", err)
	}

	// Restore to new workspace
	restoredWorkspace := workspace.New(workspaceID)
	err = restoredWorkspace.GobDecode(encodedData)
	if err != nil {
		t.Fatalf("failed to decode workspace: %v", err)
	}

	// Verify all jobs and their states
	for jobID, expectedStatus := range jobStatesMap {
		restoredJob, ok := restoredWorkspace.Jobs().Get(jobID)
		if !ok {
			t.Errorf("job %s with status %v not found after restore", jobID, expectedStatus)
			continue
		}

		if restoredJob.Status != expectedStatus {
			t.Errorf("job %s: expected status %v, got %v", jobID, expectedStatus, restoredJob.Status)
		}
	}

	// Verify only PENDING jobs are returned by GetPending
	restoredPendingJobs := restoredWorkspace.Jobs().GetPending()
	expectedPendingCount := 1
	if len(restoredPendingJobs) != expectedPendingCount {
		t.Errorf("expected %d pending jobs after restore, got %d", expectedPendingCount, len(restoredPendingJobs))
	}
}

func TestEngine_WorkspaceStoreAndRestore_WithReleaseCount(t *testing.T) {
	// Test that the number of jobs and their release associations are preserved
	engine := integration.NewTestWorkspace(t)
	workspaceID := engine.Workspace().ID
	ctx := context.Background()

	jobAgent := c.NewJobAgent()
	engine.PushEvent(ctx, handler.JobAgentCreate, jobAgent)

	sys := c.NewSystem(workspaceID)
	sys.Name = "test-system"
	engine.PushEvent(ctx, handler.SystemCreate, sys)

	d1 := c.NewDeployment(sys.Id)
	d1.Name = "deployment-1"
	d1.JobAgentId = &jobAgent.Id
	engine.PushEvent(ctx, handler.DeploymentCreate, d1)

	e1 := c.NewEnvironment(sys.Id)
	e1.Name = "env-prod"
	engine.PushEvent(ctx, handler.EnvironmentCreate, e1)

	r1 := c.NewResource(workspaceID)
	r1.Name = "resource-1"
	engine.PushEvent(ctx, handler.ResourceCreate, r1)

	r2 := c.NewResource(workspaceID)
	r2.Name = "resource-2"
	engine.PushEvent(ctx, handler.ResourceCreate, r2)

	dv1 := c.NewDeploymentVersion()
	dv1.DeploymentId = d1.Id
	dv1.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv1)

	// Get jobs and collect release IDs
	pendingJobs := engine.Workspace().Jobs().GetPending()
	if len(pendingJobs) != 2 {
		t.Fatalf("expected 2 pending jobs, got %d", len(pendingJobs))
	}

	releaseIDs := make(map[string]bool)
	for _, job := range pendingJobs {
		releaseIDs[job.ReleaseId] = true
	}

	// Encode and restore workspace
	encodedData, err := engine.Workspace().GobEncode()
	if err != nil {
		t.Fatalf("failed to encode workspace: %v", err)
	}

	restoredWorkspace := workspace.New(workspaceID)
	err = restoredWorkspace.GobDecode(encodedData)
	if err != nil {
		t.Fatalf("failed to decode workspace: %v", err)
	}

	// Verify all jobs exist in restored workspace
	restoredPendingJobs := restoredWorkspace.Jobs().GetPending()
	if len(restoredPendingJobs) != len(pendingJobs) {
		t.Errorf("expected %d pending jobs after restore, got %d", len(pendingJobs), len(restoredPendingJobs))
	}

	// Verify release IDs are preserved
	for _, job := range restoredPendingJobs {
		if !releaseIDs[job.ReleaseId] {
			t.Errorf("job has unexpected release_id %s", job.ReleaseId)
		}
	}
}

func TestEngine_WorkspaceStoreAndRestore_AllEntities(t *testing.T) {
	jobAgentId := uuid.New().String()

	sysId := uuid.New().String()
	d1Id := uuid.New().String()
	dv1Id := uuid.New().String()
	e1Id := uuid.New().String()
	e2Id := uuid.New().String()
	r1Id := uuid.New().String()
	r2Id := uuid.New().String()

	// Comprehensive test to verify all workspace entities are preserved
	engine := integration.NewTestWorkspace(t,
		integration.WithJobAgent(integration.JobAgentID(jobAgentId)),
		integration.WithSystem(
			integration.SystemID(sysId),
			integration.SystemName("test-system"),
			integration.WithDeployment(
				integration.DeploymentJobAgent(jobAgentId),
				integration.DeploymentID(d1Id),
				integration.DeploymentName("deployment-1"),
				integration.WithDeploymentVersion(
					integration.DeploymentVersionID(dv1Id),
					integration.DeploymentVersionTag("v1.0.0"),
				),
			),
			integration.WithEnvironment(
				integration.EnvironmentName("env-dev"),
				integration.EnvironmentID(e1Id),
			),
			integration.WithEnvironment(
				integration.EnvironmentName("env-prod"),
				integration.EnvironmentID(e2Id),
			),
		),
		integration.WithResource(
			integration.ResourceName("resource-1"),
			integration.ResourceID(r1Id),
		),
		integration.WithResource(
			integration.ResourceName("resource-2"),
			integration.ResourceID(r2Id),
		),
	)
	workspaceID := engine.Workspace().ID
	ctx := context.Background()

	// Verify release targets created (1 deployment * 2 environments * 2 resources = 4)
	releaseTargets := engine.Workspace().ReleaseTargets().Items(ctx)
	if len(releaseTargets) != 4 {
		t.Fatalf("expected 4 release targets before encoding, got %d", len(releaseTargets))
	}

	// Deployment version already created in setup - it creates jobs
	// Count entities before encoding
	pendingJobsBefore := engine.Workspace().Jobs().GetPending()
	if len(pendingJobsBefore) != 4 {
		t.Fatalf("expected 4 pending jobs before encoding, got %d", len(pendingJobsBefore))
	}

	// Encode workspace
	var buf bytes.Buffer
	enc := gob.NewEncoder(&buf)
	if err := enc.Encode(engine.Workspace()); err != nil {
		t.Fatalf("failed to encode workspace: %v", err)
	}

	// Restore to new workspace
	restoredWorkspace := workspace.New(workspaceID)
	dec := gob.NewDecoder(&buf)
	if err := dec.Decode(restoredWorkspace); err != nil {
		t.Fatalf("failed to decode workspace: %v", err)
	}

	// Verify systems
	restoredSys, ok := restoredWorkspace.Systems().Get(sysId)
	if !ok {
		t.Error("system not found in restored workspace")
	} else if restoredSys.Name != "test-system" {
		t.Errorf("system name mismatch - expected %s, got %s", "test-system", restoredSys.Name)
	}

	// Verify deployments
	restoredDeployment, ok := restoredWorkspace.Deployments().Get(d1Id)
	if !ok {
		t.Error("deployment not found in restored workspace")
	} else if restoredDeployment.Name != "deployment-1" {
		t.Errorf("deployment name mismatch - expected %s, got %s", "deployment-1", restoredDeployment.Name)
	}

	// Verify environments
	restoredEnv1, ok := restoredWorkspace.Environments().Get(e1Id)
	if !ok {
		t.Error("environment 1 not found in restored workspace")
	} else if restoredEnv1.Name != "env-dev" {
		t.Errorf("environment 1 name mismatch - expected %s, got %s", "env-dev", restoredEnv1.Name)
	}

	// Verify resources
	restoredResource1, ok := restoredWorkspace.Resources().Get(r1Id)
	if !ok {
		t.Error("resource 1 not found in restored workspace")
	} else if restoredResource1.Name != "resource-1" {
		t.Errorf("resource 1 name mismatch - expected %s, got %s", "resource-1", restoredResource1.Name)
	}

	// Verify job agents
	restoredJobAgent, ok := restoredWorkspace.JobAgents().Get(jobAgentId)
	if !ok {
		t.Error("job agent not found in restored workspace")
	} else if restoredJobAgent.Name != "test-job-agent" {
		t.Errorf("job agent name mismatch - expected %s, got %s", "test-job-agent", restoredJobAgent.Name)
	}

	// Verify deployment versions
	restoredDV, ok := restoredWorkspace.DeploymentVersions().Get(dv1Id)
	if !ok {
		t.Error("deployment version not found in restored workspace")
	} else if restoredDV.Tag != "v1.0.0" {
		t.Errorf("deployment version tag mismatch - expected %s, got %s", "v1.0.0", restoredDV.Tag)
	}

	// Verify release targets
	restoredReleaseTargets := restoredWorkspace.ReleaseTargets().Items(ctx)
	if len(restoredReleaseTargets) != 4 {
		t.Errorf("expected 4 release targets after restore, got %d", len(restoredReleaseTargets))
	}

	// Verify jobs
	pendingJobsAfter := restoredWorkspace.Jobs().GetPending()
	if len(pendingJobsAfter) != 4 {
		t.Errorf("expected 4 pending jobs after restore, got %d", len(pendingJobsAfter))
	}

	// Verify each job matches
	for jobID, originalJob := range pendingJobsBefore {
		restoredJob, ok := restoredWorkspace.Jobs().Get(jobID)
		if !ok {
			t.Errorf("job %s not found in restored workspace", jobID)
			continue
		}

		if restoredJob.Status != originalJob.Status {
			t.Errorf("job %s: status mismatch - expected %v, got %v", jobID, originalJob.Status, restoredJob.Status)
		}
		if restoredJob.DeploymentId != originalJob.DeploymentId {
			t.Errorf("job %s: deployment_id mismatch", jobID)
		}
		if restoredJob.EnvironmentId != originalJob.EnvironmentId {
			t.Errorf("job %s: environment_id mismatch", jobID)
		}
		if restoredJob.ResourceId != originalJob.ResourceId {
			t.Errorf("job %s: resource_id mismatch", jobID)
		}
	}
}

