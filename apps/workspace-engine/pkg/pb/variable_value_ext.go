package pb

import (
	"fmt"

	structpb "google.golang.org/protobuf/types/known/structpb"
)

func ConvertValue(val any) (*Value, error) {
	switch val := val.(type) {
	case *Value:
		return val, nil
	case Value:
		return &val, nil
	case string:
		return &Value{
			Data: &Value_String_{String_: val},
		}, nil
	case float64:
		return &Value{
			Data: &Value_Double{Double: val},
		}, nil
	case int:
		return &Value{
			Data: &Value_Int64{Int64: int64(val)},
		}, nil
	case int64:
		return &Value{
			Data: &Value_Int64{Int64: val},
		}, nil
	case bool:
		return &Value{
			Data: &Value_Bool{Bool: val},
		}, nil
	case map[string]any:
		structVal, err := structpb.NewStruct(val)
		if err != nil {
			return nil, fmt.Errorf("failed to convert map to structpb.Struct: %w", err)
		}
		return &Value{
			Data: &Value_Object{Object: structVal},
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
//   - map[string]any: converted to Value_Object (protobuf Struct)
//
// Returns an error if an unsupported type is encountered or if structpb.NewStruct fails.
func VariablesToMap(variables map[string]any) (map[string]*Value, error) {
	variablesMap := make(map[string]*Value, len(variables))
	for k, v := range variables {
		value, err := ConvertValue(v)
		if err != nil {
			return nil, fmt.Errorf("failed to convert variable value: %w", err)
		}
		variablesMap[k] = value
	}
	return variablesMap, nil
}
