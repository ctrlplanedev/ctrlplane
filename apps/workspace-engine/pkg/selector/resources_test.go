package selector

import (
	"context"
	"fmt"
	"slices"
	"testing"
	"time"

	"workspace-engine/pkg/oapi"
)

// Helper function to validate filtered results.
func validateFilteredResources(
	t *testing.T,
	result map[string]*oapi.Resource,
	expectedCount int,
	expectedIDs map[string]bool,
) {
	t.Helper()

	if len(result) != expectedCount {
		t.Errorf("FilterResources() returned %d resources, want %d", len(result), expectedCount)
		return
	}

	for expectedID := range expectedIDs {
		if _, found := result[expectedID]; !found {
			t.Errorf("FilterResources() expected resource ID %s not found in results", expectedID)
		}
	}

	for id := range result {
		if !expectedIDs[id] {
			t.Errorf("FilterResources() unexpected resource ID %s in results", id)
		}
	}
}

func TestFilterResources_StringConditions(t *testing.T) {
	tests := []struct {
		name          string
		selector      string
		resources     []*oapi.Resource
		expectedCount int
		expectedIDs   map[string]bool
		wantErr       bool
	}{
		{
			name:     "contains operator matches exact name",
			selector: "resource.name.contains('production')",
			resources: []*oapi.Resource{
				{
					Id:   "1",
					Name: "production-server",
					Kind: "server",
				},
				{
					Id:   "2",
					Name: "staging-server",
					Kind: "server",
				},
			},
			expectedCount: 1,
			expectedIDs:   map[string]bool{"1": true},
			wantErr:       false,
		},
		{
			name:     "starts-with operator filters resources",
			selector: "resource.name.startsWith('prod')",
			resources: []*oapi.Resource{
				{
					Id:   "1",
					Name: "production-server",
				},
				{
					Id:   "2",
					Name: "prod-api",
				},
				{
					Id:   "3",
					Name: "staging-server",
				},
			},
			expectedCount: 2,
			expectedIDs:   map[string]bool{"1": true, "2": true},
			wantErr:       false,
		},
		{
			name:     "ends-with operator filters resources",
			selector: "resource.kind.endsWith('service')",
			resources: []*oapi.Resource{
				{
					Id:   "1",
					Kind: "web-service",
				},
				{
					Id:   "2",
					Kind: "api-service",
				},
				{
					Id:   "3",
					Kind: "database",
				},
			},
			expectedCount: 2,
			expectedIDs:   map[string]bool{"1": true, "2": true},
			wantErr:       false,
		},
		{
			name:     "contains operator filters resources",
			selector: "resource.identifier.contains('k8s')",
			resources: []*oapi.Resource{
				{
					Id:         "1",
					Identifier: "k8s-cluster-us-east",
				},
				{
					Id:         "2",
					Identifier: "k8s-cluster-us-west",
				},
				{
					Id:         "3",
					Identifier: "ec2-instance",
				},
			},
			expectedCount: 2,
			expectedIDs:   map[string]bool{"1": true, "2": true},
			wantErr:       false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := context.Background()
			result, err := FilterResources(ctx, tt.selector, tt.resources)

			if (err != nil) != tt.wantErr {
				t.Errorf("FilterResources() error = %v, wantErr %v", err, tt.wantErr)
				return
			}

			validateFilteredResources(t, result, tt.expectedCount, tt.expectedIDs)
		})
	}
}

func TestFilterResources_MetadataConditions(t *testing.T) {
	tests := []struct {
		name          string
		selector      string
		resources     []*oapi.Resource
		expectedCount int
		expectedIDs   map[string]bool
		wantErr       bool
	}{
		{
			name:     "metadata equals filter",
			selector: "resource.metadata['env'] == 'production'",
			resources: []*oapi.Resource{
				{
					Id:   "1",
					Name: "server-1",
					Metadata: map[string]string{
						"env": "production",
					},
				},
				{
					Id:   "2",
					Name: "server-2",
					Metadata: map[string]string{
						"env": "staging",
					},
				},
				{
					Id:   "3",
					Name: "server-3",
					Metadata: map[string]string{
						"env": "production",
					},
				},
			},
			expectedCount: 2,
			expectedIDs:   map[string]bool{"1": true, "3": true},
			wantErr:       false,
		},
		{
			name:     "metadata contains filter",
			selector: "resource.metadata['tags'].contains('critical')",
			resources: []*oapi.Resource{
				{
					Id: "1",
					Metadata: map[string]string{
						"tags": "critical,high-priority",
					},
				},
				{
					Id: "2",
					Metadata: map[string]string{
						"tags": "low-priority",
					},
				},
			},
			expectedCount: 1,
			expectedIDs:   map[string]bool{"1": true},
			wantErr:       false,
		},
		{
			name:     "metadata starts-with filter",
			selector: "resource.metadata['region'].startsWith('us-')",
			resources: []*oapi.Resource{
				{
					Id: "1",
					Metadata: map[string]string{
						"region": "us-east-1",
					},
				},
				{
					Id: "2",
					Metadata: map[string]string{
						"region": "us-west-2",
					},
				},
				{
					Id: "3",
					Metadata: map[string]string{
						"region": "eu-central-1",
					},
				},
			},
			expectedCount: 2,
			expectedIDs:   map[string]bool{"1": true, "2": true},
			wantErr:       false,
		},
		{
			name:     "metadata missing key returns no matches",
			selector: "resource.metadata['nonexistent'] == 'value'",
			resources: []*oapi.Resource{
				{
					Id: "1",
					Metadata: map[string]string{
						"existing": "value",
					},
				},
			},
			expectedCount: 0,
			expectedIDs:   map[string]bool{},
			wantErr:       false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := context.Background()
			result, err := FilterResources(ctx, tt.selector, tt.resources)

			if (err != nil) != tt.wantErr {
				t.Errorf("FilterResources() error = %v, wantErr %v", err, tt.wantErr)
				return
			}

			validateFilteredResources(t, result, tt.expectedCount, tt.expectedIDs)
		})
	}
}

func TestFilterResources_DateConditions(t *testing.T) {
	baseTime := time.Date(2024, 6, 1, 12, 0, 0, 0, time.UTC)
	beforeTime := baseTime.Add(-24 * time.Hour)
	afterTime := baseTime.Add(24 * time.Hour)

	tests := []struct {
		name          string
		selector      string
		resources     []*oapi.Resource
		expectedCount int
		expectedIDs   []string
		wantErr       bool
	}{
		{
			name:     "after operator filters resources created after date",
			selector: fmt.Sprintf("resource.createdAt > timestamp('%s')", baseTime.Format(time.RFC3339)),
			resources: []*oapi.Resource{
				{
					Id:        "1",
					CreatedAt: afterTime,
				},
				{
					Id:        "2",
					CreatedAt: beforeTime,
				},
				{
					Id:        "3",
					CreatedAt: baseTime,
				},
			},
			expectedCount: 1,
			expectedIDs:   []string{"1"},
			wantErr:       false,
		},
		{
			name:     "before operator filters resources created before date",
			selector: fmt.Sprintf("resource.createdAt < timestamp('%s')", baseTime.Format(time.RFC3339)),
			resources: []*oapi.Resource{
				{
					Id:        "1",
					CreatedAt: afterTime,
				},
				{
					Id:        "2",
					CreatedAt: beforeTime,
				},
				{
					Id:        "3",
					CreatedAt: baseTime,
				},
			},
			expectedCount: 1,
			expectedIDs:   []string{"2"},
			wantErr:       false,
		},
		{
			name:     "after-or-on operator includes exact match",
			selector: fmt.Sprintf("resource.createdAt >= timestamp('%s')", baseTime.Format(time.RFC3339)),
			resources: []*oapi.Resource{
				{
					Id:        "1",
					CreatedAt: afterTime,
				},
				{
					Id:        "2",
					CreatedAt: beforeTime,
				},
				{
					Id:        "3",
					CreatedAt: baseTime,
				},
			},
			expectedCount: 2,
			expectedIDs:   []string{"1", "3"},
			wantErr:       false,
		},
		{
			name:     "before-or-on operator includes exact match",
			selector: fmt.Sprintf("resource.createdAt <= timestamp('%s')", baseTime.Format(time.RFC3339)),
			resources: []*oapi.Resource{
				{
					Id:        "1",
					CreatedAt: afterTime,
				},
				{
					Id:        "2",
					CreatedAt: beforeTime,
				},
				{
					Id:        "3",
					CreatedAt: baseTime,
				},
			},
			expectedCount: 2,
			expectedIDs:   []string{"2", "3"},
			wantErr:       false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := context.Background()
			result, err := FilterResources(ctx, tt.selector, tt.resources)

			if (err != nil) != tt.wantErr {
				t.Errorf("FilterResources() error = %v, wantErr %v", err, tt.wantErr)
				return
			}

			if len(result) != tt.expectedCount {
				t.Errorf(
					"FilterResources() returned %d resources, want %d",
					len(result),
					tt.expectedCount,
				)
				return
			}

			resultIDs := make([]string, 0, len(result))
			for _, r := range result {
				resultIDs = append(resultIDs, r.Id)
			}

			for _, expectedID := range tt.expectedIDs {
				found := slices.Contains(resultIDs, expectedID)
				if !found {
					t.Errorf(
						"FilterResources() expected resource ID %s not found in results",
						expectedID,
					)
				}
			}
		})
	}
}

func TestFilterResources_DeeplyNestedConditions(t *testing.T) {
	baseTime := time.Date(2024, 6, 1, 12, 0, 0, 0, time.UTC)
	recentTime := baseTime.Add(-6 * time.Hour)

	tests := []struct {
		name          string
		selector      string
		resources     []*oapi.Resource
		expectedCount int
		expectedIDs   []string
		wantErr       bool
	}{
		{
			name:     "AND with multiple string conditions",
			selector: "resource.name.startsWith('prod') && resource.kind.contains('service')",
			resources: []*oapi.Resource{
				{
					Id:   "1",
					Name: "prod-api",
					Kind: "service",
				},
				{
					Id:   "2",
					Name: "prod-web",
					Kind: "deployment",
				},
				{
					Id:   "3",
					Name: "staging-api",
					Kind: "service",
				},
			},
			expectedCount: 1,
			expectedIDs:   []string{"1"},
			wantErr:       false,
		},
		{
			name:     "OR with multiple metadata conditions",
			selector: "resource.metadata['env'] == 'production' || resource.metadata['env'] == 'staging'",
			resources: []*oapi.Resource{
				{
					Id: "1",
					Metadata: map[string]string{
						"env": "production",
					},
				},
				{
					Id: "2",
					Metadata: map[string]string{
						"env": "staging",
					},
				},
				{
					Id: "3",
					Metadata: map[string]string{
						"env": "development",
					},
				},
			},
			expectedCount: 2,
			expectedIDs:   []string{"1", "2"},
			wantErr:       false,
		},
		{
			name: "nested AND/OR with string and date conditions",
			selector: fmt.Sprintf(
				"(resource.name.contains('api') || resource.name.contains('service')) && resource.createdAt > timestamp('%s')",
				recentTime.Format(time.RFC3339),
			),
			resources: []*oapi.Resource{
				{
					Id:        "1",
					Name:      "api-gateway",
					CreatedAt: baseTime,
				},
				{
					Id:        "2",
					Name:      "web-service",
					CreatedAt: baseTime,
				},
				{
					Id:        "3",
					Name:      "api-proxy",
					CreatedAt: recentTime.Add(-1 * time.Hour),
				},
				{
					Id:        "4",
					Name:      "database",
					CreatedAt: baseTime,
				},
			},
			expectedCount: 2,
			expectedIDs:   []string{"1", "2"},
			wantErr:       false,
		},
		{
			name:     "deeply nested AND/OR/AND with metadata and strings",
			selector: "(resource.metadata['region'].startsWith('us-') || resource.metadata['region'].startsWith('eu-')) && (resource.kind.contains('cluster') && resource.metadata['tier'] == 'premium')",
			resources: []*oapi.Resource{
				{
					Id:   "1",
					Kind: "cluster",
					Metadata: map[string]string{
						"region": "us-east-1",
						"tier":   "premium",
					},
				},
				{
					Id:   "2",
					Kind: "cluster",
					Metadata: map[string]string{
						"region": "us-west-2",
						"tier":   "standard",
					},
				},
				{
					Id:   "3",
					Kind: "cluster",
					Metadata: map[string]string{
						"region": "eu-west-1",
						"tier":   "premium",
					},
				},
				{
					Id:   "4",
					Kind: "instance",
					Metadata: map[string]string{
						"region": "us-east-1",
						"tier":   "premium",
					},
				},
			},
			expectedCount: 2,
			expectedIDs:   []string{"1", "3"},
			wantErr:       false,
		},
		{
			name: "complex nested condition with all types",
			selector: fmt.Sprintf(
				"resource.name.startsWith('prod') && (resource.metadata['env'] == 'production' || resource.metadata['env'] == 'prod') && resource.createdAt > timestamp('%s') && resource.kind.contains('service')",
				recentTime.Format(time.RFC3339),
			),
			resources: []*oapi.Resource{
				{
					Id:        "1",
					Name:      "prod-api-service",
					Kind:      "kubernetes-service",
					CreatedAt: baseTime,
					Metadata: map[string]string{
						"env": "production",
					},
				},
				{
					Id:        "2",
					Name:      "prod-web-service",
					Kind:      "ecs-service",
					CreatedAt: baseTime,
					Metadata: map[string]string{
						"env": "staging",
					},
				},
				{
					Id:        "3",
					Name:      "staging-api-service",
					Kind:      "kubernetes-service",
					CreatedAt: baseTime,
					Metadata: map[string]string{
						"env": "production",
					},
				},
				{
					Id:        "4",
					Name:      "prod-api-service",
					Kind:      "kubernetes-service",
					CreatedAt: recentTime.Add(-1 * time.Hour),
					Metadata: map[string]string{
						"env": "production",
					},
				},
			},
			expectedCount: 1,
			expectedIDs:   []string{"1"},
			wantErr:       false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := context.Background()
			result, err := FilterResources(ctx, tt.selector, tt.resources)

			if (err != nil) != tt.wantErr {
				t.Errorf("FilterResources() error = %v, wantErr %v", err, tt.wantErr)
				return
			}

			if len(result) != tt.expectedCount {
				t.Errorf(
					"FilterResources() returned %d resources, want %d",
					len(result),
					tt.expectedCount,
				)
				return
			}

			resultIDs := make([]string, 0, len(result))
			for _, r := range result {
				resultIDs = append(resultIDs, r.Id)
			}

			for _, expectedID := range tt.expectedIDs {
				found := slices.Contains(resultIDs, expectedID)
				if !found {
					t.Errorf(
						"FilterResources() expected resource ID %s not found in results",
						expectedID,
					)
				}
			}
		})
	}
}

func TestFilterResources_ConfigFieldConditions(t *testing.T) {
	config1 := map[string]any{
		"replicas": "3",
		"version":  "1.2.0",
	}

	config2 := map[string]any{
		"replicas": "5",
		"version":  "2.0.0",
	}

	tests := []struct {
		name          string
		selector      string
		resources     []*oapi.Resource
		expectedCount int
		expectedIDs   []string
		wantErr       bool
	}{
		{
			name:     "filter by version field",
			selector: "resource.version.startsWith('1.')",
			resources: []*oapi.Resource{
				{
					Id:      "1",
					Version: "1.2.0",
					Config:  config1,
				},
				{
					Id:      "2",
					Version: "2.0.0",
					Config:  config2,
				},
			},
			expectedCount: 1,
			expectedIDs:   []string{"1"},
			wantErr:       false,
		},
		{
			name:     "filter by identifier with contains",
			selector: "resource.identifier.contains('cluster')",
			resources: []*oapi.Resource{
				{
					Id:         "1",
					Identifier: "aws-cluster-prod",
				},
				{
					Id:         "2",
					Identifier: "gcp-instance-dev",
				},
				{
					Id:         "3",
					Identifier: "azure-cluster-staging",
				},
			},
			expectedCount: 2,
			expectedIDs:   []string{"1", "3"},
			wantErr:       false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := context.Background()
			result, err := FilterResources(ctx, tt.selector, tt.resources)

			if (err != nil) != tt.wantErr {
				t.Errorf("FilterResources() error = %v, wantErr %v", err, tt.wantErr)
				return
			}

			if len(result) != tt.expectedCount {
				t.Errorf(
					"FilterResources() returned %d resources, want %d",
					len(result),
					tt.expectedCount,
				)
			}

			resultIDs := make([]string, 0, len(result))
			for _, r := range result {
				resultIDs = append(resultIDs, r.Id)
			}

			for _, expectedID := range tt.expectedIDs {
				found := slices.Contains(resultIDs, expectedID)
				if !found {
					t.Errorf(
						"FilterResources() expected resource ID %s not found in results",
						expectedID,
					)
				}
			}
		})
	}
}

func TestFilterResources_EmptyAndEdgeCases(t *testing.T) {
	tests := []struct {
		name          string
		selector      string
		resources     []*oapi.Resource
		expectedCount int
		wantErr       bool
	}{
		{
			name:          "empty resource list",
			selector:      "resource.name.contains('test')",
			resources:     []*oapi.Resource{},
			expectedCount: 0,
			wantErr:       false,
		},
		{
			name:     "no resources match condition",
			selector: "resource.name.contains('nonexistent')",
			resources: []*oapi.Resource{
				{
					Id:   "1",
					Name: "existing",
				},
			},
			expectedCount: 0,
			wantErr:       false,
		},
		{
			name:     "all resources match condition",
			selector: "resource.kind.contains('service')",
			resources: []*oapi.Resource{
				{
					Id:   "1",
					Kind: "service",
				},
				{
					Id:   "2",
					Kind: "service",
				},
				{
					Id:   "3",
					Kind: "service",
				},
			},
			expectedCount: 3,
			wantErr:       false,
		},
		{
			name:     "true selector matches all",
			selector: "true",
			resources: []*oapi.Resource{
				{
					Id:   "1",
					Name: "resource-1",
				},
				{
					Id:   "2",
					Name: "resource-2",
				},
			},
			expectedCount: 2,
			wantErr:       false,
		},
		{
			name:     "false selector matches none",
			selector: "false",
			resources: []*oapi.Resource{
				{
					Id:   "1",
					Name: "resource-1",
				},
			},
			expectedCount: 0,
			wantErr:       false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := context.Background()
			result, err := FilterResources(ctx, tt.selector, tt.resources)

			if (err != nil) != tt.wantErr {
				t.Errorf("FilterResources() error = %v, wantErr %v", err, tt.wantErr)
				return
			}

			if len(result) != tt.expectedCount {
				t.Errorf(
					"FilterResources() returned %d resources, want %d",
					len(result),
					tt.expectedCount,
				)
			}
		})
	}
}

func TestFilterResources_ComplexRealWorldScenarios(t *testing.T) {
	baseTime := time.Date(2024, 10, 1, 0, 0, 0, 0, time.UTC)
	oldTime := baseTime.Add(-30 * 24 * time.Hour)
	recentTime := baseTime.Add(-7 * 24 * time.Hour)

	t.Run(
		"filter production kubernetes services in US regions created recently",
		func(t *testing.T) {
			sel := fmt.Sprintf(
				"resource.kind.contains('kubernetes-service') && resource.metadata['env'] == 'production' && resource.metadata['region'].startsWith('us-') && resource.createdAt > timestamp('%s')",
				recentTime.Format(time.RFC3339),
			)

			resources := []*oapi.Resource{
				{
					Id:        "1",
					Name:      "payment-service",
					Kind:      "kubernetes-service",
					CreatedAt: baseTime,
					Metadata: map[string]string{
						"env":    "production",
						"region": "us-east-1",
					},
				},
				{
					Id:        "2",
					Name:      "auth-service",
					Kind:      "kubernetes-service",
					CreatedAt: oldTime,
					Metadata: map[string]string{
						"env":    "production",
						"region": "us-west-2",
					},
				},
				{
					Id:        "3",
					Name:      "notification-service",
					Kind:      "kubernetes-service",
					CreatedAt: baseTime,
					Metadata: map[string]string{
						"env":    "staging",
						"region": "us-east-1",
					},
				},
				{
					Id:        "4",
					Name:      "billing-service",
					Kind:      "kubernetes-service",
					CreatedAt: baseTime,
					Metadata: map[string]string{
						"env":    "production",
						"region": "eu-west-1",
					},
				},
			}

			ctx := context.Background()
			result, err := FilterResources(ctx, sel, resources)

			if err != nil {
				t.Fatalf("FilterResources() unexpected error: %v", err)
			}

			if len(result) != 1 {
				t.Errorf("FilterResources() returned %d resources, want 1", len(result))
			}

			for _, r := range result {
				if r.Id != "1" {
					t.Errorf("FilterResources() returned resource ID %s, want 1", r.Id)
				}
			}
		},
	)

	t.Run("filter critical services in any production environment", func(t *testing.T) {
		sel := "resource.metadata['priority'] == 'critical' && (resource.metadata['env'] == 'production' || resource.metadata['env'] == 'prod') && (resource.name.contains('payment') || resource.name.contains('auth') || resource.name.contains('billing'))"

		resources := []*oapi.Resource{
			{
				Id:   "1",
				Name: "payment-gateway",
				Metadata: map[string]string{
					"env":      "production",
					"priority": "critical",
				},
			},
			{
				Id:   "2",
				Name: "auth-service",
				Metadata: map[string]string{
					"env":      "prod",
					"priority": "critical",
				},
			},
			{
				Id:   "3",
				Name: "notification-service",
				Metadata: map[string]string{
					"env":      "production",
					"priority": "critical",
				},
			},
			{
				Id:   "4",
				Name: "billing-api",
				Metadata: map[string]string{
					"env":      "production",
					"priority": "high",
				},
			},
		}

		ctx := context.Background()
		result, err := FilterResources(ctx, sel, resources)

		if err != nil {
			t.Fatalf("FilterResources() unexpected error: %v", err)
		}

		if len(result) != 2 {
			t.Errorf("FilterResources() returned %d resources, want 2", len(result))
		}

		expectedIDs := map[string]bool{"1": true, "2": true}
		for _, r := range result {
			if !expectedIDs[r.Id] {
				t.Errorf("FilterResources() unexpected resource ID %s", r.Id)
			}
		}
	})
}
