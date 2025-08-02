package mapping

import (
	"testing"
	"time"

	"github.com/ctrlplanedev/selector-engine/pkg/model"
	"github.com/ctrlplanedev/selector-engine/pkg/model/resource"
	"github.com/ctrlplanedev/selector-engine/pkg/model/selector"
	pb "github.com/ctrlplanedev/selector-engine/pkg/pb/proto"
	"google.golang.org/protobuf/types/known/timestamppb"
)

func TestResourceMappings(t *testing.T) {
	now := time.Now()

	// Test protobuf Resource
	protoResource := &pb.Resource{
		Id:          "test-id",
		WorkspaceId: "workspace-1",
		Identifier:  "test-identifier",
		Name:        "Test Resource",
		Kind:        "test-kind",
		Version:     "1.0.0",
		CreatedAt:   timestamppb.New(now),
		LastSync:    timestamppb.New(now),
		Metadata: map[string]string{
			"key1": "value1",
			"key2": "value2",
		},
	}

	t.Run("FromProtoResource", func(t *testing.T) {
		mod := FromProtoResource(protoResource)
		if mod.ID != protoResource.GetId() {
			t.Errorf("Expected ID %s, got %s", protoResource.GetId(), mod.ID)
		}
		if mod.Name != protoResource.GetName() {
			t.Errorf("Expected Name %s, got %s", protoResource.GetName(), mod.Name)
		}
		if len(mod.Metadata) != len(protoResource.GetMetadata()) {
			t.Errorf("Expected metadata length %d, got %d", len(protoResource.GetMetadata()), len(mod.Metadata))
		}
	})

	t.Run("ToProtoResource", func(t *testing.T) {
		mod := FromProtoResource(protoResource)
		backToProto := ToProtoResource(mod)
		if backToProto == nil {
			t.Fatal("Expected non-nil proto")
		}
		if backToProto.GetId() != protoResource.GetId() {
			t.Errorf("Expected ID %s, got %s", protoResource.GetId(), backToProto.GetId())
		}
		if backToProto.GetName() != protoResource.GetName() {
			t.Errorf("Expected Name %s, got %s", protoResource.GetName(), backToProto.GetName())
		}
	})

}

func TestResourceSelectorMappings(t *testing.T) {
	protoSelector := &pb.ResourceSelector{
		Id:          "selector-1",
		WorkspaceId: "workspace-1",
		EntityType:  "deployment",
		Condition:   nil, // No selector for simplicity
	}

	t.Run("FromProtoResourceSelector", func(t *testing.T) {
		mod, err := FromProtoResourceSelector(protoSelector)
		if err != nil {
			t.Fatalf("Unexpected error: %v", err)
		}
		if mod.ID != protoSelector.GetId() {
			t.Errorf("Expected ID %s, got %s", protoSelector.GetId(), mod.ID)
		}
		if string(mod.EntityType) != protoSelector.GetEntityType() {
			t.Errorf("Expected EntityType %s, got %s", protoSelector.GetEntityType(), mod.EntityType)
		}
	})

}

func TestMatchMappings(t *testing.T) {
	protoMatch := &pb.Match{
		Error:      false,
		Message:    "Test match",
		SelectorId: "selector-1",
		ResourceId: "resource-1",
		Resource: &pb.Resource{
			Id:   "resource-1",
			Name: "Test Resource",
		},
		Selector: &pb.ResourceSelector{
			Id:         "selector-1",
			EntityType: "deployment",
		},
	}

	t.Run("FromProtoMatch", func(t *testing.T) {
		mod, err := FromProtoMatch(protoMatch)
		if err != nil {
			t.Fatalf("Unexpected error: %v", err)
		}
		if mod.Error != protoMatch.GetError() {
			t.Errorf("Expected Error %v, got %v", protoMatch.GetError(), mod.Error)
		}
		if mod.Message != protoMatch.GetMessage() {
			t.Errorf("Expected Message %s, got %s", protoMatch.GetMessage(), mod.Message)
		}
		if mod.Resource == nil {
			t.Error("Expected non-nil Resource")
		}
		if mod.Selector == nil {
			t.Error("Expected non-nil Selector")
		}
	})

	t.Run("ToProtoMatch", func(t *testing.T) {
		mod, err := FromProtoMatch(protoMatch)
		if err != nil {
			t.Fatalf("Unexpected error: %v", err)
		}
		backToProto := ToProtoMatch(mod)
		if backToProto == nil {
			t.Fatal("Expected non-nil proto")
		}
		if backToProto.GetError() != protoMatch.GetError() {
			t.Errorf("Expected Error %v, got %v", protoMatch.GetError(), backToProto.GetError())
		}
		if backToProto.GetMessage() != protoMatch.GetMessage() {
			t.Errorf("Expected Message %s, got %s", protoMatch.GetMessage(), backToProto.GetMessage())
		}
	})
}

func TestStatusMappings(t *testing.T) {
	protoStatus := &pb.Status{
		Error:   false,
		Message: "Operation successful",
	}

	t.Run("FromProtoStatus", func(t *testing.T) {
		mod := FromProtoStatus(protoStatus)
		if mod.Error != protoStatus.GetError() {
			t.Errorf("Expected Error %v, got %v", protoStatus.GetError(), mod.Error)
		}
		if mod.Message != protoStatus.GetMessage() {
			t.Errorf("Expected Message %s, got %s", protoStatus.GetMessage(), mod.Message)
		}
	})

	t.Run("ToProtoStatus", func(t *testing.T) {
		mod := FromProtoStatus(protoStatus)
		backToProto := ToProtoStatus(mod)
		if backToProto == nil {
			t.Fatal("Expected non-nil proto")
		}
		if backToProto.GetError() != protoStatus.GetError() {
			t.Errorf("Expected Error %v, got %v", protoStatus.GetError(), backToProto.GetError())
		}
		if backToProto.GetMessage() != protoStatus.GetMessage() {
			t.Errorf("Expected Message %s, got %s", protoStatus.GetMessage(), backToProto.GetMessage())
		}
	})
}

func TestResourceRefMappings(t *testing.T) {
	protoRef := &pb.ResourceRef{
		Id: "resource-ref-1",
	}

	t.Run("FromProtoResourceRef", func(t *testing.T) {
		mod := FromProtoResourceRef(protoRef)
		if mod.ID != protoRef.GetId() {
			t.Errorf("Expected %s, got %s", protoRef.GetId(), mod.ID)
		}
		if mod.WorkspaceID != protoRef.GetWorkspaceId() {
			t.Errorf("Expected %s, got %s", protoRef.GetWorkspaceId(), mod.WorkspaceID)
		}
	})
}

func TestResourceSelectorRefMappings(t *testing.T) {
	protoRef := &pb.ResourceSelectorRef{
		Id: "selector-ref-1",
	}

	t.Run("FromProtoResourceSelectorRef", func(t *testing.T) {
		mod := FromProtoResourceSelectorRef(protoRef)
		if mod.ID != protoRef.GetId() {
			t.Errorf("Expected %s, got %s", protoRef.GetId(), mod.ID)
		}
		if mod.WorkspaceID != protoRef.GetWorkspaceId() {
			t.Errorf("Expected %s, got %s", protoRef.GetWorkspaceId(), mod.WorkspaceID)
		}
		if string(mod.EntityType) != protoRef.GetEntityType() {
			t.Errorf("Expected %s, got %s", protoRef.GetEntityType(), mod.EntityType)
		}
	})
}

func TestFromProtoEntityType(t *testing.T) {
	tests := []struct {
		name        string
		input       string
		expected    string
		expectError bool
	}{
		{
			name:        "Valid deployment entity type",
			input:       "deployment",
			expected:    "deployment",
			expectError: false,
		},
		{
			name:        "Valid environment entity type",
			input:       "environment",
			expected:    "environment",
			expectError: false,
		},
		{
			name:        "Invalid entity type",
			input:       "invalid",
			expected:    "",
			expectError: true,
		},
		{
			name:        "Empty entity type",
			input:       "",
			expected:    "",
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := FromProtoEntityType(tt.input)
			if tt.expectError {
				if err == nil {
					t.Errorf("Expected error but got none")
				}
			} else {
				if err != nil {
					t.Errorf("Unexpected error: %v", err)
				}
				if string(result) != tt.expected {
					t.Errorf("Expected %s, got %s", tt.expected, string(result))
				}
			}
		})
	}
}

func TestOperatorConversions(t *testing.T) {
	t.Run("fromProtoColumnOperator", func(t *testing.T) {
		tests := []struct {
			name     string
			input    pb.ColumnOperator
			expected string
		}{
			{"EQUALS", pb.ColumnOperator_COLUMN_OPERATOR_EQUALS, "equals"},
			{"STARTS_WITH", pb.ColumnOperator_COLUMN_OPERATOR_STARTS_WITH, "starts-with"},
			{"ENDS_WITH", pb.ColumnOperator_COLUMN_OPERATOR_ENDS_WITH, "ends-with"},
			{"CONTAINS", pb.ColumnOperator_COLUMN_OPERATOR_CONTAINS, "contains"},
			{"Default case", pb.ColumnOperator(999), "equals"},
		}

		for _, tt := range tests {
			t.Run(tt.name, func(t *testing.T) {
				result := fromProtoColumnOperator(tt.input)
				if string(result) != tt.expected {
					t.Errorf("Expected %s, got %s", tt.expected, string(result))
				}
			})
		}
	})

	t.Run("fromProtoIdOperator", func(t *testing.T) {
		tests := []struct {
			name        string
			input       string
			expected    string
			expectError bool
		}{
			{"Valid equals operator", "equals", "equals", false},
			{"Invalid operator", "invalid", "", true},
			{"Empty operator", "", "", true},
		}

		for _, tt := range tests {
			t.Run(tt.name, func(t *testing.T) {
				result, err := fromProtoIdOperator(tt.input)
				if tt.expectError {
					if err == nil {
						t.Errorf("Expected error but got none")
					}
				} else {
					if err != nil {
						t.Errorf("Unexpected error: %v", err)
					}
					if string(result) != tt.expected {
						t.Errorf("Expected %s, got %s", tt.expected, string(result))
					}
				}
			})
		}
	})

	t.Run("fromProtoMetadataOperator", func(t *testing.T) {
		tests := []struct {
			name        string
			input       pb.MetadataOperator
			expected    string
			expectError bool
		}{
			{"EQUALS", pb.MetadataOperator_METADATA_OPERATOR_EQUALS, "equals", false},
			{"NULL", pb.MetadataOperator_METADATA_OPERATOR_NULL, "null", false},
			{"STARTS_WITH", pb.MetadataOperator_METADATA_OPERATOR_STARTS_WITH, "starts-with", false},
			{"ENDS_WITH", pb.MetadataOperator_METADATA_OPERATOR_ENDS_WITH, "ends-with", false},
			{"CONTAINS", pb.MetadataOperator_METADATA_OPERATOR_CONTAINS, "contains", false},
			{"Invalid operator", pb.MetadataOperator(999), "", true},
		}

		for _, tt := range tests {
			t.Run(tt.name, func(t *testing.T) {
				result, err := fromProtoMetadataOperator(tt.input)
				if tt.expectError {
					if err == nil {
						t.Errorf("Expected error but got none")
					}
				} else {
					if err != nil {
						t.Errorf("Unexpected error: %v", err)
					}
					if string(result) != tt.expected {
						t.Errorf("Expected %s, got %s", tt.expected, string(result))
					}
				}
			})
		}
	})

	t.Run("fromProtoComparisonOperator", func(t *testing.T) {
		tests := []struct {
			name        string
			input       pb.ComparisonOperator
			expected    string
			expectError bool
		}{
			{"AND", pb.ComparisonOperator_COMPARISON_OPERATOR_AND, "and", false},
			{"OR", pb.ComparisonOperator_COMPARISON_OPERATOR_OR, "or", false},
			{"Invalid operator", pb.ComparisonOperator(999), "", true},
		}

		for _, tt := range tests {
			t.Run(tt.name, func(t *testing.T) {
				result, err := fromProtoComparisonOperator(tt.input)
				if tt.expectError {
					if err == nil {
						t.Errorf("Expected error but got none")
					}
				} else {
					if err != nil {
						t.Errorf("Unexpected error: %v", err)
					}
					if string(result) != tt.expected {
						t.Errorf("Expected %s, got %s", tt.expected, string(result))
					}
				}
			})
		}
	})

	t.Run("fromProtoDateOperator", func(t *testing.T) {
		tests := []struct {
			name        string
			input       pb.DateOperator
			expected    string
			expectError bool
		}{
			{"AFTER", pb.DateOperator_DATE_OPERATOR_AFTER, "after", false},
			{"BEFORE", pb.DateOperator_DATE_OPERATOR_BEFORE, "before", false},
			{"BEFORE_OR_ON", pb.DateOperator_DATE_OPERATOR_BEFORE_OR_ON, "before-or-on", false},
			{"AFTER_OR_ON", pb.DateOperator_DATE_OPERATOR_AFTER_OR_ON, "after-or-on", false},
			{"Invalid operator", pb.DateOperator(999), "", true},
		}

		for _, tt := range tests {
			t.Run(tt.name, func(t *testing.T) {
				result, err := fromProtoDateOperator(tt.input)
				if tt.expectError {
					if err == nil {
						t.Errorf("Expected error but got none")
					}
				} else {
					if err != nil {
						t.Errorf("Unexpected error: %v", err)
					}
					if string(result) != tt.expected {
						t.Errorf("Expected %s, got %s", tt.expected, string(result))
					}
				}
			})
		}
	})

	t.Run("fromProtoDateField", func(t *testing.T) {
		tests := []struct {
			name        string
			input       pb.DateField
			expected    string
			expectError bool
		}{
			{"CREATED_AT", pb.DateField_DATE_FIELD_CREATED_AT, "created-at", false},
			{"UPDATED_AT", pb.DateField_DATE_FIELD_UPDATED_AT, "updated-at", false},
			{"Invalid field", pb.DateField(999), "", true},
		}

		for _, tt := range tests {
			t.Run(tt.name, func(t *testing.T) {
				result, err := fromProtoDateField(tt.input)
				if tt.expectError {
					if err == nil {
						t.Errorf("Expected error but got none")
					}
				} else {
					if err != nil {
						t.Errorf("Unexpected error: %v", err)
					}
					if string(result) != tt.expected {
						t.Errorf("Expected %s, got %s", tt.expected, string(result))
					}
				}
			})
		}
	})
}

func TestParseISO8601Date(t *testing.T) {
	tests := []struct {
		name        string
		input       string
		expectError bool
	}{
		{
			name:        "RFC3339 format",
			input:       "2023-12-25T15:30:45Z",
			expectError: false,
		},
		{
			name:        "RFC3339 with timezone",
			input:       "2023-12-25T15:30:45+02:00",
			expectError: false,
		},
		{
			name:        "Date only format",
			input:       "2023-12-25",
			expectError: false,
		},
		{
			name:        "Full datetime with nanoseconds",
			input:       "2023-12-25T15:30:45.123456789",
			expectError: false,
		},
		{
			name:        "Invalid format",
			input:       "invalid-date",
			expectError: true,
		},
		{
			name:        "Empty string",
			input:       "",
			expectError: true,
		},
		{
			name:        "Wrong format",
			input:       "25/12/2023",
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := ParseISO8601Date(tt.input)
			if tt.expectError {
				if err == nil {
					t.Errorf("Expected error but got none")
				}
			} else {
				if err != nil {
					t.Errorf("Unexpected error: %v", err)
				}
				if result.IsZero() {
					t.Errorf("Expected valid time but got zero time")
				}
			}
		})
	}
}

func TestFromProtoCondition(t *testing.T) {
	t.Run("IDCondition", func(t *testing.T) {
		protoCondition := &pb.Condition{
			ConditionType: &pb.Condition_IdCondition{
				IdCondition: &pb.IDCondition{
					Value:    "test-id",
					Operator: "equals",
				},
			},
		}

		result, err := fromProtoCondition(protoCondition)
		if err != nil {
			t.Fatalf("Unexpected error: %v", err)
		}

		idCond, ok := result.(*selector.IDCondition)
		if !ok {
			t.Fatalf("Expected IDCondition, got %T", result)
		}

		if idCond.Value != "test-id" {
			t.Errorf("Expected value 'test-id', got %s", idCond.Value)
		}
		if idCond.Operator != selector.IdOperatorEquals {
			t.Errorf("Expected operator equals, got %s", idCond.Operator)
		}
	})

	t.Run("IDCondition with invalid operator", func(t *testing.T) {
		protoCondition := &pb.Condition{
			ConditionType: &pb.Condition_IdCondition{
				IdCondition: &pb.IDCondition{
					Value:    "test-id",
					Operator: "invalid",
				},
			},
		}

		_, err := fromProtoCondition(protoCondition)
		if err == nil {
			t.Error("Expected error for invalid operator")
		}
	})

	t.Run("NameCondition", func(t *testing.T) {
		protoCondition := &pb.Condition{
			ConditionType: &pb.Condition_NameCondition{
				NameCondition: &pb.NameCondition{
					Value:    "test-name",
					Operator: pb.ColumnOperator_COLUMN_OPERATOR_CONTAINS,
				},
			},
		}

		result, err := fromProtoCondition(protoCondition)
		if err != nil {
			t.Fatalf("Unexpected error: %v", err)
		}

		nameCond, ok := result.(*selector.NameCondition)
		if !ok {
			t.Fatalf("Expected NameCondition, got %T", result)
		}

		if nameCond.Value != "test-name" {
			t.Errorf("Expected value 'test-name', got %s", nameCond.Value)
		}
		if nameCond.Operator != selector.ColumnOperatorContains {
			t.Errorf("Expected operator contains, got %s", nameCond.Operator)
		}
	})

	t.Run("MetadataValueCondition", func(t *testing.T) {
		protoCondition := &pb.Condition{
			ConditionType: &pb.Condition_MetadataValueCondition{
				MetadataValueCondition: &pb.MetadataValueCondition{
					Key:      "env",
					Value:    "production",
					Operator: pb.MetadataOperator_METADATA_OPERATOR_EQUALS,
				},
			},
		}

		result, err := fromProtoCondition(protoCondition)
		if err != nil {
			t.Fatalf("Unexpected error: %v", err)
		}

		metaCond, ok := result.(*selector.MetadataValueCondition)
		if !ok {
			t.Fatalf("Expected MetadataValueCondition, got %T", result)
		}

		if metaCond.Key != "env" {
			t.Errorf("Expected key 'env', got %s", metaCond.Key)
		}
		if metaCond.Value != "production" {
			t.Errorf("Expected value 'production', got %s", metaCond.Value)
		}
		if metaCond.Operator != selector.MetadataOperatorEquals {
			t.Errorf("Expected operator equals, got %s", metaCond.Operator)
		}
	})

	t.Run("MetadataValueCondition with invalid operator", func(t *testing.T) {
		protoCondition := &pb.Condition{
			ConditionType: &pb.Condition_MetadataValueCondition{
				MetadataValueCondition: &pb.MetadataValueCondition{
					Key:      "env",
					Value:    "production",
					Operator: pb.MetadataOperator(999),
				},
			},
		}

		_, err := fromProtoCondition(protoCondition)
		if err == nil {
			t.Error("Expected error for invalid metadata operator")
		}
	})

	t.Run("MetadataNullCondition", func(t *testing.T) {
		protoCondition := &pb.Condition{
			ConditionType: &pb.Condition_MetadataNullCondition{
				MetadataNullCondition: &pb.MetadataNullCondition{
					Key: "optional-field",
				},
			},
		}

		result, err := fromProtoCondition(protoCondition)
		if err != nil {
			t.Fatalf("Unexpected error: %v", err)
		}

		metaNullCond, ok := result.(*selector.MetadataNullCondition)
		if !ok {
			t.Fatalf("Expected MetadataNullCondition, got %T", result)
		}

		if metaNullCond.Key != "optional-field" {
			t.Errorf("Expected key 'optional-field', got %s", metaNullCond.Key)
		}
		if metaNullCond.Operator != selector.MetadataOperatorNull {
			t.Errorf("Expected operator null, got %s", metaNullCond.Operator)
		}
	})

	t.Run("ComparisonCondition", func(t *testing.T) {
		innerCondition1 := &pb.Condition{
			ConditionType: &pb.Condition_IdCondition{
				IdCondition: &pb.IDCondition{
					Value:    "test-id-1",
					Operator: "equals",
				},
			},
		}
		innerCondition2 := &pb.Condition{
			ConditionType: &pb.Condition_NameCondition{
				NameCondition: &pb.NameCondition{
					Value:    "test-name",
					Operator: pb.ColumnOperator_COLUMN_OPERATOR_CONTAINS,
				},
			},
		}

		protoCondition := &pb.Condition{
			ConditionType: &pb.Condition_ComparisonCondition{
				ComparisonCondition: &pb.ComparisonCondition{
					Operator:   pb.ComparisonOperator_COMPARISON_OPERATOR_AND,
					Conditions: []*pb.Condition{innerCondition1, innerCondition2},
				},
			},
		}

		result, err := fromProtoCondition(protoCondition)
		if err != nil {
			t.Fatalf("Unexpected error: %v", err)
		}

		compCond, ok := result.(*selector.ComparisonCondition)
		if !ok {
			t.Fatalf("Expected ComparisonCondition, got %T", result)
		}

		if compCond.Operator != selector.ComparisonOperatorAnd {
			t.Errorf("Expected operator and, got %s", compCond.Operator)
		}
		if len(compCond.Conditions) != 2 {
			t.Errorf("Expected 2 conditions, got %d", len(compCond.Conditions))
		}
	})

	t.Run("ComparisonCondition with invalid operator", func(t *testing.T) {
		protoCondition := &pb.Condition{
			ConditionType: &pb.Condition_ComparisonCondition{
				ComparisonCondition: &pb.ComparisonCondition{
					Operator:   pb.ComparisonOperator(999),
					Conditions: []*pb.Condition{},
				},
			},
		}

		_, err := fromProtoCondition(protoCondition)
		if err == nil {
			t.Error("Expected error for invalid comparison operator")
		}
	})

	t.Run("ComparisonCondition with invalid nested condition", func(t *testing.T) {
		invalidInnerCondition := &pb.Condition{
			ConditionType: &pb.Condition_IdCondition{
				IdCondition: &pb.IDCondition{
					Value:    "test-id",
					Operator: "invalid-operator",
				},
			},
		}

		protoCondition := &pb.Condition{
			ConditionType: &pb.Condition_ComparisonCondition{
				ComparisonCondition: &pb.ComparisonCondition{
					Operator:   pb.ComparisonOperator_COMPARISON_OPERATOR_AND,
					Conditions: []*pb.Condition{invalidInnerCondition},
				},
			},
		}

		_, err := fromProtoCondition(protoCondition)
		if err == nil {
			t.Error("Expected error for invalid nested condition")
		}
	})

	t.Run("DateCondition", func(t *testing.T) {
		protoCondition := &pb.Condition{
			ConditionType: &pb.Condition_DateCondition{
				DateCondition: &pb.DateCondition{
					Value:     "2023-12-25T15:30:45Z",
					Operator:  pb.DateOperator_DATE_OPERATOR_AFTER,
					DateField: pb.DateField_DATE_FIELD_CREATED_AT,
				},
			},
		}

		result, err := fromProtoCondition(protoCondition)
		if err != nil {
			t.Fatalf("Unexpected error: %v", err)
		}

		dateCond, ok := result.(*selector.DateCondition)
		if !ok {
			t.Fatalf("Expected DateCondition, got %T", result)
		}

		if dateCond.Operator != selector.DateOperatorAfter {
			t.Errorf("Expected operator after, got %s", dateCond.Operator)
		}
		if dateCond.DateField != selector.DateFieldCreatedAt {
			t.Errorf("Expected field created_at, got %s", dateCond.DateField)
		}
		if dateCond.Value.IsZero() {
			t.Error("Expected non-zero time value")
		}
	})

	t.Run("DateCondition with invalid date", func(t *testing.T) {
		protoCondition := &pb.Condition{
			ConditionType: &pb.Condition_DateCondition{
				DateCondition: &pb.DateCondition{
					Value:     "invalid-date",
					Operator:  pb.DateOperator_DATE_OPERATOR_AFTER,
					DateField: pb.DateField_DATE_FIELD_CREATED_AT,
				},
			},
		}

		_, err := fromProtoCondition(protoCondition)
		if err == nil {
			t.Error("Expected error for invalid date format")
		}
	})

	t.Run("DateCondition with invalid operator", func(t *testing.T) {
		protoCondition := &pb.Condition{
			ConditionType: &pb.Condition_DateCondition{
				DateCondition: &pb.DateCondition{
					Value:     "2023-12-25T15:30:45Z",
					Operator:  pb.DateOperator(999),
					DateField: pb.DateField_DATE_FIELD_CREATED_AT,
				},
			},
		}

		_, err := fromProtoCondition(protoCondition)
		if err == nil {
			t.Error("Expected error for invalid date operator")
		}
	})

	t.Run("DateCondition with invalid date field", func(t *testing.T) {
		protoCondition := &pb.Condition{
			ConditionType: &pb.Condition_DateCondition{
				DateCondition: &pb.DateCondition{
					Value:     "2023-12-25T15:30:45Z",
					Operator:  pb.DateOperator_DATE_OPERATOR_AFTER,
					DateField: pb.DateField(999),
				},
			},
		}

		_, err := fromProtoCondition(protoCondition)
		if err == nil {
			t.Error("Expected error for invalid date field")
		}
	})

	t.Run("VersionCondition", func(t *testing.T) {
		protoCondition := &pb.Condition{
			ConditionType: &pb.Condition_VersionCondition{
				VersionCondition: &pb.VersionCondition{
					Value:    "1.0.0",
					Operator: pb.ColumnOperator_COLUMN_OPERATOR_EQUALS,
				},
			},
		}

		result, err := fromProtoCondition(protoCondition)
		if err != nil {
			t.Fatalf("Unexpected error: %v", err)
		}

		versionCond, ok := result.(*selector.VersionCondition)
		if !ok {
			t.Fatalf("Expected VersionCondition, got %T", result)
		}

		if versionCond.Value != "1.0.0" {
			t.Errorf("Expected value '1.0.0', got %s", versionCond.Value)
		}
		if versionCond.Operator != selector.ColumnOperatorEquals {
			t.Errorf("Expected operator equals, got %s", versionCond.Operator)
		}
	})

	t.Run("Unknown condition type", func(t *testing.T) {
		protoCondition := &pb.Condition{}

		_, err := fromProtoCondition(protoCondition)
		if err == nil {
			t.Error("Expected error for unknown condition type")
		}
	})
}

func TestNilHandling(t *testing.T) {
	t.Run("Nil protobuf inputs", func(t *testing.T) {
		// FromProtoResource returns a zero value for nil input
		mod := FromProtoResource(nil)
		if mod.ID != "" || mod.Name != "" {
			t.Error("Expected zero value for nil input")
		}
		// FromProtoResourceSelector returns a zero value for nil input
		result, err := FromProtoResourceSelector(nil)
		if err != nil {
			t.Errorf("Unexpected error for nil input: %v", err)
		}
		if result.ID != "" || result.WorkspaceID != "" {
			t.Error("Expected zero value for nil input")
		}
		// FromProtoMatch returns a zero value for nil input
		resultMatch, errMatch := FromProtoMatch(nil)
		if errMatch != nil {
			t.Errorf("Unexpected error for nil input: %v", errMatch)
		}
		if resultMatch.Error || resultMatch.Message != "" {
			t.Error("Expected zero value for nil input")
		}
		// FromProtoStatus returns a zero value for nil input
		status := FromProtoStatus(nil)
		if status.Error || status.Message != "" {
			t.Error("Expected zero value for nil input")
		}
		// FromProtoResourceRef returns a zero value for nil input
		ref := FromProtoResourceRef(nil)
		if ref.ID != "" || ref.WorkspaceID != "" {
			t.Error("Expected zero value for nil input")
		}
		// FromProtoResourceSelectorRef returns a zero value for nil input
		selectorRef := FromProtoResourceSelectorRef(nil)
		if selectorRef.ID != "" || selectorRef.WorkspaceID != "" {
			t.Error("Expected zero value for nil input")
		}
		// fromProtoCondition returns nil for nil input
		cond, err := fromProtoCondition(nil)
		if err != nil {
			t.Errorf("Unexpected error for nil input: %v", err)
		}
		if cond != nil {
			t.Error("Expected nil condition for nil input")
		}
	})
}

func TestEdgeCases(t *testing.T) {
	t.Run("Resource with empty metadata", func(t *testing.T) {
		protoResource := &pb.Resource{
			Id:       "test-id",
			Name:     "Test Resource",
			Metadata: map[string]string{},
		}

		mod := FromProtoResource(protoResource)
		if mod.Metadata == nil {
			t.Error("Expected non-nil metadata map")
		}
		if len(mod.Metadata) != 0 {
			t.Error("Expected empty metadata map")
		}

		backToProto := ToProtoResource(mod)
		if backToProto.Metadata == nil {
			t.Error("Expected non-nil metadata map")
		}
		if len(backToProto.Metadata) != 0 {
			t.Error("Expected empty metadata map")
		}
	})

	t.Run("Resource with nil metadata in proto", func(t *testing.T) {
		protoResource := &pb.Resource{
			Id:       "test-id",
			Name:     "Test Resource",
			Metadata: nil,
		}

		mod := FromProtoResource(protoResource)
		if mod.Metadata == nil {
			t.Error("Expected non-nil metadata map")
		}
		if len(mod.Metadata) != 0 {
			t.Error("Expected empty metadata map")
		}
	})

	t.Run("Resource with zero timestamps", func(t *testing.T) {
		mod := resource.Resource{
			ID:        "test-id",
			Name:      "Test Resource",
			CreatedAt: time.Time{},
			LastSync:  time.Time{},
		}

		proto := ToProtoResource(mod)
		if proto.CreatedAt != nil {
			t.Error("Expected nil CreatedAt for zero time")
		}
		if proto.LastSync != nil {
			t.Error("Expected nil LastSync for zero time")
		}
	})

	t.Run("ResourceSelector with invalid entity type", func(t *testing.T) {
		protoSelector := &pb.ResourceSelector{
			Id:          "selector-1",
			WorkspaceId: "workspace-1",
			EntityType:  "invalid-type",
		}

		_, err := FromProtoResourceSelector(protoSelector)
		if err == nil {
			t.Error("Expected error for invalid entity type")
		}
	})

	t.Run("Match without resource or selector", func(t *testing.T) {
		protoMatch := &pb.Match{
			Error:      false,
			Message:    "Test match",
			SelectorId: "selector-1",
			ResourceId: "resource-1",
			Resource:   nil,
			Selector:   nil,
		}

		mod, err := FromProtoMatch(protoMatch)
		if err != nil {
			t.Fatalf("Unexpected error: %v", err)
		}

		if mod.Resource != nil {
			t.Error("Expected nil Resource")
		}
		if mod.Selector != nil {
			t.Error("Expected nil Selector")
		}
	})

	t.Run("Match with invalid selector", func(t *testing.T) {
		protoMatch := &pb.Match{
			Error:      false,
			Message:    "Test match",
			SelectorId: "selector-1",
			ResourceId: "resource-1",
			Selector: &pb.ResourceSelector{
				Id:         "selector-1",
				EntityType: "invalid-type",
			},
		}

		_, err := FromProtoMatch(protoMatch)
		if err == nil {
			t.Error("Expected error for invalid selector")
		}
	})
}

func TestMissingToProtoFunctions(t *testing.T) {
	t.Run("ToProtoResourceRef", func(t *testing.T) {
		ref := resource.ResourceRef{
			ID:          "resource-1",
			WorkspaceID: "workspace-1",
		}

		proto := ToProtoResourceRef(ref)
		if proto == nil {
			t.Fatal("Expected non-nil proto")
		}
		if proto.GetId() != ref.ID {
			t.Errorf("Expected ID %s, got %s", ref.ID, proto.GetId())
		}
		if proto.GetWorkspaceId() != ref.WorkspaceID {
			t.Errorf("Expected WorkspaceID %s, got %s", ref.WorkspaceID, proto.GetWorkspaceId())
		}

		backToModel := FromProtoResourceRef(proto)
		if backToModel.ID != ref.ID {
			t.Errorf("Expected ID %s, got %s", ref.ID, backToModel.ID)
		}
		if backToModel.WorkspaceID != ref.WorkspaceID {
			t.Errorf("Expected WorkspaceID %s, got %s", ref.WorkspaceID, backToModel.WorkspaceID)
		}
	})

	t.Run("ToProtoResourceSelectorRef", func(t *testing.T) {
		ref := selector.ResourceSelectorRef{
			ID:          "selector-1",
			WorkspaceID: "workspace-1",
			EntityType:  selector.DeploymentEntityType,
		}

		proto := ToProtoResourceSelectorRef(ref)
		if proto == nil {
			t.Fatal("Expected non-nil proto")
		}
		if proto.GetId() != ref.ID {
			t.Errorf("Expected ID %s, got %s", ref.ID, proto.GetId())
		}
		if proto.GetWorkspaceId() != ref.WorkspaceID {
			t.Errorf("Expected WorkspaceID %s, got %s", ref.WorkspaceID, proto.GetWorkspaceId())
		}
		if proto.GetEntityType() != string(ref.EntityType) {
			t.Errorf("Expected EntityType %s, got %s", ref.EntityType, proto.GetEntityType())
		}

		backToModel := FromProtoResourceSelectorRef(proto)
		if backToModel.ID != ref.ID {
			t.Errorf("Expected ID %s, got %s", ref.ID, backToModel.ID)
		}
		if backToModel.WorkspaceID != ref.WorkspaceID {
			t.Errorf("Expected WorkspaceID %s, got %s", ref.WorkspaceID, backToModel.WorkspaceID)
		}
		if backToModel.EntityType != ref.EntityType {
			t.Errorf("Expected EntityType %s, got %s", ref.EntityType, backToModel.EntityType)
		}
	})

	t.Run("toProtoSelectorEntityType", func(t *testing.T) {
		entityType := selector.DeploymentEntityType
		result := toProtoSelectorEntityType(entityType)
		if result != string(entityType) {
			t.Errorf("Expected %s, got %s", string(entityType), result)
		}

		entityType2 := selector.EnvironmentEntityType
		result2 := toProtoSelectorEntityType(entityType2)
		if result2 != string(entityType2) {
			t.Errorf("Expected %s, got %s", string(entityType2), result2)
		}
	})
}

func TestRoundTripConversions(t *testing.T) {
	t.Run("Resource roundtrip with full data", func(t *testing.T) {
		now := time.Now().UTC().Truncate(time.Second)
		original := resource.Resource{
			ID:          "test-id",
			WorkspaceID: "workspace-1",
			Identifier:  "test-identifier",
			Name:        "Test Resource",
			Kind:        "test-kind",
			Version:     "1.0.0",
			CreatedAt:   now,
			LastSync:    now,
			Metadata: map[string]string{
				"env":     "production",
				"region":  "us-east-1",
				"unicode": "測試",
			},
		}

		proto := ToProtoResource(original)
		converted := FromProtoResource(proto)

		if converted.ID != original.ID {
			t.Errorf("ID mismatch: expected %s, got %s", original.ID, converted.ID)
		}
		if converted.WorkspaceID != original.WorkspaceID {
			t.Errorf("WorkspaceID mismatch: expected %s, got %s", original.WorkspaceID, converted.WorkspaceID)
		}
		if converted.Identifier != original.Identifier {
			t.Errorf("Identifier mismatch: expected %s, got %s", original.Identifier, converted.Identifier)
		}
		if converted.Name != original.Name {
			t.Errorf("Name mismatch: expected %s, got %s", original.Name, converted.Name)
		}
		if converted.Kind != original.Kind {
			t.Errorf("Kind mismatch: expected %s, got %s", original.Kind, converted.Kind)
		}
		if converted.Version != original.Version {
			t.Errorf("Version mismatch: expected %s, got %s", original.Version, converted.Version)
		}
		if !converted.CreatedAt.Equal(original.CreatedAt) {
			t.Errorf("CreatedAt mismatch: expected %v, got %v", original.CreatedAt, converted.CreatedAt)
		}
		if !converted.LastSync.Equal(original.LastSync) {
			t.Errorf("LastSync mismatch: expected %v, got %v", original.LastSync, converted.LastSync)
		}
		if len(converted.Metadata) != len(original.Metadata) {
			t.Errorf("Metadata length mismatch: expected %d, got %d", len(original.Metadata), len(converted.Metadata))
		}
		for k, v := range original.Metadata {
			if converted.Metadata[k] != v {
				t.Errorf("Metadata[%s] mismatch: expected %s, got %s", k, v, converted.Metadata[k])
			}
		}
	})

	t.Run("Status roundtrip", func(t *testing.T) {
		original := model.Status{
			Error:   true,
			Message: "Something went wrong",
		}

		proto := ToProtoStatus(original)
		converted := FromProtoStatus(proto)

		if converted.Error != original.Error {
			t.Errorf("Error mismatch: expected %v, got %v", original.Error, converted.Error)
		}
		if converted.Message != original.Message {
			t.Errorf("Message mismatch: expected %s, got %s", original.Message, converted.Message)
		}
	})
}
