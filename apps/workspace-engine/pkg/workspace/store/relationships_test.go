package store

import (
	"context"
	"testing"
	"workspace-engine/pkg/pb"

	"google.golang.org/protobuf/types/known/structpb"
)

// Helper to create a struct from a map
func mustNewStruct(t *testing.T, m map[string]any) *structpb.Struct {
	s, err := structpb.NewStruct(m)
	if err != nil {
		t.Fatalf("failed to create struct: %v", err)
	}
	return s
}

func TestRelationshipRules_GetRelationships_NoPropertyMatchers(t *testing.T) {
	ctx := context.Background()
	store := New()

	// Create test resources
	vpc1 := &pb.Resource{
		Id:          "vpc-1",
		Name:        "VPC 1",
		Kind:        "vpc",
		WorkspaceId: "workspace-1",
		Metadata:    map[string]string{"region": "us-east-1"},
	}
	vpc2 := &pb.Resource{
		Id:          "vpc-2",
		Name:        "VPC 2",
		Kind:        "vpc",
		WorkspaceId: "workspace-1",
		Metadata:    map[string]string{"region": "us-west-2"},
	}
	cluster1 := &pb.Resource{
		Id:          "cluster-1",
		Name:        "Cluster 1",
		Kind:        "kubernetes-cluster",
		WorkspaceId: "workspace-1",
		Metadata:    map[string]string{"region": "us-east-1"},
	}

	// Add resources to store
	store.Resources.Upsert(ctx, vpc1)
	store.Resources.Upsert(ctx, vpc2)
	store.Resources.Upsert(ctx, cluster1)

	// Create relationship rule without property matchers (Cartesian product)
	rule := &pb.RelationshipRule{
		Id:               "rule-1",
		Name:             "vpc-to-cluster",
		RelationshipType: "contains",
		FromType:         "resource",
		ToType:           "resource",
		FromSelector: pb.NewJsonSelector(mustNewStruct(t, map[string]any{
			"type":     "kind",
			"operator": "equals",
			"value":    "vpc",
		})),
		ToSelector: pb.NewJsonSelector(mustNewStruct(t, map[string]any{
			"type":     "kind",
			"operator": "equals",
			"value":    "kubernetes-cluster",
		})),
		PropertyMatchers: []*pb.PropertyMatcher{},
	}

	store.Relationships.Upsert(ctx, rule)

	// Get relationships
	result, err := store.Relationships.GetRelationships(ctx, "rule-1")
	if err != nil {
		t.Fatalf("failed to get relationships: %v", err)
	}

	if result.RuleID != "rule-1" {
		t.Errorf("expected rule ID rule-1, got %s", result.RuleID)
	}

	if result.RuleName != "vpc-to-cluster" {
		t.Errorf("expected rule name vpc-to-cluster, got %s", result.RuleName)
	}

	if result.RelationshipType != "contains" {
		t.Errorf("expected relationship type contains, got %s", result.RelationshipType)
	}

	// Should have 2 VPCs * 1 cluster = 2 relationships
	if len(result.Relationships) != 2 {
		t.Fatalf("expected 2 relationships, got %d", len(result.Relationships))
	}

	// Verify relationships
	foundVpc1ToCluster1 := false
	foundVpc2ToCluster1 := false

	for _, rel := range result.Relationships {
		from := rel.From.(*pb.Resource)
		to := rel.To.(*pb.Resource)

		if from.Id == "vpc-1" && to.Id == "cluster-1" {
			foundVpc1ToCluster1 = true
		}
		if from.Id == "vpc-2" && to.Id == "cluster-1" {
			foundVpc2ToCluster1 = true
		}
	}

	if !foundVpc1ToCluster1 {
		t.Error("expected to find relationship from vpc-1 to cluster-1")
	}
	if !foundVpc2ToCluster1 {
		t.Error("expected to find relationship from vpc-2 to cluster-1")
	}
}

func TestRelationshipRules_GetRelationships_WithPropertyMatchers(t *testing.T) {
	ctx := context.Background()
	store := New()

	// Create test resources with matching and non-matching regions
	vpc1 := &pb.Resource{
		Id:          "vpc-1",
		Name:        "VPC 1",
		Kind:        "vpc",
		WorkspaceId: "workspace-1",
		Metadata:    map[string]string{"region": "us-east-1"},
	}
	vpc2 := &pb.Resource{
		Id:          "vpc-2",
		Name:        "VPC 2",
		Kind:        "vpc",
		WorkspaceId: "workspace-1",
		Metadata:    map[string]string{"region": "us-west-2"},
	}
	cluster1 := &pb.Resource{
		Id:          "cluster-1",
		Name:        "Cluster 1",
		Kind:        "kubernetes-cluster",
		WorkspaceId: "workspace-1",
		Metadata:    map[string]string{"region": "us-east-1"},
	}
	cluster2 := &pb.Resource{
		Id:          "cluster-2",
		Name:        "Cluster 2",
		Kind:        "kubernetes-cluster",
		WorkspaceId: "workspace-1",
		Metadata:    map[string]string{"region": "us-west-2"},
	}

	// Add resources to store
	store.Resources.Upsert(ctx, vpc1)
	store.Resources.Upsert(ctx, vpc2)
	store.Resources.Upsert(ctx, cluster1)
	store.Resources.Upsert(ctx, cluster2)

	// Create relationship rule with property matcher (same region)
	rule := &pb.RelationshipRule{
		Id:               "rule-1",
		Name:             "vpc-to-cluster-same-region",
		RelationshipType: "contains",
		FromType:         "resource",
		ToType:           "resource",
		FromSelector: pb.NewJsonSelector(mustNewStruct(t, map[string]any{
			"type":     "kind",
			"operator": "equals",
			"value":    "vpc",
		})),
		ToSelector: pb.NewJsonSelector(mustNewStruct(t, map[string]any{
			"type":     "kind",
			"operator": "equals",
			"value":    "kubernetes-cluster",
		})),
		PropertyMatchers: []*pb.PropertyMatcher{
			{
				FromProperty: []string{"metadata", "region"},
				ToProperty:   []string{"metadata", "region"},
				Operator:     "equals",
			},
		},
	}

	store.Relationships.Upsert(ctx, rule)

	// Get relationships
	result, err := store.Relationships.GetRelationships(ctx, "rule-1")
	if err != nil {
		t.Fatalf("failed to get relationships: %v", err)
	}

	// Should have only 2 relationships (matching regions)
	if len(result.Relationships) != 2 {
		t.Fatalf("expected 2 relationships, got %d", len(result.Relationships))
	}

	// Verify relationships match by region
	for _, rel := range result.Relationships {
		from := rel.From.(*pb.Resource)
		to := rel.To.(*pb.Resource)

		if from.Metadata["region"] != to.Metadata["region"] {
			t.Errorf("relationship has mismatched regions: from %s to %s",
				from.Metadata["region"], to.Metadata["region"])
		}
	}

	// Verify specific relationships exist
	foundVpc1ToCluster1 := false
	foundVpc2ToCluster2 := false

	for _, rel := range result.Relationships {
		from := rel.From.(*pb.Resource)
		to := rel.To.(*pb.Resource)

		if from.Id == "vpc-1" && to.Id == "cluster-1" {
			foundVpc1ToCluster1 = true
		}
		if from.Id == "vpc-2" && to.Id == "cluster-2" {
			foundVpc2ToCluster2 = true
		}
	}

	if !foundVpc1ToCluster1 {
		t.Error("expected to find relationship from vpc-1 to cluster-1")
	}
	if !foundVpc2ToCluster2 {
		t.Error("expected to find relationship from vpc-2 to cluster-2")
	}
}

func TestRelationshipRules_GetRelationships_CrossEntityTypes(t *testing.T) {
	ctx := context.Background()
	store := New()

	// Create a system
	system := &pb.System{
		Id:          "system-1",
		WorkspaceId: "workspace-1",
		Name:        "Production",
	}
	store.Systems.Upsert(ctx, system)

	// Create resources
	resource1 := &pb.Resource{
		Id:          "resource-1",
		Name:        "Resource 1",
		Kind:        "app",
		WorkspaceId: "workspace-1",
		Metadata:    map[string]string{"env": "production"},
	}
	store.Resources.Upsert(ctx, resource1)

	// Create deployment
	deployment1 := &pb.Deployment{
		Id:       "deployment-1",
		Name:     "Resource 1 Deployment",
		SystemId: "system-1",
	}
	store.Deployments.Upsert(ctx, deployment1)

	// Create relationship rule from resource to deployment
	// The deployment name should contain the resource name
	rule := &pb.RelationshipRule{
		Id:               "rule-1",
		Name:             "resource-to-deployment",
		RelationshipType: "deployed-by",
		FromType:         "deployment",
		ToType:           "resource",
		FromSelector:     nil, // All deployments
		ToSelector: pb.NewJsonSelector(mustNewStruct(t, map[string]any{
			"type":     "kind",
			"operator": "equals",
			"value":    "app",
		})),
		PropertyMatchers: []*pb.PropertyMatcher{
			{
				FromProperty: []string{"name"},
				ToProperty:   []string{"name"},
				Operator:     "contains",
			},
		},
	}

	store.Relationships.Upsert(ctx, rule)

	// Get relationships
	result, err := store.Relationships.GetRelationships(ctx, "rule-1")
	if err != nil {
		t.Fatalf("failed to get relationships: %v", err)
	}

	// Should have 1 relationship
	if len(result.Relationships) != 1 {
		t.Fatalf("expected 1 relationship, got %d", len(result.Relationships))
	}

	rel := result.Relationships[0]
	from := rel.From.(*pb.Deployment)
	to := rel.To.(*pb.Resource)

	if from.Id != "deployment-1" {
		t.Errorf("expected from deployment-1, got %s", from.Id)
	}
	if to.Id != "resource-1" {
		t.Errorf("expected to resource-1, got %s", to.Id)
	}
}

func TestRelationshipRules_GetRelationships_NoMatches(t *testing.T) {
	ctx := context.Background()
	store := New()

	// Create resources that don't match the selector
	resource1 := &pb.Resource{
		Id:          "resource-1",
		Name:        "Resource 1",
		Kind:        "database",
		WorkspaceId: "workspace-1",
	}
	store.Resources.Upsert(ctx, resource1)

	// Create relationship rule that won't match anything
	rule := &pb.RelationshipRule{
		Id:               "rule-1",
		Name:             "no-match",
		RelationshipType: "contains",
		FromType:         "resource",
		ToType:           "resource",
		FromSelector: pb.NewJsonSelector(mustNewStruct(t, map[string]any{
			"type":     "kind",
			"operator": "equals",
			"value":    "vpc",
		})),
		ToSelector: pb.NewJsonSelector(mustNewStruct(t, map[string]any{
			"type":     "kind",
			"operator": "equals",
			"value":    "kubernetes-cluster",
		})),
	}

	store.Relationships.Upsert(ctx, rule)

	// Get relationships
	result, err := store.Relationships.GetRelationships(ctx, "rule-1")
	if err != nil {
		t.Fatalf("failed to get relationships: %v", err)
	}

	// Should have no relationships
	if len(result.Relationships) != 0 {
		t.Fatalf("expected 0 relationships, got %d", len(result.Relationships))
	}
}

func TestRelationshipRules_GetRelationships_NotFound(t *testing.T) {
	ctx := context.Background()
	store := New()

	// Try to get relationships for non-existent rule
	_, err := store.Relationships.GetRelationships(ctx, "non-existent")
	if err == nil {
		t.Fatal("expected error for non-existent rule, got nil")
	}
}

func TestRelationshipRules_GetRelationships_MultiplePropertyMatchers(t *testing.T) {
	ctx := context.Background()
	store := New()

	// Create resources with multiple matching properties
	resource1 := &pb.Resource{
		Id:          "resource-1",
		Name:        "prod-app",
		Kind:        "app",
		WorkspaceId: "workspace-1",
		Metadata:    map[string]string{"region": "us-east-1", "env": "production"},
	}
	resource2 := &pb.Resource{
		Id:          "resource-2",
		Name:        "prod-db",
		Kind:        "database",
		WorkspaceId: "workspace-1",
		Metadata:    map[string]string{"region": "us-east-1", "env": "production"},
	}
	resource3 := &pb.Resource{
		Id:          "resource-3",
		Name:        "staging-db",
		Kind:        "database",
		WorkspaceId: "workspace-1",
		Metadata:    map[string]string{"region": "us-east-1", "env": "staging"},
	}

	store.Resources.Upsert(ctx, resource1)
	store.Resources.Upsert(ctx, resource2)
	store.Resources.Upsert(ctx, resource3)

	// Create relationship rule with multiple property matchers
	rule := &pb.RelationshipRule{
		Id:               "rule-1",
		Name:             "app-to-database",
		RelationshipType: "depends-on",
		FromType:         "resource",
		ToType:           "resource",
		FromSelector: pb.NewJsonSelector(mustNewStruct(t, map[string]any{
			"type":     "kind",
			"operator": "equals",
			"value":    "app",
		})),
		ToSelector: pb.NewJsonSelector(mustNewStruct(t, map[string]any{
			"type":     "kind",
			"operator": "equals",
			"value":    "database",
		})),
		PropertyMatchers: []*pb.PropertyMatcher{
			{
				FromProperty: []string{"metadata", "region"},
				ToProperty:   []string{"metadata", "region"},
				Operator:     "equals",
			},
			{
				FromProperty: []string{"metadata", "env"},
				ToProperty:   []string{"metadata", "env"},
				Operator:     "equals",
			},
		},
	}

	store.Relationships.Upsert(ctx, rule)

	// Get relationships
	result, err := store.Relationships.GetRelationships(ctx, "rule-1")
	if err != nil {
		t.Fatalf("failed to get relationships: %v", err)
	}

	// Should have only 1 relationship (resource1 -> resource2)
	// resource3 is excluded because env doesn't match
	if len(result.Relationships) != 1 {
		t.Fatalf("expected 1 relationship, got %d", len(result.Relationships))
	}

	rel := result.Relationships[0]
	from := rel.From.(*pb.Resource)
	to := rel.To.(*pb.Resource)

	if from.Id != "resource-1" {
		t.Errorf("expected from resource-1, got %s", from.Id)
	}
	if to.Id != "resource-2" {
		t.Errorf("expected to resource-2, got %s", to.Id)
	}
}

