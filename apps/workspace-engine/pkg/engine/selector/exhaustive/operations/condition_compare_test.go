package operations

import (
	"errors"
	"testing"
	"workspace-engine/pkg/model/conditions"
)

// mockJSONSelector is a mock implementation of the JSONSelector interface for testing.
type mockJSONSelector struct {
	matches bool
	err     error
}

func (m *mockJSONSelector) Matches(_entity any) (bool, error) {
	return m.matches, m.err
}

func TestComparisonConditionMatches(t *testing.T) {
	trueCond := &mockJSONSelector{matches: true}
	falseCond := &mockJSONSelector{matches: false}
	errorCond := &mockJSONSelector{err: errors.New("test error")}

	tests := []struct {
		name       string
		operator   conditions.ComparisonConditionOperator
		conditions []JSONSelector
		wantMatch  bool
		wantErr    bool
	}{
		// AND operator tests
		{
			name:       "AND with all true conditions",
			operator:   conditions.ComparisonConditionOperatorAnd,
			conditions: []JSONSelector{trueCond, trueCond, trueCond},
			wantMatch:  true,
			wantErr:    false,
		},
		{
			name:       "AND with one false condition",
			operator:   conditions.ComparisonConditionOperatorAnd,
			conditions: []JSONSelector{trueCond, falseCond, trueCond},
			wantMatch:  false,
			wantErr:    false,
		},
		{
			name:       "AND with all false conditions",
			operator:   conditions.ComparisonConditionOperatorAnd,
			conditions: []JSONSelector{falseCond, falseCond, falseCond},
			wantMatch:  false,
			wantErr:    false,
		},
		{
			name:       "AND with empty conditions",
			operator:   conditions.ComparisonConditionOperatorAnd,
			conditions: []JSONSelector{},
			wantMatch:  true,
			wantErr:    false,
		},
		{
			name:       "AND with an error condition",
			operator:   conditions.ComparisonConditionOperatorAnd,
			conditions: []JSONSelector{trueCond, errorCond, trueCond},
			wantMatch:  false,
			wantErr:    true,
		},

		// OR operator tests
		{
			name:       "OR with one true condition",
			operator:   conditions.ComparisonConditionOperatorOr,
			conditions: []JSONSelector{falseCond, trueCond, falseCond},
			wantMatch:  true,
			wantErr:    false,
		},
		{
			name:       "OR with all true conditions",
			operator:   conditions.ComparisonConditionOperatorOr,
			conditions: []JSONSelector{trueCond, trueCond, trueCond},
			wantMatch:  true,
			wantErr:    false,
		},
		{
			name:       "OR with all false conditions",
			operator:   conditions.ComparisonConditionOperatorOr,
			conditions: []JSONSelector{falseCond, falseCond, falseCond},
			wantMatch:  false,
			wantErr:    false,
		},
		{
			name:       "OR with empty conditions",
			operator:   conditions.ComparisonConditionOperatorOr,
			conditions: []JSONSelector{},
			wantMatch:  false,
			wantErr:    false,
		},
		{
			name:       "OR with an error condition",
			operator:   conditions.ComparisonConditionOperatorOr,
			conditions: []JSONSelector{falseCond, errorCond, trueCond},
			wantMatch:  false,
			wantErr:    true,
		},

		// Invalid operator test
		{
			name:       "Invalid operator",
			operator:   "INVALID_OPERATOR",
			conditions: []JSONSelector{trueCond},
			wantMatch:  false,
			wantErr:    false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// The entity doesn't matter for this test as we use mocks
			entity := struct{}{}
			matched, err := ComparisonConditionMatches(entity, tt.operator, tt.conditions)

			if (err != nil) != tt.wantErr {
				t.Errorf("ComparisonConditionMatches() error = %v, wantErr %v", err, tt.wantErr)
				return
			}

			if matched != tt.wantMatch {
				t.Errorf("ComparisonConditionMatches() = %v, want %v", matched, tt.wantMatch)
			}
		})
	}
}
