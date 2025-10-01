package date

import (
	"fmt"
	"time"
	"workspace-engine/pkg/selector/langs/jsonselector/unknown"
	"workspace-engine/pkg/selector/langs/jsonselector/util"
)

type DateCondition struct {
	Property string       `json:"type"`
	Operator DateOperator `json:"operator"`
	Value    string       `json:"value"`
}

type DateOperator string

const (
	DateOperatorEquals     DateOperator = "equals"
	DateOperatorBefore     DateOperator = "before"
	DateOperatorAfter      DateOperator = "after"
	DateOperatorBeforeOrOn DateOperator = "before-or-on"
	DateOperatorAfterOrOn  DateOperator = "after-or-on"
)

func ConvertFromUnknownCondition(condition unknown.UnknownCondition) (DateCondition, error) {
	validOperators := map[DateOperator]struct{}{
		DateOperatorEquals:     {},
		DateOperatorBefore:     {},
		DateOperatorAfter:      {},
		DateOperatorBeforeOrOn: {},
		DateOperatorAfterOrOn:  {},
	}
	if _, ok := validOperators[DateOperator(condition.Operator)]; !ok {
		return DateCondition{}, fmt.Errorf("invalid date operator: %s", condition.Operator)
	}

	return DateCondition{
		Property: condition.Property,
		Operator: DateOperator(condition.Operator),
		Value:    condition.Value,
	}, nil
}

func (c DateCondition) Matches(entity any) (bool, error) {
	value, err := util.GetDateProperty(entity, string(c.Property))
	if err != nil {
		return false, err
	}
	bDate, err := time.Parse(time.RFC3339, c.Value)
	if err != nil {
		return false, err
	}
	return compareDateCondition(c.Operator, value, bDate)
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
