package compare

import (
	"errors"
	"testing"
	"workspace-engine/pkg/selector/langs/jsonselector/unknown"
	"workspace-engine/pkg/selector/langs/util"
)

// mockMatchableCondition is a mock implementation of the MatchableCondition interface for testing.
type mockMatchableCondition struct {
	matches bool
	err     error
}

func (m *mockMatchableCondition) Matches(_entity any) (bool, error) {
	return m.matches, m.err
}

func TestComparisonCondition_Matches_And(t *testing.T) {
	tests := []struct {
		name       string
		conditions []util.MatchableCondition
		wantMatch  bool
		wantErr    bool
	}{
		{
			name: "all true conditions",
			conditions: []util.MatchableCondition{
				&mockMatchableCondition{matches: true},
				&mockMatchableCondition{matches: true},
				&mockMatchableCondition{matches: true},
			},
			wantMatch: true,
			wantErr:   false,
		},
		{
			name: "one false condition",
			conditions: []util.MatchableCondition{
				&mockMatchableCondition{matches: true},
				&mockMatchableCondition{matches: false},
				&mockMatchableCondition{matches: true},
			},
			wantMatch: false,
			wantErr:   false,
		},
		{
			name: "all false conditions",
			conditions: []util.MatchableCondition{
				&mockMatchableCondition{matches: false},
				&mockMatchableCondition{matches: false},
				&mockMatchableCondition{matches: false},
			},
			wantMatch: false,
			wantErr:   false,
		},
		{
			name:       "empty conditions",
			conditions: []util.MatchableCondition{},
			wantMatch:  true,
			wantErr:    false,
		},
		{
			name: "first condition has error",
			conditions: []util.MatchableCondition{
				&mockMatchableCondition{err: errors.New("test error")},
				&mockMatchableCondition{matches: true},
			},
			wantMatch: false,
			wantErr:   true,
		},
		{
			name: "middle condition has error",
			conditions: []util.MatchableCondition{
				&mockMatchableCondition{matches: true},
				&mockMatchableCondition{err: errors.New("test error")},
				&mockMatchableCondition{matches: true},
			},
			wantMatch: false,
			wantErr:   true,
		},
		{
			name: "error after false condition - should short circuit",
			conditions: []util.MatchableCondition{
				&mockMatchableCondition{matches: false},
				&mockMatchableCondition{err: errors.New("test error")},
			},
			wantMatch: false,
			wantErr:   false,
		},
		{
			name: "single true condition",
			conditions: []util.MatchableCondition{
				&mockMatchableCondition{matches: true},
			},
			wantMatch: true,
			wantErr:   false,
		},
		{
			name: "single false condition",
			conditions: []util.MatchableCondition{
				&mockMatchableCondition{matches: false},
			},
			wantMatch: false,
			wantErr:   false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			c := ComparisonCondition{
				Operator:   ComparisonConditionOperatorAnd,
				Conditions: tt.conditions,
			}
			entity := struct{}{}
			matched, err := c.Matches(entity)

			if (err != nil) != tt.wantErr {
				t.Errorf("ComparisonCondition.Matches() error = %v, wantErr %v", err, tt.wantErr)
				return
			}

			if matched != tt.wantMatch {
				t.Errorf("ComparisonCondition.Matches() = %v, want %v", matched, tt.wantMatch)
			}
		})
	}
}

func TestComparisonCondition_Matches_Or(t *testing.T) {
	tests := []struct {
		name       string
		conditions []util.MatchableCondition
		wantMatch  bool
		wantErr    bool
	}{
		{
			name: "one true condition",
			conditions: []util.MatchableCondition{
				&mockMatchableCondition{matches: false},
				&mockMatchableCondition{matches: true},
				&mockMatchableCondition{matches: false},
			},
			wantMatch: true,
			wantErr:   false,
		},
		{
			name: "all true conditions",
			conditions: []util.MatchableCondition{
				&mockMatchableCondition{matches: true},
				&mockMatchableCondition{matches: true},
				&mockMatchableCondition{matches: true},
			},
			wantMatch: true,
			wantErr:   false,
		},
		{
			name: "all false conditions",
			conditions: []util.MatchableCondition{
				&mockMatchableCondition{matches: false},
				&mockMatchableCondition{matches: false},
				&mockMatchableCondition{matches: false},
			},
			wantMatch: false,
			wantErr:   false,
		},
		{
			name:       "empty conditions",
			conditions: []util.MatchableCondition{},
			wantMatch:  false,
			wantErr:    false,
		},
		{
			name: "first condition has error",
			conditions: []util.MatchableCondition{
				&mockMatchableCondition{err: errors.New("test error")},
				&mockMatchableCondition{matches: true},
			},
			wantMatch: false,
			wantErr:   true,
		},
		{
			name: "middle condition has error",
			conditions: []util.MatchableCondition{
				&mockMatchableCondition{matches: false},
				&mockMatchableCondition{err: errors.New("test error")},
				&mockMatchableCondition{matches: false},
			},
			wantMatch: false,
			wantErr:   true,
		},
		{
			name: "error after true condition - should short circuit",
			conditions: []util.MatchableCondition{
				&mockMatchableCondition{matches: true},
				&mockMatchableCondition{err: errors.New("test error")},
			},
			wantMatch: true,
			wantErr:   false,
		},
		{
			name: "single true condition",
			conditions: []util.MatchableCondition{
				&mockMatchableCondition{matches: true},
			},
			wantMatch: true,
			wantErr:   false,
		},
		{
			name: "single false condition",
			conditions: []util.MatchableCondition{
				&mockMatchableCondition{matches: false},
			},
			wantMatch: false,
			wantErr:   false,
		},
		{
			name: "first true condition",
			conditions: []util.MatchableCondition{
				&mockMatchableCondition{matches: true},
				&mockMatchableCondition{matches: false},
			},
			wantMatch: true,
			wantErr:   false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			c := ComparisonCondition{
				Operator:   ComparisonConditionOperatorOr,
				Conditions: tt.conditions,
			}
			entity := struct{}{}
			matched, err := c.Matches(entity)

			if (err != nil) != tt.wantErr {
				t.Errorf("ComparisonCondition.Matches() error = %v, wantErr %v", err, tt.wantErr)
				return
			}

			if matched != tt.wantMatch {
				t.Errorf("ComparisonCondition.Matches() = %v, want %v", matched, tt.wantMatch)
			}
		})
	}
}

func TestComparisonCondition_Matches_InvalidOperator(t *testing.T) {
	c := ComparisonCondition{
		Operator: "invalid",
		Conditions: []util.MatchableCondition{
			&mockMatchableCondition{matches: true},
		},
	}
	entity := struct{}{}
	matched, err := c.Matches(entity)

	if err != nil {
		t.Errorf("ComparisonCondition.Matches() with invalid operator should not error, got error = %v", err)
	}

	if matched {
		t.Errorf("ComparisonCondition.Matches() with invalid operator should return false, got %v", matched)
	}
}

func TestConvertFromUnknownCondition(t *testing.T) {
	tests := []struct {
		name      string
		condition unknown.UnknownCondition
		wantErr   bool
		errMsg    string
	}{
		{
			name: "valid AND operator with nested conditions",
			condition: unknown.UnknownCondition{
				Operator: "and",
				Conditions: []unknown.UnknownCondition{
					{
						Property: "name",
						Operator: "equals",
						Value:    "test",
					},
					{
						Property: "status",
						Operator: "equals",
						Value:    "active",
					},
				},
			},
			wantErr: false,
		},
		{
			name: "valid OR operator with nested conditions",
			condition: unknown.UnknownCondition{
				Operator: "or",
				Conditions: []unknown.UnknownCondition{
					{
						Property: "name",
						Operator: "equals",
						Value:    "test1",
					},
					{
						Property: "name",
						Operator: "equals",
						Value:    "test2",
					},
				},
			},
			wantErr: false,
		},
		{
			name: "invalid operator",
			condition: unknown.UnknownCondition{
				Operator: "invalid",
				Conditions: []unknown.UnknownCondition{
					{
						Property: "name",
						Operator: "equals",
						Value:    "test",
					},
				},
			},
			wantErr: true,
			errMsg:  "invalid condition type: invalid",
		},
		{
			name: "empty conditions array",
			condition: unknown.UnknownCondition{
				Operator:   "and",
				Conditions: []unknown.UnknownCondition{},
			},
			wantErr: false,
		},
		{
			name: "nested AND operators",
			condition: unknown.UnknownCondition{
				Operator: "and",
				Conditions: []unknown.UnknownCondition{
					{
						Operator: "and",
						Conditions: []unknown.UnknownCondition{
							{
								Property: "name",
								Operator: "equals",
								Value:    "test",
							},
						},
					},
				},
			},
			wantErr: false,
		},
		{
			name: "invalid nested condition",
			condition: unknown.UnknownCondition{
				Operator: "and",
				Conditions: []unknown.UnknownCondition{
					{
						Operator: "invalid-operator",
						Value:    "test",
					},
				},
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := ConvertFromUnknownCondition(tt.condition)

			if tt.wantErr {
				if err == nil {
					t.Errorf("ConvertFromUnknownCondition() expected error but got none")
					return
				}
				if tt.errMsg != "" && err.Error() != tt.errMsg {
					t.Errorf("ConvertFromUnknownCondition() error = %v, want %v", err.Error(), tt.errMsg)
				}
				return
			}

			if err != nil {
				t.Errorf("ConvertFromUnknownCondition() unexpected error = %v", err)
				return
			}

			if result.Operator != ComparisonConditionOperator(tt.condition.Operator) {
				t.Errorf("ConvertFromUnknownCondition() operator = %v, want %v", result.Operator, tt.condition.Operator)
			}

			if len(result.Conditions) != len(tt.condition.Conditions) {
				t.Errorf("ConvertFromUnknownCondition() conditions length = %v, want %v", len(result.Conditions), len(tt.condition.Conditions))
			}
		})
	}
}

func TestConvertFromUnknownCondition_Integration(t *testing.T) {
	// Test with actual entity matching
	t.Run("AND condition matches entity", func(t *testing.T) {
		condition := unknown.UnknownCondition{
			Operator: "and",
			Conditions: []unknown.UnknownCondition{
				{
					Property: "name",
					Operator: "starts-with",
					Value:    "test",
				},
			},
		}

		result, err := ConvertFromUnknownCondition(condition)
		if err != nil {
			t.Fatalf("ConvertFromUnknownCondition() unexpected error = %v", err)
		}

		entity := struct {
			Name string `json:"name"`
		}{
			Name: "test-name",
		}

		matched, err := result.Matches(entity)
		if err != nil {
			t.Errorf("Matches() unexpected error = %v", err)
		}

		if !matched {
			t.Errorf("Matches() = false, want true")
		}
	})

	t.Run("OR condition matches entity", func(t *testing.T) {
		condition := unknown.UnknownCondition{
			Operator: "or",
			Conditions: []unknown.UnknownCondition{
				{
					Property: "name",
					Operator: "contains",
					Value:    "foo",
				},
				{
					Property: "name",
					Operator: "contains",
					Value:    "bar",
				},
			},
		}

		result, err := ConvertFromUnknownCondition(condition)
		if err != nil {
			t.Fatalf("ConvertFromUnknownCondition() unexpected error = %v", err)
		}

		entity := struct {
			Name string `json:"name"`
		}{
			Name: "test-bar",
		}

		matched, err := result.Matches(entity)
		if err != nil {
			t.Errorf("Matches() unexpected error = %v", err)
		}

		if !matched {
			t.Errorf("Matches() = false, want true")
		}
	})
}
