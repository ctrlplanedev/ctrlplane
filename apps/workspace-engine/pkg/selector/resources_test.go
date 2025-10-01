package selector

import (
	"context"
	"testing"
	"time"
	"workspace-engine/pkg/pb"
	"workspace-engine/pkg/selector/langs/jsonselector/unknown"

	"google.golang.org/protobuf/types/known/structpb"
)

func TestFilterResources_StringConditions(t *testing.T) {
	tests := []struct {
		name          string
		condition     unknown.UnknownCondition
		resources     []*pb.Resource
		expectedCount int
		expectedIDs   []string
		wantErr       bool
	}{
		{
			name: "contains operator matches exact name",
			condition: unknown.UnknownCondition{
				Property: "Name",
				Operator: "contains",
				Value:    "production",
			},
			resources: []*pb.Resource{
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
			expectedIDs:   []string{"1"},
			wantErr:       false,
		},
		{
			name: "starts-with operator filters resources",
			condition: unknown.UnknownCondition{
				Property: "Name",
				Operator: "starts-with",
				Value:    "prod",
			},
			resources: []*pb.Resource{
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
			expectedIDs:   []string{"1", "2"},
			wantErr:       false,
		},
		{
			name: "ends-with operator filters resources",
			condition: unknown.UnknownCondition{
				Property: "Kind",
				Operator: "ends-with",
				Value:    "service",
			},
			resources: []*pb.Resource{
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
			expectedIDs:   []string{"1", "2"},
			wantErr:       false,
		},
		{
			name: "contains operator filters resources",
			condition: unknown.UnknownCondition{
				Property: "Identifier",
				Operator: "contains",
				Value:    "k8s",
			},
			resources: []*pb.Resource{
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
			expectedIDs:   []string{"1", "2"},
			wantErr:       false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := context.Background()
			result, err := FilterResources(ctx, tt.condition, tt.resources)

			if (err != nil) != tt.wantErr {
				t.Errorf("FilterResources() error = %v, wantErr %v", err, tt.wantErr)
				return
			}

			if len(result) != tt.expectedCount {
				t.Errorf("FilterResources() returned %d resources, want %d", len(result), tt.expectedCount)
				return
			}

			resultIDs := make([]string, len(result))
			for i, r := range result {
				resultIDs[i] = r.Id
			}

			for _, expectedID := range tt.expectedIDs {
				found := false
				for _, resultID := range resultIDs {
					if resultID == expectedID {
						found = true
						break
					}
				}
				if !found {
					t.Errorf("FilterResources() expected resource ID %s not found in results", expectedID)
				}
			}
		})
	}
}

func TestFilterResources_MetadataConditions(t *testing.T) {
	tests := []struct {
		name          string
		condition     unknown.UnknownCondition
		resources     []*pb.Resource
		expectedCount int
		expectedIDs   []string
		wantErr       bool
	}{
		{
			name: "metadata equals filter",
			condition: unknown.UnknownCondition{
				Property:    "metadata",
				Operator:    "equals",
				Value:       "production",
				MetadataKey: "env",
			},
			resources: []*pb.Resource{
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
			expectedIDs:   []string{"1", "3"},
			wantErr:       false,
		},
		{
			name: "metadata contains filter",
			condition: unknown.UnknownCondition{
				Property:    "metadata",
				Operator:    "contains",
				Value:       "critical",
				MetadataKey: "tags",
			},
			resources: []*pb.Resource{
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
			expectedIDs:   []string{"1"},
			wantErr:       false,
		},
		{
			name: "metadata starts-with filter",
			condition: unknown.UnknownCondition{
				Property:    "metadata",
				Operator:    "starts-with",
				Value:       "us-",
				MetadataKey: "region",
			},
			resources: []*pb.Resource{
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
			expectedIDs:   []string{"1", "2"},
			wantErr:       false,
		},
		{
			name: "metadata missing key returns no matches",
			condition: unknown.UnknownCondition{
				Property:    "metadata",
				Operator:    "equals",
				Value:       "value",
				MetadataKey: "nonexistent",
			},
			resources: []*pb.Resource{
				{
					Id: "1",
					Metadata: map[string]string{
						"existing": "value",
					},
				},
			},
			expectedCount: 0,
			expectedIDs:   []string{},
			wantErr:       false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := context.Background()
			result, err := FilterResources(ctx, tt.condition, tt.resources)

			if (err != nil) != tt.wantErr {
				t.Errorf("FilterResources() error = %v, wantErr %v", err, tt.wantErr)
				return
			}

			if len(result) != tt.expectedCount {
				t.Errorf("FilterResources() returned %d resources, want %d", len(result), tt.expectedCount)
				return
			}

			resultIDs := make([]string, len(result))
			for i, r := range result {
				resultIDs[i] = r.Id
			}

			for _, expectedID := range tt.expectedIDs {
				found := false
				for _, resultID := range resultIDs {
					if resultID == expectedID {
						found = true
						break
					}
				}
				if !found {
					t.Errorf("FilterResources() expected resource ID %s not found in results", expectedID)
				}
			}
		})
	}
}

func TestFilterResources_DateConditions(t *testing.T) {
	baseTime := time.Date(2024, 6, 1, 12, 0, 0, 0, time.UTC)
	beforeTime := baseTime.Add(-24 * time.Hour)
	afterTime := baseTime.Add(24 * time.Hour)

	tests := []struct {
		name          string
		condition     unknown.UnknownCondition
		resources     []*pb.Resource
		expectedCount int
		expectedIDs   []string
		wantErr       bool
	}{
		{
			name: "after operator filters resources created after date",
			condition: unknown.UnknownCondition{
				Property: "created-at",
				Operator: "after",
				Value:    baseTime.Format(time.RFC3339),
			},
			resources: []*pb.Resource{
				{
					Id:        "1",
					CreatedAt: afterTime.Format(time.RFC3339),
				},
				{
					Id:        "2",
					CreatedAt: beforeTime.Format(time.RFC3339),
				},
				{
					Id:        "3",
					CreatedAt: baseTime.Format(time.RFC3339),
				},
			},
			expectedCount: 1,
			expectedIDs:   []string{"1"},
			wantErr:       false,
		},
		{
			name: "before operator filters resources created before date",
			condition: unknown.UnknownCondition{
				Property: "created-at",
				Operator: "before",
				Value:    baseTime.Format(time.RFC3339),
			},
			resources: []*pb.Resource{
				{
					Id:        "1",
					CreatedAt: afterTime.Format(time.RFC3339),
				},
				{
					Id:        "2",
					CreatedAt: beforeTime.Format(time.RFC3339),
				},
				{
					Id:        "3",
					CreatedAt: baseTime.Format(time.RFC3339),
				},
			},
			expectedCount: 1,
			expectedIDs:   []string{"2"},
			wantErr:       false,
		},
		{
			name: "after-or-on operator includes exact match",
			condition: unknown.UnknownCondition{
				Property: "created-at",
				Operator: "after-or-on",
				Value:    baseTime.Format(time.RFC3339),
			},
			resources: []*pb.Resource{
				{
					Id:        "1",
					CreatedAt: afterTime.Format(time.RFC3339),
				},
				{
					Id:        "2",
					CreatedAt: beforeTime.Format(time.RFC3339),
				},
				{
					Id:        "3",
					CreatedAt: baseTime.Format(time.RFC3339),
				},
			},
			expectedCount: 2,
			expectedIDs:   []string{"1", "3"},
			wantErr:       false,
		},
		{
			name: "before-or-on operator includes exact match",
			condition: unknown.UnknownCondition{
				Property: "created-at",
				Operator: "before-or-on",
				Value:    baseTime.Format(time.RFC3339),
			},
			resources: []*pb.Resource{
				{
					Id:        "1",
					CreatedAt: afterTime.Format(time.RFC3339),
				},
				{
					Id:        "2",
					CreatedAt: beforeTime.Format(time.RFC3339),
				},
				{
					Id:        "3",
					CreatedAt: baseTime.Format(time.RFC3339),
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
			result, err := FilterResources(ctx, tt.condition, tt.resources)

			if (err != nil) != tt.wantErr {
				t.Errorf("FilterResources() error = %v, wantErr %v", err, tt.wantErr)
				return
			}

			if len(result) != tt.expectedCount {
				t.Errorf("FilterResources() returned %d resources, want %d", len(result), tt.expectedCount)
				return
			}

			resultIDs := make([]string, len(result))
			for i, r := range result {
				resultIDs[i] = r.Id
			}

			for _, expectedID := range tt.expectedIDs {
				found := false
				for _, resultID := range resultIDs {
					if resultID == expectedID {
						found = true
						break
					}
				}
				if !found {
					t.Errorf("FilterResources() expected resource ID %s not found in results", expectedID)
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
		condition     unknown.UnknownCondition
		resources     []*pb.Resource
		expectedCount int
		expectedIDs   []string
		wantErr       bool
	}{
		{
			name: "AND with multiple string conditions",
			condition: unknown.UnknownCondition{
				Operator: "and",
				Conditions: []unknown.UnknownCondition{
					{
						Property: "name",
						Operator: "starts-with",
						Value:    "prod",
					},
					{
						Property: "kind",
						Operator: "contains",
						Value:    "service",
					},
				},
			},
			resources: []*pb.Resource{
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
			name: "OR with multiple metadata conditions",
			condition: unknown.UnknownCondition{
				Operator: "or",
				Conditions: []unknown.UnknownCondition{
					{
						Property:    "metadata",
						Operator:    "equals",
						Value:       "production",
						MetadataKey: "env",
					},
					{
						Property:    "metadata",
						Operator:    "equals",
						Value:       "staging",
						MetadataKey: "env",
					},
				},
			},
			resources: []*pb.Resource{
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
			condition: unknown.UnknownCondition{
				Operator: "and",
				Conditions: []unknown.UnknownCondition{
					{
						Operator: "or",
						Conditions: []unknown.UnknownCondition{
							{
								Property: "name",
								Operator: "contains",
								Value:    "api",
							},
							{
								Property: "name",
								Operator: "contains",
								Value:    "service",
							},
						},
					},
					{
						Property: "created-at",
						Operator: "after",
						Value:    recentTime.Format(time.RFC3339),
					},
				},
			},
			resources: []*pb.Resource{
				{
					Id:        "1",
					Name:      "api-gateway",
					CreatedAt: baseTime.Format(time.RFC3339),
				},
				{
					Id:        "2",
					Name:      "web-service",
					CreatedAt: baseTime.Format(time.RFC3339),
				},
				{
					Id:        "3",
					Name:      "api-proxy",
					CreatedAt: recentTime.Add(-1 * time.Hour).Format(time.RFC3339),
				},
				{
					Id:        "4",
					Name:      "database",
					CreatedAt: baseTime.Format(time.RFC3339),
				},
			},
			expectedCount: 2,
			expectedIDs:   []string{"1", "2"},
			wantErr:       false,
		},
		{
			name: "deeply nested AND/OR/AND with metadata and strings",
			condition: unknown.UnknownCondition{
				Operator: "and",
				Conditions: []unknown.UnknownCondition{
					{
						Operator: "or",
						Conditions: []unknown.UnknownCondition{
							{
								Property:    "metadata",
								Operator:    "starts-with",
								Value:       "us-",
								MetadataKey: "region",
							},
							{
								Property:    "metadata",
								Operator:    "starts-with",
								Value:       "eu-",
								MetadataKey: "region",
							},
						},
					},
					{
						Operator: "and",
						Conditions: []unknown.UnknownCondition{
							{
								Property: "kind",
								Operator: "contains",
								Value:    "cluster",
							},
							{
								Property:    "metadata",
								Operator:    "equals",
								Value:       "premium",
								MetadataKey: "tier",
							},
						},
					},
				},
			},
			resources: []*pb.Resource{
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
			condition: unknown.UnknownCondition{
				Operator: "and",
				Conditions: []unknown.UnknownCondition{
					{
						Property: "name",
						Operator: "starts-with",
						Value:    "prod",
					},
					{
						Operator: "or",
						Conditions: []unknown.UnknownCondition{
							{
								Property:    "metadata",
								Operator:    "equals",
								Value:       "production",
								MetadataKey: "env",
							},
							{
								Property:    "metadata",
								Operator:    "equals",
								Value:       "prod",
								MetadataKey: "env",
							},
						},
					},
					{
						Property: "created-at",
						Operator: "after",
						Value:    recentTime.Format(time.RFC3339),
					},
					{
						Property: "kind",
						Operator: "contains",
						Value:    "service",
					},
				},
			},
			resources: []*pb.Resource{
				{
					Id:        "1",
					Name:      "prod-api-service",
					Kind:      "kubernetes-service",
					CreatedAt: baseTime.Format(time.RFC3339),
					Metadata: map[string]string{
						"env": "production",
					},
				},
				{
					Id:        "2",
					Name:      "prod-web-service",
					Kind:      "ecs-service",
					CreatedAt: baseTime.Format(time.RFC3339),
					Metadata: map[string]string{
						"env": "staging",
					},
				},
				{
					Id:        "3",
					Name:      "staging-api-service",
					Kind:      "kubernetes-service",
					CreatedAt: baseTime.Format(time.RFC3339),
					Metadata: map[string]string{
						"env": "production",
					},
				},
				{
					Id:        "4",
					Name:      "prod-api-service",
					Kind:      "kubernetes-service",
					CreatedAt: recentTime.Add(-1 * time.Hour).Format(time.RFC3339),
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
			result, err := FilterResources(ctx, tt.condition, tt.resources)

			if (err != nil) != tt.wantErr {
				t.Errorf("FilterResources() error = %v, wantErr %v", err, tt.wantErr)
				return
			}

			if len(result) != tt.expectedCount {
				t.Errorf("FilterResources() returned %d resources, want %d", len(result), tt.expectedCount)
				return
			}

			resultIDs := make([]string, len(result))
			for i, r := range result {
				resultIDs[i] = r.Id
			}

			for _, expectedID := range tt.expectedIDs {
				found := false
				for _, resultID := range resultIDs {
					if resultID == expectedID {
						found = true
						break
					}
				}
				if !found {
					t.Errorf("FilterResources() expected resource ID %s not found in results", expectedID)
				}
			}
		})
	}
}

func TestFilterResources_ConfigFieldConditions(t *testing.T) {
	config1, _ := structpb.NewStruct(map[string]interface{}{
		"replicas": "3",
		"version":  "1.2.0",
	})

	config2, _ := structpb.NewStruct(map[string]interface{}{
		"replicas": "5",
		"version":  "2.0.0",
	})

	tests := []struct {
		name          string
		condition     unknown.UnknownCondition
		resources     []*pb.Resource
		expectedCount int
		expectedIDs   []string
		wantErr       bool
	}{
		{
			name: "filter by version field",
			condition: unknown.UnknownCondition{
				Property: "Version",
				Operator: "starts-with",
				Value:    "1.",
			},
			resources: []*pb.Resource{
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
			name: "filter by identifier with contains",
			condition: unknown.UnknownCondition{
				Property: "Identifier",
				Operator: "contains",
				Value:    "cluster",
			},
			resources: []*pb.Resource{
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
			result, err := FilterResources(ctx, tt.condition, tt.resources)

			if (err != nil) != tt.wantErr {
				t.Errorf("FilterResources() error = %v, wantErr %v", err, tt.wantErr)
				return
			}

			if len(result) != tt.expectedCount {
				t.Errorf("FilterResources() returned %d resources, want %d", len(result), tt.expectedCount)
			}

			resultIDs := make([]string, len(result))
			for i, r := range result {
				resultIDs[i] = r.Id
			}

			for _, expectedID := range tt.expectedIDs {
				found := false
				for _, resultID := range resultIDs {
					if resultID == expectedID {
						found = true
						break
					}
				}
				if !found {
					t.Errorf("FilterResources() expected resource ID %s not found in results", expectedID)
				}
			}
		})
	}
}

func TestFilterResources_EmptyAndEdgeCases(t *testing.T) {
	tests := []struct {
		name          string
		condition     unknown.UnknownCondition
		resources     []*pb.Resource
		expectedCount int
		wantErr       bool
	}{
		{
			name: "empty resource list",
			condition: unknown.UnknownCondition{
				Property: "Name",
				Operator: "contains",
				Value:    "test",
			},
			resources:     []*pb.Resource{},
			expectedCount: 0,
			wantErr:       false,
		},
		{
			name: "no resources match condition",
			condition: unknown.UnknownCondition{
				Property: "Name",
				Operator: "contains",
				Value:    "nonexistent",
			},
			resources: []*pb.Resource{
				{
					Id:   "1",
					Name: "existing",
				},
			},
			expectedCount: 0,
			wantErr:       false,
		},
		{
			name: "all resources match condition",
			condition: unknown.UnknownCondition{
				Property: "Kind",
				Operator: "contains",
				Value:    "service",
			},
			resources: []*pb.Resource{
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
			name: "empty AND condition matches all",
			condition: unknown.UnknownCondition{
				Operator:   "and",
				Conditions: []unknown.UnknownCondition{},
			},
			resources: []*pb.Resource{
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
			name: "empty OR condition matches none",
			condition: unknown.UnknownCondition{
				Operator:   "or",
				Conditions: []unknown.UnknownCondition{},
			},
			resources: []*pb.Resource{
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
			result, err := FilterResources(ctx, tt.condition, tt.resources)

			if (err != nil) != tt.wantErr {
				t.Errorf("FilterResources() error = %v, wantErr %v", err, tt.wantErr)
				return
			}

			if len(result) != tt.expectedCount {
				t.Errorf("FilterResources() returned %d resources, want %d", len(result), tt.expectedCount)
			}
		})
	}
}

func TestFilterResources_ComplexRealWorldScenarios(t *testing.T) {
	baseTime := time.Date(2024, 10, 1, 0, 0, 0, 0, time.UTC)
	oldTime := baseTime.Add(-30 * 24 * time.Hour)
	recentTime := baseTime.Add(-7 * 24 * time.Hour)

	t.Run("filter production kubernetes services in US regions created recently", func(t *testing.T) {
		condition := unknown.UnknownCondition{
			Operator: "and",
			Conditions: []unknown.UnknownCondition{
				{
					Property: "kind",
					Operator: "contains",
					Value:    "kubernetes-service",
				},
				{
					Property:    "metadata",
					Operator:    "equals",
					Value:       "production",
					MetadataKey: "env",
				},
				{
					Property:    "metadata",
					Operator:    "starts-with",
					Value:       "us-",
					MetadataKey: "region",
				},
				{
					Property: "CreatedAt",
					Operator: "after",
					Value:    recentTime.Format(time.RFC3339),
				},
			},
		}

		resources := []*pb.Resource{
			{
				Id:        "1",
				Name:      "payment-service",
				Kind:      "kubernetes-service",
				CreatedAt: baseTime.Format(time.RFC3339),
				Metadata: map[string]string{
					"env":    "production",
					"region": "us-east-1",
				},
			},
			{
				Id:        "2",
				Name:      "auth-service",
				Kind:      "kubernetes-service",
				CreatedAt: oldTime.Format(time.RFC3339),
				Metadata: map[string]string{
					"env":    "production",
					"region": "us-west-2",
				},
			},
			{
				Id:        "3",
				Name:      "notification-service",
				Kind:      "kubernetes-service",
				CreatedAt: baseTime.Format(time.RFC3339),
				Metadata: map[string]string{
					"env":    "staging",
					"region": "us-east-1",
				},
			},
			{
				Id:        "4",
				Name:      "billing-service",
				Kind:      "kubernetes-service",
				CreatedAt: baseTime.Format(time.RFC3339),
				Metadata: map[string]string{
					"env":    "production",
					"region": "eu-west-1",
				},
			},
		}

		ctx := context.Background()
		result, err := FilterResources(ctx, condition, resources)

		if err != nil {
			t.Fatalf("FilterResources() unexpected error: %v", err)
		}

		if len(result) != 1 {
			t.Errorf("FilterResources() returned %d resources, want 1", len(result))
		}

		if len(result) > 0 && result[0].Id != "1" {
			t.Errorf("FilterResources() returned resource ID %s, want 1", result[0].Id)
		}
	})

	t.Run("filter critical services in any production environment", func(t *testing.T) {
		condition := unknown.UnknownCondition{
			Operator: "and",
			Conditions: []unknown.UnknownCondition{
				{
					Property:    "metadata",
					Operator:    "equals",
					Value:       "critical",
					MetadataKey: "priority",
				},
				{
					Operator: "or",
					Conditions: []unknown.UnknownCondition{
						{
							Property:    "metadata",
							Operator:    "equals",
							Value:       "production",
							MetadataKey: "env",
						},
						{
							Property:    "metadata",
							Operator:    "equals",
							Value:       "prod",
							MetadataKey: "env",
						},
					},
				},
				{
					Operator: "or",
					Conditions: []unknown.UnknownCondition{
						{
							Property: "Name",
							Operator: "contains",
							Value:    "payment",
						},
						{
							Property: "Name",
							Operator: "contains",
							Value:    "auth",
						},
						{
							Property: "Name",
							Operator: "contains",
							Value:    "billing",
						},
					},
				},
			},
		}

		resources := []*pb.Resource{
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
		result, err := FilterResources(ctx, condition, resources)

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
