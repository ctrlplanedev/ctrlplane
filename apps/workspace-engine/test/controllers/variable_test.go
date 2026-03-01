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
// Literal deployment variable — default value
// ---------------------------------------------------------------------------

func TestVariable_DefaultValue_IncludedInRelease(t *testing.T) {
	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true")),
		WithEnvironment(EnvironmentName("production")),
		WithResource(ResourceName("srv"), ResourceKind("Server")),
		WithVersion(VersionTag("v1.0.0")),
		WithDeploymentVariable("image", DefaultValue("nginx:latest")),
	)

	p.Run()

	p.AssertReleaseCreated(t)
	p.AssertReleaseVariableCount(t, 0, 1)
	p.AssertReleaseVariableEquals(t, 0, "image", "nginx:latest")
}

// ---------------------------------------------------------------------------
// Multiple default variables
// ---------------------------------------------------------------------------

func TestVariable_MultipleDefaults(t *testing.T) {
	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true")),
		WithEnvironment(EnvironmentName("production")),
		WithResource(ResourceName("srv"), ResourceKind("Server")),
		WithVersion(VersionTag("v1.0.0")),
		WithDeploymentVariable("image", DefaultValue("nginx:latest")),
		WithDeploymentVariable("replicas", DefaultValue(3)),
		WithDeploymentVariable("debug", DefaultValue(false)),
	)

	p.Run()

	p.AssertReleaseCreated(t)
	p.AssertReleaseVariableCount(t, 0, 3)
	p.AssertReleaseVariableEquals(t, 0, "image", "nginx:latest")

	vars := p.ReleaseVariables(t, 0)
	i, err := vars["replicas"].AsIntegerValue()
	require.NoError(t, err)
	assert.Equal(t, 3, int(i))

	b, err := vars["debug"].AsBooleanValue()
	require.NoError(t, err)
	assert.False(t, bool(b))
}

// ---------------------------------------------------------------------------
// No variables configured — release has empty map
// ---------------------------------------------------------------------------

func TestVariable_NoVars_EmptyVariablesOnRelease(t *testing.T) {
	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true")),
		WithEnvironment(EnvironmentName("production")),
		WithResource(ResourceName("srv"), ResourceKind("Server")),
		WithVersion(VersionTag("v1.0.0")),
	)

	p.Run()

	p.AssertReleaseCreated(t)
	p.AssertReleaseVariableCount(t, 0, 0)
}

// ---------------------------------------------------------------------------
// Deployment variable value overrides default
// ---------------------------------------------------------------------------

func TestVariable_ValueOverridesDefault(t *testing.T) {
	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true")),
		WithEnvironment(EnvironmentName("production")),
		WithResource(ResourceName("srv"), ResourceKind("Server")),
		WithVersion(VersionTag("v1.0.0")),
		WithDeploymentVariable("image",
			DefaultValue("default-image"),
			WithVariableValue(LiteralValue("override-image")),
		),
	)

	p.Run()

	p.AssertReleaseCreated(t)
	p.AssertReleaseVariableEquals(t, 0, "image", "override-image")
}

// ---------------------------------------------------------------------------
// Highest priority value wins
// ---------------------------------------------------------------------------

func TestVariable_HighestPriorityValueWins(t *testing.T) {
	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true")),
		WithEnvironment(EnvironmentName("production")),
		WithResource(ResourceName("srv"), ResourceKind("Server")),
		WithVersion(VersionTag("v1.0.0")),
		WithDeploymentVariable("image",
			WithVariableValue(LiteralValue("low"), ValuePriority(1)),
			WithVariableValue(LiteralValue("high"), ValuePriority(100)),
			WithVariableValue(LiteralValue("medium"), ValuePriority(50)),
		),
	)

	p.Run()

	p.AssertReleaseCreated(t)
	p.AssertReleaseVariableEquals(t, 0, "image", "high")
}

// ---------------------------------------------------------------------------
// Resource variable overrides deployment variable
// ---------------------------------------------------------------------------

func TestVariable_ResourceVarOverridesDeploymentVar(t *testing.T) {
	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true")),
		WithEnvironment(EnvironmentName("production")),
		WithResource(ResourceName("srv"), ResourceKind("Server")),
		WithVersion(VersionTag("v1.0.0")),
		WithDeploymentVariable("region",
			DefaultValue("us-west-2"),
			WithVariableValue(LiteralValue("eu-west-1"), ValuePriority(10)),
		),
		WithResourceVariable("region", LiteralValue("ap-southeast-1")),
	)

	p.Run()

	p.AssertReleaseCreated(t)
	p.AssertReleaseVariableEquals(t, 0, "region", "ap-southeast-1")
}

// ---------------------------------------------------------------------------
// Reference variable resolved from related resource
// ---------------------------------------------------------------------------

func TestVariable_ReferenceVariable_ResolvesFromRelatedResource(t *testing.T) {
	dbResource := &oapi.Resource{
		Id:          uuid.New().String(),
		Name:        "db-primary",
		Kind:        "Database",
		Version:     "v1",
		Identifier:  "db-primary",
		WorkspaceId: uuid.New().String(),
		Metadata:    map[string]string{"host": "db.internal:5432"},
		Config:      map[string]any{},
	}

	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true")),
		WithEnvironment(EnvironmentName("production")),
		WithResource(ResourceName("srv"), ResourceKind("Server")),
		WithVersion(VersionTag("v1.0.0")),
		WithDeploymentVariable("db_host",
			WithVariableValue(ReferenceValue("database", "metadata", "host")),
		),
		WithRelatedResource("database", dbResource),
	)

	p.Run()

	p.AssertReleaseCreated(t)
	p.AssertReleaseVariableEquals(t, 0, "db_host", "db.internal:5432")
}

// ---------------------------------------------------------------------------
// Reference variable — resource name
// ---------------------------------------------------------------------------

func TestVariable_ReferenceVariable_ResourceName(t *testing.T) {
	clusterResource := &oapi.Resource{
		Id:          uuid.New().String(),
		Name:        "k8s-prod",
		Kind:        "Cluster",
		Version:     "v1",
		Identifier:  "k8s-prod",
		WorkspaceId: uuid.New().String(),
		Metadata:    map[string]string{},
		Config:      map[string]any{},
	}

	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true")),
		WithEnvironment(EnvironmentName("production")),
		WithResource(ResourceName("srv"), ResourceKind("Server")),
		WithVersion(VersionTag("v1.0.0")),
		WithDeploymentVariable("cluster_name",
			WithVariableValue(ReferenceValue("cluster", "name")),
		),
		WithRelatedResource("cluster", clusterResource),
	)

	p.Run()

	p.AssertReleaseCreated(t)
	p.AssertReleaseVariableEquals(t, 0, "cluster_name", "k8s-prod")
}

// ---------------------------------------------------------------------------
// Mixed literal and reference variables
// ---------------------------------------------------------------------------

func TestVariable_MixedLiteralAndReference(t *testing.T) {
	vpcResource := &oapi.Resource{
		Id:          uuid.New().String(),
		Name:        "vpc-main",
		Kind:        "Network",
		Version:     "v1",
		Identifier:  "vpc-main",
		WorkspaceId: uuid.New().String(),
		Metadata:    map[string]string{"cidr": "10.0.0.0/16"},
		Config:      map[string]any{},
	}

	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true")),
		WithEnvironment(EnvironmentName("production")),
		WithResource(ResourceName("srv"), ResourceKind("Server")),
		WithVersion(VersionTag("v1.0.0")),
		WithDeploymentVariable("image",
			WithVariableValue(LiteralValue("myapp:v2")),
		),
		WithDeploymentVariable("vpc_cidr",
			WithVariableValue(ReferenceValue("vpc", "metadata", "cidr")),
		),
		WithDeploymentVariable("replicas", DefaultValue(3)),
		WithRelatedResource("vpc", vpcResource),
	)

	p.Run()

	p.AssertReleaseCreated(t)
	p.AssertReleaseVariableCount(t, 0, 3)
	p.AssertReleaseVariableEquals(t, 0, "image", "myapp:v2")
	p.AssertReleaseVariableEquals(t, 0, "vpc_cidr", "10.0.0.0/16")

	vars := p.ReleaseVariables(t, 0)
	i, err := vars["replicas"].AsIntegerValue()
	require.NoError(t, err)
	assert.Equal(t, 3, int(i))
}

// ---------------------------------------------------------------------------
// Resource variable with reference
// ---------------------------------------------------------------------------

func TestVariable_ResourceVar_Reference(t *testing.T) {
	dbResource := &oapi.Resource{
		Id:          uuid.New().String(),
		Name:        "db-primary",
		Kind:        "Database",
		Version:     "v1",
		Identifier:  "db-primary",
		WorkspaceId: uuid.New().String(),
		Metadata:    map[string]string{"connection_string": "postgres://db.internal/app"},
		Config:      map[string]any{},
	}

	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true")),
		WithEnvironment(EnvironmentName("production")),
		WithResource(ResourceName("srv"), ResourceKind("Server")),
		WithVersion(VersionTag("v1.0.0")),
		WithDeploymentVariable("db_url",
			DefaultValue("postgres://localhost/app"),
		),
		WithResourceVariable("db_url", ReferenceValue("database", "metadata", "connection_string")),
		WithRelatedResource("database", dbResource),
	)

	p.Run()

	p.AssertReleaseCreated(t)
	p.AssertReleaseVariableEquals(t, 0, "db_url", "postgres://db.internal/app")
}

// ---------------------------------------------------------------------------
// No default, no value, no resource var — key absent from release
// ---------------------------------------------------------------------------

func TestVariable_NoDefaultNoValue_KeyAbsent(t *testing.T) {
	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true")),
		WithEnvironment(EnvironmentName("production")),
		WithResource(ResourceName("srv"), ResourceKind("Server")),
		WithVersion(VersionTag("v1.0.0")),
		WithDeploymentVariable("optional_key"),
	)

	p.Run()

	p.AssertReleaseCreated(t)
	vars := p.ReleaseVariables(t, 0)
	_, exists := vars["optional_key"]
	assert.False(t, exists, "expected optional_key to be absent from release variables")
}

// ---------------------------------------------------------------------------
// Variables included alongside version in release
// ---------------------------------------------------------------------------

func TestVariable_IncludedWithCorrectVersion(t *testing.T) {
	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true")),
		WithEnvironment(EnvironmentName("production")),
		WithResource(ResourceName("srv"), ResourceKind("Server")),
		WithVersion(VersionTag("v2.0.0")),
		WithVersion(VersionTag("v1.0.0")),
		WithDeploymentVariable("image", DefaultValue("myapp:latest")),
	)

	p.Run()

	p.AssertReleaseCreated(t)
	p.AssertReleaseVersion(t, 0, "v2.0.0")
	p.AssertReleaseVariableEquals(t, 0, "image", "myapp:latest")
}

// ---------------------------------------------------------------------------
// Dynamic: change variable between runs
// ---------------------------------------------------------------------------

func TestVariable_Dynamic_ChangeVariableBetweenRuns(t *testing.T) {
	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true")),
		WithEnvironment(EnvironmentName("production")),
		WithResource(ResourceName("srv"), ResourceKind("Server")),
		WithVersion(VersionTag("v1.0.0")),
		WithDeploymentVariable("image", DefaultValue("nginx:1.0")),
	)

	p.Run()
	p.AssertReleaseCreated(t)
	p.AssertReleaseVariableEquals(t, 0, "image", "nginx:1.0")

	// Change the default value and re-run.
	p.ReleaseGetter.DeploymentVars = []oapi.DeploymentVariableWithValues{{
		Variable: oapi.DeploymentVariable{
			Id:           uuid.New().String(),
			DeploymentId: p.Scenario.DeploymentID.String(),
			Key:          "image",
			DefaultValue: oapi.NewLiteralValue("nginx:2.0"),
		},
	}}

	p.EnqueueSelectorEval()
	p.Run()

	p.AssertReleaseCount(t, 2)
	p.AssertReleaseVariableEquals(t, 1, "image", "nginx:2.0")
}

// ---------------------------------------------------------------------------
// Dynamic: add resource variable override after initial run
// ---------------------------------------------------------------------------

func TestVariable_Dynamic_AddResourceVarOverride(t *testing.T) {
	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true")),
		WithEnvironment(EnvironmentName("production")),
		WithResource(ResourceName("srv"), ResourceKind("Server")),
		WithVersion(VersionTag("v1.0.0")),
		WithDeploymentVariable("region", DefaultValue("us-west-2")),
	)

	// Round 1: default value used.
	p.Run()
	p.AssertReleaseVariableEquals(t, 0, "region", "us-west-2")

	// Round 2: add resource variable override.
	p.ReleaseGetter.ResourceVars = map[string]oapi.ResourceVariable{
		"region": {
			Key:        "region",
			ResourceId: p.Scenario.Resources[0].ID.String(),
			Value:      LiteralValue("eu-central-1"),
		},
	}

	p.EnqueueSelectorEval()
	p.Run()

	p.AssertReleaseCount(t, 2)
	p.AssertReleaseVariableEquals(t, 1, "region", "eu-central-1")
}

// ---------------------------------------------------------------------------
// Reference variable fails — falls through to default
// ---------------------------------------------------------------------------

func TestVariable_ReferenceFails_FallsToDefault(t *testing.T) {
	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true")),
		WithEnvironment(EnvironmentName("production")),
		WithResource(ResourceName("srv"), ResourceKind("Server")),
		WithVersion(VersionTag("v1.0.0")),
		WithDeploymentVariable("db_host",
			DefaultValue("localhost"),
			WithVariableValue(ReferenceValue("nonexistent", "name")),
		),
	)

	p.Run()

	p.AssertReleaseCreated(t)
	p.AssertReleaseVariableEquals(t, 0, "db_host", "localhost")
}

// ---------------------------------------------------------------------------
// Variables with policy — blocked version has no release
// ---------------------------------------------------------------------------

func TestVariable_PolicyBlocks_NoRelease(t *testing.T) {
	ruleID := uuid.New().String()

	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true")),
		WithEnvironment(EnvironmentName("production")),
		WithResource(ResourceName("srv"), ResourceKind("Server")),
		WithVersion(VersionTag("v1.0.0")),
		WithDeploymentVariable("image", DefaultValue("nginx:latest")),
		WithPolicy(
			PolicySelector("true"),
			PolicyEnabled(true),
			WithPolicyRule(PolicyRuleID(ruleID), WithApprovalRule(1)),
		),
	)

	p.Run()

	p.AssertNoRelease(t)
}

// ---------------------------------------------------------------------------
// Variables with policy skip — release includes variables
// ---------------------------------------------------------------------------

func TestVariable_WithPolicySkip_IncludesVariables(t *testing.T) {
	ruleID := uuid.New().String()
	versionID := uuid.New().String()

	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true")),
		WithEnvironment(EnvironmentName("production")),
		WithResource(ResourceName("srv"), ResourceKind("Server")),
		WithVersion(VersionTag("v1.0.0"), VersionID(versionID)),
		WithDeploymentVariable("image", DefaultValue("nginx:latest")),
		WithDeploymentVariable("replicas", DefaultValue(5)),
		WithPolicy(
			PolicySelector("true"),
			PolicyEnabled(true),
			WithPolicyRule(PolicyRuleID(ruleID), WithApprovalRule(1)),
		),
		WithPolicySkip(ruleID, versionID),
	)

	p.Run()

	p.AssertReleaseCreated(t)
	p.AssertReleaseVersion(t, 0, "v1.0.0")
	p.AssertReleaseVariableCount(t, 0, 2)
	p.AssertReleaseVariableEquals(t, 0, "image", "nginx:latest")

	vars := p.ReleaseVariables(t, 0)
	i, err := vars["replicas"].AsIntegerValue()
	require.NoError(t, err)
	assert.Equal(t, 5, int(i))
}

// ---------------------------------------------------------------------------
// Reference to resource config (nested path)
// ---------------------------------------------------------------------------

func TestVariable_ReferenceVariable_NestedConfig(t *testing.T) {
	clusterResource := &oapi.Resource{
		Id:          uuid.New().String(),
		Name:        "k8s-prod",
		Kind:        "Cluster",
		Version:     "v1",
		Identifier:  "k8s-prod",
		WorkspaceId: uuid.New().String(),
		Metadata:    map[string]string{},
		Config: map[string]any{
			"networking": map[string]any{
				"api_endpoint": "https://k8s.internal:6443",
			},
		},
	}

	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true")),
		WithEnvironment(EnvironmentName("production")),
		WithResource(ResourceName("srv"), ResourceKind("Server")),
		WithVersion(VersionTag("v1.0.0")),
		WithDeploymentVariable("k8s_endpoint",
			WithVariableValue(ReferenceValue("cluster", "config", "networking", "api_endpoint")),
		),
		WithRelatedResource("cluster", clusterResource),
	)

	p.Run()

	p.AssertReleaseCreated(t)
	p.AssertReleaseVariableEquals(t, 0, "k8s_endpoint", "https://k8s.internal:6443")
}

// ---------------------------------------------------------------------------
// Multiple related resources — each referenced by different variables
// ---------------------------------------------------------------------------

func TestVariable_MultipleRelatedResources(t *testing.T) {
	dbResource := &oapi.Resource{
		Id:          uuid.New().String(),
		Name:        "db-primary",
		Kind:        "Database",
		Version:     "v1",
		Identifier:  "db-primary",
		WorkspaceId: uuid.New().String(),
		Metadata:    map[string]string{"host": "db.internal"},
		Config:      map[string]any{},
	}
	cacheResource := &oapi.Resource{
		Id:          uuid.New().String(),
		Name:        "redis-prod",
		Kind:        "Cache",
		Version:     "v1",
		Identifier:  "redis-prod",
		WorkspaceId: uuid.New().String(),
		Metadata:    map[string]string{"host": "redis.internal"},
		Config:      map[string]any{},
	}

	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true")),
		WithEnvironment(EnvironmentName("production")),
		WithResource(ResourceName("srv"), ResourceKind("Server")),
		WithVersion(VersionTag("v1.0.0")),
		WithDeploymentVariable("db_host",
			WithVariableValue(ReferenceValue("database", "metadata", "host")),
		),
		WithDeploymentVariable("cache_host",
			WithVariableValue(ReferenceValue("cache", "metadata", "host")),
		),
		WithRelatedResource("database", dbResource),
		WithRelatedResource("cache", cacheResource),
	)

	p.Run()

	p.AssertReleaseCreated(t)
	p.AssertReleaseVariableCount(t, 0, 2)
	p.AssertReleaseVariableEquals(t, 0, "db_host", "db.internal")
	p.AssertReleaseVariableEquals(t, 0, "cache_host", "redis.internal")
}

// ---------------------------------------------------------------------------
// Variable value selector tests
// ---------------------------------------------------------------------------

func TestVariable_ValueSelectorMatches(t *testing.T) {
	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true")),
		WithEnvironment(EnvironmentName("production")),
		WithResource(ResourceName("web-1"), ResourceKind("Server"),
			ResourceMetadata(map[string]any{"region": "us-east"})),
		WithVersion(VersionTag("v1.0.0")),
		WithDeploymentVariable("endpoint",
			DefaultValue("https://default.example.com"),
			WithVariableValue(LiteralValue("https://us-east.example.com"),
				ValueSelector(`resource.metadata["region"] == "us-east"`),
				ValuePriority(10),
			),
		),
	)

	p.Run()

	p.AssertReleaseCreated(t)
	p.AssertReleaseVariableCount(t, 0, 1)
	p.AssertReleaseVariableEquals(t, 0, "endpoint", "https://us-east.example.com")
}

func TestVariable_ValueSelectorDoesNotMatch(t *testing.T) {
	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true")),
		WithEnvironment(EnvironmentName("production")),
		WithResource(ResourceName("web-1"), ResourceKind("Server"),
			ResourceMetadata(map[string]any{"region": "eu-west"})),
		WithVersion(VersionTag("v1.0.0")),
		WithDeploymentVariable("endpoint",
			DefaultValue("https://default.example.com"),
			WithVariableValue(LiteralValue("https://us-east.example.com"),
				ValueSelector(`resource.metadata["region"] == "us-east"`),
				ValuePriority(10),
			),
		),
	)

	p.Run()

	p.AssertReleaseCreated(t)
	p.AssertReleaseVariableCount(t, 0, 1)
	p.AssertReleaseVariableEquals(t, 0, "endpoint", "https://default.example.com")
}

func TestVariable_MultipleValuesWithSelectors_HighestMatchingPriorityWins(t *testing.T) {
	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true")),
		WithEnvironment(EnvironmentName("production")),
		WithResource(ResourceName("web-1"), ResourceKind("Server"),
			ResourceMetadata(map[string]any{"region": "us-east", "tier": "premium"})),
		WithVersion(VersionTag("v1.0.0")),
		WithDeploymentVariable("endpoint",
			DefaultValue("https://default.example.com"),
			WithVariableValue(LiteralValue("https://us-east.example.com"),
				ValueSelector(`resource.metadata["region"] == "us-east"`),
				ValuePriority(10),
			),
			WithVariableValue(LiteralValue("https://premium.us-east.example.com"),
				ValueSelector(`resource.metadata["tier"] == "premium"`),
				ValuePriority(20),
			),
		),
	)

	p.Run()

	p.AssertReleaseCreated(t)
	p.AssertReleaseVariableCount(t, 0, 1)
	p.AssertReleaseVariableEquals(t, 0, "endpoint", "https://premium.us-east.example.com")
}

func TestVariable_SelectorValueOverridesNilSelectorValue(t *testing.T) {
	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true")),
		WithEnvironment(EnvironmentName("production")),
		WithResource(ResourceName("web-1"), ResourceKind("Server"),
			ResourceMetadata(map[string]any{"region": "us-east"})),
		WithVersion(VersionTag("v1.0.0")),
		WithDeploymentVariable("endpoint",
			DefaultValue("https://default.example.com"),
			WithVariableValue(LiteralValue("https://catch-all.example.com"),
				ValuePriority(5),
			),
			WithVariableValue(LiteralValue("https://us-east.example.com"),
				ValueSelector(`resource.metadata["region"] == "us-east"`),
				ValuePriority(10),
			),
		),
	)

	p.Run()

	p.AssertReleaseCreated(t)
	p.AssertReleaseVariableCount(t, 0, 1)
	p.AssertReleaseVariableEquals(t, 0, "endpoint", "https://us-east.example.com")
}

func TestVariable_NilSelectorFallbackWhenSpecificSelectorMisses(t *testing.T) {
	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true")),
		WithEnvironment(EnvironmentName("production")),
		WithResource(ResourceName("web-1"), ResourceKind("Server"),
			ResourceMetadata(map[string]any{"region": "ap-south"})),
		WithVersion(VersionTag("v1.0.0")),
		WithDeploymentVariable("endpoint",
			DefaultValue("https://default.example.com"),
			WithVariableValue(LiteralValue("https://catch-all.example.com"),
				ValuePriority(5),
			),
			WithVariableValue(LiteralValue("https://us-east.example.com"),
				ValueSelector(`resource.metadata["region"] == "us-east"`),
				ValuePriority(10),
			),
		),
	)

	p.Run()

	p.AssertReleaseCreated(t)
	p.AssertReleaseVariableCount(t, 0, 1)
	p.AssertReleaseVariableEquals(t, 0, "endpoint", "https://catch-all.example.com")
}

func TestVariable_KindSelector(t *testing.T) {
	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true")),
		WithEnvironment(EnvironmentName("staging")),
		WithResource(ResourceName("gpu-node"), ResourceKind("GPU")),
		WithVersion(VersionTag("v2.0.0")),
		WithDeploymentVariable("gpu_driver",
			DefaultValue("default-driver"),
			WithVariableValue(LiteralValue("nvidia-525"),
				ValueSelector(`resource.kind == "GPU"`),
				ValuePriority(10),
			),
		),
	)

	p.Run()

	p.AssertReleaseCreated(t)
	p.AssertReleaseVariableCount(t, 0, 1)
	p.AssertReleaseVariableEquals(t, 0, "gpu_driver", "nvidia-525")
}

func TestVariable_NameSelector(t *testing.T) {
	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true")),
		WithEnvironment(EnvironmentName("production")),
		WithResource(ResourceName("canary-node"), ResourceKind("Server")),
		WithVersion(VersionTag("v1.0.0")),
		WithDeploymentVariable("rollout_pct",
			DefaultValue("100"),
			WithVariableValue(LiteralValue("5"),
				ValueSelector(`resource.name == "canary-node"`),
				ValuePriority(10),
			),
		),
	)

	p.Run()

	p.AssertReleaseCreated(t)
	p.AssertReleaseVariableCount(t, 0, 1)
	p.AssertReleaseVariableEquals(t, 0, "rollout_pct", "5")
}

func TestVariable_ResourceVarStillWinsOverMatchingSelector(t *testing.T) {
	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true")),
		WithEnvironment(EnvironmentName("production")),
		WithResource(ResourceName("web-1"), ResourceKind("Server"),
			ResourceMetadata(map[string]any{"region": "us-east"})),
		WithVersion(VersionTag("v1.0.0")),
		WithDeploymentVariable("endpoint",
			DefaultValue("https://default.example.com"),
			WithVariableValue(LiteralValue("https://us-east.example.com"),
				ValueSelector(`resource.metadata["region"] == "us-east"`),
				ValuePriority(10),
			),
		),
		WithResourceVariable("endpoint", LiteralValue("https://pinned.example.com")),
	)

	p.Run()

	p.AssertReleaseCreated(t)
	p.AssertReleaseVariableCount(t, 0, 1)
	p.AssertReleaseVariableEquals(t, 0, "endpoint", "https://pinned.example.com")
}
