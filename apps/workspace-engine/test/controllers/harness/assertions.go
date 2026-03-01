package harness

import (
	"testing"

	"workspace-engine/pkg/oapi"

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

// AssertReleaseVariableCount asserts the number of resolved variables on the
// release at the given index.
func (p *TestPipeline) AssertReleaseVariableCount(t *testing.T, idx, n int) {
	t.Helper()
	require.Greater(t, len(p.ReleaseSetter.Releases), idx,
		"release index %d out of range (have %d)", idx, len(p.ReleaseSetter.Releases))
	assert.Len(t, p.ReleaseSetter.Releases[idx].Variables, n,
		"expected %d variables on release %d", n, idx)
}

// AssertReleaseVariableEquals asserts a string variable value on the release
// at the given index.
func (p *TestPipeline) AssertReleaseVariableEquals(t *testing.T, idx int, key, expected string) {
	t.Helper()
	require.Greater(t, len(p.ReleaseSetter.Releases), idx,
		"release index %d out of range (have %d)", idx, len(p.ReleaseSetter.Releases))
	vars := p.ReleaseSetter.Releases[idx].Variables
	lv, ok := vars[key]
	require.True(t, ok, "variable %q not found on release %d", key, idx)
	s, err := lv.AsStringValue()
	require.NoError(t, err, "variable %q is not a string value", key)
	assert.Equal(t, expected, string(s))
}

// ReleaseVariables returns the resolved variables map from the release at the
// given index.
func (p *TestPipeline) ReleaseVariables(t *testing.T, idx int) map[string]oapi.LiteralValue {
	t.Helper()
	require.Greater(t, len(p.ReleaseSetter.Releases), idx,
		"release index %d out of range (have %d)", idx, len(p.ReleaseSetter.Releases))
	return p.ReleaseSetter.Releases[idx].Variables
}

// ---------------------------------------------------------------------------
// Job assertions
// ---------------------------------------------------------------------------

// AssertJobCreated asserts that at least one job was created.
func (p *TestPipeline) AssertJobCreated(t *testing.T) {
	t.Helper()
	require.NotEmpty(t, p.JobDispatchSetter.Jobs, "expected at least one job to be created")
}

// AssertNoJob asserts that no jobs were created.
func (p *TestPipeline) AssertNoJob(t *testing.T) {
	t.Helper()
	assert.Empty(t, p.JobDispatchSetter.Jobs, "expected no jobs to be created")
}

// AssertJobCount asserts the exact number of jobs created.
func (p *TestPipeline) AssertJobCount(t *testing.T, n int) {
	t.Helper()
	assert.Len(t, p.JobDispatchSetter.Jobs, n)
}

// AssertJobAgentID asserts the job agent ID on the job at the given index.
func (p *TestPipeline) AssertJobAgentID(t *testing.T, idx int, agentID string) {
	t.Helper()
	require.Greater(t, len(p.JobDispatchSetter.Jobs), idx,
		"job index %d out of range (have %d)", idx, len(p.JobDispatchSetter.Jobs))
	assert.Equal(t, agentID, p.JobDispatchSetter.Jobs[idx].JobAgentId)
}

// AssertJobStatus asserts the status on the job at the given index.
func (p *TestPipeline) AssertJobStatus(t *testing.T, idx int, status oapi.JobStatus) {
	t.Helper()
	require.Greater(t, len(p.JobDispatchSetter.Jobs), idx,
		"job index %d out of range (have %d)", idx, len(p.JobDispatchSetter.Jobs))
	assert.Equal(t, status, p.JobDispatchSetter.Jobs[idx].Status)
}

// AssertJobReleaseID asserts that the job at the given index references
// the expected release ID.
func (p *TestPipeline) AssertJobReleaseID(t *testing.T, idx int, releaseID string) {
	t.Helper()
	require.Greater(t, len(p.JobDispatchSetter.Jobs), idx,
		"job index %d out of range (have %d)", idx, len(p.JobDispatchSetter.Jobs))
	assert.Equal(t, releaseID, p.JobDispatchSetter.Jobs[idx].ReleaseId)
}
