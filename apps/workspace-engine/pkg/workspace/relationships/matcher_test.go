package relationships

import (
	"context"
	"fmt"
	"strings"
	"testing"
	"workspace-engine/pkg/oapi"
)

// TestNewPropertyMatcher tests the PropertyMatcher constructor
func TestNewPropertyMatcher(t *testing.T) {
	tests := []struct {
		name             string
		inputMatcher     *oapi.PropertyMatcher
		expectedOperator string
	}{
		{
			name: "default operator when empty",
			inputMatcher: &oapi.PropertyMatcher{
				FromProperty: []string{"id"},
				ToProperty:   []string{"id"},
				Operator:     "equals",
			},
			expectedOperator: "equals",
		},
		{
			name: "preserves explicit operator",
			inputMatcher: &oapi.PropertyMatcher{
				FromProperty: []string{"name"},
				ToProperty:   []string{"name"},
				Operator:     "contains",
			},
			expectedOperator: "contains",
		},
		{
			name: "preserves uppercase operator",
			inputMatcher: &oapi.PropertyMatcher{
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
				return
			}
			if string(matcher.Operator) != tt.expectedOperator {
				t.Errorf("expected operator %q, got %q", tt.expectedOperator, matcher.Operator)
			}
		})
	}
}

func TestBuildEntityMapCache_DedupesIDs(t *testing.T) {
	resource1 := &oapi.Resource{
		Id:          "resource-1",
		Name:        "Resource One",
		WorkspaceId: "workspace-1",
	}
	resource2 := &oapi.Resource{
		Id:          "resource-1",
		Name:        "Resource Two",
		WorkspaceId: "workspace-1",
	}

	entities := []*oapi.RelatableEntity{
		NewResourceEntity(resource1),
		NewResourceEntity(resource2),
	}

	cache := BuildEntityMapCache(entities)
	if len(cache) != 1 {
		t.Fatalf("expected cache to dedupe IDs, got %d entries", len(cache))
	}
	if _, ok := cache["resource-1"]; !ok {
		t.Fatal("expected cache to contain resource-1")
	}
}

// TestPropertyMatcher_Evaluate_Equals tests the equals operator
func TestPropertyMatcher_Evaluate_Equals(t *testing.T) {
	tests := []struct {
		name     string
		from     *oapi.RelatableEntity
		to       *oapi.RelatableEntity
		matcher  *PropertyMatcher
		expected bool
	}{
		{
			name: "equal string values",
			from: NewResourceEntity(&oapi.Resource{
				Id:          "resource-1",
				Name:        "Test Resource",
				WorkspaceId: "workspace-1",
				Metadata:    map[string]string{"region": "us-east-1"},
			}),
			to: NewResourceEntity(&oapi.Resource{
				Id:          "resource-2",
				Name:        "Another Resource",
				WorkspaceId: "workspace-1",
				Metadata:    map[string]string{"region": "us-east-1"},
			}),
			matcher: NewPropertyMatcher(&oapi.PropertyMatcher{
				FromProperty: []string{"metadata", "region"},
				ToProperty:   []string{"metadata", "region"},
				Operator:     "equals",
			}),
			expected: true,
		},
		{
			name: "unequal string values",
			from: NewResourceEntity(&oapi.Resource{
				Id:          "resource-1",
				Name:        "Test Resource",
				WorkspaceId: "workspace-1",
				Metadata:    map[string]string{"region": "us-east-1"},
			}),
			to: NewResourceEntity(&oapi.Resource{
				Id:          "resource-2",
				Name:        "Another Resource",
				WorkspaceId: "workspace-1",
				Metadata:    map[string]string{"region": "us-west-2"},
			}),
			matcher: NewPropertyMatcher(&oapi.PropertyMatcher{
				FromProperty: []string{"metadata", "region"},
				ToProperty:   []string{"metadata", "region"},
				Operator:     "equals",
			}),
			expected: false,
		},
		{
			name: "equal IDs",
			from: NewResourceEntity(&oapi.Resource{
				Id:          "resource-1",
				WorkspaceId: "workspace-1",
			}),
			to: NewResourceEntity(&oapi.Resource{
				Id:          "resource-1",
				WorkspaceId: "workspace-1",
			}),
			matcher: NewPropertyMatcher(&oapi.PropertyMatcher{
				FromProperty: []string{"id"},
				ToProperty:   []string{"id"},
				Operator:     "equals",
			}),
			expected: true,
		},
		{
			name: "default operator equals",
			from: NewResourceEntity(&oapi.Resource{
				Id:          "resource-1",
				WorkspaceId: "workspace-1",
			}),
			to: NewResourceEntity(&oapi.Resource{
				Id:          "resource-1",
				WorkspaceId: "workspace-1",
			}),
			matcher: NewPropertyMatcher(&oapi.PropertyMatcher{
				FromProperty: []string{"id"},
				ToProperty:   []string{"id"},
			}),
			expected: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := tt.matcher.Evaluate(context.Background(), tt.from, tt.to)
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
		from     *oapi.RelatableEntity
		to       *oapi.RelatableEntity
		matcher  *PropertyMatcher
		expected bool
	}{
		{
			name: "not equal string values with not_equals",
			from: NewResourceEntity(&oapi.Resource{
				Id:          "resource-1",
				WorkspaceId: "workspace-1",
				Metadata:    map[string]string{"region": "us-east-1"},
			}),
			to: NewResourceEntity(&oapi.Resource{
				Id:          "resource-2",
				WorkspaceId: "workspace-1",
				Metadata:    map[string]string{"region": "us-west-2"},
			}),
			matcher: NewPropertyMatcher(&oapi.PropertyMatcher{
				FromProperty: []string{"metadata", "region"},
				ToProperty:   []string{"metadata", "region"},
				Operator:     "not_equals",
			}),
			expected: true,
		},
		{
			name: "equal string values with not_equals",
			from: NewResourceEntity(&oapi.Resource{
				Id:          "resource-1",
				WorkspaceId: "workspace-1",
				Metadata:    map[string]string{"region": "us-east-1"},
			}),
			to: NewResourceEntity(&oapi.Resource{
				Id:          "resource-2",
				WorkspaceId: "workspace-1",
				Metadata:    map[string]string{"region": "us-east-1"},
			}),
			matcher: NewPropertyMatcher(&oapi.PropertyMatcher{
				FromProperty: []string{"metadata", "region"},
				ToProperty:   []string{"metadata", "region"},
				Operator:     "not_equals",
			}),
			expected: false,
		},
		{
			name: "notequals variant",
			from: NewResourceEntity(&oapi.Resource{
				Id:          "resource-1",
				WorkspaceId: "workspace-1",
			}),
			to: NewResourceEntity(&oapi.Resource{
				Id:          "resource-2",
				WorkspaceId: "workspace-1",
			}),
			matcher: NewPropertyMatcher(&oapi.PropertyMatcher{
				FromProperty: []string{"id"},
				ToProperty:   []string{"id"},
				Operator:     "notequals",
			}),
			expected: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := tt.matcher.Evaluate(context.Background(), tt.from, tt.to)
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
		from     *oapi.RelatableEntity
		to       *oapi.RelatableEntity
		matcher  *PropertyMatcher
		expected bool
	}{
		{
			name: "string contains substring",
			from: NewResourceEntity(&oapi.Resource{
				Id:          "resource-1",
				Name:        "my-production-database",
				WorkspaceId: "workspace-1",
			}),
			to: NewResourceEntity(&oapi.Resource{
				Id:          "resource-2",
				Name:        "production",
				WorkspaceId: "workspace-1",
			}),
			matcher: NewPropertyMatcher(&oapi.PropertyMatcher{
				FromProperty: []string{"name"},
				ToProperty:   []string{"name"},
				Operator:     "contains",
			}),
			expected: true,
		},
		{
			name: "string does not contain substring",
			from: NewResourceEntity(&oapi.Resource{
				Id:          "resource-1",
				Name:        "staging-database",
				WorkspaceId: "workspace-1",
			}),
			to: NewResourceEntity(&oapi.Resource{
				Id:          "resource-2",
				Name:        "production",
				WorkspaceId: "workspace-1",
			}),
			matcher: NewPropertyMatcher(&oapi.PropertyMatcher{
				FromProperty: []string{"name"},
				ToProperty:   []string{"name"},
				Operator:     "contains",
			}),
			expected: false,
		},
		{
			name: "contain variant",
			from: NewResourceEntity(&oapi.Resource{
				Id:          "resource-1",
				Name:        "test-resource",
				WorkspaceId: "workspace-1",
			}),
			to: NewResourceEntity(&oapi.Resource{
				Id:          "resource-2",
				Name:        "test",
				WorkspaceId: "workspace-1",
			}),
			matcher: NewPropertyMatcher(&oapi.PropertyMatcher{
				FromProperty: []string{"name"},
				ToProperty:   []string{"name"},
				Operator:     "contain",
			}),
			expected: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := tt.matcher.Evaluate(context.Background(), tt.from, tt.to)
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
		from     *oapi.RelatableEntity
		to       *oapi.RelatableEntity
		matcher  *PropertyMatcher
		expected bool
	}{
		{
			name: "string starts with prefix",
			from: NewResourceEntity(&oapi.Resource{
				Id:          "resource-1",
				Name:        "production-database",
				WorkspaceId: "workspace-1",
			}),
			to: NewResourceEntity(&oapi.Resource{
				Id:          "resource-2",
				Name:        "production",
				WorkspaceId: "workspace-1",
			}),
			matcher: NewPropertyMatcher(&oapi.PropertyMatcher{
				FromProperty: []string{"name"},
				ToProperty:   []string{"name"},
				Operator:     "starts_with",
			}),
			expected: true,
		},
		{
			name: "string does not start with prefix",
			from: NewResourceEntity(&oapi.Resource{
				Id:          "resource-1",
				Name:        "staging-database",
				WorkspaceId: "workspace-1",
			}),
			to: NewResourceEntity(&oapi.Resource{
				Id:          "resource-2",
				Name:        "production",
				WorkspaceId: "workspace-1",
			}),
			matcher: NewPropertyMatcher(&oapi.PropertyMatcher{
				FromProperty: []string{"name"},
				ToProperty:   []string{"name"},
				Operator:     "starts_with",
			}),
			expected: false,
		},
		{
			name: "startswith variant",
			from: NewResourceEntity(&oapi.Resource{
				Id:          "resource-1",
				Name:        "test-resource",
				WorkspaceId: "workspace-1",
			}),
			to: NewResourceEntity(&oapi.Resource{
				Id:          "resource-2",
				Name:        "test",
				WorkspaceId: "workspace-1",
			}),
			matcher: NewPropertyMatcher(&oapi.PropertyMatcher{
				FromProperty: []string{"name"},
				ToProperty:   []string{"name"},
				Operator:     "startswith",
			}),
			expected: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := tt.matcher.Evaluate(context.Background(), tt.from, tt.to)
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
		from     *oapi.RelatableEntity
		to       *oapi.RelatableEntity
		matcher  *PropertyMatcher
		expected bool
	}{
		{
			name: "string ends with suffix",
			from: NewResourceEntity(&oapi.Resource{
				Id:          "resource-1",
				Name:        "my-production-database",
				WorkspaceId: "workspace-1",
			}),
			to: NewResourceEntity(&oapi.Resource{
				Id:          "resource-2",
				Name:        "database",
				WorkspaceId: "workspace-1",
			}),
			matcher: NewPropertyMatcher(&oapi.PropertyMatcher{
				FromProperty: []string{"name"},
				ToProperty:   []string{"name"},
				Operator:     "ends_with",
			}),
			expected: true,
		},
		{
			name: "string does not end with suffix",
			from: NewResourceEntity(&oapi.Resource{
				Id:          "resource-1",
				Name:        "staging-server",
				WorkspaceId: "workspace-1",
			}),
			to: NewResourceEntity(&oapi.Resource{
				Id:          "resource-2",
				Name:        "database",
				WorkspaceId: "workspace-1",
			}),
			matcher: NewPropertyMatcher(&oapi.PropertyMatcher{
				FromProperty: []string{"name"},
				ToProperty:   []string{"name"},
				Operator:     "ends_with",
			}),
			expected: false,
		},
		{
			name: "endswith variant",
			from: NewResourceEntity(&oapi.Resource{
				Id:          "resource-1",
				Name:        "my-test",
				WorkspaceId: "workspace-1",
			}),
			to: NewResourceEntity(&oapi.Resource{
				Id:          "resource-2",
				Name:        "test",
				WorkspaceId: "workspace-1",
			}),
			matcher: NewPropertyMatcher(&oapi.PropertyMatcher{
				FromProperty: []string{"name"},
				ToProperty:   []string{"name"},
				Operator:     "endswith",
			}),
			expected: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := tt.matcher.Evaluate(context.Background(), tt.from, tt.to)
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
		from     *oapi.RelatableEntity
		to       *oapi.RelatableEntity
		matcher  *PropertyMatcher
		expected bool
	}{
		{
			name: "invalid property path in from",
			from: NewResourceEntity(&oapi.Resource{
				Id:          "resource-1",
				WorkspaceId: "workspace-1",
			}),
			to: NewResourceEntity(&oapi.Resource{
				Id:          "resource-2",
				WorkspaceId: "workspace-1",
			}),
			matcher: NewPropertyMatcher(&oapi.PropertyMatcher{
				FromProperty: []string{"nonexistent", "property"},
				ToProperty:   []string{"id"},
				Operator:     "equals",
			}),
			expected: false,
		},
		{
			name: "invalid property path in to",
			from: NewResourceEntity(&oapi.Resource{
				Id:          "resource-1",
				WorkspaceId: "workspace-1",
			}),
			to: NewResourceEntity(&oapi.Resource{
				Id:          "resource-2",
				WorkspaceId: "workspace-1",
			}),
			matcher: NewPropertyMatcher(&oapi.PropertyMatcher{
				FromProperty: []string{"id"},
				ToProperty:   []string{"nonexistent", "property"},
				Operator:     "equals",
			}),
			expected: false,
		},
		{
			name: "missing metadata key in from",
			from: NewResourceEntity(&oapi.Resource{
				Id:          "resource-1",
				WorkspaceId: "workspace-1",
				Metadata:    map[string]string{},
			}),
			to: NewResourceEntity(&oapi.Resource{
				Id:          "resource-2",
				WorkspaceId: "workspace-1",
				Metadata:    map[string]string{"region": "us-east-1"},
			}),
			matcher: NewPropertyMatcher(&oapi.PropertyMatcher{
				FromProperty: []string{"metadata", "region"},
				ToProperty:   []string{"metadata", "region"},
				Operator:     "equals",
			}),
			expected: false,
		},
		{
			name: "unknown operator defaults to true",
			from: NewResourceEntity(&oapi.Resource{
				Id:          "resource-1",
				WorkspaceId: "workspace-1",
			}),
			to: NewResourceEntity(&oapi.Resource{
				Id:          "resource-2",
				WorkspaceId: "workspace-1",
			}),
			matcher: NewPropertyMatcher(&oapi.PropertyMatcher{
				FromProperty: []string{"id"},
				ToProperty:   []string{"id"},
				Operator:     "unknown_operator",
			}),
			expected: true,
		},
		{
			name: "case insensitive operator",
			from: NewResourceEntity(&oapi.Resource{
				Id:          "resource-1",
				WorkspaceId: "workspace-1",
			}),
			to: NewResourceEntity(&oapi.Resource{
				Id:          "resource-1",
				WorkspaceId: "workspace-1",
			}),
			matcher: NewPropertyMatcher(&oapi.PropertyMatcher{
				FromProperty: []string{"id"},
				ToProperty:   []string{"id"},
				Operator:     "EQUALS",
			}),
			expected: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := tt.matcher.Evaluate(context.Background(), tt.from, tt.to)
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
		from     *oapi.RelatableEntity
		to       *oapi.RelatableEntity
		matcher  *PropertyMatcher
		expected bool
	}{
		{
			name: "resource to deployment by workspace_id",
			from: NewResourceEntity(&oapi.Resource{
				Id:          "resource-1",
				WorkspaceId: "workspace-1",
			}),
			to: NewDeploymentEntity(&oapi.Deployment{
				Id:       "deployment-1",
				SystemId: "workspace-1",
			}),
			matcher: NewPropertyMatcher(&oapi.PropertyMatcher{
				FromProperty: []string{"workspace_id"},
				ToProperty:   []string{"system_id"},
				Operator:     "equals",
			}),
			expected: true,
		},
		{
			name: "resource to environment by name",
			from: NewResourceEntity(&oapi.Resource{
				Id:          "resource-1",
				Name:        "production",
				WorkspaceId: "workspace-1",
			}),
			to: NewEnvironmentEntity(&oapi.Environment{
				Id:       "env-1",
				Name:     "production",
				SystemId: "system-1",
			}),
			matcher: NewPropertyMatcher(&oapi.PropertyMatcher{
				FromProperty: []string{"name"},
				ToProperty:   []string{"name"},
				Operator:     "equals",
			}),
			expected: true,
		},
		{
			name: "deployment to environment name contains",
			from: NewDeploymentEntity(&oapi.Deployment{
				Id:       "deployment-1",
				Name:     "my-production-deploy",
				SystemId: "system-1",
			}),
			to: NewEnvironmentEntity(&oapi.Environment{
				Id:       "env-1",
				Name:     "production",
				SystemId: "system-1",
			}),
			matcher: NewPropertyMatcher(&oapi.PropertyMatcher{
				FromProperty: []string{"name"},
				ToProperty:   []string{"name"},
				Operator:     "contains",
			}),
			expected: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := tt.matcher.Evaluate(context.Background(), tt.from, tt.to)
			if result != tt.expected {
				t.Errorf("expected %v, got %v", tt.expected, result)
			}
		})
	}
}

// TestPropertyMatcher_Evaluate_NestedConfig tests matching on nested config properties
func TestPropertyMatcher_Evaluate_NestedConfig(t *testing.T) {

	tests := []struct {
		name     string
		from     *oapi.RelatableEntity
		to       *oapi.RelatableEntity
		matcher  *PropertyMatcher
		expected bool
	}{
		{
			name: "nested config string match",
			from: NewResourceEntity(&oapi.Resource{
				Id:          "resource-1",
				WorkspaceId: "workspace-1",
				Config: map[string]any{
					"networking": map[string]any{
						"vpc_id": "vpc-123",
						"region": "us-east-1",
					},
				},
			}),
			to: NewResourceEntity(&oapi.Resource{
				Id:          "resource-2",
				WorkspaceId: "workspace-1",
				Config: map[string]any{
					"networking": map[string]any{
						"vpc_id": "vpc-123",
						"region": "us-west-2",
					},
				},
			}),
			matcher: NewPropertyMatcher(&oapi.PropertyMatcher{
				FromProperty: []string{"config", "networking", "vpc_id"},
				ToProperty:   []string{"config", "networking", "vpc_id"},
				Operator:     "equals",
			}),
			expected: true,
		},
		{
			name: "nested config different values",
			from: NewResourceEntity(&oapi.Resource{
				Id:          "resource-1",
				WorkspaceId: "workspace-1",
				Config: map[string]any{
					"networking": map[string]any{
						"vpc_id": "vpc-123",
					},
				},
			}),
			to: NewResourceEntity(&oapi.Resource{
				Id:          "resource-2",
				WorkspaceId: "workspace-1",
				Config: map[string]any{
					"networking": map[string]any{
						"vpc_id": "vpc-456",
					},
				},
			}),
			matcher: NewPropertyMatcher(&oapi.PropertyMatcher{
				FromProperty: []string{"config", "networking", "vpc_id"},
				ToProperty:   []string{"config", "networking", "vpc_id"},
				Operator:     "not_equals",
			}),
			expected: true,
		},
		{
			name: "nested config contains",
			from: NewResourceEntity(&oapi.Resource{
				Id:          "resource-1",
				WorkspaceId: "workspace-1",
				Config: map[string]any{
					"tags": map[string]any{
						"environment": "production-us-east-1",
					},
				},
			}),
			to: NewResourceEntity(&oapi.Resource{
				Id:          "resource-2",
				WorkspaceId: "workspace-1",
				Config: map[string]any{
					"tags": map[string]any{
						"environment": "production",
					},
				},
			}),
			matcher: NewPropertyMatcher(&oapi.PropertyMatcher{
				FromProperty: []string{"config", "tags", "environment"},
				ToProperty:   []string{"config", "tags", "environment"},
				Operator:     "contains",
			}),
			expected: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := tt.matcher.Evaluate(context.Background(), tt.from, tt.to)
			if result != tt.expected {
				t.Errorf("expected %v, got %v", tt.expected, result)
			}
		})
	}
}

// TestPropertyMatcher_Evaluate_CaseInsensitivity tests case insensitivity of operators
func TestPropertyMatcher_Evaluate_CaseInsensitivity(t *testing.T) {
	resource1 := NewResourceEntity(&oapi.Resource{
		Id:          "resource-1",
		Name:        "Test Resource",
		WorkspaceId: "workspace-1",
	})
	resource2 := NewResourceEntity(&oapi.Resource{
		Id:          "resource-2",
		Name:        "Test Resource",
		WorkspaceId: "workspace-1",
	})

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
			matcher := NewPropertyMatcher(&oapi.PropertyMatcher{
				FromProperty: []string{"name"},
				ToProperty:   []string{"name"},
				Operator:     oapi.PropertyMatcherOperator(op),
			})
			// Should not panic and should return a valid boolean
			result := matcher.Evaluate(context.Background(), resource1, resource2)
			if result != true && result != false {
				t.Errorf("operator %s did not return a boolean value", op)
			}
		})
	}
}

// TestGetPropertyValue_Resource tests GetPropertyValue with Resource entities
func TestGetPropertyValue_Resource(t *testing.T) {
	tests := []struct {
		name         string
		resource     *oapi.Resource
		propertyPath []string
		wantValue    string
		wantErr      bool
	}{
		{
			name: "get resource id",
			resource: &oapi.Resource{
				Id:          "resource-123",
				Name:        "Test Resource",
				WorkspaceId: "workspace-1",
			},
			propertyPath: []string{"id"},
			wantValue:    "resource-123",
			wantErr:      false,
		},
		{
			name: "get resource name",
			resource: &oapi.Resource{
				Id:          "resource-123",
				Name:        "Test Resource",
				WorkspaceId: "workspace-1",
			},
			propertyPath: []string{"name"},
			wantValue:    "Test Resource",
			wantErr:      false,
		},
		{
			name: "get resource version",
			resource: &oapi.Resource{
				Id:          "resource-123",
				Version:     "v1.2.3",
				WorkspaceId: "workspace-1",
			},
			propertyPath: []string{"version"},
			wantValue:    "v1.2.3",
			wantErr:      false,
		},
		{
			name: "get resource kind",
			resource: &oapi.Resource{
				Id:          "resource-123",
				Kind:        "deployment",
				WorkspaceId: "workspace-1",
			},
			propertyPath: []string{"kind"},
			wantValue:    "deployment",
			wantErr:      false,
		},
		{
			name: "get resource identifier",
			resource: &oapi.Resource{
				Id:          "resource-123",
				Identifier:  "my-app",
				WorkspaceId: "workspace-1",
			},
			propertyPath: []string{"identifier"},
			wantValue:    "my-app",
			wantErr:      false,
		},
		{
			name: "get resource workspace_id",
			resource: &oapi.Resource{
				Id:          "resource-123",
				WorkspaceId: "workspace-456",
			},
			propertyPath: []string{"workspace_id"},
			wantValue:    "workspace-456",
			wantErr:      false,
		},
		{
			name: "get resource workspaceid (case variant)",
			resource: &oapi.Resource{
				Id:          "resource-123",
				WorkspaceId: "workspace-789",
			},
			propertyPath: []string{"workspaceid"},
			wantValue:    "workspace-789",
			wantErr:      false,
		},
		{
			name: "get metadata value",
			resource: &oapi.Resource{
				Id:          "resource-123",
				WorkspaceId: "workspace-1",
				Metadata:    map[string]string{"region": "us-east-1", "env": "production"},
			},
			propertyPath: []string{"metadata", "region"},
			wantValue:    "us-east-1",
			wantErr:      false,
		},
		{
			name: "get nested config value",
			resource: &oapi.Resource{
				Id:          "resource-123",
				WorkspaceId: "workspace-1",
				Config: map[string]any{
					"networking": map[string]any{
						"vpc_id": "vpc-123",
						"region": "us-west-2",
					},
				},
			},
			propertyPath: []string{"config", "networking", "vpc_id"},
			wantValue:    "vpc-123",
			wantErr:      false,
		},
		{
			name: "missing metadata key",
			resource: &oapi.Resource{
				Id:          "resource-123",
				WorkspaceId: "workspace-1",
				Metadata:    map[string]string{"region": "us-east-1"},
			},
			propertyPath: []string{"metadata", "nonexistent"},
			wantErr:      true,
		},
		{
			name: "missing config key",
			resource: &oapi.Resource{
				Id:          "resource-123",
				WorkspaceId: "workspace-1",
				Config: map[string]any{
					"networking": map[string]any{
						"vpc_id": "vpc-123",
					},
				},
			},
			propertyPath: []string{"config", "networking", "nonexistent"},
			wantErr:      true,
		},
		{
			name: "empty property path",
			resource: &oapi.Resource{
				Id:          "resource-123",
				WorkspaceId: "workspace-1",
			},
			propertyPath: []string{},
			wantErr:      true,
		},
		{
			name: "nil provider_id",
			resource: &oapi.Resource{
				Id:          "resource-123",
				WorkspaceId: "workspace-1",
				ProviderId:  nil,
			},
			propertyPath: []string{"provider_id"},
			wantErr:      true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			entity := NewResourceEntity(tt.resource)
			got, err := GetPropertyValue(entity, tt.propertyPath)
			if (err != nil) != tt.wantErr {
				t.Errorf("GetPropertyValue() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if !tt.wantErr && got != nil {
				gotStr := extractValueAsString(got)
				if gotStr != tt.wantValue {
					t.Errorf("GetPropertyValue() = %v, want %v", gotStr, tt.wantValue)
				}
			}
		})
	}
}

// TestGetPropertyValue_Deployment tests GetPropertyValue with Deployment entities
func TestGetPropertyValue_Deployment(t *testing.T) {
	description := "Test deployment"
	jobAgentId := "agent-123"

	customJobAgentConfigMap := map[string]any{
		"kubernetes": map[string]any{
			"namespace": "default",
			"cluster":   "prod",
		},
	}

	tests := []struct {
		name         string
		deployment   *oapi.Deployment
		propertyPath []string
		wantValue    string
		wantErr      bool
	}{
		{
			name: "get deployment id",
			deployment: &oapi.Deployment{
				Id:       "deploy-123",
				Name:     "My Deployment",
				SystemId: "system-1",
			},
			propertyPath: []string{"id"},
			wantValue:    "deploy-123",
			wantErr:      false,
		},
		{
			name: "get deployment name",
			deployment: &oapi.Deployment{
				Id:       "deploy-123",
				Name:     "My Deployment",
				SystemId: "system-1",
			},
			propertyPath: []string{"name"},
			wantValue:    "My Deployment",
			wantErr:      false,
		},
		{
			name: "get deployment slug",
			deployment: &oapi.Deployment{
				Id:       "deploy-123",
				Slug:     "my-deployment",
				SystemId: "system-1",
			},
			propertyPath: []string{"slug"},
			wantValue:    "my-deployment",
			wantErr:      false,
		},
		{
			name: "get deployment description",
			deployment: &oapi.Deployment{
				Id:          "deploy-123",
				Description: &description,
				SystemId:    "system-1",
			},
			propertyPath: []string{"description"},
			wantValue:    "Test deployment",
			wantErr:      false,
		},
		{
			name: "get deployment system_id",
			deployment: &oapi.Deployment{
				Id:       "deploy-123",
				SystemId: "system-456",
			},
			propertyPath: []string{"system_id"},
			wantValue:    "system-456",
			wantErr:      false,
		},
		{
			name: "get deployment systemid (case variant)",
			deployment: &oapi.Deployment{
				Id:       "deploy-123",
				SystemId: "system-789",
			},
			propertyPath: []string{"systemid"},
			wantValue:    "system-789",
			wantErr:      false,
		},
		{
			name: "get deployment job_agent_id",
			deployment: &oapi.Deployment{
				Id:         "deploy-123",
				JobAgentId: &jobAgentId,
				SystemId:   "system-1",
			},
			propertyPath: []string{"job_agent_id"},
			wantValue:    "agent-123",
			wantErr:      false,
		},
		{
			name: "get nested job_agent_config",
			deployment: &oapi.Deployment{
				Id:             "deploy-123",
				SystemId:       "system-1",
				JobAgentConfig: customJobAgentConfigMap,
			},
			propertyPath: []string{"job_agent_config", "kubernetes", "namespace"},
			wantValue:    "default",
			wantErr:      false,
		},
		{
			name: "nil description",
			deployment: &oapi.Deployment{
				Id:          "deploy-123",
				Description: nil,
				SystemId:    "system-1",
			},
			propertyPath: []string{"description"},
			wantErr:      true,
		},
		{
			name: "nil job_agent_id",
			deployment: &oapi.Deployment{
				Id:         "deploy-123",
				JobAgentId: nil,
				SystemId:   "system-1",
			},
			propertyPath: []string{"job_agent_id"},
			wantErr:      true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			entity := NewDeploymentEntity(tt.deployment)
			got, err := GetPropertyValue(entity, tt.propertyPath)
			if (err != nil) != tt.wantErr {
				t.Errorf("GetPropertyValue() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if !tt.wantErr && got != nil {
				gotStr := extractValueAsString(got)
				if gotStr != tt.wantValue {
					t.Errorf("GetPropertyValue() = %v, want %v", gotStr, tt.wantValue)
				}
			}
		})
	}
}

// TestGetPropertyValue_Environment tests GetPropertyValue with Environment entities
func TestGetPropertyValue_Environment(t *testing.T) {
	description := "Test environment"

	tests := []struct {
		name         string
		environment  *oapi.Environment
		propertyPath []string
		wantValue    string
		wantErr      bool
	}{
		{
			name: "get environment id",
			environment: &oapi.Environment{
				Id:       "env-123",
				Name:     "Production",
				SystemId: "system-1",
			},
			propertyPath: []string{"id"},
			wantValue:    "env-123",
			wantErr:      false,
		},
		{
			name: "get environment name",
			environment: &oapi.Environment{
				Id:       "env-123",
				Name:     "Production",
				SystemId: "system-1",
			},
			propertyPath: []string{"name"},
			wantValue:    "Production",
			wantErr:      false,
		},
		{
			name: "get environment description",
			environment: &oapi.Environment{
				Id:          "env-123",
				Description: &description,
				SystemId:    "system-1",
			},
			propertyPath: []string{"description"},
			wantValue:    "Test environment",
			wantErr:      false,
		},
		{
			name: "get environment system_id",
			environment: &oapi.Environment{
				Id:       "env-123",
				SystemId: "system-456",
			},
			propertyPath: []string{"system_id"},
			wantValue:    "system-456",
			wantErr:      false,
		},
		{
			name: "get environment systemid (case variant)",
			environment: &oapi.Environment{
				Id:       "env-123",
				SystemId: "system-789",
			},
			propertyPath: []string{"systemid"},
			wantValue:    "system-789",
			wantErr:      false,
		},
		{
			name: "nil description",
			environment: &oapi.Environment{
				Id:          "env-123",
				Description: nil,
				SystemId:    "system-1",
			},
			propertyPath: []string{"description"},
			wantErr:      true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			entity := NewEnvironmentEntity(tt.environment)
			got, err := GetPropertyValue(entity, tt.propertyPath)
			if (err != nil) != tt.wantErr {
				t.Errorf("GetPropertyValue() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if !tt.wantErr && got != nil {
				gotStr := extractValueAsString(got)
				if gotStr != tt.wantValue {
					t.Errorf("GetPropertyValue() = %v, want %v", gotStr, tt.wantValue)
				}
			}
		})
	}
}

// TestGetPropertyValue_TypeVariants tests different value types
func TestGetPropertyValue_TypeVariants(t *testing.T) {
	tests := []struct {
		name         string
		resource     *oapi.Resource
		propertyPath []string
		checkValue   func(*testing.T, *oapi.LiteralValue)
	}{
		{
			name: "string value",
			resource: &oapi.Resource{
				Id:          "resource-123",
				Name:        "Test",
				WorkspaceId: "workspace-1",
			},
			propertyPath: []string{"name"},
			checkValue: func(t *testing.T, lv *oapi.LiteralValue) {
				val, err := lv.AsStringValue()
				if err != nil {
					t.Errorf("Expected string value, got error: %v", err)
				}
				if val != "Test" {
					t.Errorf("Expected 'Test', got %v", val)
				}
			},
		},
		{
			name: "map value from metadata",
			resource: &oapi.Resource{
				Id:          "resource-123",
				WorkspaceId: "workspace-1",
				Metadata:    map[string]string{"key1": "value1", "key2": "value2"},
			},
			propertyPath: []string{"metadata"},
			checkValue: func(t *testing.T, lv *oapi.LiteralValue) {
				val, err := lv.AsObjectValue()
				if err != nil {
					t.Errorf("Expected object value, got error: %v", err)
				}
				if val.Object["key1"] != "value1" {
					t.Errorf("Expected 'value1', got %v", val.Object["key1"])
				}
			},
		},
		{
			name: "nested config with number",
			resource: &oapi.Resource{
				Id:          "resource-123",
				WorkspaceId: "workspace-1",
				Config: map[string]any{
					"settings": map[string]any{
						"port":    8080,
						"timeout": 30.5,
					},
				},
			},
			propertyPath: []string{"config", "settings", "port"},
			checkValue: func(t *testing.T, lv *oapi.LiteralValue) {
				val, err := lv.AsIntegerValue()
				if err != nil {
					t.Errorf("Expected integer value, got error: %v", err)
				}
				if val != 8080 {
					t.Errorf("Expected 8080, got %v", val)
				}
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			entity := NewResourceEntity(tt.resource)
			got, err := GetPropertyValue(entity, tt.propertyPath)
			if err != nil {
				t.Errorf("GetPropertyValue() error = %v", err)
				return
			}
			if got == nil {
				t.Error("GetPropertyValue() returned nil")
				return
			}
			tt.checkValue(t, got)
		})
	}
}

// TestGetPropertyValue_EdgeCases tests edge cases and error conditions
func TestGetPropertyValue_EdgeCases(t *testing.T) {
	tests := []struct {
		name         string
		entity       *oapi.RelatableEntity
		propertyPath []string
		wantErr      bool
		errContains  string
	}{
		{
			name: "empty property path",
			entity: NewResourceEntity(&oapi.Resource{
				Id:          "resource-123",
				WorkspaceId: "workspace-1",
			}),
			propertyPath: []string{},
			wantErr:      true,
			errContains:  "empty",
		},
		{
			name: "deeply nested config path",
			entity: NewResourceEntity(&oapi.Resource{
				Id:          "resource-123",
				WorkspaceId: "workspace-1",
				Config: map[string]any{
					"level1": map[string]any{
						"level2": map[string]any{
							"level3": map[string]any{
								"value": "deep",
							},
						},
					},
				},
			}),
			propertyPath: []string{"config", "level1", "level2", "level3", "value"},
			wantErr:      false,
		},
		{
			name: "metadata path too deep",
			entity: NewResourceEntity(&oapi.Resource{
				Id:          "resource-123",
				WorkspaceId: "workspace-1",
				Metadata:    map[string]string{"key": "value"},
			}),
			propertyPath: []string{"metadata", "key", "nested"},
			wantErr:      true,
			errContains:  "too deep",
		},
		{
			name: "non-existent top-level property",
			entity: NewResourceEntity(&oapi.Resource{
				Id:          "resource-123",
				WorkspaceId: "workspace-1",
			}),
			propertyPath: []string{"nonexistent"},
			wantErr:      true,
		},
		{
			name: "config key not found",
			entity: NewResourceEntity(&oapi.Resource{
				Id:          "resource-123",
				WorkspaceId: "workspace-1",
				Config: map[string]any{
					"existing": "value",
				},
			}),
			propertyPath: []string{"config", "nonexistent"},
			wantErr:      true,
			errContains:  "not found",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := GetPropertyValue(tt.entity, tt.propertyPath)
			if (err != nil) != tt.wantErr {
				t.Errorf("GetPropertyValue() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if tt.wantErr && tt.errContains != "" && err != nil {
				if !strings.Contains(err.Error(), tt.errContains) {
					t.Errorf("GetPropertyValue() error = %v, should contain %v", err, tt.errContains)
				}
			}
			if !tt.wantErr && got == nil {
				t.Error("GetPropertyValue() returned nil when expecting value")
			}
		})
	}
}
