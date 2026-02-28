package variableresolver

import (
	"context"
	"testing"

	"workspace-engine/pkg/oapi"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ---------------------------------------------------------------------------
// mock getter
// ---------------------------------------------------------------------------

type mockGetter struct {
	deploymentVars []oapi.DeploymentVariableWithValues
	resourceVars   map[string]oapi.ResourceVariable
	relatedEntity  map[string][]*oapi.EntityRelation
}

func (m *mockGetter) GetDeploymentVariables(_ context.Context, _ string) ([]oapi.DeploymentVariableWithValues, error) {
	return m.deploymentVars, nil
}
func (m *mockGetter) GetResourceVariables(_ context.Context, _ string) (map[string]oapi.ResourceVariable, error) {
	return m.resourceVars, nil
}
func (m *mockGetter) GetRelatedEntity(_ context.Context, _, reference string) ([]*oapi.EntityRelation, error) {
	return m.relatedEntity[reference], nil
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

// emptyGetter is a no-op getter used for literal-only tests.
var emptyGetter = &mockGetter{}

// ---------------------------------------------------------------------------
// ResolveValue tests — literal
// ---------------------------------------------------------------------------

func TestResolveValue_Literal_String(t *testing.T) {
	scope := newScope()
	val := literalStringValue("hello")
	entity := makeResourceEntity(scope.Resource)
	lv, err := ResolveValue(context.Background(), emptyGetter, scope.Resource.Id, &entity, &val)
	require.NoError(t, err)
	s, err := lv.AsStringValue()
	require.NoError(t, err)
	assert.Equal(t, "hello", string(s))
}

func TestResolveValue_Literal_Int(t *testing.T) {
	scope := newScope()
	val := literalIntValue(42)
	entity := makeResourceEntity(scope.Resource)
	lv, err := ResolveValue(context.Background(), emptyGetter, scope.Resource.Id, &entity, &val)
	require.NoError(t, err)
	i, err := lv.AsIntegerValue()
	require.NoError(t, err)
	assert.Equal(t, 42, int(i))
}

func TestResolveValue_Literal_Bool(t *testing.T) {
	scope := newScope()
	val := literalBoolValue(true)
	entity := makeResourceEntity(scope.Resource)
	lv, err := ResolveValue(context.Background(), emptyGetter, scope.Resource.Id, &entity, &val)
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
	getter := &mockGetter{
		relatedEntity: map[string][]*oapi.EntityRelation{
			"database": {{Entity: relatedEntity, EntityId: relatedResource.Id}},
		},
	}

	val := referenceValue("database", "name")
	lv, err := ResolveValue(context.Background(), getter, scope.Resource.Id, &entity, &val)
	require.NoError(t, err)
	s, err := lv.AsStringValue()
	require.NoError(t, err)
	assert.Equal(t, "db-server", string(s))
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
	getter := &mockGetter{
		relatedEntity: map[string][]*oapi.EntityRelation{
			"network": {{Entity: relatedEntity, EntityId: relatedResource.Id}},
		},
	}

	val := referenceValue("network", "metadata", "cidr")
	lv, err := ResolveValue(context.Background(), getter, scope.Resource.Id, &entity, &val)
	require.NoError(t, err)
	s, err := lv.AsStringValue()
	require.NoError(t, err)
	assert.Equal(t, "10.0.0.0/16", string(s))
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
	getter := &mockGetter{
		relatedEntity: map[string][]*oapi.EntityRelation{
			"parent-deployment": {{Entity: relatedEntity, EntityId: relatedDep.Id}},
		},
	}

	val := referenceValue("parent-deployment", "name")
	lv, err := ResolveValue(context.Background(), getter, scope.Resource.Id, &entity, &val)
	require.NoError(t, err)
	s, err := lv.AsStringValue()
	require.NoError(t, err)
	assert.Equal(t, "api-service", string(s))
}

func TestResolveValue_Reference_EnvironmentName(t *testing.T) {
	scope := newScope()
	entity := makeResourceEntity(scope.Resource)
	relatedEnv := &oapi.Environment{
		Id:   uuid.New().String(),
		Name: "staging",
	}
	relatedEntity := makeEnvironmentEntity(relatedEnv)
	getter := &mockGetter{
		relatedEntity: map[string][]*oapi.EntityRelation{
			"env": {{Entity: relatedEntity, EntityId: relatedEnv.Id}},
		},
	}

	val := referenceValue("env", "name")
	lv, err := ResolveValue(context.Background(), getter, scope.Resource.Id, &entity, &val)
	require.NoError(t, err)
	s, err := lv.AsStringValue()
	require.NoError(t, err)
	assert.Equal(t, "staging", string(s))
}

func TestResolveValue_Reference_NotFound(t *testing.T) {
	scope := newScope()
	entity := makeResourceEntity(scope.Resource)
	val := referenceValue("nonexistent", "name")
	_, err := ResolveValue(context.Background(), emptyGetter, scope.Resource.Id, &entity, &val)
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
	getter := &mockGetter{
		relatedEntity: map[string][]*oapi.EntityRelation{
			"database": {{Entity: relatedEntity, EntityId: relatedResource.Id}},
		},
	}

	val := referenceValue("database", "metadata", "missing_key")
	_, err := ResolveValue(context.Background(), getter, scope.Resource.Id, &entity, &val)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "not found")
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

	resolved, err := Resolve(context.Background(), getter, scope, scope.Deployment.Id, scope.Resource.Id)
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

	resolved, err := Resolve(context.Background(), getter, scope, scope.Deployment.Id, scope.Resource.Id)
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

	resolved, err := Resolve(context.Background(), getter, scope, scope.Deployment.Id, scope.Resource.Id)
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

	resolved, err := Resolve(context.Background(), getter, scope, scope.Deployment.Id, scope.Resource.Id)
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

	resolved, err := Resolve(context.Background(), getter, scope, scope.Deployment.Id, scope.Resource.Id)
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

	resolved, err := Resolve(context.Background(), getter, scope, scope.Deployment.Id, scope.Resource.Id)
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

	resolved, err := Resolve(context.Background(), emptyGetter, scope, scope.Deployment.Id, scope.Resource.Id)
	require.NoError(t, err)
	assert.Empty(t, resolved)
}

// ---------------------------------------------------------------------------
// Resolve tests — reference variable in resource var
// ---------------------------------------------------------------------------

func TestResolve_ResourceVar_WithReference(t *testing.T) {
	scope := newScope()
	relatedResource := &oapi.Resource{
		Id:          uuid.New().String(),
		Name:        "db-server",
		Kind:        "Database",
		Version:     "v1",
		Identifier:  "db-server",
		WorkspaceId: scope.Resource.WorkspaceId,
		Metadata:    map[string]string{"host": "db.internal"},
		Config:      map[string]any{},
	}
	relatedEntity := makeResourceEntity(relatedResource)

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
		relatedEntity: map[string][]*oapi.EntityRelation{
			"database": {{Entity: relatedEntity, EntityId: relatedResource.Id}},
		},
	}

	resolved, err := Resolve(context.Background(), getter, scope, scope.Deployment.Id, scope.Resource.Id)
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
	relatedResource := &oapi.Resource{
		Id:          uuid.New().String(),
		Name:        "cluster",
		Kind:        "Cluster",
		Version:     "v1",
		Identifier:  "cluster",
		WorkspaceId: scope.Resource.WorkspaceId,
		Metadata:    map[string]string{"endpoint": "https://k8s.internal"},
		Config:      map[string]any{},
	}
	relatedEntity := makeResourceEntity(relatedResource)

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
		relatedEntity: map[string][]*oapi.EntityRelation{
			"cluster": {{Entity: relatedEntity, EntityId: relatedResource.Id}},
		},
	}

	resolved, err := Resolve(context.Background(), getter, scope, scope.Deployment.Id, scope.Resource.Id)
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
	relatedResource := &oapi.Resource{
		Id:          uuid.New().String(),
		Name:        "vpc",
		Kind:        "Network",
		Version:     "v1",
		Identifier:  "vpc",
		WorkspaceId: scope.Resource.WorkspaceId,
		Metadata:    map[string]string{"cidr": "10.0.0.0/8"},
		Config:      map[string]any{},
	}
	relatedEntity := makeResourceEntity(relatedResource)
	varID1 := uuid.New().String()
	varID2 := uuid.New().String()

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
		relatedEntity: map[string][]*oapi.EntityRelation{
			"vpc": {{Entity: relatedEntity, EntityId: relatedResource.Id}},
		},
	}

	resolved, err := Resolve(context.Background(), getter, scope, scope.Deployment.Id, scope.Resource.Id)
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
		relatedEntity: map[string][]*oapi.EntityRelation{},
	}

	resolved, err := Resolve(context.Background(), getter, scope, scope.Deployment.Id, scope.Resource.Id)
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
	getter := &mockGetter{
		relatedEntity: map[string][]*oapi.EntityRelation{
			"self": {{Entity: relatedEntity, EntityId: scope.Resource.Id}},
		},
	}

	val := referenceValue("self", "config", "networking", "vpc_id")
	lv, err := ResolveValue(context.Background(), getter, scope.Resource.Id, &entity, &val)
	require.NoError(t, err)
	s, err := lv.AsStringValue()
	require.NoError(t, err)
	assert.Equal(t, "vpc-12345", string(s))
}

// ---------------------------------------------------------------------------
// Resolve tests — sensitive value returns error
// ---------------------------------------------------------------------------

func TestResolveValue_Sensitive_ReturnsError(t *testing.T) {
	scope := newScope()
	v := &oapi.Value{}
	_ = v.FromSensitiveValue(oapi.SensitiveValue{ValueHash: "abc123"})

	entity := makeResourceEntity(scope.Resource)
	_, err := ResolveValue(context.Background(), emptyGetter, scope.Resource.Id, &entity, v)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "sensitive")
}
