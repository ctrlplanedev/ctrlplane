package creators

import (
	"workspace-engine/pkg/oapi"
)

// NewResourceVariable creates a new ResourceVariable with default values
func NewResourceVariable(resourceID string, key string) *oapi.ResourceVariable {
	return &oapi.ResourceVariable{
		ResourceId: resourceID,
		Key:        key,
	}
}

// NewLiteralValue creates a new LiteralValue from a Go value
func NewLiteralValue(value any) *oapi.LiteralValue {
	literalValue := &oapi.LiteralValue{}
	switch v := value.(type) {
	case string:
		_ = literalValue.FromStringValue(v)
	case int:
		_ = literalValue.FromIntegerValue(v)
	case int64:
		_ = literalValue.FromIntegerValue(int(v))
	case float32:
		_ = literalValue.FromNumberValue(v)
	case float64:
		_ = literalValue.FromNumberValue(float32(v))
	case bool:
		_ = literalValue.FromBooleanValue(v)
	case map[string]any:
		_ = literalValue.FromObjectValue(oapi.ObjectValue{Object: v})
	default:
		panic("unsupported type for LiteralValue")
	}
	return literalValue
}

// NewValueFromLiteral creates a new Value with a literal data type
func NewValueFromLiteral(literalValue *oapi.LiteralValue) *oapi.Value {
	value := &oapi.Value{}
	_ = value.FromLiteralValue(*literalValue)
	return value
}

// NewValueFromString creates a new Value with a string literal
func NewValueFromString(value string) *oapi.Value {
	literalValue := &oapi.LiteralValue{}
	_ = literalValue.FromStringValue(value)
	return NewValueFromLiteral(literalValue)
}

// NewValueFromInt creates a new Value with an int64 literal
func NewValueFromInt(value int64) *oapi.Value {
	literalValue := &oapi.LiteralValue{}
	_ = literalValue.FromIntegerValue(int(value))
	return NewValueFromLiteral(literalValue)
}

// NewValueFromBool creates a new Value with a bool literal
func NewValueFromBool(value bool) *oapi.Value {
	literalValue := &oapi.LiteralValue{}
	_ = literalValue.FromBooleanValue(value)
	return NewValueFromLiteral(literalValue)
}

// NewValueFromReference creates a new Value with a reference data type
func NewValueFromReference(reference string, path []string) *oapi.Value {
	value := &oapi.Value{}
	_ = value.FromReferenceValue(oapi.ReferenceValue{
		Reference: reference,
		Path:      path,
	})
	return value
}

// NewValueFromSensitive creates a new Value with a sensitive data type
func NewValueFromSensitive(valueHash string) *oapi.Value {
	value := &oapi.Value{}
	_ = value.FromSensitiveValue(oapi.SensitiveValue{
		ValueHash: valueHash,
	})
	return value
}
