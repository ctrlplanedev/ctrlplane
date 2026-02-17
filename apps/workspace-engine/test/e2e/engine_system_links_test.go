package e2e

import (
	"context"
	"testing"
	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/oapi"
	"workspace-engine/test/integration"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// --- System-Deployment link tests ---

func TestEngine_SystemDeploymentLinked(t *testing.T) {
	s1Id := uuid.New().String()
	s2Id := uuid.New().String()
	dId := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
		integration.WithSystem(
			integration.SystemID(s1Id),
			integration.SystemName("system-1"),
			integration.WithDeployment(integration.DeploymentID(dId)),
		),
		integration.WithSystem(
			integration.SystemID(s2Id),
			integration.SystemName("system-2"),
		),
	)

	ctx := context.Background()

	// Link deployment to s2 via event
	engine.PushEvent(ctx, handler.SystemDeploymentLinked, &oapi.SystemDeploymentLink{
		SystemId:     s2Id,
		DeploymentId: dId,
	})

	// Materialized views should reflect the change
	s2Deployments := engine.Workspace().Systems().Deployments(s2Id)
	assert.Contains(t, s2Deployments, dId)
}

func TestEngine_SystemDeploymentLinked_Idempotent(t *testing.T) {
	sId := uuid.New().String()
	dId := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
		integration.WithSystem(
			integration.SystemID(sId),
			integration.SystemName("system"),
			integration.WithDeployment(integration.DeploymentID(dId)),
		),
	)

	ctx := context.Background()

	// Link the same system again — should be a no-op
	engine.PushEvent(ctx, handler.SystemDeploymentLinked, &oapi.SystemDeploymentLink{
		SystemId:     sId,
		DeploymentId: dId,
	})

}

func TestEngine_SystemDeploymentUnlinked(t *testing.T) {
	s1Id := uuid.New().String()
	s2Id := uuid.New().String()
	dId := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
		integration.WithSystem(
			integration.SystemID(s1Id),
			integration.SystemName("system-1"),
			integration.WithDeployment(integration.DeploymentID(dId)),
		),
		integration.WithSystem(
			integration.SystemID(s2Id),
			integration.SystemName("system-2"),
		),
	)

	ctx := context.Background()

	// First link to s2 so it's in both
	engine.PushEvent(ctx, handler.SystemDeploymentLinked, &oapi.SystemDeploymentLink{
		SystemId:     s2Id,
		DeploymentId: dId,
	})

	// Unlink from s1
	engine.PushEvent(ctx, handler.SystemDeploymentUnlinked, &oapi.SystemDeploymentLink{
		SystemId:     s1Id,
		DeploymentId: dId,
	})

	// s1 materialized view should be empty
	s1Deployments := engine.Workspace().Systems().Deployments(s1Id)
	assert.Empty(t, s1Deployments)

	// s2 materialized view should still have the deployment
	s2Deployments := engine.Workspace().Systems().Deployments(s2Id)
	assert.Contains(t, s2Deployments, dId)
}

func TestEngine_SystemDeploymentUnlinked_Idempotent(t *testing.T) {
	sId := uuid.New().String()
	dId := uuid.New().String()
	otherSId := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
		integration.WithSystem(
			integration.SystemID(sId),
			integration.SystemName("system"),
			integration.WithDeployment(integration.DeploymentID(dId)),
		),
		integration.WithSystem(
			integration.SystemID(otherSId),
			integration.SystemName("other-system"),
		),
	)

	ctx := context.Background()

	// Unlink a system the deployment isn't linked to — should be a no-op
	engine.PushEvent(ctx, handler.SystemDeploymentUnlinked, &oapi.SystemDeploymentLink{
		SystemId:     otherSId,
		DeploymentId: dId,
	})

}

func TestEngine_SystemDeploymentLinked_CreatesReleaseTargets(t *testing.T) {
	s1Id := uuid.New().String()
	s2Id := uuid.New().String()
	dId := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
		integration.WithSystem(
			integration.SystemID(s1Id),
			integration.SystemName("system-1"),
			integration.WithDeployment(
				integration.DeploymentID(dId),
				integration.DeploymentCelResourceSelector("true"),
			),
		),
		integration.WithSystem(
			integration.SystemID(s2Id),
			integration.SystemName("system-2"),
			integration.WithEnvironment(
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceMetadata(map[string]string{"env": "prod"}),
		),
	)

	ctx := context.Background()

	// Before linking: deployment is in s1 which has no environments, so
	// there should be no release targets for this deployment.
	rtsBefore, err := engine.Workspace().ReleaseTargets().GetForDeployment(ctx, dId)
	require.NoError(t, err)
	assert.Empty(t, rtsBefore)

	// Link deployment to s2 which has an environment + matching resource
	engine.PushEvent(ctx, handler.SystemDeploymentLinked, &oapi.SystemDeploymentLink{
		SystemId:     s2Id,
		DeploymentId: dId,
	})

	// Now release targets should exist
	rtsAfter, err := engine.Workspace().ReleaseTargets().GetForDeployment(ctx, dId)
	require.NoError(t, err)
	assert.NotEmpty(t, rtsAfter)
}

func TestEngine_SystemDeploymentUnlinked_RemovesReleaseTargets(t *testing.T) {
	sId := uuid.New().String()
	dId := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
		integration.WithSystem(
			integration.SystemID(sId),
			integration.SystemName("system"),
			integration.WithDeployment(
				integration.DeploymentID(dId),
				integration.DeploymentCelResourceSelector("true"),
			),
			integration.WithEnvironment(
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceMetadata(map[string]string{"env": "prod"}),
		),
	)

	ctx := context.Background()

	// Verify release targets exist
	rtsBefore, err := engine.Workspace().ReleaseTargets().GetForDeployment(ctx, dId)
	require.NoError(t, err)
	require.NotEmpty(t, rtsBefore)

	// Unlink deployment from its only system
	engine.PushEvent(ctx, handler.SystemDeploymentUnlinked, &oapi.SystemDeploymentLink{
		SystemId:     sId,
		DeploymentId: dId,
	})

	// Release targets should be gone
	rtsAfter, err := engine.Workspace().ReleaseTargets().GetForDeployment(ctx, dId)
	require.NoError(t, err)
	assert.Empty(t, rtsAfter)
}

// --- System-Environment link tests ---

func TestEngine_SystemEnvironmentLinked(t *testing.T) {
	s1Id := uuid.New().String()
	s2Id := uuid.New().String()
	eId := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
		integration.WithSystem(
			integration.SystemID(s1Id),
			integration.SystemName("system-1"),
			integration.WithEnvironment(integration.EnvironmentID(eId)),
		),
		integration.WithSystem(
			integration.SystemID(s2Id),
			integration.SystemName("system-2"),
		),
	)

	ctx := context.Background()

	// Link environment to s2
	engine.PushEvent(ctx, handler.SystemEnvironmentLinked, &oapi.SystemEnvironmentLink{
		SystemId:      s2Id,
		EnvironmentId: eId,
	})

	// Materialized view should reflect the change
	s2Environments := engine.Workspace().Systems().Environments(s2Id)
	assert.Contains(t, s2Environments, eId)
}

func TestEngine_SystemEnvironmentLinked_Idempotent(t *testing.T) {
	sId := uuid.New().String()
	eId := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
		integration.WithSystem(
			integration.SystemID(sId),
			integration.SystemName("system"),
			integration.WithEnvironment(integration.EnvironmentID(eId)),
		),
	)

	ctx := context.Background()

	engine.PushEvent(ctx, handler.SystemEnvironmentLinked, &oapi.SystemEnvironmentLink{
		SystemId:      sId,
		EnvironmentId: eId,
	})

}

func TestEngine_SystemEnvironmentUnlinked(t *testing.T) {
	s1Id := uuid.New().String()
	s2Id := uuid.New().String()
	eId := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
		integration.WithSystem(
			integration.SystemID(s1Id),
			integration.SystemName("system-1"),
			integration.WithEnvironment(integration.EnvironmentID(eId)),
		),
		integration.WithSystem(
			integration.SystemID(s2Id),
			integration.SystemName("system-2"),
		),
	)

	ctx := context.Background()

	// Link to s2 first
	engine.PushEvent(ctx, handler.SystemEnvironmentLinked, &oapi.SystemEnvironmentLink{
		SystemId:      s2Id,
		EnvironmentId: eId,
	})

	// Unlink from s1
	engine.PushEvent(ctx, handler.SystemEnvironmentUnlinked, &oapi.SystemEnvironmentLink{
		SystemId:      s1Id,
		EnvironmentId: eId,
	})

	s1Environments := engine.Workspace().Systems().Environments(s1Id)
	assert.Empty(t, s1Environments)

	s2Environments := engine.Workspace().Systems().Environments(s2Id)
	assert.Contains(t, s2Environments, eId)
}

func TestEngine_SystemEnvironmentUnlinked_Idempotent(t *testing.T) {
	sId := uuid.New().String()
	eId := uuid.New().String()
	otherSId := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
		integration.WithSystem(
			integration.SystemID(sId),
			integration.SystemName("system"),
			integration.WithEnvironment(integration.EnvironmentID(eId)),
		),
		integration.WithSystem(
			integration.SystemID(otherSId),
			integration.SystemName("other-system"),
		),
	)

	ctx := context.Background()

	engine.PushEvent(ctx, handler.SystemEnvironmentUnlinked, &oapi.SystemEnvironmentLink{
		SystemId:      otherSId,
		EnvironmentId: eId,
	})

}

func TestEngine_SystemEnvironmentLinked_CreatesReleaseTargets(t *testing.T) {
	s1Id := uuid.New().String()
	s2Id := uuid.New().String()
	eId := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
		integration.WithSystem(
			integration.SystemID(s1Id),
			integration.SystemName("system-1"),
			integration.WithEnvironment(
				integration.EnvironmentID(eId),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithSystem(
			integration.SystemID(s2Id),
			integration.SystemName("system-2"),
			integration.WithDeployment(
				integration.DeploymentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceMetadata(map[string]string{"env": "prod"}),
		),
	)

	ctx := context.Background()

	// Before linking: environment is in s1 which has no deployments
	rtsBefore, err := engine.Workspace().ReleaseTargets().GetForEnvironment(ctx, eId)
	require.NoError(t, err)
	assert.Empty(t, rtsBefore)

	// Link environment to s2 which has a deployment + matching resource
	engine.PushEvent(ctx, handler.SystemEnvironmentLinked, &oapi.SystemEnvironmentLink{
		SystemId:      s2Id,
		EnvironmentId: eId,
	})

	rtsAfter, err := engine.Workspace().ReleaseTargets().GetForEnvironment(ctx, eId)
	require.NoError(t, err)
	assert.NotEmpty(t, rtsAfter)
}

func TestEngine_SystemEnvironmentUnlinked_RemovesReleaseTargets(t *testing.T) {
	sId := uuid.New().String()
	eId := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
		integration.WithSystem(
			integration.SystemID(sId),
			integration.SystemName("system"),
			integration.WithDeployment(
				integration.DeploymentCelResourceSelector("true"),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(eId),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceMetadata(map[string]string{"env": "prod"}),
		),
	)

	ctx := context.Background()

	rtsBefore, err := engine.Workspace().ReleaseTargets().GetForEnvironment(ctx, eId)
	require.NoError(t, err)
	require.NotEmpty(t, rtsBefore)

	// Unlink environment from its only system
	engine.PushEvent(ctx, handler.SystemEnvironmentUnlinked, &oapi.SystemEnvironmentLink{
		SystemId:      sId,
		EnvironmentId: eId,
	})

	rtsAfter, err := engine.Workspace().ReleaseTargets().GetForEnvironment(ctx, eId)
	require.NoError(t, err)
	assert.Empty(t, rtsAfter)
}
