package harness

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// AssertReleaseCreated asserts that at least one release was persisted.
func (p *TestPipeline) AssertReleaseCreated(t *testing.T) {
	t.Helper()
	require.NotEmpty(t, p.ReleaseSetter.Releases, "expected at least one release to be created")
}

// AssertNoRelease asserts that no releases were persisted.
func (p *TestPipeline) AssertNoRelease(t *testing.T) {
	t.Helper()
	assert.Empty(t, p.ReleaseSetter.Releases, "expected no releases to be created")
}

// AssertReleaseCount asserts the exact number of releases persisted.
func (p *TestPipeline) AssertReleaseCount(t *testing.T, n int) {
	t.Helper()
	assert.Len(t, p.ReleaseSetter.Releases, n)
}

// AssertReleaseVersion asserts the version tag on the release at the given
// index.
func (p *TestPipeline) AssertReleaseVersion(t *testing.T, idx int, tag string) {
	t.Helper()
	require.Greater(t, len(p.ReleaseSetter.Releases), idx,
		"release index %d out of range (have %d)", idx, len(p.ReleaseSetter.Releases))
	assert.Equal(t, tag, p.ReleaseSetter.Releases[idx].Version.Tag)
}

// AssertComputedResourceCount asserts the number of resources matched by the
// selector-eval controller.
func (p *TestPipeline) AssertComputedResourceCount(t *testing.T, n int) {
	t.Helper()
	assert.Len(t, p.SelectorSetter.ComputedResources, n)
}

// AssertReleaseDeploymentID asserts the deployment ID on the release at the
// given index.
func (p *TestPipeline) AssertReleaseDeploymentID(t *testing.T, idx int, deploymentID string) {
	t.Helper()
	require.Greater(t, len(p.ReleaseSetter.Releases), idx,
		"release index %d out of range (have %d)", idx, len(p.ReleaseSetter.Releases))
	assert.Equal(t, deploymentID, p.ReleaseSetter.Releases[idx].ReleaseTarget.DeploymentId)
}

// AssertReleaseEnvironmentID asserts the environment ID on the release at
// the given index.
func (p *TestPipeline) AssertReleaseEnvironmentID(t *testing.T, idx int, environmentID string) {
	t.Helper()
	require.Greater(t, len(p.ReleaseSetter.Releases), idx,
		"release index %d out of range (have %d)", idx, len(p.ReleaseSetter.Releases))
	assert.Equal(t, environmentID, p.ReleaseSetter.Releases[idx].ReleaseTarget.EnvironmentId)
}
