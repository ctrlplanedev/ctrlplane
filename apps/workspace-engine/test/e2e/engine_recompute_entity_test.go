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
	"github.com/stretchr/testify/require"
)

// TestEngine_RecomputeEntity_AfterVersionCreation tests that RecomputeEntity
// correctly rebuilds state for a release target.
func TestEngine_RecomputeEntity_AfterVersionCreation(t *testing.T) {
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
	)

	ctx := context.Background()

	// Create a version
	dv := c.NewDeploymentVersion()
	dv.DeploymentId = deploymentID
	dv.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv)

	rt := &oapi.ReleaseTarget{
		DeploymentId:  deploymentID,
		EnvironmentId: environmentID,
		ResourceId:    resourceID,
	}

	// Get initial state
	state, err := engine.Workspace().ReleaseManager().GetReleaseTargetState(ctx, rt)
	require.NoError(t, err)
	assert.NotNil(t, state)
	assert.NotNil(t, state.DesiredRelease)

	// Force recompute
	engine.Workspace().ReleaseManager().RecomputeEntity(ctx, rt)

	// State should still be valid after recompute
	stateAfter, err := engine.Workspace().ReleaseManager().GetReleaseTargetState(ctx, rt)
	require.NoError(t, err)
	assert.NotNil(t, stateAfter)
	assert.NotNil(t, stateAfter.DesiredRelease)
}

// TestEngine_RecomputeEntity_MultipleTargets tests RecomputeState processing
// multiple dirty entities at once.
func TestEngine_RecomputeEntity_MultipleTargets(t *testing.T) {
	jobAgentID := uuid.New().String()
	deploymentID := uuid.New().String()
	environmentID := uuid.New().String()
	r1ID := uuid.New().String()
	r2ID := uuid.New().String()

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
			integration.ResourceID(r1ID),
			integration.ResourceName("server-1"),
		),
		integration.WithResource(
			integration.ResourceID(r2ID),
			integration.ResourceName("server-2"),
		),
	)

	ctx := context.Background()

	// Create a version
	dv := c.NewDeploymentVersion()
	dv.DeploymentId = deploymentID
	dv.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv)

	rt1 := &oapi.ReleaseTarget{
		DeploymentId:  deploymentID,
		EnvironmentId: environmentID,
		ResourceId:    r1ID,
	}
	rt2 := &oapi.ReleaseTarget{
		DeploymentId:  deploymentID,
		EnvironmentId: environmentID,
		ResourceId:    r2ID,
	}

	// Mark both as dirty
	engine.Workspace().ReleaseManager().DirtyDesiredRelease(rt1)
	engine.Workspace().ReleaseManager().DirtyDesiredRelease(rt2)

	// Recompute
	count := engine.Workspace().ReleaseManager().RecomputeState(ctx)
	assert.GreaterOrEqual(t, count, 2)

	// Both should have valid state
	state1, err := engine.Workspace().ReleaseManager().GetReleaseTargetState(ctx, rt1)
	require.NoError(t, err)
	assert.NotNil(t, state1)

	state2, err := engine.Workspace().ReleaseManager().GetReleaseTargetState(ctx, rt2)
	require.NoError(t, err)
	assert.NotNil(t, state2)
}

// TestEngine_RecomputeEntity_DirtyCurrentAndJob tests that DirtyCurrentAndJob
// marks the entity for re-evaluation of current release and latest job.
func TestEngine_RecomputeEntity_DirtyCurrentAndJob(t *testing.T) {
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
	)

	ctx := context.Background()

	// Create a version
	dv := c.NewDeploymentVersion()
	dv.DeploymentId = deploymentID
	dv.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv)

	rt := &oapi.ReleaseTarget{
		DeploymentId:  deploymentID,
		EnvironmentId: environmentID,
		ResourceId:    resourceID,
	}

	// Dirty current and job
	engine.Workspace().ReleaseManager().DirtyCurrentAndJob(rt)

	// Recompute should process the dirty entity
	count := engine.Workspace().ReleaseManager().RecomputeState(ctx)
	assert.GreaterOrEqual(t, count, 1)

	// Verify state is accessible
	state, err := engine.Workspace().ReleaseManager().GetReleaseTargetState(ctx, rt)
	require.NoError(t, err)
	assert.NotNil(t, state)
}

// TestEngine_RecomputeEntity_Planner tests that the Planner is accessible and functional.
func TestEngine_RecomputeEntity_Planner(t *testing.T) {
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
	)

	// Verify Planner is accessible
	planner := engine.Workspace().ReleaseManager().Planner()
	assert.NotNil(t, planner)
}
