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

func (c NameCondition) validate() error {
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
	var err error
	if err = c.validate(); err != nil {
		return false, err
	}
	return c.Operator.Test(resource.Name, c.Value)
}
