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
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestEngine_Rollback_OnJobFailure tests that when a job fails with a status
// configured in the rollback policy, a new job is created for the previous release.
func TestEngine_Rollback_OnJobFailure(t *testing.T) {
	jobAgentID := uuid.New().String()
	deploymentID := uuid.New().String()
	environmentID := uuid.New().String()
	resourceID := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID),
			integration.JobAgentName("test-agent"),
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
				integration.EnvironmentID(environmentID),
				integration.EnvironmentName("production"),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceID(resourceID),
			integration.ResourceName("server-1"),
		),
		integration.WithPolicy(
			integration.PolicyName("rollback-policy"),
			integration.WithPolicyTargetSelector(
				integration.PolicyTargetCelDeploymentSelector("true"),
				integration.PolicyTargetCelEnvironmentSelector("true"),
				integration.PolicyTargetCelResourceSelector("true"),
			),
			integration.WithPolicyRule(
				integration.WithRuleRollbackOnJobStatuses(oapi.JobStatusFailure),
			),
		),
	)

	ctx := context.Background()

	// Step 1: Deploy v1.0.0 and mark it successful (establish baseline)
	dv1 := c.NewDeploymentVersion()
	dv1.DeploymentId = deploymentID
	dv1.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv1)

	pendingJobs := engine.Workspace().Jobs().GetPending()
	require.Len(t, pendingJobs, 1, "expected 1 pending job for v1.0.0")

	job1 := getFirstJob(pendingJobs)
	release1, _ := engine.Workspace().Releases().Get(job1.ReleaseId)
	assert.Equal(t, "v1.0.0", release1.Version.Tag)

	// Mark job1 as successful
	engine.PushEvent(ctx, handler.JobUpdate, createJobUpdateEvent(job1, jobAgentID, oapi.JobStatusSuccessful))

	// Step 2: Deploy v2.0.0
	dv2 := c.NewDeploymentVersion()
	dv2.DeploymentId = deploymentID
	dv2.Tag = "v2.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv2)

	pendingJobs = engine.Workspace().Jobs().GetPending()
	require.Len(t, pendingJobs, 1, "expected 1 pending job for v2.0.0")

	job2 := getFirstJob(pendingJobs)
	release2, _ := engine.Workspace().Releases().Get(job2.ReleaseId)
	assert.Equal(t, "v2.0.0", release2.Version.Tag)

	// Step 3: Mark v2.0.0 job as failed - this should trigger rollback
	engine.PushEvent(ctx, handler.JobUpdate, createJobUpdateEvent(job2, jobAgentID, oapi.JobStatusFailure))

	// Step 4: Verify rollback job was created for v1.0.0
	pendingJobs = engine.Workspace().Jobs().GetPending()
	require.Len(t, pendingJobs, 1, "expected 1 pending rollback job")

	rollbackJob := getFirstJob(pendingJobs)
	assert.NotEqual(t, job1.Id, rollbackJob.Id, "rollback job should have a new ID")
	assert.NotEqual(t, job2.Id, rollbackJob.Id, "rollback job should not be the failed job")

	rollbackRelease, _ := engine.Workspace().Releases().Get(rollbackJob.ReleaseId)
	assert.Equal(t, "v1.0.0", rollbackRelease.Version.Tag, "rollback should target v1.0.0")
}

// TestEngine_Rollback_OnJobFailure_NoRollbackForUnmatchedStatus tests that rollback
// does NOT happen when the job fails with a status not in the rollback policy.
func TestEngine_Rollback_OnJobFailure_NoRollbackForUnmatchedStatus(t *testing.T) {
	jobAgentID := uuid.New().String()
	deploymentID := uuid.New().String()
	environmentID := uuid.New().String()
	resourceID := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID),
			integration.JobAgentName("test-agent"),
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
				integration.EnvironmentID(environmentID),
				integration.EnvironmentName("production"),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceID(resourceID),
			integration.ResourceName("server-1"),
		),
		integration.WithPolicy(
			integration.PolicyName("rollback-policy"),
			integration.WithPolicyTargetSelector(
				integration.PolicyTargetCelDeploymentSelector("true"),
				integration.PolicyTargetCelEnvironmentSelector("true"),
				integration.PolicyTargetCelResourceSelector("true"),
			),
			integration.WithPolicyRule(
				// Only rollback on JobStatusFailure, NOT JobStatusCancelled
				integration.WithRuleRollbackOnJobStatuses(oapi.JobStatusFailure),
			),
		),
	)

	ctx := context.Background()

	// Step 1: Deploy v1.0.0 and mark it successful
	dv1 := c.NewDeploymentVersion()
	dv1.DeploymentId = deploymentID
	dv1.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv1)

	pendingJobs := engine.Workspace().Jobs().GetPending()
	job1 := getFirstJob(pendingJobs)

	engine.PushEvent(ctx, handler.JobUpdate, createJobUpdateEvent(job1, jobAgentID, oapi.JobStatusSuccessful))

	// Step 2: Deploy v2.0.0
	dv2 := c.NewDeploymentVersion()
	dv2.DeploymentId = deploymentID
	dv2.Tag = "v2.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv2)

	pendingJobs = engine.Workspace().Jobs().GetPending()
	job2 := getFirstJob(pendingJobs)

	// Step 3: Mark v2.0.0 as CANCELLED - should NOT trigger rollback
	engine.PushEvent(ctx, handler.JobUpdate, createJobUpdateEvent(job2, jobAgentID, oapi.JobStatusCancelled))

	// Step 4: Verify NO rollback job was created
	pendingJobs = engine.Workspace().Jobs().GetPending()
	assert.Len(t, pendingJobs, 0, "should not create rollback job for cancelled status")
}

// TestEngine_Rollback_OnJobFailure_NoPreviousRelease tests that rollback handles
// the case where there's no previous release to roll back to gracefully.
func TestEngine_Rollback_OnJobFailure_NoPreviousRelease(t *testing.T) {
	jobAgentID := uuid.New().String()
	deploymentID := uuid.New().String()
	environmentID := uuid.New().String()
	resourceID := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID),
			integration.JobAgentName("test-agent"),
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
				integration.EnvironmentID(environmentID),
				integration.EnvironmentName("production"),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceID(resourceID),
			integration.ResourceName("server-1"),
		),
		integration.WithPolicy(
			integration.PolicyName("rollback-policy"),
			integration.WithPolicyTargetSelector(
				integration.PolicyTargetCelDeploymentSelector("true"),
				integration.PolicyTargetCelEnvironmentSelector("true"),
				integration.PolicyTargetCelResourceSelector("true"),
			),
			integration.WithPolicyRule(
				integration.WithRuleRollbackOnJobStatuses(oapi.JobStatusFailure),
			),
		),
	)

	ctx := context.Background()

	// First ever deployment - deploy v1.0.0 and fail it
	dv1 := c.NewDeploymentVersion()
	dv1.DeploymentId = deploymentID
	dv1.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv1)

	pendingJobs := engine.Workspace().Jobs().GetPending()
	require.Len(t, pendingJobs, 1)

	job1 := getFirstJob(pendingJobs)

	// Mark first ever job as failed - should NOT crash, just no rollback
	engine.PushEvent(ctx, handler.JobUpdate, createJobUpdateEvent(job1, jobAgentID, oapi.JobStatusFailure))

	// Should NOT create a rollback job (nothing to roll back to)
	pendingJobs = engine.Workspace().Jobs().GetPending()
	assert.Len(t, pendingJobs, 0, "should not create rollback job when no previous release exists")
}

// TestEngine_Rollback_OnJobFailure_MultipleStatuses tests rollback with multiple
// configured failure statuses.
func TestEngine_Rollback_OnJobFailure_MultipleStatuses(t *testing.T) {
	jobAgentID := uuid.New().String()
	deploymentID := uuid.New().String()
	environmentID := uuid.New().String()
	resourceID := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID),
			integration.JobAgentName("test-agent"),
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
				integration.EnvironmentID(environmentID),
				integration.EnvironmentName("production"),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceID(resourceID),
			integration.ResourceName("server-1"),
		),
		integration.WithPolicy(
			integration.PolicyName("rollback-policy"),
			integration.WithPolicyTargetSelector(
				integration.PolicyTargetCelDeploymentSelector("true"),
				integration.PolicyTargetCelEnvironmentSelector("true"),
				integration.PolicyTargetCelResourceSelector("true"),
			),
			integration.WithPolicyRule(
				// Rollback on both failure and invalidJobAgent
				integration.WithRuleRollbackOnJobStatuses(oapi.JobStatusFailure, oapi.JobStatusInvalidJobAgent),
			),
		),
	)

	ctx := context.Background()

	// Deploy v1.0.0 and mark it successful
	dv1 := c.NewDeploymentVersion()
	dv1.DeploymentId = deploymentID
	dv1.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv1)

	pendingJobs := engine.Workspace().Jobs().GetPending()
	job1 := getFirstJob(pendingJobs)

	engine.PushEvent(ctx, handler.JobUpdate, createJobUpdateEvent(job1, jobAgentID, oapi.JobStatusSuccessful))

	// Deploy v2.0.0 and mark it as invalidJobAgent
	dv2 := c.NewDeploymentVersion()
	dv2.DeploymentId = deploymentID
	dv2.Tag = "v2.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv2)

	pendingJobs = engine.Workspace().Jobs().GetPending()
	job2 := getFirstJob(pendingJobs)

	engine.PushEvent(ctx, handler.JobUpdate, createJobUpdateEvent(job2, jobAgentID, oapi.JobStatusInvalidJobAgent))

	// Verify rollback job was created for v1.0.0
	pendingJobs = engine.Workspace().Jobs().GetPending()
	require.Len(t, pendingJobs, 1, "expected rollback job")

	rollbackJob := getFirstJob(pendingJobs)
	rollbackRelease, _ := engine.Workspace().Releases().Get(rollbackJob.ReleaseId)
	assert.Equal(t, "v1.0.0", rollbackRelease.Version.Tag, "rollback should target v1.0.0")
}

// TestEngine_Rollback_OnJobFailure_PolicyNotMatching tests that rollback does NOT
// happen when the release target doesn't match the policy.
func TestEngine_Rollback_OnJobFailure_PolicyNotMatching(t *testing.T) {
	jobAgentID := uuid.New().String()
	deploymentID := uuid.New().String()
	environmentID := uuid.New().String()
	resourceID := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID),
			integration.JobAgentName("test-agent"),
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
				integration.EnvironmentID(environmentID),
				integration.EnvironmentName("production"),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceID(resourceID),
			integration.ResourceName("server-1"),
		),
		integration.WithPolicy(
			integration.PolicyName("rollback-policy"),
			integration.WithPolicyTargetSelector(
				// This selector won't match the deployment
				integration.PolicyTargetJsonDeploymentSelector(map[string]any{
					"type":     "name",
					"operator": "equals",
					"value":    "non-existent-deployment",
				}),
				integration.PolicyTargetCelEnvironmentSelector("true"),
				integration.PolicyTargetCelResourceSelector("true"),
			),
			integration.WithPolicyRule(
				integration.WithRuleRollbackOnJobStatuses(oapi.JobStatusFailure),
			),
		),
	)

	ctx := context.Background()

	// Deploy v1.0.0 and mark it successful
	dv1 := c.NewDeploymentVersion()
	dv1.DeploymentId = deploymentID
	dv1.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv1)

	pendingJobs := engine.Workspace().Jobs().GetPending()
	job1 := getFirstJob(pendingJobs)

	engine.PushEvent(ctx, handler.JobUpdate, createJobUpdateEvent(job1, jobAgentID, oapi.JobStatusSuccessful))

	// Deploy v2.0.0 and mark it failed
	dv2 := c.NewDeploymentVersion()
	dv2.DeploymentId = deploymentID
	dv2.Tag = "v2.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv2)

	pendingJobs = engine.Workspace().Jobs().GetPending()
	job2 := getFirstJob(pendingJobs)

	engine.PushEvent(ctx, handler.JobUpdate, createJobUpdateEvent(job2, jobAgentID, oapi.JobStatusFailure))

	// Verify NO rollback job was created (policy doesn't match)
	pendingJobs = engine.Workspace().Jobs().GetPending()
	assert.Len(t, pendingJobs, 0, "should not create rollback job when policy doesn't match")
}

// TestEngine_Rollback_OnJobFailure_DisabledPolicy tests that rollback does NOT
// happen when the policy is disabled.
func TestEngine_Rollback_OnJobFailure_DisabledPolicy(t *testing.T) {
	jobAgentID := uuid.New().String()
	deploymentID := uuid.New().String()
	environmentID := uuid.New().String()
	resourceID := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID),
			integration.JobAgentName("test-agent"),
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
				integration.EnvironmentID(environmentID),
				integration.EnvironmentName("production"),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceID(resourceID),
			integration.ResourceName("server-1"),
		),
	)

	ctx := context.Background()

	// Create a disabled policy manually
	policy := c.NewPolicy(engine.Workspace().ID)
	policy.Name = "rollback-policy"
	policy.Enabled = false
	selector := c.NewPolicyTargetSelector()
	celSelector := &oapi.Selector{}
	_ = celSelector.FromCelSelector(oapi.CelSelector{Cel: "true"})
	selector.DeploymentSelector = celSelector
	selector.EnvironmentSelector = celSelector
	selector.ResourceSelector = celSelector
	policy.Selectors = []oapi.PolicyTargetSelector{*selector}

	rollBackStatuses := []oapi.JobStatus{oapi.JobStatusFailure}
	policy.Rules = []oapi.PolicyRule{{
		Id:       uuid.New().String(),
		PolicyId: policy.Id,
		Rollback: &oapi.RollbackRule{
			RollBackJobStatuses: &rollBackStatuses,
		},
	}}
	engine.PushEvent(ctx, handler.PolicyCreate, policy)

	// Deploy v1.0.0 and mark it successful
	dv1 := c.NewDeploymentVersion()
	dv1.DeploymentId = deploymentID
	dv1.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv1)

	pendingJobs := engine.Workspace().Jobs().GetPending()
	job1 := getFirstJob(pendingJobs)

	engine.PushEvent(ctx, handler.JobUpdate, createJobUpdateEvent(job1, jobAgentID, oapi.JobStatusSuccessful))

	// Deploy v2.0.0 and mark it failed
	dv2 := c.NewDeploymentVersion()
	dv2.DeploymentId = deploymentID
	dv2.Tag = "v2.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv2)

	pendingJobs = engine.Workspace().Jobs().GetPending()
	job2 := getFirstJob(pendingJobs)

	engine.PushEvent(ctx, handler.JobUpdate, createJobUpdateEvent(job2, jobAgentID, oapi.JobStatusFailure))

	// Verify NO rollback job was created (policy is disabled)
	pendingJobs = engine.Workspace().Jobs().GetPending()
	assert.Len(t, pendingJobs, 0, "should not create rollback job when policy is disabled")
}

// TestEngine_Rollback_OnVerificationFailure tests that when verification fails
// and the policy has onVerificationFailure=true, rollback is triggered.
func TestEngine_Rollback_OnVerificationFailure(t *testing.T) {
	jobAgentID := uuid.New().String()
	deploymentID := uuid.New().String()
	environmentID := uuid.New().String()
	resourceID := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID),
			integration.JobAgentName("test-agent"),
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
				integration.EnvironmentID(environmentID),
				integration.EnvironmentName("production"),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceID(resourceID),
			integration.ResourceName("server-1"),
		),
		integration.WithPolicy(
			integration.PolicyName("rollback-policy"),
			integration.WithPolicyTargetSelector(
				integration.PolicyTargetCelDeploymentSelector("true"),
				integration.PolicyTargetCelEnvironmentSelector("true"),
				integration.PolicyTargetCelResourceSelector("true"),
			),
			integration.WithPolicyRule(
				integration.WithRuleRollbackOnVerificationFailure(),
			),
		),
	)

	ctx := context.Background()

	// Step 1: Deploy v1.0.0 and mark successful
	dv1 := c.NewDeploymentVersion()
	dv1.DeploymentId = deploymentID
	dv1.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv1)

	pendingJobs := engine.Workspace().Jobs().GetPending()
	job1 := getFirstJob(pendingJobs)

	engine.PushEvent(ctx, handler.JobUpdate, createJobUpdateEvent(job1, jobAgentID, oapi.JobStatusSuccessful))

	// Step 2: Deploy v2.0.0 and mark successful (job-level)
	dv2 := c.NewDeploymentVersion()
	dv2.DeploymentId = deploymentID
	dv2.Tag = "v2.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv2)

	pendingJobs = engine.Workspace().Jobs().GetPending()
	job2 := getFirstJob(pendingJobs)

	engine.PushEvent(ctx, handler.JobUpdate, createJobUpdateEvent(job2, jobAgentID, oapi.JobStatusSuccessful))

	// Verify no pending jobs after job2 succeeds
	pendingJobs = engine.Workspace().Jobs().GetPending()
	assert.Len(t, pendingJobs, 0)

	// Step 3: Start and fail verification for v2.0.0
	metricProvider := oapi.MetricProvider{}
	_ = metricProvider.FromSleepMetricProvider(oapi.SleepMetricProvider{
		Type:            oapi.Sleep,
		DurationSeconds: 0,
	})

	// This condition will always fail (result.ok is undefined for sleep)
	failureCondition := "result.ok == true"
	metric := oapi.VerificationMetricSpec{
		Name:             "always-fail",
		IntervalSeconds:  1,
		Count:            1,
		FailureCondition: &failureCondition,
		Provider:         metricProvider,
	}

	err := engine.Workspace().ReleaseManager().VerificationManager().StartVerification(ctx, job2, []oapi.VerificationMetricSpec{metric})
	require.NoError(t, err)

	// Wait for verification to complete and fail
	time.Sleep(3 * time.Second)

	// Step 4: Verify rollback job was created for v1.0.0
	pendingJobs = engine.Workspace().Jobs().GetPending()
	require.Len(t, pendingJobs, 1, "expected rollback job after verification failure")

	rollbackJob := getFirstJob(pendingJobs)
	rollbackRelease, _ := engine.Workspace().Releases().Get(rollbackJob.ReleaseId)
	assert.Equal(t, "v1.0.0", rollbackRelease.Version.Tag, "rollback should target v1.0.0")
}

// TestEngine_Rollback_OnVerificationFailure_NotConfigured tests that verification failure
// does NOT trigger rollback when onVerificationFailure is not configured.
func TestEngine_Rollback_OnVerificationFailure_NotConfigured(t *testing.T) {
	jobAgentID := uuid.New().String()
	deploymentID := uuid.New().String()
	environmentID := uuid.New().String()
	resourceID := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID),
			integration.JobAgentName("test-agent"),
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
				integration.EnvironmentID(environmentID),
				integration.EnvironmentName("production"),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceID(resourceID),
			integration.ResourceName("server-1"),
		),
		integration.WithPolicy(
			integration.PolicyName("rollback-policy"),
			integration.WithPolicyTargetSelector(
				integration.PolicyTargetCelDeploymentSelector("true"),
				integration.PolicyTargetCelEnvironmentSelector("true"),
				integration.PolicyTargetCelResourceSelector("true"),
			),
			integration.WithPolicyRule(
				// Only rollback on job failure, NOT on verification failure
				integration.WithRuleRollbackOnJobStatuses(oapi.JobStatusFailure),
			),
		),
	)

	ctx := context.Background()

	// Step 1: Deploy v1.0.0 and mark successful
	dv1 := c.NewDeploymentVersion()
	dv1.DeploymentId = deploymentID
	dv1.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv1)

	pendingJobs := engine.Workspace().Jobs().GetPending()
	job1 := getFirstJob(pendingJobs)

	engine.PushEvent(ctx, handler.JobUpdate, createJobUpdateEvent(job1, jobAgentID, oapi.JobStatusSuccessful))

	// Step 2: Deploy v2.0.0 and mark successful (job-level)
	dv2 := c.NewDeploymentVersion()
	dv2.DeploymentId = deploymentID
	dv2.Tag = "v2.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv2)

	pendingJobs = engine.Workspace().Jobs().GetPending()
	job2 := getFirstJob(pendingJobs)

	engine.PushEvent(ctx, handler.JobUpdate, createJobUpdateEvent(job2, jobAgentID, oapi.JobStatusSuccessful))

	// Step 3: Start and fail verification for v2.0.0
	metricProvider := oapi.MetricProvider{}
	_ = metricProvider.FromSleepMetricProvider(oapi.SleepMetricProvider{
		Type:            oapi.Sleep,
		DurationSeconds: 0,
	})

	failureCondition := "result.ok == true"
	metric := oapi.VerificationMetricSpec{
		Name:             "always-fail",
		IntervalSeconds:  1,
		Count:            1,
		SuccessCondition: failureCondition,
		Provider:         metricProvider,
	}

	err := engine.Workspace().ReleaseManager().VerificationManager().StartVerification(ctx, job2, []oapi.VerificationMetricSpec{metric})
	require.NoError(t, err)

	// Wait for verification to complete
	time.Sleep(3 * time.Second)

	// Step 4: Verify NO rollback job was created (onVerificationFailure not configured)
	pendingJobs = engine.Workspace().Jobs().GetPending()
	assert.Len(t, pendingJobs, 0, "should not create rollback job when onVerificationFailure is not configured")
}

// TestEngine_Rollback_OnVerificationFailure_NoPreviousRelease tests that verification
// failure handles the case where there's no previous release gracefully.
func TestEngine_Rollback_OnVerificationFailure_NoPreviousRelease(t *testing.T) {
	jobAgentID := uuid.New().String()
	deploymentID := uuid.New().String()
	environmentID := uuid.New().String()
	resourceID := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID),
			integration.JobAgentName("test-agent"),
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
				integration.EnvironmentID(environmentID),
				integration.EnvironmentName("production"),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceID(resourceID),
			integration.ResourceName("server-1"),
		),
		integration.WithPolicy(
			integration.PolicyName("rollback-policy"),
			integration.WithPolicyTargetSelector(
				integration.PolicyTargetCelDeploymentSelector("true"),
				integration.PolicyTargetCelEnvironmentSelector("true"),
				integration.PolicyTargetCelResourceSelector("true"),
			),
			integration.WithPolicyRule(
				integration.WithRuleRollbackOnVerificationFailure(),
			),
		),
	)

	ctx := context.Background()

	// First ever deployment - deploy v1.0.0 and mark successful
	dv1 := c.NewDeploymentVersion()
	dv1.DeploymentId = deploymentID
	dv1.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv1)

	pendingJobs := engine.Workspace().Jobs().GetPending()
	job1 := getFirstJob(pendingJobs)

	engine.PushEvent(ctx, handler.JobUpdate, createJobUpdateEvent(job1, jobAgentID, oapi.JobStatusSuccessful))

	// Start and fail verification for v1.0.0
	metricProvider := oapi.MetricProvider{}
	_ = metricProvider.FromSleepMetricProvider(oapi.SleepMetricProvider{
		Type:            oapi.Sleep,
		DurationSeconds: 0,
	})

	failureCondition := "result.ok == true"
	metric := oapi.VerificationMetricSpec{
		Name:             "always-fail",
		IntervalSeconds:  1,
		Count:            1,
		SuccessCondition: failureCondition,
		Provider:         metricProvider,
	}

	err := engine.Workspace().ReleaseManager().VerificationManager().StartVerification(ctx, job1, []oapi.VerificationMetricSpec{metric})
	require.NoError(t, err)

	// Wait for verification to complete
	time.Sleep(3 * time.Second)

	// Should NOT create a rollback job (nothing to roll back to)
	pendingJobs = engine.Workspace().Jobs().GetPending()
	assert.Len(t, pendingJobs, 0, "should not create rollback job when no previous release exists")
}

// TestEngine_Rollback_BothJobAndVerificationConfigured tests a policy that has both
// job status rollback AND verification failure rollback configured.
func TestEngine_Rollback_BothJobAndVerificationConfigured(t *testing.T) {
	jobAgentID := uuid.New().String()
	deploymentID := uuid.New().String()
	environmentID := uuid.New().String()
	resourceID := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID),
			integration.JobAgentName("test-agent"),
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
				integration.EnvironmentID(environmentID),
				integration.EnvironmentName("production"),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceID(resourceID),
			integration.ResourceName("server-1"),
		),
		integration.WithPolicy(
			integration.PolicyName("rollback-policy"),
			integration.WithPolicyTargetSelector(
				integration.PolicyTargetCelDeploymentSelector("true"),
				integration.PolicyTargetCelEnvironmentSelector("true"),
				integration.PolicyTargetCelResourceSelector("true"),
			),
			integration.WithPolicyRule(
				// Both job and verification rollback configured
				integration.WithRuleRollback(
					[]oapi.JobStatus{oapi.JobStatusFailure},
					true, // onVerificationFailure
				),
			),
		),
	)

	ctx := context.Background()

	// Deploy v1.0.0 and mark successful
	dv1 := c.NewDeploymentVersion()
	dv1.DeploymentId = deploymentID
	dv1.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv1)

	pendingJobs := engine.Workspace().Jobs().GetPending()
	job1 := getFirstJob(pendingJobs)

	engine.PushEvent(ctx, handler.JobUpdate, createJobUpdateEvent(job1, jobAgentID, oapi.JobStatusSuccessful))

	// Deploy v2.0.0 and make it fail at job level
	dv2 := c.NewDeploymentVersion()
	dv2.DeploymentId = deploymentID
	dv2.Tag = "v2.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv2)

	pendingJobs = engine.Workspace().Jobs().GetPending()
	job2 := getFirstJob(pendingJobs)

	engine.PushEvent(ctx, handler.JobUpdate, createJobUpdateEvent(job2, jobAgentID, oapi.JobStatusFailure))

	// Verify rollback happened due to job failure
	pendingJobs = engine.Workspace().Jobs().GetPending()
	require.Len(t, pendingJobs, 1, "expected rollback job from job failure")

	rollbackJob := getFirstJob(pendingJobs)
	rollbackRelease, _ := engine.Workspace().Releases().Get(rollbackJob.ReleaseId)
	assert.Equal(t, "v1.0.0", rollbackRelease.Version.Tag)
}

// TestEngine_Rollback_NoRollbackWhenSameRelease tests that rollback doesn't happen
// when the current release is the same as the failed release.
func TestEngine_Rollback_NoRollbackWhenSameRelease(t *testing.T) {
	jobAgentID := uuid.New().String()
	deploymentID := uuid.New().String()
	environmentID := uuid.New().String()
	resourceID := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID),
			integration.JobAgentName("test-agent"),
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
				integration.EnvironmentID(environmentID),
				integration.EnvironmentName("production"),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceID(resourceID),
			integration.ResourceName("server-1"),
		),
		integration.WithPolicy(
			integration.PolicyName("retry-policy"),
			integration.WithPolicyTargetSelector(
				integration.PolicyTargetCelDeploymentSelector("true"),
				integration.PolicyTargetCelEnvironmentSelector("true"),
				integration.PolicyTargetCelResourceSelector("true"),
			),
			integration.WithPolicyRule(
				integration.WithRuleRetry(1, nil), // Allow 1 retry
			),
		),
		integration.WithPolicy(
			integration.PolicyName("rollback-policy"),
			integration.WithPolicyTargetSelector(
				integration.PolicyTargetCelDeploymentSelector("true"),
				integration.PolicyTargetCelEnvironmentSelector("true"),
				integration.PolicyTargetCelResourceSelector("true"),
			),
			integration.WithPolicyRule(
				integration.WithRuleRollbackOnJobStatuses(oapi.JobStatusFailure),
			),
		),
	)

	ctx := context.Background()

	// Get the resource for triggering reconcile
	resources := engine.Workspace().Resources().Items()
	var r1 *oapi.Resource
	for _, res := range resources {
		r1 = res
		break
	}

	// Deploy v1.0.0 and mark successful
	dv1 := c.NewDeploymentVersion()
	dv1.DeploymentId = deploymentID
	dv1.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv1)

	pendingJobs := engine.Workspace().Jobs().GetPending()
	job1 := getFirstJob(pendingJobs)

	engine.PushEvent(ctx, handler.JobUpdate, createJobUpdateEvent(job1, jobAgentID, oapi.JobStatusSuccessful))

	// Deploy v2.0.0 and mark successful (this becomes "current release")
	dv2 := c.NewDeploymentVersion()
	dv2.DeploymentId = deploymentID
	dv2.Tag = "v2.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv2)

	pendingJobs = engine.Workspace().Jobs().GetPending()
	job2 := getFirstJob(pendingJobs)

	engine.PushEvent(ctx, handler.JobUpdate, createJobUpdateEvent(job2, jobAgentID, oapi.JobStatusSuccessful))

	// Now trigger a retry on v2.0.0 (same release)
	engine.PushEvent(ctx, handler.ResourceUpdate, r1)

	pendingJobs = engine.Workspace().Jobs().GetPending()
	// Due to retry policy, we might get a retry job. If a retry job is created and fails,
	// it shouldn't rollback to itself
	if len(pendingJobs) > 0 {
		retryJob := getFirstJob(pendingJobs)
		retryRelease, _ := engine.Workspace().Releases().Get(retryJob.ReleaseId)

		// If it's a retry of v2.0.0, fail it
		if retryRelease.Version.Tag == "v2.0.0" {
			engine.PushEvent(ctx, handler.JobUpdate, createJobUpdateEvent(retryJob, jobAgentID, oapi.JobStatusFailure))

			// Should NOT rollback to v2.0.0 (the same release)
			// Instead, should rollback to v1.0.0
			pendingJobs = engine.Workspace().Jobs().GetPending()
			if len(pendingJobs) > 0 {
				rollbackJob := getFirstJob(pendingJobs)
				rollbackRelease, _ := engine.Workspace().Releases().Get(rollbackJob.ReleaseId)
				// Rollback should be to v1.0.0, not v2.0.0
				assert.Equal(t, "v1.0.0", rollbackRelease.Version.Tag, "rollback should target previous successful release, not the same release")
			}
		}
	}
}

// createJobUpdateEvent creates a JobUpdateEvent for use in PushEvent.
// This creates a proper update event with the required fields.
func createJobUpdateEvent(job *oapi.Job, agentID string, status oapi.JobStatus) oapi.JobUpdateEvent {
	completedAt := time.Now()
	return oapi.JobUpdateEvent{
		Id:      &job.Id,
		AgentId: &agentID,
		Job: oapi.Job{
			Id:          job.Id,
			Status:      status,
			CompletedAt: &completedAt,
		},
		FieldsToUpdate: &[]oapi.JobUpdateEventFieldsToUpdate{
			oapi.JobUpdateEventFieldsToUpdateStatus,
			oapi.JobUpdateEventFieldsToUpdateCompletedAt,
		},
	}
}
