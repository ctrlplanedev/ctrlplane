package variableresolver

import (
	"context"
	"testing"

	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/relationships/eval"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ---------------------------------------------------------------------------
// mock Getter
// ---------------------------------------------------------------------------

type mockGetter struct {
	deploymentVars []oapi.DeploymentVariableWithValues
	resourceVars   map[string]oapi.ResourceVariable
	rules          []eval.Rule
	candidates     map[string][]eval.EntityData
}

func (m *mockGetter) GetDeploymentVariables(_ context.Context, _ string) ([]oapi.DeploymentVariableWithValues, error) {
	return m.deploymentVars, nil
}
func (m *mockGetter) GetResourceVariables(_ context.Context, _ string) (map[string]oapi.ResourceVariable, error) {
	return m.resourceVars, nil
}
func (m *mockGetter) GetRelationshipRules(_ context.Context, _ uuid.UUID) ([]eval.Rule, error) {
	return m.rules, nil
}
func (m *mockGetter) LoadCandidates(_ context.Context, _ uuid.UUID, entityType string) ([]eval.EntityData, error) {
	return m.candidates[entityType], nil
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

func newScope() *Scope {
	return &Scope{
		Resource: &oapi.Resource{
			Id:          uuid.New().String(),
			Name:        "test-resource",
			Kind:        "Server",
			Version:     "v1",
			Identifier:  "test-resource",
			WorkspaceId: uuid.New().String(),
			Metadata:    map[string]string{"region": "us-east-1"},
			Config:      map[string]any{"cpu": "4"},
		},
		Deployment: &oapi.Deployment{
			Id:   uuid.New().String(),
			Name: "test-deployment",
			Slug: "test-deployment",
		},
		Environment: &oapi.Environment{
			Id:   uuid.New().String(),
			Name: "production",
		},
	}
}

func literalStringValue(s string) oapi.Value {
	lv := oapi.NewLiteralValue(s)
	v := oapi.NewValueFromLiteral(lv)
	return *v
}

func literalIntValue(i int) oapi.Value {
	lv := oapi.NewLiteralValue(i)
	v := oapi.NewValueFromLiteral(lv)
	return *v
}

func literalBoolValue(b bool) oapi.Value {
	lv := oapi.NewLiteralValue(b)
	v := oapi.NewValueFromLiteral(lv)
	return *v
}

func referenceValue(ref string, path ...string) oapi.Value {
	v := &oapi.Value{}
	_ = v.FromReferenceValue(oapi.ReferenceValue{
		Reference: ref,
		Path:      path,
	})
	return *v
}

// mockLookup builds a relatedLookup from a map of reference → entity data.
func mockLookup(related map[string]*eval.EntityData) relatedLookup {
	return func(_ context.Context, reference string) (*eval.EntityData, error) {
		return related[reference], nil
	}
}

// noopLookup is a lookup that always returns nil (for literal-only tests).
var noopLookup relatedLookup = func(_ context.Context, _ string) (*eval.EntityData, error) {
	return nil, nil
}

// emptyGetter is a no-op getter used for Resolve tests without references.
var emptyGetter = &mockGetter{}

// ---------------------------------------------------------------------------
// resolveValue tests — literal
// ---------------------------------------------------------------------------

func TestResolveValue_Literal_String(t *testing.T) {
	val := literalStringValue("hello")
	lv, err := resolveValue(context.Background(), noopLookup, &val)
	require.NoError(t, err)
	s, err := lv.AsStringValue()
	require.NoError(t, err)
	assert.Equal(t, "hello", string(s))
}

func TestResolveValue_Literal_Int(t *testing.T) {
	val := literalIntValue(42)
	lv, err := resolveValue(context.Background(), noopLookup, &val)
	require.NoError(t, err)
	i, err := lv.AsIntegerValue()
	require.NoError(t, err)
	assert.Equal(t, 42, int(i))
}

func TestResolveValue_Literal_Bool(t *testing.T) {
	val := literalBoolValue(true)
	lv, err := resolveValue(context.Background(), noopLookup, &val)
	require.NoError(t, err)
	b, err := lv.AsBooleanValue()
	require.NoError(t, err)
	assert.True(t, bool(b))
}

// ---------------------------------------------------------------------------
// resolveValue tests — reference
// ---------------------------------------------------------------------------

func TestResolveValue_Reference_ResourceName(t *testing.T) {
	lookup := mockLookup(map[string]*eval.EntityData{
		"database": {
			ID: uuid.New(), EntityType: "resource",
			Raw: map[string]any{"name": "db-server", "kind": "Database"},
		},
	})

	val := referenceValue("database", "name")
	lv, err := resolveValue(context.Background(), lookup, &val)
	require.NoError(t, err)
	s, err := lv.AsStringValue()
	require.NoError(t, err)
	assert.Equal(t, "db-server", string(s))
}

func TestResolveValue_Reference_ResourceMetadata(t *testing.T) {
	lookup := mockLookup(map[string]*eval.EntityData{
		"network": {
			ID: uuid.New(), EntityType: "resource",
			Raw: map[string]any{
				"name":     "vpc",
				"metadata": map[string]any{"cidr": "10.0.0.0/16"},
			},
		},
	})

	val := referenceValue("network", "metadata", "cidr")
	lv, err := resolveValue(context.Background(), lookup, &val)
	require.NoError(t, err)
	s, err := lv.AsStringValue()
	require.NoError(t, err)
	assert.Equal(t, "10.0.0.0/16", string(s))
}

func TestResolveValue_Reference_DeploymentName(t *testing.T) {
	lookup := mockLookup(map[string]*eval.EntityData{
		"parent-deployment": {
			ID: uuid.New(), EntityType: "deployment",
			Raw: map[string]any{"name": "api-service", "slug": "api-service"},
		},
	})

	val := referenceValue("parent-deployment", "name")
	lv, err := resolveValue(context.Background(), lookup, &val)
	require.NoError(t, err)
	s, err := lv.AsStringValue()
	require.NoError(t, err)
	assert.Equal(t, "api-service", string(s))
}

func TestResolveValue_Reference_EnvironmentName(t *testing.T) {
	lookup := mockLookup(map[string]*eval.EntityData{
		"env": {
			ID: uuid.New(), EntityType: "environment",
			Raw: map[string]any{"name": "staging"},
		},
	})

	val := referenceValue("env", "name")
	lv, err := resolveValue(context.Background(), lookup, &val)
	require.NoError(t, err)
	s, err := lv.AsStringValue()
	require.NoError(t, err)
	assert.Equal(t, "staging", string(s))
}

func TestResolveValue_Reference_NotFound(t *testing.T) {
	val := referenceValue("nonexistent", "name")
	lv, err := resolveValue(context.Background(), noopLookup, &val)
	require.NoError(t, err)
	assert.Nil(t, lv, "unresolved reference should return nil so callers fall through")
}

func TestResolveValue_Reference_BadPath(t *testing.T) {
	lookup := mockLookup(map[string]*eval.EntityData{
		"database": {
			ID: uuid.New(), EntityType: "resource",
			Raw: map[string]any{
				"name":     "db",
				"metadata": map[string]any{},
			},
		},
	})

	val := referenceValue("database", "metadata", "missing_key")
	_, err := resolveValue(context.Background(), lookup, &val)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "not found")
}

func TestResolveValue_Reference_NestedConfig(t *testing.T) {
	lookup := mockLookup(map[string]*eval.EntityData{
		"self": {
			ID: uuid.New(), EntityType: "resource",
			Raw: map[string]any{
				"config": map[string]any{
					"networking": map[string]any{"vpc_id": "vpc-12345"},
				},
			},
		},
	})

	val := referenceValue("self", "config", "networking", "vpc_id")
	lv, err := resolveValue(context.Background(), lookup, &val)
	require.NoError(t, err)
	s, err := lv.AsStringValue()
	require.NoError(t, err)
	assert.Equal(t, "vpc-12345", string(s))
}

func TestResolveValue_Sensitive_ReturnsError(t *testing.T) {
	v := &oapi.Value{}
	_ = v.FromSensitiveValue(oapi.SensitiveValue{ValueHash: "abc123"})

	_, err := resolveValue(context.Background(), noopLookup, v)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "sensitive")
}

// ---------------------------------------------------------------------------
// Resolve tests — priority: resource var wins
// ---------------------------------------------------------------------------

func TestResolve_ResourceVarWins(t *testing.T) {
	scope := newScope()
	depVarID := uuid.New().String()

	getter := &mockGetter{
		deploymentVars: []oapi.DeploymentVariableWithValues{{
			Variable: oapi.DeploymentVariable{
				Id:           depVarID,
				DeploymentId: scope.Deployment.Id,
				Key:          "region",
				DefaultValue: oapi.NewLiteralValue("default-region"),
			},
			Values: []oapi.DeploymentVariableValue{{
				Id:                   uuid.New().String(),
				DeploymentVariableId: depVarID,
				Value:                literalStringValue("value-region"),
				Priority:             1,
			}},
		}},
		resourceVars: map[string]oapi.ResourceVariable{
			"region": {
				Key:        "region",
				ResourceId: scope.Resource.Id,
				Value:      literalStringValue("resource-region"),
			},
		},
	}

	resolved, err := Resolve(context.Background(), getter, scope)
	require.NoError(t, err)
	require.Contains(t, resolved, "region")
	s, err := resolved["region"].AsStringValue()
	require.NoError(t, err)
	assert.Equal(t, "resource-region", string(s))
}

// ---------------------------------------------------------------------------
// Resolve tests — priority: deployment variable value
// ---------------------------------------------------------------------------

func TestResolve_DeploymentVariableValueUsedWhenNoResourceVar(t *testing.T) {
	scope := newScope()
	depVarID := uuid.New().String()

	getter := &mockGetter{
		deploymentVars: []oapi.DeploymentVariableWithValues{{
			Variable: oapi.DeploymentVariable{
				Id:           depVarID,
				DeploymentId: scope.Deployment.Id,
				Key:          "image",
				DefaultValue: oapi.NewLiteralValue("default-image"),
			},
			Values: []oapi.DeploymentVariableValue{{
				Id:                   uuid.New().String(),
				DeploymentVariableId: depVarID,
				Value:                literalStringValue("nginx:latest"),
				Priority:             10,
			}},
		}},
		resourceVars: map[string]oapi.ResourceVariable{},
	}

	resolved, err := Resolve(context.Background(), getter, scope)
	require.NoError(t, err)
	require.Contains(t, resolved, "image")
	s, err := resolved["image"].AsStringValue()
	require.NoError(t, err)
	assert.Equal(t, "nginx:latest", string(s))
}

// ---------------------------------------------------------------------------
// Resolve tests — priority: default value fallback
// ---------------------------------------------------------------------------

func TestResolve_DefaultValueFallback(t *testing.T) {
	scope := newScope()

	getter := &mockGetter{
		deploymentVars: []oapi.DeploymentVariableWithValues{{
			Variable: oapi.DeploymentVariable{
				Id:           uuid.New().String(),
				DeploymentId: scope.Deployment.Id,
				Key:          "replicas",
				DefaultValue: oapi.NewLiteralValue(3),
			},
			Values: []oapi.DeploymentVariableValue{},
		}},
		resourceVars: map[string]oapi.ResourceVariable{},
	}

	resolved, err := Resolve(context.Background(), getter, scope)
	require.NoError(t, err)
	require.Contains(t, resolved, "replicas")
	i, err := resolved["replicas"].AsIntegerValue()
	require.NoError(t, err)
	assert.Equal(t, 3, int(i))
}

// ---------------------------------------------------------------------------
// Resolve tests — no default, no match → key absent
// ---------------------------------------------------------------------------

func TestResolve_NoMatchNoDefault_KeyAbsent(t *testing.T) {
	scope := newScope()

	getter := &mockGetter{
		deploymentVars: []oapi.DeploymentVariableWithValues{{
			Variable: oapi.DeploymentVariable{
				Id:           uuid.New().String(),
				DeploymentId: scope.Deployment.Id,
				Key:          "optional",
			},
			Values: []oapi.DeploymentVariableValue{},
		}},
		resourceVars: map[string]oapi.ResourceVariable{},
	}

	resolved, err := Resolve(context.Background(), getter, scope)
	require.NoError(t, err)
	assert.NotContains(t, resolved, "optional")
}

// ---------------------------------------------------------------------------
// Resolve tests — multiple deployment variable values, highest priority wins
// ---------------------------------------------------------------------------

func TestResolve_HighestPriorityValueWins(t *testing.T) {
	scope := newScope()
	depVarID := uuid.New().String()

	getter := &mockGetter{
		deploymentVars: []oapi.DeploymentVariableWithValues{{
			Variable: oapi.DeploymentVariable{
				Id:           depVarID,
				DeploymentId: scope.Deployment.Id,
				Key:          "image",
			},
			Values: []oapi.DeploymentVariableValue{
				{
					Id:                   uuid.New().String(),
					DeploymentVariableId: depVarID,
					Value:                literalStringValue("low-priority"),
					Priority:             1,
				},
				{
					Id:                   uuid.New().String(),
					DeploymentVariableId: depVarID,
					Value:                literalStringValue("high-priority"),
					Priority:             100,
				},
				{
					Id:                   uuid.New().String(),
					DeploymentVariableId: depVarID,
					Value:                literalStringValue("medium-priority"),
					Priority:             50,
				},
			},
		}},
		resourceVars: map[string]oapi.ResourceVariable{},
	}

	resolved, err := Resolve(context.Background(), getter, scope)
	require.NoError(t, err)
	s, err := resolved["image"].AsStringValue()
	require.NoError(t, err)
	assert.Equal(t, "high-priority", string(s))
}

// ---------------------------------------------------------------------------
// Resolve tests — multiple variables resolved together
// ---------------------------------------------------------------------------

func TestResolve_MultipleVariables(t *testing.T) {
	scope := newScope()

	getter := &mockGetter{
		deploymentVars: []oapi.DeploymentVariableWithValues{
			{
				Variable: oapi.DeploymentVariable{
					Id:           uuid.New().String(),
					DeploymentId: scope.Deployment.Id,
					Key:          "region",
					DefaultValue: oapi.NewLiteralValue("us-west-2"),
				},
				Values: []oapi.DeploymentVariableValue{},
			},
			{
				Variable: oapi.DeploymentVariable{
					Id:           uuid.New().String(),
					DeploymentId: scope.Deployment.Id,
					Key:          "replicas",
					DefaultValue: oapi.NewLiteralValue(2),
				},
				Values: []oapi.DeploymentVariableValue{},
			},
			{
				Variable: oapi.DeploymentVariable{
					Id:           uuid.New().String(),
					DeploymentId: scope.Deployment.Id,
					Key:          "debug",
					DefaultValue: oapi.NewLiteralValue(false),
				},
				Values: []oapi.DeploymentVariableValue{},
			},
		},
		resourceVars: map[string]oapi.ResourceVariable{},
	}

	resolved, err := Resolve(context.Background(), getter, scope)
	require.NoError(t, err)
	assert.Len(t, resolved, 3)

	s, _ := resolved["region"].AsStringValue()
	assert.Equal(t, "us-west-2", string(s))

	i, _ := resolved["replicas"].AsIntegerValue()
	assert.Equal(t, 2, int(i))

	b, _ := resolved["debug"].AsBooleanValue()
	assert.False(t, bool(b))
}

// ---------------------------------------------------------------------------
// Resolve tests — no deployment variables → empty map
// ---------------------------------------------------------------------------

func TestResolve_NoDeploymentVars_EmptyMap(t *testing.T) {
	scope := newScope()

	resolved, err := Resolve(context.Background(), emptyGetter, scope)
	require.NoError(t, err)
	assert.Empty(t, resolved)
}

// ---------------------------------------------------------------------------
// Resolve tests — reference variable in resource var (uses realtime eval)
// ---------------------------------------------------------------------------

func TestResolve_ResourceVar_WithReference(t *testing.T) {
	scope := newScope()
	resourceID := uuid.MustParse(scope.Resource.Id)
	relatedResourceID := uuid.New()

	ruleID := uuid.New()
	getter := &mockGetter{
		deploymentVars: []oapi.DeploymentVariableWithValues{{
			Variable: oapi.DeploymentVariable{
				Id:           uuid.New().String(),
				DeploymentId: scope.Deployment.Id,
				Key:          "db_host",
			},
		}},
		resourceVars: map[string]oapi.ResourceVariable{
			"db_host": {
				Key:        "db_host",
				ResourceId: scope.Resource.Id,
				Value:      referenceValue("database", "metadata", "host"),
			},
		},
		rules: []eval.Rule{{
			ID:        ruleID,
			Reference: "database",
			Cel:       `from.type == "resource" && to.type == "resource" && from.kind == "Server" && to.kind == "Database"`,
		}},
		candidates: map[string][]eval.EntityData{
			"resource": {
				{
					ID:          resourceID,
					WorkspaceID: uuid.MustParse(scope.Resource.WorkspaceId),
					EntityType:  "resource",
					Raw: map[string]any{
						"type": "resource", "id": resourceID.String(),
						"name": "test-resource", "kind": "Server",
						"version": "v1", "identifier": "test-resource",
						"config": map[string]any{"cpu": "4"}, "metadata": map[string]any{"region": "us-east-1"},
					},
				},
				{
					ID:          relatedResourceID,
					WorkspaceID: uuid.MustParse(scope.Resource.WorkspaceId),
					EntityType:  "resource",
					Raw: map[string]any{
						"type": "resource", "id": relatedResourceID.String(),
						"name": "db-server", "kind": "Database",
						"version": "v1", "identifier": "db-server",
						"config": map[string]any{}, "metadata": map[string]any{"host": "db.internal"},
					},
				},
			},
		},
	}

	resolved, err := Resolve(context.Background(), getter, scope)
	require.NoError(t, err)
	require.Contains(t, resolved, "db_host")
	s, err := resolved["db_host"].AsStringValue()
	require.NoError(t, err)
	assert.Equal(t, "db.internal", string(s))
}

// ---------------------------------------------------------------------------
// Resolve tests — reference variable in deployment variable value
// ---------------------------------------------------------------------------

func TestResolve_DeploymentVarValue_WithReference(t *testing.T) {
	scope := newScope()
	depVarID := uuid.New().String()
	resourceID := uuid.MustParse(scope.Resource.Id)
	relatedResourceID := uuid.New()

	ruleID := uuid.New()
	getter := &mockGetter{
		deploymentVars: []oapi.DeploymentVariableWithValues{{
			Variable: oapi.DeploymentVariable{
				Id:           depVarID,
				DeploymentId: scope.Deployment.Id,
				Key:          "cluster_endpoint",
			},
			Values: []oapi.DeploymentVariableValue{{
				Id:                   uuid.New().String(),
				DeploymentVariableId: depVarID,
				Value:                referenceValue("cluster", "metadata", "endpoint"),
				Priority:             1,
			}},
		}},
		resourceVars: map[string]oapi.ResourceVariable{},
		rules: []eval.Rule{{
			ID:        ruleID,
			Reference: "cluster",
			Cel:       `from.type == "resource" && to.type == "resource" && from.kind == "Server" && to.kind == "Cluster"`,
		}},
		candidates: map[string][]eval.EntityData{
			"resource": {
				{
					ID:          resourceID,
					WorkspaceID: uuid.MustParse(scope.Resource.WorkspaceId),
					EntityType:  "resource",
					Raw: map[string]any{
						"type": "resource", "id": resourceID.String(),
						"name": "test-resource", "kind": "Server",
						"version": "v1", "identifier": "test-resource",
						"config": map[string]any{"cpu": "4"}, "metadata": map[string]any{"region": "us-east-1"},
					},
				},
				{
					ID:          relatedResourceID,
					WorkspaceID: uuid.MustParse(scope.Resource.WorkspaceId),
					EntityType:  "resource",
					Raw: map[string]any{
						"type": "resource", "id": relatedResourceID.String(),
						"name": "cluster", "kind": "Cluster",
						"version": "v1", "identifier": "cluster",
						"config": map[string]any{}, "metadata": map[string]any{"endpoint": "https://k8s.internal"},
					},
				},
			},
		},
	}

	resolved, err := Resolve(context.Background(), getter, scope)
	require.NoError(t, err)
	require.Contains(t, resolved, "cluster_endpoint")
	s, err := resolved["cluster_endpoint"].AsStringValue()
	require.NoError(t, err)
	assert.Equal(t, "https://k8s.internal", string(s))
}

// ---------------------------------------------------------------------------
// Resolve tests — mixed literal and reference across multiple keys
// ---------------------------------------------------------------------------

func TestResolve_MixedLiteralAndReference(t *testing.T) {
	scope := newScope()
	resourceID := uuid.MustParse(scope.Resource.Id)
	relatedResourceID := uuid.New()
	varID1 := uuid.New().String()
	varID2 := uuid.New().String()

	ruleID := uuid.New()
	getter := &mockGetter{
		deploymentVars: []oapi.DeploymentVariableWithValues{
			{
				Variable: oapi.DeploymentVariable{
					Id:           varID1,
					DeploymentId: scope.Deployment.Id,
					Key:          "image",
				},
				Values: []oapi.DeploymentVariableValue{{
					Id:                   uuid.New().String(),
					DeploymentVariableId: varID1,
					Value:                literalStringValue("myapp:v2"),
					Priority:             1,
				}},
			},
			{
				Variable: oapi.DeploymentVariable{
					Id:           varID2,
					DeploymentId: scope.Deployment.Id,
					Key:          "vpc_cidr",
				},
				Values: []oapi.DeploymentVariableValue{{
					Id:                   uuid.New().String(),
					DeploymentVariableId: varID2,
					Value:                referenceValue("vpc", "metadata", "cidr"),
					Priority:             1,
				}},
			},
		},
		resourceVars: map[string]oapi.ResourceVariable{},
		rules: []eval.Rule{{
			ID:        ruleID,
			Reference: "vpc",
			Cel:       `from.type == "resource" && to.type == "resource" && from.kind == "Server" && to.kind == "Network"`,
		}},
		candidates: map[string][]eval.EntityData{
			"resource": {
				{
					ID:          resourceID,
					WorkspaceID: uuid.MustParse(scope.Resource.WorkspaceId),
					EntityType:  "resource",
					Raw: map[string]any{
						"type": "resource", "id": resourceID.String(),
						"name": "test-resource", "kind": "Server",
						"version": "v1", "identifier": "test-resource",
						"config": map[string]any{"cpu": "4"}, "metadata": map[string]any{"region": "us-east-1"},
					},
				},
				{
					ID:          relatedResourceID,
					WorkspaceID: uuid.MustParse(scope.Resource.WorkspaceId),
					EntityType:  "resource",
					Raw: map[string]any{
						"type": "resource", "id": relatedResourceID.String(),
						"name": "vpc", "kind": "Network",
						"version": "v1", "identifier": "vpc",
						"config": map[string]any{}, "metadata": map[string]any{"cidr": "10.0.0.0/8"},
					},
				},
			},
		},
	}

	resolved, err := Resolve(context.Background(), getter, scope)
	require.NoError(t, err)
	assert.Len(t, resolved, 2)

	img, _ := resolved["image"].AsStringValue()
	assert.Equal(t, "myapp:v2", string(img))

	cidr, _ := resolved["vpc_cidr"].AsStringValue()
	assert.Equal(t, "10.0.0.0/8", string(cidr))
}

// ---------------------------------------------------------------------------
// Resolve tests — resource var reference fails → falls through to value
// ---------------------------------------------------------------------------

func TestResolve_ResourceVarRefFails_FallsToDeploymentValue(t *testing.T) {
	scope := newScope()
	depVarID := uuid.New().String()

	getter := &mockGetter{
		deploymentVars: []oapi.DeploymentVariableWithValues{{
			Variable: oapi.DeploymentVariable{
				Id:           depVarID,
				DeploymentId: scope.Deployment.Id,
				Key:          "db_host",
			},
			Values: []oapi.DeploymentVariableValue{{
				Id:                   uuid.New().String(),
				DeploymentVariableId: depVarID,
				Value:                literalStringValue("fallback-host"),
				Priority:             1,
			}},
		}},
		resourceVars: map[string]oapi.ResourceVariable{
			"db_host": {
				Key:        "db_host",
				ResourceId: scope.Resource.Id,
				Value:      referenceValue("nonexistent_ref", "name"),
			},
		},
		rules: []eval.Rule{},
	}

	resolved, err := Resolve(context.Background(), getter, scope)
	require.NoError(t, err)
	require.Contains(t, resolved, "db_host")
	s, err := resolved["db_host"].AsStringValue()
	require.NoError(t, err)
	assert.Equal(t, "fallback-host", string(s))
}
