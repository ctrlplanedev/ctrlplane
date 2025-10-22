package selector

import (
	"context"
	"encoding/json"
	"testing"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/selector/langs/jsonselector/unknown"
)

// Helper function to create a JSON selector from an unknown condition
func createJsonSelector(t *testing.T, condition unknown.UnknownCondition) *oapi.Selector {
	t.Helper()

	jsonBytes, err := json.Marshal(condition)
	if err != nil {
		t.Fatalf("Failed to marshal condition: %v", err)
	}

	var conditionMap map[string]interface{}
	if err := json.Unmarshal(jsonBytes, &conditionMap); err != nil {
		t.Fatalf("Failed to unmarshal condition: %v", err)
	}

	selector := &oapi.Selector{}
	if err := selector.FromJsonSelector(oapi.JsonSelector{Json: conditionMap}); err != nil {
		t.Fatalf("Failed to create JSON selector: %v", err)
	}
	return selector
}

// Helper function to create a CEL selector
func createCelSelector(t *testing.T, expression string) *oapi.Selector {
	t.Helper()

	selector := &oapi.Selector{}
	if err := selector.FromCelSelector(oapi.CelSelector{Cel: expression}); err != nil {
		t.Fatalf("Failed to create CEL selector: %v", err)
	}
	return selector
}

// Helper function to create an empty JSON selector
func createEmptyJsonSelector(t *testing.T) *oapi.Selector {
	t.Helper()

	selector := &oapi.Selector{}
	if err := selector.FromJsonSelector(oapi.JsonSelector{Json: map[string]interface{}{}}); err != nil {
		t.Fatalf("Failed to create empty JSON selector: %v", err)
	}
	return selector
}

func TestMatch_JsonSelector_Resource(t *testing.T) {
	tests := []struct {
		name      string
		condition unknown.UnknownCondition
		resource  oapi.Resource
		wantMatch bool
		wantErr   bool
	}{
		{
			name: "name contains match",
			condition: unknown.UnknownCondition{
				Property: "Name",
				Operator: "contains",
				Value:    "production",
			},
			resource: oapi.Resource{
				Id:   "1",
				Name: "production-server",
				Kind: "server",
			},
			wantMatch: true,
			wantErr:   false,
		},
		{
			name: "name contains no match",
			condition: unknown.UnknownCondition{
				Property: "Name",
				Operator: "contains",
				Value:    "production",
			},
			resource: oapi.Resource{
				Id:   "2",
				Name: "staging-server",
				Kind: "server",
			},
			wantMatch: false,
			wantErr:   false,
		},
		{
			name: "kind equals match",
			condition: unknown.UnknownCondition{
				Property: "Kind",
				Operator: "equals",
				Value:    "database",
			},
			resource: oapi.Resource{
				Id:   "3",
				Name: "postgres",
				Kind: "database",
			},
			wantMatch: true,
			wantErr:   false,
		},
		{
			name: "identifier starts-with match",
			condition: unknown.UnknownCondition{
				Property: "Identifier",
				Operator: "starts-with",
				Value:    "k8s-",
			},
			resource: oapi.Resource{
				Id:         "4",
				Identifier: "k8s-cluster-prod",
				Name:       "prod-cluster",
				Kind:       "cluster",
			},
			wantMatch: true,
			wantErr:   false,
		},
		{
			name: "metadata equals match",
			condition: unknown.UnknownCondition{
				Property:    "metadata",
				Operator:    "equals",
				Value:       "production",
				MetadataKey: "env",
			},
			resource: oapi.Resource{
				Id:   "5",
				Name: "api-server",
				Metadata: map[string]string{
					"env": "production",
				},
			},
			wantMatch: true,
			wantErr:   false,
		},
		{
			name: "metadata equals no match",
			condition: unknown.UnknownCondition{
				Property:    "metadata",
				Operator:    "equals",
				Value:       "production",
				MetadataKey: "env",
			},
			resource: oapi.Resource{
				Id:   "6",
				Name: "api-server",
				Metadata: map[string]string{
					"env": "staging",
				},
			},
			wantMatch: false,
			wantErr:   false,
		},
		{
			name: "AND condition all match",
			condition: unknown.UnknownCondition{
				Operator: "and",
				Conditions: []unknown.UnknownCondition{
					{
						Property: "Name",
						Operator: "contains",
						Value:    "prod",
					},
					{
						Property: "Kind",
						Operator: "equals",
						Value:    "service",
					},
				},
			},
			resource: oapi.Resource{
				Id:   "7",
				Name: "prod-api",
				Kind: "service",
			},
			wantMatch: true,
			wantErr:   false,
		},
		{
			name: "AND condition one does not match",
			condition: unknown.UnknownCondition{
				Operator: "and",
				Conditions: []unknown.UnknownCondition{
					{
						Property: "Name",
						Operator: "contains",
						Value:    "prod",
					},
					{
						Property: "Kind",
						Operator: "equals",
						Value:    "service",
					},
				},
			},
			resource: oapi.Resource{
				Id:   "8",
				Name: "prod-api",
				Kind: "deployment",
			},
			wantMatch: false,
			wantErr:   false,
		},
		{
			name: "OR condition one matches",
			condition: unknown.UnknownCondition{
				Operator: "or",
				Conditions: []unknown.UnknownCondition{
					{
						Property: "Name",
						Operator: "contains",
						Value:    "staging",
					},
					{
						Property: "Kind",
						Operator: "equals",
						Value:    "service",
					},
				},
			},
			resource: oapi.Resource{
				Id:   "9",
				Name: "prod-api",
				Kind: "service",
			},
			wantMatch: true,
			wantErr:   false,
		},
		{
			name: "OR condition none match",
			condition: unknown.UnknownCondition{
				Operator: "or",
				Conditions: []unknown.UnknownCondition{
					{
						Property: "Name",
						Operator: "contains",
						Value:    "staging",
					},
					{
						Property: "Kind",
						Operator: "equals",
						Value:    "database",
					},
				},
			},
			resource: oapi.Resource{
				Id:   "10",
				Name: "prod-api",
				Kind: "service",
			},
			wantMatch: false,
			wantErr:   false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := context.Background()
			selector := createJsonSelector(t, tt.condition)

			match, err := Match(ctx, selector, tt.resource)

			if (err != nil) != tt.wantErr {
				t.Errorf("Match() error = %v, wantErr %v", err, tt.wantErr)
				return
			}

			if match != tt.wantMatch {
				t.Errorf("Match() = %v, want %v", match, tt.wantMatch)
			}
		})
	}
}

func TestMatch_JsonSelector_Deployment(t *testing.T) {
	tests := []struct {
		name       string
		condition  unknown.UnknownCondition
		deployment oapi.Deployment
		wantMatch  bool
		wantErr    bool
	}{
		{
			name: "deployment name contains match",
			condition: unknown.UnknownCondition{
				Property: "Name",
				Operator: "contains",
				Value:    "api",
			},
			deployment: oapi.Deployment{
				Id:       "1",
				Name:     "api-deployment",
				SystemId: "sys1",
				Slug:     "api-deployment",
				JobAgentConfig: map[string]interface{}{
					"region": "us-east-1",
				},
			},
			wantMatch: true,
			wantErr:   false,
		},
		{
			name: "deployment slug starts-with match",
			condition: unknown.UnknownCondition{
				Property: "Slug",
				Operator: "starts-with",
				Value:    "prod-",
			},
			deployment: oapi.Deployment{
				Id:             "2",
				Name:           "Production API",
				SystemId:       "sys1",
				Slug:           "prod-api",
				JobAgentConfig: map[string]interface{}{},
			},
			wantMatch: true,
			wantErr:   false,
		},
		{
			name: "deployment slug starts-with no match",
			condition: unknown.UnknownCondition{
				Property: "Slug",
				Operator: "starts-with",
				Value:    "prod-",
			},
			deployment: oapi.Deployment{
				Id:             "3",
				Name:           "Staging API",
				SystemId:       "sys1",
				Slug:           "staging-api",
				JobAgentConfig: map[string]interface{}{},
			},
			wantMatch: false,
			wantErr:   false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := context.Background()
			selector := createJsonSelector(t, tt.condition)

			match, err := Match(ctx, selector, tt.deployment)

			if (err != nil) != tt.wantErr {
				t.Errorf("Match() error = %v, wantErr %v", err, tt.wantErr)
				return
			}

			if match != tt.wantMatch {
				t.Errorf("Match() = %v, want %v", match, tt.wantMatch)
			}
		})
	}
}

func TestMatch_JsonSelector_Environment(t *testing.T) {
	tests := []struct {
		name        string
		condition   unknown.UnknownCondition
		environment oapi.Environment
		wantMatch   bool
		wantErr     bool
	}{
		{
			name: "environment name equals match",
			condition: unknown.UnknownCondition{
				Property: "Name",
				Operator: "equals",
				Value:    "production",
			},
			environment: oapi.Environment{
				Id:        "1",
				Name:      "production",
				SystemId:  "sys1",
				CreatedAt: "2024-01-01T00:00:00Z",
			},
			wantMatch: true,
			wantErr:   false,
		},
		{
			name: "environment name equals no match",
			condition: unknown.UnknownCondition{
				Property: "Name",
				Operator: "equals",
				Value:    "production",
			},
			environment: oapi.Environment{
				Id:        "2",
				Name:      "staging",
				SystemId:  "sys1",
				CreatedAt: "2024-01-01T00:00:00Z",
			},
			wantMatch: false,
			wantErr:   false,
		},
		{
			name: "environment name contains match",
			condition: unknown.UnknownCondition{
				Property: "Name",
				Operator: "contains",
				Value:    "prod",
			},
			environment: oapi.Environment{
				Id:        "3",
				Name:      "production-us-east",
				SystemId:  "sys1",
				CreatedAt: "2024-01-01T00:00:00Z",
			},
			wantMatch: true,
			wantErr:   false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := context.Background()
			selector := createJsonSelector(t, tt.condition)

			match, err := Match(ctx, selector, tt.environment)

			if (err != nil) != tt.wantErr {
				t.Errorf("Match() error = %v, wantErr %v", err, tt.wantErr)
				return
			}

			if match != tt.wantMatch {
				t.Errorf("Match() = %v, want %v", match, tt.wantMatch)
			}
		})
	}
}

// NOTE: These tests document the current behavior of the Match function
// with CEL selectors. There appears to be a bug in match.go lines 37-39
// where non-empty CEL expressions return false without evaluation.
func TestMatch_CelSelector_Resource(t *testing.T) {
	tests := []struct {
		name       string
		expression string
		resource   oapi.Resource
		wantMatch  bool
		wantErr    bool
	}{
		{
			name:       "simple property check",
			expression: "resource.name == 'production-server'",
			resource: oapi.Resource{
				Id:   "1",
				Name: "production-server",
				Kind: "server",
			},
			wantMatch: true,
			wantErr:   false,
		},
		{
			name:       "simple property check no match",
			expression: "resource.name == 'production-server'",
			resource: oapi.Resource{
				Id:   "2",
				Name: "staging-server",
				Kind: "server",
			},
			wantMatch: false,
			wantErr:   false,
		},
		{
			name:       "kind check",
			expression: "resource.kind == 'database'",
			resource: oapi.Resource{
				Id:   "3",
				Name: "postgres",
				Kind: "database",
			},
			wantMatch: true,
			wantErr:   false,
		},
		{
			name:       "combined AND condition",
			expression: "resource.name.contains('prod') && resource.kind == 'service'",
			resource: oapi.Resource{
				Id:   "4",
				Name: "prod-api",
				Kind: "service",
			},
			wantMatch: true,
			wantErr:   false,
		},
		{
			name:       "combined AND condition no match",
			expression: "resource.name.contains('prod') && resource.kind == 'service'",
			resource: oapi.Resource{
				Id:   "5",
				Name: "prod-api",
				Kind: "deployment",
			},
			wantMatch: false,
			wantErr:   false,
		},
		{
			name:       "combined OR condition",
			expression: "resource.name.contains('staging') || resource.kind == 'service'",
			resource: oapi.Resource{
				Id:   "6",
				Name: "prod-api",
				Kind: "service",
			},
			wantMatch: true,
			wantErr:   false,
		},
		{
			name:       "metadata check",
			expression: "resource.metadata['env'] == 'production'",
			resource: oapi.Resource{
				Id:   "7",
				Name: "api-server",
				Metadata: map[string]string{
					"env": "production",
				},
			},
			wantMatch: true,
			wantErr:   false,
		},
		{
			name:       "metadata check no match",
			expression: "resource.metadata['env'] == 'production'",
			resource: oapi.Resource{
				Id:   "8",
				Name: "api-server",
				Metadata: map[string]string{
					"env": "staging",
				},
			},
			wantMatch: false,
			wantErr:   false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := context.Background()
			selector := createCelSelector(t, tt.expression)

			match, err := Match(ctx, selector, tt.resource)

			if (err != nil) != tt.wantErr {
				t.Errorf("Match() error = %v, wantErr %v", err, tt.wantErr)
				return
			}

			if match != tt.wantMatch {
				t.Errorf("Match() = %v, want %v", match, tt.wantMatch)
			}
		})
	}
}

func TestMatch_CelSelector_Deployment(t *testing.T) {
	tests := []struct {
		name       string
		expression string
		deployment oapi.Deployment
		wantMatch  bool
		wantErr    bool
	}{
		{
			name:       "deployment name check",
			expression: "deployment.name == 'api-deployment'",
			deployment: oapi.Deployment{
				Id:             "1",
				Name:           "api-deployment",
				SystemId:       "sys1",
				Slug:           "api-deployment",
				JobAgentConfig: map[string]interface{}{},
			},
			wantMatch: true,
			wantErr:   false,
		},
		{
			name:       "deployment slug check",
			expression: "deployment.slug.startsWith('prod-')",
			deployment: oapi.Deployment{
				Id:             "2",
				Name:           "Production API",
				SystemId:       "sys1",
				Slug:           "prod-api",
				JobAgentConfig: map[string]interface{}{},
			},
			wantMatch: true,
			wantErr:   false,
		},
		{
			name:       "deployment slug check no match",
			expression: "deployment.slug.startsWith('prod-')",
			deployment: oapi.Deployment{
				Id:             "3",
				Name:           "Staging API",
				SystemId:       "sys1",
				Slug:           "staging-api",
				JobAgentConfig: map[string]interface{}{},
			},
			wantMatch: false,
			wantErr:   false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := context.Background()
			selector := createCelSelector(t, tt.expression)

			match, err := Match(ctx, selector, tt.deployment)

			if (err != nil) != tt.wantErr {
				t.Errorf("Match() error = %v, wantErr %v", err, tt.wantErr)
				return
			}

			if match != tt.wantMatch {
				t.Errorf("Match() = %v, want %v", match, tt.wantMatch)
			}
		})
	}
}

func TestMatch_CelSelector_Environment(t *testing.T) {
	tests := []struct {
		name        string
		expression  string
		environment oapi.Environment
		wantMatch   bool
		wantErr     bool
	}{
		{
			name:       "environment name check",
			expression: "environment.name == 'production'",
			environment: oapi.Environment{
				Id:        "1",
				Name:      "production",
				SystemId:  "sys1",
				CreatedAt: "2024-01-01T00:00:00Z",
			},
			wantMatch: true,
			wantErr:   false,
		},
		{
			name:       "environment name check no match",
			expression: "environment.name == 'production'",
			environment: oapi.Environment{
				Id:        "2",
				Name:      "staging",
				SystemId:  "sys1",
				CreatedAt: "2024-01-01T00:00:00Z",
			},
			wantMatch: false,
			wantErr:   false,
		},
		{
			name:       "environment name contains",
			expression: "environment.name.contains('prod')",
			environment: oapi.Environment{
				Id:        "3",
				Name:      "production-us-east",
				SystemId:  "sys1",
				CreatedAt: "2024-01-01T00:00:00Z",
			},
			wantMatch: true,
			wantErr:   false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := context.Background()
			selector := createCelSelector(t, tt.expression)

			match, err := Match(ctx, selector, tt.environment)

			if (err != nil) != tt.wantErr {
				t.Errorf("Match() error = %v, wantErr %v", err, tt.wantErr)
				return
			}

			if match != tt.wantMatch {
				t.Errorf("Match() = %v, want %v", match, tt.wantMatch)
			}
		})
	}
}

func TestMatch_EmptyJsonSelector(t *testing.T) {
	ctx := context.Background()
	selector := createEmptyJsonSelector(t)

	resource := oapi.Resource{
		Id:   "1",
		Name: "test-resource",
		Kind: "service",
	}

	// Empty JSON selector falls through to CEL selector logic
	// Empty CEL string causes compilation error
	_, err := Match(ctx, selector, resource)

	if err == nil {
		t.Error("Match() expected error for empty selector (CEL compilation fails), got nil")
	}
}

func TestMatch_InvalidCelExpression(t *testing.T) {
	ctx := context.Background()

	// Create a CEL selector with invalid syntax
	selector := &oapi.Selector{}
	_ = selector.FromCelSelector(oapi.CelSelector{Cel: "invalid syntax =="})

	resource := oapi.Resource{
		Id:   "1",
		Name: "test-resource",
		Kind: "service",
	}

	// Invalid CEL expressions should return an error during compilation
	_, err := Match(ctx, selector, resource)

	if err == nil {
		t.Errorf("Match() expected error for invalid CEL syntax, got nil")
		return
	}
}

func TestMatch_JsonSelector_EdgeCases(t *testing.T) {
	tests := []struct {
		name      string
		condition unknown.UnknownCondition
		item      interface{}
		wantMatch bool
		wantErr   bool
	}{
		{
			name: "empty metadata key",
			condition: unknown.UnknownCondition{
				Property:    "metadata",
				Operator:    "equals",
				Value:       "value",
				MetadataKey: "nonexistent",
			},
			item: oapi.Resource{
				Id:       "1",
				Name:     "test",
				Metadata: map[string]string{},
			},
			wantMatch: false,
			wantErr:   false,
		},
		{
			name: "empty AND conditions",
			condition: unknown.UnknownCondition{
				Operator:   "and",
				Conditions: []unknown.UnknownCondition{},
			},
			item: oapi.Resource{
				Id:   "2",
				Name: "test",
			},
			wantMatch: true,
			wantErr:   false,
		},
		{
			name: "empty OR conditions",
			condition: unknown.UnknownCondition{
				Operator:   "or",
				Conditions: []unknown.UnknownCondition{},
			},
			item: oapi.Resource{
				Id:   "3",
				Name: "test",
			},
			wantMatch: false,
			wantErr:   false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := context.Background()
			selector := createJsonSelector(t, tt.condition)

			match, err := Match(ctx, selector, tt.item)

			if (err != nil) != tt.wantErr {
				t.Errorf("Match() error = %v, wantErr %v", err, tt.wantErr)
				return
			}

			if match != tt.wantMatch {
				t.Errorf("Match() = %v, want %v", match, tt.wantMatch)
			}
		})
	}
}

func TestMatch_CelSelector_ComplexExpressions(t *testing.T) {
	tests := []struct {
		name       string
		expression string
		resource   oapi.Resource
		wantMatch  bool
		wantErr    bool
	}{
		{
			name:       "complex nested condition",
			expression: "(resource.name.contains('prod') || resource.name.contains('staging')) && resource.kind == 'service'",
			resource: oapi.Resource{
				Id:   "1",
				Name: "prod-api",
				Kind: "service",
			},
			wantMatch: true,
			wantErr:   false,
		},
		{
			name:       "complex nested condition no match",
			expression: "(resource.name.contains('prod') || resource.name.contains('staging')) && resource.kind == 'service'",
			resource: oapi.Resource{
				Id:   "2",
				Name: "prod-api",
				Kind: "deployment",
			},
			wantMatch: false,
			wantErr:   false,
		},
		{
			name:       "metadata and property check",
			expression: "resource.metadata['env'] == 'production' && resource.kind.contains('service')",
			resource: oapi.Resource{
				Id:   "3",
				Name: "api",
				Kind: "kubernetes-service",
				Metadata: map[string]string{
					"env": "production",
				},
			},
			wantMatch: true,
			wantErr:   false,
		},
		{
			name:       "in operator with list",
			expression: "resource.kind in ['service', 'deployment', 'pod']",
			resource: oapi.Resource{
				Id:   "4",
				Name: "api",
				Kind: "service",
			},
			wantMatch: true,
			wantErr:   false,
		},
		{
			name:       "in operator with list no match",
			expression: "resource.kind in ['service', 'deployment', 'pod']",
			resource: oapi.Resource{
				Id:   "5",
				Name: "db",
				Kind: "database",
			},
			wantMatch: false,
			wantErr:   false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := context.Background()
			selector := createCelSelector(t, tt.expression)

			match, err := Match(ctx, selector, tt.resource)

			if (err != nil) != tt.wantErr {
				t.Errorf("Match() error = %v, wantErr %v", err, tt.wantErr)
				return
			}

			if match != tt.wantMatch {
				t.Errorf("Match() = %v, want %v", match, tt.wantMatch)
			}
		})
	}
}
