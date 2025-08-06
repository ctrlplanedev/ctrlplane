package operations

import (
	types "workspace-engine/pkg/model/conditions"
)

func ComparisonConditionMatches(entity any, operator types.ComparisonConditionOperator, conditions []JSONSelector) (bool, error) {
	switch operator {
	case types.ComparisonConditionOperatorAnd:
		for _, condition := range conditions {
			ok, err := condition.Matches(entity)
			if err != nil {
				return false, err
			}
			if !ok {
				return false, nil // Return false if any condition is false
			}
		}
		return true, nil // Return true only if all conditions are true
	case types.ComparisonConditionOperatorOr:
		for _, condition := range conditions {
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
