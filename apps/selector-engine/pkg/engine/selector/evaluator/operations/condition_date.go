package operations

import (
	"fmt"
	"time"
	"workspace-engine/pkg/engine/selector"
)

type DateOperator string

const (
	DateOperatorBefore     DateOperator = "before"
	DateOperatorAfter      DateOperator = "after"
	DateOperatorBeforeOrOn DateOperator = "before-or-on"
	DateOperatorAfterOrOn  DateOperator = "after-or-on"
)

type DateCondition struct {
	TypeField ConditionType `json:"type"`
	Operator  DateOperator  `json:"operator"`
	Value     time.Time     `json:"value"`
}

func (c DateCondition) Matches(entity selector.MatchableEntity) (bool, error) {
	value, err := getDateProperty(entity, string(c.TypeField))
	if err != nil {
		return false, err
	}
	return compareDateCondition(c.Operator, value, c.Value)
}

func compareDateCondition(operator DateOperator, aValue time.Time, bValue time.Time) (bool, error) {
	switch operator {
	case DateOperatorBefore:
		return aValue.Before(bValue), nil
	case DateOperatorAfter:
		return aValue.After(bValue), nil
	case DateOperatorBeforeOrOn:
		return aValue.Before(bValue) || aValue.Equal(bValue), nil
	case DateOperatorAfterOrOn:
		return aValue.After(bValue) || aValue.Equal(bValue), nil
	default:
		return false, fmt.Errorf("invalid date operator: %s", operator)
	}
}
