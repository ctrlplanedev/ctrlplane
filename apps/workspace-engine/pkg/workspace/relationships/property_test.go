package relationships

import (
	"testing"
	"workspace-engine/pkg/oapi"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func makeResourceEntity(r *oapi.Resource) *oapi.RelatableEntity {
	e := &oapi.RelatableEntity{}
	_ = e.FromResource(*r)
	return e
}

func makeDeploymentEntity(d *oapi.Deployment) *oapi.RelatableEntity {
	e := &oapi.RelatableEntity{}
	_ = e.FromDeployment(*d)
	return e
}

func makeEnvironmentEntity(env *oapi.Environment) *oapi.RelatableEntity {
	e := &oapi.RelatableEntity{}
	_ = e.FromEnvironment(*env)
	return e
}

func TestPropertyValueExtraction_Resource(t *testing.T) {
	providerID := "provider-1"
	resource := &oapi.Resource{
		Id:          "res-1",
		Name:        "my-resource",
		Version:     "v1.0",
		Kind:        "Kubernetes",
		Identifier:  "res-identifier",
		WorkspaceId: "ws-1",
		ProviderId:  &providerID,
		Metadata: map[string]string{
			"region": "us-east-1",
			"env":    "prod",
		},
		Config: map[string]any{
			"namespace": "production",
			"networking": map[string]any{
				"vpc_id": "vpc-123",
			},
		},
	}
	entity := makeResourceEntity(resource)

	tests := []struct {
		name     string
		path     []string
		wantErr  bool
		contains string // substring in error
	}{
		{name: "id", path: []string{"id"}},
		{name: "name", path: []string{"name"}},
		{name: "version", path: []string{"version"}},
		{name: "kind", path: []string{"kind"}},
		{name: "identifier", path: []string{"identifier"}},
		{name: "workspace_id", path: []string{"workspace_id"}},
		{name: "workspaceid alias", path: []string{"workspaceid"}},
		{name: "provider_id", path: []string{"provider_id"}},
		{name: "providerid alias", path: []string{"providerid"}},
		{name: "metadata as whole", path: []string{"metadata"}},
		{name: "metadata key", path: []string{"metadata", "region"}},
		{name: "metadata missing key", path: []string{"metadata", "missing"}, wantErr: true, contains: "not found"},
		{name: "metadata too deep", path: []string{"metadata", "a", "b"}, wantErr: true, contains: "too deep"},
		{name: "config as whole", path: []string{"config"}},
		{name: "config nested key", path: []string{"config", "namespace"}},
		{name: "config deeply nested", path: []string{"config", "networking", "vpc_id"}},
		{name: "config missing key", path: []string{"config", "nonexistent"}, wantErr: true, contains: "not found"},
		{name: "empty path", path: []string{}, wantErr: true, contains: "empty"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			val, err := GetPropertyValue(entity, tt.path)
			if tt.wantErr {
				require.Error(t, err)
				if tt.contains != "" {
					assert.Contains(t, err.Error(), tt.contains)
				}
			} else {
				require.NoError(t, err)
				require.NotNil(t, val)
			}
		})
	}
}

func TestPropertyValueExtraction_Resource_NilProviderId(t *testing.T) {
	resource := &oapi.Resource{
		Id:         "res-1",
		Name:       "my-resource",
		ProviderId: nil,
	}
	entity := makeResourceEntity(resource)
	_, err := GetPropertyValue(entity, []string{"provider_id"})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "nil")
}

func TestPropertyValueExtraction_Deployment(t *testing.T) {
	desc := "my deployment"
	agentID := "agent-1"
	deployment := &oapi.Deployment{
		Id:          "dep-1",
		Name:        "my-deployment",
		Slug:        "my-deployment-slug",
		Description: &desc,
		JobAgentId:  &agentID,
		JobAgentConfig: map[string]any{
			"repo": "my-repo",
			"nested": map[string]any{
				"key": "value",
			},
		},
	}
	entity := makeDeploymentEntity(deployment)

	tests := []struct {
		name     string
		path     []string
		wantErr  bool
		contains string
	}{
		{name: "id", path: []string{"id"}},
		{name: "name", path: []string{"name"}},
		{name: "slug", path: []string{"slug"}},
		{name: "description", path: []string{"description"}},
		{name: "job_agent_id", path: []string{"job_agent_id"}},
		{name: "jobagentid alias", path: []string{"jobagentid"}},
		{name: "job_agent_config whole", path: []string{"job_agent_config"}, wantErr: true, contains: "unexpected"}, // JobAgentConfig type not handled
		{name: "jobagentconfig alias", path: []string{"jobagentconfig"}, wantErr: true, contains: "unexpected"},
		{name: "job_agent_config nested", path: []string{"job_agent_config", "repo"}},
		{name: "job_agent_config deep nested", path: []string{"job_agent_config", "nested", "key"}},
		{name: "empty path", path: []string{}, wantErr: true, contains: "empty"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			val, err := GetPropertyValue(entity, tt.path)
			if tt.wantErr {
				require.Error(t, err)
				if tt.contains != "" {
					assert.Contains(t, err.Error(), tt.contains)
				}
			} else {
				require.NoError(t, err)
				require.NotNil(t, val)
			}
		})
	}
}

func TestPropertyValueExtraction_Deployment_NilFields(t *testing.T) {
	deployment := &oapi.Deployment{
		Id:          "dep-1",
		Name:        "my-deployment",
		Slug:        "my-slug",
		Description: nil,
		JobAgentId:  nil,
	}
	entity := makeDeploymentEntity(deployment)

	_, err := GetPropertyValue(entity, []string{"description"})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "nil")

	_, err = GetPropertyValue(entity, []string{"job_agent_id"})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "nil")
}

func TestPropertyValueExtraction_Environment(t *testing.T) {
	desc := "my environment"
	env := &oapi.Environment{
		Id:          "env-1",
		Name:        "production",
		Description: &desc,
	}
	entity := makeEnvironmentEntity(env)

	tests := []struct {
		name     string
		path     []string
		wantErr  bool
		contains string
	}{
		{name: "id", path: []string{"id"}},
		{name: "name", path: []string{"name"}},
		{name: "description", path: []string{"description"}},
		{name: "empty path", path: []string{}, wantErr: true, contains: "empty"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			val, err := GetPropertyValue(entity, tt.path)
			if tt.wantErr {
				require.Error(t, err)
				if tt.contains != "" {
					assert.Contains(t, err.Error(), tt.contains)
				}
			} else {
				require.NoError(t, err)
				require.NotNil(t, val)
			}
		})
	}
}

func TestPropertyValueExtraction_Environment_NilFields(t *testing.T) {
	env := &oapi.Environment{
		Id:          "env-1",
		Name:        "staging",
		Description: nil,
	}
	entity := makeEnvironmentEntity(env)

	_, err := GetPropertyValue(entity, []string{"description"})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "nil")
}

func TestGetMapValue(t *testing.T) {
	m := map[string]any{
		"top": "value",
		"nested": map[string]any{
			"inner": "deep",
		},
		"not_a_map": 42,
	}

	t.Run("nil map", func(t *testing.T) {
		_, err := getMapValue(nil, []string{"key"})
		require.Error(t, err)
	})

	t.Run("empty path returns map", func(t *testing.T) {
		val, err := getMapValue(m, []string{})
		require.NoError(t, err)
		assert.Equal(t, m, val)
	})

	t.Run("top-level key", func(t *testing.T) {
		val, err := getMapValue(m, []string{"top"})
		require.NoError(t, err)
		assert.Equal(t, "value", val)
	})

	t.Run("nested key", func(t *testing.T) {
		val, err := getMapValue(m, []string{"nested", "inner"})
		require.NoError(t, err)
		assert.Equal(t, "deep", val)
	})

	t.Run("missing key", func(t *testing.T) {
		_, err := getMapValue(m, []string{"missing"})
		require.Error(t, err)
		assert.Contains(t, err.Error(), "not found")
	})

	t.Run("traverse non-map", func(t *testing.T) {
		_, err := getMapValue(m, []string{"not_a_map", "deeper"})
		require.Error(t, err)
		assert.Contains(t, err.Error(), "not a map")
	})
}

func TestExtractValueAsString(t *testing.T) {
	t.Run("nil value", func(t *testing.T) {
		assert.Equal(t, "", extractValueAsString(nil))
	})

	t.Run("string value", func(t *testing.T) {
		lv := &oapi.LiteralValue{}
		_ = lv.FromStringValue("hello")
		assert.Equal(t, "hello", extractValueAsString(lv))
	})

	t.Run("boolean value", func(t *testing.T) {
		lv := &oapi.LiteralValue{}
		_ = lv.FromBooleanValue(true)
		assert.Equal(t, "true", extractValueAsString(lv))
	})

	t.Run("number value", func(t *testing.T) {
		lv := &oapi.LiteralValue{}
		_ = lv.FromNumberValue(3.14)
		result := extractValueAsString(lv)
		assert.Contains(t, result, "3.14")
	})

	t.Run("integer value", func(t *testing.T) {
		lv := &oapi.LiteralValue{}
		_ = lv.FromIntegerValue(42)
		result := extractValueAsString(lv)
		// Integer 42 may be read as a number first, resulting in "42.000000"
		assert.Contains(t, result, "42")
	})

	t.Run("object value", func(t *testing.T) {
		lv := &oapi.LiteralValue{}
		_ = lv.FromObjectValue(oapi.ObjectValue{Object: map[string]any{"key": "val"}})
		result := extractValueAsString(lv)
		assert.Contains(t, result, "key")
	})

	t.Run("null value", func(t *testing.T) {
		lv := &oapi.LiteralValue{}
		_ = lv.FromNullValue(true)
		result := extractValueAsString(lv)
		// FromNullValue(true) stores JSON `true` which gets matched as boolean
		assert.NotEmpty(t, result)
	})
}

func TestConvertValue(t *testing.T) {
	t.Run("string", func(t *testing.T) {
		lv, err := convertValue("hello")
		require.NoError(t, err)
		require.NotNil(t, lv)
	})

	t.Run("float64", func(t *testing.T) {
		lv, err := convertValue(float64(3.14))
		require.NoError(t, err)
		require.NotNil(t, lv)
	})

	t.Run("float32", func(t *testing.T) {
		lv, err := convertValue(float32(2.71))
		require.NoError(t, err)
		require.NotNil(t, lv)
	})

	t.Run("int", func(t *testing.T) {
		lv, err := convertValue(42)
		require.NoError(t, err)
		require.NotNil(t, lv)
	})

	t.Run("int32", func(t *testing.T) {
		lv, err := convertValue(int32(32))
		require.NoError(t, err)
		require.NotNil(t, lv)
	})

	t.Run("int64", func(t *testing.T) {
		lv, err := convertValue(int64(64))
		require.NoError(t, err)
		require.NotNil(t, lv)
	})

	t.Run("bool", func(t *testing.T) {
		lv, err := convertValue(true)
		require.NoError(t, err)
		require.NotNil(t, lv)
	})

	t.Run("map string any", func(t *testing.T) {
		lv, err := convertValue(map[string]any{"key": "value"})
		require.NoError(t, err)
		require.NotNil(t, lv)
	})

	t.Run("map string string", func(t *testing.T) {
		lv, err := convertValue(map[string]string{"key": "value"})
		require.NoError(t, err)
		require.NotNil(t, lv)
	})

	t.Run("nil", func(t *testing.T) {
		lv, err := convertValue(nil)
		require.NoError(t, err)
		require.NotNil(t, lv)
	})

	t.Run("literal value passthrough", func(t *testing.T) {
		orig := &oapi.LiteralValue{}
		_ = orig.FromStringValue("passthrough")
		lv, err := convertValue(orig)
		require.NoError(t, err)
		assert.Equal(t, orig, lv)
	})

	t.Run("unsupported type", func(t *testing.T) {
		_, err := convertValue(struct{}{})
		require.Error(t, err)
		assert.Contains(t, err.Error(), "unexpected")
	})
}

func TestGetPropertyReflection(t *testing.T) {
	type TestStruct struct {
		Name  string
		Count int
		Inner struct {
			Value string
		}
	}

	s := &TestStruct{
		Name:  "test",
		Count: 5,
		Inner: struct{ Value string }{Value: "deep"},
	}

	t.Run("direct field", func(t *testing.T) {
		lv, err := getPropertyReflection(s, []string{"Name"})
		require.NoError(t, err)
		require.NotNil(t, lv)
	})

	t.Run("case insensitive match", func(t *testing.T) {
		lv, err := getPropertyReflection(s, []string{"name"})
		require.NoError(t, err)
		require.NotNil(t, lv)
	})

	t.Run("nested field", func(t *testing.T) {
		lv, err := getPropertyReflection(s, []string{"Inner", "Value"})
		require.NoError(t, err)
		require.NotNil(t, lv)
	})

	t.Run("missing field", func(t *testing.T) {
		_, err := getPropertyReflection(s, []string{"NonExistent"})
		require.Error(t, err)
		assert.Contains(t, err.Error(), "not found")
	})

	t.Run("empty path returns converted value", func(t *testing.T) {
		_, err := getPropertyReflection(s, []string{})
		// Will attempt to convert the struct, which should fail
		require.Error(t, err)
	})

	t.Run("non-struct entity", func(t *testing.T) {
		_, err := getPropertyReflection(42, []string{"field"})
		require.Error(t, err)
		assert.Contains(t, err.Error(), "not a struct")
	})
}
