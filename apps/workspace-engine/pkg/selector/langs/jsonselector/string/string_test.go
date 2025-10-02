package string

import (
	"testing"
)

func TestCompareStringCondition(t *testing.T) {
	tests := []struct {
		name      string
		operator  StringConditionOperator
		aValue    string
		bValue    string
		wantMatch bool
		wantErr   bool
	}{
		// Equals
		{
			name:      "Equals - match",
			operator:  StringConditionOperatorEquals,
			aValue:    "hello",
			bValue:    "hello",
			wantMatch: true,
			wantErr:   false,
		},
		{
			name:      "Equals - no match",
			operator:  StringConditionOperatorEquals,
			aValue:    "hello",
			bValue:    "world",
			wantMatch: false,
			wantErr:   false,
		},
		// StartsWith
		{
			name:      "StartsWith - match",
			operator:  StringConditionOperatorStartsWith,
			aValue:    "hello world",
			bValue:    "hello",
			wantMatch: true,
			wantErr:   false,
		},
		{
			name:      "StartsWith - no match",
			operator:  StringConditionOperatorStartsWith,
			aValue:    "hello world",
			bValue:    "world",
			wantMatch: false,
			wantErr:   false,
		},
		// EndsWith
		{
			name:      "EndsWith - match",
			operator:  StringConditionOperatorEndsWith,
			aValue:    "hello world",
			bValue:    "world",
			wantMatch: true,
			wantErr:   false,
		},
		{
			name:      "EndsWith - no match",
			operator:  StringConditionOperatorEndsWith,
			aValue:    "hello world",
			bValue:    "hello",
			wantMatch: false,
			wantErr:   false,
		},
		// Contains
		{
			name:      "Contains - match",
			operator:  StringConditionOperatorContains,
			aValue:    "hello world",
			bValue:    "lo wo",
			wantMatch: true,
			wantErr:   false,
		},
		{
			name:      "Contains - no match",
			operator:  StringConditionOperatorContains,
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
			got, err := CompareStringCondition(tt.operator, tt.aValue, tt.bValue)
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
