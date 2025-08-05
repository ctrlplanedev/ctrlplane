package selector

import (
	"testing"
)

func TestComparisonCondition(t *testing.T) {
	// Create some valid sub-conditions
	idCond := IDCondition{
		TypeField: ConditionTypeID,
		Operator:  "equals",
		Value:     "123",
	}
	nameCond := NameCondition{
		TypeField: ConditionTypeName,
		Operator:  ColumnOperatorEquals,
		Value:     "test",
	}

	tests := []struct {
		name    string
		cond    ComparisonCondition
		wantErr bool
	}{
		{
			name: "valid AND selector",
			cond: ComparisonCondition{
				TypeField:  ConditionTypeComparison,
				Operator:   ComparisonOperatorAnd,
				Conditions: []Condition{idCond, nameCond},
			},
			wantErr: false,
		},
		{
			name: "valid OR selector",
			cond: ComparisonCondition{
				TypeField:  ConditionTypeComparison,
				Operator:   ComparisonOperatorOr,
				Conditions: []Condition{idCond, nameCond},
			},
			wantErr: false,
		},
		{
			name: "empty conditions",
			cond: ComparisonCondition{
				TypeField:  ConditionTypeComparison,
				Operator:   ComparisonOperatorAnd,
				Conditions: []Condition{},
			},
			wantErr: true,
		},
		{
			name: "invalid operator",
			cond: ComparisonCondition{
				TypeField:  ConditionTypeComparison,
				Operator:   "xor",
				Conditions: []Condition{idCond},
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// result doesn't matter, only testing for validation errors
			_, err := tt.cond.Matches(resourceFixture())
			if (err != nil) != tt.wantErr {
				t.Errorf("Match() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestNestedComparisonCondition(t *testing.T) {
	// Create a nested comparison selector to test depth validation
	idCond := IDCondition{
		TypeField: ConditionTypeID,
		Operator:  "equals",
		Value:     "123",
	}

	// Level 1 comparison
	level1 := ComparisonCondition{
		TypeField:  ConditionTypeComparison,
		Operator:   ComparisonOperatorAnd,
		Conditions: []Condition{idCond},
	}

	// Level 2 comparison (should be valid)
	level2 := ComparisonCondition{
		TypeField:  ConditionTypeComparison,
		Operator:   ComparisonOperatorOr,
		Conditions: []Condition{level1},
	}

	// result doesn't matter, only testing for validation errors
	_, err := level2.Matches(resourceFixture())
	if err != nil {
		t.Errorf("Level 2 nested selector should be valid, got error: %v", err)
	}

	// Level 3 comparison
	level3 := ComparisonCondition{
		TypeField:  ConditionTypeComparison,
		Operator:   ComparisonOperatorAnd,
		Conditions: []Condition{level2},
	}

	// Level 4 comparison (should exceed max depth)
	level4 := ComparisonCondition{
		TypeField:  ConditionTypeComparison,
		Operator:   ComparisonOperatorAnd,
		Conditions: []Condition{level3},
	}

	// result doesn't matter, only testing for validation errors
	_, err = level4.Matches(resourceFixture())
	if err == nil {
		t.Error("Level 3 nested selector should exceed max depth, but validation passed")
	}
}
