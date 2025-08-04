package operations

import "workspace-engine/pkg/engine/selector"

type ComparisonConditionOperator string

const (
	ComparisonConditionOperatorAnd ComparisonConditionOperator = "and" 
	ComparisonConditionOperatorOr  ComparisonConditionOperator = "or"
)

type ComparisonCondition struct {
	Operator  ComparisonConditionOperator `json:"operator"`
	Conditions []Condition                `json:"conditions"`
}

func (c ComparisonCondition) Matches(entity selector.MatchableEntity) (bool, error) {
	switch c.Operator {
	case ComparisonConditionOperatorAnd:
		for _, condition := range c.Conditions {
			ok, err := condition.Matches(entity)
			if err != nil {
				return false, err
			}
			if !ok {
				return false, nil // Return false if any condition is false
			}
		}
		return true, nil // Return true only if all conditions are true
	case ComparisonConditionOperatorOr:
		for _, condition := range c.Conditions {
			ok, err := condition.Matches(entity)
			if err != nil {
				return false, err
			}
			if ok {
				return true, nil // Return true if any condition matches
			}
		}
		return false, nil // Return false if no conditions match
	}
	return false, nil
}