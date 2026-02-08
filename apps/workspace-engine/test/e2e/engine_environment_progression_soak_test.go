package e2e

import (
	"context"
	"testing"
	"time"
	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/oapi"
	"workspace-engine/test/integration"
	c "workspace-engine/test/integration/creators"

	"github.com/stretchr/testify/assert"
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
			integration.WithPolicySelector("environment.name == 'production'"),
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
	assert.NotNil(t, stagingJob, "staging job should be created")

	// Production job should NOT be created (blocked by policy - no successful staging deployment)
	assert.Nil(t, prodJob, "production job should not be created yet (no successful staging deployment)")

	// Update the staging job to successful (just completed)
	stagingJob.Status = oapi.JobStatusSuccessful
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
	assert.Zero(t, prodJobCount, "expected no production jobs (soak time not met)")
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
			integration.WithPolicySelector("environment.name == 'production'"),
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
	assert.Len(t, jobs, 1, "expected 1 job initially")

	var stagingJob *oapi.Job
	for _, job := range jobs {
		stagingJob = job
		break
	}

	// Simulate job completion 3 minutes ago (past the soak time)
	stagingJob.Status = oapi.JobStatusSuccessful
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
	assert.NotZero(t, prodJobCount, "production job should exist after soak time elapsed")
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
			integration.WithPolicySelector("environment.name == 'production'"),
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
	assert.NotNil(t, usEastJob, "us-east staging job not found")

	usEastJob.Status = oapi.JobStatusSuccessful
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
	assert.NotZero(t, prodJobCount, "production job should exist after ONE staging environment succeeds with soak time")
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
			integration.WithPolicySelector("environment.name == 'production'"),
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
	assert.Len(t, stagingJobs, 3, "expected 3 staging jobs")

	// Complete 2 out of 3 staging jobs successfully (66.7% success rate)
	completedAt := time.Now().Add(-3 * time.Minute)
	for i := 0; i < 2; i++ {
		stagingJobs[i].Status = oapi.JobStatusSuccessful
		stagingJobs[i].CompletedAt = &completedAt
		stagingJobs[i].UpdatedAt = completedAt
		engine.PushEvent(ctx, handler.JobUpdate, stagingJobs[i])
	}

	// Mark the third job as failed
	failedAt := time.Now().Add(-3 * time.Minute)
	stagingJobs[2].Status = oapi.JobStatusFailure
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
	assert.Equal(t, 3, prodJobCount, "expected 3 production jobs after meeting success percentage")
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
			integration.WithPolicySelector("environment.name == 'production'"),
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
	assert.Len(t, jobs, 1, "expected 1 job initially")

	var stagingJob *oapi.Job
	for _, job := range jobs {
		stagingJob = job
		break
	}

	// Complete job 3 hours ago (exceeds max age)
	stagingJob.Status = oapi.JobStatusSuccessful
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
	assert.Zero(t, prodJobCount, "expected no production jobs (deployment too old)")
}

// TestEngine_EnvironmentProgression_MultipleVersions tests that jobs from different
// versions don't interfere with each other's environment progression logic
func TestEngine_EnvironmentProgression_MultipleVersions(t *testing.T) {
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
			integration.WithPolicySelector("environment.name == 'production'"),
			integration.WithPolicyRule(
				integration.WithRuleEnvironmentProgression(
					integration.EnvironmentProgressionDependsOnEnvironmentSelector("environment.name == 'staging'"),
					integration.EnvironmentProgressionMinimumSoakTimeMinutes(5),
				),
			),
		),
	)

	ctx := context.Background()

	// Deploy v1.0.0 and complete it successfully in staging with old completion time
	version1 := c.NewDeploymentVersion()
	version1.DeploymentId = deploymentID
	version1.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, version1)

	time.Sleep(100 * time.Millisecond)

	// Get v1.0.0 staging job
	jobs := engine.Workspace().Jobs().Items()
	var v1StagingJob *oapi.Job
	for _, job := range jobs {
		release, ok := engine.Workspace().Releases().Get(job.ReleaseId)
		if ok && release.ReleaseTarget.EnvironmentId == stagingEnvID && release.Version.Tag == "v1.0.0" {
			v1StagingJob = job
			break
		}
	}
	assert.NotNil(t, v1StagingJob, "v1.0.0 staging job should exist")

	// Complete v1.0.0 staging job 10 minutes ago (past the soak time)
	v1CompletedAt := time.Now().Add(-10 * time.Minute)
	v1StagingJob.Status = oapi.JobStatusSuccessful
	v1StagingJob.CompletedAt = &v1CompletedAt
	v1StagingJob.UpdatedAt = v1CompletedAt
	engine.PushEvent(ctx, handler.JobUpdate, v1StagingJob)

	time.Sleep(100 * time.Millisecond)

	// Deploy v2.0.0
	version2 := c.NewDeploymentVersion()
	version2.DeploymentId = deploymentID
	version2.Tag = "v2.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, version2)

	time.Sleep(100 * time.Millisecond)

	// Get v2.0.0 staging job
	jobs = engine.Workspace().Jobs().Items()
	var v2StagingJob *oapi.Job
	for _, job := range jobs {
		release, ok := engine.Workspace().Releases().Get(job.ReleaseId)
		if ok && release.ReleaseTarget.EnvironmentId == stagingEnvID && release.Version.Tag == "v2.0.0" {
			v2StagingJob = job
			break
		}
	}
	assert.NotNil(t, v2StagingJob, "v2.0.0 staging job should exist")

	// Complete v2.0.0 staging job just now (soak time NOT met)
	v2CompletedAt := time.Now()
	v2StagingJob.Status = oapi.JobStatusSuccessful
	v2StagingJob.CompletedAt = &v2CompletedAt
	v2StagingJob.UpdatedAt = v2CompletedAt
	engine.PushEvent(ctx, handler.JobUpdate, v2StagingJob)

	// Trigger policy re-evaluation
	time.Sleep(100 * time.Millisecond)

	// send a workspace tick to trigger reconciliation
	engine.PushEvent(ctx, handler.WorkspaceTick, nil)

	// v2.0.0 production job should NOT be created
	// (even though v1.0.0 has past soak time, v2.0.0's own soak time hasn't elapsed)
	jobs = engine.Workspace().Jobs().Items()
	v2ProdJobCount := 0
	for _, job := range jobs {
		release, exists := engine.Workspace().Releases().Get(job.ReleaseId)
		if exists && release.ReleaseTarget.EnvironmentId == prodEnvID && release.Version.Tag == "v2.0.0" {
			v2ProdJobCount++
		}
	}
	assert.Zero(t, v2ProdJobCount, "v2.0.0 production job should not exist (v2.0.0 soak time not met, should not use v1.0.0's completion time)")

	// Verify v1.0.0 production job was created (since its soak time was met)
	v1ProdJobCount := 0
	for _, job := range jobs {
		release, exists := engine.Workspace().Releases().Get(job.ReleaseId)
		if exists && release.ReleaseTarget.EnvironmentId == prodEnvID && release.Version.Tag == "v1.0.0" {
			v1ProdJobCount++
		}
	}
	assert.NotZero(t, v1ProdJobCount, "v1.0.0 production job should exist (its own soak time was met)")
}
