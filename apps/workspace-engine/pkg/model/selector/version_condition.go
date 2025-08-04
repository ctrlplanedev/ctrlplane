package selector

import (
	"fmt"

	"workspace-engine/pkg/model/resource"
)

// VersionCondition represents a version matching selector
type VersionCondition struct {
	TypeField ConditionType  `json:"type"`
	Operator  ColumnOperator `json:"operator"`
	Value     string         `json:"value"`
}

// Type returns the selector type
func (c VersionCondition) Type() ConditionType {
	return ConditionTypeVersion
}

// Validate validates the version selector
func (c VersionCondition) Validate() error {
	return c.validate(0)
}

func (c VersionCondition) validate(depth int) error {
	if c.TypeField != ConditionTypeVersion {
		return fmt.Errorf("invalid type for version selector: %s", c.TypeField)
	}

	if err := ValidateColumnOperator(string(c.Operator)); err != nil {
		return err
	}

	if c.Value == "" {
		return fmt.Errorf("value cannot be empty")
	}

	return nil
}

// Matches checks if the resource matches the version selector
func (c VersionCondition) Matches(resource resource.Resource) (bool, error) {
	return c.Operator.Test(resource.Version, c.Value)
}
