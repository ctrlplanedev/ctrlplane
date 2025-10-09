package pb

import (
	"testing"
)

func TestVariablesToMap_String(t *testing.T) {
	input := map[string]any{
		"name": "test-value",
	}

	result, err := MapToLiteralValues(input)
	if err != nil {
		t.Fatalf("VariablesToMap() unexpected error = %v", err)
	}

	if len(result) != 1 {
		t.Errorf("VariablesToMap() returned %d variables, want 1", len(result))
	}

	val, ok := result["name"]
	if !ok {
		t.Fatal("VariablesToMap() missing 'name' key")
	}

	strVal, ok := val.Data.(*LiteralValue_String_)
	if !ok {
		t.Fatalf("VariablesToMap() value is %T, want *Value_String_", val.Data)
	}

	if strVal.String_ != "test-value" {
		t.Errorf("VariablesToMap() string value = %s, want %s", strVal.String_, "test-value")
	}
}

func TestVariablesToMap_Float64(t *testing.T) {
	input := map[string]any{
		"price": 99.99,
	}

	result, err := MapToLiteralValues(input)
	if err != nil {
		t.Fatalf("VariablesToMap() unexpected error = %v", err)
	}

	if len(result) != 1 {
		t.Errorf("VariablesToMap() returned %d variables, want 1", len(result))
	}

	val, ok := result["price"]
	if !ok {
		t.Fatal("VariablesToMap() missing 'price' key")
	}

	doubleVal, ok := val.Data.(*LiteralValue_Double)
	if !ok {
		t.Fatalf("VariablesToMap() value is %T, want *Value_Double", val.Data)
	}

	if doubleVal.Double != 99.99 {
		t.Errorf("VariablesToMap() double value = %f, want %f", doubleVal.Double, 99.99)
	}
}

func TestVariablesToMap_Int(t *testing.T) {
	input := map[string]any{
		"count": 42,
	}

	result, err := MapToLiteralValues(input)
	if err != nil {
		t.Fatalf("VariablesToMap() unexpected error = %v", err)
	}

	if len(result) != 1 {
		t.Errorf("VariablesToMap() returned %d variables, want 1", len(result))
	}

	val, ok := result["count"]
	if !ok {
		t.Fatal("VariablesToMap() missing 'count' key")
	}

	intVal, ok := val.Data.(*LiteralValue_Int64)
	if !ok {
		t.Fatalf("VariablesToMap() value is %T, want *Value_Int64", val.Data)
	}

	if intVal.Int64 != 42 {
		t.Errorf("VariablesToMap() int64 value = %d, want %d", intVal.Int64, 42)
	}
}

func TestVariablesToMap_Int64(t *testing.T) {
	input := map[string]any{
		"timestamp": int64(1234567890),
	}

	result, err := MapToLiteralValues(input)
	if err != nil {
		t.Fatalf("VariablesToMap() unexpected error = %v", err)
	}

	if len(result) != 1 {
		t.Errorf("VariablesToMap() returned %d variables, want 1", len(result))
	}

	val, ok := result["timestamp"]
	if !ok {
		t.Fatal("VariablesToMap() missing 'timestamp' key")
	}

	intVal, ok := val.Data.(*LiteralValue_Int64)
	if !ok {
		t.Fatalf("VariablesToMap() value is %T, want *Value_Int64", val.Data)
	}

	if intVal.Int64 != 1234567890 {
		t.Errorf("VariablesToMap() int64 value = %d, want %d", intVal.Int64, 1234567890)
	}
}

func TestVariablesToMap_Bool(t *testing.T) {
	tests := []struct {
		name      string
		boolValue bool
	}{
		{
			name:      "true value",
			boolValue: true,
		},
		{
			name:      "false value",
			boolValue: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			input := map[string]any{
				"enabled": tt.boolValue,
			}

			result, err := MapToLiteralValues(input)
			if err != nil {
				t.Fatalf("VariablesToMap() unexpected error = %v", err)
			}

			if len(result) != 1 {
				t.Errorf("VariablesToMap() returned %d variables, want 1", len(result))
			}

			val, ok := result["enabled"]
			if !ok {
				t.Fatal("VariablesToMap() missing 'enabled' key")
			}

			boolVal, ok := val.Data.(*LiteralValue_Bool)
			if !ok {
				t.Fatalf("VariablesToMap() value is %T, want *Value_Bool", val.Data)
			}

			if boolVal.Bool != tt.boolValue {
				t.Errorf("VariablesToMap() bool value = %v, want %v", boolVal.Bool, tt.boolValue)
			}
		})
	}
}

func TestVariablesToMap_Object(t *testing.T) {
	input := map[string]any{
		"config": map[string]any{
			"host": "localhost",
			"port": float64(8080),
			"ssl":  true,
		},
	}

	result, err := MapToLiteralValues(input)
	if err != nil {
		t.Fatalf("VariablesToMap() unexpected error = %v", err)
	}

	if len(result) != 1 {
		t.Errorf("VariablesToMap() returned %d variables, want 1", len(result))
	}

	val, ok := result["config"]
	if !ok {
		t.Fatal("VariablesToMap() missing 'config' key")
	}

	objVal, ok := val.Data.(*LiteralValue_Object)
	if !ok {
		t.Fatalf("VariablesToMap() value is %T, want *Value_Object", val.Data)
	}

	if objVal.Object == nil {
		t.Fatal("VariablesToMap() object value is nil")
	}

	// Verify the nested structure
	if objVal.Object.Fields["host"].GetStringValue() != "localhost" {
		t.Errorf("VariablesToMap() object.host = %s, want %s", objVal.Object.Fields["host"].GetStringValue(), "localhost")
	}

	if objVal.Object.Fields["port"].GetNumberValue() != 8080 {
		t.Errorf("VariablesToMap() object.port = %f, want %f", objVal.Object.Fields["port"].GetNumberValue(), 8080.0)
	}

	if objVal.Object.Fields["ssl"].GetBoolValue() != true {
		t.Errorf("VariablesToMap() object.ssl = %v, want %v", objVal.Object.Fields["ssl"].GetBoolValue(), true)
	}
}

func TestVariablesToMap_VariableValuePointer(t *testing.T) {
	varVal := &LiteralValue{
		Data: &LiteralValue_String_{String_: "existing-value"},
	}

	input := map[string]any{
		"existing": varVal,
	}

	result, err := MapToLiteralValues(input)
	if err != nil {
		t.Fatalf("VariablesToMap() unexpected error = %v", err)
	}

	if len(result) != 1 {
		t.Errorf("VariablesToMap() returned %d variables, want 1", len(result))
	}

	val, ok := result["existing"]
	if !ok {
		t.Fatal("VariablesToMap() missing 'existing' key")
	}

	// Should be the same pointer
	if val != varVal {
		t.Errorf("VariablesToMap() did not preserve *VariableValue pointer")
	}
}

func TestVariablesToMap_VariableValueCopy(t *testing.T) {
	varVal := &LiteralValue{
		Data: &LiteralValue_Int64{Int64: 123},
	}

	//nolint:govet // intentionally testing copy behavior for VariableValue (non-pointer)
	input := map[string]any{
		"copied": varVal,
	}

	result, err := MapToLiteralValues(input)
	if err != nil {
		t.Fatalf("VariablesToMap() unexpected error = %v", err)
	}

	if len(result) != 1 {
		t.Errorf("VariablesToMap() returned %d variables, want 1", len(result))
	}

	val, ok := result["copied"]
	if !ok {
		t.Fatal("VariablesToMap() missing 'copied' key")
	}

	intVal, ok := val.Data.(*LiteralValue_Int64)
	if !ok {
		t.Fatalf("VariablesToMap() value is %T, want *Value_Int64", val.Data)
	}

	if intVal.Int64 != 123 {
		t.Errorf("VariablesToMap() int64 value = %d, want %d", intVal.Int64, 123)
	}
}

func TestVariablesToMap_MultipleVariables(t *testing.T) {
	input := map[string]any{
		"name":    "test",
		"count":   42,
		"enabled": true,
		"price":   19.99,
		"id":      int64(1000),
		"config": map[string]any{
			"key": "value",
		},
	}

	result, err := MapToLiteralValues(input)
	if err != nil {
		t.Fatalf("VariablesToMap() unexpected error = %v", err)
	}

	if len(result) != 6 {
		t.Errorf("VariablesToMap() returned %d variables, want 6", len(result))
	}

	// Verify all keys are present
	expectedKeys := []string{"name", "count", "enabled", "price", "id", "config"}
	for _, key := range expectedKeys {
		if _, ok := result[key]; !ok {
			t.Errorf("VariablesToMap() missing key %s", key)
		}
	}
}

func TestVariablesToMap_EmptyMap(t *testing.T) {
	input := map[string]any{}

	result, err := MapToLiteralValues(input)
	if err != nil {
		t.Fatalf("VariablesToMap() unexpected error = %v", err)
	}

	if len(result) != 0 {
		t.Errorf("VariablesToMap() returned %d variables, want 0", len(result))
	}
}

func TestVariablesToMap_UnsupportedType(t *testing.T) {
	tests := []struct {
		name      string
		input     map[string]any
		wantErr   bool
		errSubstr string
	}{
		{
			name: "slice type",
			input: map[string]any{
				"items": []string{"a", "b", "c"},
			},
			wantErr:   true,
			errSubstr: "unexpected variable value type",
		},
		{
			name: "struct type",
			input: map[string]any{
				"data": struct{ Name string }{Name: "test"},
			},
			wantErr:   true,
			errSubstr: "unexpected variable value type",
		},
		{
			name: "nil value",
			input: map[string]any{
				"nothing": nil,
			},
			wantErr:   true,
			errSubstr: "unexpected variable value type",
		},
		{
			name: "uint type",
			input: map[string]any{
				"unsigned": uint(100),
			},
			wantErr:   true,
			errSubstr: "unexpected variable value type",
		},
		{
			name: "float32 type",
			input: map[string]any{
				"smallfloat": float32(1.5),
			},
			wantErr:   true,
			errSubstr: "unexpected variable value type",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := MapToLiteralValues(tt.input)

			if !tt.wantErr {
				if err != nil {
					t.Errorf("VariablesToMap() unexpected error = %v", err)
				}
				return
			}

			if err == nil {
				t.Errorf("VariablesToMap() expected error but got none")
				return
			}

			if tt.errSubstr != "" {
				if err.Error() == "" || len(err.Error()) == 0 {
					t.Errorf("VariablesToMap() error message is empty")
				}
			}

			if result != nil {
				t.Errorf("VariablesToMap() with error should return nil result, got %v", result)
			}
		})
	}
}

func TestVariablesToMap_InvalidNestedObject(t *testing.T) {
	// Test that an object with invalid nested values fails
	input := map[string]any{
		"config": map[string]any{
			"nested": make(chan int), // channels cannot be converted to structpb
		},
	}

	result, err := MapToLiteralValues(input)

	if err == nil {
		t.Errorf("VariablesToMap() expected error for invalid nested object but got none")
		return
	}

	if result != nil {
		t.Errorf("VariablesToMap() with error should return nil result, got %v", result)
	}
}

func TestVariablesToMap_ComplexNestedObject(t *testing.T) {
	input := map[string]any{
		"database": map[string]any{
			"connection": map[string]any{
				"host":     "db.example.com",
				"port":     float64(5432),
				"database": "mydb",
				"options": map[string]any{
					"ssl":     true,
					"timeout": float64(30),
				},
			},
			"pool": map[string]any{
				"min": float64(2),
				"max": float64(10),
			},
		},
	}

	result, err := MapToLiteralValues(input)
	if err != nil {
		t.Fatalf("VariablesToMap() unexpected error = %v", err)
	}

	if len(result) != 1 {
		t.Errorf("VariablesToMap() returned %d variables, want 1", len(result))
	}

	val, ok := result["database"]
	if !ok {
		t.Fatal("VariablesToMap() missing 'database' key")
	}

	objVal, ok := val.Data.(*LiteralValue_Object)
	if !ok {
		t.Fatalf("VariablesToMap() value is %T, want *Value_Object", val.Data)
	}

	if objVal.Object == nil {
		t.Fatal("VariablesToMap() object value is nil")
	}

	// Verify nested structure exists
	connFields := objVal.Object.Fields["connection"].GetStructValue()
	if connFields == nil {
		t.Fatal("VariablesToMap() missing 'connection' nested object")
	}

	if connFields.Fields["host"].GetStringValue() != "db.example.com" {
		t.Errorf("VariablesToMap() connection.host = %s, want %s",
			connFields.Fields["host"].GetStringValue(), "db.example.com")
	}

	optionsFields := connFields.Fields["options"].GetStructValue()
	if optionsFields == nil {
		t.Fatal("VariablesToMap() missing 'options' nested object")
	}

	if optionsFields.Fields["ssl"].GetBoolValue() != true {
		t.Errorf("VariablesToMap() options.ssl = %v, want %v",
			optionsFields.Fields["ssl"].GetBoolValue(), true)
	}
}

func TestVariablesToMap_AllTypesIntegration(t *testing.T) {
	// Test with all supported types in a single call
	existingVar := &LiteralValue{
		Data: &LiteralValue_String_{String_: "existing"},
	}

	copiedVar := &LiteralValue{
		Data: &LiteralValue_Bool{Bool: true},
	}

	//nolint:govet // intentionally testing copy behavior for VariableValue (non-pointer)
	input := map[string]any{
		"string_val":        "hello",
		"int_val":           123,
		"int64_val":         int64(456),
		"float64_val":       78.9,
		"bool_val":          false,
		"object_val":        map[string]any{"key": "value"},
		"existing_var_ptr":  existingVar,
		"existing_var_copy": copiedVar,
	}

	result, err := MapToLiteralValues(input)
	if err != nil {
		t.Fatalf("VariablesToMap() unexpected error = %v", err)
	}

	if len(result) != 8 {
		t.Errorf("VariablesToMap() returned %d variables, want 8", len(result))
	}

	// Verify string
	if strVal, ok := result["string_val"].Data.(*LiteralValue_String_); !ok || strVal.String_ != "hello" {
		t.Errorf("VariablesToMap() string_val incorrect")
	}

	// Verify int
	if intVal, ok := result["int_val"].Data.(*LiteralValue_Int64); !ok || intVal.Int64 != 123 {
		t.Errorf("VariablesToMap() int_val incorrect")
	}

	// Verify int64
	if int64Val, ok := result["int64_val"].Data.(*LiteralValue_Int64); !ok || int64Val.Int64 != 456 {
		t.Errorf("VariablesToMap() int64_val incorrect")
	}

	// Verify float64
	if floatVal, ok := result["float64_val"].Data.(*LiteralValue_Double); !ok || floatVal.Double != 78.9 {
		t.Errorf("VariablesToMap() float64_val incorrect")
	}

	// Verify bool
	if boolVal, ok := result["bool_val"].Data.(*LiteralValue_Bool); !ok || boolVal.Bool != false {
		t.Errorf("VariablesToMap() bool_val incorrect")
	}

	// Verify object
	if objVal, ok := result["object_val"].Data.(*LiteralValue_Object); !ok || objVal.Object == nil {
		t.Errorf("VariablesToMap() object_val incorrect")
	}

	// Verify existing pointer preserved
	if result["existing_var_ptr"] != existingVar {
		t.Errorf("VariablesToMap() did not preserve existing_var_ptr")
	}

	// Verify copied variable
	if copiedBool, ok := result["existing_var_copy"].Data.(*LiteralValue_Bool); !ok || copiedBool.Bool != true {
		t.Errorf("VariablesToMap() existing_var_copy incorrect")
	}
}

func TestVariablesToMap_ZeroValues(t *testing.T) {
	// Test that zero values are handled correctly
	input := map[string]any{
		"empty_string": "",
		"zero_int":     0,
		"zero_int64":   int64(0),
		"zero_float":   0.0,
		"false_bool":   false,
		"empty_object": map[string]any{},
	}

	result, err := MapToLiteralValues(input)
	if err != nil {
		t.Fatalf("VariablesToMap() unexpected error = %v", err)
	}

	if len(result) != 6 {
		t.Errorf("VariablesToMap() returned %d variables, want 6", len(result))
	}

	// Verify empty string
	if strVal, ok := result["empty_string"].Data.(*LiteralValue_String_); !ok || strVal.String_ != "" {
		t.Errorf("VariablesToMap() empty_string incorrect")
	}

	// Verify zero int
	if intVal, ok := result["zero_int"].Data.(*LiteralValue_Int64); !ok || intVal.Int64 != 0 {
		t.Errorf("VariablesToMap() zero_int incorrect")
	}

	// Verify zero int64
	if int64Val, ok := result["zero_int64"].Data.(*LiteralValue_Int64); !ok || int64Val.Int64 != 0 {
		t.Errorf("VariablesToMap() zero_int64 incorrect")
	}

	// Verify zero float
		if floatVal, ok := result["zero_float"].Data.(*LiteralValue_Double); !ok || floatVal.Double != 0.0 {
		t.Errorf("VariablesToMap() zero_float incorrect")
	}

	// Verify false bool
	if boolVal, ok := result["false_bool"].Data.(*LiteralValue_Bool); !ok || boolVal.Bool != false {
		t.Errorf("VariablesToMap() false_bool incorrect")
	}

	// Verify empty object
	if objVal, ok := result["empty_object"].Data.(*LiteralValue_Object); !ok || objVal.Object == nil {
		t.Errorf("VariablesToMap() empty_object incorrect")
	}
}

func TestVariablesToMap_NegativeNumbers(t *testing.T) {
	input := map[string]any{
		"negative_int":   -42,
		"negative_int64": int64(-1000),
		"negative_float": -99.99,
	}

	result, err := MapToLiteralValues(input)
	if err != nil {
		t.Fatalf("VariablesToMap() unexpected error = %v", err)
	}

	if len(result) != 3 {
		t.Errorf("VariablesToMap() returned %d variables, want 3", len(result))
	}

	// Verify negative int
	if intVal, ok := result["negative_int"].Data.(*LiteralValue_Int64); !ok || intVal.Int64 != -42 {
		t.Errorf("VariablesToMap() negative_int = %d, want -42", intVal.Int64)
	}

	// Verify negative int64
	if int64Val, ok := result["negative_int64"].Data.(*LiteralValue_Int64); !ok || int64Val.Int64 != -1000 {
		t.Errorf("VariablesToMap() negative_int64 = %d, want -1000", int64Val.Int64)
	}

	// Verify negative float
	if floatVal, ok := result["negative_float"].Data.(*LiteralValue_Double); !ok || floatVal.Double != -99.99 {
		t.Errorf("VariablesToMap() negative_float = %f, want -99.99", floatVal.Double)
	}
}

func TestVariablesToMap_ObjectWithMixedTypes(t *testing.T) {
	input := map[string]any{
		"mixed": map[string]any{
			"name":    "test",
			"count":   float64(5),
			"active":  true,
			"details": map[string]any{"level": float64(3)},
		},
	}

	result, err := MapToLiteralValues(input)
	if err != nil {
		t.Fatalf("VariablesToMap() unexpected error = %v", err)
	}

	objVal, ok := result["mixed"].Data.(*LiteralValue_Object)
	if !ok {
		t.Fatalf("VariablesToMap() value is %T, want *Value_Object", result["mixed"].Data)
	}

	fields := objVal.Object.Fields

	if fields["name"].GetStringValue() != "test" {
		t.Errorf("VariablesToMap() mixed.name incorrect")
	}

	if fields["count"].GetNumberValue() != 5.0 {
		t.Errorf("VariablesToMap() mixed.count incorrect")
	}

	if fields["active"].GetBoolValue() != true {
		t.Errorf("VariablesToMap() mixed.active incorrect")
	}

	details := fields["details"].GetStructValue()
	if details == nil || details.Fields["level"].GetNumberValue() != 3.0 {
		t.Errorf("VariablesToMap() mixed.details.level incorrect")
	}
}

func TestVariablesToMap_StructpbNewStructError(t *testing.T) {
	// Create a map with a value that will cause structpb.NewStruct to fail
	// Channels, functions, and complex types cannot be marshaled to structpb
	input := map[string]any{
		"invalid": map[string]any{
			"channel": make(chan int),
		},
	}

		result, err := MapToLiteralValues(input)

	if err == nil {
		t.Errorf("VariablesToMap() expected error for structpb.NewStruct failure but got none")
		return
	}

	if result != nil {
		t.Errorf("VariablesToMap() with error should return nil, got %v", result)
	}
}
