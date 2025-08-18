package operations

import (
	"fmt"
	"time"
	"workspace-engine/pkg/model"
	"workspace-engine/pkg/model/conditions"
)

func DateConditionMatches(entity any, operator conditions.DateOperator, aField string, bValue string) (bool, error) {
	var err error
	var aDate time.Time
	var bDate time.Time

	if aDate, err = getDateProperty(entity, aField); err != nil {
		return false, err
	}
	bDate, err = time.Parse(time.RFC3339, bValue)
	if err != nil {
		return false, err
	}
	return compareDateCondition(operator, aDate, bDate)
}

type DateCondition[E model.MatchableEntity] struct {
	TypeField conditions.ConditionType `json:"type"`
	Operator  conditions.DateOperator  `json:"operator"`
	Value     time.Time                `json:"value"`
}

func (c DateCondition[E]) Matches(entity E) (bool, error) {
	value, err := getDateProperty(entity, string(c.TypeField))
	if err != nil {
		return false, err
	}
	return compareDateCondition(c.Operator, value, c.Value)
}

// compareDateCondition compares two dates based on the given operator.
// It truncates the time to the second to avoid issues with sub-second precision.
func compareDateCondition(operator conditions.DateOperator, aValue time.Time, bValue time.Time) (bool, error) {
	aValueSec := aValue.Truncate(time.Second)
	bValueSec := bValue.Truncate(time.Second)
	switch operator {
	case conditions.DateOperatorBefore:
		return aValueSec.Before(bValueSec), nil
	case conditions.DateOperatorAfter:
		return aValueSec.After(bValueSec), nil
	case conditions.DateOperatorBeforeOrOn:
		return aValueSec.Before(bValueSec) || aValueSec.Equal(bValueSec), nil
	case conditions.DateOperatorAfterOrOn:
		return aValueSec.After(bValueSec) || aValueSec.Equal(bValueSec), nil
	default:
		return false, fmt.Errorf("invalid date operator: %s", operator)
	}
}
