package e2e

import (
	"testing"
	"workspace-engine/test/integration"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestEngine_DeploymentVersionMetadataRoundtrip verifies that metadata set on a
// deployment version is preserved after being stored and read back.
func TestEngine_DeploymentVersionMetadataRoundtrip(t *testing.T) {
	dvId := uuid.New().String()

	metadata := map[string]string{
		"team":        "platform",
		"commit":      "abc123def456",
		"branch":      "main",
		"build-url":   "https://ci.example.com/builds/42",
		"description": "release with unicode: café résumé naïve",
	}

	engine := integration.NewTestWorkspace(t,
		integration.WithSystem(
			integration.WithDeployment(
				integration.WithDeploymentVersion(
					integration.DeploymentVersionID(dvId),
					integration.DeploymentVersionTag("v1.0.0"),
					integration.DeploymentVersionMetadata(metadata),
				),
			),
		),
	)

	dv, ok := engine.Workspace().DeploymentVersions().Get(dvId)
	require.True(t, ok, "deployment version not found")
	require.NotNil(t, dv)

	assert.Equal(t, metadata, dv.Metadata)
	assert.Equal(t, "platform", dv.Metadata["team"])
	assert.Equal(t, "abc123def456", dv.Metadata["commit"])
	assert.Equal(t, "main", dv.Metadata["branch"])
	assert.Equal(t, "https://ci.example.com/builds/42", dv.Metadata["build-url"])
	assert.Equal(t, "release with unicode: café résumé naïve", dv.Metadata["description"])
}

// TestEngine_DeploymentVersionConfigRoundtrip verifies that config set on a
// deployment version is preserved after being stored and read back.
func TestEngine_DeploymentVersionConfigRoundtrip(t *testing.T) {
	dvId := uuid.New().String()

	config := map[string]any{
		"image":    "myapp:v2.0.0",
		"replicas": float64(3),
		"nested": map[string]any{
			"key1": "value1",
			"key2": float64(42),
		},
		"tags": []any{"latest", "stable"},
	}

	engine := integration.NewTestWorkspace(t,
		integration.WithSystem(
			integration.WithDeployment(
				integration.WithDeploymentVersion(
					integration.DeploymentVersionID(dvId),
					integration.DeploymentVersionTag("v2.0.0"),
					integration.DeploymentVersionConfig(config),
				),
			),
		),
	)

	dv, ok := engine.Workspace().DeploymentVersions().Get(dvId)
	require.True(t, ok, "deployment version not found")
	require.NotNil(t, dv)

	assert.Equal(t, "myapp:v2.0.0", dv.Config["image"])
	assert.Equal(t, float64(3), dv.Config["replicas"])

	nested, ok := dv.Config["nested"].(map[string]any)
	require.True(t, ok, "nested config should be a map")
	assert.Equal(t, "value1", nested["key1"])
	assert.Equal(t, float64(42), nested["key2"])

	tags, ok := dv.Config["tags"].([]any)
	require.True(t, ok, "tags should be an array")
	assert.Equal(t, []any{"latest", "stable"}, tags)
}

// TestEngine_DeploymentVersionEmptyMetadataAndConfig verifies that deployment
// versions with empty metadata and config don't produce nil maps.
func TestEngine_DeploymentVersionEmptyMetadataAndConfig(t *testing.T) {
	dvId := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
		integration.WithSystem(
			integration.WithDeployment(
				integration.WithDeploymentVersion(
					integration.DeploymentVersionID(dvId),
					integration.DeploymentVersionTag("v3.0.0"),
				),
			),
		),
	)

	dv, ok := engine.Workspace().DeploymentVersions().Get(dvId)
	require.True(t, ok, "deployment version not found")
	require.NotNil(t, dv)

	// Should be empty maps, not nil
	assert.NotNil(t, dv.Metadata, "metadata should not be nil")
	assert.NotNil(t, dv.Config, "config should not be nil")
	assert.Empty(t, dv.Metadata)
	assert.Empty(t, dv.Config)
}

// TestEngine_DeploymentVersionJobAgentConfigRoundtrip verifies that
// job_agent_config set on a deployment version is preserved.
func TestEngine_DeploymentVersionJobAgentConfigRoundtrip(t *testing.T) {
	dvId := uuid.New().String()

	jobAgentConfig := map[string]any{
		"timeout":       float64(300),
		"retries":       float64(5),
		"deploy_script": "/scripts/deploy.sh",
	}

	engine := integration.NewTestWorkspace(t,
		integration.WithSystem(
			integration.WithDeployment(
				integration.WithDeploymentVersion(
					integration.DeploymentVersionID(dvId),
					integration.DeploymentVersionTag("v4.0.0"),
					integration.DeploymentVersionJobAgentConfig(jobAgentConfig),
				),
			),
		),
	)

	dv, ok := engine.Workspace().DeploymentVersions().Get(dvId)
	require.True(t, ok, "deployment version not found")
	require.NotNil(t, dv)

	assert.Equal(t, float64(300), dv.JobAgentConfig["timeout"])
	assert.Equal(t, float64(5), dv.JobAgentConfig["retries"])
	assert.Equal(t, "/scripts/deploy.sh", dv.JobAgentConfig["deploy_script"])
}
