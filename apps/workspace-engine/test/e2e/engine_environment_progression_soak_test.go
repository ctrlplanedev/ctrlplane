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

// TestEngine_EnvironmentProgression_SoakTimeNotMet tests that a deployment version
// is blocked from progressing to production when the soak time in staging hasn't elapsed
func TestEngine_EnvironmentProgression_SoakTimeNotMet(t *testing.T) {
	jobAgentID := "job-agent-1"
	deploymentID := "deployment-1"
	stagingEnvID := "env-staging"
	prodEnvID := "env-prod"
	resourceID := "resource-1"
	policyID := "policy-1"

	engine := integration.NewTestWorkspace(t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID),
		),
		integration.WithSystem(
			integration.SystemName("test-system"),
			integration.WithDeployment(
				integration.DeploymentID(deploymentID),
				integration.DeploymentName("api-service"),
				integration.DeploymentJobAgent(jobAgentID),
				integration.DeploymentCelResourceSelector("true"),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(stagingEnvID),
				integration.EnvironmentName("staging"),
				integration.EnvironmentCelResourceSelector("true"),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(prodEnvID),
				integration.EnvironmentName("production"),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceID(resourceID),
		),
		integration.WithPolicy(
			integration.PolicyID(policyID),
			integration.PolicyName("production-progression"),
			integration.WithPolicyTargetSelector(
				// Only apply to production environment
				integration.PolicyTargetJsonEnvironmentSelector(map[string]any{
					"type":     "name",
					"operator": "equals",
					"value":    "production",
				}),
				integration.PolicyTargetCelDeploymentSelector("true"),
				integration.PolicyTargetCelResourceSelector("true"),
			),
			integration.WithPolicyRule(
				integration.WithRuleEnvironmentProgression(
					integration.EnvironmentProgressionDependsOnEnvironmentSelector("environment.name == 'staging'"),
					integration.EnvironmentProgressionMinimumSoakTimeMinutes(30),
				),
			),
		),
	)

	ctx := context.Background()

	// Create a deployment version
	version := c.NewDeploymentVersion()
	version.DeploymentId = deploymentID
	version.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, version)

	time.Sleep(100 * time.Millisecond) // Give time for async processing

	jobs := engine.Workspace().Jobs().Items()

	// Find staging and production jobs
	var stagingJob, prodJob *oapi.Job
	for _, job := range jobs {
		release, _ := engine.Workspace().Releases().Get(job.ReleaseId)
		switch release.ReleaseTarget.EnvironmentId {
		case stagingEnvID:
			stagingJob = job
		case prodEnvID:
			prodJob = job
		}
	}

	// Staging job should exist (not blocked)
	if stagingJob == nil {
		t.Fatal("staging job should be created")
	}

	// Production job should NOT be created (blocked by policy - no successful staging deployment)
	if prodJob != nil {
		t.Fatal("production job should not be created yet (no successful staging deployment)")
	}

	// Update the staging job to successful (just completed)
	stagingJob.Status = oapi.Successful
	completedAt := time.Now()
	stagingJob.CompletedAt = &completedAt
	stagingJob.UpdatedAt = completedAt
	engine.PushEvent(ctx, handler.JobUpdate, stagingJob)

	// Trigger re-evaluation
	engine.PushEvent(ctx, handler.DeploymentVersionUpdate, version)
	time.Sleep(100 * time.Millisecond)

	// Even after staging succeeds, production job should still not be created (soak time not met)
	jobs = engine.Workspace().Jobs().Items()
	prodJobCount := 0
	for _, job := range jobs {
		release, exists := engine.Workspace().Releases().Get(job.ReleaseId)
		if exists && release.ReleaseTarget.EnvironmentId == prodEnvID {
			prodJobCount++
		}
	}
	if prodJobCount > 0 {
		t.Fatalf("expected no production jobs (soak time not met), got %d", prodJobCount)
	}
}

// TestEngine_EnvironmentProgression_SoakTimeMet tests that a deployment version
// progresses to production after the soak time in staging has elapsed
func TestEngine_EnvironmentProgression_SoakTimeMet(t *testing.T) {
	jobAgentID := "job-agent-1"
	deploymentID := "deployment-1"
	stagingEnvID := "env-staging"
	prodEnvID := "env-prod"
	resourceID := "resource-1"
	policyID := "policy-1"

	engine := integration.NewTestWorkspace(t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID),
		),
		integration.WithSystem(
			integration.SystemName("test-system"),
			integration.WithDeployment(
				integration.DeploymentID(deploymentID),
				integration.DeploymentName("api-service"),
				integration.DeploymentJobAgent(jobAgentID),
				integration.DeploymentCelResourceSelector("true"),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(stagingEnvID),
				integration.EnvironmentName("staging"),
				integration.EnvironmentCelResourceSelector("true"),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(prodEnvID),
				integration.EnvironmentName("production"),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceID(resourceID),
		),
		integration.WithPolicy(
			integration.PolicyID(policyID),
			integration.PolicyName("production-progression"),
			integration.WithPolicyTargetSelector(
				// Only apply to production environment
				integration.PolicyTargetCelEnvironmentSelector("environment.name == 'production'"),
				integration.PolicyTargetCelDeploymentSelector("true"),
				integration.PolicyTargetCelResourceSelector("true"),
			),
			integration.WithPolicyRule(
				integration.WithRuleEnvironmentProgression(
					integration.EnvironmentProgressionDependsOnEnvironmentSelector("environment.name == 'staging'"),
					integration.EnvironmentProgressionMinimumSoakTimeMinutes(2),
				),
			),
		),
	)

	ctx := context.Background()

	// Create a deployment version
	version := c.NewDeploymentVersion()
	version.DeploymentId = deploymentID
	version.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, version)

	time.Sleep(100 * time.Millisecond)

	// Get the staging job
	jobs := engine.Workspace().Jobs().Items()
	if len(jobs) != 1 {
		t.Fatalf("expected 1 job initially, got %d", len(jobs))
	}

	var stagingJob *oapi.Job
	for _, job := range jobs {
		stagingJob = job
		break
	}

	// Simulate job completion 3 minutes ago (past the soak time)
	stagingJob.Status = oapi.Successful
	completedAt := time.Now().Add(-3 * time.Minute)
	stagingJob.CompletedAt = &completedAt
	stagingJob.UpdatedAt = completedAt
	engine.PushEvent(ctx, handler.JobUpdate, stagingJob)

	// Give time for release manager to process
	time.Sleep(100 * time.Millisecond)

	// Trigger policy evaluation by triggering a re-check
	// This simulates the periodic release manager evaluation
	engine.PushEvent(ctx, handler.DeploymentVersionUpdate, version)

	time.Sleep(100 * time.Millisecond)

	// Now production job should be created (soak time has elapsed)
	jobs = engine.Workspace().Jobs().Items()

	prodJobCount := 0
	for _, job := range jobs {
		release, exists := engine.Workspace().Releases().Get(job.ReleaseId)
		if exists && release.ReleaseTarget.EnvironmentId == prodEnvID {
			prodJobCount++
		}
	}
	if prodJobCount == 0 {
		t.Fatal("production job should exist after soak time elapsed")
	}
}

// TestEngine_EnvironmentProgression_MultipleDependencyEnvironments tests environment
// progression with multiple dependency environments (OR logic)
func TestEngine_EnvironmentProgression_MultipleDependencyEnvironments(t *testing.T) {
	jobAgentID := "job-agent-1"
	deploymentID := "deployment-1"
	stagingUsEastID := "env-staging-us-east"
	stagingUsWestID := "env-staging-us-west"
	prodEnvID := "env-prod"
	resourceID := "resource-1"
	policyID := "policy-1"

	engine := integration.NewTestWorkspace(t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID),
		),
		integration.WithSystem(
			integration.SystemName("test-system"),
			integration.WithDeployment(
				integration.DeploymentID(deploymentID),
				integration.DeploymentName("api-service"),
				integration.DeploymentJobAgent(jobAgentID),
				integration.DeploymentCelResourceSelector("true"),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(stagingUsEastID),
				integration.EnvironmentName("staging-us-east"),
				integration.EnvironmentCelResourceSelector("true"),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(stagingUsWestID),
				integration.EnvironmentName("staging-us-west"),
				integration.EnvironmentCelResourceSelector("true"),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(prodEnvID),
				integration.EnvironmentName("production"),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceID(resourceID),
		),
		integration.WithPolicy(
			integration.PolicyID(policyID),
			integration.PolicyName("production-progression"),
			integration.WithPolicyTargetSelector(
				integration.PolicyTargetCelEnvironmentSelector("environment.name == 'production'"),
				integration.PolicyTargetCelDeploymentSelector("true"),
				integration.PolicyTargetCelResourceSelector("true"),
			),
			integration.WithPolicyRule(
				integration.WithRuleEnvironmentProgression(
					integration.EnvironmentProgressionDependsOnEnvironmentSelector("environment.name.startsWith('staging')"),
					integration.EnvironmentProgressionMinimumSoakTimeMinutes(2),
				),
			),
		),
	)

	ctx := context.Background()

	// Create a deployment version
	version := c.NewDeploymentVersion()
	version.DeploymentId = deploymentID
	version.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, version)

	time.Sleep(100 * time.Millisecond)

	jobs := engine.Workspace().Jobs().Items()

	// Find and complete just the us-east staging job (past soak time)
	var usEastJob *oapi.Job
	for _, job := range jobs {
		release, _ := engine.Workspace().Releases().Get(job.ReleaseId)
		if release.ReleaseTarget.EnvironmentId == stagingUsEastID {
			usEastJob = job
			break
		}
	}
	if usEastJob == nil {
		t.Fatal("us-east staging job not found")
	}

	usEastJob.Status = oapi.Successful
	completedAt := time.Now().Add(-3 * time.Minute)
	usEastJob.CompletedAt = &completedAt
	usEastJob.UpdatedAt = completedAt
	engine.PushEvent(ctx, handler.JobUpdate, usEastJob)

	// Trigger policy re-evaluation
	engine.PushEvent(ctx, handler.DeploymentVersionUpdate, version)
	time.Sleep(100 * time.Millisecond)

	// Production job should now be created even though us-west hasn't succeeded
	// (OR logic - only need success in ANY dependency environment)
	jobs = engine.Workspace().Jobs().Items()

	prodJobCount := 0
	for _, job := range jobs {
		release, exists := engine.Workspace().Releases().Get(job.ReleaseId)
		if exists && release.ReleaseTarget.EnvironmentId == prodEnvID {
			prodJobCount++
		}
	}
	if prodJobCount == 0 {
		t.Fatal("production job should exist after ONE staging environment succeeds with soak time")
	}
}

// TestEngine_EnvironmentProgression_SoakTimeWithMinimumSuccessPercentage tests
// soak time with success percentage requirements
func TestEngine_EnvironmentProgression_SoakTimeWithMinimumSuccessPercentage(t *testing.T) {
	jobAgentID := "job-agent-1"
	deploymentID := "deployment-1"
	stagingEnvID := "env-staging"
	prodEnvID := "env-prod"
	resource1ID := "resource-1"
	resource2ID := "resource-2"
	resource3ID := "resource-3"
	policyID := "policy-1"

	engine := integration.NewTestWorkspace(t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID),
		),
		integration.WithSystem(
			integration.SystemName("test-system"),
			integration.WithDeployment(
				integration.DeploymentID(deploymentID),
				integration.DeploymentName("api-service"),
				integration.DeploymentJobAgent(jobAgentID),
				integration.DeploymentCelResourceSelector("true"),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(stagingEnvID),
				integration.EnvironmentName("staging"),
				integration.EnvironmentCelResourceSelector("true"),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(prodEnvID),
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
		integration.WithResource(
			integration.ResourceID(resource3ID),
			integration.ResourceName("server-3"),
		),
		integration.WithPolicy(
			integration.PolicyID(policyID),
			integration.PolicyName("production-progression"),
			integration.WithPolicyTargetSelector(
				integration.PolicyTargetJsonEnvironmentSelector(map[string]any{
					"type":     "name",
					"operator": "equals",
					"value":    "production",
				}),
				integration.PolicyTargetCelDeploymentSelector("true"),
				integration.PolicyTargetCelResourceSelector("true"),
			),
			integration.WithPolicyRule(
				integration.WithRuleEnvironmentProgression(
					integration.EnvironmentProgressionDependsOnEnvironmentSelector("environment.name == 'staging'"),
					integration.EnvironmentProgressionMinimumSoakTimeMinutes(2),
					integration.EnvironmentProgressionMinimumSuccessPercentage(60.0),
				),
			),
		),
	)

	ctx := context.Background()

	// Create a deployment version
	version := c.NewDeploymentVersion()
	version.DeploymentId = deploymentID
	version.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, version)

	time.Sleep(100 * time.Millisecond)

	// Should have 3 staging jobs (one per resource)
	jobs := engine.Workspace().Jobs().Items()
	stagingJobs := []*oapi.Job{}
	for _, job := range jobs {
		release, _ := engine.Workspace().Releases().Get(job.ReleaseId)
		if release.ReleaseTarget.EnvironmentId == stagingEnvID {
			stagingJobs = append(stagingJobs, job)
		}
	}
	if len(stagingJobs) != 3 {
		t.Fatalf("expected 3 staging jobs, got %d", len(stagingJobs))
	}

	// Complete 2 out of 3 staging jobs successfully (66.7% success rate)
	completedAt := time.Now().Add(-3 * time.Minute)
	for i := 0; i < 2; i++ {
		stagingJobs[i].Status = oapi.Successful
		stagingJobs[i].CompletedAt = &completedAt
		stagingJobs[i].UpdatedAt = completedAt
		engine.PushEvent(ctx, handler.JobUpdate, stagingJobs[i])
	}

	// Mark the third job as failed
	failedAt := time.Now().Add(-3 * time.Minute)
	stagingJobs[2].Status = oapi.Failure
	stagingJobs[2].CompletedAt = &failedAt
	stagingJobs[2].UpdatedAt = failedAt
	engine.PushEvent(ctx, handler.JobUpdate, stagingJobs[2])

	// Trigger policy re-evaluation
	engine.PushEvent(ctx, handler.DeploymentVersionUpdate, version)
	time.Sleep(100 * time.Millisecond)

	// Production jobs should be created (66.7% > 60% required)
	jobs = engine.Workspace().Jobs().Items()
	prodJobCount := 0
	for _, job := range jobs {
		release, exists := engine.Workspace().Releases().Get(job.ReleaseId)
		if exists && release.ReleaseTarget.EnvironmentId == prodEnvID {
			prodJobCount++
		}
	}
	if prodJobCount != 3 {
		t.Fatalf("expected 3 production jobs after meeting success percentage, got %d", prodJobCount)
	}
}

// TestEngine_EnvironmentProgression_MaximumAge tests that old successful deployments
// are rejected based on maximum age
func TestEngine_EnvironmentProgression_MaximumAge(t *testing.T) {
	jobAgentID := "job-agent-1"
	deploymentID := "deployment-1"
	stagingEnvID := "env-staging"
	prodEnvID := "env-prod"
	resourceID := "resource-1"
	policyID := "policy-1"

	engine := integration.NewTestWorkspace(t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID),
		),
		integration.WithSystem(
			integration.SystemName("test-system"),
			integration.WithDeployment(
				integration.DeploymentID(deploymentID),
				integration.DeploymentName("api-service"),
				integration.DeploymentJobAgent(jobAgentID),
				integration.DeploymentCelResourceSelector("true"),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(stagingEnvID),
				integration.EnvironmentName("staging"),
				integration.EnvironmentCelResourceSelector("true"),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(prodEnvID),
				integration.EnvironmentName("production"),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceID(resourceID),
		),
		integration.WithPolicy(
			integration.PolicyID(policyID),
			integration.PolicyName("production-progression"),
			integration.WithPolicyTargetSelector(
				integration.PolicyTargetCelEnvironmentSelector("environment.name == 'production'"),
				integration.PolicyTargetCelDeploymentSelector("true"),
				integration.PolicyTargetCelResourceSelector("true"),
			),
			integration.WithPolicyRule(
				integration.WithRuleEnvironmentProgression(
					integration.EnvironmentProgressionDependsOnEnvironmentSelector("environment.name == 'staging'"),
					integration.EnvironmentProgressionMaximumAgeHours(2),
				),
			),
		),
	)

	ctx := context.Background()

	// Create a deployment version
	version := c.NewDeploymentVersion()
	version.DeploymentId = deploymentID
	version.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, version)

	time.Sleep(100 * time.Millisecond)

	// Get the staging job
	jobs := engine.Workspace().Jobs().Items()
	if len(jobs) != 1 {
		t.Fatalf("expected 1 job initially, got %d", len(jobs))
	}

	var stagingJob *oapi.Job
	for _, job := range jobs {
		stagingJob = job
		break
	}

	// Complete job 3 hours ago (exceeds max age)
	stagingJob.Status = oapi.Successful
	completedAt := time.Now().Add(-3 * time.Hour)
	stagingJob.CompletedAt = &completedAt
	stagingJob.UpdatedAt = completedAt
	engine.PushEvent(ctx, handler.JobUpdate, stagingJob)

	// Trigger policy re-evaluation
	engine.PushEvent(ctx, handler.DeploymentVersionUpdate, version)
	time.Sleep(100 * time.Millisecond)

	// Production job should NOT be created (deployment too old)
	jobs = engine.Workspace().Jobs().Items()

	prodJobCount := 0
	for _, job := range jobs {
		release, exists := engine.Workspace().Releases().Get(job.ReleaseId)
		if exists && release.ReleaseTarget.EnvironmentId == prodEnvID {
			prodJobCount++
		}
	}
	if prodJobCount > 0 {
		t.Fatalf("expected no production jobs (deployment too old), got %d", prodJobCount)
	}
}
