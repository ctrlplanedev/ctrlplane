package variableresolver

import (
	"context"
	"fmt"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/relationships/eval"
)

// ---------------------------------------------------------------------------
// mock RelatedEntityResolver (for ResolveValue tests)
// ---------------------------------------------------------------------------

type mockResolver struct {
	related map[string][]*oapi.RelatableEntity
}

func (m *mockResolver) ResolveRelated(
	_ context.Context,
	reference string,
) ([]*oapi.RelatableEntity, error) {
	return m.related[reference], nil
}

// ---------------------------------------------------------------------------
// mock Getter (for Resolve tests)
// ---------------------------------------------------------------------------

type mockGetter struct {
	deploymentVars []oapi.DeploymentVariableWithValues
	resourceVars   map[string][]oapi.ResourceVariable
	variableSets   []oapi.VariableSetWithVariables
	rules          []eval.Rule
	candidates     map[string][]eval.EntityData
}

// defaultOnlyVar synthesizes a DeploymentVariableWithValues whose only value
// is a null-selector, priority-0 literal — the post-migration substitute for
// the dropped `deployment_variable.default_value` column.
func defaultOnlyVar(
	key string,
	lv *oapi.LiteralValue,
	deploymentID string,
) oapi.DeploymentVariableWithValues {
	depVarID := uuid.New().String()
	return oapi.DeploymentVariableWithValues{
		Variable: oapi.DeploymentVariable{
			Id:           depVarID,
			DeploymentId: deploymentID,
			Key:          key,
		},
		Values: []oapi.DeploymentVariableValue{{
			Id:                   uuid.New().String(),
			DeploymentVariableId: depVarID,
			Value:                *oapi.NewValueFromLiteral(lv),
			Priority:             0,
		}},
	}
}

func (m *mockGetter) GetDeploymentVariables(
	_ context.Context,
	_ string,
) ([]oapi.DeploymentVariableWithValues, error) {
	return m.deploymentVars, nil
}

func (m *mockGetter) GetResourceVariables(
	_ context.Context,
	_ string,
) (map[string][]oapi.ResourceVariable, error) {
	return m.resourceVars, nil
}

func (m *mockGetter) GetVariableSetsWithVariables(
	ctx context.Context,
	workspaceID uuid.UUID,
) ([]oapi.VariableSetWithVariables, error) {
	return m.variableSets, nil
}

func (m *mockGetter) GetRelationshipRules(_ context.Context, _ uuid.UUID) ([]eval.Rule, error) {
	return m.rules, nil
}

func (m *mockGetter) LoadCandidates(
	_ context.Context,
	_ uuid.UUID,
	entityType string,
) ([]eval.EntityData, error) {
	return m.candidates[entityType], nil
}

func (m *mockGetter) GetEntityByID(
	_ context.Context,
	entityID uuid.UUID,
	entityType string,
) (*eval.EntityData, error) {
	for i := range m.candidates[entityType] {
		if m.candidates[entityType][i].ID == entityID {
			return &m.candidates[entityType][i], nil
		}
	}
	return nil, fmt.Errorf("%s with id %s not found", entityType, entityID)
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

func makeResourceEntity(res *oapi.Resource) oapi.RelatableEntity {
	e := oapi.RelatableEntity{}
	_ = e.FromResource(*res)
	return e
}

func makeDeploymentEntity(dep *oapi.Deployment) oapi.RelatableEntity {
	e := oapi.RelatableEntity{}
	_ = e.FromDeployment(*dep)
	return e
}

func makeEnvironmentEntity(env *oapi.Environment) oapi.RelatableEntity {
	e := oapi.RelatableEntity{}
	_ = e.FromEnvironment(*env)
	return e
}

// emptyResolver is a no-op resolver used for literal-only tests.
var emptyResolver = &mockResolver{}

// emptyGetter is a no-op getter used for Resolve tests without references.
var emptyGetter = &mockGetter{}

// ---------------------------------------------------------------------------
// ResolveValue tests — literal
// ---------------------------------------------------------------------------

func TestResolveValue_Literal_String(t *testing.T) {
	scope := newScope()
	val := literalStringValue("hello")
	entity := makeResourceEntity(scope.Resource)
	lv, err := ResolveValue(context.Background(), emptyResolver, scope.Resource.Id, &entity, &val)
	require.NoError(t, err)
	s, err := lv.AsStringValue()
	require.NoError(t, err)
	assert.Equal(t, "hello", s)
}

func TestResolveValue_Literal_Int(t *testing.T) {
	scope := newScope()
	val := literalIntValue(42)
	entity := makeResourceEntity(scope.Resource)
	lv, err := ResolveValue(context.Background(), emptyResolver, scope.Resource.Id, &entity, &val)
	require.NoError(t, err)
	i, err := lv.AsIntegerValue()
	require.NoError(t, err)
	assert.Equal(t, 42, int(i))
}

func TestResolveValue_Literal_Bool(t *testing.T) {
	scope := newScope()
	val := literalBoolValue(true)
	entity := makeResourceEntity(scope.Resource)
	lv, err := ResolveValue(context.Background(), emptyResolver, scope.Resource.Id, &entity, &val)
	require.NoError(t, err)
	b, err := lv.AsBooleanValue()
	require.NoError(t, err)
	assert.True(t, bool(b))
}

// ---------------------------------------------------------------------------
// ResolveValue tests — reference
// ---------------------------------------------------------------------------

func TestResolveValue_Reference_ResourceName(t *testing.T) {
	scope := newScope()
	entity := makeResourceEntity(scope.Resource)
	relatedResource := &oapi.Resource{
		Id:          uuid.New().String(),
		Name:        "db-server",
		Kind:        "Database",
		Version:     "v1",
		Identifier:  "db-server",
		WorkspaceId: scope.Resource.WorkspaceId,
		Metadata:    map[string]string{},
		Config:      map[string]any{},
	}
	relatedEntity := makeResourceEntity(relatedResource)
	resolver := &mockResolver{
		related: map[string][]*oapi.RelatableEntity{
			"database": {&relatedEntity},
		},
	}

	val := referenceValue("database", "name")
	lv, err := ResolveValue(context.Background(), resolver, scope.Resource.Id, &entity, &val)
	require.NoError(t, err)
	s, err := lv.AsStringValue()
	require.NoError(t, err)
	assert.Equal(t, "db-server", s)
}

func TestResolveValue_Reference_ResourceMetadata(t *testing.T) {
	scope := newScope()
	entity := makeResourceEntity(scope.Resource)
	relatedResource := &oapi.Resource{
		Id:          uuid.New().String(),
		Name:        "vpc",
		Kind:        "Network",
		Version:     "v1",
		Identifier:  "vpc",
		WorkspaceId: scope.Resource.WorkspaceId,
		Metadata:    map[string]string{"cidr": "10.0.0.0/16"},
		Config:      map[string]any{},
	}
	relatedEntity := makeResourceEntity(relatedResource)
	resolver := &mockResolver{
		related: map[string][]*oapi.RelatableEntity{
			"network": {&relatedEntity},
		},
	}

	val := referenceValue("network", "metadata", "cidr")
	lv, err := ResolveValue(context.Background(), resolver, scope.Resource.Id, &entity, &val)
	require.NoError(t, err)
	s, err := lv.AsStringValue()
	require.NoError(t, err)
	assert.Equal(t, "10.0.0.0/16", s)
}

func TestResolveValue_Reference_DeploymentName(t *testing.T) {
	scope := newScope()
	entity := makeResourceEntity(scope.Resource)
	relatedDep := &oapi.Deployment{
		Id:   uuid.New().String(),
		Name: "api-service",
		Slug: "api-service",
	}
	relatedEntity := makeDeploymentEntity(relatedDep)
	resolver := &mockResolver{
		related: map[string][]*oapi.RelatableEntity{
			"parent-deployment": {&relatedEntity},
		},
	}

	val := referenceValue("parent-deployment", "name")
	lv, err := ResolveValue(context.Background(), resolver, scope.Resource.Id, &entity, &val)
	require.NoError(t, err)
	s, err := lv.AsStringValue()
	require.NoError(t, err)
	assert.Equal(t, "api-service", s)
}

func TestResolveValue_Reference_EnvironmentName(t *testing.T) {
	scope := newScope()
	entity := makeResourceEntity(scope.Resource)
	relatedEnv := &oapi.Environment{
		Id:   uuid.New().String(),
		Name: "staging",
	}
	relatedEntity := makeEnvironmentEntity(relatedEnv)
	resolver := &mockResolver{
		related: map[string][]*oapi.RelatableEntity{
			"env": {&relatedEntity},
		},
	}

	val := referenceValue("env", "name")
	lv, err := ResolveValue(context.Background(), resolver, scope.Resource.Id, &entity, &val)
	require.NoError(t, err)
	s, err := lv.AsStringValue()
	require.NoError(t, err)
	assert.Equal(t, "staging", s)
}

func TestResolveValue_Reference_NotFound(t *testing.T) {
	scope := newScope()
	entity := makeResourceEntity(scope.Resource)
	val := referenceValue("nonexistent", "name")
	_, err := ResolveValue(context.Background(), emptyResolver, scope.Resource.Id, &entity, &val)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "not found")
}

func TestResolveValue_Reference_BadPath(t *testing.T) {
	scope := newScope()
	entity := makeResourceEntity(scope.Resource)
	relatedResource := &oapi.Resource{
		Id:          uuid.New().String(),
		Name:        "db",
		Kind:        "Database",
		Version:     "v1",
		Identifier:  "db",
		WorkspaceId: scope.Resource.WorkspaceId,
		Metadata:    map[string]string{},
		Config:      map[string]any{},
	}
	relatedEntity := makeResourceEntity(relatedResource)
	resolver := &mockResolver{
		related: map[string][]*oapi.RelatableEntity{
			"database": {&relatedEntity},
		},
	}

	val := referenceValue("database", "metadata", "missing_key")
	_, err := ResolveValue(context.Background(), resolver, scope.Resource.Id, &entity, &val)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "not found")
}

// ---------------------------------------------------------------------------
// Resolve tests — priority: resource var wins
// ---------------------------------------------------------------------------

// TestResolve_ResourceVariableSelectorPriority asserts the post-migration
// behavior: resource variables carry a resource selector + priority, and the
// highest-priority matching value wins over a lower-priority null-selector
// fallback.
func TestResolve_ResourceVariableSelectorPriority(t *testing.T) {
	scope := newScope()
	scope.Resource.Metadata = map[string]string{"region": "us-east-1"}

	matchingSelector := `resource.metadata.region == "us-east-1"`
	depVarID := uuid.New().String()

	getter := &mockGetter{
		deploymentVars: []oapi.DeploymentVariableWithValues{{
			Variable: oapi.DeploymentVariable{
				Id:           depVarID,
				DeploymentId: scope.Deployment.Id,
				Key:          "tier",
			},
			Values: []oapi.DeploymentVariableValue{},
		}},
		resourceVars: map[string][]oapi.ResourceVariable{
			"tier": {
				{
					Key:              "tier",
					ResourceId:       scope.Resource.Id,
					Value:            literalStringValue("fallback"),
					Priority:         0,
					ResourceSelector: nil,
				},
				{
					Key:              "tier",
					ResourceId:       scope.Resource.Id,
					Value:            literalStringValue("winner"),
					Priority:         10,
					ResourceSelector: &matchingSelector,
				},
			},
		},
	}

	resolved, err := Resolve(
		context.Background(),
		getter,
		scope,
		scope.Deployment.Id,
		scope.Resource.Id,
	)
	require.NoError(t, err)
	require.Contains(t, resolved, "tier")
	s, err := resolved["tier"].AsStringValue()
	require.NoError(t, err)
	assert.Equal(t, "winner", s)
}

func TestResolve_ResourceVarWins(t *testing.T) {
	scope := newScope()
	depVarID := uuid.New().String()

	getter := &mockGetter{
		deploymentVars: []oapi.DeploymentVariableWithValues{{
			Variable: oapi.DeploymentVariable{
				Id:           depVarID,
				DeploymentId: scope.Deployment.Id,
				Key:          "region",
			},
			Values: []oapi.DeploymentVariableValue{{
				Id:                   uuid.New().String(),
				DeploymentVariableId: depVarID,
				Value:                literalStringValue("value-region"),
				Priority:             1,
			}},
		}},
		resourceVars: map[string][]oapi.ResourceVariable{
			"region": {{
				Key:        "region",
				ResourceId: scope.Resource.Id,
				Value:      literalStringValue("resource-region"),
			}},
		},
	}

	resolved, err := Resolve(
		context.Background(),
		getter,
		scope,
		scope.Deployment.Id,
		scope.Resource.Id,
	)
	require.NoError(t, err)
	require.Contains(t, resolved, "region")
	s, err := resolved["region"].AsStringValue()
	require.NoError(t, err)
	assert.Equal(t, "resource-region", s)
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
			},
			Values: []oapi.DeploymentVariableValue{{
				Id:                   uuid.New().String(),
				DeploymentVariableId: depVarID,
				Value:                literalStringValue("nginx:latest"),
				Priority:             10,
			}},
		}},
		resourceVars: map[string][]oapi.ResourceVariable{},
	}

	resolved, err := Resolve(
		context.Background(),
		getter,
		scope,
		scope.Deployment.Id,
		scope.Resource.Id,
	)
	require.NoError(t, err)
	require.Contains(t, resolved, "image")
	s, err := resolved["image"].AsStringValue()
	require.NoError(t, err)
	assert.Equal(t, "nginx:latest", s)
}

// ---------------------------------------------------------------------------
// Resolve tests — priority: default value fallback
// ---------------------------------------------------------------------------

func TestResolve_DefaultValueFallback(t *testing.T) {
	scope := newScope()
	depVarID := uuid.New().String()

	getter := &mockGetter{
		deploymentVars: []oapi.DeploymentVariableWithValues{{
			Variable: oapi.DeploymentVariable{
				Id:           depVarID,
				DeploymentId: scope.Deployment.Id,
				Key:          "replicas",
			},
			Values: []oapi.DeploymentVariableValue{{
				Id:                   uuid.New().String(),
				DeploymentVariableId: depVarID,
				Value:                *oapi.NewValueFromLiteral(oapi.NewLiteralValue(3)),
				Priority:             0,
			}},
		}},
		resourceVars: map[string][]oapi.ResourceVariable{},
	}

	resolved, err := Resolve(
		context.Background(),
		getter,
		scope,
		scope.Deployment.Id,
		scope.Resource.Id,
	)
	require.NoError(t, err)
	require.Contains(t, resolved, "replicas")
	i, err := resolved["replicas"].AsIntegerValue()
	require.NoError(t, err)
	assert.Equal(t, 3, i)
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
		resourceVars: map[string][]oapi.ResourceVariable{},
	}

	resolved, err := Resolve(
		context.Background(),
		getter,
		scope,
		scope.Deployment.Id,
		scope.Resource.Id,
	)
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
		resourceVars: map[string][]oapi.ResourceVariable{},
	}

	resolved, err := Resolve(
		context.Background(),
		getter,
		scope,
		scope.Deployment.Id,
		scope.Resource.Id,
	)
	require.NoError(t, err)
	s, err := resolved["image"].AsStringValue()
	require.NoError(t, err)
	assert.Equal(t, "high-priority", s)
}

// ---------------------------------------------------------------------------
// Resolve tests — multiple variables resolved together
// ---------------------------------------------------------------------------

func TestResolve_MultipleVariables(t *testing.T) {
	scope := newScope()

	getter := &mockGetter{
		deploymentVars: []oapi.DeploymentVariableWithValues{
			defaultOnlyVar("region", oapi.NewLiteralValue("us-west-2"), scope.Deployment.Id),
			defaultOnlyVar("replicas", oapi.NewLiteralValue(2), scope.Deployment.Id),
			defaultOnlyVar("debug", oapi.NewLiteralValue(false), scope.Deployment.Id),
		},
		resourceVars: map[string][]oapi.ResourceVariable{},
	}

	resolved, err := Resolve(
		context.Background(),
		getter,
		scope,
		scope.Deployment.Id,
		scope.Resource.Id,
	)
	require.NoError(t, err)
	assert.Len(t, resolved, 3)

	s, _ := resolved["region"].AsStringValue()
	assert.Equal(t, "us-west-2", s)

	i, _ := resolved["replicas"].AsIntegerValue()
	assert.Equal(t, 2, i)

	b, _ := resolved["debug"].AsBooleanValue()
	assert.False(t, b)
}

// ---------------------------------------------------------------------------
// Resolve tests — no deployment variables → empty map
// ---------------------------------------------------------------------------

func TestResolve_NoDeploymentVars_EmptyMap(t *testing.T) {
	scope := newScope()

	resolved, err := Resolve(
		context.Background(),
		emptyGetter,
		scope,
		scope.Deployment.Id,
		scope.Resource.Id,
	)
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
	relatedResource := &oapi.Resource{
		Name: "db-server",
		Kind: "Database",
	}

	ruleID := uuid.New()
	getter := &mockGetter{
		deploymentVars: []oapi.DeploymentVariableWithValues{{
			Variable: oapi.DeploymentVariable{
				Id:           uuid.New().String(),
				DeploymentId: scope.Deployment.Id,
				Key:          "db_host",
			},
		}},
		resourceVars: map[string][]oapi.ResourceVariable{
			"db_host": {{
				Key:        "db_host",
				ResourceId: scope.Resource.Id,
				Value:      referenceValue("database", "metadata", "host"),
			}},
		},
		rules: []eval.Rule{
			{
				ID:        ruleID,
				Reference: "database",
				Cel:       `from.type == "resource" && to.type == "resource" && from.kind == "Server" && to.kind == "Database"`,
			},
		},
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
						"config": map[string]any{
							"cpu": "4",
						}, "metadata": map[string]any{"region": "us-east-1"},
					},
				},
				{
					ID:          relatedResourceID,
					WorkspaceID: uuid.MustParse(scope.Resource.WorkspaceId),
					EntityType:  "resource",
					Raw: map[string]any{
						"type":       "resource",
						"id":         relatedResourceID.String(),
						"name":       relatedResource.Name,
						"kind":       relatedResource.Kind,
						"version":    "v1",
						"identifier": "db-server",
						"config":     map[string]any{},
						"metadata":   map[string]any{"host": "db.internal"},
					},
				},
			},
		},
	}

	resolved, err := Resolve(
		context.Background(),
		getter,
		scope,
		scope.Deployment.Id,
		scope.Resource.Id,
	)
	require.NoError(t, err)
	require.Contains(t, resolved, "db_host")
	s, err := resolved["db_host"].AsStringValue()
	require.NoError(t, err)
	assert.Equal(t, "db.internal", s)
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
		resourceVars: map[string][]oapi.ResourceVariable{},
		rules: []eval.Rule{
			{
				ID:        ruleID,
				Reference: "cluster",
				Cel:       `from.type == "resource" && to.type == "resource" && from.kind == "Server" && to.kind == "Cluster"`,
			},
		},
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
						"config": map[string]any{
							"cpu": "4",
						}, "metadata": map[string]any{"region": "us-east-1"},
					},
				},
				{
					ID:          relatedResourceID,
					WorkspaceID: uuid.MustParse(scope.Resource.WorkspaceId),
					EntityType:  "resource",
					Raw: map[string]any{
						"type":       "resource",
						"id":         relatedResourceID.String(),
						"name":       "cluster",
						"kind":       "Cluster",
						"version":    "v1",
						"identifier": "cluster",
						"config":     map[string]any{},
						"metadata":   map[string]any{"endpoint": "https://k8s.internal"},
					},
				},
			},
		},
	}

	resolved, err := Resolve(
		context.Background(),
		getter,
		scope,
		scope.Deployment.Id,
		scope.Resource.Id,
	)
	require.NoError(t, err)
	require.Contains(t, resolved, "cluster_endpoint")
	s, err := resolved["cluster_endpoint"].AsStringValue()
	require.NoError(t, err)
	assert.Equal(t, "https://k8s.internal", s)
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
		resourceVars: map[string][]oapi.ResourceVariable{},
		rules: []eval.Rule{
			{
				ID:        ruleID,
				Reference: "vpc",
				Cel:       `from.type == "resource" && to.type == "resource" && from.kind == "Server" && to.kind == "Network"`,
			},
		},
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
						"config": map[string]any{
							"cpu": "4",
						}, "metadata": map[string]any{"region": "us-east-1"},
					},
				},
				{
					ID:          relatedResourceID,
					WorkspaceID: uuid.MustParse(scope.Resource.WorkspaceId),
					EntityType:  "resource",
					Raw: map[string]any{
						"type":       "resource",
						"id":         relatedResourceID.String(),
						"name":       "vpc",
						"kind":       "Network",
						"version":    "v1",
						"identifier": "vpc",
						"config":     map[string]any{},
						"metadata":   map[string]any{"cidr": "10.0.0.0/8"},
					},
				},
			},
		},
	}

	resolved, err := Resolve(
		context.Background(),
		getter,
		scope,
		scope.Deployment.Id,
		scope.Resource.Id,
	)
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
		resourceVars: map[string][]oapi.ResourceVariable{
			"db_host": {{
				Key:        "db_host",
				ResourceId: scope.Resource.Id,
				Value:      referenceValue("nonexistent_ref", "name"),
			}},
		},
		rules: []eval.Rule{},
	}

	resolved, err := Resolve(
		context.Background(),
		getter,
		scope,
		scope.Deployment.Id,
		scope.Resource.Id,
	)
	require.NoError(t, err)
	require.Contains(t, resolved, "db_host")
	s, err := resolved["db_host"].AsStringValue()
	require.NoError(t, err)
	assert.Equal(t, "fallback-host", string(s))
}

// ---------------------------------------------------------------------------
// Resolve tests — reference to resource config (nested path)
// ---------------------------------------------------------------------------

func TestResolveValue_Reference_ResourceConfig(t *testing.T) {
	scope := newScope()
	scope.Resource.Config = map[string]any{
		"networking": map[string]any{
			"vpc_id": "vpc-12345",
		},
	}
	entity := makeResourceEntity(scope.Resource)
	relatedEntity := makeResourceEntity(scope.Resource)
	resolver := &mockResolver{
		related: map[string][]*oapi.RelatableEntity{
			"self": {&relatedEntity},
		},
	}

	val := referenceValue("self", "config", "networking", "vpc_id")
	lv, err := ResolveValue(context.Background(), resolver, scope.Resource.Id, &entity, &val)
	require.NoError(t, err)
	s, err := lv.AsStringValue()
	require.NoError(t, err)
	assert.Equal(t, "vpc-12345", s)
}

// ---------------------------------------------------------------------------
// Resolve tests — sensitive value returns error
// ---------------------------------------------------------------------------

func TestResolveValue_Sensitive_ReturnsError(t *testing.T) {
	scope := newScope()
	v := &oapi.Value{}
	_ = v.FromSensitiveValue(oapi.SensitiveValue{ValueHash: "abc123"})

	entity := makeResourceEntity(scope.Resource)
	_, err := ResolveValue(context.Background(), emptyResolver, scope.Resource.Id, &entity, v)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "sensitive")
}

// ---------------------------------------------------------------------------
// helpers — variable sets
// ---------------------------------------------------------------------------

func makeVariableSet(
	name, selector string,
	priority int64,
	vars map[string]string,
) oapi.VariableSetWithVariables {
	vsID := uuid.New()
	variables := make([]oapi.VariableSetVariable, 0, len(vars))
	for k, val := range vars {
		variables = append(variables, oapi.VariableSetVariable{
			Id:            uuid.New(),
			VariableSetId: vsID,
			Key:           k,
			Value:         literalStringValue(val),
		})
	}
	return oapi.VariableSetWithVariables{
		Id:        vsID,
		Name:      name,
		Selector:  selector,
		Priority:  priority,
		Variables: variables,
	}
}

// ---------------------------------------------------------------------------
// Variable Set tests — simple injection
// ---------------------------------------------------------------------------

func TestResolve_VariableSet_SimpleInjection(t *testing.T) {
	scope := newScope()
	scope.Resource.Metadata = map[string]string{"env": "production"}

	getter := &mockGetter{
		deploymentVars: []oapi.DeploymentVariableWithValues{{
			Variable: oapi.DeploymentVariable{
				Id:           uuid.New().String(),
				DeploymentId: scope.Deployment.Id,
				Key:          "log_level",
			},
			Values: []oapi.DeploymentVariableValue{},
		}},
		resourceVars: map[string][]oapi.ResourceVariable{},
		variableSets: []oapi.VariableSetWithVariables{
			makeVariableSet(
				"prod-defaults",
				`resource.metadata.env == "production"`,
				1,
				map[string]string{
					"log_level": "warn",
				},
			),
		},
	}

	resolved, err := Resolve(
		context.Background(),
		getter,
		scope,
		scope.Deployment.Id,
		scope.Resource.Id,
	)
	require.NoError(t, err)
	require.Contains(t, resolved, "log_level")
	s, err := resolved["log_level"].AsStringValue()
	require.NoError(t, err)
	assert.Equal(t, "warn", s)
}

// ---------------------------------------------------------------------------
// Variable Set tests — does not overwrite resource variable
// ---------------------------------------------------------------------------

func TestResolve_VariableSet_DoesNotOverwriteResourceVar(t *testing.T) {
	scope := newScope()
	scope.Resource.Metadata = map[string]string{"env": "production"}

	getter := &mockGetter{
		deploymentVars: []oapi.DeploymentVariableWithValues{{
			Variable: oapi.DeploymentVariable{
				Id:           uuid.New().String(),
				DeploymentId: scope.Deployment.Id,
				Key:          "log_level",
			},
			Values: []oapi.DeploymentVariableValue{},
		}},
		resourceVars: map[string][]oapi.ResourceVariable{
			"log_level": {{
				Key:        "log_level",
				ResourceId: scope.Resource.Id,
				Value:      literalStringValue("debug"),
			}},
		},
		variableSets: []oapi.VariableSetWithVariables{
			makeVariableSet(
				"prod-defaults",
				`resource.metadata.env == "production"`,
				1,
				map[string]string{
					"log_level": "warn",
				},
			),
		},
	}

	resolved, err := Resolve(
		context.Background(),
		getter,
		scope,
		scope.Deployment.Id,
		scope.Resource.Id,
	)
	require.NoError(t, err)
	require.Contains(t, resolved, "log_level")
	s, err := resolved["log_level"].AsStringValue()
	require.NoError(t, err)
	assert.Equal(t, "debug", s)
}

// ---------------------------------------------------------------------------
// Variable Set tests — does not overwrite deployment variable value
// ---------------------------------------------------------------------------

func TestResolve_VariableSet_DoesNotOverwriteDeploymentVarValue(t *testing.T) {
	scope := newScope()
	scope.Resource.Metadata = map[string]string{"env": "production"}
	depVarID := uuid.New().String()

	getter := &mockGetter{
		deploymentVars: []oapi.DeploymentVariableWithValues{{
			Variable: oapi.DeploymentVariable{
				Id:           depVarID,
				DeploymentId: scope.Deployment.Id,
				Key:          "log_level",
			},
			Values: []oapi.DeploymentVariableValue{{
				Id:                   uuid.New().String(),
				DeploymentVariableId: depVarID,
				Value:                literalStringValue("info"),
				Priority:             1,
			}},
		}},
		resourceVars: map[string][]oapi.ResourceVariable{},
		variableSets: []oapi.VariableSetWithVariables{
			makeVariableSet(
				"prod-defaults",
				`resource.metadata.env == "production"`,
				1,
				map[string]string{
					"log_level": "warn",
				},
			),
		},
	}

	resolved, err := Resolve(
		context.Background(),
		getter,
		scope,
		scope.Deployment.Id,
		scope.Resource.Id,
	)
	require.NoError(t, err)
	require.Contains(t, resolved, "log_level")
	s, err := resolved["log_level"].AsStringValue()
	require.NoError(t, err)
	assert.Equal(t, "info", s)
}

// ---------------------------------------------------------------------------
// Variable Set tests — multiple sets, highest priority wins
// ---------------------------------------------------------------------------

func TestResolve_VariableSet_HighestPriorityWins(t *testing.T) {
	scope := newScope()
	scope.Resource.Metadata = map[string]string{"env": "production"}

	getter := &mockGetter{
		deploymentVars: []oapi.DeploymentVariableWithValues{{
			Variable: oapi.DeploymentVariable{
				Id:           uuid.New().String(),
				DeploymentId: scope.Deployment.Id,
				Key:          "log_level",
			},
			Values: []oapi.DeploymentVariableValue{},
		}},
		resourceVars: map[string][]oapi.ResourceVariable{},
		variableSets: []oapi.VariableSetWithVariables{
			makeVariableSet(
				"low-priority",
				`resource.metadata.env == "production"`,
				1,
				map[string]string{
					"log_level": "trace",
				},
			),
			makeVariableSet(
				"high-priority",
				`resource.metadata.env == "production"`,
				100,
				map[string]string{
					"log_level": "error",
				},
			),
			makeVariableSet(
				"medium-priority",
				`resource.metadata.env == "production"`,
				50,
				map[string]string{
					"log_level": "info",
				},
			),
		},
	}

	resolved, err := Resolve(
		context.Background(),
		getter,
		scope,
		scope.Deployment.Id,
		scope.Resource.Id,
	)
	require.NoError(t, err)
	require.Contains(t, resolved, "log_level")
	s, err := resolved["log_level"].AsStringValue()
	require.NoError(t, err)
	assert.Equal(t, "error", s)
}

// ---------------------------------------------------------------------------
// Variable Set tests — unrelated sets do not match
// ---------------------------------------------------------------------------

func TestResolve_VariableSet_UnrelatedDoNotMatch(t *testing.T) {
	scope := newScope()
	scope.Resource.Metadata = map[string]string{"env": "staging"}

	getter := &mockGetter{
		deploymentVars: []oapi.DeploymentVariableWithValues{{
			Variable: oapi.DeploymentVariable{
				Id:           uuid.New().String(),
				DeploymentId: scope.Deployment.Id,
				Key:          "log_level",
			},
			Values: []oapi.DeploymentVariableValue{},
		}},
		resourceVars: map[string][]oapi.ResourceVariable{},
		variableSets: []oapi.VariableSetWithVariables{
			makeVariableSet(
				"prod-only",
				`resource.metadata.env == "production"`,
				1,
				map[string]string{
					"log_level": "warn",
				},
			),
		},
	}

	resolved, err := Resolve(
		context.Background(),
		getter,
		scope,
		scope.Deployment.Id,
		scope.Resource.Id,
	)
	require.NoError(t, err)
	assert.NotContains(t, resolved, "log_level")
}
