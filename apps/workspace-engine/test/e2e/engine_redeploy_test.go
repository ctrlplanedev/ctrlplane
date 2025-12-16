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

// TestEngine_Redeploy_BasicFlow tests the basic redeploy functionality:
// 1. Creates initial deployment with a version
// 2. Verifies initial job is created
// 3. Marks job as completed
// 4. Triggers redeploy
// 5. Verifies new job is created for the same release target
func TestEngine_Redeploy_BasicFlow(t *testing.T) {
	jobAgentId := uuid.New().String()
	deploymentId := uuid.New().String()
	environmentId := uuid.New().String()
	resourceId := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentId),
			integration.JobAgentName("Test Agent"),
		),
		integration.WithSystem(
			integration.SystemName("test-system"),
			integration.WithDeployment(
				integration.DeploymentID(deploymentId),
				integration.DeploymentName("api-service"),
				integration.DeploymentJobAgent(jobAgentId),
				integration.DeploymentCelResourceSelector("true"),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentId),
				integration.EnvironmentName("production"),
			),
		),
		integration.WithResource(
			integration.ResourceID(resourceId),
			integration.ResourceName("server-1"),
		),
	)

	ctx := context.Background()

	// Verify release target was created
	releaseTargets, _ := engine.Workspace().ReleaseTargets().Items()
	if len(releaseTargets) != 1 {
		t.Fatalf("expected 1 release target, got %d", len(releaseTargets))
	}

	var releaseTarget *oapi.ReleaseTarget
	for _, rt := range releaseTargets {
		releaseTarget = rt
		break
	}

	// Create a deployment version
	dv := c.NewDeploymentVersion()
	dv.DeploymentId = deploymentId
	dv.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv)

	// Verify initial job was created
	pendingJobs := engine.Workspace().Jobs().GetPending()
	if len(pendingJobs) != 1 {
		t.Fatalf("expected 1 pending job after deployment version creation, got %d", len(pendingJobs))
	}

	var initialJob *oapi.Job
	for _, j := range pendingJobs {
		initialJob = j
		break
	}

	// Mark the initial job as completed
	initialJob.Status = oapi.JobStatusSuccessful
	engine.PushEvent(ctx, handler.JobUpdate, initialJob)

	// Verify no pending jobs after completion
	pendingJobs = engine.Workspace().Jobs().GetPending()
	if len(pendingJobs) != 0 {
		t.Fatalf("expected 0 pending jobs after job completion, got %d", len(pendingJobs))
	}

	// Trigger redeploy
	engine.PushEvent(ctx, handler.ReleaseTargetDeploy, releaseTarget)

	// Verify new job was created
	pendingJobs = engine.Workspace().Jobs().GetPending()
	if len(pendingJobs) != 1 {
		t.Fatalf("expected 1 pending job after redeploy, got %d", len(pendingJobs))
	}

	var redeployJob *oapi.Job
	for _, j := range pendingJobs {
		redeployJob = j
		break
	}

	// Verify it's a new job (different ID)
	if redeployJob.Id == initialJob.Id {
		t.Errorf("expected new job after redeploy, got same job ID %s", redeployJob.Id)
	}

	// Verify the job is for the same release target
	redeployRelease, ok := engine.Workspace().Releases().Get(redeployJob.ReleaseId)
	if !ok {
		t.Fatalf("release %s not found for redeploy job", redeployJob.ReleaseId)
	}

	if redeployRelease.ReleaseTarget.DeploymentId != deploymentId {
		t.Errorf("redeploy job deployment_id = %s, want %s", redeployRelease.ReleaseTarget.DeploymentId, deploymentId)
	}
	if redeployRelease.ReleaseTarget.EnvironmentId != environmentId {
		t.Errorf("redeploy job environment_id = %s, want %s", redeployRelease.ReleaseTarget.EnvironmentId, environmentId)
	}
	if redeployRelease.ReleaseTarget.ResourceId != resourceId {
		t.Errorf("redeploy job resource_id = %s, want %s", redeployRelease.ReleaseTarget.ResourceId, resourceId)
	}

	// Verify version is the same
	if redeployRelease.Version.Tag != "v1.0.0" {
		t.Errorf("redeploy release version tag = %s, want v1.0.0", redeployRelease.Version.Tag)
	}
}

// TestEngine_Redeploy_AfterFailedJob tests that redeploy creates a new job even after a failed job
func TestEngine_Redeploy_AfterFailedJob(t *testing.T) {
	jobAgentId := uuid.New().String()
	deploymentId := uuid.New().String()
	environmentId := uuid.New().String()
	resourceId := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentId),
			integration.JobAgentName("Test Agent"),
		),
		integration.WithSystem(
			integration.SystemName("test-system"),
			integration.WithDeployment(
				integration.DeploymentID(deploymentId),
				integration.DeploymentName("api-service"),
				integration.DeploymentJobAgent(jobAgentId),
				integration.DeploymentCelResourceSelector("true"),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentId),
				integration.EnvironmentName("production"),
			),
		),
		integration.WithResource(
			integration.ResourceID(resourceId),
			integration.ResourceName("server-1"),
		),
	)

	ctx := context.Background()

	// Get release target
	releaseTargets, _ := engine.Workspace().ReleaseTargets().Items()
	var releaseTarget *oapi.ReleaseTarget
	for _, rt := range releaseTargets {
		releaseTarget = rt
		break
	}

	// Create a deployment version
	dv := c.NewDeploymentVersion()
	dv.DeploymentId = deploymentId
	dv.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv)

	// Get the initial job
	pendingJobs := engine.Workspace().Jobs().GetPending()
	var initialJob *oapi.Job
	for _, j := range pendingJobs {
		initialJob = j
		break
	}

	// Mark the job as failed
	initialJob.Status = oapi.JobStatusFailure
	engine.PushEvent(ctx, handler.JobUpdate, initialJob)

	// Verify no pending jobs after failure
	pendingJobs = engine.Workspace().Jobs().GetPending()
	if len(pendingJobs) != 0 {
		t.Fatalf("expected 0 pending jobs after job failure, got %d", len(pendingJobs))
	}

	// Trigger redeploy
	engine.PushEvent(ctx, handler.ReleaseTargetDeploy, releaseTarget)

	// Verify new job was created even after failure
	pendingJobs = engine.Workspace().Jobs().GetPending()
	if len(pendingJobs) != 1 {
		t.Fatalf("expected 1 pending job after redeploy following failure, got %d", len(pendingJobs))
	}

	var redeployJob *oapi.Job
	for _, j := range pendingJobs {
		redeployJob = j
		break
	}

	// Verify it's a new job
	if redeployJob.Id == initialJob.Id {
		t.Errorf("expected new job after redeploy, got same job ID %s", redeployJob.Id)
	}

	// Verify the job is in pending status
	if redeployJob.Status != oapi.JobStatusPending {
		t.Errorf("expected redeploy job status PENDING, got %v", redeployJob.Status)
	}
}

// TestEngine_Redeploy_MultipleReleaseTargets tests redeploy with multiple release targets
func TestEngine_Redeploy_MultipleReleaseTargets(t *testing.T) {
	jobAgentId := uuid.New().String()
	deploymentId := uuid.New().String()
	environmentId := uuid.New().String()
	resource1Id := uuid.New().String()
	resource2Id := uuid.New().String()
	resource3Id := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentId),
			integration.JobAgentName("Test Agent"),
		),
		integration.WithSystem(
			integration.SystemName("test-system"),
			integration.WithDeployment(
				integration.DeploymentID(deploymentId),
				integration.DeploymentName("api-service"),
				integration.DeploymentJobAgent(jobAgentId),
				integration.DeploymentCelResourceSelector("true"),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentId),
				integration.EnvironmentName("production"),
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
		integration.WithResource(
			integration.ResourceID(resource3Id),
			integration.ResourceName("server-3"),
		),
	)

	ctx := context.Background()

	// Verify release targets were created
	releaseTargets, _ := engine.Workspace().ReleaseTargets().Items()
	if len(releaseTargets) != 3 {
		t.Fatalf("expected 3 release targets, got %d", len(releaseTargets))
	}

	// Create a deployment version
	dv := c.NewDeploymentVersion()
	dv.DeploymentId = deploymentId
	dv.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv)

	// Verify initial jobs were created
	pendingJobs := engine.Workspace().Jobs().GetPending()
	if len(pendingJobs) != 3 {
		t.Fatalf("expected 3 pending jobs after deployment version creation, got %d", len(pendingJobs))
	}

	// Mark all jobs as completed
	for _, job := range pendingJobs {
		job.Status = oapi.JobStatusSuccessful
		engine.PushEvent(ctx, handler.JobUpdate, job)
	}

	// Verify no pending jobs
	pendingJobs = engine.Workspace().Jobs().GetPending()
	if len(pendingJobs) != 0 {
		t.Fatalf("expected 0 pending jobs after all completions, got %d", len(pendingJobs))
	}

	// Redeploy to specific release targets (resource 1 and 3 only)
	var rt1, rt3 *oapi.ReleaseTarget
	for _, rt := range releaseTargets {
		if rt.ResourceId == resource1Id {
			rt1 = rt
		} else if rt.ResourceId == resource3Id {
			rt3 = rt
		}
	}

	engine.PushEvent(ctx, handler.ReleaseTargetDeploy, rt1)
	engine.PushEvent(ctx, handler.ReleaseTargetDeploy, rt3)

	// Verify new jobs were created for the redeployed release targets
	pendingJobs = engine.Workspace().Jobs().GetPending()
	if len(pendingJobs) != 2 {
		t.Fatalf("expected 2 pending jobs after redeploying 2 targets, got %d", len(pendingJobs))
	}

	// Verify jobs are for the correct resources
	redeployedResourceIds := make(map[string]bool)
	for _, job := range pendingJobs {
		release, ok := engine.Workspace().Releases().Get(job.ReleaseId)
		if !ok {
			t.Fatalf("release %s not found", job.ReleaseId)
		}
		redeployedResourceIds[release.ReleaseTarget.ResourceId] = true
	}

	if !redeployedResourceIds[resource1Id] {
		t.Errorf("expected job for resource %s after redeploy", resource1Id)
	}
	if !redeployedResourceIds[resource3Id] {
		t.Errorf("expected job for resource %s after redeploy", resource3Id)
	}
	if redeployedResourceIds[resource2Id] {
		t.Errorf("did not expect job for resource %s (not redeployed)", resource2Id)
	}
}

// TestEngine_Redeploy_WithNoVersion tests that redeploy doesn't create a job when no version exists
func TestEngine_Redeploy_WithNoVersion(t *testing.T) {
	jobAgentId := uuid.New().String()
	deploymentId := uuid.New().String()
	environmentId := uuid.New().String()
	resourceId := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentId),
			integration.JobAgentName("Test Agent"),
		),
		integration.WithSystem(
			integration.SystemName("test-system"),
			integration.WithDeployment(
				integration.DeploymentID(deploymentId),
				integration.DeploymentName("api-service"),
				integration.DeploymentJobAgent(jobAgentId),
				integration.DeploymentCelResourceSelector("true"),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentId),
				integration.EnvironmentName("production"),
			),
		),
		integration.WithResource(
			integration.ResourceID(resourceId),
			integration.ResourceName("server-1"),
		),
	)

	ctx := context.Background()

	// Get release target
	releaseTargets, _ := engine.Workspace().ReleaseTargets().Items()
	var releaseTarget *oapi.ReleaseTarget
	for _, rt := range releaseTargets {
		releaseTarget = rt
		break
	}

	// Verify no jobs exist yet
	pendingJobs := engine.Workspace().Jobs().GetPending()
	if len(pendingJobs) != 0 {
		t.Fatalf("expected 0 pending jobs before any deployment, got %d", len(pendingJobs))
	}

	// Trigger redeploy without creating a deployment version first
	engine.PushEvent(ctx, handler.ReleaseTargetDeploy, releaseTarget)

	// Verify no job was created (no version to deploy)
	pendingJobs = engine.Workspace().Jobs().GetPending()
	if len(pendingJobs) != 0 {
		t.Fatalf("expected 0 pending jobs after redeploy with no version, got %d", len(pendingJobs))
	}
}

// TestEngine_Redeploy_WithNewVersion tests that redeploy uses the latest version if one was added
func TestEngine_Redeploy_WithNewVersion(t *testing.T) {
	jobAgentId := uuid.New().String()
	deploymentId := uuid.New().String()
	environmentId := uuid.New().String()
	resourceId := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentId),
			integration.JobAgentName("Test Agent"),
		),
		integration.WithSystem(
			integration.SystemName("test-system"),
			integration.WithDeployment(
				integration.DeploymentID(deploymentId),
				integration.DeploymentName("api-service"),
				integration.DeploymentJobAgent(jobAgentId),
				integration.DeploymentCelResourceSelector("true"),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentId),
				integration.EnvironmentName("production"),
			),
		),
		integration.WithResource(
			integration.ResourceID(resourceId),
			integration.ResourceName("server-1"),
		),
	)

	ctx := context.Background()

	// Get release target
	releaseTargets, _ := engine.Workspace().ReleaseTargets().Items()
	var releaseTarget *oapi.ReleaseTarget
	for _, rt := range releaseTargets {
		releaseTarget = rt
		break
	}

	// Create first deployment version
	dv1 := c.NewDeploymentVersion()
	dv1.DeploymentId = deploymentId
	dv1.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv1)

	// Get and complete the initial job
	pendingJobs := engine.Workspace().Jobs().GetPending()
	for _, job := range pendingJobs {
		job.Status = oapi.JobStatusSuccessful
		engine.PushEvent(ctx, handler.JobUpdate, job)
	}

	// Create a second deployment version
	dv2 := c.NewDeploymentVersion()
	dv2.DeploymentId = deploymentId
	dv2.Tag = "v2.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv2)

	// Complete the v2 job
	pendingJobs = engine.Workspace().Jobs().GetPending()
	for _, job := range pendingJobs {
		job.Status = oapi.JobStatusSuccessful
		engine.PushEvent(ctx, handler.JobUpdate, job)
	}

	// Create a third deployment version
	dv3 := c.NewDeploymentVersion()
	dv3.DeploymentId = deploymentId
	dv3.Tag = "v3.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv3)

	// Complete the v3 job
	pendingJobs = engine.Workspace().Jobs().GetPending()
	for _, job := range pendingJobs {
		job.Status = oapi.JobStatusSuccessful
		engine.PushEvent(ctx, handler.JobUpdate, job)
	}

	// Trigger redeploy
	engine.PushEvent(ctx, handler.ReleaseTargetDeploy, releaseTarget)

	// Verify new job was created with the latest version
	pendingJobs = engine.Workspace().Jobs().GetPending()
	if len(pendingJobs) != 1 {
		t.Fatalf("expected 1 pending job after redeploy, got %d", len(pendingJobs))
	}

	var redeployJob *oapi.Job
	for _, j := range pendingJobs {
		redeployJob = j
		break
	}

	redeployRelease, ok := engine.Workspace().Releases().Get(redeployJob.ReleaseId)
	if !ok {
		t.Fatalf("release %s not found for redeploy job", redeployJob.ReleaseId)
	}

	// Verify the redeploy uses the latest version (v3.0.0)
	if redeployRelease.Version.Tag != "v3.0.0" {
		t.Errorf("redeploy release version tag = %s, want v3.0.0", redeployRelease.Version.Tag)
	}
}

// TestEngine_Redeploy_WithVariables tests that redeploy preserves resource variables
func TestEngine_Redeploy_WithVariables(t *testing.T) {
	jobAgentId := uuid.New().String()
	deploymentId := uuid.New().String()
	environmentId := uuid.New().String()
	resourceId := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentId),
			integration.JobAgentName("Test Agent"),
		),
		integration.WithSystem(
			integration.SystemName("test-system"),
			integration.WithDeployment(
				integration.DeploymentID(deploymentId),
				integration.DeploymentName("api-service"),
				integration.DeploymentJobAgent(jobAgentId),
				integration.DeploymentCelResourceSelector("true"),
				integration.DeploymentJobAgentConfig(map[string]any{
					"namespace": "production",
				}),
				// Define deployment variables so resource variables can override them
				integration.WithDeploymentVariable("app_name"),
				integration.WithDeploymentVariable("replicas"),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentId),
				integration.EnvironmentName("production"),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceID(resourceId),
			integration.ResourceName("server-1"),
			integration.WithResourceVariable(
				"app_name",
				integration.ResourceVariableStringValue("my-app"),
			),
			integration.WithResourceVariable(
				"replicas",
				integration.ResourceVariableIntValue(5),
			),
		),
	)

	ctx := context.Background()

	// Get release target
	releaseTargets, _ := engine.Workspace().ReleaseTargets().Items()
	var releaseTarget *oapi.ReleaseTarget
	for _, rt := range releaseTargets {
		releaseTarget = rt
		break
	}

	// Create deployment version
	dv := c.NewDeploymentVersion()
	dv.DeploymentId = deploymentId
	dv.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv)

	// Complete the initial job
	pendingJobs := engine.Workspace().Jobs().GetPending()
	for _, job := range pendingJobs {
		job.Status = oapi.JobStatusSuccessful
		engine.PushEvent(ctx, handler.JobUpdate, job)
	}

	// Trigger redeploy
	engine.PushEvent(ctx, handler.ReleaseTargetDeploy, releaseTarget)

	// Verify new job was created
	pendingJobs = engine.Workspace().Jobs().GetPending()
	if len(pendingJobs) != 1 {
		t.Fatalf("expected 1 pending job after redeploy, got %d", len(pendingJobs))
	}

	var redeployJob *oapi.Job
	for _, j := range pendingJobs {
		redeployJob = j
		break
	}

	redeployRelease, ok := engine.Workspace().Releases().Get(redeployJob.ReleaseId)
	if !ok {
		t.Fatalf("release %s not found for redeploy job", redeployJob.ReleaseId)
	}

	// Verify variables are preserved
	variables := redeployRelease.Variables
	if len(variables) != 2 {
		t.Errorf("expected 2 variables, got %d", len(variables))
	}

	if appName, exists := variables["app_name"]; !exists {
		t.Error("app_name variable not found after redeploy")
	} else if v, _ := appName.AsStringValue(); v != "my-app" {
		t.Errorf("app_name = %s, want my-app", v)
	}

	if replicas, exists := variables["replicas"]; !exists {
		t.Error("replicas variable not found after redeploy")
	} else if v, _ := replicas.AsIntegerValue(); v != 5 {
		t.Errorf("replicas = %d, want 5", v)
	}

	cfg, err := redeployJob.JobAgentConfig.AsFullCustomJobAgentConfig()
	if err != nil {
		t.Fatalf("failed to get job job agent config: %v", err)
	}

	// Verify job agent config is preserved
	if cfg.AdditionalProperties["namespace"] != "production" {
		t.Errorf("job agent config namespace = %v, want production",
			cfg.AdditionalProperties["namespace"])
	}
}

// TestEngine_Redeploy_WithPendingJob tests that redeploy is blocked when a job is pending
func TestEngine_Redeploy_WithPendingJob(t *testing.T) {
	jobAgentId := uuid.New().String()
	deploymentId := uuid.New().String()
	environmentId := uuid.New().String()
	resourceId := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentId),
			integration.JobAgentName("Test Agent"),
		),
		integration.WithSystem(
			integration.SystemName("test-system"),
			integration.WithDeployment(
				integration.DeploymentID(deploymentId),
				integration.DeploymentName("api-service"),
				integration.DeploymentJobAgent(jobAgentId),
				integration.DeploymentCelResourceSelector("true"),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentId),
				integration.EnvironmentName("production"),
			),
		),
		integration.WithResource(
			integration.ResourceID(resourceId),
			integration.ResourceName("server-1"),
		),
	)

	ctx := context.Background()

	// Get release target
	releaseTargets, _ := engine.Workspace().ReleaseTargets().Items()
	var releaseTarget *oapi.ReleaseTarget
	for _, rt := range releaseTargets {
		releaseTarget = rt
		break
	}

	// Create deployment version
	dv := c.NewDeploymentVersion()
	dv.DeploymentId = deploymentId
	dv.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv)

	// Verify initial job was created
	pendingJobs := engine.Workspace().Jobs().GetPending()
	if len(pendingJobs) != 1 {
		t.Fatalf("expected 1 pending job, got %d", len(pendingJobs))
	}

	var initialJob *oapi.Job
	for _, j := range pendingJobs {
		initialJob = j
		break
	}

	// Trigger redeploy while job is still pending - should be blocked
	engine.PushEvent(ctx, handler.ReleaseTargetDeploy, releaseTarget)

	// Verify no new job was created (redeploy was blocked)
	allJobs := engine.Workspace().Jobs().Items()
	if len(allJobs) != 1 {
		t.Fatalf("expected only 1 job (pending), got %d", len(allJobs))
	}

	// Verify it's still the same job
	pendingJobs = engine.Workspace().Jobs().GetPending()
	if len(pendingJobs) != 1 {
		t.Fatalf("expected 1 pending job (original), got %d", len(pendingJobs))
	}

	for _, job := range pendingJobs {
		if job.Id != initialJob.Id {
			t.Errorf("expected same job ID after blocked redeploy, got different ID")
		}
	}
}

// TestEngine_Redeploy_BlockedByInProgressJob tests that redeploy is blocked when a job is in progress
func TestEngine_Redeploy_BlockedByInProgressJob(t *testing.T) {
	jobAgentId := uuid.New().String()
	deploymentId := uuid.New().String()
	environmentId := uuid.New().String()
	resourceId := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentId),
			integration.JobAgentName("Test Agent"),
		),
		integration.WithSystem(
			integration.SystemName("test-system"),
			integration.WithDeployment(
				integration.DeploymentID(deploymentId),
				integration.DeploymentName("api-service"),
				integration.DeploymentJobAgent(jobAgentId),
				integration.DeploymentCelResourceSelector("true"),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentId),
				integration.EnvironmentName("production"),
			),
		),
		integration.WithResource(
			integration.ResourceID(resourceId),
			integration.ResourceName("server-1"),
		),
	)

	ctx := context.Background()

	// Get release target
	releaseTargets, _ := engine.Workspace().ReleaseTargets().Items()
	var releaseTarget *oapi.ReleaseTarget
	for _, rt := range releaseTargets {
		releaseTarget = rt
		break
	}

	// Create deployment version
	dv := c.NewDeploymentVersion()
	dv.DeploymentId = deploymentId
	dv.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv)

	// Verify initial job was created
	pendingJobs := engine.Workspace().Jobs().GetPending()
	if len(pendingJobs) != 1 {
		t.Fatalf("expected 1 pending job, got %d", len(pendingJobs))
	}

	var initialJob *oapi.Job
	for _, j := range pendingJobs {
		initialJob = j
		break
	}

	// Mark job as in-progress (not completed)
	initialJob.Status = oapi.JobStatusInProgress
	engine.PushEvent(ctx, handler.JobUpdate, initialJob)

	// Verify job is now in progress
	allJobs := engine.Workspace().Jobs().Items()
	inProgressJob, exists := allJobs[initialJob.Id]
	if !exists || inProgressJob.Status != oapi.JobStatusInProgress {
		t.Fatalf("expected job to be in progress")
	}

	// Trigger redeploy while job is in progress - should be blocked
	engine.PushEvent(ctx, handler.ReleaseTargetDeploy, releaseTarget)

	// Verify no new pending job was created (redeploy was blocked)
	pendingJobsAfterBlockedRedeploy := engine.Workspace().Jobs().GetPending()
	if len(pendingJobsAfterBlockedRedeploy) != 0 {
		t.Fatalf("expected 0 pending jobs after blocked redeploy, got %d", len(pendingJobsAfterBlockedRedeploy))
	}

	// Verify the in-progress job is still in progress
	allJobs = engine.Workspace().Jobs().Items()
	jobAfterRedeploy, exists := allJobs[initialJob.Id]
	if !exists {
		t.Fatalf("expected original job to still exist")
	}
	if jobAfterRedeploy.Status != oapi.JobStatusInProgress {
		t.Errorf("expected job to remain in progress, got %v", jobAfterRedeploy.Status)
	}

	// Now complete the job
	initialJob.Status = oapi.JobStatusSuccessful
	engine.PushEvent(ctx, handler.JobUpdate, initialJob)

	// Trigger redeploy again - should work now
	engine.PushEvent(ctx, handler.ReleaseTargetDeploy, releaseTarget)

	// Verify new job was created after completion
	pendingJobsAfterCompletion := engine.Workspace().Jobs().GetPending()
	if len(pendingJobsAfterCompletion) != 1 {
		t.Fatalf("expected 1 pending job after redeploy following completion, got %d", len(pendingJobsAfterCompletion))
	}

	var newJob *oapi.Job
	for _, j := range pendingJobsAfterCompletion {
		newJob = j
		break
	}

	// Verify it's a different job
	if newJob.Id == initialJob.Id {
		t.Errorf("expected new job after redeploy following completion, got same job ID")
	}

	// Verify we now have at least the original completed job plus the new pending job
	allJobsAfterSuccess := engine.Workspace().Jobs().Items()
	if len(allJobsAfterSuccess) < 2 {
		t.Errorf("expected at least 2 jobs after successful redeploy, got %d", len(allJobsAfterSuccess))
	}

	// Verify the original job is no longer pending or in progress
	origJob, exists := allJobsAfterSuccess[initialJob.Id]
	if exists && origJob.IsInProcessingState() {
		t.Errorf("expected original job to be completed, got status %v", origJob.Status)
	}
}

// TestEngine_Redeploy_BlockedByActionRequiredJob tests that redeploy is blocked when a job requires action
func TestEngine_Redeploy_BlockedByActionRequiredJob(t *testing.T) {
	jobAgentId := uuid.New().String()
	deploymentId := uuid.New().String()
	environmentId := uuid.New().String()
	resourceId := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentId),
			integration.JobAgentName("Test Agent"),
		),
		integration.WithSystem(
			integration.SystemName("test-system"),
			integration.WithDeployment(
				integration.DeploymentID(deploymentId),
				integration.DeploymentName("api-service"),
				integration.DeploymentJobAgent(jobAgentId),
				integration.DeploymentCelResourceSelector("true"),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentId),
				integration.EnvironmentName("production"),
			),
		),
		integration.WithResource(
			integration.ResourceID(resourceId),
			integration.ResourceName("server-1"),
		),
	)

	ctx := context.Background()

	// Get release target
	releaseTargets, _ := engine.Workspace().ReleaseTargets().Items()
	var releaseTarget *oapi.ReleaseTarget
	for _, rt := range releaseTargets {
		releaseTarget = rt
		break
	}

	// Create deployment version
	dv := c.NewDeploymentVersion()
	dv.DeploymentId = deploymentId
	dv.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv)

	// Get the initial job
	pendingJobs := engine.Workspace().Jobs().GetPending()
	var initialJob *oapi.Job
	for _, j := range pendingJobs {
		initialJob = j
		break
	}

	// Mark job as requiring action
	initialJob.Status = oapi.JobStatusActionRequired
	engine.PushEvent(ctx, handler.JobUpdate, initialJob)

	// Trigger redeploy - should be blocked
	engine.PushEvent(ctx, handler.ReleaseTargetDeploy, releaseTarget)

	// Verify no new pending job was created (redeploy was blocked)
	pendingJobsAfterBlockedRedeploy := engine.Workspace().Jobs().GetPending()
	if len(pendingJobsAfterBlockedRedeploy) != 0 {
		t.Fatalf("expected 0 pending jobs after blocked redeploy, got %d", len(pendingJobsAfterBlockedRedeploy))
	}

	// Verify the job is still in action required state
	allJobs := engine.Workspace().Jobs().Items()
	job, exists := allJobs[initialJob.Id]
	if !exists || job.Status != oapi.JobStatusActionRequired {
		t.Errorf("expected job to remain in action required state")
	}
}

// TestEngine_Redeploy_WithInvalidJobAgent tests that redeploy works with InvalidJobAgent jobs
// since they are not in a processing state
func TestEngine_Redeploy_WithInvalidJobAgent(t *testing.T) {
	deploymentId := uuid.New().String()
	environmentId := uuid.New().String()
	resourceId := uuid.New().String()

	// Create deployment WITHOUT job agent
	engine := integration.NewTestWorkspace(t,
		integration.WithSystem(
			integration.SystemName("test-system"),
			integration.WithDeployment(
				integration.DeploymentID(deploymentId),
				integration.DeploymentName("no-agent-deployment"),
				integration.DeploymentCelResourceSelector("true"),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentId),
				integration.EnvironmentName("production"),
			),
		),
		integration.WithResource(
			integration.ResourceID(resourceId),
			integration.ResourceName("server-1"),
		),
	)

	ctx := context.Background()

	// Get release target
	releaseTargets, _ := engine.Workspace().ReleaseTargets().Items()
	var releaseTarget *oapi.ReleaseTarget
	for _, rt := range releaseTargets {
		releaseTarget = rt
		break
	}

	// Create deployment version
	dv := c.NewDeploymentVersion()
	dv.DeploymentId = deploymentId
	dv.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv)

	// Verify job was created with InvalidJobAgent status
	allJobs := engine.Workspace().Jobs().Items()
	if len(allJobs) != 1 {
		t.Fatalf("expected 1 job, got %d", len(allJobs))
	}

	var initialJob *oapi.Job
	for _, j := range allJobs {
		initialJob = j
		break
	}

	if initialJob.Status != oapi.JobStatusInvalidJobAgent {
		t.Fatalf("expected initial job status InvalidJobAgent, got %v", initialJob.Status)
	}

	// Trigger redeploy - should work since InvalidJobAgent is NOT in processing state
	engine.PushEvent(ctx, handler.ReleaseTargetDeploy, releaseTarget)

	// Verify new job was created (InvalidJobAgent doesn't block redeploy)
	allJobsAfterRedeploy := engine.Workspace().Jobs().Items()
	if len(allJobsAfterRedeploy) != 2 {
		t.Fatalf("expected 2 jobs after redeploy, got %d", len(allJobsAfterRedeploy))
	}

	// Verify both jobs have InvalidJobAgent status
	invalidJobAgentCount := 0
	for _, j := range allJobsAfterRedeploy {
		if j.Status == oapi.JobStatusInvalidJobAgent {
			invalidJobAgentCount++
		}
	}

	if invalidJobAgentCount != 2 {
		t.Errorf("expected 2 jobs with InvalidJobAgent status, got %d", invalidJobAgentCount)
	}

	// Verify no jobs are in pending state
	pendingJobs := engine.Workspace().Jobs().GetPending()
	if len(pendingJobs) != 0 {
		t.Errorf("expected 0 pending jobs (InvalidJobAgent is not pending), got %d", len(pendingJobs))
	}
}
