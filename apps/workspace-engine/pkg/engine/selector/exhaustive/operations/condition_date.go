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

// compareDateCondition compares two dates based on the given operator.
// It truncates the time to the second to avoid issues with sub-second precision.
func compareDateCondition(operator DateOperator, aValue time.Time, bValue time.Time) (bool, error) {
	aValueSec := aValue.Truncate(time.Second)
	bValueSec := bValue.Truncate(time.Second)
	switch operator {
	case DateOperatorBefore:
		return aValueSec.Before(bValueSec), nil
	case DateOperatorAfter:
		return aValueSec.After(bValueSec), nil
	case DateOperatorBeforeOrOn:
		return aValueSec.Before(bValueSec) || aValueSec.Equal(bValueSec), nil
	case DateOperatorAfterOrOn:
		return aValueSec.After(bValueSec) || aValueSec.Equal(bValueSec), nil
	default:
		return false, fmt.Errorf("invalid date operator: %s", operator)
	}
}
