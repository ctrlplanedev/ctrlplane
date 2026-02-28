package policymatch

import (
	"context"
	"testing"
	"time"

	"workspace-engine/pkg/oapi"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

func policy(selector string) *oapi.Policy {
	return &oapi.Policy{
		Id:       "policy-1",
		Name:     "test-policy",
		Enabled:  true,
		Selector: selector,
		Rules:    []oapi.PolicyRule{},
		Metadata: map[string]string{},
	}
}

func target() *Target {
	return &Target{
		Resource: &oapi.Resource{
			Id:         "res-1",
			Name:       "prod-node-1",
			Kind:       "Node",
			Identifier: "node-1.prod.example.com",
			Version:    "v1",
			Config:     map[string]any{"cpu": "8"},
			Metadata:   map[string]string{"env": "production", "region": "us-east-1", "tier": "critical"},
			CreatedAt:  time.Now(),
		},
		Deployment: &oapi.Deployment{
			Id:       "dep-1",
			Name:     "web-server",
			Slug:     "web-server",
			Metadata: map[string]string{"team": "platform", "service": "frontend"},
		},
		Environment: &oapi.Environment{
			Id:        "env-1",
			Name:      "production",
			Metadata:  map[string]string{"stage": "prod", "region": "us-east-1"},
			CreatedAt: time.Now(),
		},
	}
}

// ---------------------------------------------------------------------------
// Match – fast-path selectors
// ---------------------------------------------------------------------------

func TestMatch_EmptySelector(t *testing.T) {
	assert.False(t, Match(context.Background(), policy(""), target()))
}

func TestMatch_TrueSelector(t *testing.T) {
	assert.True(t, Match(context.Background(), policy("true"), target()))
}

func TestMatch_FalseSelector(t *testing.T) {
	assert.False(t, Match(context.Background(), policy("false"), target()))
}

// ---------------------------------------------------------------------------
// Match – invalid selectors
// ---------------------------------------------------------------------------

func TestMatch_InvalidCEL(t *testing.T) {
	assert.False(t, Match(context.Background(), policy(">>>invalid<<<"), target()))
}

func TestMatch_SyntaxError(t *testing.T) {
	assert.False(t, Match(context.Background(), policy("resource.name =="), target()))
}

func TestMatch_UndefinedVariable(t *testing.T) {
	assert.False(t, Match(context.Background(), policy("nonexistent.field == true"), target()))
}

// ---------------------------------------------------------------------------
// Match – resource selectors
// ---------------------------------------------------------------------------

func TestMatch_ResourceKind(t *testing.T) {
	ctx := context.Background()
	assert.True(t, Match(ctx, policy(`resource.kind == "Node"`), target()))
	assert.False(t, Match(ctx, policy(`resource.kind == "Pod"`), target()))
}

func TestMatch_ResourceName(t *testing.T) {
	ctx := context.Background()
	assert.True(t, Match(ctx, policy(`resource.name == "prod-node-1"`), target()))
	assert.False(t, Match(ctx, policy(`resource.name == "staging-node-1"`), target()))
}

func TestMatch_ResourceIdentifier(t *testing.T) {
	assert.True(t, Match(context.Background(),
		policy(`resource.identifier == "node-1.prod.example.com"`), target()))
}

func TestMatch_ResourceMetadata(t *testing.T) {
	ctx := context.Background()
	assert.True(t, Match(ctx, policy(`resource.metadata.env == "production"`), target()))
	assert.True(t, Match(ctx, policy(`resource.metadata.region == "us-east-1"`), target()))
	assert.False(t, Match(ctx, policy(`resource.metadata.env == "staging"`), target()))
}

// ---------------------------------------------------------------------------
// Match – deployment selectors
// ---------------------------------------------------------------------------

func TestMatch_DeploymentName(t *testing.T) {
	ctx := context.Background()
	assert.True(t, Match(ctx, policy(`deployment.name == "web-server"`), target()))
	assert.False(t, Match(ctx, policy(`deployment.name == "api-server"`), target()))
}

func TestMatch_DeploymentSlug(t *testing.T) {
	assert.True(t, Match(context.Background(),
		policy(`deployment.slug == "web-server"`), target()))
}

func TestMatch_DeploymentMetadata(t *testing.T) {
	ctx := context.Background()
	assert.True(t, Match(ctx, policy(`deployment.metadata.team == "platform"`), target()))
	assert.False(t, Match(ctx, policy(`deployment.metadata.team == "backend"`), target()))
}

// ---------------------------------------------------------------------------
// Match – environment selectors
// ---------------------------------------------------------------------------

func TestMatch_EnvironmentName(t *testing.T) {
	ctx := context.Background()
	assert.True(t, Match(ctx, policy(`environment.name == "production"`), target()))
	assert.False(t, Match(ctx, policy(`environment.name == "staging"`), target()))
}

func TestMatch_EnvironmentMetadata(t *testing.T) {
	ctx := context.Background()
	assert.True(t, Match(ctx, policy(`environment.metadata.stage == "prod"`), target()))
	assert.False(t, Match(ctx, policy(`environment.metadata.stage == "dev"`), target()))
}

// ---------------------------------------------------------------------------
// Match – cross-entity selectors
// ---------------------------------------------------------------------------

func TestMatch_CrossEntity_ResourceAndDeployment(t *testing.T) {
	assert.True(t, Match(context.Background(),
		policy(`resource.kind == "Node" && deployment.name == "web-server"`), target()))
}

func TestMatch_CrossEntity_AllThree(t *testing.T) {
	assert.True(t, Match(context.Background(),
		policy(`resource.kind == "Node" && deployment.name == "web-server" && environment.name == "production"`),
		target()))
}

func TestMatch_CrossEntity_Mismatch(t *testing.T) {
	assert.False(t, Match(context.Background(),
		policy(`resource.kind == "Node" && environment.name == "staging"`), target()))
}

func TestMatch_CrossEntity_MetadataMatch(t *testing.T) {
	assert.True(t, Match(context.Background(),
		policy(`resource.metadata.region == environment.metadata.region`), target()))
}

// ---------------------------------------------------------------------------
// Match – compound and logical selectors
// ---------------------------------------------------------------------------

func TestMatch_And(t *testing.T) {
	ctx := context.Background()
	assert.True(t, Match(ctx,
		policy(`resource.metadata.env == "production" && resource.metadata.tier == "critical"`),
		target()))
	assert.False(t, Match(ctx,
		policy(`resource.metadata.env == "production" && resource.metadata.tier == "low"`),
		target()))
}

func TestMatch_Or(t *testing.T) {
	ctx := context.Background()
	assert.True(t, Match(ctx,
		policy(`resource.kind == "Pod" || resource.kind == "Node"`), target()))
	assert.False(t, Match(ctx,
		policy(`resource.kind == "Pod" || resource.kind == "Service"`), target()))
}

func TestMatch_Negation(t *testing.T) {
	ctx := context.Background()
	assert.True(t, Match(ctx, policy(`resource.kind != "Pod"`), target()))
	assert.False(t, Match(ctx, policy(`resource.kind != "Node"`), target()))
}

func TestMatch_Not(t *testing.T) {
	ctx := context.Background()
	assert.True(t, Match(ctx, policy(`!(resource.kind == "Pod")`), target()))
	assert.False(t, Match(ctx, policy(`!(resource.kind == "Node")`), target()))
}

// ---------------------------------------------------------------------------
// Match – string operations
// ---------------------------------------------------------------------------

func TestMatch_StartsWith(t *testing.T) {
	ctx := context.Background()
	assert.True(t, Match(ctx, policy(`resource.name.startsWith("prod-")`), target()))
	assert.False(t, Match(ctx, policy(`resource.name.startsWith("staging-")`), target()))
}

func TestMatch_EndsWith(t *testing.T) {
	ctx := context.Background()
	assert.True(t, Match(ctx, policy(`resource.name.endsWith("-1")`), target()))
	assert.False(t, Match(ctx, policy(`resource.name.endsWith("-2")`), target()))
}

func TestMatch_Contains(t *testing.T) {
	ctx := context.Background()
	assert.True(t, Match(ctx, policy(`resource.name.contains("node")`), target()))
	assert.False(t, Match(ctx, policy(`resource.name.contains("pod")`), target()))
}

// ---------------------------------------------------------------------------
// Match – in operator
// ---------------------------------------------------------------------------

func TestMatch_InList(t *testing.T) {
	ctx := context.Background()
	assert.True(t, Match(ctx,
		policy(`resource.metadata.env in ["production", "staging"]`), target()))
	assert.False(t, Match(ctx,
		policy(`resource.metadata.env in ["dev", "staging"]`), target()))
}

// ---------------------------------------------------------------------------
// Match – nil entity fields
// ---------------------------------------------------------------------------

func TestMatch_NilResource(t *testing.T) {
	tgt := target()
	tgt.Resource = nil
	assert.False(t, Match(context.Background(),
		policy(`resource.kind == "Node"`), tgt))
}

func TestMatch_NilDeployment(t *testing.T) {
	tgt := target()
	tgt.Deployment = nil
	assert.False(t, Match(context.Background(),
		policy(`deployment.name == "web-server"`), tgt))
}

func TestMatch_NilEnvironment(t *testing.T) {
	tgt := target()
	tgt.Environment = nil
	assert.False(t, Match(context.Background(),
		policy(`environment.name == "production"`), tgt))
}

func TestMatch_NilResource_TrueSelector(t *testing.T) {
	tgt := target()
	tgt.Resource = nil
	assert.True(t, Match(context.Background(), policy("true"), tgt))
}

func TestMatch_AllNil_TrueSelector(t *testing.T) {
	tgt := &Target{}
	assert.True(t, Match(context.Background(), policy("true"), tgt))
}

// ---------------------------------------------------------------------------
// Match – metadata edge cases
// ---------------------------------------------------------------------------

func TestMatch_MissingMetadataKey(t *testing.T) {
	assert.False(t, Match(context.Background(),
		policy(`resource.metadata.nonexistent == "value"`), target()))
}

func TestMatch_EmptyMetadata(t *testing.T) {
	tgt := target()
	tgt.Resource.Metadata = map[string]string{}
	assert.False(t, Match(context.Background(),
		policy(`resource.metadata.env == "production"`), tgt))
}

func TestMatch_MetadataSpecialCharacters(t *testing.T) {
	tgt := target()
	tgt.Deployment.Metadata["app/version"] = "v2.1.0"
	assert.True(t, Match(context.Background(),
		policy(`deployment.metadata["app/version"] == "v2.1.0"`), tgt))
}

// ---------------------------------------------------------------------------
// Target – CEL context caching
// ---------------------------------------------------------------------------

func TestTarget_CelContextCached(t *testing.T) {
	tgt := target()
	ctx1 := tgt.celContext()
	ctx1["_sentinel"] = true
	ctx2 := tgt.celContext()
	assert.True(t, ctx2["_sentinel"].(bool), "celContext should return the same cached map")
}

// ---------------------------------------------------------------------------
// Filter
// ---------------------------------------------------------------------------

func TestFilter_EmptyPolicies(t *testing.T) {
	result := Filter(context.Background(), nil, target())
	assert.Empty(t, result)
}

func TestFilter_EmptySlice(t *testing.T) {
	result := Filter(context.Background(), []*oapi.Policy{}, target())
	assert.Empty(t, result)
}

func TestFilter_NilPoliciesSkipped(t *testing.T) {
	policies := []*oapi.Policy{nil, policy("true"), nil}
	result := Filter(context.Background(), policies, target())
	require.Len(t, result, 1)
	assert.Equal(t, "true", result[0].Selector)
}

func TestFilter_AllMatch(t *testing.T) {
	policies := []*oapi.Policy{
		policy("true"),
		policy(`resource.kind == "Node"`),
		policy(`environment.name == "production"`),
	}
	result := Filter(context.Background(), policies, target())
	assert.Len(t, result, 3)
}

func TestFilter_NoneMatch(t *testing.T) {
	policies := []*oapi.Policy{
		policy("false"),
		policy(`resource.kind == "Pod"`),
		policy(`environment.name == "staging"`),
	}
	result := Filter(context.Background(), policies, target())
	assert.Empty(t, result)
}

func TestFilter_MixedMatches(t *testing.T) {
	p1 := policy("true")
	p1.Id = "match-1"
	p2 := policy("false")
	p2.Id = "no-match"
	p3 := policy(`resource.kind == "Node"`)
	p3.Id = "match-2"
	p4 := policy(`deployment.name == "api-server"`)
	p4.Id = "no-match-2"

	policies := []*oapi.Policy{p1, p2, p3, p4}
	result := Filter(context.Background(), policies, target())
	require.Len(t, result, 2)
	assert.Equal(t, "match-1", result[0].Id)
	assert.Equal(t, "match-2", result[1].Id)
}

func TestFilter_PreservesOrder(t *testing.T) {
	p1 := policy(`resource.kind == "Node"`)
	p1.Id = "first"
	p1.Priority = 10
	p2 := policy(`deployment.name == "web-server"`)
	p2.Id = "second"
	p2.Priority = 5
	p3 := policy("true")
	p3.Id = "third"
	p3.Priority = 1

	result := Filter(context.Background(), []*oapi.Policy{p1, p2, p3}, target())
	require.Len(t, result, 3)
	assert.Equal(t, "first", result[0].Id)
	assert.Equal(t, "second", result[1].Id)
	assert.Equal(t, "third", result[2].Id)
}

func TestFilter_InvalidSelectorsExcluded(t *testing.T) {
	policies := []*oapi.Policy{
		policy("true"),
		policy(">>>bad<<<"),
		policy(`resource.kind == "Node"`),
	}
	result := Filter(context.Background(), policies, target())
	assert.Len(t, result, 2)
}

func TestFilter_EmptySelectorsExcluded(t *testing.T) {
	policies := []*oapi.Policy{
		policy("true"),
		policy(""),
		policy(`resource.kind == "Node"`),
	}
	result := Filter(context.Background(), policies, target())
	assert.Len(t, result, 2)
}

// ---------------------------------------------------------------------------
// Filter – complex real-world scenarios
// ---------------------------------------------------------------------------

func TestFilter_ProductionNodePolicy(t *testing.T) {
	prodNodes := policy(`resource.kind == "Node" && resource.metadata.env == "production"`)
	prodNodes.Id = "prod-nodes"
	stagingOnly := policy(`environment.name == "staging"`)
	stagingOnly.Id = "staging-only"
	allTargets := policy("true")
	allTargets.Id = "catch-all"

	result := Filter(context.Background(),
		[]*oapi.Policy{prodNodes, stagingOnly, allTargets}, target())
	require.Len(t, result, 2)
	assert.Equal(t, "prod-nodes", result[0].Id)
	assert.Equal(t, "catch-all", result[1].Id)
}

func TestFilter_TeamScopedPolicy(t *testing.T) {
	platformTeam := policy(`deployment.metadata.team == "platform" && environment.metadata.stage == "prod"`)
	platformTeam.Id = "platform-prod"
	backendTeam := policy(`deployment.metadata.team == "backend"`)
	backendTeam.Id = "backend"

	result := Filter(context.Background(),
		[]*oapi.Policy{platformTeam, backendTeam}, target())
	require.Len(t, result, 1)
	assert.Equal(t, "platform-prod", result[0].Id)
}
