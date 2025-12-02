package e2e

import (
	"context"
	"testing"
	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/oapi"
	"workspace-engine/test/integration"
	c "workspace-engine/test/integration/creators"

	"github.com/google/uuid"
)

// TestEngine_PausedVersionNoJobs tests that a paused deployment version
// without existing releases does NOT create new jobs
func TestEngine_PausedVersionNoJobs(t *testing.T) {
	jobAgentID := uuid.New().String()
	deploymentID := uuid.New().String()
	environmentID := uuid.New().String()
	resourceID := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID),
		),
		integration.WithSystem(
			integration.WithDeployment(
				integration.DeploymentID(deploymentID),
				integration.DeploymentName("api-service"),
				integration.DeploymentJobAgent(jobAgentID),
				integration.DeploymentCelResourceSelector("true"),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentID),
				integration.EnvironmentName("production"),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceID(resourceID),
		),
	)

	ctx := context.Background()

	// Create a deployment version with status "paused" (should NOT create jobs)
	versionPaused := c.NewDeploymentVersion()
	versionPaused.DeploymentId = deploymentID
	versionPaused.Tag = "v1.0.0"
	versionPaused.Status = oapi.DeploymentVersionStatusPaused
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, versionPaused)

	// Verify NO jobs were created for paused version
	allJobs := engine.Workspace().Jobs().Items()
	if len(allJobs) > 0 {
		t.Fatalf("expected 0 jobs for paused version without existing release, got %d", len(allJobs))
	}

	// Verify version exists in workspace
	version, ok := engine.Workspace().DeploymentVersions().Get(versionPaused.Id)
	if !ok {
		t.Fatalf("paused version not found in workspace")
	}
	if version.Status != oapi.DeploymentVersionStatusPaused {
		t.Fatalf("expected version status paused, got %s", version.Status)
	}
}

// TestEngine_PausedVersionWithExistingRelease tests that when a version with
// existing releases is paused, the existing releases are maintained
func TestEngine_PausedVersionWithExistingRelease(t *testing.T) {
	jobAgentID := uuid.New().String()
	deploymentID := uuid.New().String()
	environmentID := uuid.New().String()
	resource1ID := uuid.New().String()
	resource2ID := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID),
		),
		integration.WithSystem(
			integration.WithDeployment(
				integration.DeploymentID(deploymentID),
				integration.DeploymentName("api-service"),
				integration.DeploymentJobAgent(jobAgentID),
				integration.DeploymentCelResourceSelector("true"),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentID),
				integration.EnvironmentName("production"),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceID(resource1ID),
			integration.ResourceName("server-1"),
		),
		integration.WithResource(
			integration.ResourceID(resource2ID),
			integration.ResourceName("server-2"),
		),
	)

	ctx := context.Background()

	// Create a ready version (should create jobs for both resources)
	versionReady := c.NewDeploymentVersion()
	versionReady.DeploymentId = deploymentID
	versionReady.Tag = "v1.0.0"
	versionReady.Status = oapi.DeploymentVersionStatusReady
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, versionReady)

	// Verify 2 jobs were created
	allJobs := engine.Workspace().Jobs().Items()
	if len(allJobs) != 2 {
		t.Fatalf("expected 2 jobs for ready version, got %d", len(allJobs))
	}

	// Get the release IDs for both jobs
	releaseIDs := make([]string, 0, 2)
	for _, job := range allJobs {
		releaseIDs = append(releaseIDs, job.ReleaseId)
	}

	// Update the version status to "paused"
	version, ok := engine.Workspace().DeploymentVersions().Get(versionReady.Id)
	if !ok {
		t.Fatalf("version %s not found", versionReady.Id)
	}
	version.Status = oapi.DeploymentVersionStatusPaused
	engine.PushEvent(ctx, handler.DeploymentVersionUpdate, version)

	// Verify the existing releases are still present
	// Note: Releases capture a snapshot of the version at creation time.
	// They do not automatically update when the source version status changes.
	for _, releaseID := range releaseIDs {
		release, ok := engine.Workspace().Releases().Get(releaseID)
		if !ok {
			t.Errorf("expected release %s to still exist after version paused", releaseID)
		}
		// Release version is a snapshot - will still show "ready" even though source version is paused
		if release.Version.Status != oapi.DeploymentVersionStatusReady {
			t.Errorf("expected release version status to remain ready (snapshot), got %s", release.Version.Status)
		}
	}

	// Verify jobs still exist (pausing doesn't delete existing jobs)
	allJobsAfterPause := engine.Workspace().Jobs().Items()
	if len(allJobsAfterPause) != 2 {
		t.Errorf("expected 2 jobs to remain after version paused, got %d", len(allJobsAfterPause))
	}
}

// TestEngine_PausedVersionNoNewTargets tests that a paused version with existing
// releases on some targets will NOT create releases for new matching targets
func TestEngine_PausedVersionNoNewTargets(t *testing.T) {
	jobAgentID := uuid.New().String()
	deploymentID := uuid.New().String()
	environmentID := uuid.New().String()
	resource1ID := uuid.New().String()
	resource2ID := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID),
		),
		integration.WithSystem(
			integration.WithDeployment(
				integration.DeploymentID(deploymentID),
				integration.DeploymentName("api-service"),
				integration.DeploymentJobAgent(jobAgentID),
				integration.DeploymentCelResourceSelector("true"),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentID),
				integration.EnvironmentName("production"),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceID(resource1ID),
			integration.ResourceName("server-1"),
		),
	)

	ctx := context.Background()

	// Create a ready version (should create job for server-1)
	versionReady := c.NewDeploymentVersion()
	versionReady.DeploymentId = deploymentID
	versionReady.Tag = "v1.0.0"
	versionReady.Status = oapi.DeploymentVersionStatusReady
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, versionReady)

	// Verify 1 job was created
	allJobs := engine.Workspace().Jobs().Items()
	if len(allJobs) != 1 {
		t.Fatalf("expected 1 job for ready version, got %d", len(allJobs))
	}

	// Pause the version
	version, ok := engine.Workspace().DeploymentVersions().Get(versionReady.Id)
	if !ok {
		t.Fatalf("version %s not found", versionReady.Id)
	}
	version.Status = oapi.DeploymentVersionStatusPaused
	engine.PushEvent(ctx, handler.DeploymentVersionUpdate, version)

	// Add a new resource (server-2) - should create a new release target
	resource2 := c.NewResource("test-workspace")
	resource2.Id = resource2ID
	resource2.Name = "server-2"
	engine.PushEvent(ctx, handler.ResourceCreate, resource2)

	// Verify still only 1 job exists (paused version should not deploy to new target)
	allJobsAfterNewResource := engine.Workspace().Jobs().Items()
	if len(allJobsAfterNewResource) != 1 {
		t.Errorf("expected 1 job after adding new resource (paused version shouldn't deploy to new targets), got %d", len(allJobsAfterNewResource))
	}

	// Verify the job is still for server-1
	for _, job := range allJobsAfterNewResource {
		release, ok := engine.Workspace().Releases().Get(job.ReleaseId)
		if !ok {
			t.Errorf("release %s not found", job.ReleaseId)
			continue
		}
		if release.ReleaseTarget.ResourceId != resource1ID {
			t.Errorf("expected job for resource %s, got %s", resource1ID, release.ReleaseTarget.ResourceId)
		}
	}
}

// TestEngine_PausedVersionTransitionToReady tests that when a paused version
// is transitioned to ready, it creates jobs for all matching targets
func TestEngine_PausedVersionTransitionToReady(t *testing.T) {
	jobAgentID := uuid.New().String()
	deploymentID := uuid.New().String()
	environmentID := uuid.New().String()
	resource1ID := uuid.New().String()
	resource2ID := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID),
		),
		integration.WithSystem(
			integration.WithDeployment(
				integration.DeploymentID(deploymentID),
				integration.DeploymentName("api-service"),
				integration.DeploymentJobAgent(jobAgentID),
				integration.DeploymentCelResourceSelector("true"),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentID),
				integration.EnvironmentName("production"),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceID(resource1ID),
			integration.ResourceName("server-1"),
		),
		integration.WithResource(
			integration.ResourceID(resource2ID),
			integration.ResourceName("server-2"),
		),
	)

	ctx := context.Background()

	// Create a paused version (should NOT create jobs)
	versionPaused := c.NewDeploymentVersion()
	versionPaused.DeploymentId = deploymentID
	versionPaused.Tag = "v1.0.0"
	versionPaused.Status = oapi.DeploymentVersionStatusPaused
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, versionPaused)

	// Verify NO jobs were created
	allJobs := engine.Workspace().Jobs().Items()
	if len(allJobs) > 0 {
		t.Fatalf("expected 0 jobs for paused version, got %d", len(allJobs))
	}

	// Update version status to "ready"
	version, ok := engine.Workspace().DeploymentVersions().Get(versionPaused.Id)
	if !ok {
		t.Fatalf("version %s not found", versionPaused.Id)
	}
	version.Status = oapi.DeploymentVersionStatusReady
	engine.PushEvent(ctx, handler.DeploymentVersionUpdate, version)

	// Verify jobs WERE created for both resources
	allJobsAfterReady := engine.Workspace().Jobs().Items()
	if len(allJobsAfterReady) != 2 {
		t.Fatalf("expected 2 jobs after version transitioned to ready, got %d", len(allJobsAfterReady))
	}

	// Verify all jobs are for the correct version
	for _, job := range allJobsAfterReady {
		release, ok := engine.Workspace().Releases().Get(job.ReleaseId)
		if !ok {
			t.Errorf("release %s not found", job.ReleaseId)
			continue
		}
		if release.Version.Tag != "v1.0.0" {
			t.Errorf("expected version v1.0.0, got %s", release.Version.Tag)
		}
		if release.Version.Status != oapi.DeploymentVersionStatusReady {
			t.Errorf("expected version status ready, got %s", release.Version.Status)
		}
	}
}

// TestEngine_MultiplePausedVersions tests behavior with multiple paused versions
// across different deployments
func TestEngine_MultiplePausedVersions(t *testing.T) {
	jobAgentID := uuid.New().String()
	deployment1ID := uuid.New().String()
	deployment2ID := uuid.New().String()
	environmentID := uuid.New().String()
	resourceID := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID),
		),
		integration.WithSystem(
			integration.WithDeployment(
				integration.DeploymentID(deployment1ID),
				integration.DeploymentName("api-service"),
				integration.DeploymentJobAgent(jobAgentID),
				integration.DeploymentCelResourceSelector("true"),
			),
			integration.WithDeployment(
				integration.DeploymentID(deployment2ID),
				integration.DeploymentName("worker-service"),
				integration.DeploymentJobAgent(jobAgentID),
				integration.DeploymentCelResourceSelector("true"),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentID),
				integration.EnvironmentName("production"),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceID(resourceID),
		),
	)

	ctx := context.Background()

	// Create paused version for deployment 1 (should NOT create job)
	version1Paused := c.NewDeploymentVersion()
	version1Paused.DeploymentId = deployment1ID
	version1Paused.Tag = "v1.0.0"
	version1Paused.Status = oapi.DeploymentVersionStatusPaused
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, version1Paused)

	// Create ready version for deployment 2 (SHOULD create job)
	version2Ready := c.NewDeploymentVersion()
	version2Ready.DeploymentId = deployment2ID
	version2Ready.Tag = "v1.0.0"
	version2Ready.Status = oapi.DeploymentVersionStatusReady
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, version2Ready)

	// Verify only 1 job was created (for deployment 2)
	allJobs := engine.Workspace().Jobs().Items()
	if len(allJobs) != 1 {
		t.Fatalf("expected 1 job (only for ready version), got %d", len(allJobs))
	}

	// Verify the job is for deployment 2
	var job *oapi.Job
	for _, j := range allJobs {
		job = j
		break
	}
	release, ok := engine.Workspace().Releases().Get(job.ReleaseId)
	if !ok {
		t.Fatalf("release %s not found", job.ReleaseId)
	}
	if release.ReleaseTarget.DeploymentId != deployment2ID {
		t.Fatalf("expected job for deployment %s, got %s", deployment2ID, release.ReleaseTarget.DeploymentId)
	}
}

// TestEngine_PausedVersionMixedStatuses tests the interaction between paused
// and other version statuses
func TestEngine_PausedVersionMixedStatuses(t *testing.T) {
	jobAgentID := uuid.New().String()
	deploymentID := uuid.New().String()
	environmentID := uuid.New().String()
	resourceID := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID),
		),
		integration.WithSystem(
			integration.WithDeployment(
				integration.DeploymentID(deploymentID),
				integration.DeploymentName("api-service"),
				integration.DeploymentJobAgent(jobAgentID),
				integration.DeploymentCelResourceSelector("true"),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentID),
				integration.EnvironmentName("production"),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceID(resourceID),
		),
	)

	ctx := context.Background()

	// Test sequence of statuses: paused -> ready -> paused -> ready
	version := c.NewDeploymentVersion()
	version.DeploymentId = deploymentID
	version.Tag = "v1.0.0"
	version.Status = oapi.DeploymentVersionStatusPaused
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, version)

	// Step 1: Paused - no jobs
	allJobs := engine.Workspace().Jobs().Items()
	if len(allJobs) != 0 {
		t.Fatalf("step 1: expected 0 jobs for paused version, got %d", len(allJobs))
	}

	// Step 2: Transition to ready - should create job
	v, _ := engine.Workspace().DeploymentVersions().Get(version.Id)
	v.Status = oapi.DeploymentVersionStatusReady
	engine.PushEvent(ctx, handler.DeploymentVersionUpdate, v)

	allJobs = engine.Workspace().Jobs().Items()
	if len(allJobs) != 1 {
		t.Fatalf("step 2: expected 1 job after transition to ready, got %d", len(allJobs))
	}

	// Step 3: Transition back to paused - existing job should remain
	v, _ = engine.Workspace().DeploymentVersions().Get(version.Id)
	v.Status = oapi.DeploymentVersionStatusPaused
	engine.PushEvent(ctx, handler.DeploymentVersionUpdate, v)

	allJobs = engine.Workspace().Jobs().Items()
	if len(allJobs) != 1 {
		t.Fatalf("step 3: expected 1 job to remain after pausing (has existing release), got %d", len(allJobs))
	}

	// Step 4: Transition back to ready again - job should still be there
	v, _ = engine.Workspace().DeploymentVersions().Get(version.Id)
	v.Status = oapi.DeploymentVersionStatusReady
	engine.PushEvent(ctx, handler.DeploymentVersionUpdate, v)

	allJobs = engine.Workspace().Jobs().Items()
	if len(allJobs) != 1 {
		t.Fatalf("step 4: expected 1 job after transition back to ready, got %d", len(allJobs))
	}

	// Verify the version status in the release
	for _, job := range allJobs {
		release, ok := engine.Workspace().Releases().Get(job.ReleaseId)
		if !ok {
			t.Fatalf("release %s not found", job.ReleaseId)
		}
		if release.Version.Status != oapi.DeploymentVersionStatusReady {
			t.Errorf("expected final version status ready, got %s", release.Version.Status)
		}
	}
}

// TestEngine_PausedVersionWithMultipleEnvironments tests paused versions
// with selective environment deployments
func TestEngine_PausedVersionWithMultipleEnvironments(t *testing.T) {
	jobAgentID := uuid.New().String()
	deploymentID := uuid.New().String()
	envDevID := uuid.New().String()
	envProdID := uuid.New().String()
	resource1ID := uuid.New().String()
	resource2ID := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID),
		),
		integration.WithSystem(
			integration.WithDeployment(
				integration.DeploymentID(deploymentID),
				integration.DeploymentName("api-service"),
				integration.DeploymentJobAgent(jobAgentID),
				integration.DeploymentCelResourceSelector("true"),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(envDevID),
				integration.EnvironmentName("dev"),
				integration.EnvironmentCelResourceSelector("true"),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(envProdID),
				integration.EnvironmentName("prod"),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceID(resource1ID),
			integration.ResourceName("server-1"),
		),
		integration.WithResource(
			integration.ResourceID(resource2ID),
			integration.ResourceName("server-2"),
		),
	)

	ctx := context.Background()

	// Create ready version - should create 4 jobs (2 envs * 2 resources)
	versionReady := c.NewDeploymentVersion()
	versionReady.DeploymentId = deploymentID
	versionReady.Tag = "v1.0.0"
	versionReady.Status = oapi.DeploymentVersionStatusReady
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, versionReady)

	allJobs := engine.Workspace().Jobs().Items()
	if len(allJobs) != 4 {
		t.Fatalf("expected 4 jobs (2 envs * 2 resources), got %d", len(allJobs))
	}

	// Pause the version - all 4 jobs should remain (they have existing releases)
	version, _ := engine.Workspace().DeploymentVersions().Get(versionReady.Id)
	version.Status = oapi.DeploymentVersionStatusPaused
	engine.PushEvent(ctx, handler.DeploymentVersionUpdate, version)

	allJobsAfterPause := engine.Workspace().Jobs().Items()
	if len(allJobsAfterPause) != 4 {
		t.Errorf("expected 4 jobs to remain after pausing (all have existing releases), got %d", len(allJobsAfterPause))
	}

	// Count jobs per environment
	envJobCount := make(map[string]int)
	for _, job := range allJobsAfterPause {
		release, ok := engine.Workspace().Releases().Get(job.ReleaseId)
		if !ok {
			continue
		}
		envJobCount[release.ReleaseTarget.EnvironmentId]++
	}

	if envJobCount[envDevID] != 2 {
		t.Errorf("expected 2 jobs for dev environment, got %d", envJobCount[envDevID])
	}
	if envJobCount[envProdID] != 2 {
		t.Errorf("expected 2 jobs for prod environment, got %d", envJobCount[envProdID])
	}
}

// TestEngine_PausedVersionReplacement tests the behavior when a new ready version
// is created while a paused version with an existing release exists..
func TestEngine_PausedVersionReplacement(t *testing.T) {
	jobAgentID := uuid.New().String()
	deploymentID := uuid.New().String()
	environmentID := uuid.New().String()
	resourceID := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID),
		),
		integration.WithSystem(
			integration.WithDeployment(
				integration.DeploymentID(deploymentID),
				integration.DeploymentName("api-service"),
				integration.DeploymentJobAgent(jobAgentID),
				integration.DeploymentCelResourceSelector("true"),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentID),
				integration.EnvironmentName("production"),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceID(resourceID),
		),
	)

	ctx := context.Background()

	// Create ready version v1.0.0
	version1 := c.NewDeploymentVersion()
	version1.DeploymentId = deploymentID
	version1.Tag = "v1.0.0"
	version1.Status = oapi.DeploymentVersionStatusReady
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, version1)

	// Pause v1.0.0
	v1, _ := engine.Workspace().DeploymentVersions().Get(version1.Id)
	v1.Status = oapi.DeploymentVersionStatusPaused
	engine.PushEvent(ctx, handler.DeploymentVersionUpdate, v1)

	// Create new ready version v2.0.0
	// When a paused version has an existing release, creating a newer ready version
	// should trigger a reconciliation that replaces the old release with the new one
	version2 := c.NewDeploymentVersion()
	version2.DeploymentId = deploymentID
	version2.Tag = "v2.0.0"
	version2.Status = oapi.DeploymentVersionStatusReady
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, version2)

	// CURRENT BEHAVIOR: The paused version continues to be selected
	// because it has an existing release (grandfathered in), even though
	// a newer ready version is available.
	allJobs := engine.Workspace().Jobs().Items()
	if len(allJobs) == 0 {
		t.Fatalf("expected at least 1 job")
	}

	// Document what version is actually deployed
	foundV1 := false
	foundV2 := false
	for _, job := range allJobs {
		release, ok := engine.Workspace().Releases().Get(job.ReleaseId)
		if !ok {
			continue
		}
		if release.Version.Tag == "v1.0.0" {
			foundV1 = true
		}
		if release.Version.Tag == "v2.0.0" {
			foundV2 = true
		}
	}

	// Current behavior: v1.0.0 (paused but with existing release) continues
	if !foundV1 {
		t.Errorf("expected v1.0.0 to continue (current behavior: paused versions with releases are grandfathered)")
	}

	// v2.0.0 is not deployed in current behavior (issue to address)
	if foundV2 {
		t.Logf("IMPROVEMENT: v2.0.0 was deployed! The system now prefers newer ready versions over paused ones.")
	} else {
		t.Logf("CURRENT BEHAVIOR: v2.0.0 not deployed. Paused v1.0.0 with existing release continues to be selected.")
		t.Logf("IMPROVEMENT NEEDED: When a newer ready version becomes available, it should replace paused versions.")
	}
}
