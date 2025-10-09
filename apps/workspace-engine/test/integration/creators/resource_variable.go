package creators

import (
	"workspace-engine/pkg/pb"
)

// NewResourceVariable creates a new ResourceVariable with default values
func NewResourceVariable(resourceID string, key string) *pb.ResourceVariable {
	return &pb.ResourceVariable{
		ResourceId: resourceID,
		Key:        key,
	}
}

// NewLiteralValue creates a new LiteralValue from a Go value
func NewLiteralValue(value any) *pb.LiteralValue {
	literalValue, err := pb.ConvertValue(value)
	if err != nil {
		panic(err) // Helper function, panic is acceptable for test code
	}
	return literalValue
}

// NewValueFromLiteral creates a new Value with a literal data type
func NewValueFromLiteral(literalValue *pb.LiteralValue) *pb.Value {
	return &pb.Value{
		Data: &pb.Value_Literal{
			Literal: literalValue,
		},
	}
}

// NewValueFromString creates a new Value with a string literal
func NewValueFromString(value string) *pb.Value {
	return NewValueFromLiteral(&pb.LiteralValue{
		Data: &pb.LiteralValue_String_{String_: value},
	})
}

// NewValueFromInt creates a new Value with an int64 literal
func NewValueFromInt(value int64) *pb.Value {
	return NewValueFromLiteral(&pb.LiteralValue{
		Data: &pb.LiteralValue_Int64{Int64: value},
	})
}

// NewValueFromBool creates a new Value with a bool literal
func NewValueFromBool(value bool) *pb.Value {
	return NewValueFromLiteral(&pb.LiteralValue{
		Data: &pb.LiteralValue_Bool{Bool: value},
	})
}

// NewValueFromReference creates a new Value with a reference data type
func NewValueFromReference(reference string, path []string) *pb.Value {
	return &pb.Value{
		Data: &pb.Value_Reference{
			Reference: &pb.ReferenceValue{
				Reference: reference,
				Path:      path,
			},
		},
	}
}

// NewValueFromSensitive creates a new Value with a sensitive data type
func NewValueFromSensitive(valueHash string) *pb.Value {
	return &pb.Value{
		Data: &pb.Value_Sensitive{
			Sensitive: &pb.SensitiveValue{
				ValueHash: valueHash,
			},
		},
	}
}

