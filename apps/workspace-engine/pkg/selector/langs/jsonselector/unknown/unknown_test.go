package unknown

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetNormalizedProperty(t *testing.T) {
	tests := []struct {
		name     string
		property string
		expected string
	}{
		{
			name:     "created-at alias",
			property: "created-at",
			expected: "CreatedAt",
		},
		{
			name:     "deleted-at alias",
			property: "deleted-at",
			expected: "DeletedAt",
		},
		{
			name:     "updated-at alias",
			property: "updated-at",
			expected: "UpdatedAt",
		},
		{
			name:     "metadata alias",
			property: "metadata",
			expected: "Metadata",
		},
		{
			name:     "version alias",
			property: "version",
			expected: "Version",
		},
		{
			name:     "kind alias",
			property: "kind",
			expected: "Kind",
		},
		{
			name:     "identifier alias",
			property: "identifier",
			expected: "Identifier",
		},
		{
			name:     "name alias",
			property: "name",
			expected: "Name",
		},
		{
			name:     "id alias",
			property: "id",
			expected: "Id",
		},
		{
			name:     "non-aliased property",
			property: "CustomProperty",
			expected: "CustomProperty",
		},
		{
			name:     "empty property",
			property: "",
			expected: "",
		},
		{
			name:     "unknown property",
			property: "unknown-field",
			expected: "unknown-field",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			condition := UnknownCondition{Property: tt.property}
			result := condition.GetNormalizedProperty()
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestParseFromMap(t *testing.T) {
	tests := []struct {
		name        string
		input       map[string]any
		expected    UnknownCondition
		expectError bool
	}{
		{
			name: "simple condition",
			input: map[string]any{
				"type":     "name",
				"operator": "equals",
				"value":    "test",
			},
			expected: UnknownCondition{
				Property: "name",
				Operator: "equals",
				Value:    "test",
			},
			expectError: false,
		},
		{
			name: "condition with metadata key",
			input: map[string]any{
				"type":     "metadata",
				"operator": "contains",
				"value":    "prod",
				"key":      "environment",
			},
			expected: UnknownCondition{
				Property:    "metadata",
				Operator:    "contains",
				Value:       "prod",
				MetadataKey: "environment",
			},
			expectError: false,
		},
		{
			name: "nested conditions",
			input: map[string]any{
				"type":     "and",
				"operator": "all",
				"conditions": []any{
					map[string]any{
						"type":     "name",
						"operator": "equals",
						"value":    "test",
					},
					map[string]any{
						"type":     "kind",
						"operator": "equals",
						"value":    "deployment",
					},
				},
			},
			expected: UnknownCondition{
				Property: "and",
				Operator: "all",
				Conditions: []UnknownCondition{
					{
						Property: "name",
						Operator: "equals",
						Value:    "test",
					},
					{
						Property: "kind",
						Operator: "equals",
						Value:    "deployment",
					},
				},
			},
			expectError: false,
		},
		{
			name:  "empty map",
			input: map[string]any{},
			expected: UnknownCondition{
				Property:   "",
				Operator:   "",
				Value:      "",
				Conditions: nil,
			},
			expectError: false,
		},
		{
			name: "deeply nested conditions",
			input: map[string]any{
				"type":     "or",
				"operator": "any",
				"conditions": []any{
					map[string]any{
						"type":     "and",
						"operator": "all",
						"conditions": []any{
							map[string]any{
								"type":     "name",
								"operator": "equals",
								"value":    "test1",
							},
							map[string]any{
								"type":     "version",
								"operator": "equals",
								"value":    "v1",
							},
						},
					},
					map[string]any{
						"type":     "kind",
						"operator": "equals",
						"value":    "service",
					},
				},
			},
			expected: UnknownCondition{
				Property: "or",
				Operator: "any",
				Conditions: []UnknownCondition{
					{
						Property: "and",
						Operator: "all",
						Conditions: []UnknownCondition{
							{
								Property: "name",
								Operator: "equals",
								Value:    "test1",
							},
							{
								Property: "version",
								Operator: "equals",
								Value:    "v1",
							},
						},
					},
					{
						Property: "kind",
						Operator: "equals",
						Value:    "service",
					},
				},
			},
			expectError: false,
		},
		{
			name: "condition with all fields",
			input: map[string]any{
				"type":       "metadata",
				"operator":   "equals",
				"value":      "production",
				"key":        "env",
				"conditions": []any{},
			},
			expected: UnknownCondition{
				Property:    "metadata",
				Operator:    "equals",
				Value:       "production",
				MetadataKey: "env",
				Conditions:  []UnknownCondition{},
			},
			expectError: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := ParseFromMap(tt.input)

			if tt.expectError {
				require.Error(t, err)
			} else {
				require.NoError(t, err)
				assert.Equal(t, tt.expected, result)
			}
		})
	}
}

func TestParseFromMapEdgeCases(t *testing.T) {
	t.Run("nil conditions slice", func(t *testing.T) {
		input := map[string]any{
			"type":       "and",
			"operator":   "all",
			"conditions": nil,
		}
		result, err := ParseFromMap(input)
		require.NoError(t, err)
		assert.Nil(t, result.Conditions)
	})

	t.Run("numeric values should error", func(t *testing.T) {
		input := map[string]any{
			"type":     "version",
			"operator": "equals",
			"value":    123, // numeric value instead of string
		}
		_, err := ParseFromMap(input)
		// Value field is a string, so numeric values should cause an unmarshal error
		require.Error(t, err)
	})

	t.Run("boolean values should error", func(t *testing.T) {
		input := map[string]any{
			"type":     "active",
			"operator": "equals",
			"value":    true,
		}
		_, err := ParseFromMap(input)
		// Value field is a string, so boolean values should cause an unmarshal error
		require.Error(t, err)
	})
}

func TestUnknownConditionStructure(t *testing.T) {
	t.Run("zero value condition", func(t *testing.T) {
		var condition UnknownCondition
		assert.Equal(t, "", condition.Property)
		assert.Equal(t, "", condition.Operator)
		assert.Equal(t, "", condition.Value)
		assert.Equal(t, "", condition.MetadataKey)
		assert.Nil(t, condition.Conditions)
	})

	t.Run("initialized condition", func(t *testing.T) {
		condition := UnknownCondition{
			Property: "test",
			Operator: "equals",
			Value:    "value",
		}
		assert.Equal(t, "test", condition.Property)
		assert.Equal(t, "equals", condition.Operator)
		assert.Equal(t, "value", condition.Value)
	})
}
