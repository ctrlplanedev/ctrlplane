package operations

import (
	"fmt"
	"strings"
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

func StringConditionMatches(entity any, operator conditions.StringConditionOperator, field string, value string) (bool, error) {
	entityValue, err := getStringProperty(entity, field)
	if err != nil {
		return false, err
	}
	return compareStringCondition(operator, entityValue, value)
}
