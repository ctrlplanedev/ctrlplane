package metadata

import (
	"testing"
	cstring "workspace-engine/pkg/selector/langs/jsonselector/string"
	"workspace-engine/pkg/selector/langs/jsonselector/unknown"
)

func TestMetadataCondition_Matches(t *testing.T) {
	tests := []struct {
		name      string
		condition MetadataCondition
		entity    any
		wantMatch bool
		wantErr   bool
		errMsg    string
	}{
		{
			name: "equals operator matches",
			condition: MetadataCondition{
				Operator: cstring.StringConditionOperatorEquals,
				Key:      "env",
				Value:    "production",
			},
			entity: struct {
				Metadata map[string]string `json:"metadata"`
			}{
				Metadata: map[string]string{
					"env": "production",
				},
			},
			wantMatch: true,
			wantErr:   false,
		},
		{
			name: "equals operator does not match",
			condition: MetadataCondition{
				Operator: cstring.StringConditionOperatorEquals,
				Key:      "env",
				Value:    "production",
			},
			entity: struct {
				Metadata map[string]string `json:"metadata"`
			}{
				Metadata: map[string]string{
					"env": "development",
				},
			},
			wantMatch: false,
			wantErr:   false,
		},
		{
			name: "starts-with operator matches",
			condition: MetadataCondition{
				Operator: cstring.StringConditionOperatorStartsWith,
				Key:      "version",
				Value:    "v1",
			},
			entity: struct {
				Metadata map[string]string `json:"metadata"`
			}{
				Metadata: map[string]string{
					"version": "v1.2.3",
				},
			},
			wantMatch: true,
			wantErr:   false,
		},
		{
			name: "starts-with operator does not match",
			condition: MetadataCondition{
				Operator: cstring.StringConditionOperatorStartsWith,
				Key:      "version",
				Value:    "v2",
			},
			entity: struct {
				Metadata map[string]string `json:"metadata"`
			}{
				Metadata: map[string]string{
					"version": "v1.2.3",
				},
			},
			wantMatch: false,
			wantErr:   false,
		},
		{
			name: "ends-with operator matches",
			condition: MetadataCondition{
				Operator: cstring.StringConditionOperatorEndsWith,
				Key:      "region",
				Value:    "east",
			},
			entity: struct {
				Metadata map[string]string `json:"metadata"`
			}{
				Metadata: map[string]string{
					"region": "us-east",
				},
			},
			wantMatch: true,
			wantErr:   false,
		},
		{
			name: "ends-with operator does not match",
			condition: MetadataCondition{
				Operator: cstring.StringConditionOperatorEndsWith,
				Key:      "region",
				Value:    "west",
			},
			entity: struct {
				Metadata map[string]string `json:"metadata"`
			}{
				Metadata: map[string]string{
					"region": "us-east",
				},
			},
			wantMatch: false,
			wantErr:   false,
		},
		{
			name: "contains operator matches",
			condition: MetadataCondition{
				Operator: cstring.StringConditionOperatorContains,
				Key:      "description",
				Value:    "test",
			},
			entity: struct {
				Metadata map[string]string `json:"metadata"`
			}{
				Metadata: map[string]string{
					"description": "this is a test description",
				},
			},
			wantMatch: true,
			wantErr:   false,
		},
		{
			name: "contains operator does not match",
			condition: MetadataCondition{
				Operator: cstring.StringConditionOperatorContains,
				Key:      "description",
				Value:    "production",
			},
			entity: struct {
				Metadata map[string]string `json:"metadata"`
			}{
				Metadata: map[string]string{
					"description": "this is a test description",
				},
			},
			wantMatch: false,
			wantErr:   false,
		},
		{
			name: "missing metadata field",
			condition: MetadataCondition{
				Operator: cstring.StringConditionOperatorEquals,
				Key:      "env",
				Value:    "production",
			},
			entity: struct {
				Name string `json:"name"`
			}{
				Name: "test",
			},
			wantMatch: false,
			wantErr:   false,
		},
		{
			name: "missing metadata key",
			condition: MetadataCondition{
				Operator: cstring.StringConditionOperatorEquals,
				Key:      "missing",
				Value:    "value",
			},
			entity: struct {
				Metadata map[string]string `json:"metadata"`
			}{
				Metadata: map[string]string{
					"env": "production",
				},
			},
			wantMatch: false,
			wantErr:   false,
		},
		{
			name: "metadata is not a map",
			condition: MetadataCondition{
				Operator: cstring.StringConditionOperatorEquals,
				Key:      "env",
				Value:    "production",
			},
			entity: struct {
				Metadata string `json:"metadata"`
			}{
				Metadata: "not a map",
			},
			wantMatch: false,
			wantErr:   true,
			errMsg:    "field Metadata is not a map",
		},
		{
			name: "metadata is wrong type of map",
			condition: MetadataCondition{
				Operator: cstring.StringConditionOperatorEquals,
				Key:      "env",
				Value:    "production",
			},
			entity: struct {
				Metadata map[string]int `json:"metadata"`
			}{
				Metadata: map[string]int{
					"env": 123,
				},
			},
			wantMatch: false,
			wantErr:   true,
			errMsg:    "field Metadata is not a map",
		},
		{
			name: "empty metadata map",
			condition: MetadataCondition{
				Operator: cstring.StringConditionOperatorEquals,
				Key:      "env",
				Value:    "production",
			},
			entity: struct {
				Metadata map[string]string `json:"metadata"`
			}{
				Metadata: map[string]string{},
			},
			wantMatch: false,
			wantErr:   false,
		},
		{
			name: "multiple metadata keys present",
			condition: MetadataCondition{
				Operator: cstring.StringConditionOperatorEquals,
				Key:      "env",
				Value:    "production",
			},
			entity: struct {
				Metadata map[string]string `json:"metadata"`
			}{
				Metadata: map[string]string{
					"env":     "production",
					"region":  "us-east",
					"version": "v1.0.0",
				},
			},
			wantMatch: true,
			wantErr:   false,
		},
		{
			name: "empty value matches empty metadata value",
			condition: MetadataCondition{
				Operator: cstring.StringConditionOperatorEquals,
				Key:      "env",
				Value:    "",
			},
			entity: struct {
				Metadata map[string]string `json:"metadata"`
			}{
				Metadata: map[string]string{
					"env": "",
				},
			},
			wantMatch: true,
			wantErr:   false,
		},
		{
			name: "case sensitive comparison",
			condition: MetadataCondition{
				Operator: cstring.StringConditionOperatorEquals,
				Key:      "env",
				Value:    "Production",
			},
			entity: struct {
				Metadata map[string]string `json:"metadata"`
			}{
				Metadata: map[string]string{
					"env": "production",
				},
			},
			wantMatch: false,
			wantErr:   false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			matched, err := tt.condition.Matches(tt.entity)

			if (err != nil) != tt.wantErr {
				t.Errorf("MetadataCondition.Matches() error = %v, wantErr %v", err, tt.wantErr)
				return
			}

			if tt.wantErr && err != nil && tt.errMsg != "" && err.Error() != tt.errMsg {
				t.Errorf("MetadataCondition.Matches() error message = %v, want %v", err.Error(), tt.errMsg)
			}

			if matched != tt.wantMatch {
				t.Errorf("MetadataCondition.Matches() = %v, want %v", matched, tt.wantMatch)
			}
		})
	}
}

func TestConvertFromUnknownCondition(t *testing.T) {
	tests := []struct {
		name      string
		condition unknown.UnknownCondition
		want      MetadataCondition
		wantErr   bool
		errMsg    string
	}{
		{
			name: "valid equals operator",
			condition: unknown.UnknownCondition{
				Property:    "metadata",
				Operator:    "equals",
				Value:       "production",
				MetadataKey: "env",
			},
			want: MetadataCondition{
				Operator: cstring.StringConditionOperatorEquals,
				Key:      "env",
				Value:    "production",
			},
			wantErr: false,
		},
		{
			name: "valid starts-with operator",
			condition: unknown.UnknownCondition{
				Property:    "metadata",
				Operator:    "starts-with",
				Value:       "v1",
				MetadataKey: "version",
			},
			want: MetadataCondition{
				Operator: cstring.StringConditionOperatorStartsWith,
				Key:      "version",
				Value:    "v1",
			},
			wantErr: false,
		},
		{
			name: "valid ends-with operator",
			condition: unknown.UnknownCondition{
				Property:    "metadata",
				Operator:    "ends-with",
				Value:       "east",
				MetadataKey: "region",
			},
			want: MetadataCondition{
				Operator: cstring.StringConditionOperatorEndsWith,
				Key:      "region",
				Value:    "east",
			},
			wantErr: false,
		},
		{
			name: "valid contains operator",
			condition: unknown.UnknownCondition{
				Property:    "metadata",
				Operator:    "contains",
				Value:       "test",
				MetadataKey: "description",
			},
			want: MetadataCondition{
				Operator: cstring.StringConditionOperatorContains,
				Key:      "description",
				Value:    "test",
			},
			wantErr: false,
		},
		{
			name: "invalid operator",
			condition: unknown.UnknownCondition{
				Property:    "metadata",
				Operator:    "greater-than",
				Value:       "100",
				MetadataKey: "count",
			},
			wantErr: true,
			errMsg:  "invalid string operator: greater-than",
		},
		{
			name: "empty metadata key",
			condition: unknown.UnknownCondition{
				Property:    "metadata",
				Operator:    "equals",
				Value:       "production",
				MetadataKey: "",
			},
			wantErr: true,
			errMsg:  "metadata key cannot be empty",
		},
		{
			name: "wrong property type",
			condition: unknown.UnknownCondition{
				Property:    "name",
				Operator:    "equals",
				Value:       "test",
				MetadataKey: "env",
			},
			wantErr: true,
			errMsg:  "property must be 'metadata', got 'name'",
		},
		{
			name: "invalid operator with valid metadata key",
			condition: unknown.UnknownCondition{
				Property:    "metadata",
				Operator:    "not-equals",
				Value:       "staging",
				MetadataKey: "env",
			},
			wantErr: true,
			errMsg:  "invalid string operator: not-equals",
		},
		{
			name: "empty value with valid operator",
			condition: unknown.UnknownCondition{
				Property:    "metadata",
				Operator:    "equals",
				Value:       "",
				MetadataKey: "env",
			},
			want: MetadataCondition{
				Operator: cstring.StringConditionOperatorEquals,
				Key:      "env",
				Value:    "",
			},
			wantErr: false,
		},
		{
			name: "property with different casing - Metadata",
			condition: unknown.UnknownCondition{
				Property:    "Metadata",
				Operator:    "equals",
				Value:       "test",
				MetadataKey: "key",
			},
			want: MetadataCondition{
				Operator: cstring.StringConditionOperatorEquals,
				Key:      "key",
				Value:    "test",
			},
			wantErr: false,
		},
		{
			name: "invalid property",
			condition: unknown.UnknownCondition{
				Property:    "invalid",
				Operator:    "equals",
				Value:       "test",
				MetadataKey: "key",
			},
			wantErr: true,
			errMsg:  "property must be 'metadata', got 'invalid'",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := ConvertFromUnknownCondition(tt.condition)

			if (err != nil) != tt.wantErr {
				t.Errorf("ConvertFromUnknownCondition() error = %v, wantErr %v", err, tt.wantErr)
				return
			}

			if tt.wantErr {
				if err != nil && tt.errMsg != "" && err.Error() != tt.errMsg {
					t.Errorf("ConvertFromUnknownCondition() error message = %v, want %v", err.Error(), tt.errMsg)
				}
				return
			}

			if got.Operator != tt.want.Operator {
				t.Errorf("ConvertFromUnknownCondition() Operator = %v, want %v", got.Operator, tt.want.Operator)
			}

			if got.Key != tt.want.Key {
				t.Errorf("ConvertFromUnknownCondition() Key = %v, want %v", got.Key, tt.want.Key)
			}

			if got.Value != tt.want.Value {
				t.Errorf("ConvertFromUnknownCondition() Value = %v, want %v", got.Value, tt.want.Value)
			}
		})
	}
}

func TestMetadataCondition_Integration(t *testing.T) {
	t.Run("complete workflow - convert and match", func(t *testing.T) {
		unknownCondition := unknown.UnknownCondition{
			Property:    "metadata",
			Operator:    "starts-with",
			Value:       "prod",
			MetadataKey: "env",
		}

		condition, err := ConvertFromUnknownCondition(unknownCondition)
		if err != nil {
			t.Fatalf("ConvertFromUnknownCondition() unexpected error = %v", err)
		}

		entity := struct {
			Name     string            `json:"name"`
			Metadata map[string]string `json:"metadata"`
		}{
			Name: "test-entity",
			Metadata: map[string]string{
				"env":    "production",
				"region": "us-east",
			},
		}

		matched, err := condition.Matches(entity)
		if err != nil {
			t.Errorf("Matches() unexpected error = %v", err)
		}

		if !matched {
			t.Errorf("Matches() = false, want true for starts-with 'prod' in 'production'")
		}
	})

	t.Run("multiple metadata conditions", func(t *testing.T) {
		entity := struct {
			Metadata map[string]string `json:"metadata"`
		}{
			Metadata: map[string]string{
				"env":     "production",
				"region":  "us-east-1",
				"version": "v2.3.4",
			},
		}

		conditions := []MetadataCondition{
			{
				Operator: cstring.StringConditionOperatorEquals,
				Key:      "env",
				Value:    "production",
			},
			{
				Operator: cstring.StringConditionOperatorStartsWith,
				Key:      "region",
				Value:    "us-east",
			},
			{
				Operator: cstring.StringConditionOperatorContains,
				Key:      "version",
				Value:    "2.3",
			},
		}

		for i, condition := range conditions {
			matched, err := condition.Matches(entity)
			if err != nil {
				t.Errorf("condition %d: Matches() unexpected error = %v", i, err)
			}
			if !matched {
				t.Errorf("condition %d: Matches() = false, want true", i)
			}
		}
	})
}
