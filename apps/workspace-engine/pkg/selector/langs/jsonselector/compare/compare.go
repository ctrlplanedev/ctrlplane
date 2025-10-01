package compare

import (
	"fmt"
	"workspace-engine/pkg/selector/langs/jsonselector/unknown"
)

type ComparisonConditionOperator string

const (
	ComparisonConditionOperatorAnd ComparisonConditionOperator = "and"
	ComparisonConditionOperatorOr  ComparisonConditionOperator = "or"
)

type ComparisonCondition struct {
	Operator   ComparisonConditionOperator  `json:"operator"`
	Conditions []unknown.MatchableCondition `json:"conditions"`
}

func (c ComparisonCondition) Matches(entity any) (bool, error) {
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

func ConvertFromUnknownCondition(condition unknown.UnknownCondition) (ComparisonCondition, error) {
	validOperators := map[ComparisonConditionOperator]struct{}{
		ComparisonConditionOperatorAnd: {},
		ComparisonConditionOperatorOr:  {},
	}

	op := ComparisonConditionOperator(condition.Operator)
	if _, ok := validOperators[op]; !ok {
		return ComparisonCondition{}, fmt.Errorf("invalid condition type: %s", condition.Operator)
	}

	matchableConditions := make([]unknown.MatchableCondition, len(condition.Conditions))
	var err error
	for i, c := range condition.Conditions {
		matchableConditions[i], err = ConvertToSelector(c)
		if err != nil {
			return ComparisonCondition{}, err
		}
	}

	return ComparisonCondition{
		Operator:   op,
		Conditions: matchableConditions,
	}, nil
}
