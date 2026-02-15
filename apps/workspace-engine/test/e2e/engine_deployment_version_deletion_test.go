package e2e

import (
	"context"
	"testing"
	"workspace-engine/pkg/events/handler"
	"workspace-engine/test/integration"
	c "workspace-engine/test/integration/creators"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
)

func TestEngine_DeploymentVersionDeletion_RemovesVersion(t *testing.T) {
	deploymentID := uuid.New().String()
	versionID := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
		integration.WithSystem(
			integration.WithDeployment(
				integration.DeploymentID(deploymentID),
				integration.DeploymentCelResourceSelector("true"),
				integration.WithDeploymentVersion(
					integration.DeploymentVersionID(versionID),
					integration.DeploymentVersionTag("v1.0.0"),
				),
			),
			integration.WithEnvironment(
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(),
	)

	ctx := context.Background()

	// Verify version exists
	version, ok := engine.Workspace().DeploymentVersions().Get(versionID)
	assert.True(t, ok)
	assert.Equal(t, "v1.0.0", version.Tag)

	// Delete the version
	engine.PushEvent(ctx, handler.DeploymentVersionDelete, version)

	// Verify version is removed
	_, ok = engine.Workspace().DeploymentVersions().Get(versionID)
	assert.False(t, ok)
}

func TestEngine_DeploymentVersionDeletion_MultipleVersions(t *testing.T) {
	deploymentID := uuid.New().String()
	version1ID := uuid.New().String()
	version2ID := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
		integration.WithSystem(
			integration.WithDeployment(
				integration.DeploymentID(deploymentID),
				integration.DeploymentCelResourceSelector("true"),
				integration.WithDeploymentVersion(
					integration.DeploymentVersionID(version1ID),
					integration.DeploymentVersionTag("v1.0.0"),
				),
				integration.WithDeploymentVersion(
					integration.DeploymentVersionID(version2ID),
					integration.DeploymentVersionTag("v2.0.0"),
				),
			),
			integration.WithEnvironment(
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(),
	)

	ctx := context.Background()

	// Verify both exist
	_, ok1 := engine.Workspace().DeploymentVersions().Get(version1ID)
	_, ok2 := engine.Workspace().DeploymentVersions().Get(version2ID)
	assert.True(t, ok1)
	assert.True(t, ok2)

	// Delete v1
	v1, _ := engine.Workspace().DeploymentVersions().Get(version1ID)
	engine.PushEvent(ctx, handler.DeploymentVersionDelete, v1)

	// v1 removed, v2 still present
	_, ok1 = engine.Workspace().DeploymentVersions().Get(version1ID)
	_, ok2 = engine.Workspace().DeploymentVersions().Get(version2ID)
	assert.False(t, ok1)
	assert.True(t, ok2)
}

func TestEngine_DeploymentVersionDeletion_CreatedViaEvent(t *testing.T) {
	deploymentID := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
		integration.WithSystem(
			integration.WithDeployment(
				integration.DeploymentID(deploymentID),
				integration.DeploymentCelResourceSelector("true"),
			),
			integration.WithEnvironment(
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(),
	)

	ctx := context.Background()

	// Create a version via event
	dv := c.NewDeploymentVersion()
	dv.DeploymentId = deploymentID
	dv.Tag = "v3.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv)

	// Verify it exists
	version, ok := engine.Workspace().DeploymentVersions().Get(dv.Id)
	assert.True(t, ok)
	assert.Equal(t, "v3.0.0", version.Tag)

	// Delete it
	engine.PushEvent(ctx, handler.DeploymentVersionDelete, version)

	// Verify removed
	_, ok = engine.Workspace().DeploymentVersions().Get(dv.Id)
	assert.False(t, ok)
}
