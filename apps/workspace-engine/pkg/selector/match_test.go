package selector

import (
	"context"
	"encoding/json"
	"testing"
	"time"
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
				Id:        "1",
				Name:      "api-deployment",
				SystemIds: []string{"sys1"},
				Slug:      "api-deployment",
				JobAgentConfig: oapi.JobAgentConfig{
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
				SystemIds:      []string{"sys1"},
				Slug:           "prod-api",
				JobAgentConfig: oapi.JobAgentConfig{},
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
				SystemIds:      []string{"sys1"},
				Slug:           "staging-api",
				JobAgentConfig: oapi.JobAgentConfig{},
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
				SystemIds: []string{"sys1"},
				CreatedAt: time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC),
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
				SystemIds: []string{"sys1"},
				CreatedAt: time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC),
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
				SystemIds: []string{"sys1"},
				CreatedAt: time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC),
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
		{
			name:       "metadata key with forward slash match",
			expression: "resource.metadata['google/project'] == 'wandb-qa'",
			resource: oapi.Resource{
				Id:   "9",
				Name: "gcp-resource",
				Kind: "compute",
				Metadata: map[string]string{
					"google/project": "wandb-qa",
					"google/region":  "us-central1",
				},
			},
			wantMatch: true,
			wantErr:   false,
		},
		{
			name:       "metadata key with forward slash no match",
			expression: "resource.metadata['google/project'] == 'wandb-qa'",
			resource: oapi.Resource{
				Id:   "10",
				Name: "gcp-resource",
				Kind: "compute",
				Metadata: map[string]string{
					"google/project": "wandb-prod",
					"google/region":  "us-central1",
				},
			},
			wantMatch: false,
			wantErr:   false,
		},
		{
			name:       "metadata key with multiple special characters",
			expression: "resource.metadata['kubernetes.io/cluster-name'] == 'prod-cluster-01'",
			resource: oapi.Resource{
				Id:   "11",
				Name: "k8s-node",
				Kind: "node",
				Metadata: map[string]string{
					"kubernetes.io/cluster-name": "prod-cluster-01",
					"kubernetes.io/role":         "worker",
				},
			},
			wantMatch: true,
			wantErr:   false,
		},
		{
			name:       "metadata key with hyphen and namespace",
			expression: "resource.metadata['app.kubernetes.io/name'] == 'nginx' && resource.metadata['app.kubernetes.io/version'] == '1.21.0'",
			resource: oapi.Resource{
				Id:   "12",
				Name: "nginx-deployment",
				Kind: "deployment",
				Metadata: map[string]string{
					"app.kubernetes.io/name":    "nginx",
					"app.kubernetes.io/version": "1.21.0",
				},
			},
			wantMatch: true,
			wantErr:   false,
		},
		{
			name:       "metadata key exists with forward slash - key present",
			expression: "'google/project' in resource.metadata",
			resource: oapi.Resource{
				Id:   "13",
				Name: "gcp-resource",
				Kind: "compute",
				Metadata: map[string]string{
					"google/project": "wandb-qa",
					"google/region":  "us-central1",
				},
			},
			wantMatch: true,
			wantErr:   false,
		},
		{
			name:       "metadata key exists with forward slash - key absent",
			expression: "'google/project' in resource.metadata",
			resource: oapi.Resource{
				Id:   "14",
				Name: "gcp-resource",
				Kind: "compute",
				Metadata: map[string]string{
					"google/region": "us-central1",
				},
			},
			wantMatch: false,
			wantErr:   false,
		},
		{
			name:       "metadata key exists with dots - key present",
			expression: "'kubernetes.io/cluster-name' in resource.metadata",
			resource: oapi.Resource{
				Id:   "15",
				Name: "k8s-node",
				Kind: "node",
				Metadata: map[string]string{
					"kubernetes.io/cluster-name": "prod-cluster-01",
				},
			},
			wantMatch: true,
			wantErr:   false,
		},
		{
			name:       "metadata key exists combined with value check",
			expression: "'google/project' in resource.metadata && resource.metadata['google/project'] == 'wandb-qa'",
			resource: oapi.Resource{
				Id:   "16",
				Name: "gcp-resource",
				Kind: "compute",
				Metadata: map[string]string{
					"google/project": "wandb-qa",
				},
			},
			wantMatch: true,
			wantErr:   false,
		},
		{
			name:       "metadata key exists but value doesn't match",
			expression: "'google/project' in resource.metadata && resource.metadata['google/project'] == 'wandb-prod'",
			resource: oapi.Resource{
				Id:   "17",
				Name: "gcp-resource",
				Kind: "compute",
				Metadata: map[string]string{
					"google/project": "wandb-qa",
				},
			},
			wantMatch: false,
			wantErr:   false,
		},
		{
			name:       "no such key error - metadata key does not exist",
			expression: "resource.metadata['nonexistent-key'] == 'some-value'",
			resource: oapi.Resource{
				Id:   "18",
				Name: "test-resource",
				Kind: "compute",
				Metadata: map[string]string{
					"existing-key": "existing-value",
				},
			},
			wantMatch: false,
			wantErr:   false,
		},
		{
			name:       "no such key error - empty metadata map",
			expression: "resource.metadata['any-key'] == 'any-value'",
			resource: oapi.Resource{
				Id:       "19",
				Name:     "test-resource",
				Kind:     "compute",
				Metadata: map[string]string{},
			},
			wantMatch: false,
			wantErr:   false,
		},
		{
			name:       "no such key error - nil metadata",
			expression: "resource.metadata['key'] == 'value'",
			resource: oapi.Resource{
				Id:       "20",
				Name:     "test-resource",
				Kind:     "compute",
				Metadata: nil,
			},
			wantMatch: false,
			wantErr:   false,
		},
		{
			name:       "no such key error - complex expression with missing key",
			expression: "resource.metadata['env'] == 'production' && resource.metadata['region'] == 'us-east-1'",
			resource: oapi.Resource{
				Id:   "21",
				Name: "test-resource",
				Kind: "compute",
				Metadata: map[string]string{
					"env": "production",
					// region key is missing
				},
			},
			wantMatch: false,
			wantErr:   false,
		},
		{
			name:       "no such key error - OR expression with missing key still matches",
			expression: "resource.metadata['missing-key'] == 'value' || resource.kind == 'compute'",
			resource: oapi.Resource{
				Id:   "22",
				Name: "test-resource",
				Kind: "compute",
				Metadata: map[string]string{
					"other-key": "other-value",
				},
			},
			wantMatch: true,
			wantErr:   false,
		},
		{
			name:       "no such key error - special character key that doesn't exist",
			expression: "resource.metadata['google/missing-key'] == 'value'",
			resource: oapi.Resource{
				Id:   "23",
				Name: "gcp-resource",
				Kind: "compute",
				Metadata: map[string]string{
					"google/project": "wandb-qa",
				},
			},
			wantMatch: false,
			wantErr:   false,
		},
		{
			name:       "no such key error - nested condition with missing key",
			expression: "(resource.metadata['env'] == 'production' || resource.metadata['env'] == 'staging') && resource.metadata['missing'] == 'value'",
			resource: oapi.Resource{
				Id:   "24",
				Name: "test-resource",
				Kind: "compute",
				Metadata: map[string]string{
					"env": "production",
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
				SystemIds:      []string{"sys1"},
				Slug:           "api-deployment",
				JobAgentConfig: oapi.JobAgentConfig{},
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
				SystemIds:      []string{"sys1"},
				Slug:           "prod-api",
				JobAgentConfig: oapi.JobAgentConfig{},
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
				SystemIds:      []string{"sys1"},
				Slug:           "staging-api",
				JobAgentConfig: oapi.JobAgentConfig{},
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
				SystemIds: []string{"sys1"},
				CreatedAt: time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC),
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
				SystemIds: []string{"sys1"},
				CreatedAt: time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC),
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
				SystemIds: []string{"sys1"},
				CreatedAt: time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC),
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

func TestMatch_Cache_ResourceUpdatedAtInvalidation(t *testing.T) {
	ctx := context.Background()
	selector := createCelSelector(t, "resource.name == 'server-v1'")

	now := time.Now()
	later := now.Add(time.Hour) // Use a significantly different time

	// Resource v1 - matches selector
	resourceV1 := &oapi.Resource{
		Id:        "cache-invalidation-test-1",
		Name:      "server-v1",
		Kind:      "server",
		CreatedAt: now,
		UpdatedAt: &now,
	}

	match1, err := Match(ctx, selector, resourceV1)
	if err != nil {
		t.Fatalf("Match() error = %v", err)
	}
	if !match1 {
		t.Error("Match() for v1 resource = false, want true")
	}

	// Resource v2 - same ID, different UpdatedAt, different name (doesn't match selector)
	// This simulates an entity being updated
	resourceV2 := &oapi.Resource{
		Id:        "cache-invalidation-test-1",
		Name:      "server-v2", // Changed - no longer matches selector
		Kind:      "server",
		CreatedAt: now,
		UpdatedAt: &later, // Different UpdatedAt = different cache key
	}

	match2, err := Match(ctx, selector, resourceV2)
	if err != nil {
		t.Fatalf("Match() error = %v", err)
	}
	if match2 {
		t.Error("Match() for v2 resource should be false (name changed), got true")
	}
}

func TestMatch_Cache_ResourceCreatedAtFallback(t *testing.T) {
	ctx := context.Background()
	selector := createCelSelector(t, "resource.kind == 'database'")

	now := time.Now()

	// Resource without UpdatedAt should use CreatedAt for cache key
	resource := &oapi.Resource{
		Id:        "cache-test-resource-2",
		Name:      "postgres",
		Kind:      "database",
		CreatedAt: now,
		UpdatedAt: nil, // No UpdatedAt
	}

	match1, err := Match(ctx, selector, resource)
	if err != nil {
		t.Fatalf("Match() error = %v", err)
	}
	if !match1 {
		t.Error("Match() = false, want true")
	}

	// Same resource should produce same result
	match2, err := Match(ctx, selector, resource)
	if err != nil {
		t.Fatalf("Match() error = %v", err)
	}
	if !match2 {
		t.Error("Match() should return true for same resource")
	}
}

func TestMatch_Cache_DifferentUpdatedAtProducesDifferentKeys(t *testing.T) {
	ctx := context.Background()
	selector := createCelSelector(t, "resource.name == 'test'")

	now := time.Now()
	later := now.Add(time.Hour)

	// Two resources with same ID but different UpdatedAt should have different cache keys
	resource1 := &oapi.Resource{
		Id:        "same-id-different-time",
		Name:      "test",
		Kind:      "server",
		CreatedAt: now,
		UpdatedAt: &now,
	}

	resource2 := &oapi.Resource{
		Id:        "same-id-different-time",
		Name:      "different-name",
		Kind:      "server",
		CreatedAt: now,
		UpdatedAt: &later,
	}

	match1, _ := Match(ctx, selector, resource1)
	if !match1 {
		t.Error("First resource should match")
	}

	match2, _ := Match(ctx, selector, resource2)
	if match2 {
		t.Error("Second resource should not match (different UpdatedAt = different cache key)")
	}
}

func TestEntityCacheKey(t *testing.T) {
	now := time.Now()
	later := now.Add(time.Hour)

	t.Run("resource with UpdatedAt", func(t *testing.T) {
		r := &oapi.Resource{Id: "r1", CreatedAt: now, UpdatedAt: &later}
		key := entityCacheKey(r)
		expected := "r1@" + later.Format(time.RFC3339Nano)
		if key != expected {
			t.Errorf("entityCacheKey() = %q, want %q", key, expected)
		}
	})

	t.Run("resource without UpdatedAt uses CreatedAt", func(t *testing.T) {
		r := &oapi.Resource{Id: "r2", CreatedAt: now, UpdatedAt: nil}
		key := entityCacheKey(r)
		expected := "r2@" + now.Format(time.RFC3339Nano)
		if key != expected {
			t.Errorf("entityCacheKey() = %q, want %q", key, expected)
		}
	})

	t.Run("resource with zero CreatedAt returns empty (not cached)", func(t *testing.T) {
		r := &oapi.Resource{Id: "r3", UpdatedAt: nil} // CreatedAt is zero
		key := entityCacheKey(r)
		if key != "" {
			t.Errorf("entityCacheKey() for Resource with zero CreatedAt = %q, want empty string", key)
		}
	})

	t.Run("job uses UpdatedAt", func(t *testing.T) {
		j := &oapi.Job{Id: "j1", CreatedAt: now, UpdatedAt: later}
		key := entityCacheKey(j)
		expected := "j1@" + later.Format(time.RFC3339Nano)
		if key != expected {
			t.Errorf("entityCacheKey() = %q, want %q", key, expected)
		}
	})

	t.Run("job with zero UpdatedAt returns empty (not cached)", func(t *testing.T) {
		j := &oapi.Job{Id: "j2", CreatedAt: now} // UpdatedAt is zero
		key := entityCacheKey(j)
		if key != "" {
			t.Errorf("entityCacheKey() for Job with zero UpdatedAt = %q, want empty string", key)
		}
	})

	t.Run("deployment returns empty (not cached)", func(t *testing.T) {
		d := &oapi.Deployment{Id: "d1", Name: "test"}
		key := entityCacheKey(d)
		if key != "" {
			t.Errorf("entityCacheKey() for Deployment = %q, want empty string", key)
		}
	})

	t.Run("environment returns empty (not cached)", func(t *testing.T) {
		e := &oapi.Environment{Id: "e1", Name: "test"}
		key := entityCacheKey(e)
		if key != "" {
			t.Errorf("entityCacheKey() for Environment = %q, want empty string", key)
		}
	})

	t.Run("unknown type returns empty", func(t *testing.T) {
		key := entityCacheKey("string-value")
		if key != "" {
			t.Errorf("entityCacheKey() for unknown type = %q, want empty string", key)
		}
	})
}
