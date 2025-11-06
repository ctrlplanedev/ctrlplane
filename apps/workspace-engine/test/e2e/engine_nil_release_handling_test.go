package e2e

import (
	"context"
	"testing"
	"time"
	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/oapi"
	"workspace-engine/test/integration"
	c "workspace-engine/test/integration/creators"

	"github.com/google/uuid"
)

// TestEngine_JobsWithNilReleaseReference tests that the system handles jobs
// that reference releases that don't exist or are nil without panicking.
// This is a critical edge case that can occur due to:
// - Database inconsistencies
// - Race conditions during deletion
// - Corrupted state during deserialization
// - Corrupted state during migration
// - Manual deletion of release
func TestEngine_JobsWithNilReleaseReference(t *testing.T) {
	engine := integration.NewTestWorkspace(t)
	workspaceID := engine.Workspace().ID
	ctx := context.Background()

	// Setup: Create all necessary entities
	jobAgent := c.NewJobAgent(workspaceID)
	engine.PushEvent(ctx, handler.JobAgentCreate, jobAgent)

	sys := c.NewSystem(workspaceID)
	sys.Name = "test-system"
	engine.PushEvent(ctx, handler.SystemCreate, sys)

	deployment := c.NewDeployment(sys.Id)
	deployment.Name = "test-deployment"
	deployment.JobAgentId = &jobAgent.Id
	deployment.JobAgentConfig = map[string]any{"test": "config"}
	deployment.ResourceSelector = &oapi.Selector{}
	_ = deployment.ResourceSelector.FromCelSelector(oapi.CelSelector{Cel: "true"})
	engine.PushEvent(ctx, handler.DeploymentCreate, deployment)

	environment := c.NewEnvironment(sys.Id)
	environment.Name = "test-env"
	environment.ResourceSelector = &oapi.Selector{}
	_ = environment.ResourceSelector.FromCelSelector(oapi.CelSelector{Cel: "true"})
	engine.PushEvent(ctx, handler.EnvironmentCreate, environment)

	resource := c.NewResource(workspaceID)
	resource.Name = "test-resource"
	engine.PushEvent(ctx, handler.ResourceCreate, resource)

	// Create a deployment version to trigger release creation
	version := c.NewDeploymentVersion()
	version.DeploymentId = deployment.Id
	version.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, version)

	// Wait for job creation
	time.Sleep(100 * time.Millisecond)

	// Verify job was created
	pendingJobs := engine.Workspace().Jobs().GetPending()
	if len(pendingJobs) != 1 {
		t.Fatalf("expected 1 pending job, got %d", len(pendingJobs))
	}

	var job *oapi.Job
	for _, j := range pendingJobs {
		job = j
		break
	}

	// Verify release exists
	release, ok := engine.Workspace().Releases().Get(job.ReleaseId)
	if !ok {
		t.Fatalf("release %s not found", job.ReleaseId)
	}

	// EDGE CASE 1: Manually remove the release but keep the job
	// This simulates a corrupted state where a job references a non-existent release
	engine.Workspace().Releases().Remove(ctx, release.ID())

	// Verify release is gone
	_, ok = engine.Workspace().Releases().Get(job.ReleaseId)
	if ok {
		t.Fatalf("release should have been deleted")
	}

	// CRITICAL: This should NOT panic - the nil check should prevent it
	releaseTarget := &oapi.ReleaseTarget{
		ResourceId:    resource.Id,
		EnvironmentId: environment.Id,
		DeploymentId:  deployment.Id,
	}

	// Test GetJobsForReleaseTarget with missing release
	jobsForTarget := engine.Workspace().Jobs().GetJobsForReleaseTarget(releaseTarget)

	// The job should be filtered out because its release doesn't exist
	if len(jobsForTarget) != 0 {
		t.Fatalf("expected 0 jobs for release target (release doesn't exist), got %d", len(jobsForTarget))
	}

	// Test GetCurrentRelease with missing release
	currentRelease, currentJob, err := engine.Workspace().ReleaseTargets().GetCurrentRelease(ctx, releaseTarget)
	if err == nil {
		t.Fatalf("expected error when getting current release with non-existent release")
	}
	if currentRelease != nil {
		t.Fatalf("expected nil current release, got %v", currentRelease)
	}
	if currentJob != nil {
		t.Fatalf("expected nil current job, got %v", currentJob)
	}
}

// TestEngine_JobsWithNilReleaseInMap tests the scenario where a nil value
// is explicitly stored in the releases map (e.g., due to deserialization bug)
func TestEngine_JobsWithNilReleaseInMap(t *testing.T) {
	engine := integration.NewTestWorkspace(t)
	workspaceID := engine.Workspace().ID
	ctx := context.Background()

	// Setup entities
	jobAgent := c.NewJobAgent(workspaceID)
	engine.PushEvent(ctx, handler.JobAgentCreate, jobAgent)

	sys := c.NewSystem(workspaceID)
	engine.PushEvent(ctx, handler.SystemCreate, sys)

	deployment := c.NewDeployment(sys.Id)
	deployment.JobAgentId = &jobAgent.Id
	deployment.JobAgentConfig = map[string]any{}
	deployment.ResourceSelector = &oapi.Selector{}
	_ = deployment.ResourceSelector.FromCelSelector(oapi.CelSelector{Cel: "true"})
	engine.PushEvent(ctx, handler.DeploymentCreate, deployment)

	environment := c.NewEnvironment(sys.Id)
	environment.ResourceSelector = &oapi.Selector{}
	_ = environment.ResourceSelector.FromCelSelector(oapi.CelSelector{Cel: "true"})
	engine.PushEvent(ctx, handler.EnvironmentCreate, environment)

	resource := c.NewResource(workspaceID)
	engine.PushEvent(ctx, handler.ResourceCreate, resource)

	// Don't create a real deployment version - we only want to test the fake job with nil release

	// Create a fake job with a fake release ID
	fakeReleaseId := uuid.New().String()
	fakeJob := &oapi.Job{
		Id:             uuid.New().String(),
		ReleaseId:      fakeReleaseId,
		JobAgentId:     jobAgent.Id,
		JobAgentConfig: map[string]any{},
		Status:         oapi.Pending,
		CreatedAt:      time.Now(),
		UpdatedAt:      time.Now(),
		Metadata:       map[string]string{},
	}

	// Insert the job
	engine.Workspace().Jobs().Upsert(ctx, fakeJob)

	// EDGE CASE 2: Manually insert nil into the releases map
	// This simulates a deserialization bug or database corruption
	engine.Workspace().Store().Repo().Releases.Set(fakeReleaseId, nil)

	// Verify nil is in the map
	release, ok := engine.Workspace().Store().Repo().Releases.Get(fakeReleaseId)
	if !ok {
		t.Fatalf("expected key to exist in map")
	}
	if release != nil {
		t.Fatalf("expected nil release in map, got %v", release)
	}

	// CRITICAL: This should NOT panic when accessing nil release
	releaseTarget := &oapi.ReleaseTarget{
		ResourceId:    resource.Id,
		EnvironmentId: environment.Id,
		DeploymentId:  deployment.Id,
	}

	// This should handle the nil release gracefully
	jobsForTarget := engine.Workspace().Jobs().GetJobsForReleaseTarget(releaseTarget)

	// The job should be filtered out because its release is nil
	if len(jobsForTarget) != 0 {
		t.Fatalf("expected 0 jobs for release target (release is nil), got %d", len(jobsForTarget))
	}
}

// TestEngine_ReleaseTargetStateWithNilRelease tests that getting the state
// of a release target doesn't panic when releases are nil
func TestEngine_ReleaseTargetStateWithNilRelease(t *testing.T) {
	engine := integration.NewTestWorkspace(t)
	workspaceID := engine.Workspace().ID
	ctx := context.Background()

	// Setup
	jobAgent := c.NewJobAgent(workspaceID)
	engine.PushEvent(ctx, handler.JobAgentCreate, jobAgent)

	sys := c.NewSystem(workspaceID)
	engine.PushEvent(ctx, handler.SystemCreate, sys)

	deployment := c.NewDeployment(sys.Id)
	deployment.JobAgentId = &jobAgent.Id
	deployment.JobAgentConfig = map[string]any{}
	deployment.ResourceSelector = &oapi.Selector{}
	_ = deployment.ResourceSelector.FromCelSelector(oapi.CelSelector{Cel: "true"})
	engine.PushEvent(ctx, handler.DeploymentCreate, deployment)

	environment := c.NewEnvironment(sys.Id)
	environment.ResourceSelector = &oapi.Selector{}
	_ = environment.ResourceSelector.FromCelSelector(oapi.CelSelector{Cel: "true"})
	engine.PushEvent(ctx, handler.EnvironmentCreate, environment)

	resource := c.NewResource(workspaceID)
	engine.PushEvent(ctx, handler.ResourceCreate, resource)

	version := c.NewDeploymentVersion()
	version.DeploymentId = deployment.Id
	version.Status = oapi.DeploymentVersionStatusReady
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, version)

	time.Sleep(100 * time.Millisecond)

	// Get the created job and its release
	pendingJobs := engine.Workspace().Jobs().GetPending()
	if len(pendingJobs) == 0 {
		t.Fatalf("expected at least 1 pending job")
	}

	var job *oapi.Job
	for _, j := range pendingJobs {
		job = j
		break
	}

	// Mark job as successful to make it the "current release"
	job.Status = oapi.Successful
	completedAt := time.Now()
	job.CompletedAt = &completedAt
	engine.Workspace().Jobs().Upsert(ctx, job)

	// Now delete the release (simulating corruption)
	release, ok := engine.Workspace().Releases().Get(job.ReleaseId)
	if !ok {
		t.Fatalf("release should exist")
	}
	engine.Workspace().Releases().Remove(ctx, release.ID())

	releaseTarget := &oapi.ReleaseTarget{
		ResourceId:    resource.Id,
		EnvironmentId: environment.Id,
		DeploymentId:  deployment.Id,
	}

	// CRITICAL: GetReleaseTargetState should handle missing/nil releases
	state, err := engine.Workspace().ReleaseManager().GetReleaseTargetStateWithRelationships(ctx, releaseTarget, nil)

	// It should return an error or empty state, but NOT panic
	if err != nil {
		// This is acceptable - we expect an error when release is missing
		t.Logf("Got expected error: %v", err)
	}

	if state == nil {
		t.Fatalf("state should not be nil even if there's an error")
	}

	// Current release should be nil because the release doesn't exist
	if state.CurrentRelease != nil {
		t.Fatalf("expected nil current release, got %v", state.CurrentRelease)
	}
}

// TestEngine_MultipleJobsWithMixedNilReleases tests a complex scenario
// with multiple jobs where some have valid releases and some don't
func TestEngine_MultipleJobsWithMixedNilReleases(t *testing.T) {
	engine := integration.NewTestWorkspace(t)
	workspaceID := engine.Workspace().ID
	ctx := context.Background()

	// Setup
	jobAgent := c.NewJobAgent(workspaceID)
	engine.PushEvent(ctx, handler.JobAgentCreate, jobAgent)

	sys := c.NewSystem(workspaceID)
	engine.PushEvent(ctx, handler.SystemCreate, sys)

	deployment := c.NewDeployment(sys.Id)
	deployment.JobAgentId = &jobAgent.Id
	deployment.JobAgentConfig = map[string]any{}
	deployment.ResourceSelector = &oapi.Selector{}
	_ = deployment.ResourceSelector.FromCelSelector(oapi.CelSelector{Cel: "true"})
	engine.PushEvent(ctx, handler.DeploymentCreate, deployment)

	environment := c.NewEnvironment(sys.Id)
	environment.ResourceSelector = &oapi.Selector{}
	_ = environment.ResourceSelector.FromCelSelector(oapi.CelSelector{Cel: "true"})
	engine.PushEvent(ctx, handler.EnvironmentCreate, environment)

	resource := c.NewResource(workspaceID)
	engine.PushEvent(ctx, handler.ResourceCreate, resource)

	releaseTarget := &oapi.ReleaseTarget{
		ResourceId:    resource.Id,
		EnvironmentId: environment.Id,
		DeploymentId:  deployment.Id,
	}

	// Create first version - this creates a valid job and release
	version1 := c.NewDeploymentVersion()
	version1.DeploymentId = deployment.Id
	version1.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, version1)

	time.Sleep(100 * time.Millisecond)

	for _, job := range engine.Workspace().Jobs().GetJobsInProcessingStateForReleaseTarget(releaseTarget) {
		job.Status = oapi.Skipped
		completedAt := time.Now()
		job.CompletedAt = &completedAt

		jobUpdateEvent := &oapi.JobUpdateEvent{
			Id:  &job.Id,
			Job: *job,
			FieldsToUpdate: &[]oapi.JobUpdateEventFieldsToUpdate{
				oapi.JobUpdateEventFieldsToUpdate("completedAt"),
				oapi.JobUpdateEventFieldsToUpdate("status"),
			},
		}

		engine.PushEvent(ctx, handler.JobUpdate, jobUpdateEvent)
	}

	// Create second version - another valid job and release
	version2 := c.NewDeploymentVersion()
	version2.DeploymentId = deployment.Id
	version2.Tag = "v2.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, version2)

	time.Sleep(100 * time.Millisecond)

	// Get all jobs
	allJobs := engine.Workspace().Jobs().Items()
	if len(allJobs) < 2 {
		t.Fatalf("expected at least 2 jobs, got %d", len(allJobs))
	}

	// Find a job and corrupt its release
	var jobToCorrupt *oapi.Job
	for _, j := range allJobs {
		if j.Status == oapi.Skipped {
			jobToCorrupt = j
			break
		}
	}
	if jobToCorrupt == nil {
		t.Fatalf("no pending job found to corrupt")
	}

	// Delete one release while keeping the job
	release, ok := engine.Workspace().Releases().Get(jobToCorrupt.ReleaseId)
	if !ok {
		t.Fatalf("release should exist")
	}

	releaseIdToDelete := release.ID()
	engine.Workspace().Releases().Remove(ctx, releaseIdToDelete)

	// Get jobs for release target - should only return jobs with valid releases
	jobsForTarget := engine.Workspace().Jobs().GetJobsForReleaseTarget(releaseTarget)

	// Should have at least one job (the one with valid release)
	// The corrupted job should be filtered out
	if len(jobsForTarget) < 1 {
		t.Fatalf("expected at least 1 job with valid release, got %d", len(jobsForTarget))
	}

	// Verify all returned jobs have valid releases
	for jobId, job := range jobsForTarget {
		rel, ok := engine.Workspace().Releases().Get(job.ReleaseId)
		if !ok || rel == nil {
			t.Fatalf("job %s has invalid release reference", jobId)
		}
	}
}

// TestEngine_DeploymentDeletionLeavesOrphanedJobs tests the scenario where
// a deployment is deleted but jobs still reference releases for that deployment
func TestEngine_DeploymentDeletionLeavesOrphanedJobs(t *testing.T) {
	engine := integration.NewTestWorkspace(t)
	workspaceID := engine.Workspace().ID
	ctx := context.Background()

	// Setup
	jobAgent := c.NewJobAgent(workspaceID)
	engine.PushEvent(ctx, handler.JobAgentCreate, jobAgent)

	sys := c.NewSystem(workspaceID)
	engine.PushEvent(ctx, handler.SystemCreate, sys)

	deployment := c.NewDeployment(sys.Id)
	deployment.JobAgentId = &jobAgent.Id
	deployment.JobAgentConfig = map[string]any{}
	deployment.ResourceSelector = &oapi.Selector{}
	_ = deployment.ResourceSelector.FromCelSelector(oapi.CelSelector{Cel: "true"})
	engine.PushEvent(ctx, handler.DeploymentCreate, deployment)

	environment := c.NewEnvironment(sys.Id)
	environment.ResourceSelector = &oapi.Selector{}
	_ = environment.ResourceSelector.FromCelSelector(oapi.CelSelector{Cel: "true"})
	engine.PushEvent(ctx, handler.EnvironmentCreate, environment)

	resource := c.NewResource(workspaceID)
	engine.PushEvent(ctx, handler.ResourceCreate, resource)

	version := c.NewDeploymentVersion()
	version.DeploymentId = deployment.Id
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, version)

	time.Sleep(100 * time.Millisecond)

	// Verify job was created
	jobs := engine.Workspace().Jobs().Items()
	if len(jobs) == 0 {
		t.Fatalf("expected at least 1 job")
	}

	// Now delete the deployment
	engine.PushEvent(ctx, handler.DeploymentDelete, deployment)

	// The deployment should be gone
	_, ok := engine.Workspace().Deployments().Get(deployment.Id)
	if ok {
		t.Fatalf("deployment should have been deleted")
	}

	// Jobs might still exist (depending on cleanup logic)
	// But accessing them should not panic
	remainingJobs := engine.Workspace().Jobs().Items()

	// Try to get jobs for a release target - should not panic
	releaseTarget := &oapi.ReleaseTarget{
		ResourceId:    resource.Id,
		EnvironmentId: environment.Id,
		DeploymentId:  deployment.Id,
	}

	// This should not panic even with orphaned data
	jobsForTarget := engine.Workspace().Jobs().GetJobsForReleaseTarget(releaseTarget)

	// Log the result (could be 0 or some jobs depending on cleanup logic)
	t.Logf("Found %d jobs for release target after deployment deletion (remaining jobs: %d)",
		len(jobsForTarget), len(remainingJobs))
}
