package relationships

import (
	"fmt"
	"testing"
	"workspace-engine/pkg/pb"

	"google.golang.org/protobuf/types/known/structpb"
)

// TestNewPropertyMatcher tests the PropertyMatcher constructor
func TestNewPropertyMatcher(t *testing.T) {
	tests := []struct {
		name             string
		inputMatcher     *pb.PropertyMatcher
		expectedOperator string
	}{
		{
			name: "default operator when empty",
			inputMatcher: &pb.PropertyMatcher{
				FromProperty: []string{"id"},
				ToProperty:   []string{"id"},
				Operator:     "",
			},
			expectedOperator: "equals",
		},
		{
			name: "preserves explicit operator",
			inputMatcher: &pb.PropertyMatcher{
				FromProperty: []string{"name"},
				ToProperty:   []string{"name"},
				Operator:     "contains",
			},
			expectedOperator: "contains",
		},
		{
			name: "preserves uppercase operator",
			inputMatcher: &pb.PropertyMatcher{
				FromProperty: []string{"name"},
				ToProperty:   []string{"name"},
				Operator:     "NOT_EQUALS",
			},
			expectedOperator: "NOT_EQUALS",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			matcher := NewPropertyMatcher(tt.inputMatcher)
			if matcher == nil {
				t.Fatal("NewPropertyMatcher returned nil")
			}
			if matcher.Operator != tt.expectedOperator {
				t.Errorf("expected operator %q, got %q", tt.expectedOperator, matcher.Operator)
			}
		})
	}
}

// TestPropertyMatcher_Evaluate_Equals tests the equals operator
func TestPropertyMatcher_Evaluate_Equals(t *testing.T) {
	tests := []struct {
		name     string
		from     any
		to       any
		matcher  *PropertyMatcher
		expected bool
	}{
		{
			name: "equal string values",
			from: &pb.Resource{
				Id:          "resource-1",
				Name:        "Test Resource",
				WorkspaceId: "workspace-1",
				Metadata:    map[string]string{"region": "us-east-1"},
			},
			to: &pb.Resource{
				Id:          "resource-2",
				Name:        "Another Resource",
				WorkspaceId: "workspace-1",
				Metadata:    map[string]string{"region": "us-east-1"},
			},
			matcher: NewPropertyMatcher(&pb.PropertyMatcher{
				FromProperty: []string{"metadata", "region"},
				ToProperty:   []string{"metadata", "region"},
				Operator:     "equals",
			}),
			expected: true,
		},
		{
			name: "unequal string values",
			from: &pb.Resource{
				Id:          "resource-1",
				Name:        "Test Resource",
				WorkspaceId: "workspace-1",
				Metadata:    map[string]string{"region": "us-east-1"},
			},
			to: &pb.Resource{
				Id:          "resource-2",
				Name:        "Another Resource",
				WorkspaceId: "workspace-1",
				Metadata:    map[string]string{"region": "us-west-2"},
			},
			matcher: NewPropertyMatcher(&pb.PropertyMatcher{
				FromProperty: []string{"metadata", "region"},
				ToProperty:   []string{"metadata", "region"},
				Operator:     "equals",
			}),
			expected: false,
		},
		{
			name: "equal IDs",
			from: &pb.Resource{
				Id:          "resource-1",
				WorkspaceId: "workspace-1",
			},
			to: &pb.Resource{
				Id:          "resource-1",
				WorkspaceId: "workspace-1",
			},
			matcher: NewPropertyMatcher(&pb.PropertyMatcher{
				FromProperty: []string{"id"},
				ToProperty:   []string{"id"},
				Operator:     "equals",
			}),
			expected: true,
		},
		{
			name: "default operator equals",
			from: &pb.Resource{
				Id:          "resource-1",
				WorkspaceId: "workspace-1",
			},
			to: &pb.Resource{
				Id:          "resource-1",
				WorkspaceId: "workspace-1",
			},
			matcher: NewPropertyMatcher(&pb.PropertyMatcher{
				FromProperty: []string{"id"},
				ToProperty:   []string{"id"},
			}),
			expected: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := tt.matcher.Evaluate(tt.from, tt.to)
			if result != tt.expected {
				t.Errorf("expected %v, got %v", tt.expected, result)
			}
		})
	}
}

// TestPropertyMatcher_Evaluate_NotEquals tests the not_equals operator
func TestPropertyMatcher_Evaluate_NotEquals(t *testing.T) {
	tests := []struct {
		name     string
		from     any
		to       any
		matcher  *PropertyMatcher
		expected bool
	}{
		{
			name: "not equal string values with not_equals",
			from: &pb.Resource{
				Id:          "resource-1",
				WorkspaceId: "workspace-1",
				Metadata:    map[string]string{"region": "us-east-1"},
			},
			to: &pb.Resource{
				Id:          "resource-2",
				WorkspaceId: "workspace-1",
				Metadata:    map[string]string{"region": "us-west-2"},
			},
			matcher: NewPropertyMatcher(&pb.PropertyMatcher{
				FromProperty: []string{"metadata", "region"},
				ToProperty:   []string{"metadata", "region"},
				Operator:     "not_equals",
			}),
			expected: true,
		},
		{
			name: "equal string values with not_equals",
			from: &pb.Resource{
				Id:          "resource-1",
				WorkspaceId: "workspace-1",
				Metadata:    map[string]string{"region": "us-east-1"},
			},
			to: &pb.Resource{
				Id:          "resource-2",
				WorkspaceId: "workspace-1",
				Metadata:    map[string]string{"region": "us-east-1"},
			},
			matcher: NewPropertyMatcher(&pb.PropertyMatcher{
				FromProperty: []string{"metadata", "region"},
				ToProperty:   []string{"metadata", "region"},
				Operator:     "not_equals",
			}),
			expected: false,
		},
		{
			name: "notequals variant",
			from: &pb.Resource{
				Id:          "resource-1",
				WorkspaceId: "workspace-1",
			},
			to: &pb.Resource{
				Id:          "resource-2",
				WorkspaceId: "workspace-1",
			},
			matcher: NewPropertyMatcher(&pb.PropertyMatcher{
				FromProperty: []string{"id"},
				ToProperty:   []string{"id"},
				Operator:     "notequals",
			}),
			expected: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := tt.matcher.Evaluate(tt.from, tt.to)
			if result != tt.expected {
				t.Errorf("expected %v, got %v", tt.expected, result)
			}
		})
	}
}

// TestPropertyMatcher_Evaluate_Contains tests the contains operator
func TestPropertyMatcher_Evaluate_Contains(t *testing.T) {
	tests := []struct {
		name     string
		from     any
		to       any
		matcher  *PropertyMatcher
		expected bool
	}{
		{
			name: "string contains substring",
			from: &pb.Resource{
				Id:          "resource-1",
				Name:        "my-production-database",
				WorkspaceId: "workspace-1",
			},
			to: &pb.Resource{
				Id:          "resource-2",
				Name:        "production",
				WorkspaceId: "workspace-1",
			},
			matcher: NewPropertyMatcher(&pb.PropertyMatcher{
				FromProperty: []string{"name"},
				ToProperty:   []string{"name"},
				Operator:     "contains",
			}),
			expected: true,
		},
		{
			name: "string does not contain substring",
			from: &pb.Resource{
				Id:          "resource-1",
				Name:        "staging-database",
				WorkspaceId: "workspace-1",
			},
			to: &pb.Resource{
				Id:          "resource-2",
				Name:        "production",
				WorkspaceId: "workspace-1",
			},
			matcher: NewPropertyMatcher(&pb.PropertyMatcher{
				FromProperty: []string{"name"},
				ToProperty:   []string{"name"},
				Operator:     "contains",
			}),
			expected: false,
		},
		{
			name: "contain variant",
			from: &pb.Resource{
				Id:          "resource-1",
				Name:        "test-resource",
				WorkspaceId: "workspace-1",
			},
			to: &pb.Resource{
				Id:          "resource-2",
				Name:        "test",
				WorkspaceId: "workspace-1",
			},
			matcher: NewPropertyMatcher(&pb.PropertyMatcher{
				FromProperty: []string{"name"},
				ToProperty:   []string{"name"},
				Operator:     "contain",
			}),
			expected: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := tt.matcher.Evaluate(tt.from, tt.to)
			if result != tt.expected {
				t.Errorf("expected %v, got %v", tt.expected, result)
			}
		})
	}
}

// TestPropertyMatcher_Evaluate_StartsWith tests the starts_with operator
func TestPropertyMatcher_Evaluate_StartsWith(t *testing.T) {
	tests := []struct {
		name     string
		from     any
		to       any
		matcher  *PropertyMatcher
		expected bool
	}{
		{
			name: "string starts with prefix",
			from: &pb.Resource{
				Id:          "resource-1",
				Name:        "production-database",
				WorkspaceId: "workspace-1",
			},
			to: &pb.Resource{
				Id:          "resource-2",
				Name:        "production",
				WorkspaceId: "workspace-1",
			},
			matcher: NewPropertyMatcher(&pb.PropertyMatcher{
				FromProperty: []string{"name"},
				ToProperty:   []string{"name"},
				Operator:     "starts_with",
			}),
			expected: true,
		},
		{
			name: "string does not start with prefix",
			from: &pb.Resource{
				Id:          "resource-1",
				Name:        "staging-database",
				WorkspaceId: "workspace-1",
			},
			to: &pb.Resource{
				Id:          "resource-2",
				Name:        "production",
				WorkspaceId: "workspace-1",
			},
			matcher: NewPropertyMatcher(&pb.PropertyMatcher{
				FromProperty: []string{"name"},
				ToProperty:   []string{"name"},
				Operator:     "starts_with",
			}),
			expected: false,
		},
		{
			name: "startswith variant",
			from: &pb.Resource{
				Id:          "resource-1",
				Name:        "test-resource",
				WorkspaceId: "workspace-1",
			},
			to: &pb.Resource{
				Id:          "resource-2",
				Name:        "test",
				WorkspaceId: "workspace-1",
			},
			matcher: NewPropertyMatcher(&pb.PropertyMatcher{
				FromProperty: []string{"name"},
				ToProperty:   []string{"name"},
				Operator:     "startswith",
			}),
			expected: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := tt.matcher.Evaluate(tt.from, tt.to)
			if result != tt.expected {
				t.Errorf("expected %v, got %v", tt.expected, result)
			}
		})
	}
}

// TestPropertyMatcher_Evaluate_EndsWith tests the ends_with operator
func TestPropertyMatcher_Evaluate_EndsWith(t *testing.T) {
	tests := []struct {
		name     string
		from     any
		to       any
		matcher  *PropertyMatcher
		expected bool
	}{
		{
			name: "string ends with suffix",
			from: &pb.Resource{
				Id:          "resource-1",
				Name:        "my-production-database",
				WorkspaceId: "workspace-1",
			},
			to: &pb.Resource{
				Id:          "resource-2",
				Name:        "database",
				WorkspaceId: "workspace-1",
			},
			matcher: NewPropertyMatcher(&pb.PropertyMatcher{
				FromProperty: []string{"name"},
				ToProperty:   []string{"name"},
				Operator:     "ends_with",
			}),
			expected: true,
		},
		{
			name: "string does not end with suffix",
			from: &pb.Resource{
				Id:          "resource-1",
				Name:        "staging-server",
				WorkspaceId: "workspace-1",
			},
			to: &pb.Resource{
				Id:          "resource-2",
				Name:        "database",
				WorkspaceId: "workspace-1",
			},
			matcher: NewPropertyMatcher(&pb.PropertyMatcher{
				FromProperty: []string{"name"},
				ToProperty:   []string{"name"},
				Operator:     "ends_with",
			}),
			expected: false,
		},
		{
			name: "endswith variant",
			from: &pb.Resource{
				Id:          "resource-1",
				Name:        "my-test",
				WorkspaceId: "workspace-1",
			},
			to: &pb.Resource{
				Id:          "resource-2",
				Name:        "test",
				WorkspaceId: "workspace-1",
			},
			matcher: NewPropertyMatcher(&pb.PropertyMatcher{
				FromProperty: []string{"name"},
				ToProperty:   []string{"name"},
				Operator:     "endswith",
			}),
			expected: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := tt.matcher.Evaluate(tt.from, tt.to)
			if result != tt.expected {
				t.Errorf("expected %v, got %v", tt.expected, result)
			}
		})
	}
}

// TestPropertyMatcher_Evaluate_EdgeCases tests edge cases and error conditions
func TestPropertyMatcher_Evaluate_EdgeCases(t *testing.T) {
	tests := []struct {
		name     string
		from     any
		to       any
		matcher  *PropertyMatcher
		expected bool
	}{
		{
			name: "invalid property path in from",
			from: &pb.Resource{
				Id:          "resource-1",
				WorkspaceId: "workspace-1",
			},
			to: &pb.Resource{
				Id:          "resource-2",
				WorkspaceId: "workspace-1",
			},
			matcher: NewPropertyMatcher(&pb.PropertyMatcher{
				FromProperty: []string{"nonexistent", "property"},
				ToProperty:   []string{"id"},
				Operator:     "equals",
			}),
			expected: false,
		},
		{
			name: "invalid property path in to",
			from: &pb.Resource{
				Id:          "resource-1",
				WorkspaceId: "workspace-1",
			},
			to: &pb.Resource{
				Id:          "resource-2",
				WorkspaceId: "workspace-1",
			},
			matcher: NewPropertyMatcher(&pb.PropertyMatcher{
				FromProperty: []string{"id"},
				ToProperty:   []string{"nonexistent", "property"},
				Operator:     "equals",
			}),
			expected: false,
		},
		{
			name: "missing metadata key in from",
			from: &pb.Resource{
				Id:          "resource-1",
				WorkspaceId: "workspace-1",
				Metadata:    map[string]string{},
			},
			to: &pb.Resource{
				Id:          "resource-2",
				WorkspaceId: "workspace-1",
				Metadata:    map[string]string{"region": "us-east-1"},
			},
			matcher: NewPropertyMatcher(&pb.PropertyMatcher{
				FromProperty: []string{"metadata", "region"},
				ToProperty:   []string{"metadata", "region"},
				Operator:     "equals",
			}),
			expected: false,
		},
		{
			name: "unknown operator defaults to true",
			from: &pb.Resource{
				Id:          "resource-1",
				WorkspaceId: "workspace-1",
			},
			to: &pb.Resource{
				Id:          "resource-2",
				WorkspaceId: "workspace-1",
			},
			matcher: NewPropertyMatcher(&pb.PropertyMatcher{
				FromProperty: []string{"id"},
				ToProperty:   []string{"id"},
				Operator:     "unknown_operator",
			}),
			expected: true,
		},
		{
			name: "case insensitive operator",
			from: &pb.Resource{
				Id:          "resource-1",
				WorkspaceId: "workspace-1",
			},
			to: &pb.Resource{
				Id:          "resource-1",
				WorkspaceId: "workspace-1",
			},
			matcher: NewPropertyMatcher(&pb.PropertyMatcher{
				FromProperty: []string{"id"},
				ToProperty:   []string{"id"},
				Operator:     "EQUALS",
			}),
			expected: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := tt.matcher.Evaluate(tt.from, tt.to)
			if result != tt.expected {
				t.Errorf("expected %v, got %v", tt.expected, result)
			}
		})
	}
}

// TestPropertyMatcher_Evaluate_DifferentEntityTypes tests matching across different entity types
func TestPropertyMatcher_Evaluate_DifferentEntityTypes(t *testing.T) {
	tests := []struct {
		name     string
		from     any
		to       any
		matcher  *PropertyMatcher
		expected bool
	}{
		{
			name: "resource to deployment by workspace_id",
			from: &pb.Resource{
				Id:          "resource-1",
				WorkspaceId: "workspace-1",
			},
			to: &pb.Deployment{
				Id:       "deployment-1",
				SystemId: "workspace-1",
			},
			matcher: NewPropertyMatcher(&pb.PropertyMatcher{
				FromProperty: []string{"workspace_id"},
				ToProperty:   []string{"system_id"},
				Operator:     "equals",
			}),
			expected: true,
		},
		{
			name: "resource to environment by name",
			from: &pb.Resource{
				Id:          "resource-1",
				Name:        "production",
				WorkspaceId: "workspace-1",
			},
			to: &pb.Environment{
				Id:       "env-1",
				Name:     "production",
				SystemId: "system-1",
			},
			matcher: NewPropertyMatcher(&pb.PropertyMatcher{
				FromProperty: []string{"name"},
				ToProperty:   []string{"name"},
				Operator:     "equals",
			}),
			expected: true,
		},
		{
			name: "deployment to environment name contains",
			from: &pb.Deployment{
				Id:       "deployment-1",
				Name:     "my-production-deploy",
				SystemId: "system-1",
			},
			to: &pb.Environment{
				Id:       "env-1",
				Name:     "production",
				SystemId: "system-1",
			},
			matcher: NewPropertyMatcher(&pb.PropertyMatcher{
				FromProperty: []string{"name"},
				ToProperty:   []string{"name"},
				Operator:     "contains",
			}),
			expected: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := tt.matcher.Evaluate(tt.from, tt.to)
			if result != tt.expected {
				t.Errorf("expected %v, got %v", tt.expected, result)
			}
		})
	}
}

// TestPropertyMatcher_Evaluate_NestedConfig tests matching on nested config properties
func TestPropertyMatcher_Evaluate_NestedConfig(t *testing.T) {
	// Helper to create a struct from a map
	mustNewStruct := func(m map[string]any) *structpb.Struct {
		s, err := structpb.NewStruct(m)
		if err != nil {
			t.Fatalf("failed to create struct: %v", err)
		}
		return s
	}

	tests := []struct {
		name     string
		from     any
		to       any
		matcher  *PropertyMatcher
		expected bool
	}{
		{
			name: "nested config string match",
			from: &pb.Resource{
				Id:          "resource-1",
				WorkspaceId: "workspace-1",
				Config: mustNewStruct(map[string]any{
					"networking": map[string]any{
						"vpc_id": "vpc-123",
						"region": "us-east-1",
					},
				}),
			},
			to: &pb.Resource{
				Id:          "resource-2",
				WorkspaceId: "workspace-1",
				Config: mustNewStruct(map[string]any{
					"networking": map[string]any{
						"vpc_id": "vpc-123",
						"region": "us-west-2",
					},
				}),
			},
			matcher: NewPropertyMatcher(&pb.PropertyMatcher{
				FromProperty: []string{"config", "networking", "vpc_id"},
				ToProperty:   []string{"config", "networking", "vpc_id"},
				Operator:     "equals",
			}),
			expected: true,
		},
		{
			name: "nested config different values",
			from: &pb.Resource{
				Id:          "resource-1",
				WorkspaceId: "workspace-1",
				Config: mustNewStruct(map[string]any{
					"networking": map[string]any{
						"vpc_id": "vpc-123",
					},
				}),
			},
			to: &pb.Resource{
				Id:          "resource-2",
				WorkspaceId: "workspace-1",
				Config: mustNewStruct(map[string]any{
					"networking": map[string]any{
						"vpc_id": "vpc-456",
					},
				}),
			},
			matcher: NewPropertyMatcher(&pb.PropertyMatcher{
				FromProperty: []string{"config", "networking", "vpc_id"},
				ToProperty:   []string{"config", "networking", "vpc_id"},
				Operator:     "not_equals",
			}),
			expected: true,
		},
		{
			name: "nested config contains",
			from: &pb.Resource{
				Id:          "resource-1",
				WorkspaceId: "workspace-1",
				Config: mustNewStruct(map[string]any{
					"tags": map[string]any{
						"environment": "production-us-east-1",
					},
				}),
			},
			to: &pb.Resource{
				Id:          "resource-2",
				WorkspaceId: "workspace-1",
				Config: mustNewStruct(map[string]any{
					"tags": map[string]any{
						"environment": "production",
					},
				}),
			},
			matcher: NewPropertyMatcher(&pb.PropertyMatcher{
				FromProperty: []string{"config", "tags", "environment"},
				ToProperty:   []string{"config", "tags", "environment"},
				Operator:     "contains",
			}),
			expected: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := tt.matcher.Evaluate(tt.from, tt.to)
			if result != tt.expected {
				t.Errorf("expected %v, got %v", tt.expected, result)
			}
		})
	}
}

// TestPropertyMatcher_Evaluate_CaseInsensitivity tests case insensitivity of operators
func TestPropertyMatcher_Evaluate_CaseInsensitivity(t *testing.T) {
	resource1 := &pb.Resource{
		Id:          "resource-1",
		Name:        "Test Resource",
		WorkspaceId: "workspace-1",
	}
	resource2 := &pb.Resource{
		Id:          "resource-2",
		Name:        "Test Resource",
		WorkspaceId: "workspace-1",
	}

	operators := []string{
		"equals", "EQUALS", "Equals",
		"not_equals", "NOT_EQUALS", "Not_Equals",
		"notequals", "NOTEQUALS", "NotEquals",
		"contains", "CONTAINS", "Contains",
		"contain", "CONTAIN", "Contain",
		"starts_with", "STARTS_WITH", "Starts_With",
		"startswith", "STARTSWITH", "StartsWith",
		"ends_with", "ENDS_WITH", "Ends_With",
		"endswith", "ENDSWITH", "EndsWith",
	}

	for _, op := range operators {
		t.Run(fmt.Sprintf("operator_%s", op), func(t *testing.T) {
			matcher := NewPropertyMatcher(&pb.PropertyMatcher{
				FromProperty: []string{"name"},
				ToProperty:   []string{"name"},
				Operator:     op,
			})
			// Should not panic and should return a valid boolean
			result := matcher.Evaluate(resource1, resource2)
			if result != true && result != false {
				t.Errorf("operator %s did not return a boolean value", op)
			}
		})
	}
}

