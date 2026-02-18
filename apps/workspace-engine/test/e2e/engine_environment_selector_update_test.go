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
)

// IMPORTANT: This file tests a critical bug where jobs in exited/terminal states
// are incorrectly cancelled when selectors change (environment OR deployment selectors).
//
// RULE: Jobs already in exited states (InvalidJobAgent, Successful, Failure, etc.)
// should NEVER be updated when release targets are removed due to selector changes.
// Only jobs in processing states (Pending, InProgress, ActionRequired) should be cancelled.

// TestEngine_EnvironmentSelectorUpdate_DoesNotCancelExitedJobs tests that when
// an environment's resource selector is updated to remove resources, jobs that
// are already in an exited state (like InvalidJobAgent) should NOT be cancelled.
//
// Bug scenario:
// 1. Create environment with resources
// 2. Resources match the environment selector and create release targets
// 3. Deployment has no job agent configured, so jobs are created with InvalidJobAgent status
// 4. Update environment selector to remove some resources
// 5. BUG: Jobs with InvalidJobAgent status are being marked as Cancelled
// 6. EXPECTED: Jobs already in exited states should remain in their original state
func TestEngine_EnvironmentSelectorUpdate_DoesNotCancelExitedJobs(t *testing.T) {
	systemId := uuid.New().String()
	deploymentId := uuid.New().String()
	environmentId := uuid.New().String()
	resourceId1 := uuid.New().String()
	resourceId2 := uuid.New().String()
	engine := integration.NewTestWorkspace(t,
		integration.WithSystem(
			integration.SystemName("test-system"),
			integration.SystemID(systemId),
			integration.WithDeployment(
				integration.DeploymentID(deploymentId),
				integration.DeploymentName("deployment-no-agent"),
				integration.DeploymentCelResourceSelector("true"),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentId),
				integration.EnvironmentName("development"),
				integration.EnvironmentCelResourceSelector(`resource.metadata["env"] == "dev"`),
			),
		),
		integration.WithResource(
			integration.ResourceID(resourceId1),
			integration.ResourceName("resource-1"),
			integration.ResourceMetadata(map[string]string{"env": "dev"}),
		),
		integration.WithResource(
			integration.ResourceID(resourceId2),
			integration.ResourceName("resource-2"),
			integration.ResourceMetadata(map[string]string{"env": "dev"}),
		),
	)
	ctx := context.Background()

	// Verify release targets were created (2 resources matching the selector)
	releaseTargets, err := engine.Workspace().ReleaseTargets().Items()
	if err != nil {
		t.Fatalf("failed to get release targets: %v", err)
	}
	if len(releaseTargets) != 2 {
		t.Fatalf("expected 2 release targets (r1, r2), got %d", len(releaseTargets))
	}

	// Create a deployment version - this will create jobs with InvalidJobAgent status
	version := c.NewDeploymentVersion()
	version.DeploymentId = deploymentId
	version.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, version)

	// Verify jobs were created with InvalidJobAgent status
	allJobs := engine.Workspace().Jobs().Items()
	if len(allJobs) != 2 {
		t.Fatalf("expected 2 jobs, got %d", len(allJobs))
	}

	// Store job IDs and verify they all have InvalidJobAgent status
	jobIDs := make([]string, 0)
	for _, job := range allJobs {
		jobIDs = append(jobIDs, job.Id)
		if job.Status != oapi.JobStatusInvalidJobAgent {
			t.Fatalf("expected job %s to have InvalidJobAgent status, got %v", job.Id, job.Status)
		}
		assert.Nil(t, job.DispatchContext)
	}

	t.Logf("Created 2 jobs with InvalidJobAgent status: %v", jobIDs)

	// Update the environment selector to match only r1 (exclude r2)
	// This simulates removing resources from an environment
	updatedEnv := c.NewEnvironment(systemId)
	updatedEnv.Id = environmentId
	updatedEnv.Name = "development"
	updatedSelector := &oapi.Selector{}
	_ = updatedSelector.FromJsonSelector(oapi.JsonSelector{Json: map[string]any{
		"type":     "name",
		"operator": "equals",
		"value":    "resource-1", // Only match resource-1 now
	}})
	updatedEnv.ResourceSelector = updatedSelector
	engine.PushEvent(ctx, handler.EnvironmentUpdate, updatedEnv)

	// Verify release targets - should now only have 1 (for r1)
	releaseTargetsAfter, err := engine.Workspace().ReleaseTargets().Items()
	if err != nil {
		t.Fatalf("failed to get release targets after update: %v", err)
	}
	if len(releaseTargetsAfter) != 1 {
		t.Fatalf("expected 1 release target after selector update, got %d", len(releaseTargetsAfter))
	}

	r1, _ := engine.Workspace().Resources().Get(resourceId1)
	r2, _ := engine.Workspace().Resources().Get(resourceId2)

	// Verify the remaining release target is for r1
	var remainingRT *oapi.ReleaseTarget
	for _, rt := range releaseTargetsAfter {
		remainingRT = rt
		break
	}
	if remainingRT.ResourceId != r1.Id {
		t.Fatalf("expected remaining release target to be for resource %s, got %s", r1.Id, remainingRT.ResourceId)
	}

	// THE BUG: Jobs that are already in InvalidJobAgent status (an exited state)
	// should NOT be changed to Cancelled status when the environment selector is updated
	allJobsAfter := engine.Workspace().Jobs().Items()
	if len(allJobsAfter) != 2 {
		// Debug: Print all jobs
		for _, job := range allJobsAfter {
			release, _ := engine.Workspace().Releases().Get(job.ReleaseId)
			t.Logf("Job: %s, Status: %s, ReleaseID: %s, Resource: %s",
				job.Id, job.Status, job.ReleaseId, release.ReleaseTarget.ResourceId)
		}
		t.Fatalf("expected 2 jobs to still exist after selector update, got %d", len(allJobsAfter))
	}

	for _, job := range allJobsAfter {
		// Check if this job was for a release target that was removed
		release, ok := engine.Workspace().Releases().Get(job.ReleaseId)
		if !ok {
			t.Fatalf("release %s not found for job %s", job.ReleaseId, job.Id)
		}

		switch release.ReleaseTarget.ResourceId {
		case r2.Id:
			// This job was for r2, which was removed from the environment
			// It should still have InvalidJobAgent status, NOT Cancelled
			if job.Status == oapi.JobStatusCancelled {
				t.Errorf("BUG DETECTED: Job %s for removed resource r2 was changed from InvalidJobAgent to Cancelled. "+
					"Jobs in exited states should not be cancelled when environment selectors change.", job.Id)
			}
			if job.Status != oapi.JobStatusInvalidJobAgent {
				t.Errorf("Job %s for removed resource r2 should still have InvalidJobAgent status, got %v",
					job.Id, job.Status)
			}
		case r1.Id:
			// This job is for r1, which is still in the environment
			if job.Status != oapi.JobStatusInvalidJobAgent {
				t.Errorf("Job %s for resource r1 should still have InvalidJobAgent status, got %v",
					job.Id, job.Status)
			}
		}
	}
}

// TestEngine_EnvironmentSelectorUpdate_CancelsPendingJobs verifies the CORRECT behavior:
// Jobs in processing states (Pending, InProgress) SHOULD be cancelled when resources are removed
func TestEngine_EnvironmentSelectorUpdate_CancelsPendingJobs(t *testing.T) {
	systemId := uuid.New().String()
	deploymentId := uuid.New().String()
	environmentId := uuid.New().String()
	resourceId1 := uuid.New().String()
	resourceId2 := uuid.New().String()
	resourceId3 := uuid.New().String()
	jobAgentId := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentId),
			integration.JobAgentName("Test Agent"),
		),
		integration.WithSystem(
			integration.SystemName("test-system"),
			integration.SystemID(systemId),
			integration.WithDeployment(
				integration.DeploymentID(deploymentId),
				integration.DeploymentName("deployment-with-agent"),
				integration.DeploymentCelResourceSelector("true"),
				integration.DeploymentJobAgent(jobAgentId),
				integration.WithDeploymentVersion(
					integration.DeploymentVersionTag("v1.0.0"),
				),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentId),
				integration.EnvironmentName("development"),
				integration.EnvironmentCelResourceSelector(`resource.metadata["env"] == "dev"`),
			),
		),
		integration.WithResource(
			integration.ResourceID(resourceId1),
			integration.ResourceName("resource-1"),
			integration.ResourceMetadata(map[string]string{"env": "dev"}),
		),
		integration.WithResource(
			integration.ResourceID(resourceId2),
			integration.ResourceName("resource-2"),
			integration.ResourceMetadata(map[string]string{"env": "dev"}),
		),
		integration.WithResource(
			integration.ResourceID(resourceId3),
			integration.ResourceName("resource-3"),
			integration.ResourceMetadata(map[string]string{"env": "prod"}),
		),
	)
	ctx := context.Background()

	// Verify jobs were created with Pending status
	pendingJobs := engine.Workspace().Jobs().GetPending()
	if len(pendingJobs) != 2 {
		t.Fatalf("expected 2 pending jobs, got %d", len(pendingJobs))
	}

	// Store job IDs
	jobIDs := make([]string, 0)
	for _, job := range pendingJobs {
		jobIDs = append(jobIDs, job.Id)
		if job.Status != oapi.JobStatusPending {
			t.Fatalf("expected job %s to have Pending status, got %v", job.Id, job.Status)
		}
		assert.NotNil(t, job.DispatchContext)
	}

	t.Logf("Created 2 jobs with Pending status: %v", jobIDs)

	// Update the environment selector to match only r1 (exclude r2)
	updatedEnv := c.NewEnvironment(systemId)
	updatedEnv.Id = environmentId
	updatedEnv.Name = "development"
	updatedSelector := &oapi.Selector{}
	_ = updatedSelector.FromJsonSelector(oapi.JsonSelector{Json: map[string]any{
		"type":     "name",
		"operator": "equals",
		"value":    "resource-1", // Only match resource-1 now
	}})
	updatedEnv.ResourceSelector = updatedSelector
	engine.PushEvent(ctx, handler.EnvironmentUpdate, updatedEnv)

	// CORRECT BEHAVIOR: Jobs in Pending state SHOULD be cancelled
	allJobsAfter := engine.Workspace().Jobs().Items()

	r1, _ := engine.Workspace().Resources().Get(resourceId1)
	r2, _ := engine.Workspace().Resources().Get(resourceId2)

	for _, job := range allJobsAfter {
		release, ok := engine.Workspace().Releases().Get(job.ReleaseId)
		if !ok {
			t.Fatalf("release %s not found for job %s", job.ReleaseId, job.Id)
		}

		switch release.ReleaseTarget.ResourceId {
		case r2.Id:
			// This job was for r2, which was removed from the environment
			// Pending jobs SHOULD be cancelled
			if job.Status != oapi.JobStatusCancelled {
				t.Errorf("Job %s for removed resource r2 should be Cancelled, got %v", job.Id, job.Status)
			}
		case r1.Id:
			// This job is for r1, which is still in the environment
			if job.Status != oapi.JobStatusPending {
				t.Errorf("Job %s for resource r1 should still be Pending, got %v", job.Id, job.Status)
			}
		}
	}

	// Verify we have 1 Pending job and 1 Cancelled job
	pendingCount := 0
	cancelledCount := 0
	for _, job := range allJobsAfter {
		if job.Status == oapi.JobStatusPending {
			pendingCount++
		}
		if job.Status == oapi.JobStatusCancelled {
			cancelledCount++
		}
	}

	if pendingCount != 1 {
		t.Errorf("expected 1 pending job after selector update, got %d", pendingCount)
	}
	if cancelledCount != 1 {
		t.Errorf("expected 1 cancelled job after selector update, got %d", cancelledCount)
	}
}

// TestEngine_EnvironmentSelectorUpdate_DoesNotCancelSuccessfulJobs verifies that
// jobs in Successful status are not cancelled when environment selectors change
func TestEngine_EnvironmentSelectorUpdate_DoesNotCancelSuccessfulJobs(t *testing.T) {
	systemId := uuid.New().String()
	environmentId := uuid.New().String()
	jobAgentId := uuid.New().String()
	resourceId1 := uuid.New().String()
	resourceId2 := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentId),
			integration.JobAgentName("Test Agent"),
		),
		integration.WithSystem(
			integration.SystemName("test-system"),
			integration.SystemID(systemId),
			integration.WithDeployment(
				integration.DeploymentName("deployment-with-agent"),
				integration.DeploymentCelResourceSelector("true"),
				integration.DeploymentJobAgent(jobAgentId),
				integration.WithDeploymentVersion(
					integration.DeploymentVersionTag("v1.0.0"),
				),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentId),
				integration.EnvironmentName("development"),
				integration.EnvironmentCelResourceSelector(`resource.metadata["env"] == "dev"`),
			),
		),
		integration.WithResource(
			integration.ResourceID(resourceId1),
			integration.ResourceName("resource-1"),
			integration.ResourceMetadata(map[string]string{"env": "dev"}),
		),
		integration.WithResource(
			integration.ResourceID(resourceId2),
			integration.ResourceName("resource-2"),
			integration.ResourceMetadata(map[string]string{"env": "dev"}),
		),
	)
	ctx := context.Background()

	// Get the jobs and mark them as Successful
	allJobs := engine.Workspace().Jobs().Items()
	if len(allJobs) != 2 {
		t.Fatalf("expected 2 jobs, got %d", len(allJobs))
	}

	for _, job := range allJobs {
		assert.NotNil(t, job.DispatchContext)
		job.Status = oapi.JobStatusSuccessful
		engine.Workspace().Jobs().Upsert(ctx, job)
	}

	// Verify jobs are Successful
	allJobsAfterSuccess := engine.Workspace().Jobs().Items()
	for _, job := range allJobsAfterSuccess {
		if job.Status != oapi.JobStatusSuccessful {
			t.Fatalf("expected job %s to have Successful status, got %v", job.Id, job.Status)
		}
	}

	t.Logf("Marked 2 jobs as Successful")

	// Update the environment selector to match only r1
	updatedEnv := c.NewEnvironment(systemId)
	updatedEnv.Id = environmentId
	updatedEnv.Name = "development"
	updatedSelector := &oapi.Selector{}
	_ = updatedSelector.FromJsonSelector(oapi.JsonSelector{Json: map[string]any{
		"type":     "name",
		"operator": "equals",
		"value":    "resource-1",
	}})
	updatedEnv.ResourceSelector = updatedSelector
	engine.PushEvent(ctx, handler.EnvironmentUpdate, updatedEnv)

	// Jobs in Successful state should NOT be cancelled
	allJobsAfterUpdate := engine.Workspace().Jobs().Items()
	r2, _ := engine.Workspace().Resources().Get(resourceId2)

	for _, job := range allJobsAfterUpdate {
		release, ok := engine.Workspace().Releases().Get(job.ReleaseId)
		if !ok {
			t.Fatalf("release %s not found for job %s", job.ReleaseId, job.Id)
		}

		if release.ReleaseTarget.ResourceId == r2.Id {
			// This job was for r2, which was removed from the environment
			// Successful jobs should NOT be cancelled
			if job.Status == oapi.JobStatusCancelled {
				t.Errorf("BUG DETECTED: Job %s for removed resource r2 was changed from Successful to Cancelled. "+
					"Jobs in exited states should not be cancelled when environment selectors change.", job.Id)
			}
			if job.Status != oapi.JobStatusSuccessful {
				t.Errorf("Job %s for removed resource r2 should still have Successful status, got %v",
					job.Id, job.Status)
			}
		}
	}
}

// TestEngine_DeploymentSelectorUpdate_DoesNotCancelExitedJobs tests that when
// a deployment's resource selector is updated to remove resources, jobs that
// are already in exited states should NOT be cancelled.
//
// This is the same bug but for deployment selectors instead of environment selectors.
func TestEngine_DeploymentSelectorUpdate_DoesNotCancelExitedJobs(t *testing.T) {
	systemId := uuid.New().String()
	deploymentId := uuid.New().String()
	resourceId1 := uuid.New().String()
	resourceId2 := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
		integration.WithSystem(
			integration.SystemName("test-system"),
			integration.SystemID(systemId),
			integration.WithDeployment(
				integration.DeploymentID(deploymentId),
				integration.DeploymentName("deployment-no-agent"),
				integration.DeploymentCelResourceSelector(`resource.metadata["type"] == "app"`),
				// No job agent configured - will create InvalidJobAgent jobs
			),
			integration.WithEnvironment(
				integration.EnvironmentName("production"),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceID(resourceId1),
			integration.ResourceName("app-1"),
			integration.ResourceMetadata(map[string]string{"type": "app"}),
		),
		integration.WithResource(
			integration.ResourceID(resourceId2),
			integration.ResourceName("app-2"),
			integration.ResourceMetadata(map[string]string{"type": "app"}),
		),
		integration.WithResource(
			integration.ResourceName("database-1"),
			integration.ResourceMetadata(map[string]string{"type": "database"}),
		),
	)
	ctx := context.Background()

	// Verify release targets were created (2 resources matching the deployment selector)
	releaseTargets, err := engine.Workspace().ReleaseTargets().Items()
	if err != nil {
		t.Fatalf("failed to get release targets: %v", err)
	}
	if len(releaseTargets) != 2 {
		t.Fatalf("expected 2 release targets (r1, r2), got %d", len(releaseTargets))
	}

	// Create a deployment version - this will create jobs with InvalidJobAgent status
	version := c.NewDeploymentVersion()
	version.DeploymentId = deploymentId
	version.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, version)

	// Verify jobs were created with InvalidJobAgent status
	allJobs := engine.Workspace().Jobs().Items()
	if len(allJobs) != 2 {
		t.Fatalf("expected 2 jobs, got %d", len(allJobs))
	}

	for _, job := range allJobs {
		if job.Status != oapi.JobStatusInvalidJobAgent {
			t.Fatalf("expected job %s to have InvalidJobAgent status, got %v", job.Id, job.Status)
		}
		assert.Nil(t, job.DispatchContext)
	}

	t.Log("Created 2 jobs with InvalidJobAgent status")

	// manually mark the jobs as Failure to prevent retriggering invalid job agent jobs
	for _, job := range allJobs {
		job.Status = oapi.JobStatusFailure
		engine.Workspace().Jobs().Upsert(ctx, job)
	}

	// Update the deployment selector to match only app-1 (exclude app-2)
	updatedDeployment := c.NewDeployment(systemId)
	updatedDeployment.Id = deploymentId
	updatedDeployment.Name = "deployment-no-agent"
	updatedSelector := &oapi.Selector{}
	_ = updatedSelector.FromJsonSelector(oapi.JsonSelector{Json: map[string]any{
		"type":     "name",
		"operator": "equals",
		"value":    "app-1", // Only match app-1 now
	}})
	updatedDeployment.ResourceSelector = updatedSelector
	engine.PushEvent(ctx, handler.DeploymentUpdate, updatedDeployment)

	// Verify release targets - should now only have 1 (for r1)
	releaseTargetsAfter, err := engine.Workspace().ReleaseTargets().Items()
	if err != nil {
		t.Fatalf("failed to get release targets after update: %v", err)
	}
	if len(releaseTargetsAfter) != 1 {
		t.Fatalf("expected 1 release target after selector update, got %d", len(releaseTargetsAfter))
	}

	// THE BUG: Jobs that are already in InvalidJobAgent status (an exited state)
	// should NOT be changed to Cancelled status when the deployment selector is updated
	allJobsAfter := engine.Workspace().Jobs().Items()
	if len(allJobsAfter) != 2 {
		t.Fatalf("expected 2 jobs to still exist after selector update, got %d", len(allJobsAfter))
	}

	r1, _ := engine.Workspace().Resources().Get(resourceId1)
	r2, _ := engine.Workspace().Resources().Get(resourceId2)

	for _, job := range allJobsAfter {
		release, ok := engine.Workspace().Releases().Get(job.ReleaseId)
		if !ok {
			t.Fatalf("release %s not found for job %s", job.ReleaseId, job.Id)
		}

		switch release.ReleaseTarget.ResourceId {
		case r2.Id:
			// This job was for r2 (app-2), which was removed from the deployment
			// It should still have InvalidJobAgent status, NOT Cancelled
			if job.Status == oapi.JobStatusCancelled {
				t.Errorf("BUG DETECTED: Job %s for removed resource r2 was changed from InvalidJobAgent to Cancelled. "+
					"Jobs in exited states should not be cancelled when deployment selectors change.", job.Id)
			}
			if job.Status != oapi.JobStatusFailure {
				t.Errorf("Job %s for removed resource r2 should still have Failure status, got %v",
					job.Id, job.Status)
			}
		case r1.Id:
			// This job is for r1, which is still in the deployment
			if job.Status != oapi.JobStatusFailure {
				t.Errorf("Job %s for resource r1 should still have Failure status, got %v",
					job.Id, job.Status)
			}
		}
	}
}

// TestEngine_DeploymentSelectorUpdate_DoesNotCancelFailedJobs tests that
// jobs in Failure status are not cancelled when deployment selectors change
func TestEngine_DeploymentSelectorUpdate_DoesNotCancelFailedJobs(t *testing.T) {
	systemId := uuid.New().String()
	deploymentId := uuid.New().String()
	jobAgentId := uuid.New().String()
	resourceId1 := uuid.New().String()
	resourceId2 := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentId),
			integration.JobAgentName("Test Agent"),
		),
		integration.WithSystem(
			integration.SystemName("test-system"),
			integration.SystemID(systemId),
			integration.WithDeployment(
				integration.DeploymentID(deploymentId),
				integration.DeploymentName("deployment-with-agent"),
				integration.DeploymentJobAgent(jobAgentId),
				integration.DeploymentCelResourceSelector(`resource.metadata["type"] == "app"`),
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
			integration.ResourceID(resourceId1),
			integration.ResourceName("app-1"),
			integration.ResourceMetadata(map[string]string{"type": "app"}),
		),
		integration.WithResource(
			integration.ResourceID(resourceId2),
			integration.ResourceName("app-2"),
			integration.ResourceMetadata(map[string]string{"type": "app"}),
		),
	)
	ctx := context.Background()

	// Get the jobs and mark them as Failure
	allJobs := engine.Workspace().Jobs().Items()
	if len(allJobs) != 2 {
		t.Fatalf("expected 2 jobs, got %d", len(allJobs))
	}

	for _, job := range allJobs {
		job.Status = oapi.JobStatusFailure
		engine.Workspace().Jobs().Upsert(ctx, job)
	}

	t.Logf("Marked 2 jobs as Failure")

	// Update the deployment selector to match only app-1
	updatedDeployment := c.NewDeployment(systemId)
	updatedDeployment.Id = deploymentId
	updatedDeployment.Name = "deployment-with-agent"
	updatedDeployment.JobAgentId = &jobAgentId
	updatedSelector := &oapi.Selector{}
	_ = updatedSelector.FromJsonSelector(oapi.JsonSelector{Json: map[string]any{
		"type":     "name",
		"operator": "equals",
		"value":    "app-1",
	}})
	updatedDeployment.ResourceSelector = updatedSelector
	engine.PushEvent(ctx, handler.DeploymentUpdate, updatedDeployment)

	// Jobs in Failure state should NOT be cancelled
	allJobsAfterUpdate := engine.Workspace().Jobs().Items()
	r2, _ := engine.Workspace().Resources().Get(resourceId2)

	for _, job := range allJobsAfterUpdate {
		release, ok := engine.Workspace().Releases().Get(job.ReleaseId)
		if !ok {
			t.Fatalf("release %s not found for job %s", job.ReleaseId, job.Id)
		}

		if release.ReleaseTarget.ResourceId == r2.Id {
			// This job was for r2, which was removed from the deployment
			// Failed jobs should NOT be cancelled
			if job.Status == oapi.JobStatusCancelled {
				t.Errorf("BUG DETECTED: Job %s for removed resource r2 was changed from Failure to Cancelled. "+
					"Jobs in exited states should not be cancelled when deployment selectors change.", job.Id)
			}
			if job.Status != oapi.JobStatusFailure {
				t.Errorf("Job %s for removed resource r2 should still have Failure status, got %v",
					job.Id, job.Status)
			}
		}
	}
}

// TestEngine_MultipleExitedStates_NeverUpdated tests that ALL exited states
// (InvalidJobAgent, Successful, Failure, Skipped, etc.) are preserved when selectors change
func TestEngine_MultipleExitedStates_NeverUpdated(t *testing.T) {
	systemId := uuid.New().String()
	environmentId := uuid.New().String()
	jobAgentId := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentId),
			integration.JobAgentName("Test Agent"),
		),
		integration.WithSystem(
			integration.SystemName("test-system"),
			integration.SystemID(systemId),
			integration.WithDeployment(
				integration.DeploymentName("deployment"),
				integration.DeploymentCelResourceSelector("true"),
				integration.DeploymentJobAgent(jobAgentId),
				integration.WithDeploymentVersion(
					integration.DeploymentVersionTag("v1.0.0"),
				),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentId),
				integration.EnvironmentName("production"),
				integration.EnvironmentCelResourceSelector(`resource.metadata["env"] == "prod"`),
			),
		),
		integration.WithResource(
			integration.ResourceName("resource-1"),
			integration.ResourceMetadata(map[string]string{"env": "prod"}),
		),
		integration.WithResource(
			integration.ResourceName("resource-2"),
			integration.ResourceMetadata(map[string]string{"env": "prod"}),
		),
		integration.WithResource(
			integration.ResourceName("resource-3"),
			integration.ResourceMetadata(map[string]string{"env": "prod"}),
		),
		integration.WithResource(
			integration.ResourceName("resource-4"),
			integration.ResourceMetadata(map[string]string{"env": "prod"}),
		),
	)
	ctx := context.Background()

	// Get all jobs
	allJobs := engine.Workspace().Jobs().Items()
	if len(allJobs) != 4 {
		t.Fatalf("expected 4 jobs, got %d", len(allJobs))
	}

	// Set different exited states for each job
	exitedStates := []oapi.JobStatus{
		oapi.JobStatusSuccessful,
		oapi.JobStatusFailure,
		oapi.JobStatusSkipped,
		oapi.JobStatusCancelled, // Even already-cancelled jobs shouldn't be "re-cancelled"
	}

	jobIndex := 0
	for _, job := range allJobs {
		job.Status = exitedStates[jobIndex]
		engine.Workspace().Jobs().Upsert(ctx, job)
		jobIndex++
	}

	t.Logf("Set jobs to different exited states: Successful, Failure, Skipped, Cancelled")

	// Update environment selector to match only resource-1
	updatedEnv := c.NewEnvironment(systemId)
	updatedEnv.Id = environmentId
	updatedEnv.Name = "production"
	updatedSelector := &oapi.Selector{}
	_ = updatedSelector.FromJsonSelector(oapi.JsonSelector{Json: map[string]any{
		"type":     "name",
		"operator": "equals",
		"value":    "resource-1",
	}})
	updatedEnv.ResourceSelector = updatedSelector
	engine.PushEvent(ctx, handler.EnvironmentUpdate, updatedEnv)

	// ALL jobs should maintain their original exited states
	allJobsAfter := engine.Workspace().Jobs().Items()

	statusCounts := make(map[oapi.JobStatus]int)
	for _, job := range allJobsAfter {
		statusCounts[job.Status]++
	}

	// Verify we still have the same number of each status
	expectedCounts := map[oapi.JobStatus]int{
		oapi.JobStatusSuccessful: 1,
		oapi.JobStatusFailure:    1,
		oapi.JobStatusSkipped:    1,
		oapi.JobStatusCancelled:  1,
	}

	hasError := false
	for status, expectedCount := range expectedCounts {
		actualCount := statusCounts[status]
		if actualCount != expectedCount {
			t.Errorf("Expected %d jobs with status %v, got %d", expectedCount, status, actualCount)
			hasError = true
		}
	}

	if hasError {
		t.Error("BUG DETECTED: Jobs in exited states were modified when environment selector changed")
		t.Logf("Actual status counts: %v", statusCounts)
	}
}

// TestEngine_EnvironmentSelectorUpdate_CancelsInProgressJobs verifies that
// jobs in InProgress status (a processing state) SHOULD be cancelled
func TestEngine_EnvironmentSelectorUpdate_CancelsInProgressJobs(t *testing.T) {
	systemId := uuid.New().String()
	environmentId := uuid.New().String()
	jobAgentId := uuid.New().String()
	resourceId1 := uuid.New().String()
	resourceId2 := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentId),
			integration.JobAgentName("Test Agent"),
		),
		integration.WithSystem(
			integration.SystemName("test-system"),
			integration.SystemID(systemId),
			integration.WithDeployment(
				integration.DeploymentName("deployment-with-agent"),
				integration.DeploymentCelResourceSelector("true"),
				integration.DeploymentJobAgent(jobAgentId),
				integration.WithDeploymentVersion(
					integration.DeploymentVersionTag("v1.0.0"),
				),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentId),
				integration.EnvironmentName("production"),
				integration.EnvironmentCelResourceSelector(`resource.metadata["env"] == "prod"`),
			),
		),
		integration.WithResource(
			integration.ResourceID(resourceId1),
			integration.ResourceName("resource-1"),
			integration.ResourceMetadata(map[string]string{"env": "prod"}),
		),
		integration.WithResource(
			integration.ResourceID(resourceId2),
			integration.ResourceName("resource-2"),
			integration.ResourceMetadata(map[string]string{"env": "prod"}),
		),
	)
	ctx := context.Background()

	// Get jobs and mark them as InProgress
	allJobs := engine.Workspace().Jobs().Items()
	if len(allJobs) != 2 {
		t.Fatalf("expected 2 jobs, got %d", len(allJobs))
	}

	for _, job := range allJobs {
		assert.NotNil(t, job.DispatchContext)
		job.Status = oapi.JobStatusInProgress
		engine.Workspace().Jobs().Upsert(ctx, job)
	}

	t.Logf("Marked 2 jobs as InProgress")

	// Update environment selector to match only r1
	updatedEnv := c.NewEnvironment(systemId)
	updatedEnv.Id = environmentId
	updatedEnv.Name = "production"
	updatedSelector := &oapi.Selector{}
	_ = updatedSelector.FromJsonSelector(oapi.JsonSelector{Json: map[string]any{
		"type":     "name",
		"operator": "equals",
		"value":    "resource-1",
	}})
	updatedEnv.ResourceSelector = updatedSelector
	engine.PushEvent(ctx, handler.EnvironmentUpdate, updatedEnv)

	// Jobs in InProgress state SHOULD be cancelled (it's a processing state)
	allJobsAfter := engine.Workspace().Jobs().Items()
	r1, _ := engine.Workspace().Resources().Get(resourceId1)
	r2, _ := engine.Workspace().Resources().Get(resourceId2)

	for _, job := range allJobsAfter {
		release, ok := engine.Workspace().Releases().Get(job.ReleaseId)
		if !ok {
			t.Fatalf("release %s not found for job %s", job.ReleaseId, job.Id)
		}

		switch release.ReleaseTarget.ResourceId {
		case r2.Id:
			// This job was for r2, which was removed
			// InProgress jobs SHOULD be cancelled
			if job.Status != oapi.JobStatusCancelled {
				t.Errorf("Job %s for removed resource r2 should be Cancelled, got %v", job.Id, job.Status)
			}
		case r1.Id:
			// This job is for r1, which is still in the environment
			if job.Status != oapi.JobStatusInProgress {
				t.Errorf("Job %s for resource r1 should still be InProgress, got %v", job.Id, job.Status)
			}
		}
	}

	// Verify counts
	inProgressCount := 0
	cancelledCount := 0
	for _, job := range allJobsAfter {
		if job.Status == oapi.JobStatusInProgress {
			inProgressCount++
		}
		if job.Status == oapi.JobStatusCancelled {
			cancelledCount++
		}
	}

	if inProgressCount != 1 {
		t.Errorf("expected 1 InProgress job after selector update, got %d", inProgressCount)
	}
	if cancelledCount != 1 {
		t.Errorf("expected 1 cancelled job after selector update, got %d", cancelledCount)
	}
}
