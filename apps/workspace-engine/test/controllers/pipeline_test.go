package controllers_test

import (
	"testing"

	"workspace-engine/pkg/oapi"
	. "workspace-engine/test/controllers/harness"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ---------------------------------------------------------------------------
// Happy path
// ---------------------------------------------------------------------------

func TestPipeline_NoPolicy_CreatesRelease(t *testing.T) {
	p := NewTestPipeline(t,
		WithDeployment(
			DeploymentSelector("true"),
			DeploymentName("api"),
		),
		WithEnvironment(
			EnvironmentName("production"),
		),
		WithResource(
			ResourceName("server-1"),
			ResourceKind("Node"),
		),
		WithVersion(
			VersionTag("v1.0.0"),
		),
	)

	p.RunPipeline()

	p.AssertComputedResourceCount(t, 1)
	p.AssertReleaseCreated(t)
	p.AssertReleaseVersion(t, 0, "v1.0.0")
	p.AssertReleaseDeploymentID(t, 0, p.DeploymentID().String())
	p.AssertReleaseEnvironmentID(t, 0, p.EnvironmentID().String())
}

// ---------------------------------------------------------------------------
// Selector filtering
// ---------------------------------------------------------------------------

func TestPipeline_SelectorFiltersResources(t *testing.T) {
	p := NewTestPipeline(t,
		WithDeployment(
			DeploymentSelector(`resource.kind == "Node"`),
		),
		WithEnvironment(EnvironmentName("staging")),
		WithResource(ResourceName("node-1"), ResourceKind("Node")),
		WithResource(ResourceName("pod-1"), ResourceKind("Pod")),
		WithResource(ResourceName("node-2"), ResourceKind("Node")),
		WithVersion(VersionTag("v2.0.0")),
	)

	p.EnqueueSelectorEval()
	p.ProcessSelectorEvals()

	assert.Len(t, p.ComputedResources(), 2, "should match 2 Nodes, filtering out the Pod")

	p.ProcessDesiredReleases()

	p.AssertReleaseCreated(t)
	p.AssertReleaseVersion(t, 0, "v2.0.0")
}

func TestPipeline_SelectorMatchesNone(t *testing.T) {
	p := NewTestPipeline(t,
		WithDeployment(
			DeploymentSelector(`resource.kind == "GPU"`),
		),
		WithEnvironment(EnvironmentName("dev")),
		WithResource(ResourceName("node-1"), ResourceKind("Node")),
		WithVersion(VersionTag("v1.0.0")),
	)

	p.RunPipeline()

	p.AssertComputedResourceCount(t, 0)
	p.AssertReleaseCreated(t)
}

func TestPipeline_SelectorByLabel(t *testing.T) {
	p := NewTestPipeline(t,
		WithDeployment(
			DeploymentSelector(`resource.metadata.labels.pool == "gpu"`),
		),
		WithEnvironment(EnvironmentName("compute")),
		WithResource(
			ResourceName("gpu-node"),
			ResourceKind("Node"),
			ResourceLabels(map[string]any{"pool": "gpu"}),
		),
		WithResource(
			ResourceName("cpu-node"),
			ResourceKind("Node"),
			ResourceLabels(map[string]any{"pool": "cpu"}),
		),
		WithVersion(VersionTag("v3.0.0")),
	)

	p.EnqueueSelectorEval()
	p.ProcessSelectorEvals()

	assert.Len(t, p.ComputedResources(), 1)

	p.ProcessDesiredReleases()
	p.AssertReleaseCreated(t)
}

// ---------------------------------------------------------------------------
// No versions
// ---------------------------------------------------------------------------

func TestPipeline_NoVersions_NoRelease(t *testing.T) {
	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true")),
		WithEnvironment(EnvironmentName("prod")),
		WithResource(ResourceName("srv"), ResourceKind("Server")),
	)

	p.RunPipeline()

	p.AssertNoRelease(t)
}

// ---------------------------------------------------------------------------
// Multiple versions
// ---------------------------------------------------------------------------

func TestPipeline_PicksFirstEligibleVersion(t *testing.T) {
	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true")),
		WithEnvironment(EnvironmentName("production")),
		WithResource(ResourceName("srv"), ResourceKind("Server")),
		WithVersion(VersionTag("v3.0.0")),
		WithVersion(VersionTag("v2.0.0")),
		WithVersion(VersionTag("v1.0.0")),
	)

	p.RunPipeline()

	p.AssertReleaseCreated(t)
	p.AssertReleaseVersion(t, 0, "v3.0.0")
}

// ---------------------------------------------------------------------------
// Step-by-step processing
// ---------------------------------------------------------------------------

func TestPipeline_StepByStep(t *testing.T) {
	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true")),
		WithEnvironment(EnvironmentName("prod")),
		WithResource(ResourceName("srv"), ResourceKind("Server")),
		WithVersion(VersionTag("v1.0.0")),
	)

	p.EnqueueSelectorEval()

	n := p.ProcessSelectorEvals()
	require.Equal(t, 1, n, "should process exactly one selector eval item")

	p.AssertComputedResourceCount(t, 1)
	p.AssertNoRelease(t)

	n = p.ProcessDesiredReleases()
	require.Equal(t, 1, n, "should process exactly one desired release item")

	p.AssertReleaseCreated(t)
}

// ---------------------------------------------------------------------------
// Version status
// ---------------------------------------------------------------------------

func TestPipeline_VersionWithReadyStatus(t *testing.T) {
	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true")),
		WithEnvironment(EnvironmentName("prod")),
		WithResource(ResourceName("srv"), ResourceKind("Server")),
		WithVersion(
			VersionTag("v1.0.0"),
			VersionStatus(oapi.DeploymentVersionStatusReady),
		),
	)

	p.RunPipeline()

	p.AssertReleaseCreated(t)
	p.AssertReleaseVersion(t, 0, "v1.0.0")
}

// ---------------------------------------------------------------------------
// Deployment cross-reference in selector
// ---------------------------------------------------------------------------

func TestPipeline_DeploymentCrossReferenceSelector(t *testing.T) {
	p := NewTestPipeline(t,
		WithDeployment(
			DeploymentSelector(`deployment.name == resource.name`),
			DeploymentName("web-server"),
		),
		WithEnvironment(EnvironmentName("prod")),
		WithResource(ResourceName("web-server"), ResourceKind("Pod")),
		WithResource(ResourceName("api-server"), ResourceKind("Pod")),
		WithVersion(VersionTag("v1.0.0")),
	)

	p.EnqueueSelectorEval()
	p.ProcessSelectorEvals()

	assert.Len(t, p.ComputedResources(), 1, "only web-server should match")

	p.ProcessDesiredReleases()
	p.AssertReleaseCreated(t)
}

// ===========================================================================
// Run() tests -- round-robin, order-independent processing
// ===========================================================================

func TestRun_HappyPath(t *testing.T) {
	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true"), DeploymentName("api")),
		WithEnvironment(EnvironmentName("production")),
		WithResource(ResourceName("server-1"), ResourceKind("Node")),
		WithVersion(VersionTag("v1.0.0")),
	)

	p.Run()

	p.AssertComputedResourceCount(t, 1)
	p.AssertReleaseCreated(t)
	p.AssertReleaseVersion(t, 0, "v1.0.0")
	p.AssertReleaseDeploymentID(t, 0, p.DeploymentID().String())
	p.AssertReleaseEnvironmentID(t, 0, p.EnvironmentID().String())
}

func TestRun_SelectorFilters(t *testing.T) {
	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector(`resource.kind == "Node"`)),
		WithEnvironment(EnvironmentName("staging")),
		WithResource(ResourceName("node-1"), ResourceKind("Node")),
		WithResource(ResourceName("pod-1"), ResourceKind("Pod")),
		WithResource(ResourceName("node-2"), ResourceKind("Node")),
		WithVersion(VersionTag("v2.0.0")),
	)

	p.Run()

	assert.Len(t, p.ComputedResources(), 2, "should match 2 Nodes")
	p.AssertReleaseCreated(t)
	p.AssertReleaseVersion(t, 0, "v2.0.0")
}

func TestRun_PolicyBlocks(t *testing.T) {
	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true")),
		WithEnvironment(EnvironmentName("production")),
		WithResource(ResourceName("srv"), ResourceKind("Server")),
		WithVersion(VersionTag("v2.0.0")),
		WithPolicy(
			PolicySelector("true"),
			PolicyEnabled(true),
			WithPolicyRule(WithApprovalRule(1)),
		),
	)

	p.Run()

	p.AssertNoRelease(t)
}

func TestRun_NoVersions(t *testing.T) {
	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true")),
		WithEnvironment(EnvironmentName("prod")),
		WithResource(ResourceName("srv"), ResourceKind("Server")),
	)

	p.Run()

	p.AssertNoRelease(t)
}

func TestRun_PicksFirstEligibleVersion(t *testing.T) {
	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true")),
		WithEnvironment(EnvironmentName("production")),
		WithResource(ResourceName("srv"), ResourceKind("Server")),
		WithVersion(VersionTag("v3.0.0")),
		WithVersion(VersionTag("v2.0.0")),
		WithVersion(VersionTag("v1.0.0")),
	)

	p.Run()

	p.AssertReleaseCreated(t)
	p.AssertReleaseVersion(t, 0, "v3.0.0")
}

func TestRun_MultiCall_MutateAndRerun(t *testing.T) {
	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true")),
		WithEnvironment(EnvironmentName("production")),
		WithResource(ResourceName("srv"), ResourceKind("Server")),
		WithVersion(VersionTag("v1.0.0")),
	)

	p.Run()
	p.AssertReleaseCreated(t)
	p.AssertReleaseVersion(t, 0, "v1.0.0")

	// Mutate: add a new version and re-enqueue selector eval to trigger
	// a new desired-release evaluation.
	p.ReleaseGetter.Versions = append(p.ReleaseGetter.Versions, &oapi.DeploymentVersion{
		Id:             "new-version-id",
		Tag:            "v2.0.0",
		Name:           "version-2",
		DeploymentId:   p.DeploymentID().String(),
		Status:         oapi.DeploymentVersionStatusReady,
		Config:         map[string]any{},
		JobAgentConfig: map[string]any{},
		Metadata:       map[string]string{},
	})

	// Re-run: Run() won't re-seed (already seeded), but we can manually
	// enqueue a new selector-eval to simulate a new event.
	p.EnqueueSelectorEval()
	p.Run()

	p.AssertReleaseCount(t, 2)
}

func TestRun_RunRound_IntermediateState(t *testing.T) {
	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true")),
		WithEnvironment(EnvironmentName("prod")),
		WithResource(ResourceName("srv"), ResourceKind("Server")),
		WithVersion(VersionTag("v1.0.0")),
	)

	// Use the lower-level step-by-step API for true intermediate checks.
	p.EnqueueSelectorEval()

	// Drain only selector-eval queue to inspect intermediate state.
	p.ProcessSelectorEvals()
	p.AssertComputedResourceCount(t, 1)
	p.AssertNoRelease(t)

	// Now use RunRound to process remaining desired-release items.
	n := p.RunRound()
	require.Greater(t, n, 0, "round should process desired releases")
	p.AssertReleaseCreated(t)
	p.AssertReleaseVersion(t, 0, "v1.0.0")

	// Next round should find nothing left.
	n = p.RunRound()
	assert.Equal(t, 0, n, "next round should be idle")
}

func TestRun_PendingRequeues_Empty(t *testing.T) {
	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true")),
		WithEnvironment(EnvironmentName("prod")),
		WithResource(ResourceName("srv"), ResourceKind("Server")),
		WithVersion(VersionTag("v1.0.0")),
	)

	p.Run()

	assert.Empty(t, p.PendingRequeues(), "no requeues expected for a simple happy path")
}

// ===========================================================================
// Release → Job dispatch tests
// ===========================================================================

func TestPipeline_ReleaseCreatesJob(t *testing.T) {
	agentID := uuid.New().String()

	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true"), DeploymentName("api")),
		WithEnvironment(EnvironmentName("production")),
		WithResource(ResourceName("server-1"), ResourceKind("Node")),
		WithVersion(VersionTag("v1.0.0")),
		WithJobAgent("test-runner", JobAgentID(agentID)),
	)

	p.RunPipeline()

	p.AssertReleaseCreated(t)
	p.AssertJobCreated(t)
	p.AssertJobCount(t, 1)
	p.AssertJobAgentID(t, 0, agentID)
	p.AssertJobStatus(t, 0, oapi.JobStatusPending)
}

func TestPipeline_NoJobAgent_NoJob(t *testing.T) {
	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true")),
		WithEnvironment(EnvironmentName("production")),
		WithResource(ResourceName("server-1"), ResourceKind("Node")),
		WithVersion(VersionTag("v1.0.0")),
	)

	p.RunPipeline()

	p.AssertReleaseCreated(t)
	p.AssertNoJob(t)
}

func TestPipeline_MultipleAgents_MultipleJobs(t *testing.T) {
	agent1 := uuid.New().String()
	agent2 := uuid.New().String()

	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true")),
		WithEnvironment(EnvironmentName("prod")),
		WithResource(ResourceName("srv"), ResourceKind("Server")),
		WithVersion(VersionTag("v1.0.0")),
		WithJobAgent("argo-cd", JobAgentID(agent1)),
		WithJobAgent("github-app", JobAgentID(agent2)),
	)

	p.RunPipeline()

	p.AssertReleaseCreated(t)
	p.AssertJobCount(t, 2)
	p.AssertJobAgentID(t, 0, agent1)
	p.AssertJobAgentID(t, 1, agent2)
}

func TestPipeline_JobReferencesRelease(t *testing.T) {
	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true")),
		WithEnvironment(EnvironmentName("prod")),
		WithResource(ResourceName("srv"), ResourceKind("Server")),
		WithVersion(VersionTag("v1.0.0")),
		WithJobAgent("test-runner"),
	)

	p.RunPipeline()

	p.AssertReleaseCreated(t)
	p.AssertJobCreated(t)

	release := p.Releases()[0]
	p.AssertJobReleaseID(t, 0, release.ID())
}

func TestRun_FullPipeline_WithJobDispatch(t *testing.T) {
	agentID := uuid.New().String()

	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true"), DeploymentName("api")),
		WithEnvironment(EnvironmentName("production")),
		WithResource(ResourceName("server-1"), ResourceKind("Node")),
		WithVersion(VersionTag("v1.0.0")),
		WithJobAgent("test-runner", JobAgentID(agentID)),
	)

	p.Run()

	p.AssertComputedResourceCount(t, 1)
	p.AssertReleaseCreated(t)
	p.AssertReleaseVersion(t, 0, "v1.0.0")
	p.AssertJobCreated(t)
	p.AssertJobCount(t, 1)
	p.AssertJobAgentID(t, 0, agentID)
}

func TestRun_PolicyBlocks_NoJob(t *testing.T) {
	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true")),
		WithEnvironment(EnvironmentName("production")),
		WithResource(ResourceName("srv"), ResourceKind("Server")),
		WithVersion(VersionTag("v2.0.0")),
		WithJobAgent("test-runner"),
		WithPolicy(
			PolicySelector("true"),
			PolicyEnabled(true),
			WithPolicyRule(WithApprovalRule(1)),
		),
	)

	p.Run()

	p.AssertNoRelease(t)
	p.AssertNoJob(t)
}

func TestPipeline_StepByStep_WithJobDispatch(t *testing.T) {
	agentID := uuid.New().String()

	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true")),
		WithEnvironment(EnvironmentName("prod")),
		WithResource(ResourceName("srv"), ResourceKind("Server")),
		WithVersion(VersionTag("v1.0.0")),
		WithJobAgent("test-runner", JobAgentID(agentID)),
	)

	p.EnqueueSelectorEval()

	n := p.ProcessSelectorEvals()
	require.Equal(t, 1, n)
	p.AssertComputedResourceCount(t, 1)
	p.AssertNoRelease(t)
	p.AssertNoJob(t)

	n = p.ProcessDesiredReleases()
	require.Equal(t, 1, n)
	p.AssertReleaseCreated(t)
	p.AssertNoJob(t)

	n = p.ProcessJobDispatches()
	require.Equal(t, 1, n)
	p.AssertJobCreated(t)
	p.AssertJobAgentID(t, 0, agentID)
}

func TestPipeline_NoVersions_NoJob(t *testing.T) {
	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true")),
		WithEnvironment(EnvironmentName("prod")),
		WithResource(ResourceName("srv"), ResourceKind("Server")),
		WithJobAgent("test-runner"),
	)

	p.Run()

	p.AssertNoRelease(t)
	p.AssertNoJob(t)
}
