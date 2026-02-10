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
	"github.com/stretchr/testify/require"
)

// TestEngine_Tick_RecomputesExpiredCooldownBeforeReconcile verifies that the workspace
// tick handler re-plans (dirty + recompute) time-based evaluators before reconciling.
//
// Scenario:
//  1. Deploy v1 and complete it.
//  2. Create v2 immediately — blocked by a 2-second version cooldown.
//  3. Wait for the cooldown to expire.
//  4. Fire a workspace tick — the scheduler entry is now due.
//  5. Assert that v2 is deployed.
//
// Without the fix (DirtyDesiredRelease + RecomputeState in tick handler), the
// tick would read the stale "denied" result from the state index and skip the
// deployment, even though the cooldown has elapsed.
func TestEngine_Tick_RecomputesExpiredCooldownBeforeReconcile(t *testing.T) {
	cooldownSeconds := int32(2)

	jobAgentID := "job-agent-1"
	deploymentID := "deployment-1"

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
				integration.EnvironmentName("production"),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceName("resource-1"),
		),
		integration.WithPolicy(
			integration.PolicyName("version-cooldown-policy"),
			integration.WithPolicySelector("true"),
			integration.WithPolicyRule(
				integration.WithRuleVersionCooldown(cooldownSeconds),
			),
		),
	)

	ctx := context.Background()

	// ----- Step 1: Deploy v1 (first version — no reference, cooldown n/a) -----
	v1 := c.NewDeploymentVersion()
	v1.DeploymentId = deploymentID
	v1.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, v1)

	pendingJobs := engine.Workspace().Jobs().GetPending()
	require.Equal(t, 1, len(pendingJobs), "v1 should be deployed immediately (first version)")

	// Complete v1's job.
	firstJob := getFirstJob(pendingJobs)
	firstJob.Status = oapi.JobStatusSuccessful
	completedAt := time.Now()
	firstJob.CompletedAt = &completedAt
	engine.PushEvent(ctx, handler.JobUpdate, firstJob)

	// ----- Step 2: Create v2 immediately — should be blocked by cooldown -----
	v2 := c.NewDeploymentVersion()
	v2.DeploymentId = deploymentID
	v2.Tag = "v2.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, v2)

	pendingJobs = engine.Workspace().Jobs().GetPending()
	assert.Equal(t, 0, len(pendingJobs),
		"v2 should be blocked by cooldown (created within %d seconds of v1)", cooldownSeconds)

	// ----- Step 3: Wait for cooldown to expire -----
	// Add a generous buffer to avoid flakiness.
	time.Sleep(time.Duration(cooldownSeconds)*time.Second + 1*time.Second)

	// ----- Step 4: Fire a workspace tick -----
	// The scheduler should have an entry for this target at v1.CreatedAt + cooldownSeconds.
	// With the fix, the tick handler calls DirtyDesiredRelease + RecomputeState before
	// reconciling, so the evaluator re-runs and sees that the cooldown has passed.
	engine.PushEvent(ctx, handler.WorkspaceTick, nil)

	// ----- Step 5: Assert v2 is now deployed -----
	pendingJobs = engine.Workspace().Jobs().GetPending()
	assert.Equal(t, 1, len(pendingJobs),
		"v2 should be deployed after the cooldown expired and a tick re-evaluated the policy")

	// Verify it's actually v2 that got deployed.
	if len(pendingJobs) == 1 {
		job := getFirstJob(pendingJobs)
		release, ok := engine.Workspace().Releases().Get(job.ReleaseId)
		require.True(t, ok, "release should exist for pending job")
		assert.Equal(t, "v2.0.0", release.Version.Tag, "pending job should be for v2.0.0")
	}
}
