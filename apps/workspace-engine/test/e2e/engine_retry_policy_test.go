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

// TestEngine_RetryPolicy_DefaultBehavior tests that without a retry policy,
// ALL job statuses count as one attempt (truly strict behavior)
func TestEngine_RetryPolicy_DefaultBehavior(t *testing.T) {
	jobAgentID := uuid.New().String()
	deploymentID := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID),
		),
		integration.WithSystem(
			integration.SystemName("test-system"),
			integration.WithDeployment(
				integration.DeploymentID(deploymentID),
				integration.DeploymentName("deployment-1"),
				integration.DeploymentJobAgent(jobAgentID),
				integration.DeploymentJobAgentConfig(map[string]any{"test": "config"}),
				integration.DeploymentCelResourceSelector("true"),
			),
			integration.WithEnvironment(
				integration.EnvironmentName("env-1"),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceName("resource-1"),
		),
	)

	ctx := context.Background()

	// Get the resource
	resources := engine.Workspace().Resources().Items()
	var r1 *oapi.Resource
	for _, res := range resources {
		r1 = res
		break
	}

	// Create version
	dv1 := c.NewDeploymentVersion()
	dv1.DeploymentId = deploymentID
	dv1.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv1)

	// Verify first job created
	pendingJobs := engine.Workspace().Jobs().GetPending()
	if len(pendingJobs) != 1 {
		t.Fatalf("expected 1 job, got %d", len(pendingJobs))
	}
	firstJob := getFirstJob(pendingJobs)

	// Mark as cancelled
	firstJob.Status = oapi.JobStatusCancelled
	completedAt := time.Now()
	firstJob.CompletedAt = &completedAt
	engine.PushEvent(ctx, handler.JobUpdate, firstJob)

	// Trigger reconciliation - with NO policy, ALL statuses count (including cancelled)
	engine.PushEvent(ctx, handler.ResourceUpdate, r1)

	pendingJobs = engine.Workspace().Jobs().GetPending()
	if len(pendingJobs) != 0 {
		t.Fatalf("expected 0 jobs after cancellation (no policy = strict mode), got %d", len(pendingJobs))
	}

	// Also test with successful status
	dv2 := c.NewDeploymentVersion()
	dv2.DeploymentId = deploymentID
	dv2.Tag = "v2.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv2)

	pendingJobs = engine.Workspace().Jobs().GetPending()
	if len(pendingJobs) != 1 {
		t.Fatalf("expected 1 job for new version, got %d", len(pendingJobs))
	}
	secondJob := getFirstJob(pendingJobs)

	// Mark as successful
	secondJob.Status = oapi.JobStatusSuccessful
	secondJob.CompletedAt = &completedAt
	engine.PushEvent(ctx, handler.JobUpdate, secondJob)

	// Trigger reconciliation - should NOT create new job (success also counts in strict mode)
	engine.PushEvent(ctx, handler.ResourceUpdate, r1)

	pendingJobs = engine.Workspace().Jobs().GetPending()
	if len(pendingJobs) != 0 {
		t.Fatalf("expected 0 jobs after success (no policy = strict mode), got %d", len(pendingJobs))
	}
}

// TestEngine_RetryPolicy_SmartDefaults tests that when a retry policy IS configured,
// smart defaults apply (cancelled/skipped don't count)
func TestEngine_RetryPolicy_SmartDefaults(t *testing.T) {
	jobAgentID := uuid.New().String()
	deploymentID := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID),
		),
		integration.WithSystem(
			integration.SystemName("test-system"),
			integration.WithDeployment(
				integration.DeploymentID(deploymentID),
				integration.DeploymentName("deployment-1"),
				integration.DeploymentJobAgent(jobAgentID),
				integration.DeploymentJobAgentConfig(map[string]any{"test": "config"}),
				integration.DeploymentCelResourceSelector("true"),
			),
			integration.WithEnvironment(
				integration.EnvironmentName("env-1"),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceName("resource-1"),
		),
		integration.WithPolicy(
			integration.PolicyName("retry-policy"),
			integration.WithPolicySelector("true"),
			integration.WithPolicyRule(
				integration.WithRuleRetry(0, nil), // maxRetries=0 BUT with explicit policy
			),
		),
	)

	ctx := context.Background()

	// Get the resource
	resources := engine.Workspace().Resources().Items()
	var r1 *oapi.Resource
	for _, res := range resources {
		r1 = res
		break
	}

	// Create version
	dv1 := c.NewDeploymentVersion()
	dv1.DeploymentId = deploymentID
	dv1.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv1)

	pendingJobs := engine.Workspace().Jobs().GetPending()
	firstJob := getFirstJob(pendingJobs)

	// Mark as cancelled
	firstJob.Status = oapi.JobStatusCancelled
	completedAt := time.Now()
	firstJob.CompletedAt = &completedAt
	engine.PushEvent(ctx, handler.JobUpdate, firstJob)

	// With explicit policy and smart defaults, cancelled jobs DON'T count
	engine.PushEvent(ctx, handler.ResourceUpdate, r1)

	pendingJobs = engine.Workspace().Jobs().GetPending()
	if len(pendingJobs) != 1 {
		t.Fatalf("expected 1 job after cancellation (smart defaults allow retry), got %d", len(pendingJobs))
	}

	secondJob := getFirstJob(pendingJobs)
	if secondJob.Id == firstJob.Id {
		t.Fatalf("expected new job")
	}

	// But successful jobs still count with maxRetries=0
	secondJob.Status = oapi.JobStatusSuccessful
	secondJob.CompletedAt = &completedAt
	engine.PushEvent(ctx, handler.JobUpdate, secondJob)

	engine.PushEvent(ctx, handler.ResourceUpdate, r1)

	pendingJobs = engine.Workspace().Jobs().GetPending()
	if len(pendingJobs) != 0 {
		t.Fatalf("expected 0 jobs after success (maxRetries=0 blocks), got %d", len(pendingJobs))
	}
}

// TestEngine_RetryPolicy_WithMaxRetries tests retry policy with maxRetries > 0
func TestEngine_RetryPolicy_WithMaxRetries(t *testing.T) {
	jobAgentID := uuid.New().String()
	deploymentID := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID),
		),
		integration.WithSystem(
			integration.SystemName("test-system"),
			integration.WithDeployment(
				integration.DeploymentID(deploymentID),
				integration.DeploymentName("deployment-1"),
				integration.DeploymentJobAgent(jobAgentID),
				integration.DeploymentJobAgentConfig(map[string]any{"test": "config"}),
				integration.DeploymentCelResourceSelector("true"),
			),
			integration.WithEnvironment(
				integration.EnvironmentName("env-1"),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceName("resource-1"),
		),
		integration.WithPolicy(
			integration.PolicyName("retry-policy"),
			integration.WithPolicySelector("true"),
			integration.WithPolicyRule(
				integration.WithRuleRetry(2, nil), // maxRetries=2, smart defaults apply
			),
		),
	)

	ctx := context.Background()

	// Get the resource
	resources := engine.Workspace().Resources().Items()
	var r1 *oapi.Resource
	for _, res := range resources {
		r1 = res
		break
	}

	// Create version
	dv1 := c.NewDeploymentVersion()
	dv1.DeploymentId = deploymentID
	dv1.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv1)

	// Attempt 1: Initial job
	pendingJobs := engine.Workspace().Jobs().GetPending()
	if len(pendingJobs) != 1 {
		t.Fatalf("expected 1 job, got %d", len(pendingJobs))
	}
	job1 := getFirstJob(pendingJobs)

	// Fail job 1
	job1.Status = oapi.JobStatusFailure
	completedAt := time.Now()
	job1.CompletedAt = &completedAt
	engine.PushEvent(ctx, handler.JobUpdate, job1)

	// Attempt 2: First retry
	engine.PushEvent(ctx, handler.ResourceUpdate, r1)
	pendingJobs = engine.Workspace().Jobs().GetPending()
	if len(pendingJobs) != 1 {
		t.Fatalf("expected 1 job after first retry, got %d", len(pendingJobs))
	}
	job2 := getFirstJob(pendingJobs)
	if job2.Id == job1.Id {
		t.Fatalf("expected new job")
	}

	// Fail job 2
	job2.Status = oapi.JobStatusFailure
	job2.CompletedAt = &completedAt
	engine.PushEvent(ctx, handler.JobUpdate, job2)

	// Attempt 3: Second retry
	engine.PushEvent(ctx, handler.ResourceUpdate, r1)
	pendingJobs = engine.Workspace().Jobs().GetPending()
	if len(pendingJobs) != 1 {
		t.Fatalf("expected 1 job after second retry, got %d", len(pendingJobs))
	}
	job3 := getFirstJob(pendingJobs)
	if job3.Id == job2.Id {
		t.Fatalf("expected new job")
	}

	// Fail job 3
	job3.Status = oapi.JobStatusFailure
	job3.CompletedAt = &completedAt
	engine.PushEvent(ctx, handler.JobUpdate, job3)

	// Attempt 4: Should be blocked (exceeded maxRetries=2)
	engine.PushEvent(ctx, handler.ResourceUpdate, r1)
	pendingJobs = engine.Workspace().Jobs().GetPending()
	if len(pendingJobs) != 0 {
		t.Fatalf("expected 0 jobs after exceeding retry limit, got %d", len(pendingJobs))
	}
}

// TestEngine_RetryPolicy_SuccessDoesNotCountWithRetries tests that with maxRetries > 0,
// successful jobs don't count toward the retry limit
func TestEngine_RetryPolicy_SuccessDoesNotCountWithRetries(t *testing.T) {
	jobAgentID := uuid.New().String()
	deploymentID := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID),
		),
		integration.WithSystem(
			integration.SystemName("test-system"),
			integration.WithDeployment(
				integration.DeploymentID(deploymentID),
				integration.DeploymentName("deployment-1"),
				integration.DeploymentJobAgent(jobAgentID),
				integration.DeploymentJobAgentConfig(map[string]any{"test": "config"}),
				integration.DeploymentCelResourceSelector("true"),
			),
			integration.WithEnvironment(
				integration.EnvironmentName("env-1"),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceName("resource-1"),
		),
		integration.WithPolicy(
			integration.PolicyName("retry-policy"),
			integration.WithPolicySelector("true"),
			integration.WithPolicyRule(
				integration.WithRuleRetry(1, nil), // maxRetries=1
			),
		),
	)

	ctx := context.Background()

	// Create version 1
	dv1 := c.NewDeploymentVersion()
	dv1.DeploymentId = deploymentID
	dv1.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv1)

	pendingJobs := engine.Workspace().Jobs().GetPending()
	job1 := getFirstJob(pendingJobs)

	// Mark as successful
	job1.Status = oapi.JobStatusSuccessful
	completedAt := time.Now()
	job1.CompletedAt = &completedAt
	engine.PushEvent(ctx, handler.JobUpdate, job1)

	// Create version 2 - should be allowed (success doesn't count with maxRetries>0)
	dv2 := c.NewDeploymentVersion()
	dv2.DeploymentId = deploymentID
	dv2.Tag = "v2.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv2)

	pendingJobs = engine.Workspace().Jobs().GetPending()
	if len(pendingJobs) != 1 {
		t.Fatalf("expected 1 job for v2, got %d", len(pendingJobs))
	}

	job2 := getFirstJob(pendingJobs)
	release, _ := engine.Workspace().Releases().Get(job2.ReleaseId)
	if release.Version.Tag != "v2.0.0" {
		t.Fatalf("expected job for v2.0.0, got %s", release.Version.Tag)
	}
}

// TestEngine_RetryPolicy_InvalidJobAgentCounts tests that invalidJobAgent status
// counts toward retry limit (smart default)
func TestEngine_RetryPolicy_InvalidJobAgentCounts(t *testing.T) {
	jobAgentID := uuid.New().String()
	deploymentID := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID),
		),
		integration.WithSystem(
			integration.SystemName("test-system"),
			integration.WithDeployment(
				integration.DeploymentID(deploymentID),
				integration.DeploymentName("deployment-1"),
				integration.DeploymentJobAgent(jobAgentID),
				integration.DeploymentJobAgentConfig(map[string]any{"test": "config"}),
				integration.DeploymentCelResourceSelector("true"),
			),
			integration.WithEnvironment(
				integration.EnvironmentName("env-1"),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceName("resource-1"),
		),
	)

	ctx := context.Background()

	// Get the resource
	resources := engine.Workspace().Resources().Items()
	var r1 *oapi.Resource
	for _, res := range resources {
		r1 = res
		break
	}

	// Create version
	dv1 := c.NewDeploymentVersion()
	dv1.DeploymentId = deploymentID
	dv1.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv1)

	pendingJobs := engine.Workspace().Jobs().GetPending()
	job1 := getFirstJob(pendingJobs)

	// Mark as invalidJobAgent (misconfiguration)
	job1.Status = oapi.JobStatusInvalidJobAgent
	completedAt := time.Now()
	job1.CompletedAt = &completedAt
	engine.PushEvent(ctx, handler.JobUpdate, job1)

	// Trigger reconciliation - with default policy (maxRetries=0), should be blocked
	engine.PushEvent(ctx, handler.ResourceUpdate, r1)

	pendingJobs = engine.Workspace().Jobs().GetPending()
	if len(pendingJobs) != 0 {
		t.Fatalf("expected 0 jobs after invalidJobAgent, got %d", len(pendingJobs))
	}
}
