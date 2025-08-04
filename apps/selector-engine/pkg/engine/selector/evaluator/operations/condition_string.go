package operations

import (
	"fmt"
	"strings"
	"workspace-engine/pkg/engine/selector"
)

type StringConditionOperator string

const (
	StringConditionOperatorEquals     StringConditionOperator = "equals"
	StringConditionOperatorStartsWith StringConditionOperator = "starts-with"
	StringConditionOperatorEndsWith   StringConditionOperator = "ends-with"
	StringConditionOperatorContains   StringConditionOperator = "contains"
)

func compareStringCondition(operator StringConditionOperator, aValue string, bValue string) (bool, error) {
	switch operator {
	case StringConditionOperatorEquals:
		return aValue == bValue, nil
	case StringConditionOperatorStartsWith:
		return strings.HasPrefix(aValue, bValue), nil
	case StringConditionOperatorEndsWith:
		return strings.HasSuffix(aValue, bValue), nil
	case StringConditionOperatorContains:
		return strings.Contains(aValue, bValue), nil
	default:
		return false, fmt.Errorf("invalid column operator: %s", operator)
	}
}

type StringCondition struct {
	TypeField ConditionType           `json:"type"`
	Operator  StringConditionOperator `json:"operator"`
	Value     string                  `json:"value"`
}

func (c StringCondition) Matches(entity selector.MatchableEntity) (bool, error) {
	value, err := getStringProperty(entity, string(c.TypeField))
	if err != nil {
		return false, err
	}
	return compareStringCondition(c.Operator, value, c.Value)
}
