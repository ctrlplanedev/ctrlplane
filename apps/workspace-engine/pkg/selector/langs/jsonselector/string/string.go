package string

import (
	"fmt"
	"strings"
	"workspace-engine/pkg/selector/langs/jsonselector/unknown"
	"workspace-engine/pkg/selector/langs/jsonselector/util"
)

type StringConditionOperator string

const (
	StringConditionOperatorEquals     StringConditionOperator = "equals"
	StringConditionOperatorStartsWith StringConditionOperator = "starts-with"
	StringConditionOperatorEndsWith   StringConditionOperator = "ends-with"
	StringConditionOperatorContains   StringConditionOperator = "contains"
)

type StringCondition struct {
	Property string                  `json:"type"`
	Operator StringConditionOperator `json:"operator"`
	Value    string                  `json:"value"`
}

func (c StringCondition) Matches(entity any) (bool, error) {
	entityValue, err := util.GetStringProperty(entity, c.Property)
	if err != nil {
		return false, err
	}
	return CompareStringCondition(c.Operator, entityValue, c.Value)
}

func ConvertFromUnknownCondition(condition unknown.UnknownCondition) (StringCondition, error) {
	validOperators := map[StringConditionOperator]struct{}{
		StringConditionOperatorEquals:     {},
		StringConditionOperatorStartsWith: {},
		StringConditionOperatorEndsWith:   {},
		StringConditionOperatorContains:   {},
	}

	if _, ok := validOperators[StringConditionOperator(condition.Operator)]; !ok {
		return StringCondition{}, fmt.Errorf("invalid string operator: %s", condition.Operator)
	}

	return StringCondition{
		Property: condition.Property,
		Operator: StringConditionOperator(condition.Operator),
		Value:    condition.Value,
	}, nil
}

func CompareStringCondition(operator StringConditionOperator, aValue string, bValue string) (bool, error) {
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
