package operations

import (
	"testing"
	"workspace-engine/pkg/model/conditions"
)

func TestCompareStringCondition(t *testing.T) {
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
			got, err := compareStringCondition(tt.operator, tt.aValue, tt.bValue)
			if (err != nil) != tt.wantErr {
				t.Errorf("compareStringCondition() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if got != tt.wantMatch {
				t.Errorf("compareStringCondition() = %v, want %v", got, tt.wantMatch)
			}
		})
	}
}

func TestStringConditionMatches(t *testing.T) {
	type testStruct struct {
		StringField string
		IntField    int
	}

	entity := testStruct{
		StringField: "hello world",
		IntField:    123,
	}

	tests := []struct {
		name      string
		operator  conditions.StringConditionOperator
		field     string
		value     string
		wantMatch bool
		wantErr   bool
	}{
		{
			name:      "Equals - match",
			operator:  conditions.StringConditionOperatorEquals,
			field:     "StringField",
			value:     "hello world",
			wantMatch: true,
			wantErr:   false,
		},
		{
			name:      "StartsWith - match",
			operator:  conditions.StringConditionOperatorStartsWith,
			field:     "StringField",
			value:     "hello",
			wantMatch: true,
			wantErr:   false,
		},
		{
			name:      "EndsWith - match",
			operator:  conditions.StringConditionOperatorEndsWith,
			field:     "StringField",
			value:     "world",
			wantMatch: true,
			wantErr:   false,
		},
		{
			name:      "Contains - match",
			operator:  conditions.StringConditionOperatorContains,
			field:     "StringField",
			value:     "lo wo",
			wantMatch: true,
			wantErr:   false,
		},
		{
			name:      "No match",
			operator:  conditions.StringConditionOperatorEquals,
			field:     "StringField",
			value:     "goodbye",
			wantMatch: false,
			wantErr:   false,
		},
		{
			name:      "Field not found",
			operator:  conditions.StringConditionOperatorEquals,
			field:     "NonExistentField",
			value:     "hello",
			wantMatch: false,
			wantErr:   true,
		},
		{
			name:      "Field not a string",
			operator:  conditions.StringConditionOperatorEquals,
			field:     "IntField",
			value:     "123",
			wantMatch: false,
			wantErr:   true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := StringConditionMatches(entity, tt.operator, tt.field, tt.value)
			if (err != nil) != tt.wantErr {
				t.Errorf("StringConditionMatches() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if got != tt.wantMatch {
				t.Errorf("StringConditionMatches() = %v, want %v", got, tt.wantMatch)
			}
		})
	}
}
