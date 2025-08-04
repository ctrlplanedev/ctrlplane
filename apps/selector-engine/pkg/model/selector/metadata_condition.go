package selector

import (
	"fmt"
	"strings"

	"github.com/ctrlplanedev/selector-engine/pkg/model/resource"
)

// MetadataOperator defines metadata matching operators
type MetadataOperator string

const (
	MetadataOperatorEquals     MetadataOperator = "equals"
	MetadataOperatorNull       MetadataOperator = "null"
	MetadataOperatorStartsWith MetadataOperator = "starts-with"
	MetadataOperatorEndsWith   MetadataOperator = "ends-with"
	MetadataOperatorContains   MetadataOperator = "contains"
)

// MetadataCondition represents a metadata matching selector
// This is an interface to support different metadata selector types
type MetadataCondition interface {
	Condition
	GetKey() string
	GetOperator() MetadataOperator
}

// MetadataNullCondition represents a metadata null check selector
type MetadataNullCondition struct {
	TypeField ConditionType    `json:"type"`
	Key       string           `json:"key"`
	Operator  MetadataOperator `json:"operator"`
}

// Type returns the selector type
func (c MetadataNullCondition) Type() ConditionType {
	return ConditionTypeMetadata
}

// GetKey returns the metadata key
func (c MetadataNullCondition) GetKey() string {
	return c.Key
}

// GetOperator returns the metadata operator
func (c MetadataNullCondition) GetOperator() MetadataOperator {
	return c.Operator
}

// Validate validates the metadata null selector
func (c MetadataNullCondition) Validate() error {
	return c.validate(0)
}

func (c MetadataNullCondition) validate(depth int) error {
	if c.TypeField != ConditionTypeMetadata {
		return fmt.Errorf("invalid type for metadata selector: %s", c.TypeField)
	}

	if c.Key == "" {
		return fmt.Errorf("key cannot be empty")
	}

	if c.Operator != MetadataOperatorNull {
		return fmt.Errorf("null selector must have operator 'null', got: %s", c.Operator)
	}

	return nil
}

// Matches checks if the resource matches the metadata null selector
func (c MetadataNullCondition) Matches(resource resource.Resource) (bool, error) {
	if c.Operator == MetadataOperatorNull {
		_, ok := resource.Metadata[c.Key]
		return !ok, nil // if it's missing it is null
	}
	return false, fmt.Errorf("invalid operator for metadata-null condition: %s", c.Operator)
}

// MetadataValueCondition represents a metadata value matching selector
type MetadataValueCondition struct {
	TypeField ConditionType    `json:"type"`
	Key       string           `json:"key"`
	Operator  MetadataOperator `json:"operator"`
	Value     string           `json:"value"`
}

// Type returns the selector type
func (c MetadataValueCondition) Type() ConditionType {
	return ConditionTypeMetadata
}

// GetKey returns the metadata key
func (c MetadataValueCondition) GetKey() string {
	return c.Key
}

// GetOperator returns the metadata operator
func (c MetadataValueCondition) GetOperator() MetadataOperator {
	return c.Operator
}

// Validate validates the metadata value selector
func (c MetadataValueCondition) Validate() error {
	return c.validate(0)
}

func (c MetadataValueCondition) validate(depth int) error {
	if c.TypeField != ConditionTypeMetadata {
		return fmt.Errorf("invalid type for metadata selector: %s", c.TypeField)
	}

	if c.Key == "" {
		return fmt.Errorf("key cannot be empty")
	}

	if err := ValidateMetadataOperator(string(c.Operator)); err != nil {
		return err
	}

	if c.Operator == MetadataOperatorNull {
		return fmt.Errorf("null operator should use MetadataNullCondition type")
	}

	if c.Value == "" {
		return fmt.Errorf("value cannot be empty for non-null metadata conditions")
	}

	return nil
}

// Matches checks if the resource matches the metadata value selector
func (c MetadataValueCondition) Matches(resource resource.Resource) (bool, error) {
	var value string
	var ok bool
	if value, ok = resource.Metadata[c.Key]; !ok {
		return false, nil
	}
	switch c.Operator {
	case MetadataOperatorContains:
		return strings.Contains(value, c.Value), nil
	case MetadataOperatorEquals:
		return value == c.Value, nil
	case MetadataOperatorEndsWith:
		return strings.HasSuffix(value, c.Value), nil
	case MetadataOperatorStartsWith:
		return strings.HasPrefix(value, c.Value), nil
	}
	return false, fmt.Errorf("invalid operator for metadata-value selector: %s", c.Operator)
}

// ValidateMetadataOperator validates a metadata operator string
func ValidateMetadataOperator(op string) error {
	switch MetadataOperator(op) {
	case MetadataOperatorEquals, MetadataOperatorNull,
		MetadataOperatorStartsWith, MetadataOperatorEndsWith,
		MetadataOperatorContains:
		return nil
	default:
		return fmt.Errorf("invalid metadata-value operator: %s", op)
	}
}
