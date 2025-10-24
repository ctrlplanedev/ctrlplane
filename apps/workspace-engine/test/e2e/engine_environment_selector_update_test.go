package e2e

import (
	"context"
	"testing"
	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/oapi"
	"workspace-engine/test/integration"
	c "workspace-engine/test/integration/creators"
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
	engine := integration.NewTestWorkspace(t)
	workspaceID := engine.Workspace().ID
	ctx := context.Background()

	// Create a system
	sys := c.NewSystem(workspaceID)
	sys.Name = "test-system"
	engine.PushEvent(ctx, handler.SystemCreate, sys)

	// Create a deployment WITHOUT a job agent (will create InvalidJobAgent jobs)
	deployment := c.NewDeployment(sys.Id)
	deployment.Name = "deployment-no-agent"
	deployment.JobAgentId = nil // No job agent configured
	engine.PushEvent(ctx, handler.DeploymentCreate, deployment)

	// Create an environment with selector matching resources with env=dev
	env := c.NewEnvironment(sys.Id)
	env.Name = "development"
	envSelector := &oapi.Selector{}
	_ = envSelector.FromJsonSelector(oapi.JsonSelector{Json: map[string]any{
		"type":     "metadata",
		"operator": "equals",
		"value":    "dev",
		"key":      "env",
	}})
	env.ResourceSelector = envSelector
	engine.PushEvent(ctx, handler.EnvironmentCreate, env)

	// Create resources - r1 and r2 match the environment selector, r3 does not
	r1 := c.NewResource(workspaceID)
	r1.Name = "resource-1"
	r1.Metadata = map[string]string{"env": "dev"}
	engine.PushEvent(ctx, handler.ResourceCreate, r1)

	r2 := c.NewResource(workspaceID)
	r2.Name = "resource-2"
	r2.Metadata = map[string]string{"env": "dev"}
	engine.PushEvent(ctx, handler.ResourceCreate, r2)

	r3 := c.NewResource(workspaceID)
	r3.Name = "resource-3"
	r3.Metadata = map[string]string{"env": "prod"}
	engine.PushEvent(ctx, handler.ResourceCreate, r3)

	// Verify release targets were created (2 resources matching the selector)
	releaseTargets, err := engine.Workspace().ReleaseTargets().Items(ctx)
	if err != nil {
		t.Fatalf("failed to get release targets: %v", err)
	}
	if len(releaseTargets) != 2 {
		t.Fatalf("expected 2 release targets (r1, r2), got %d", len(releaseTargets))
	}

	// Create a deployment version - this will create jobs with InvalidJobAgent status
	version := c.NewDeploymentVersion()
	version.DeploymentId = deployment.Id
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
		if job.Status != oapi.InvalidJobAgent {
			t.Fatalf("expected job %s to have InvalidJobAgent status, got %v", job.Id, job.Status)
		}
	}

	t.Logf("Created 2 jobs with InvalidJobAgent status: %v", jobIDs)

	// Update the environment selector to match only r1 (exclude r2)
	// This simulates removing resources from an environment
	updatedEnv := env
	updatedSelector := &oapi.Selector{}
	_ = updatedSelector.FromJsonSelector(oapi.JsonSelector{Json: map[string]any{
		"type":     "name",
		"operator": "equals",
		"value":    "resource-1", // Only match resource-1 now
	}})
	updatedEnv.ResourceSelector = updatedSelector
	engine.PushEvent(ctx, handler.EnvironmentUpdate, updatedEnv)

	// Verify release targets - should now only have 1 (for r1)
	releaseTargetsAfter, err := engine.Workspace().ReleaseTargets().Items(ctx)
	if err != nil {
		t.Fatalf("failed to get release targets after update: %v", err)
	}
	if len(releaseTargetsAfter) != 1 {
		t.Fatalf("expected 1 release target after selector update, got %d", len(releaseTargetsAfter))
	}

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
			if job.Status == oapi.Cancelled {
				t.Errorf("BUG DETECTED: Job %s for removed resource r2 was changed from InvalidJobAgent to Cancelled. "+
					"Jobs in exited states should not be cancelled when environment selectors change.", job.Id)
			}
			if job.Status != oapi.InvalidJobAgent {
				t.Errorf("Job %s for removed resource r2 should still have InvalidJobAgent status, got %v",
					job.Id, job.Status)
			}
		case r1.Id:
			// This job is for r1, which is still in the environment
			if job.Status != oapi.InvalidJobAgent {
				t.Errorf("Job %s for resource r1 should still have InvalidJobAgent status, got %v",
					job.Id, job.Status)
			}
		}
	}
}

// TestEngine_EnvironmentSelectorUpdate_CancelsPendingJobs verifies the CORRECT behavior:
// Jobs in processing states (Pending, InProgress) SHOULD be cancelled when resources are removed
func TestEngine_EnvironmentSelectorUpdate_CancelsPendingJobs(t *testing.T) {
	engine := integration.NewTestWorkspace(t)
	workspaceID := engine.Workspace().ID
	ctx := context.Background()

	// Create a job agent (so jobs will be in Pending state, not InvalidJobAgent)
	jobAgent := c.NewJobAgent(workspaceID)
	engine.PushEvent(ctx, handler.JobAgentCreate, jobAgent)

	// Create a system
	sys := c.NewSystem(workspaceID)
	sys.Name = "test-system"
	engine.PushEvent(ctx, handler.SystemCreate, sys)

	// Create a deployment WITH a job agent
	deployment := c.NewDeployment(sys.Id)
	deployment.Name = "deployment-with-agent"
	deployment.JobAgentId = &jobAgent.Id
	engine.PushEvent(ctx, handler.DeploymentCreate, deployment)

	// Create an environment with selector matching resources with env=dev
	env := c.NewEnvironment(sys.Id)
	env.Name = "development"
	envSelector := &oapi.Selector{}
	_ = envSelector.FromJsonSelector(oapi.JsonSelector{Json: map[string]any{
		"type":     "metadata",
		"operator": "equals",
		"value":    "dev",
		"key":      "env",
	}})
	env.ResourceSelector = envSelector
	engine.PushEvent(ctx, handler.EnvironmentCreate, env)

	// Create resources that match the environment selector
	r1 := c.NewResource(workspaceID)
	r1.Name = "resource-1"
	r1.Metadata = map[string]string{"env": "dev"}
	engine.PushEvent(ctx, handler.ResourceCreate, r1)

	r2 := c.NewResource(workspaceID)
	r2.Name = "resource-2"
	r2.Metadata = map[string]string{"env": "dev"}
	engine.PushEvent(ctx, handler.ResourceCreate, r2)

	// Create a deployment version - this will create jobs in Pending status
	version := c.NewDeploymentVersion()
	version.DeploymentId = deployment.Id
	version.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, version)

	// Verify jobs were created with Pending status
	pendingJobs := engine.Workspace().Jobs().GetPending()
	if len(pendingJobs) != 2 {
		t.Fatalf("expected 2 pending jobs, got %d", len(pendingJobs))
	}

	// Store job IDs
	jobIDs := make([]string, 0)
	for _, job := range pendingJobs {
		jobIDs = append(jobIDs, job.Id)
		if job.Status != oapi.Pending {
			t.Fatalf("expected job %s to have Pending status, got %v", job.Id, job.Status)
		}
	}

	t.Logf("Created 2 jobs with Pending status: %v", jobIDs)

	// Update the environment selector to match only r1 (exclude r2)
	updatedEnv := env
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

	for _, job := range allJobsAfter {
		release, ok := engine.Workspace().Releases().Get(job.ReleaseId)
		if !ok {
			t.Fatalf("release %s not found for job %s", job.ReleaseId, job.Id)
		}

		switch release.ReleaseTarget.ResourceId {
		case r2.Id:
			// This job was for r2, which was removed from the environment
			// Pending jobs SHOULD be cancelled
			if job.Status != oapi.Cancelled {
				t.Errorf("Job %s for removed resource r2 should be Cancelled, got %v", job.Id, job.Status)
			}
		case r1.Id:
			// This job is for r1, which is still in the environment
			if job.Status != oapi.Pending {
				t.Errorf("Job %s for resource r1 should still be Pending, got %v", job.Id, job.Status)
			}
		}
	}

	// Verify we have 1 Pending job and 1 Cancelled job
	pendingCount := 0
	cancelledCount := 0
	for _, job := range allJobsAfter {
		if job.Status == oapi.Pending {
			pendingCount++
		}
		if job.Status == oapi.Cancelled {
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
	engine := integration.NewTestWorkspace(t)
	workspaceID := engine.Workspace().ID
	ctx := context.Background()

	// Create a job agent
	jobAgent := c.NewJobAgent(workspaceID)
	engine.PushEvent(ctx, handler.JobAgentCreate, jobAgent)

	// Create a system
	sys := c.NewSystem(workspaceID)
	sys.Name = "test-system"
	engine.PushEvent(ctx, handler.SystemCreate, sys)

	// Create a deployment
	deployment := c.NewDeployment(sys.Id)
	deployment.Name = "deployment-with-agent"
	deployment.JobAgentId = &jobAgent.Id
	engine.PushEvent(ctx, handler.DeploymentCreate, deployment)

	// Create an environment
	env := c.NewEnvironment(sys.Id)
	env.Name = "development"
	envSelector := &oapi.Selector{}
	_ = envSelector.FromJsonSelector(oapi.JsonSelector{Json: map[string]any{
		"type":     "metadata",
		"operator": "equals",
		"value":    "dev",
		"key":      "env",
	}})
	env.ResourceSelector = envSelector
	engine.PushEvent(ctx, handler.EnvironmentCreate, env)

	// Create resources
	r1 := c.NewResource(workspaceID)
	r1.Name = "resource-1"
	r1.Metadata = map[string]string{"env": "dev"}
	engine.PushEvent(ctx, handler.ResourceCreate, r1)

	r2 := c.NewResource(workspaceID)
	r2.Name = "resource-2"
	r2.Metadata = map[string]string{"env": "dev"}
	engine.PushEvent(ctx, handler.ResourceCreate, r2)

	// Create a deployment version
	version := c.NewDeploymentVersion()
	version.DeploymentId = deployment.Id
	version.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, version)

	// Get the jobs and mark them as Successful
	allJobs := engine.Workspace().Jobs().Items()
	if len(allJobs) != 2 {
		t.Fatalf("expected 2 jobs, got %d", len(allJobs))
	}

	for _, job := range allJobs {
		job.Status = oapi.Successful
		engine.Workspace().Jobs().Upsert(ctx, job)
	}

	// Verify jobs are Successful
	allJobsAfterSuccess := engine.Workspace().Jobs().Items()
	for _, job := range allJobsAfterSuccess {
		if job.Status != oapi.Successful {
			t.Fatalf("expected job %s to have Successful status, got %v", job.Id, job.Status)
		}
	}

	t.Logf("Marked 2 jobs as Successful")

	// Update the environment selector to match only r1
	updatedEnv := env
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

	for _, job := range allJobsAfterUpdate {
		release, ok := engine.Workspace().Releases().Get(job.ReleaseId)
		if !ok {
			t.Fatalf("release %s not found for job %s", job.ReleaseId, job.Id)
		}

		if release.ReleaseTarget.ResourceId == r2.Id {
			// This job was for r2, which was removed from the environment
			// Successful jobs should NOT be cancelled
			if job.Status == oapi.Cancelled {
				t.Errorf("BUG DETECTED: Job %s for removed resource r2 was changed from Successful to Cancelled. "+
					"Jobs in exited states should not be cancelled when environment selectors change.", job.Id)
			}
			if job.Status != oapi.Successful {
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
	engine := integration.NewTestWorkspace(t)
	workspaceID := engine.Workspace().ID
	ctx := context.Background()

	// Create a system
	sys := c.NewSystem(workspaceID)
	sys.Name = "test-system"
	engine.PushEvent(ctx, handler.SystemCreate, sys)

	// Create a deployment WITHOUT a job agent with a selector matching resources with type=app
	deployment := c.NewDeployment(sys.Id)
	deployment.Name = "deployment-no-agent"
	deployment.JobAgentId = nil // No job agent configured
	deploymentSelector := &oapi.Selector{}
	_ = deploymentSelector.FromJsonSelector(oapi.JsonSelector{Json: map[string]any{
		"type":     "metadata",
		"operator": "equals",
		"value":    "app",
		"key":      "type",
	}})
	deployment.ResourceSelector = deploymentSelector
	engine.PushEvent(ctx, handler.DeploymentCreate, deployment)

	// Create an environment (matches all resources)
	env := c.NewEnvironment(sys.Id)
	env.Name = "production"
	engine.PushEvent(ctx, handler.EnvironmentCreate, env)

	// Create resources - r1 and r2 match the deployment selector, r3 does not
	r1 := c.NewResource(workspaceID)
	r1.Name = "app-1"
	r1.Metadata = map[string]string{"type": "app"}
	engine.PushEvent(ctx, handler.ResourceCreate, r1)

	r2 := c.NewResource(workspaceID)
	r2.Name = "app-2"
	r2.Metadata = map[string]string{"type": "app"}
	engine.PushEvent(ctx, handler.ResourceCreate, r2)

	r3 := c.NewResource(workspaceID)
	r3.Name = "database-1"
	r3.Metadata = map[string]string{"type": "database"}
	engine.PushEvent(ctx, handler.ResourceCreate, r3)

	// Verify release targets were created (2 resources matching the deployment selector)
	releaseTargets, err := engine.Workspace().ReleaseTargets().Items(ctx)
	if err != nil {
		t.Fatalf("failed to get release targets: %v", err)
	}
	if len(releaseTargets) != 2 {
		t.Fatalf("expected 2 release targets (r1, r2), got %d", len(releaseTargets))
	}

	// Create a deployment version - this will create jobs with InvalidJobAgent status
	version := c.NewDeploymentVersion()
	version.DeploymentId = deployment.Id
	version.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, version)

	// Verify jobs were created with InvalidJobAgent status
	allJobs := engine.Workspace().Jobs().Items()
	if len(allJobs) != 2 {
		t.Fatalf("expected 2 jobs, got %d", len(allJobs))
	}

	for _, job := range allJobs {
		if job.Status != oapi.InvalidJobAgent {
			t.Fatalf("expected job %s to have InvalidJobAgent status, got %v", job.Id, job.Status)
		}
	}

	t.Logf("Created 2 jobs with InvalidJobAgent status")

	// Update the deployment selector to match only app-1 (exclude app-2)
	updatedDeployment := deployment
	updatedSelector := &oapi.Selector{}
	_ = updatedSelector.FromJsonSelector(oapi.JsonSelector{Json: map[string]any{
		"type":     "name",
		"operator": "equals",
		"value":    "app-1", // Only match app-1 now
	}})
	updatedDeployment.ResourceSelector = updatedSelector
	engine.PushEvent(ctx, handler.DeploymentUpdate, updatedDeployment)

	// Verify release targets - should now only have 1 (for r1)
	releaseTargetsAfter, err := engine.Workspace().ReleaseTargets().Items(ctx)
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

	for _, job := range allJobsAfter {
		release, ok := engine.Workspace().Releases().Get(job.ReleaseId)
		if !ok {
			t.Fatalf("release %s not found for job %s", job.ReleaseId, job.Id)
		}

		switch release.ReleaseTarget.ResourceId {
		case r2.Id:
			// This job was for r2 (app-2), which was removed from the deployment
			// It should still have InvalidJobAgent status, NOT Cancelled
			if job.Status == oapi.Cancelled {
				t.Errorf("BUG DETECTED: Job %s for removed resource r2 was changed from InvalidJobAgent to Cancelled. "+
					"Jobs in exited states should not be cancelled when deployment selectors change.", job.Id)
			}
			if job.Status != oapi.InvalidJobAgent {
				t.Errorf("Job %s for removed resource r2 should still have InvalidJobAgent status, got %v",
					job.Id, job.Status)
			}
		case r1.Id:
			// This job is for r1, which is still in the deployment
			if job.Status != oapi.InvalidJobAgent {
				t.Errorf("Job %s for resource r1 should still have InvalidJobAgent status, got %v",
					job.Id, job.Status)
			}
		}
	}
}

// TestEngine_DeploymentSelectorUpdate_DoesNotCancelFailedJobs tests that
// jobs in Failure status are not cancelled when deployment selectors change
func TestEngine_DeploymentSelectorUpdate_DoesNotCancelFailedJobs(t *testing.T) {
	engine := integration.NewTestWorkspace(t)
	workspaceID := engine.Workspace().ID
	ctx := context.Background()

	// Create a job agent
	jobAgent := c.NewJobAgent(workspaceID)
	engine.PushEvent(ctx, handler.JobAgentCreate, jobAgent)

	// Create a system
	sys := c.NewSystem(workspaceID)
	sys.Name = "test-system"
	engine.PushEvent(ctx, handler.SystemCreate, sys)

	// Create a deployment with a selector
	deployment := c.NewDeployment(sys.Id)
	deployment.Name = "deployment-with-agent"
	deployment.JobAgentId = &jobAgent.Id
	deploymentSelector := &oapi.Selector{}
	_ = deploymentSelector.FromJsonSelector(oapi.JsonSelector{Json: map[string]any{
		"type":     "metadata",
		"operator": "equals",
		"value":    "app",
		"key":      "type",
	}})
	deployment.ResourceSelector = deploymentSelector
	engine.PushEvent(ctx, handler.DeploymentCreate, deployment)

	// Create an environment
	env := c.NewEnvironment(sys.Id)
	env.Name = "production"
	engine.PushEvent(ctx, handler.EnvironmentCreate, env)

	// Create resources
	r1 := c.NewResource(workspaceID)
	r1.Name = "app-1"
	r1.Metadata = map[string]string{"type": "app"}
	engine.PushEvent(ctx, handler.ResourceCreate, r1)

	r2 := c.NewResource(workspaceID)
	r2.Name = "app-2"
	r2.Metadata = map[string]string{"type": "app"}
	engine.PushEvent(ctx, handler.ResourceCreate, r2)

	// Create a deployment version
	version := c.NewDeploymentVersion()
	version.DeploymentId = deployment.Id
	version.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, version)

	// Get the jobs and mark them as Failure
	allJobs := engine.Workspace().Jobs().Items()
	if len(allJobs) != 2 {
		t.Fatalf("expected 2 jobs, got %d", len(allJobs))
	}

	for _, job := range allJobs {
		job.Status = oapi.Failure
		engine.Workspace().Jobs().Upsert(ctx, job)
	}

	t.Logf("Marked 2 jobs as Failure")

	// Update the deployment selector to match only app-1
	updatedDeployment := deployment
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

	for _, job := range allJobsAfterUpdate {
		release, ok := engine.Workspace().Releases().Get(job.ReleaseId)
		if !ok {
			t.Fatalf("release %s not found for job %s", job.ReleaseId, job.Id)
		}

		if release.ReleaseTarget.ResourceId == r2.Id {
			// This job was for r2, which was removed from the deployment
			// Failed jobs should NOT be cancelled
			if job.Status == oapi.Cancelled {
				t.Errorf("BUG DETECTED: Job %s for removed resource r2 was changed from Failure to Cancelled. "+
					"Jobs in exited states should not be cancelled when deployment selectors change.", job.Id)
			}
			if job.Status != oapi.Failure {
				t.Errorf("Job %s for removed resource r2 should still have Failure status, got %v",
					job.Id, job.Status)
			}
		}
	}
}

// TestEngine_MultipleExitedStates_NeverUpdated tests that ALL exited states
// (InvalidJobAgent, Successful, Failure, Skipped, etc.) are preserved when selectors change
func TestEngine_MultipleExitedStates_NeverUpdated(t *testing.T) {
	engine := integration.NewTestWorkspace(t)
	workspaceID := engine.Workspace().ID
	ctx := context.Background()

	// Create a job agent
	jobAgent := c.NewJobAgent(workspaceID)
	engine.PushEvent(ctx, handler.JobAgentCreate, jobAgent)

	// Create a system
	sys := c.NewSystem(workspaceID)
	sys.Name = "test-system"
	engine.PushEvent(ctx, handler.SystemCreate, sys)

	// Create a deployment
	deployment := c.NewDeployment(sys.Id)
	deployment.Name = "deployment"
	deployment.JobAgentId = &jobAgent.Id
	engine.PushEvent(ctx, handler.DeploymentCreate, deployment)

	// Create an environment with a selector
	env := c.NewEnvironment(sys.Id)
	env.Name = "production"
	envSelector := &oapi.Selector{}
	_ = envSelector.FromJsonSelector(oapi.JsonSelector{Json: map[string]any{
		"type":     "metadata",
		"operator": "equals",
		"value":    "prod",
		"key":      "env",
	}})
	env.ResourceSelector = envSelector
	engine.PushEvent(ctx, handler.EnvironmentCreate, env)

	// Create 4 resources that match
	resources := make([]*oapi.Resource, 4)
	for i := 0; i < 4; i++ {
		r := c.NewResource(workspaceID)
		r.Name = "resource-" + string(rune('1'+i))
		r.Metadata = map[string]string{"env": "prod"}
		engine.PushEvent(ctx, handler.ResourceCreate, r)
		resources[i] = r
	}

	// Create a deployment version
	version := c.NewDeploymentVersion()
	version.DeploymentId = deployment.Id
	version.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, version)

	// Get all jobs
	allJobs := engine.Workspace().Jobs().Items()
	if len(allJobs) != 4 {
		t.Fatalf("expected 4 jobs, got %d", len(allJobs))
	}

	// Set different exited states for each job
	exitedStates := []oapi.JobStatus{
		oapi.Successful,
		oapi.Failure,
		oapi.Skipped,
		oapi.Cancelled, // Even already-cancelled jobs shouldn't be "re-cancelled"
	}

	jobIndex := 0
	for _, job := range allJobs {
		job.Status = exitedStates[jobIndex]
		engine.Workspace().Jobs().Upsert(ctx, job)
		jobIndex++
	}

	t.Logf("Set jobs to different exited states: Successful, Failure, Skipped, Cancelled")

	// Update environment selector to match only resource-1
	updatedEnv := env
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
		oapi.Successful: 1,
		oapi.Failure:    1,
		oapi.Skipped:    1,
		oapi.Cancelled:  1,
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
	engine := integration.NewTestWorkspace(t)
	workspaceID := engine.Workspace().ID
	ctx := context.Background()

	// Create a job agent
	jobAgent := c.NewJobAgent(workspaceID)
	engine.PushEvent(ctx, handler.JobAgentCreate, jobAgent)

	// Create a system
	sys := c.NewSystem(workspaceID)
	sys.Name = "test-system"
	engine.PushEvent(ctx, handler.SystemCreate, sys)

	// Create a deployment
	deployment := c.NewDeployment(sys.Id)
	deployment.Name = "deployment-with-agent"
	deployment.JobAgentId = &jobAgent.Id
	engine.PushEvent(ctx, handler.DeploymentCreate, deployment)

	// Create an environment
	env := c.NewEnvironment(sys.Id)
	env.Name = "production"
	envSelector := &oapi.Selector{}
	_ = envSelector.FromJsonSelector(oapi.JsonSelector{Json: map[string]any{
		"type":     "metadata",
		"operator": "equals",
		"value":    "prod",
		"key":      "env",
	}})
	env.ResourceSelector = envSelector
	engine.PushEvent(ctx, handler.EnvironmentCreate, env)

	// Create resources
	r1 := c.NewResource(workspaceID)
	r1.Name = "resource-1"
	r1.Metadata = map[string]string{"env": "prod"}
	engine.PushEvent(ctx, handler.ResourceCreate, r1)

	r2 := c.NewResource(workspaceID)
	r2.Name = "resource-2"
	r2.Metadata = map[string]string{"env": "prod"}
	engine.PushEvent(ctx, handler.ResourceCreate, r2)

	// Create a deployment version
	version := c.NewDeploymentVersion()
	version.DeploymentId = deployment.Id
	version.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, version)

	// Get jobs and mark them as InProgress
	allJobs := engine.Workspace().Jobs().Items()
	if len(allJobs) != 2 {
		t.Fatalf("expected 2 jobs, got %d", len(allJobs))
	}

	for _, job := range allJobs {
		job.Status = oapi.InProgress
		engine.Workspace().Jobs().Upsert(ctx, job)
	}

	t.Logf("Marked 2 jobs as InProgress")

	// Update environment selector to match only r1
	updatedEnv := env
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

	for _, job := range allJobsAfter {
		release, ok := engine.Workspace().Releases().Get(job.ReleaseId)
		if !ok {
			t.Fatalf("release %s not found for job %s", job.ReleaseId, job.Id)
		}

		if release.ReleaseTarget.ResourceId == r2.Id {
			// This job was for r2, which was removed
			// InProgress jobs SHOULD be cancelled
			if job.Status != oapi.Cancelled {
				t.Errorf("Job %s for removed resource r2 should be Cancelled, got %v", job.Id, job.Status)
			}
		} else if release.ReleaseTarget.ResourceId == r1.Id {
			// This job is for r1, which is still in the environment
			if job.Status != oapi.InProgress {
				t.Errorf("Job %s for resource r1 should still be InProgress, got %v", job.Id, job.Status)
			}
		}
	}

	// Verify counts
	inProgressCount := 0
	cancelledCount := 0
	for _, job := range allJobsAfter {
		if job.Status == oapi.InProgress {
			inProgressCount++
		}
		if job.Status == oapi.Cancelled {
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
