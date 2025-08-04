package selector

import (
	"fmt"

	"github.com/ctrlplanedev/selector-engine/pkg/model/resource"
)

// SystemCondition represents a system matching selector
type SystemCondition struct {
	TypeField ConditionType `json:"type"`
	Operator  string        `json:"operator"`
	Value     string        `json:"value"`
}

// Type returns the selector type
func (c SystemCondition) Type() ConditionType {
	return ConditionTypeSystem
}

// Validate validates the system selector
func (c SystemCondition) Validate() error {
	return c.validate(0)
}

func (c SystemCondition) validate(depth int) error {
	if c.TypeField != ConditionTypeSystem {
		return fmt.Errorf("invalid type for system selector: %s", c.TypeField)
	}

	if c.Operator != "equals" {
		return fmt.Errorf("system selector only supports 'equals' operator, got: %s", c.Operator)
	}

	if c.Value == "" {
		return fmt.Errorf("value cannot be empty")
	}

	return nil
}

// Matches checks if the resource matches the system selector
func (c SystemCondition) Matches(resource resource.Resource) (bool, error) {
	// TODO: to implement
	return false, fmt.Errorf("system conditions are not supported")
}
