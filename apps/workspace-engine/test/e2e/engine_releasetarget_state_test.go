package e2e

import (
	"context"
	"testing"
	"time"
	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/oapi"
	"workspace-engine/test/integration"
	c "workspace-engine/test/integration/creators"
)

// TestEngine_ReleaseTargetState_NoCurrentNoDesired tests state when
// no releases exist yet (no versions created)
func TestEngine_ReleaseTargetState_NoCurrentNoDesired(t *testing.T) {
	jobAgentID := "job-agent-1"
	deploymentID := "deployment-1"
	environmentID := "env-1"
	resourceID := "resource-1"

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
				integration.EnvironmentJsonResourceSelector(map[string]any{
					"type":     "name",
					"operator": "starts-with",
					"value":    "",
				}),
			),
		),
		integration.WithResource(
			integration.ResourceID(resourceID),
		),
	)

	ctx := context.Background()

	// Get the release target
	releaseTargets, err := engine.Workspace().ReleaseTargets().Items(ctx)
	if err != nil {
		t.Fatalf("failed to get release targets: %v", err)
	}
	if len(releaseTargets) != 1 {
		t.Fatalf("expected 1 release target, got %d", len(releaseTargets))
	}

	var releaseTarget *oapi.ReleaseTarget
	for _, rt := range releaseTargets {
		releaseTarget = rt
		break
	}

	// Get the release target state
	state, err := engine.Workspace().ReleaseManager().GetReleaseTargetState(ctx, releaseTarget)
	if err != nil {
		t.Fatalf("failed to get release target state: %v", err)
	}

	// Verify: no current release (no successful jobs)
	if state.CurrentRelease != nil {
		t.Errorf("expected no current release, got release %s", state.CurrentRelease.ID())
	}

	// Verify: no desired release (no versions available)
	if state.DesiredRelease != nil {
		t.Errorf("expected no desired release, got release %s", state.DesiredRelease.ID())
	}
}

// TestEngine_ReleaseTargetState_NoCurrentWithDesired tests state when
// a desired release exists but no current release (new deployment)
func TestEngine_ReleaseTargetState_NoCurrentWithDesired(t *testing.T) {
	jobAgentID := "job-agent-1"
	deploymentID := "deployment-1"
	environmentID := "env-1"
	resourceID := "resource-1"

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
				integration.EnvironmentJsonResourceSelector(map[string]any{
					"type":     "name",
					"operator": "starts-with",
					"value":    "",
				}),
			),
		),
		integration.WithResource(
			integration.ResourceID(resourceID),
		),
	)

	ctx := context.Background()

	// Create a deployment version - this creates a desired release
	version := c.NewDeploymentVersion()
	version.DeploymentId = deploymentID
	version.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, version)

	// Get the release target
	releaseTargets, err := engine.Workspace().ReleaseTargets().Items(ctx)
	if err != nil {
		t.Fatalf("failed to get release targets: %v", err)
	}
	if len(releaseTargets) != 1 {
		t.Fatalf("expected 1 release target, got %d", len(releaseTargets))
	}

	var releaseTarget *oapi.ReleaseTarget
	for _, rt := range releaseTargets {
		releaseTarget = rt
		break
	}

	// Get the release target state
	state, err := engine.Workspace().ReleaseManager().GetReleaseTargetState(ctx, releaseTarget)
	if err != nil {
		t.Fatalf("failed to get release target state: %v", err)
	}

	// Verify: no current release (job not completed yet)
	if state.CurrentRelease != nil {
		t.Errorf("expected no current release, got release %s", state.CurrentRelease.ID())
	}

	// Verify: desired release exists
	if state.DesiredRelease == nil {
		t.Fatalf("expected desired release, got nil")
	}

	// Verify: desired release is for the correct version
	if state.DesiredRelease.Version.Tag != "v1.0.0" {
		t.Errorf("expected desired release version v1.0.0, got %s", state.DesiredRelease.Version.Tag)
	}
}

// TestEngine_ReleaseTargetState_CurrentMatchesDesired tests state when
// current and desired releases match (system is up-to-date)
func TestEngine_ReleaseTargetState_CurrentMatchesDesired(t *testing.T) {
	jobAgentID := "job-agent-1"
	deploymentID := "deployment-1"
	environmentID := "env-1"
	resourceID := "resource-1"

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
				integration.EnvironmentJsonResourceSelector(map[string]any{
					"type":     "name",
					"operator": "starts-with",
					"value":    "",
				}),
			),
		),
		integration.WithResource(
			integration.ResourceID(resourceID),
		),
	)

	ctx := context.Background()

	// Create a deployment version
	version := c.NewDeploymentVersion()
	version.DeploymentId = deploymentID
	version.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, version)

	// Get the job and mark it as successful
	jobs := engine.Workspace().Jobs().Items()
	if len(jobs) != 1 {
		t.Fatalf("expected 1 job, got %d", len(jobs))
	}

	var job *oapi.Job
	for _, j := range jobs {
		job = j
		break
	}

	// Mark the job as successful
	now := time.Now()
	job.Status = oapi.Successful
	job.CompletedAt = &now
	engine.PushEvent(ctx, handler.JobUpdate, job)

	// Get the release target
	releaseTargets, err := engine.Workspace().ReleaseTargets().Items(ctx)
	if err != nil {
		t.Fatalf("failed to get release targets: %v", err)
	}
	if len(releaseTargets) != 1 {
		t.Fatalf("expected 1 release target, got %d", len(releaseTargets))
	}

	var releaseTarget *oapi.ReleaseTarget
	for _, rt := range releaseTargets {
		releaseTarget = rt
		break
	}

	// Get the release target state
	state, err := engine.Workspace().ReleaseManager().GetReleaseTargetState(ctx, releaseTarget)
	if err != nil {
		t.Fatalf("failed to get release target state: %v", err)
	}

	// Verify: current release exists
	if state.CurrentRelease == nil {
		t.Fatalf("expected current release, got nil")
	}

	// Verify: desired release exists
	if state.DesiredRelease == nil {
		t.Fatalf("expected desired release, got nil")
	}

	// Verify: both releases are for the same version
	if state.CurrentRelease.Version.Tag != "v1.0.0" {
		t.Errorf("expected current release version v1.0.0, got %s", state.CurrentRelease.Version.Tag)
	}
	if state.DesiredRelease.Version.Tag != "v1.0.0" {
		t.Errorf("expected desired release version v1.0.0, got %s", state.DesiredRelease.Version.Tag)
	}

	// Verify: releases are the same
	if state.CurrentRelease.ID() != state.DesiredRelease.ID() {
		t.Errorf("expected current and desired releases to be the same, got current=%s, desired=%s",
			state.CurrentRelease.ID(), state.DesiredRelease.ID())
	}
}

// TestEngine_ReleaseTargetState_CurrentDiffersFromDesired tests state when
// current and desired releases differ (new deployment pending)
func TestEngine_ReleaseTargetState_CurrentDiffersFromDesired(t *testing.T) {
	jobAgentID := "job-agent-1"
	deploymentID := "deployment-1"
	environmentID := "env-1"
	resourceID := "resource-1"

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
				integration.EnvironmentJsonResourceSelector(map[string]any{
					"type":     "name",
					"operator": "starts-with",
					"value":    "",
				}),
			),
		),
		integration.WithResource(
			integration.ResourceID(resourceID),
		),
	)

	ctx := context.Background()

	// Create first version and mark it as successful
	version1 := c.NewDeploymentVersion()
	version1.DeploymentId = deploymentID
	version1.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, version1)

	// Get the first job and mark it as successful
	jobs := engine.Workspace().Jobs().Items()
	if len(jobs) != 1 {
		t.Fatalf("expected 1 job, got %d", len(jobs))
	}

	var job1 *oapi.Job
	for _, j := range jobs {
		job1 = j
		break
	}

	now := time.Now()
	job1.Status = oapi.Successful
	job1.CompletedAt = &now
	engine.PushEvent(ctx, handler.JobUpdate, job1)

	// Create second version (this becomes the desired release)
	version2 := c.NewDeploymentVersion()
	version2.DeploymentId = deploymentID
	version2.Tag = "v2.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, version2)

	// Get the release target
	releaseTargets, err := engine.Workspace().ReleaseTargets().Items(ctx)
	if err != nil {
		t.Fatalf("failed to get release targets: %v", err)
	}
	if len(releaseTargets) != 1 {
		t.Fatalf("expected 1 release target, got %d", len(releaseTargets))
	}

	var releaseTarget *oapi.ReleaseTarget
	for _, rt := range releaseTargets {
		releaseTarget = rt
		break
	}

	// Get the release target state
	state, err := engine.Workspace().ReleaseManager().GetReleaseTargetState(ctx, releaseTarget)
	if err != nil {
		t.Fatalf("failed to get release target state: %v", err)
	}

	// Verify: current release exists (v1.0.0)
	if state.CurrentRelease == nil {
		t.Fatalf("expected current release, got nil")
	}
	if state.CurrentRelease.Version.Tag != "v1.0.0" {
		t.Errorf("expected current release version v1.0.0, got %s", state.CurrentRelease.Version.Tag)
	}

	// Verify: desired release exists (v2.0.0)
	if state.DesiredRelease == nil {
		t.Fatalf("expected desired release, got nil")
	}
	if state.DesiredRelease.Version.Tag != "v2.0.0" {
		t.Errorf("expected desired release version v2.0.0, got %s", state.DesiredRelease.Version.Tag)
	}

	// Verify: releases are different
	if state.CurrentRelease.ID() == state.DesiredRelease.ID() {
		t.Errorf("expected current and desired releases to differ")
	}
}

// TestEngine_ReleaseTargetState_JobStatusTransitions tests that job status
// changes correctly affect the current release
func TestEngine_ReleaseTargetState_JobStatusTransitions(t *testing.T) {
	jobAgentID := "job-agent-1"
	deploymentID := "deployment-1"
	environmentID := "env-1"
	resourceID := "resource-1"

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
				integration.EnvironmentJsonResourceSelector(map[string]any{
					"type":     "name",
					"operator": "starts-with",
					"value":    "",
				}),
			),
		),
		integration.WithResource(
			integration.ResourceID(resourceID),
		),
	)

	ctx := context.Background()

	// Create a deployment version
	version := c.NewDeploymentVersion()
	version.DeploymentId = deploymentID
	version.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, version)

	// Get the release target
	releaseTargets, err := engine.Workspace().ReleaseTargets().Items(ctx)
	if err != nil {
		t.Fatalf("failed to get release targets: %v", err)
	}
	if len(releaseTargets) != 1 {
		t.Fatalf("expected 1 release target, got %d", len(releaseTargets))
	}

	var releaseTarget *oapi.ReleaseTarget
	for _, rt := range releaseTargets {
		releaseTarget = rt
		break
	}

	// Get the job
	jobs := engine.Workspace().Jobs().Items()
	if len(jobs) != 1 {
		t.Fatalf("expected 1 job, got %d", len(jobs))
	}

	var job *oapi.Job
	for _, j := range jobs {
		job = j
		break
	}

	// State 1: Job is Pending - no current release
	state, err := engine.Workspace().ReleaseManager().GetReleaseTargetState(ctx, releaseTarget)
	if err != nil {
		t.Fatalf("failed to get release target state: %v", err)
	}
	if state.CurrentRelease != nil {
		t.Errorf("expected no current release when job is pending, got release %s", state.CurrentRelease.ID())
	}

	// State 2: Job is InProgress - still no current release
	job.Status = oapi.InProgress
	engine.PushEvent(ctx, handler.JobUpdate, job)

	state, err = engine.Workspace().ReleaseManager().GetReleaseTargetState(ctx, releaseTarget)
	if err != nil {
		t.Fatalf("failed to get release target state: %v", err)
	}
	if state.CurrentRelease != nil {
		t.Errorf("expected no current release when job is in progress, got release %s", state.CurrentRelease.ID())
	}

	// State 3: Job is Successful - current release should now exist
	now := time.Now()
	job.Status = oapi.Successful
	job.CompletedAt = &now
	engine.PushEvent(ctx, handler.JobUpdate, job)

	state, err = engine.Workspace().ReleaseManager().GetReleaseTargetState(ctx, releaseTarget)
	if err != nil {
		t.Fatalf("failed to get release target state: %v", err)
	}
	if state.CurrentRelease == nil {
		t.Fatalf("expected current release when job is successful, got nil")
	}
	if state.CurrentRelease.Version.Tag != "v1.0.0" {
		t.Errorf("expected current release version v1.0.0, got %s", state.CurrentRelease.Version.Tag)
	}

	// Create a second version and verify the job failure doesn't change current
	version2 := c.NewDeploymentVersion()
	version2.DeploymentId = deploymentID
	version2.Tag = "v2.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, version2)

	// Get the new job (there should be at least 2 jobs now)
	jobs = engine.Workspace().Jobs().Items()
	if len(jobs) < 2 {
		t.Fatalf("expected at least 2 jobs, got %d", len(jobs))
	}

	var job2 *oapi.Job
	for _, j := range jobs {
		// Find the job that belongs to version2
		release, ok := engine.Workspace().Releases().Get(j.ReleaseId)
		if ok && release.Version.Tag == "v2.0.0" {
			job2 = j
			break
		}
	}

	if job2 == nil {
		t.Fatalf("job2 for version v2.0.0 not found")
	}

	// State 4: New job fails - current release should still be v1.0.0
	// Get fresh job instance and update it
	job2Fresh, ok := engine.Workspace().Jobs().Get(job2.Id)
	if !ok {
		t.Fatalf("job2 %s not found", job2.Id)
	}
	now2 := time.Now()
	job2Fresh.Status = oapi.Failure
	job2Fresh.CompletedAt = &now2
	engine.PushEvent(ctx, handler.JobUpdate, job2Fresh)

	state, err = engine.Workspace().ReleaseManager().GetReleaseTargetState(ctx, releaseTarget)
	if err != nil {
		t.Fatalf("failed to get release target state: %v", err)
	}
	if state.CurrentRelease == nil {
		t.Fatalf("expected current release after failed job, got nil")
	}
	if state.CurrentRelease.Version.Tag != "v1.0.0" {
		t.Errorf("expected current release to still be v1.0.0 after failed job, got %s", state.CurrentRelease.Version.Tag)
	}
}

// TestEngine_ReleaseTargetState_MultipleReleaseTargets tests state tracking
// across multiple release targets
func TestEngine_ReleaseTargetState_MultipleReleaseTargets(t *testing.T) {
	jobAgentID := "job-agent-1"
	deploymentID := "deployment-1"
	environmentID := "env-1"
	resource1ID := "resource-1"
	resource2ID := "resource-2"

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
				integration.EnvironmentJsonResourceSelector(map[string]any{
					"type":     "name",
					"operator": "starts-with",
					"value":    "",
				}),
			),
		),
		integration.WithResource(
			integration.ResourceID(resource1ID),
		),
		integration.WithResource(
			integration.ResourceID(resource2ID),
		),
	)

	ctx := context.Background()

	// Create a deployment version - creates jobs for both release targets
	version := c.NewDeploymentVersion()
	version.DeploymentId = deploymentID
	version.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, version)

	// Get the release targets
	releaseTargets, err := engine.Workspace().ReleaseTargets().Items(ctx)
	if err != nil {
		t.Fatalf("failed to get release targets: %v", err)
	}
	if len(releaseTargets) != 2 {
		t.Fatalf("expected 2 release targets, got %d", len(releaseTargets))
	}

	// Get jobs - should be 2
	jobs := engine.Workspace().Jobs().Items()
	if len(jobs) != 2 {
		t.Fatalf("expected 2 jobs, got %d", len(jobs))
	}

	// Mark only the first job as successful
	var completedJob *oapi.Job
	for _, j := range jobs {
		completedJob = j
		break
	}

	now := time.Now()
	completedJob.Status = oapi.Successful
	completedJob.CompletedAt = &now
	engine.PushEvent(ctx, handler.JobUpdate, completedJob)

	// Get the release for the completed job
	completedRelease, ok := engine.Workspace().Releases().Get(completedJob.ReleaseId)
	if !ok {
		t.Fatalf("release %s not found", completedJob.ReleaseId)
	}

	// Find the release target that has a completed job
	completedReleaseTarget := &oapi.ReleaseTarget{
		DeploymentId:  completedRelease.ReleaseTarget.DeploymentId,
		EnvironmentId: completedRelease.ReleaseTarget.EnvironmentId,
		ResourceId:    completedRelease.ReleaseTarget.ResourceId,
	}

	// Find the release target that does not have a completed job
	var pendingReleaseTarget *oapi.ReleaseTarget
	for _, rt := range releaseTargets {
		if rt.ResourceId != completedReleaseTarget.ResourceId {
			pendingReleaseTarget = rt
			break
		}
	}

	// Check state of release target with completed job
	state1, err := engine.Workspace().ReleaseManager().GetReleaseTargetState(ctx, completedReleaseTarget)
	if err != nil {
		t.Fatalf("failed to get release target state for completed: %v", err)
	}
	if state1.CurrentRelease == nil {
		t.Errorf("expected current release for completed target, got nil")
	}
	if state1.DesiredRelease == nil {
		t.Errorf("expected desired release for completed target, got nil")
	}

	// Check state of release target without completed job
	state2, err := engine.Workspace().ReleaseManager().GetReleaseTargetState(ctx, pendingReleaseTarget)
	if err != nil {
		t.Fatalf("failed to get release target state for pending: %v", err)
	}
	if state2.CurrentRelease != nil {
		t.Errorf("expected no current release for pending target, got release %s", state2.CurrentRelease.ID())
	}
	if state2.DesiredRelease == nil {
		t.Errorf("expected desired release for pending target, got nil")
	}
}

// TestEngine_ReleaseTargetState_MostRecentSuccessful tests that current release
// is determined by the most recent successful job, not just any successful job
func TestEngine_ReleaseTargetState_MostRecentSuccessful(t *testing.T) {
	jobAgentID := "job-agent-1"
	deploymentID := "deployment-1"
	environmentID := "env-1"
	resourceID := "resource-1"

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
				integration.EnvironmentJsonResourceSelector(map[string]any{
					"type":     "name",
					"operator": "starts-with",
					"value":    "",
				}),
			),
		),
		integration.WithResource(
			integration.ResourceID(resourceID),
		),
	)

	ctx := context.Background()

	// Create first version and complete it
	version1 := c.NewDeploymentVersion()
	version1.DeploymentId = deploymentID
	version1.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, version1)

	jobs := engine.Workspace().Jobs().Items()
	var job1 *oapi.Job
	for _, j := range jobs {
		job1 = j
		break
	}

	// Get fresh job instance and update it
	job1Fresh, ok := engine.Workspace().Jobs().Get(job1.Id)
	if !ok {
		t.Fatalf("job1 %s not found", job1.Id)
	}
	time1 := time.Now().Add(-2 * time.Hour)
	job1Fresh.Status = oapi.Successful
	job1Fresh.CompletedAt = &time1
	engine.PushEvent(ctx, handler.JobUpdate, job1Fresh)

	// Create second version and complete it (more recent)
	version2 := c.NewDeploymentVersion()
	version2.DeploymentId = deploymentID
	version2.Tag = "v2.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, version2)

	jobs = engine.Workspace().Jobs().Items()
	var job2 *oapi.Job
	for _, j := range jobs {
		// Find the job that belongs to version2
		release, ok := engine.Workspace().Releases().Get(j.ReleaseId)
		if ok && release.Version.Tag == "v2.0.0" {
			job2 = j
			break
		}
	}

	if job2 == nil {
		t.Fatalf("job2 for version v2.0.0 not found")
	}

	// Get fresh job instance and update it
	job2Fresh, ok := engine.Workspace().Jobs().Get(job2.Id)
	if !ok {
		t.Fatalf("job2 %s not found", job2.Id)
	}
	time2 := time.Now().Add(-1 * time.Hour)
	job2Fresh.Status = oapi.Successful
	job2Fresh.CompletedAt = &time2
	engine.PushEvent(ctx, handler.JobUpdate, job2Fresh)

	// Create third version and complete it (most recent)
	version3 := c.NewDeploymentVersion()
	version3.DeploymentId = deploymentID
	version3.Tag = "v3.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, version3)

	jobs = engine.Workspace().Jobs().Items()
	var job3 *oapi.Job
	for _, j := range jobs {
		// Find the job that belongs to version3
		release, ok := engine.Workspace().Releases().Get(j.ReleaseId)
		if ok && release.Version.Tag == "v3.0.0" {
			job3 = j
			break
		}
	}

	if job3 == nil {
		t.Fatalf("job3 for version v3.0.0 not found")
	}

	// Get fresh job instance and update it
	job3Fresh, ok := engine.Workspace().Jobs().Get(job3.Id)
	if !ok {
		t.Fatalf("job3 %s not found", job3.Id)
	}
	time3 := time.Now()
	job3Fresh.Status = oapi.Successful
	job3Fresh.CompletedAt = &time3
	engine.PushEvent(ctx, handler.JobUpdate, job3Fresh)

	// Get the release target
	releaseTargets, err := engine.Workspace().ReleaseTargets().Items(ctx)
	if err != nil {
		t.Fatalf("failed to get release targets: %v", err)
	}

	var releaseTarget *oapi.ReleaseTarget
	for _, rt := range releaseTargets {
		releaseTarget = rt
		break
	}

	// Get the release target state
	state, err := engine.Workspace().ReleaseManager().GetReleaseTargetState(ctx, releaseTarget)
	if err != nil {
		t.Fatalf("failed to get release target state: %v", err)
	}

	// Verify: current release should be the most recent (v3.0.0)
	if state.CurrentRelease == nil {
		t.Fatalf("expected current release, got nil")
	}
	if state.CurrentRelease.Version.Tag != "v3.0.0" {
		t.Errorf("expected current release to be most recent (v3.0.0), got %s", state.CurrentRelease.Version.Tag)
	}
}
