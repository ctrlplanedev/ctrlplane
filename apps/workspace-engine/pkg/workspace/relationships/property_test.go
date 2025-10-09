package relationships

import (
	"testing"
	"workspace-engine/pkg/pb"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"google.golang.org/protobuf/types/known/structpb"
)

func TestGetPropertyValue_Resource(t *testing.T) {
	providerId := "provider-123"
	resource := &pb.Resource{
		Id:          "resource-123",
		Name:        "test-resource",
		Version:     "v1.0.0",
		Kind:        "deployment",
		Identifier:  "test-identifier",
		WorkspaceId: "workspace-123",
		ProviderId:  &providerId,
		Metadata: map[string]string{
			"region": "us-east-1",
			"env":    "production",
		},
		Config: &structpb.Struct{
			Fields: map[string]*structpb.Value{
				"cpu": structpb.NewNumberValue(2),
				"memory": structpb.NewStringValue("4GB"),
				"networking": structpb.NewStructValue(&structpb.Struct{
					Fields: map[string]*structpb.Value{
						"vpc_id": structpb.NewStringValue("vpc-123"),
					},
				}),
			},
		},
		Variables: map[string]*pb.Value{
			"env": {Data: &pb.Value_String_{String_: "production"}},
			"replicas": {Data: &pb.Value_Int64{Int64: 3}},
		},
	}

	tests := []struct {
		name         string
		propertyPath []string
		wantValue    interface{}
		wantError    bool
	}{
		{
			name:         "get id",
			propertyPath: []string{"id"},
			wantValue:    "resource-123",
			wantError:    false,
		},
		{
			name:         "get name",
			propertyPath: []string{"name"},
			wantValue:    "test-resource",
			wantError:    false,
		},
		{
			name:         "get version",
			propertyPath: []string{"version"},
			wantValue:    "v1.0.0",
			wantError:    false,
		},
		{
			name:         "get kind",
			propertyPath: []string{"kind"},
			wantValue:    "deployment",
			wantError:    false,
		},
		{
			name:         "get identifier",
			propertyPath: []string{"identifier"},
			wantValue:    "test-identifier",
			wantError:    false,
		},
		{
			name:         "get workspace_id",
			propertyPath: []string{"workspace_id"},
			wantValue:    "workspace-123",
			wantError:    false,
		},
		{
			name:         "get workspaceid",
			propertyPath: []string{"workspaceid"},
			wantValue:    "workspace-123",
			wantError:    false,
		},
		{
			name:         "get provider_id",
			propertyPath: []string{"provider_id"},
			wantValue:    "provider-123",
			wantError:    false,
		},
		{
			name:         "get metadata region",
			propertyPath: []string{"metadata", "region"},
			wantValue:    "us-east-1",
			wantError:    false,
		},
		{
			name:         "get metadata env",
			propertyPath: []string{"metadata", "env"},
			wantValue:    "production",
			wantError:    false,
		},
		{
			name:         "get metadata missing key",
			propertyPath: []string{"metadata", "missing"},
			wantError:    true,
		},
		{
			name:         "get config cpu",
			propertyPath: []string{"config", "cpu"},
			wantValue:    float64(2),
			wantError:    false,
		},
		{
			name:         "get config memory",
			propertyPath: []string{"config", "memory"},
			wantValue:    "4GB",
			wantError:    false,
		},
		{
			name:         "get nested config",
			propertyPath: []string{"config", "networking", "vpc_id"},
			wantValue:    "vpc-123",
			wantError:    false,
		},
		{
			name:         "get variable env",
			propertyPath: []string{"variables", "env"},
			wantValue:    "production",
			wantError:    false,
		},
		{
			name:         "get variable replicas",
			propertyPath: []string{"variables", "replicas"},
			wantValue:    int64(3),
			wantError:    false,
		},
		{
			name:         "get variable missing key",
			propertyPath: []string{"variables", "missing"},
			wantError:    true,
		},
		{
			name:         "empty property path",
			propertyPath: []string{},
			wantError:    true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			value, err := GetPropertyValue(resource, tt.propertyPath)

			if tt.wantError {
				assert.Error(t, err)
				return
			}

			require.NoError(t, err)
			require.NotNil(t, value)

			// Extract the actual value from pb.Value
			actualValue := extractVariableValue(value)
			assert.Equal(t, tt.wantValue, actualValue)
		})
	}
}

func TestGetPropertyValue_ResourceNilProviderId(t *testing.T) {
	resource := &pb.Resource{
		Id:          "resource-123",
		ProviderId:  nil,
	}

	value, err := GetPropertyValue(resource, []string{"provider_id"})
	assert.Error(t, err)
	assert.Nil(t, value)
	assert.Contains(t, err.Error(), "provider_id is nil")
}

func TestGetPropertyValue_Deployment(t *testing.T) {
	description := "test deployment"
	jobAgentId := "job-agent-123"
	deployment := &pb.Deployment{
		Id:          "deployment-123",
		Name:        "test-deployment",
		Slug:        "test-slug",
		Description: &description,
		SystemId:    "system-123",
		JobAgentId:  &jobAgentId,
		JobAgentConfig: &structpb.Struct{
			Fields: map[string]*structpb.Value{
				"timeout": structpb.NewNumberValue(300),
				"retry": structpb.NewBoolValue(true),
			},
		},
	}

	tests := []struct {
		name         string
		propertyPath []string
		wantValue    interface{}
		wantError    bool
	}{
		{
			name:         "get id",
			propertyPath: []string{"id"},
			wantValue:    "deployment-123",
			wantError:    false,
		},
		{
			name:         "get name",
			propertyPath: []string{"name"},
			wantValue:    "test-deployment",
			wantError:    false,
		},
		{
			name:         "get slug",
			propertyPath: []string{"slug"},
			wantValue:    "test-slug",
			wantError:    false,
		},
		{
			name:         "get description",
			propertyPath: []string{"description"},
			wantValue:    "test deployment",
			wantError:    false,
		},
		{
			name:         "get system_id",
			propertyPath: []string{"system_id"},
			wantValue:    "system-123",
			wantError:    false,
		},
		{
			name:         "get job_agent_id",
			propertyPath: []string{"job_agent_id"},
			wantValue:    "job-agent-123",
			wantError:    false,
		},
		{
			name:         "get job_agent_config timeout",
			propertyPath: []string{"job_agent_config", "timeout"},
			wantValue:    float64(300),
			wantError:    false,
		},
		{
			name:         "get job_agent_config retry",
			propertyPath: []string{"job_agent_config", "retry"},
			wantValue:    true,
			wantError:    false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			value, err := GetPropertyValue(deployment, tt.propertyPath)

			if tt.wantError {
				assert.Error(t, err)
				return
			}

			require.NoError(t, err)
			require.NotNil(t, value)

			actualValue := extractVariableValue(value)
			assert.Equal(t, tt.wantValue, actualValue)
		})
	}
}

func TestGetPropertyValue_DeploymentNilFields(t *testing.T) {
	deployment := &pb.Deployment{
		Id:          "deployment-123",
		Description: nil,
		JobAgentId:  nil,
	}

	t.Run("nil description", func(t *testing.T) {
		value, err := GetPropertyValue(deployment, []string{"description"})
		assert.Error(t, err)
		assert.Nil(t, value)
		assert.Contains(t, err.Error(), "description is nil")
	})

	t.Run("nil job_agent_id", func(t *testing.T) {
		value, err := GetPropertyValue(deployment, []string{"job_agent_id"})
		assert.Error(t, err)
		assert.Nil(t, value)
		assert.Contains(t, err.Error(), "job_agent_id is nil")
	})
}

func TestGetPropertyValue_Environment(t *testing.T) {
	description := "test environment"
	environment := &pb.Environment{
		Id:          "env-123",
		Name:        "production",
		Description: &description,
		SystemId:    "system-123",
	}

	tests := []struct {
		name         string
		propertyPath []string
		wantValue    interface{}
		wantError    bool
	}{
		{
			name:         "get id",
			propertyPath: []string{"id"},
			wantValue:    "env-123",
			wantError:    false,
		},
		{
			name:         "get name",
			propertyPath: []string{"name"},
			wantValue:    "production",
			wantError:    false,
		},
		{
			name:         "get description",
			propertyPath: []string{"description"},
			wantValue:    "test environment",
			wantError:    false,
		},
		{
			name:         "get system_id",
			propertyPath: []string{"system_id"},
			wantValue:    "system-123",
			wantError:    false,
		},
		{
			name:         "get systemid",
			propertyPath: []string{"systemid"},
			wantValue:    "system-123",
			wantError:    false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			value, err := GetPropertyValue(environment, tt.propertyPath)

			if tt.wantError {
				assert.Error(t, err)
				return
			}

			require.NoError(t, err)
			require.NotNil(t, value)

			actualValue := extractVariableValue(value)
			assert.Equal(t, tt.wantValue, actualValue)
		})
	}
}

func TestGetPropertyValue_EnvironmentNilDescription(t *testing.T) {
	environment := &pb.Environment{
		Id:          "env-123",
		Description: nil,
	}

	value, err := GetPropertyValue(environment, []string{"description"})
	assert.Error(t, err)
	assert.Nil(t, value)
	assert.Contains(t, err.Error(), "description is nil")
}

func TestGetStructPBValue(t *testing.T) {
	tests := []struct {
		name         string
		structValue  *structpb.Struct
		propertyPath []string
		wantValue    interface{}
		wantError    bool
	}{
		{
			name: "get string value",
			structValue: &structpb.Struct{
				Fields: map[string]*structpb.Value{
					"key": structpb.NewStringValue("value"),
				},
			},
			propertyPath: []string{"key"},
			wantValue:    "value",
			wantError:    false,
		},
		{
			name: "get number value",
			structValue: &structpb.Struct{
				Fields: map[string]*structpb.Value{
					"count": structpb.NewNumberValue(42),
				},
			},
			propertyPath: []string{"count"},
			wantValue:    float64(42),
			wantError:    false,
		},
		{
			name: "get bool value",
			structValue: &structpb.Struct{
				Fields: map[string]*structpb.Value{
					"enabled": structpb.NewBoolValue(true),
				},
			},
			propertyPath: []string{"enabled"},
			wantValue:    true,
			wantError:    false,
		},
		{
			name: "get nested value",
			structValue: &structpb.Struct{
				Fields: map[string]*structpb.Value{
					"parent": structpb.NewStructValue(&structpb.Struct{
						Fields: map[string]*structpb.Value{
							"child": structpb.NewStringValue("nested-value"),
						},
					}),
				},
			},
			propertyPath: []string{"parent", "child"},
			wantValue:    "nested-value",
			wantError:    false,
		},
		{
			name: "get deeply nested value",
			structValue: &structpb.Struct{
				Fields: map[string]*structpb.Value{
					"level1": structpb.NewStructValue(&structpb.Struct{
						Fields: map[string]*structpb.Value{
							"level2": structpb.NewStructValue(&structpb.Struct{
								Fields: map[string]*structpb.Value{
									"level3": structpb.NewNumberValue(123),
								},
							}),
						},
					}),
				},
			},
			propertyPath: []string{"level1", "level2", "level3"},
			wantValue:    float64(123),
			wantError:    false,
		},
		{
			name: "missing field",
			structValue: &structpb.Struct{
				Fields: map[string]*structpb.Value{
					"key": structpb.NewStringValue("value"),
				},
			},
			propertyPath: []string{"missing"},
			wantError:    true,
		},
		{
			name: "nil struct",
			structValue: nil,
			propertyPath: []string{"key"},
			wantError:    true,
		},
		{
			name: "empty path",
			structValue: &structpb.Struct{
				Fields: map[string]*structpb.Value{
					"key": structpb.NewStringValue("value"),
				},
			},
			propertyPath: []string{},
			wantValue:    &structpb.Struct{
				Fields: map[string]*structpb.Value{
					"key": structpb.NewStringValue("value"),
				},
			},
			wantError:    false,
		},
		{
			name: "traverse non-struct field",
			structValue: &structpb.Struct{
				Fields: map[string]*structpb.Value{
					"key": structpb.NewStringValue("value"),
				},
			},
			propertyPath: []string{"key", "nested"},
			wantError:    true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			value, err := getStructPBValue(tt.structValue, tt.propertyPath)

			if tt.wantError {
				assert.Error(t, err)
				return
			}

			require.NoError(t, err)
			
			// Special handling for struct comparison
			if s, ok := tt.wantValue.(*structpb.Struct); ok {
				actualStruct, ok := value.(*structpb.Struct)
				require.True(t, ok, "expected value to be *structpb.Struct")
				assert.Equal(t, s.GetFields()["key"].GetStringValue(), actualStruct.GetFields()["key"].GetStringValue())
			} else {
				assert.Equal(t, tt.wantValue, value)
			}
		})
	}
}

func TestExtractStructPBValue(t *testing.T) {
	tests := []struct {
		name      string
		value     *structpb.Value
		wantValue interface{}
	}{
		{
			name:      "string value",
			value:     structpb.NewStringValue("test"),
			wantValue: "test",
		},
		{
			name:      "number value",
			value:     structpb.NewNumberValue(42.5),
			wantValue: 42.5,
		},
		{
			name:      "bool value true",
			value:     structpb.NewBoolValue(true),
			wantValue: true,
		},
		{
			name:      "bool value false",
			value:     structpb.NewBoolValue(false),
			wantValue: false,
		},
		{
			name:      "null value",
			value:     structpb.NewNullValue(),
			wantValue: nil,
		},
		{
			name: "list value",
			value: structpb.NewListValue(&structpb.ListValue{
				Values: []*structpb.Value{
					structpb.NewStringValue("a"),
					structpb.NewStringValue("b"),
				},
			}),
			wantValue: &structpb.ListValue{
				Values: []*structpb.Value{
					structpb.NewStringValue("a"),
					structpb.NewStringValue("b"),
				},
			},
		},
		{
			name: "struct value",
			value: structpb.NewStructValue(&structpb.Struct{
				Fields: map[string]*structpb.Value{
					"key": structpb.NewStringValue("value"),
				},
			}),
			wantValue: &structpb.Struct{
				Fields: map[string]*structpb.Value{
					"key": structpb.NewStringValue("value"),
				},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			value := extractStructPBValue(tt.value)
			
			// For complex types, check type and basic properties
			switch want := tt.wantValue.(type) {
			case *structpb.ListValue:
				actual, ok := value.(*structpb.ListValue)
				require.True(t, ok, "expected *structpb.ListValue")
				assert.Equal(t, len(want.Values), len(actual.Values))
			case *structpb.Struct:
				actual, ok := value.(*structpb.Struct)
				require.True(t, ok, "expected *structpb.Struct")
				assert.Equal(t, len(want.Fields), len(actual.Fields))
			default:
				assert.Equal(t, tt.wantValue, value)
			}
		})
	}
}

func TestExtractVariableValue(t *testing.T) {
	tests := []struct {
		name      string
		value     *pb.Value
		wantValue interface{}
	}{
		{
			name: "string value",
			value: &pb.Value{
				Data: &pb.Value_String_{String_: "test"},
			},
			wantValue: "test",
		},
		{
			name: "bool value",
			value: &pb.Value{
				Data: &pb.Value_Bool{Bool: true},
			},
			wantValue: true,
		},
		{
			name: "double value",
			value: &pb.Value{
				Data: &pb.Value_Double{Double: 3.14},
			},
			wantValue: 3.14,
		},
		{
			name: "int64 value",
			value: &pb.Value{
				Data: &pb.Value_Int64{Int64: 42},
			},
			wantValue: int64(42),
		},
		{
			name: "object value",
			value: &pb.Value{
				Data: &pb.Value_Object{
					Object: &structpb.Struct{
						Fields: map[string]*structpb.Value{
							"key": structpb.NewStringValue("value"),
						},
					},
				},
			},
			wantValue: &structpb.Struct{
				Fields: map[string]*structpb.Value{
					"key": structpb.NewStringValue("value"),
				},
			},
		},
		{
			name: "null value",
			value: &pb.Value{
				Data: &pb.Value_Null{},
			},
			wantValue: nil,
		},
		{
			name:      "nil value",
			value:     nil,
			wantValue: nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			value := extractVariableValue(tt.value)
			
			// For struct types, check basic properties
			if want, ok := tt.wantValue.(*structpb.Struct); ok {
				actual, ok := value.(*structpb.Struct)
				require.True(t, ok, "expected *structpb.Struct")
				assert.Equal(t, len(want.Fields), len(actual.Fields))
			} else {
				assert.Equal(t, tt.wantValue, value)
			}
		})
	}
}

func TestGetPropertyReflection(t *testing.T) {
	type CustomStruct struct {
		Name    string
		Count   int
		Enabled bool
		Nested  struct {
			Value string
		}
	}

	entity := CustomStruct{
		Name:    "test",
		Count:   42,
		Enabled: true,
		Nested: struct {
			Value string
		}{
			Value: "nested-value",
		},
	}

	tests := []struct {
		name         string
		propertyPath []string
		wantValue    interface{}
		wantError    bool
	}{
		{
			name:         "get string field",
			propertyPath: []string{"Name"},
			wantValue:    "test",
			wantError:    false,
		},
		{
			name:         "get int field",
			propertyPath: []string{"Count"},
			wantValue:    int64(42), // ConvertValue converts int to int64
			wantError:    false,
		},
		{
			name:         "get bool field",
			propertyPath: []string{"Enabled"},
			wantValue:    true,
			wantError:    false,
		},
		{
			name:         "get nested field",
			propertyPath: []string{"Nested", "Value"},
			wantValue:    "nested-value",
			wantError:    false,
		},
		{
			name:         "missing field",
			propertyPath: []string{"Missing"},
			wantError:    true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			value, err := getPropertyReflection(entity, tt.propertyPath)

			if tt.wantError {
				assert.Error(t, err)
				return
			}

			require.NoError(t, err)
			require.NotNil(t, value)

			actualValue := extractVariableValue(value)
			assert.Equal(t, tt.wantValue, actualValue)
		})
	}
}

func TestGetPropertyReflection_CaseInsensitive(t *testing.T) {
	type CustomStruct struct {
		Name string
	}

	entity := CustomStruct{
		Name: "test",
	}

	// Test case-insensitive field matching
	value, err := getPropertyReflection(entity, []string{"name"})
	require.NoError(t, err)
	require.NotNil(t, value)

	actualValue := extractVariableValue(value)
	assert.Equal(t, "test", actualValue)
}

func TestGetPropertyReflection_Pointer(t *testing.T) {
	type CustomStruct struct {
		Name string
	}

	entity := &CustomStruct{
		Name: "test",
	}

	value, err := getPropertyReflection(entity, []string{"Name"})
	require.NoError(t, err)
	require.NotNil(t, value)

	actualValue := extractVariableValue(value)
	assert.Equal(t, "test", actualValue)
}

func TestGetPropertyReflection_NonStruct(t *testing.T) {
	entity := "not a struct"

	value, err := getPropertyReflection(entity, []string{"Field"})
	assert.Error(t, err)
	assert.Nil(t, value)
	assert.Contains(t, err.Error(), "entity is not a struct")
}

func TestGetPropertyReflection_EmptyPath(t *testing.T) {
	type CustomStruct struct {
		Name string
	}

	entity := CustomStruct{
		Name: "test",
	}

	// Empty path should return the entity itself, but ConvertValue doesn't support
	// custom struct types, so this will error
	value, err := getPropertyReflection(entity, []string{})
	assert.Error(t, err)
	assert.Nil(t, value)
	assert.Contains(t, err.Error(), "unexpected variable value type")
}

func TestGetPropertyValue_CaseSensitivity(t *testing.T) {
	resource := &pb.Resource{
		Id:          "resource-123",
		WorkspaceId: "workspace-123",
	}

	tests := []struct {
		name         string
		propertyPath []string
		wantValue    string
	}{
		{
			name:         "lowercase id",
			propertyPath: []string{"id"},
			wantValue:    "resource-123",
		},
		{
			name:         "uppercase ID",
			propertyPath: []string{"ID"},
			wantValue:    "resource-123",
		},
		{
			name:         "mixed case Id",
			propertyPath: []string{"Id"},
			wantValue:    "resource-123",
		},
		{
			name:         "workspace_id",
			propertyPath: []string{"workspace_id"},
			wantValue:    "workspace-123",
		},
		{
			name:         "workspaceid",
			propertyPath: []string{"workspaceid"},
			wantValue:    "workspace-123",
		},
		{
			name:         "WORKSPACEID",
			propertyPath: []string{"WORKSPACEID"},
			wantValue:    "workspace-123",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			value, err := GetPropertyValue(resource, tt.propertyPath)
			require.NoError(t, err)
			require.NotNil(t, value)

			actualValue := extractVariableValue(value)
			assert.Equal(t, tt.wantValue, actualValue)
		})
	}
}

func TestGetResourceProperty_MetadataPathTooDeep(t *testing.T) {
	resource := &pb.Resource{
		Id: "resource-123",
		Metadata: map[string]string{
			"key": "value",
		},
	}

	value, err := getResourceProperty(resource, []string{"metadata", "key", "nested"})
	assert.Error(t, err)
	assert.Nil(t, value)
	assert.Contains(t, err.Error(), "metadata path too deep")
}

func TestGetResourceProperty_VariablesPathTooDeep(t *testing.T) {
	resource := &pb.Resource{
		Id: "resource-123",
		Variables: map[string]*pb.Value{
			"key": {Data: &pb.Value_String_{String_: "value"}},
		},
	}

	value, err := getResourceProperty(resource, []string{"variables", "key", "nested"})
	assert.Error(t, err)
	assert.Nil(t, value)
	assert.Contains(t, err.Error(), "variables path too deep")
}

func TestGetResourceProperty_ConfigMissingField(t *testing.T) {
	resource := &pb.Resource{
		Id: "resource-123",
		Config: &structpb.Struct{
			Fields: map[string]*structpb.Value{
				"key": structpb.NewStringValue("value"),
			},
		},
	}

	value, err := getResourceProperty(resource, []string{"config", "missing"})
	assert.Error(t, err)
	assert.Nil(t, value)
	assert.Contains(t, err.Error(), "field missing not found")
}

func TestGetPropertyValue_AllTypes(t *testing.T) {
	// Test with all supported entity types
	t.Run("Resource", func(t *testing.T) {
		resource := &pb.Resource{Id: "test"}
		value, err := GetPropertyValue(resource, []string{"id"})
		require.NoError(t, err)
		assert.Equal(t, "test", extractVariableValue(value))
	})

	t.Run("Deployment", func(t *testing.T) {
		deployment := &pb.Deployment{Id: "test"}
		value, err := GetPropertyValue(deployment, []string{"id"})
		require.NoError(t, err)
		assert.Equal(t, "test", extractVariableValue(value))
	})

	t.Run("Environment", func(t *testing.T) {
		environment := &pb.Environment{Id: "test"}
		value, err := GetPropertyValue(environment, []string{"id"})
		require.NoError(t, err)
		assert.Equal(t, "test", extractVariableValue(value))
	})

	t.Run("Custom type falls back to reflection", func(t *testing.T) {
		type CustomType struct {
			Id string
		}
		custom := CustomType{Id: "test"}
		value, err := GetPropertyValue(custom, []string{"Id"})
		require.NoError(t, err)
		assert.Equal(t, "test", extractVariableValue(value))
	})
}

