package operations

import (
	"fmt"
	"strings"
	"workspace-engine/pkg/engine/selector"
	"workspace-engine/pkg/model/conditions"
)

func compareStringCondition(operator conditions.StringConditionOperator, aValue string, bValue string) (bool, error) {
	switch operator {
	case conditions.StringConditionOperatorEquals:
		return aValue == bValue, nil
	case conditions.StringConditionOperatorStartsWith:
		return strings.HasPrefix(aValue, bValue), nil
	case conditions.StringConditionOperatorEndsWith:
		return strings.HasSuffix(aValue, bValue), nil
	case conditions.StringConditionOperatorContains:
		return strings.Contains(aValue, bValue), nil
	default:
		return false, fmt.Errorf("invalid column operator: %s", operator)
	}
}

type StringCondition struct {
	TypeField conditions.ConditionType           `json:"type"`
	Operator  conditions.StringConditionOperator `json:"operator"`
	Value     string                  `json:"value"`
}

func (c StringCondition) Matches(entity selector.MatchableEntity) (bool, error) {
	value, err := getStringProperty(entity, string(c.TypeField))
	if err != nil {
		return false, err
	}
	return compareStringCondition(c.Operator, value, c.Value)
}
