package selector

import (
	"fmt"
	"workspace-engine/pkg/model/resource"
)

// NameCondition represents a name matching selector
type NameCondition struct {
	TypeField ConditionType  `json:"type"`
	Operator  ColumnOperator `json:"operator"`
	Value     string         `json:"value"`
}

// Type returns the selector type
func (c NameCondition) Type() ConditionType {
	return ConditionTypeName
}

// Validate validates the name selector
func (c NameCondition) Validate() error {
	return c.validate(0)
}

func (c NameCondition) validate(depth int) error {
	if c.TypeField != ConditionTypeName {
		return fmt.Errorf("invalid type for name selector: %s", c.TypeField)
	}

	if err := ValidateColumnOperator(string(c.Operator)); err != nil {
		return err
	}

	if c.Value == "" {
		return fmt.Errorf("value cannot be empty")
	}

	return nil
}

// Matches checks if the resource matches the name selector
func (c NameCondition) Matches(resource resource.Resource) (bool, error) {
	return c.Operator.Test(resource.Name, c.Value)
}
