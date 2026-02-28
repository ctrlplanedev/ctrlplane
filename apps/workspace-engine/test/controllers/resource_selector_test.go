package controllers_test

import (
	"testing"

	selectoreval "workspace-engine/svc/controllers/deploymentresourceselectoreval"
	. "workspace-engine/test/controllers/harness"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// These tests mirror the resource-selector scenarios from
// apps/workspace-engine/test/e2e/engine_deployment_test.go using the
// lightweight controller harness instead of the full engine.

// ---------------------------------------------------------------------------
// Metadata-based selectors (maps to TestEngine_DeploymentCreation)
// ---------------------------------------------------------------------------

func TestSelector_MetadataFilter_MatchesOnlyMatchingResources(t *testing.T) {
	p := NewTestPipeline(t,
		WithDeployment(
			DeploymentName("deployment-has-filter"),
			DeploymentSelector(`resource.metadata["env"] == "dev"`),
		),
		WithEnvironment(EnvironmentName("production")),
		WithResource(
			ResourceName("r1"),
			ResourceKind("Server"),
			ResourceMetadata(map[string]any{"env": "dev"}),
		),
		WithResource(
			ResourceName("r2"),
			ResourceKind("Server"),
			ResourceMetadata(map[string]any{"env": "qa"}),
		),
		WithVersion(VersionTag("v1.0.0")),
	)

	p.EnqueueSelectorEval()
	p.ProcessSelectorEvals()

	assert.Len(t, p.ComputedResources(), 1,
		"only resource with env=dev should match")

	p.ProcessDesiredReleases()
	p.AssertReleaseCreated(t)
	p.AssertReleaseVersion(t, 0, "v1.0.0")
}

func TestSelector_TrueMatchesAllResources(t *testing.T) {
	p := NewTestPipeline(t,
		WithDeployment(
			DeploymentName("deployment-has-no-filter"),
			DeploymentSelector("true"),
		),
		WithEnvironment(EnvironmentName("production")),
		WithResource(
			ResourceName("r1"),
			ResourceKind("Server"),
			ResourceMetadata(map[string]any{"env": "dev"}),
		),
		WithResource(
			ResourceName("r2"),
			ResourceKind("Server"),
			ResourceMetadata(map[string]any{"env": "qa"}),
		),
		WithVersion(VersionTag("v1.0.0")),
	)

	p.EnqueueSelectorEval()
	p.ProcessSelectorEvals()

	assert.Len(t, p.ComputedResources(), 2,
		"true selector should match all resources")

	p.ProcessDesiredReleases()
	p.AssertReleaseCreated(t)
}

// ---------------------------------------------------------------------------
// Tier-based metadata (maps to TestEngine_DeploymentRemovalWithResources)
// ---------------------------------------------------------------------------

func TestSelector_TierMetadata_MatchesWebOnly(t *testing.T) {
	p := NewTestPipeline(t,
		WithDeployment(
			DeploymentName("deployment-1"),
			DeploymentSelector(`resource.metadata["tier"] == "web"`),
		),
		WithEnvironment(EnvironmentName("production")),
		WithResource(
			ResourceName("resource-1"),
			ResourceKind("Pod"),
			ResourceMetadata(map[string]any{"tier": "web"}),
		),
		WithResource(
			ResourceName("resource-2"),
			ResourceKind("Pod"),
			ResourceMetadata(map[string]any{"tier": "api"}),
		),
		WithResource(
			ResourceName("resource-3"),
			ResourceKind("Pod"),
			ResourceMetadata(map[string]any{"tier": "worker"}),
		),
		WithVersion(VersionTag("v1.0.0")),
	)

	p.EnqueueSelectorEval()
	p.ProcessSelectorEvals()

	assert.Len(t, p.ComputedResources(), 1, "only web-tier resource should match")

	p.ProcessDesiredReleases()
	p.AssertReleaseCreated(t)
}

// ---------------------------------------------------------------------------
// Kind-based selectors
// ---------------------------------------------------------------------------

func TestSelector_KindFilter_MatchesNodesOnly(t *testing.T) {
	p := NewTestPipeline(t,
		WithDeployment(
			DeploymentSelector(`resource.kind == "Node"`),
		),
		WithEnvironment(EnvironmentName("staging")),
		WithResource(ResourceName("node-1"), ResourceKind("Node")),
		WithResource(ResourceName("pod-1"), ResourceKind("Pod")),
		WithResource(ResourceName("node-2"), ResourceKind("Node")),
		WithResource(ResourceName("svc-1"), ResourceKind("Service")),
		WithVersion(VersionTag("v2.0.0")),
	)

	p.EnqueueSelectorEval()
	p.ProcessSelectorEvals()

	assert.Len(t, p.ComputedResources(), 2, "should match only 2 Node resources")

	p.ProcessDesiredReleases()
	p.AssertReleaseCreated(t)
	p.AssertReleaseVersion(t, 0, "v2.0.0")
}

func TestSelector_KindFilter_MatchesNone(t *testing.T) {
	p := NewTestPipeline(t,
		WithDeployment(
			DeploymentSelector(`resource.kind == "GPU"`),
		),
		WithEnvironment(EnvironmentName("dev")),
		WithResource(ResourceName("node-1"), ResourceKind("Node")),
		WithResource(ResourceName("pod-1"), ResourceKind("Pod")),
		WithVersion(VersionTag("v1.0.0")),
	)

	p.Run()

	p.AssertComputedResourceCount(t, 0)
}

// ---------------------------------------------------------------------------
// Name-based selectors
// ---------------------------------------------------------------------------

func TestSelector_NameFilter_ExactMatch(t *testing.T) {
	p := NewTestPipeline(t,
		WithDeployment(
			DeploymentSelector(`resource.name == "api-server"`),
		),
		WithEnvironment(EnvironmentName("production")),
		WithResource(ResourceName("api-server"), ResourceKind("Pod")),
		WithResource(ResourceName("web-server"), ResourceKind("Pod")),
		WithResource(ResourceName("worker"), ResourceKind("Pod")),
		WithVersion(VersionTag("v1.0.0")),
	)

	p.EnqueueSelectorEval()
	p.ProcessSelectorEvals()

	assert.Len(t, p.ComputedResources(), 1, "only api-server should match")

	p.ProcessDesiredReleases()
	p.AssertReleaseCreated(t)
}

// ---------------------------------------------------------------------------
// Cross-reference: deployment.name == resource.name
// (maps to TestEngine_DeploymentRemovalWithResources pattern)
// ---------------------------------------------------------------------------

func TestSelector_CrossReference_DeploymentNameMatchesResourceName(t *testing.T) {
	p := NewTestPipeline(t,
		WithDeployment(
			DeploymentName("web-server"),
			DeploymentSelector(`deployment.name == resource.name`),
		),
		WithEnvironment(EnvironmentName("prod")),
		WithResource(ResourceName("web-server"), ResourceKind("Pod")),
		WithResource(ResourceName("api-server"), ResourceKind("Pod")),
		WithResource(ResourceName("worker"), ResourceKind("Pod")),
		WithVersion(VersionTag("v1.0.0")),
	)

	p.EnqueueSelectorEval()
	p.ProcessSelectorEvals()

	assert.Len(t, p.ComputedResources(), 1, "only web-server resource should match")

	p.ProcessDesiredReleases()
	p.AssertReleaseCreated(t)
	p.AssertReleaseVersion(t, 0, "v1.0.0")
}

// ---------------------------------------------------------------------------
// Label-based selectors
// ---------------------------------------------------------------------------

func TestSelector_LabelFilter_MatchesByPool(t *testing.T) {
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
		WithVersion(VersionTag("v1.0.0")),
	)

	p.EnqueueSelectorEval()
	p.ProcessSelectorEvals()

	assert.Len(t, p.ComputedResources(), 1, "only gpu-pool node should match")

	p.ProcessDesiredReleases()
	p.AssertReleaseCreated(t)
}

// ---------------------------------------------------------------------------
// Compound selectors
// ---------------------------------------------------------------------------

func TestSelector_CompoundKindAndMetadata(t *testing.T) {
	p := NewTestPipeline(t,
		WithDeployment(
			DeploymentSelector(`resource.kind == "Node" && resource.metadata["cloud"] == "gcp"`),
		),
		WithEnvironment(EnvironmentName("production")),
		WithResource(
			ResourceName("gcp-node"),
			ResourceKind("Node"),
			ResourceMetadata(map[string]any{"cloud": "gcp"}),
		),
		WithResource(
			ResourceName("aws-node"),
			ResourceKind("Node"),
			ResourceMetadata(map[string]any{"cloud": "aws"}),
		),
		WithResource(
			ResourceName("gcp-pod"),
			ResourceKind("Pod"),
			ResourceMetadata(map[string]any{"cloud": "gcp"}),
		),
		WithVersion(VersionTag("v1.0.0")),
	)

	p.EnqueueSelectorEval()
	p.ProcessSelectorEvals()

	assert.Len(t, p.ComputedResources(), 1, "only gcp-node should match both kind and cloud")

	p.ProcessDesiredReleases()
	p.AssertReleaseCreated(t)
}

func TestSelector_CompoundNameOrKind(t *testing.T) {
	p := NewTestPipeline(t,
		WithDeployment(
			DeploymentSelector(`resource.name == "special" || resource.kind == "GPU"`),
		),
		WithEnvironment(EnvironmentName("production")),
		WithResource(ResourceName("special"), ResourceKind("Node")),
		WithResource(ResourceName("gpu-1"), ResourceKind("GPU")),
		WithResource(ResourceName("regular"), ResourceKind("Node")),
		WithVersion(VersionTag("v1.0.0")),
	)

	p.EnqueueSelectorEval()
	p.ProcessSelectorEvals()

	assert.Len(t, p.ComputedResources(), 2, "special (by name) + gpu-1 (by kind)")

	p.ProcessDesiredReleases()
	p.AssertReleaseCreated(t)
}

// ---------------------------------------------------------------------------
// Multiple resources with cloud metadata
// (maps to TestEngine_DeploymentJobAgentsArray_MultipleResourcesDifferentAgents)
// ---------------------------------------------------------------------------

func TestSelector_CloudMetadata_MatchesGCPOnly(t *testing.T) {
	p := NewTestPipeline(t,
		WithDeployment(
			DeploymentName("gcp-deployment"),
			DeploymentSelector(`resource.metadata["cloud"] == "gcp"`),
		),
		WithEnvironment(EnvironmentName("production")),
		WithResource(
			ResourceName("gcp-server"),
			ResourceKind("Server"),
			ResourceMetadata(map[string]any{"cloud": "gcp"}),
		),
		WithResource(
			ResourceName("aws-server"),
			ResourceKind("Server"),
			ResourceMetadata(map[string]any{"cloud": "aws"}),
		),
		WithVersion(VersionTag("v1.0.0")),
	)

	p.EnqueueSelectorEval()
	p.ProcessSelectorEvals()

	assert.Len(t, p.ComputedResources(), 1, "only gcp-server should match")

	p.ProcessDesiredReleases()
	p.AssertReleaseCreated(t)
	p.AssertReleaseVersion(t, 0, "v1.0.0")
}

func TestSelector_CloudMetadata_MatchesBothClouds(t *testing.T) {
	p := NewTestPipeline(t,
		WithDeployment(
			DeploymentName("multi-cloud"),
			DeploymentSelector("true"),
		),
		WithEnvironment(EnvironmentName("production")),
		WithResource(
			ResourceName("gcp-server"),
			ResourceKind("Server"),
			ResourceMetadata(map[string]any{"cloud": "gcp"}),
		),
		WithResource(
			ResourceName("aws-server"),
			ResourceKind("Server"),
			ResourceMetadata(map[string]any{"cloud": "aws"}),
		),
		WithVersion(VersionTag("v1.0.0")),
	)

	p.Run()

	p.AssertComputedResourceCount(t, 2)
	p.AssertReleaseCreated(t)
}

// ---------------------------------------------------------------------------
// Selector isolation: two independent pipelines confirm that different
// deployment selectors compute different resource sets
// (maps to TestEngine_DeploymentCreation with two deployments)
// ---------------------------------------------------------------------------

func TestSelector_Isolation_TwoDeploymentsDifferentSelectors(t *testing.T) {
	// Pipeline 1: filtered deployment — only dev resources
	p1 := NewTestPipeline(t,
		WithDeployment(
			DeploymentName("deployment-has-filter"),
			DeploymentSelector(`resource.metadata["env"] == "dev"`),
		),
		WithEnvironment(EnvironmentName("production")),
		WithResource(ResourceName("r1"), ResourceKind("Server"), ResourceMetadata(map[string]any{"env": "dev"})),
		WithResource(ResourceName("r2"), ResourceKind("Server"), ResourceMetadata(map[string]any{"env": "qa"})),
		WithVersion(VersionTag("v1.0.0")),
	)

	p1.EnqueueSelectorEval()
	p1.ProcessSelectorEvals()
	assert.Len(t, p1.ComputedResources(), 1, "filtered deployment should match 1 resource")

	// Pipeline 2: unfiltered deployment — all resources
	p2 := NewTestPipeline(t,
		WithDeployment(
			DeploymentName("deployment-has-no-filter"),
			DeploymentSelector("true"),
		),
		WithEnvironment(EnvironmentName("production")),
		WithResource(ResourceName("r1"), ResourceKind("Server"), ResourceMetadata(map[string]any{"env": "dev"})),
		WithResource(ResourceName("r2"), ResourceKind("Server"), ResourceMetadata(map[string]any{"env": "qa"})),
		WithVersion(VersionTag("v1.0.0")),
	)

	p2.EnqueueSelectorEval()
	p2.ProcessSelectorEvals()
	assert.Len(t, p2.ComputedResources(), 2, "unfiltered deployment should match 2 resources")
}

// ---------------------------------------------------------------------------
// Full pipeline: selector eval → desired release with metadata
// (maps to TestEngine_DeploymentJobAgentCreatesJobs release path)
// ---------------------------------------------------------------------------

func TestSelector_FullPipeline_SelectorToRelease(t *testing.T) {
	p := NewTestPipeline(t,
		WithDeployment(
			DeploymentName("deployment-with-version"),
			DeploymentSelector("true"),
		),
		WithEnvironment(EnvironmentName("production")),
		WithResource(ResourceName("resource-1"), ResourceKind("Server")),
		WithVersion(VersionTag("v1.0.0")),
	)

	p.Run()

	p.AssertComputedResourceCount(t, 1)
	p.AssertReleaseCreated(t)
	p.AssertReleaseVersion(t, 0, "v1.0.0")
	p.AssertReleaseDeploymentID(t, 0, p.DeploymentID().String())
	p.AssertReleaseEnvironmentID(t, 0, p.EnvironmentID().String())
}

func TestSelector_FullPipeline_NoVersions_NoRelease(t *testing.T) {
	p := NewTestPipeline(t,
		WithDeployment(
			DeploymentName("deployment-no-version"),
			DeploymentSelector("true"),
		),
		WithEnvironment(EnvironmentName("production")),
		WithResource(ResourceName("resource-1"), ResourceKind("Server")),
	)

	p.Run()

	p.AssertComputedResourceCount(t, 1)
	p.AssertNoRelease(t)
}

func TestSelector_FullPipeline_PolicyBlocksRelease(t *testing.T) {
	p := NewTestPipeline(t,
		WithDeployment(
			DeploymentSelector("true"),
		),
		WithEnvironment(EnvironmentName("production")),
		WithResource(ResourceName("srv"), ResourceKind("Server")),
		WithVersion(VersionTag("v1.0.0")),
		WithPolicy(
			PolicySelector("true"),
			PolicyEnabled(true),
			WithPolicyRule(WithApprovalRule(1)),
		),
	)

	p.Run()

	p.AssertComputedResourceCount(t, 1)
	p.AssertNoRelease(t)
}

// ---------------------------------------------------------------------------
// Step-by-step verification
// ---------------------------------------------------------------------------

func TestSelector_StepByStep_SelectorThenRelease(t *testing.T) {
	p := NewTestPipeline(t,
		WithDeployment(
			DeploymentSelector(`resource.metadata["env"] == "dev"`),
		),
		WithEnvironment(EnvironmentName("production")),
		WithResource(
			ResourceName("dev-server"),
			ResourceKind("Server"),
			ResourceMetadata(map[string]any{"env": "dev"}),
		),
		WithResource(
			ResourceName("prod-server"),
			ResourceKind("Server"),
			ResourceMetadata(map[string]any{"env": "prod"}),
		),
		WithVersion(VersionTag("v1.0.0")),
	)

	// Step 1: enqueue and process selector eval
	p.EnqueueSelectorEval()
	n := p.ProcessSelectorEvals()
	require.Equal(t, 1, n, "should process 1 selector eval item")
	assert.Len(t, p.ComputedResources(), 1, "should match only dev-server")

	// Step 2: no release yet
	p.AssertNoRelease(t)

	// Step 3: process desired releases — one per release target (one per resource)
	n = p.ProcessDesiredReleases()
	require.Equal(t, 2, n, "should process 1 desired release item per release target")
	p.AssertReleaseCreated(t)
	p.AssertReleaseVersion(t, 0, "v1.0.0")
}

// ---------------------------------------------------------------------------
// Many resources, selective matching
// ---------------------------------------------------------------------------

func TestSelector_ManyResources_SelectiveMatch(t *testing.T) {
	p := NewTestPipeline(t,
		WithDeployment(
			DeploymentSelector(`resource.metadata["tier"] == "web"`),
		),
		WithEnvironment(EnvironmentName("production")),
		WithResource(ResourceName("web-1"), ResourceKind("Pod"), ResourceMetadata(map[string]any{"tier": "web"})),
		WithResource(ResourceName("web-2"), ResourceKind("Pod"), ResourceMetadata(map[string]any{"tier": "web"})),
		WithResource(ResourceName("api-1"), ResourceKind("Pod"), ResourceMetadata(map[string]any{"tier": "api"})),
		WithResource(ResourceName("api-2"), ResourceKind("Pod"), ResourceMetadata(map[string]any{"tier": "api"})),
		WithResource(ResourceName("worker-1"), ResourceKind("Pod"), ResourceMetadata(map[string]any{"tier": "worker"})),
		WithVersion(VersionTag("v1.0.0")),
	)

	p.EnqueueSelectorEval()
	p.ProcessSelectorEvals()

	assert.Len(t, p.ComputedResources(), 2, "should match 2 web-tier resources")

	p.ProcessDesiredReleases()
	p.AssertReleaseCreated(t)
}

// ---------------------------------------------------------------------------
// Mutate-and-rerun: change selector mock data, re-evaluate
// (maps to the e2e pattern of PushEvent + re-check)
// ---------------------------------------------------------------------------

func TestSelector_MutateAndRerun_ResourceAdded(t *testing.T) {
	p := NewTestPipeline(t,
		WithDeployment(
			DeploymentSelector(`resource.metadata["env"] == "dev"`),
		),
		WithEnvironment(EnvironmentName("production")),
		WithResource(
			ResourceName("r1"),
			ResourceKind("Server"),
			ResourceMetadata(map[string]any{"env": "dev"}),
		),
		WithVersion(VersionTag("v1.0.0")),
	)

	p.Run()
	p.AssertComputedResourceCount(t, 1)
	p.AssertReleaseCreated(t)

	// Simulate a new resource being added by mutating the mock getter.
	// In the real system this would come from a resource-create event.
	newResource := ResourceDef{
		ID:       mustNewUUID(),
		Name:     "r2",
		Kind:     "Server",
		Labels:   map[string]any{},
		Metadata: map[string]any{"env": "dev"},
	}
	p.SelectorGetter.Resources = append(
		p.SelectorGetter.Resources,
		buildResourceInfo(newResource),
	)

	p.EnqueueSelectorEval()
	p.Run()

	assert.Len(t, p.ComputedResources(), 2,
		"after adding r2, both dev resources should match")
	p.AssertReleaseCount(t, 2)
}

func TestSelector_MutateAndRerun_SelectorChangedOnMock(t *testing.T) {
	p := NewTestPipeline(t,
		WithDeployment(
			DeploymentSelector(`resource.kind == "Node"`),
		),
		WithEnvironment(EnvironmentName("production")),
		WithResource(ResourceName("server-1"), ResourceKind("Node")),
		WithVersion(VersionTag("v1.0.0")),
	)

	p.Run()
	assert.Len(t, p.ComputedResources(), 1, "initially Node matches")
	p.AssertReleaseCount(t, 1)

	// Simulate changing the deployment's resource selector.
	p.SelectorGetter.Deployment.ResourceSelector = `resource.kind == "Pod"`

	p.EnqueueSelectorEval()
	p.Run()

	// Computed resources updated to 0 Nodes since selector now targets Pods.
	assert.Len(t, p.ComputedResources(), 0, "after selector change, no Nodes match Pod selector")
	// A second release is still created because the release target still exists.
	p.AssertReleaseCount(t, 2)
}

// ---------------------------------------------------------------------------
// Dynamic: update deployment filter between runs
// ---------------------------------------------------------------------------

func TestSelector_Dynamic_NarrowToWiden(t *testing.T) {
	p := NewTestPipeline(t,
		WithDeployment(
			DeploymentSelector(`resource.metadata["env"] == "dev"`),
		),
		WithEnvironment(EnvironmentName("production")),
		WithResource(ResourceName("dev-srv"), ResourceKind("Server"), ResourceMetadata(map[string]any{"env": "dev"})),
		WithResource(ResourceName("qa-srv"), ResourceKind("Server"), ResourceMetadata(map[string]any{"env": "qa"})),
		WithResource(ResourceName("prod-srv"), ResourceKind("Server"), ResourceMetadata(map[string]any{"env": "prod"})),
		WithVersion(VersionTag("v1.0.0")),
	)

	p.Run()
	assert.Len(t, p.ComputedResources(), 1, "round 1: only dev-srv should match")

	// Widen filter to match everything.
	p.SelectorGetter.Deployment.ResourceSelector = "true"
	p.EnqueueSelectorEval()
	p.Run()

	assert.Len(t, p.ComputedResources(), 3, "round 2: all resources should match after widening to true")
}

func TestSelector_Dynamic_WidenToNarrow(t *testing.T) {
	p := NewTestPipeline(t,
		WithDeployment(
			DeploymentSelector("true"),
		),
		WithEnvironment(EnvironmentName("production")),
		WithResource(ResourceName("web"), ResourceKind("Pod"), ResourceMetadata(map[string]any{"tier": "web"})),
		WithResource(ResourceName("api"), ResourceKind("Pod"), ResourceMetadata(map[string]any{"tier": "api"})),
		WithResource(ResourceName("worker"), ResourceKind("Pod"), ResourceMetadata(map[string]any{"tier": "worker"})),
		WithVersion(VersionTag("v1.0.0")),
	)

	p.Run()
	assert.Len(t, p.ComputedResources(), 3, "round 1: true matches all 3 resources")

	// Narrow filter down to web-tier only.
	p.SelectorGetter.Deployment.ResourceSelector = `resource.metadata["tier"] == "web"`
	p.EnqueueSelectorEval()
	p.Run()

	assert.Len(t, p.ComputedResources(), 1, "round 2: narrowed to web-tier only")
}

func TestSelector_Dynamic_SwitchMetadataKey(t *testing.T) {
	p := NewTestPipeline(t,
		WithDeployment(
			DeploymentSelector(`resource.metadata["cloud"] == "gcp"`),
		),
		WithEnvironment(EnvironmentName("production")),
		WithResource(ResourceName("gcp-1"), ResourceKind("Server"), ResourceMetadata(map[string]any{"cloud": "gcp", "region": "us-central1"})),
		WithResource(ResourceName("aws-1"), ResourceKind("Server"), ResourceMetadata(map[string]any{"cloud": "aws", "region": "us-east-1"})),
		WithResource(ResourceName("gcp-2"), ResourceKind("Server"), ResourceMetadata(map[string]any{"cloud": "gcp", "region": "eu-west1"})),
		WithVersion(VersionTag("v1.0.0")),
	)

	p.Run()
	assert.Len(t, p.ComputedResources(), 2, "round 1: 2 gcp resources")

	// Switch to filtering by region instead of cloud.
	p.SelectorGetter.Deployment.ResourceSelector = `resource.metadata["region"] == "us-east-1"`
	p.EnqueueSelectorEval()
	p.Run()

	assert.Len(t, p.ComputedResources(), 1, "round 2: only aws-1 has region us-east-1")
}

func TestSelector_Dynamic_KindToMetadata(t *testing.T) {
	p := NewTestPipeline(t,
		WithDeployment(
			DeploymentSelector(`resource.kind == "Node"`),
		),
		WithEnvironment(EnvironmentName("production")),
		WithResource(ResourceName("node-dev"), ResourceKind("Node"), ResourceMetadata(map[string]any{"env": "dev"})),
		WithResource(ResourceName("node-prod"), ResourceKind("Node"), ResourceMetadata(map[string]any{"env": "prod"})),
		WithResource(ResourceName("pod-dev"), ResourceKind("Pod"), ResourceMetadata(map[string]any{"env": "dev"})),
		WithVersion(VersionTag("v1.0.0")),
	)

	p.Run()
	assert.Len(t, p.ComputedResources(), 2, "round 1: both Nodes match kind filter")

	// Switch from kind-based to metadata-based filter.
	p.SelectorGetter.Deployment.ResourceSelector = `resource.metadata["env"] == "dev"`
	p.EnqueueSelectorEval()
	p.Run()

	assert.Len(t, p.ComputedResources(), 2, "round 2: node-dev and pod-dev match env=dev")
}

func TestSelector_Dynamic_CompoundToSimple(t *testing.T) {
	p := NewTestPipeline(t,
		WithDeployment(
			DeploymentSelector(`resource.kind == "Server" && resource.metadata["env"] == "prod"`),
		),
		WithEnvironment(EnvironmentName("production")),
		WithResource(ResourceName("prod-server"), ResourceKind("Server"), ResourceMetadata(map[string]any{"env": "prod"})),
		WithResource(ResourceName("dev-server"), ResourceKind("Server"), ResourceMetadata(map[string]any{"env": "dev"})),
		WithResource(ResourceName("prod-pod"), ResourceKind("Pod"), ResourceMetadata(map[string]any{"env": "prod"})),
		WithVersion(VersionTag("v1.0.0")),
	)

	p.Run()
	assert.Len(t, p.ComputedResources(), 1, "round 1: only prod-server matches both kind and env")

	// Relax to just kind.
	p.SelectorGetter.Deployment.ResourceSelector = `resource.kind == "Server"`
	p.EnqueueSelectorEval()
	p.Run()

	assert.Len(t, p.ComputedResources(), 2, "round 2: both Servers match after dropping env condition")
}

func TestSelector_Dynamic_MultipleIterations(t *testing.T) {
	p := NewTestPipeline(t,
		WithDeployment(
			DeploymentSelector("true"),
		),
		WithEnvironment(EnvironmentName("production")),
		WithResource(ResourceName("a"), ResourceKind("Node"), ResourceMetadata(map[string]any{"env": "dev"})),
		WithResource(ResourceName("b"), ResourceKind("Pod"), ResourceMetadata(map[string]any{"env": "prod"})),
		WithResource(ResourceName("c"), ResourceKind("Node"), ResourceMetadata(map[string]any{"env": "prod"})),
		WithVersion(VersionTag("v1.0.0")),
	)

	// Round 1: match everything
	p.Run()
	assert.Len(t, p.ComputedResources(), 3, "round 1: true matches all 3")

	// Round 2: narrow to Nodes only
	p.SelectorGetter.Deployment.ResourceSelector = `resource.kind == "Node"`
	p.EnqueueSelectorEval()
	p.Run()
	assert.Len(t, p.ComputedResources(), 2, "round 2: 2 Nodes")

	// Round 3: narrow further to prod Nodes
	p.SelectorGetter.Deployment.ResourceSelector = `resource.kind == "Node" && resource.metadata["env"] == "prod"`
	p.EnqueueSelectorEval()
	p.Run()
	assert.Len(t, p.ComputedResources(), 1, "round 3: only prod Node matches")

	// Round 4: widen back to all
	p.SelectorGetter.Deployment.ResourceSelector = "true"
	p.EnqueueSelectorEval()
	p.Run()
	assert.Len(t, p.ComputedResources(), 3, "round 4: back to all 3")
}

func TestSelector_Dynamic_FilterMatchesNothing_ThenMatches(t *testing.T) {
	p := NewTestPipeline(t,
		WithDeployment(
			DeploymentSelector(`resource.kind == "GPU"`),
		),
		WithEnvironment(EnvironmentName("production")),
		WithResource(ResourceName("node-1"), ResourceKind("Node")),
		WithResource(ResourceName("pod-1"), ResourceKind("Pod")),
		WithVersion(VersionTag("v1.0.0")),
	)

	p.Run()
	assert.Len(t, p.ComputedResources(), 0, "round 1: GPU selector matches nothing")

	// Fix the filter to something that matches.
	p.SelectorGetter.Deployment.ResourceSelector = `resource.kind == "Node"`
	p.EnqueueSelectorEval()
	p.Run()

	assert.Len(t, p.ComputedResources(), 1, "round 2: Node filter now matches node-1")
}

func TestSelector_Dynamic_CrossReference_ThenDrop(t *testing.T) {
	p := NewTestPipeline(t,
		WithDeployment(
			DeploymentName("api-server"),
			DeploymentSelector(`deployment.name == resource.name`),
		),
		WithEnvironment(EnvironmentName("production")),
		WithResource(ResourceName("api-server"), ResourceKind("Pod")),
		WithResource(ResourceName("web-server"), ResourceKind("Pod")),
		WithResource(ResourceName("worker"), ResourceKind("Pod")),
		WithVersion(VersionTag("v1.0.0")),
	)

	p.Run()
	assert.Len(t, p.ComputedResources(), 1, "round 1: only api-server matches cross-ref")

	// Switch to a non-cross-ref selector that matches more.
	p.SelectorGetter.Deployment.ResourceSelector = `resource.kind == "Pod"`
	p.EnqueueSelectorEval()
	p.Run()

	assert.Len(t, p.ComputedResources(), 3, "round 2: all 3 Pods match kind filter")
}

func TestSelector_Dynamic_ResourcesChangeAlongsideFilter(t *testing.T) {
	p := NewTestPipeline(t,
		WithDeployment(
			DeploymentSelector(`resource.metadata["env"] == "dev"`),
		),
		WithEnvironment(EnvironmentName("production")),
		WithResource(ResourceName("srv-1"), ResourceKind("Server"), ResourceMetadata(map[string]any{"env": "dev"})),
		WithVersion(VersionTag("v1.0.0")),
	)

	p.Run()
	assert.Len(t, p.ComputedResources(), 1, "round 1: 1 dev resource")

	// Simultaneously change filter AND add a new resource.
	p.SelectorGetter.Deployment.ResourceSelector = `resource.metadata["env"] == "staging"`
	p.SelectorGetter.Resources = append(
		p.SelectorGetter.Resources,
		buildResourceInfo(ResourceDef{
			ID:       mustNewUUID(),
			Name:     "staging-srv",
			Kind:     "Server",
			Labels:   map[string]any{},
			Metadata: map[string]any{"env": "staging"},
		}),
	)
	p.EnqueueSelectorEval()
	p.Run()

	assert.Len(t, p.ComputedResources(), 1, "round 2: only new staging resource matches updated filter")
}

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

func TestSelector_NoResources(t *testing.T) {
	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true")),
		WithEnvironment(EnvironmentName("production")),
		WithVersion(VersionTag("v1.0.0")),
	)

	p.Run()

	p.AssertComputedResourceCount(t, 0)
	p.AssertNoRelease(t)
}

func TestSelector_EmptyMetadata_DoesNotMatch(t *testing.T) {
	p := NewTestPipeline(t,
		WithDeployment(
			DeploymentSelector(`resource.metadata["env"] == "dev"`),
		),
		WithEnvironment(EnvironmentName("production")),
		WithResource(ResourceName("bare-server"), ResourceKind("Server")),
		WithVersion(VersionTag("v1.0.0")),
	)

	p.Run()

	p.AssertComputedResourceCount(t, 0)
}

func TestSelector_MultipleMetadataKeys(t *testing.T) {
	p := NewTestPipeline(t,
		WithDeployment(
			DeploymentSelector(`resource.metadata["env"] == "prod" && resource.metadata["region"] == "us-east-1"`),
		),
		WithEnvironment(EnvironmentName("production")),
		WithResource(
			ResourceName("us-east-prod"),
			ResourceKind("Server"),
			ResourceMetadata(map[string]any{"env": "prod", "region": "us-east-1"}),
		),
		WithResource(
			ResourceName("us-west-prod"),
			ResourceKind("Server"),
			ResourceMetadata(map[string]any{"env": "prod", "region": "us-west-2"}),
		),
		WithResource(
			ResourceName("us-east-dev"),
			ResourceKind("Server"),
			ResourceMetadata(map[string]any{"env": "dev", "region": "us-east-1"}),
		),
		WithVersion(VersionTag("v1.0.0")),
	)

	p.EnqueueSelectorEval()
	p.ProcessSelectorEvals()

	assert.Len(t, p.ComputedResources(), 1, "only us-east-prod matches both conditions")
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

func mustNewUUID() uuid.UUID {
	return uuid.New()
}

func buildResourceInfo(rd ResourceDef) selectoreval.ResourceInfo {
	meta := map[string]any{
		"labels": rd.Labels,
	}
	for k, v := range rd.Metadata {
		meta[k] = v
	}
	return selectoreval.ResourceInfo{
		ID: rd.ID,
		Raw: map[string]any{
			"name":     rd.Name,
			"kind":     rd.Kind,
			"metadata": meta,
		},
	}
}
