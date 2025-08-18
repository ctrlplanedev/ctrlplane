package operations

import (
	"testing"
	"workspace-engine/pkg/model/conditions"
)

func TestCompareMetadataCondition(t *testing.T) {
	tests := []struct {
		name      string
		operator  conditions.StringConditionOperator
		aValue    string
		bValue    string
		wantMatch bool
		wantErr   bool
	}{
		// Equals
		{
			name:      "Equals - match",
			operator:  conditions.StringConditionOperatorEquals,
			aValue:    "hello",
			bValue:    "hello",
			wantMatch: true,
			wantErr:   false,
		},
		{
			name:      "Equals - no match",
			operator:  conditions.StringConditionOperatorEquals,
			aValue:    "hello",
			bValue:    "world",
			wantMatch: false,
			wantErr:   false,
		},
		// StartsWith
		{
			name:      "StartsWith - match",
			operator:  conditions.StringConditionOperatorStartsWith,
			aValue:    "hello world",
			bValue:    "hello",
			wantMatch: true,
			wantErr:   false,
		},
		{
			name:      "StartsWith - no match",
			operator:  conditions.StringConditionOperatorStartsWith,
			aValue:    "hello world",
			bValue:    "world",
			wantMatch: false,
			wantErr:   false,
		},
		// EndsWith
		{
			name:      "EndsWith - match",
			operator:  conditions.StringConditionOperatorEndsWith,
			aValue:    "hello world",
			bValue:    "world",
			wantMatch: true,
			wantErr:   false,
		},
		{
			name:      "EndsWith - no match",
			operator:  conditions.StringConditionOperatorEndsWith,
			aValue:    "hello world",
			bValue:    "hello",
			wantMatch: false,
			wantErr:   false,
		},
		// Contains
		{
			name:      "Contains - match",
			operator:  conditions.StringConditionOperatorContains,
			aValue:    "hello world",
			bValue:    "lo wo",
			wantMatch: true,
			wantErr:   false,
		},
		{
			name:      "Contains - no match",
			operator:  conditions.StringConditionOperatorContains,
			aValue:    "hello world",
			bValue:    "goodbye",
			wantMatch: false,
			wantErr:   false,
		},
		// Invalid operator
		{
			name:      "Invalid operator",
			operator:  "invalid",
			aValue:    "hello",
			bValue:    "world",
			wantMatch: false,
			wantErr:   true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := compareMetadataCondition(tt.operator, tt.aValue, tt.bValue)
			if (err != nil) != tt.wantErr {
				t.Errorf("compareMetadataCondition() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if got != tt.wantMatch {
				t.Errorf("compareMetadataCondition() = %v, want %v", got, tt.wantMatch)
			}
		})
	}
}

func TestMetadataConditionMatches(t *testing.T) {
	type testStruct struct {
		Metadata map[string]string `json:"metadata"`
	}

	type testStructInvalidMetadataType struct {
		Metadata int `json:"metadata"`
	}

	type testStructInvalidMetadataMapType struct {
		Metadata map[string]int `json:"metadata"`
	}

	entity := testStruct{
		Metadata: map[string]string{
			"key1": "value1",
			"key2": "hello world",
		},
	}

	tests := []struct {
		name      string
		entity    any
		operator  conditions.StringConditionOperator
		field     string
		value     string
		wantMatch bool
		wantErr   bool
	}{
		{
			name:      "Equals - match",
			entity:    entity,
			operator:  conditions.StringConditionOperatorEquals,
			field:     "key1",
			value:     "value1",
			wantMatch: true,
			wantErr:   false,
		},
		{
			name:      "StartsWith - match",
			entity:    entity,
			operator:  conditions.StringConditionOperatorStartsWith,
			field:     "key2",
			value:     "hello",
			wantMatch: true,
			wantErr:   false,
		},
		{
			name:      "EndsWith - match",
			entity:    entity,
			operator:  conditions.StringConditionOperatorEndsWith,
			field:     "key2",
			value:     "world",
			wantMatch: true,
			wantErr:   false,
		},
		{
			name:      "Contains - match",
			entity:    entity,
			operator:  conditions.StringConditionOperatorContains,
			field:     "key2",
			value:     "lo wo",
			wantMatch: true,
			wantErr:   false,
		},
		{
			name:      "No match",
			entity:    entity,
			operator:  conditions.StringConditionOperatorEquals,
			field:     "key1",
			value:     "goodbye",
			wantMatch: false,
			wantErr:   false,
		},
		{
			name:      "Key not found",
			entity:    entity,
			operator:  conditions.StringConditionOperatorEquals,
			field:     "NonExistentKey",
			value:     "hello",
			wantMatch: false,
			wantErr:   false, // Should not error, just not match
		},
		{
			name:      "Entity without metadata field",
			entity:    struct{}{},
			operator:  conditions.StringConditionOperatorEquals,
			field:     "key1",
			value:     "value1",
			wantMatch: false,
			wantErr:   false, // Should not error, just not match
		},
		{
			name:      "Metadata field not a map",
			entity:    testStructInvalidMetadataType{Metadata: 123},
			operator:  conditions.StringConditionOperatorEquals,
			field:     "key1",
			value:     "value1",
			wantMatch: false,
			wantErr:   true,
		},
		{
			name:      "Metadata map with wrong type",
			entity:    testStructInvalidMetadataMapType{Metadata: map[string]int{"key1": 1}},
			operator:  conditions.StringConditionOperatorEquals,
			field:     "key1",
			value:     "value1",
			wantMatch: false,
			wantErr:   true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := MetadataConditionMatches(tt.entity, tt.operator, tt.field, tt.value)
			if (err != nil) != tt.wantErr {
				t.Errorf("MetadataConditionMatches() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if got != tt.wantMatch {
				t.Errorf("MetadataConditionMatches() = %v, want %v", got, tt.wantMatch)
			}
		})
	}
}
