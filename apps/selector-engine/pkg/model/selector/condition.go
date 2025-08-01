package selector

import (
	"fmt"
	"github.com/ctrlplanedev/selector-engine/pkg/model/resource"
)

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

// Validate validates the comparison selector
func (c ComparisonCondition) Validate() error {
	return c.validate(0)
}

func (c ComparisonCondition) validate(depth int) error {
	if c.TypeField != ConditionTypeComparison {
		return fmt.Errorf("invalid type for comparison selector: %s", c.TypeField)
	}

	if err := ValidateComparisonOperator(string(c.Operator)); err != nil {
		return err
	}

	if len(c.Conditions) == 0 {
		return fmt.Errorf("comparison selector must have at least one sub-selector")
	}

	if err := depthCheck(depth); err != nil {
		return err
	}

	for i, cond := range c.Conditions {
		if err := cond.validate(depth + 1); err != nil {
			return fmt.Errorf("validation failed for sub-selector at index %d: %v", i, err)
		}
	}

	return nil
}

// Matches checks if the resource matches the comparison selector
func (c ComparisonCondition) Matches(resource resource.Resource) (bool, error) {
	var ok bool
	var err error
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
