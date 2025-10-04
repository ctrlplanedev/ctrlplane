package pb

import (
	"fmt"

	structpb "google.golang.org/protobuf/types/known/structpb"
)

func ConvertVariableValue(val any) (*VariableValue, error) {
	switch val := val.(type) {
	case *VariableValue:
		return val, nil
	case VariableValue:
		return &val, nil
	case string:
		return &VariableValue{
			Value: &VariableValue_StringValue{StringValue: val},
		}, nil
	case float64:
		return &VariableValue{
			Value: &VariableValue_DoubleValue{DoubleValue: val},
		}, nil
	case int:
		return &VariableValue{
			Value: &VariableValue_Int64Value{Int64Value: int64(val)},
		}, nil
	case int64:
		return &VariableValue{
			Value: &VariableValue_Int64Value{Int64Value: val},
		}, nil
	case bool:
		return &VariableValue{
			Value: &VariableValue_BoolValue{BoolValue: val},
		}, nil
	case map[string]any:
		structVal, err := structpb.NewStruct(val)
		if err != nil {
			return nil, fmt.Errorf("failed to convert map to structpb.Struct: %w", err)
		}
		return &VariableValue{
			Value: &VariableValue_ObjectValue{ObjectValue: structVal},
		}, nil

	default:
		return nil, fmt.Errorf("unexpected variable value type: %T", val)
	}
}

// VariablesToMap converts a map of variable names to values of various types
// (including *VariableValue, VariableValue, string, float64, int, int64, bool, and map[string]any)
// into a map[string]*VariableValue suitable for use in protobuf messages.
// It returns an error if a value cannot be converted to a VariableValue.
//
// Supported input types for values:
//   - *VariableValue: used as-is
//   - VariableValue: address taken and used
//   - string: converted to VariableValue_StringValue
//   - float64: converted to VariableValue_DoubleValue
//   - int, int64: converted to VariableValue_Int64Value
//   - bool: converted to VariableValue_BoolValue
//   - map[string]any: converted to VariableValue_ObjectValue (protobuf Struct)
//
// Returns an error if an unsupported type is encountered or if structpb.NewStruct fails.
func VariablesToMap(variables map[string]any) (map[string]*VariableValue, error) {
	variablesMap := make(map[string]*VariableValue, len(variables))
	for k, v := range variables {
		value, err := ConvertVariableValue(v)
		if err != nil {
			return nil, fmt.Errorf("failed to convert variable value: %w", err)
		}
		variablesMap[k] = value
	}
	return variablesMap, nil
}
