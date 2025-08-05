package selector

import (
	"fmt"
	"workspace-engine/pkg/model/resource"
)

// MaxDepthAllowed defines the maximum nesting depth for conditions
const MaxDepthAllowed = 2

// ComparisonCondition represents a logical combination of conditions
type ComparisonCondition struct {
	TypeField  ConditionType      `json:"type"`
	Operator   ComparisonOperator `json:"operator"`
	Conditions []Condition        `json:"conditions"`
}

// Type returns the selector type
func (c ComparisonCondition) Type() ConditionType {
	return ConditionTypeComparison
}

// validate will check depth and the for nested ComparisonConditions only, as this is the only case where
// depth can increase. Other condition types do not support nesting.
func (c ComparisonCondition) validateDepth(depth int) error {
	if depth >= MaxDepthAllowed {
		return fmt.Errorf("maximum selector depth (%d) exceeded", MaxDepthAllowed)
	}

	for i, cond := range c.Conditions {
		if compCond, ok := cond.(ComparisonCondition); ok {
			if err := compCond.validateDepth(depth + 1); err != nil {
				return fmt.Errorf("validation failed for sub-selector at index %d: %v", i, err)
			}
		}
	}

	return nil
}

func (c ComparisonCondition) validate() error {
	if c.TypeField != ConditionTypeComparison {
		return fmt.Errorf("invalid type for comparison selector: %s", c.TypeField)
	}

	if err := ValidateComparisonOperator(string(c.Operator)); err != nil {
		return err
	}

	if len(c.Conditions) == 0 {
		return fmt.Errorf("comparison selector must have at least one sub-selector")
	}
	return nil
}

// Matches checks if the resource matches the comparison selector
func (c ComparisonCondition) Matches(resource resource.Resource) (bool, error) {
	var ok bool
	var err error
	if err = c.validateDepth(0); err != nil {
		return false, err
	}
	if err = c.validate(); err != nil {
		return false, err
	}
	switch c.Operator {
	case ComparisonOperatorAnd:
		for _, cond := range c.Conditions {
			if ok, err = cond.Matches(resource); err != nil {
				return false, err
			} else if !ok {
				return false, nil
			}
		}
		return true, nil
	case ComparisonOperatorOr:
		for _, cond := range c.Conditions {
			if ok, err = cond.Matches(resource); err != nil {
				return false, err
			} else if ok {
				return true, nil
			}
		}
		return false, nil
	}
	return false, fmt.Errorf("invalid comparison operator: %s", c.Operator)
}
