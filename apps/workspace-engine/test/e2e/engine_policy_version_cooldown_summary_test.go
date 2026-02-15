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

// TestEngine_VersionCooldown_BlocksRapidDeploy tests that the version cooldown
// rule blocks rapid successive deployments.
func TestEngine_VersionCooldown_BlocksRapidDeploy(t *testing.T) {
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
				integration.WithRuleVersionCooldown(3600), // 1 hour cooldown
			),
		),
	)

	ctx := context.Background()

	// Deploy v1.0.0 — should work since it's the first
	dv1 := c.NewDeploymentVersion()
	dv1.DeploymentId = deploymentID
	dv1.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv1)

	allJobs := engine.Workspace().Jobs().Items()
	assert.Len(t, allJobs, 1, "first deployment should create a job")

	// Immediately deploy v2.0.0 — should be blocked by cooldown
	dv2 := c.NewDeploymentVersion()
	dv2.DeploymentId = deploymentID
	dv2.Tag = "v2.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv2)

	// Should still only have 1 job (v2 blocked by cooldown)
	allJobs = engine.Workspace().Jobs().Items()
	assert.Len(t, allJobs, 1, "second deployment should be blocked by cooldown")
}

// TestEngine_VersionCooldown_AllowsAfterCooldown tests that versions can be
// deployed after the cooldown period expires.
func TestEngine_VersionCooldown_AllowsAfterCooldown(t *testing.T) {
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
				integration.WithRuleVersionCooldown(1), // 1 second cooldown
			),
		),
	)

	ctx := context.Background()

	// Deploy v1.0.0
	dv1 := c.NewDeploymentVersion()
	dv1.DeploymentId = deploymentID
	dv1.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv1)

	allJobs := engine.Workspace().Jobs().Items()
	assert.Len(t, allJobs, 1)

	// Mark v1 job successful
	pendingJobs := engine.Workspace().Jobs().GetPending()
	require.Len(t, pendingJobs, 1)
	job1 := getFirstJob(pendingJobs)
	completedAt := time.Now()
	engine.PushEvent(ctx, handler.JobUpdate, oapi.JobUpdateEvent{
		Id:      &job1.Id,
		AgentId: &jobAgentID,
		Job: oapi.Job{
			Id:          job1.Id,
			Status:      oapi.JobStatusSuccessful,
			CompletedAt: &completedAt,
		},
		FieldsToUpdate: &[]oapi.JobUpdateEventFieldsToUpdate{
			oapi.JobUpdateEventFieldsToUpdateStatus,
			oapi.JobUpdateEventFieldsToUpdateCompletedAt,
		},
	})

	// Wait for cooldown to expire
	time.Sleep(2 * time.Second)

	// Deploy v2.0.0 — should be allowed after cooldown
	dv2 := c.NewDeploymentVersion()
	dv2.DeploymentId = deploymentID
	dv2.Tag = "v2.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv2)

	allJobs = engine.Workspace().Jobs().Items()
	assert.Greater(t, len(allJobs), 1, "deployment should be allowed after cooldown expires")
}

// TestEngine_VersionCooldown_NoRestrictionOnFirstDeploy tests that the very
// first deployment is not restricted by cooldown.
func TestEngine_VersionCooldown_NoRestrictionOnFirstDeploy(t *testing.T) {
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
				integration.WithRuleVersionCooldown(86400), // 24 hour cooldown
			),
		),
	)

	ctx := context.Background()

	// First deployment should never be blocked
	dv1 := c.NewDeploymentVersion()
	dv1.DeploymentId = deploymentID
	dv1.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv1)

	allJobs := engine.Workspace().Jobs().Items()
	assert.Len(t, allJobs, 1, "first deployment should not be blocked by cooldown")
}
