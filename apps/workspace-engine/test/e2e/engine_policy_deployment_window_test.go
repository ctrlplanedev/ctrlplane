package e2e

import (
	"context"
	"testing"
	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/oapi"
	"workspace-engine/test/integration"
	c "workspace-engine/test/integration/creators"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
)

// TestEngine_DeploymentWindow_AllowWindowBlocks tests that when deployments are
// only allowed during a window, deploying a second version outside the window blocks the job.
// Note: first deployments are always allowed (no previous release = window ignored).
func TestEngine_DeploymentWindow_AllowWindowBlocks(t *testing.T) {
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
				integration.DeploymentJobAgent(jobAgentID),
				integration.DeploymentCelResourceSelector("true"),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentID),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceID(resourceID),
		),
		integration.WithPolicy(
			integration.WithPolicySelector("true"),
			integration.WithPolicyRule(
				// Allow window: only allow deploys in a 1-minute window at midnight on Jan 1
				integration.WithRuleDeploymentWindow(
					"FREQ=YEARLY;BYMONTH=1;BYMONTHDAY=1;BYHOUR=0;BYMINUTE=0;BYSECOND=0",
					1,
				),
			),
		),
	)

	ctx := context.Background()

	// First deploy is always allowed (no previous release)
	dv1 := c.NewDeploymentVersion()
	dv1.DeploymentId = deploymentID
	dv1.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv1)

	allJobs := engine.Workspace().Jobs().Items()
	assert.Len(t, allJobs, 1, "first deployment should be allowed regardless of window")

	// Mark v1 job successful to establish current release
	pendingJobs := engine.Workspace().Jobs().GetPending()
	job1 := getFirstJob(pendingJobs)
	engine.PushEvent(ctx, handler.JobUpdate, createJobUpdateEvent(job1, jobAgentID, oapi.JobStatusSuccessful))

	// Second deploy should be blocked (outside window)
	dv2 := c.NewDeploymentVersion()
	dv2.DeploymentId = deploymentID
	dv2.Tag = "v2.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv2)

	// Should still only have 1 job (v2 blocked by window)
	allJobs = engine.Workspace().Jobs().Items()
	assert.Len(t, allJobs, 1, "second deployment should be blocked outside allow window")
}

// TestEngine_DeploymentWindow_DenyWindowAllows tests that when a deny window
// is configured, deployments are allowed outside the deny window.
func TestEngine_DeploymentWindow_DenyWindowAllows(t *testing.T) {
	jobAgentID := uuid.New().String()
	deploymentID := uuid.New().String()
	environmentID := uuid.New().String()
	resourceID := uuid.New().String()

	allowWindow := false

	engine := integration.NewTestWorkspace(t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID),
		),
		integration.WithSystem(
			integration.WithDeployment(
				integration.DeploymentID(deploymentID),
				integration.DeploymentJobAgent(jobAgentID),
				integration.DeploymentCelResourceSelector("true"),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentID),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceID(resourceID),
		),
		integration.WithPolicy(
			integration.WithPolicySelector("true"),
			integration.WithPolicyRule(
				// Deny window: block deploys only on Jan 1 midnight for 1 minute
				// Since we're almost certainly NOT in that window, deploys should be allowed.
				integration.WithRuleDeploymentWindowFull(
					"FREQ=YEARLY;BYMONTH=1;BYMONTHDAY=1;BYHOUR=0;BYMINUTE=0;BYSECOND=0",
					1,
					nil,
					&allowWindow,
				),
			),
		),
	)

	ctx := context.Background()

	dv := c.NewDeploymentVersion()
	dv.DeploymentId = deploymentID
	dv.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv)

	// Should create a job because we're outside the deny window
	allJobs := engine.Workspace().Jobs().Items()
	assert.Len(t, allJobs, 1, "deployment should be allowed outside deny window")
}

// TestEngine_DeploymentWindow_AllowWindowCurrentlyOpen tests that deploys are
// allowed when the current time falls within the allow window.
func TestEngine_DeploymentWindow_AllowWindowCurrentlyOpen(t *testing.T) {
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
				integration.DeploymentJobAgent(jobAgentID),
				integration.DeploymentCelResourceSelector("true"),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentID),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceID(resourceID),
		),
		integration.WithPolicy(
			integration.WithPolicySelector("true"),
			integration.WithPolicyRule(
				// Allow window: every minute, 24 hours (basically always open)
				integration.WithRuleDeploymentWindow(
					"FREQ=MINUTELY;INTERVAL=1",
					1440, // 24 hours
				),
			),
		),
	)

	ctx := context.Background()

	dv := c.NewDeploymentVersion()
	dv.DeploymentId = deploymentID
	dv.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv)

	// Should create a job because we're inside the allow window
	allJobs := engine.Workspace().Jobs().Items()
	assert.Len(t, allJobs, 1, "deployment should be allowed during open window")
}
