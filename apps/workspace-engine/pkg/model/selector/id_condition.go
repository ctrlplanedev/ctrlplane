package selector

import (
	"fmt"

	"workspace-engine/pkg/model/resource"
)

// IdOperator defines matching operators for ID
type IdOperator string

const (
	IdOperatorEquals IdOperator = "equals"
)

// IDCondition represents an ID matching selector
type IDCondition struct {
	TypeField ConditionType `json:"type"`
	Operator  IdOperator    `json:"operator"`
	Value     string        `json:"value"`
}

// Type returns the selector type
func (c IDCondition) Type() ConditionType {
	return ConditionTypeID
}

func (c IDCondition) validate() error {
	if c.TypeField != ConditionTypeID {
		return fmt.Errorf("invalid type for ID selector: %s", c.TypeField)
	}

	if c.Operator != IdOperatorEquals {
		return fmt.Errorf("ID selector only supports 'equals' operator, got: %s", c.Operator)
	}

	if c.Value == "" {
		return fmt.Errorf("value cannot be empty")
	}

	return nil
}

// Matches checks if the resource matches the ID selector
func (c IDCondition) Matches(resource resource.Resource) (bool, error) {
	var err error

	if err = c.validate(); err != nil {
		return false, err
	}
	switch c.Operator {
	case IdOperatorEquals:
		return resource.ID == c.Value, nil
	}
	return false, fmt.Errorf("ID selector only supports 'equals' operator, got: %s", c.Operator)
}
