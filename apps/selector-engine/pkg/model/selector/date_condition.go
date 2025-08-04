package selector

import (
	"fmt"
	"time"

	"workspace-engine/pkg/model/resource"
)

// DateOperator defines date comparison operators
type DateOperator string

const (
	DateOperatorBefore     DateOperator = "before"
	DateOperatorAfter      DateOperator = "after"
	DateOperatorBeforeOrOn DateOperator = "before-or-on"
	DateOperatorAfterOrOn  DateOperator = "after-or-on"
)

type DateField string

const (
	DateFieldCreatedAt DateField = "created-at"
	DateFieldUpdatedAt DateField = "updated-at"
)

// DateCondition represents a created-at date selector
type DateCondition struct {
	TypeField ConditionType `json:"type"`
	Operator  DateOperator  `json:"operator"`
	Value     time.Time     `json:"value"`
	DateField DateField     `json:"dateField"`
}

// Type returns the selector type
func (c DateCondition) Type() ConditionType {
	return ConditionTypeDate
}

// Validate validates the created-at selector
func (c DateCondition) Validate() error {
	return c.validate(0)
}

func (c DateCondition) validate(depth int) error {
	if c.TypeField != ConditionTypeDate {
		return fmt.Errorf("invalid type for created-at selector: %s", c.TypeField)
	}

	if err := ValidateDateOperator(string(c.Operator)); err != nil {
		return err
	}

	if c.Value.IsZero() {
		return fmt.Errorf("value cannot be empty")
	}

	return nil
}

// Matches checks if the resource matches the created-at selector
func (c DateCondition) Matches(resource resource.Resource) (bool, error) {
	var resourceDate time.Time

	switch c.DateField {
	case DateFieldCreatedAt:
		resourceDate = resource.CreatedAt
	case DateFieldUpdatedAt:
		resourceDate = resource.LastSync
	default:
		return false, fmt.Errorf("invalid date field: %s", c.DateField)
	}

	switch c.Operator {
	case DateOperatorAfter:
		return resourceDate.After(c.Value), nil
	case DateOperatorBefore:
		return resourceDate.Before(c.Value), nil
	case DateOperatorAfterOrOn:
		return !resourceDate.Before(c.Value), nil
	case DateOperatorBeforeOrOn:
		return !resourceDate.After(c.Value), nil
	default:
		return false, fmt.Errorf("unsupported date operator: %s", c.Operator)
	}
}

// ValidateDateOperator validates a date operator string
func ValidateDateOperator(op string) error {
	switch DateOperator(op) {
	case DateOperatorBefore, DateOperatorAfter,
		DateOperatorBeforeOrOn, DateOperatorAfterOrOn:
		return nil
	default:
		return fmt.Errorf("invalid date operator: %s", op)
	}
}
