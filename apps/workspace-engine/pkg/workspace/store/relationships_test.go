package store

import (
	"context"
	"testing"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/statechange"
	"workspace-engine/pkg/workspace/relationships"

	"github.com/google/uuid"
)

// setupTestStoreForRelationships creates a test store with basic setup
func setupTestStoreForRelationships(t *testing.T) *Store {
	t.Helper()
	cs := statechange.NewChangeSet[any]()
	return New("test-workspace", cs)
}

// TestGetRelatedEntities_DirectionFiltering tests that Direction field correctly indicates relationship direction
func TestGetRelatedEntities_DirectionFiltering(t *testing.T) {
	store := setupTestStoreForRelationships(t)
	ctx := context.Background()

	vpcID := uuid.New().String()
	clusterID := uuid.New().String()

	// Create relationship rule: VPC (from) -> Cluster (to)
	fromSelector := &oapi.Selector{}
	_ = fromSelector.FromJsonSelector(oapi.JsonSelector{
		Json: map[string]any{
			"type":     "kind",
			"operator": "equals",
			"value":    "vpc",
		},
	})

	toSelector := &oapi.Selector{}
	_ = toSelector.FromJsonSelector(oapi.JsonSelector{
		Json: map[string]any{
			"type":     "kind",
			"operator": "equals",
			"value":    "kubernetes-cluster",
		},
	})

	matcher := &oapi.RelationshipRule_Matcher{}
	_ = matcher.FromPropertiesMatcher(oapi.PropertiesMatcher{
		Properties: []oapi.PropertyMatcher{
			{
				FromProperty: []string{"metadata", "region"},
				ToProperty:   []string{"metadata", "region"},
				Operator:     oapi.Equals,
			},
		},
	})

	rule := &oapi.RelationshipRule{
		Id:           uuid.New().String(),
		Reference:    "vpc",
		FromType:     "resource",
		ToType:       "resource",
		FromSelector: fromSelector,
		ToSelector:   toSelector,
		Matcher:      *matcher,
	}
	_ = store.Relationships.Upsert(ctx, rule)

	// Create VPC and Cluster resources
	vpc := &oapi.Resource{
		Id:   vpcID,
		Name: "vpc-main",
		Kind: "vpc",
		Metadata: map[string]string{
			"region": "us-east-1",
		},
	}
	cluster := &oapi.Resource{
		Id:   clusterID,
		Name: "cluster-main",
		Kind: "kubernetes-cluster",
		Metadata: map[string]string{
			"region": "us-east-1",
		},
	}
	_, _ = store.Resources.Upsert(ctx, vpc)
	_, _ = store.Resources.Upsert(ctx, cluster)

	// Test FROM VPC perspective - VPC points TO cluster
	// Relationship direction from VPC should be "to"
	vpcEntity := relationships.NewResourceEntity(vpc)
	vpcRelations, err := store.Relationships.GetRelatedEntities(ctx, vpcEntity)
	if err != nil {
		t.Fatalf("GetRelatedEntities failed for VPC: %v", err)
	}

	if len(vpcRelations["vpc"]) == 0 {
		t.Fatalf("VPC has no related entities")
	}

	if vpcRelations["vpc"][0].Direction != oapi.To {
		t.Errorf("VPC relationship direction = %v, want 'to'", vpcRelations["vpc"][0].Direction)
	}

	if vpcRelations["vpc"][0].EntityId != clusterID {
		t.Errorf("VPC related entity ID = %s, want %s", vpcRelations["vpc"][0].EntityId, clusterID)
	}

	// Test FROM Cluster perspective - Cluster is pointed TO by VPC
	// Relationship direction from Cluster should be "from"
	clusterEntity := relationships.NewResourceEntity(cluster)
	clusterRelations, err := store.Relationships.GetRelatedEntities(ctx, clusterEntity)
	if err != nil {
		t.Fatalf("GetRelatedEntities failed for Cluster: %v", err)
	}

	if len(clusterRelations["vpc"]) == 0 {
		t.Fatalf("Cluster has no related entities")
	}

	if clusterRelations["vpc"][0].Direction != oapi.From {
		t.Errorf("Cluster relationship direction = %v, want 'from'", clusterRelations["vpc"][0].Direction)
	}

	if clusterRelations["vpc"][0].EntityId != vpcID {
		t.Errorf("Cluster related entity ID = %s, want %s", clusterRelations["vpc"][0].EntityId, vpcID)
	}
}

// TestGetRelatedEntities_EmptyResults tests behavior when no relationships match
func TestGetRelatedEntities_EmptyResults(t *testing.T) {
	store := setupTestStoreForRelationships(t)
	ctx := context.Background()

	// Create resource without any relationship rules
	resource := &oapi.Resource{
		Id:   uuid.New().String(),
		Name: "standalone-resource",
		Kind: "server",
	}
	_, _ = store.Resources.Upsert(ctx, resource)

	entity := relationships.NewResourceEntity(resource)
	relatedEntities, err := store.Relationships.GetRelatedEntities(ctx, entity)

	// Should return empty map, not error
	if err != nil {
		t.Errorf("GetRelatedEntities returned error for no matches: %v", err)
	}

	if relatedEntities == nil {
		t.Fatalf("relatedEntities should not be nil")
	}

	if len(relatedEntities) != 0 {
		t.Errorf("expected empty map, got %d relationships", len(relatedEntities))
	}
}

// TestGetRelatedEntities_MultipleEntitiesPerReference tests multiple entities under same reference
func TestGetRelatedEntities_MultipleEntitiesPerReference(t *testing.T) {
	store := setupTestStoreForRelationships(t)
	ctx := context.Background()

	vpcID := uuid.New().String()
	cluster1ID := uuid.New().String()
	cluster2ID := uuid.New().String()
	cluster3ID := uuid.New().String()

	// Create relationship rule: VPC -> Clusters
	fromSelector := &oapi.Selector{}
	_ = fromSelector.FromJsonSelector(oapi.JsonSelector{
		Json: map[string]any{
			"type":     "kind",
			"operator": "equals",
			"value":    "vpc",
		},
	})

	toSelector := &oapi.Selector{}
	_ = toSelector.FromJsonSelector(oapi.JsonSelector{
		Json: map[string]any{
			"type":     "kind",
			"operator": "equals",
			"value":    "kubernetes-cluster",
		},
	})

	matcher := &oapi.RelationshipRule_Matcher{}
	_ = matcher.FromPropertiesMatcher(oapi.PropertiesMatcher{
		Properties: []oapi.PropertyMatcher{
			{
				FromProperty: []string{"metadata", "region"},
				ToProperty:   []string{"metadata", "region"},
				Operator:     oapi.Equals,
			},
		},
	})

	rule := &oapi.RelationshipRule{
		Id:           uuid.New().String(),
		Reference:    "contains",
		FromType:     "resource",
		ToType:       "resource",
		FromSelector: fromSelector,
		ToSelector:   toSelector,
		Matcher:      *matcher,
	}
	_ = store.Relationships.Upsert(ctx, rule)

	// Create 1 VPC and 3 Clusters in same region
	vpc := &oapi.Resource{
		Id:   vpcID,
		Name: "vpc-main",
		Kind: "vpc",
		Metadata: map[string]string{
			"region": "us-east-1",
		},
	}
	cluster1 := &oapi.Resource{
		Id:   cluster1ID,
		Name: "cluster-1",
		Kind: "kubernetes-cluster",
		Metadata: map[string]string{
			"region": "us-east-1",
		},
	}
	cluster2 := &oapi.Resource{
		Id:   cluster2ID,
		Name: "cluster-2",
		Kind: "kubernetes-cluster",
		Metadata: map[string]string{
			"region": "us-east-1",
		},
	}
	cluster3 := &oapi.Resource{
		Id:   cluster3ID,
		Name: "cluster-3",
		Kind: "kubernetes-cluster",
		Metadata: map[string]string{
			"region": "us-east-1",
		},
	}

	_, _ = store.Resources.Upsert(ctx, vpc)
	_, _ = store.Resources.Upsert(ctx, cluster1)
	_, _ = store.Resources.Upsert(ctx, cluster2)
	_, _ = store.Resources.Upsert(ctx, cluster3)

	// Get related entities from VPC
	vpcEntity := relationships.NewResourceEntity(vpc)
	relatedEntities, err := store.Relationships.GetRelatedEntities(ctx, vpcEntity)
	if err != nil {
		t.Fatalf("GetRelatedEntities failed: %v", err)
	}

	// Should have exactly one reference with 3 entities
	if len(relatedEntities) != 1 {
		t.Errorf("expected 1 relationship reference, got %d", len(relatedEntities))
	}

	clusters, ok := relatedEntities["contains"]
	if !ok {
		t.Fatalf("'contains' relationship not found")
	}

	if len(clusters) != 3 {
		t.Fatalf("expected 3 related clusters, got %d", len(clusters))
	}

	// Verify all clusters are present
	clusterIDs := make(map[string]bool)
	for _, cluster := range clusters {
		if cluster.Direction != oapi.To {
			t.Errorf("cluster direction = %v, want 'to'", cluster.Direction)
		}
		clusterIDs[cluster.EntityId] = true
	}

	if !clusterIDs[cluster1ID] || !clusterIDs[cluster2ID] || !clusterIDs[cluster3ID] {
		t.Errorf("not all clusters found in related entities")
	}
}

// TestGetRelatedEntities_NoMatchingEntities tests when relationship rule exists but no entities match
func TestGetRelatedEntities_NoMatchingEntities(t *testing.T) {
	store := setupTestStoreForRelationships(t)
	ctx := context.Background()

	// Create relationship rule: VPC -> Cluster (matching region)
	fromSelector := &oapi.Selector{}
	_ = fromSelector.FromJsonSelector(oapi.JsonSelector{
		Json: map[string]any{
			"type":     "kind",
			"operator": "equals",
			"value":    "vpc",
		},
	})

	toSelector := &oapi.Selector{}
	_ = toSelector.FromJsonSelector(oapi.JsonSelector{
		Json: map[string]any{
			"type":     "kind",
			"operator": "equals",
			"value":    "kubernetes-cluster",
		},
	})

	matcher := &oapi.RelationshipRule_Matcher{}
	_ = matcher.FromPropertiesMatcher(oapi.PropertiesMatcher{
		Properties: []oapi.PropertyMatcher{
			{
				FromProperty: []string{"metadata", "region"},
				ToProperty:   []string{"metadata", "region"},
				Operator:     oapi.Equals,
			},
		},
	})

	rule := &oapi.RelationshipRule{
		Id:           uuid.New().String(),
		Reference:    "vpc",
		FromType:     "resource",
		ToType:       "resource",
		FromSelector: fromSelector,
		ToSelector:   toSelector,
		Matcher:      *matcher,
	}
	_ = store.Relationships.Upsert(ctx, rule)

	// Create VPC in us-east-1 and Cluster in us-west-2 (different regions)
	vpc := &oapi.Resource{
		Id:   uuid.New().String(),
		Name: "vpc-east",
		Kind: "vpc",
		Metadata: map[string]string{
			"region": "us-east-1",
		},
	}
	cluster := &oapi.Resource{
		Id:   uuid.New().String(),
		Name: "cluster-west",
		Kind: "kubernetes-cluster",
		Metadata: map[string]string{
			"region": "us-west-2", // Different region - won't match
		},
	}

	_, _ = store.Resources.Upsert(ctx, vpc)
	_, _ = store.Resources.Upsert(ctx, cluster)

	// Get related entities from VPC
	vpcEntity := relationships.NewResourceEntity(vpc)
	relatedEntities, err := store.Relationships.GetRelatedEntities(ctx, vpcEntity)
	if err != nil {
		t.Fatalf("GetRelatedEntities failed: %v", err)
	}

	// Should have empty slice for the reference (no matching clusters)
	clusters, ok := relatedEntities["vpc"]
	if ok && len(clusters) > 0 {
		t.Errorf("expected no matching clusters, got %d", len(clusters))
	}
}

// TestGetRelatedEntities_ReverseRelationshipLookup tests finding entities that point TO a resource
func TestGetRelatedEntities_ReverseRelationshipLookup(t *testing.T) {
	store := setupTestStoreForRelationships(t)
	ctx := context.Background()

	vpcID := uuid.New().String()
	cluster1ID := uuid.New().String()
	cluster2ID := uuid.New().String()

	// Create relationship rule: Cluster (from) -> VPC (to)
	fromSelector := &oapi.Selector{}
	_ = fromSelector.FromJsonSelector(oapi.JsonSelector{
		Json: map[string]any{
			"type":     "kind",
			"operator": "equals",
			"value":    "kubernetes-cluster",
		},
	})

	toSelector := &oapi.Selector{}
	_ = toSelector.FromJsonSelector(oapi.JsonSelector{
		Json: map[string]any{
			"type":     "kind",
			"operator": "equals",
			"value":    "vpc",
		},
	})

	matcher := &oapi.RelationshipRule_Matcher{}
	_ = matcher.FromPropertiesMatcher(oapi.PropertiesMatcher{
		Properties: []oapi.PropertyMatcher{
			{
				FromProperty: []string{"metadata", "vpc_id"},
				ToProperty:   []string{"id"},
				Operator:     oapi.Equals,
			},
		},
	})

	rule := &oapi.RelationshipRule{
		Id:           uuid.New().String(),
		Reference:    "vpc",
		FromType:     "resource",
		ToType:       "resource",
		FromSelector: fromSelector,
		ToSelector:   toSelector,
		Matcher:      *matcher,
	}
	_ = store.Relationships.Upsert(ctx, rule)

	// Create VPC and 2 Clusters that reference it
	vpc := &oapi.Resource{
		Id:   vpcID,
		Name: "vpc-main",
		Kind: "vpc",
	}
	cluster1 := &oapi.Resource{
		Id:   cluster1ID,
		Name: "cluster-1",
		Kind: "kubernetes-cluster",
		Metadata: map[string]string{
			"vpc_id": vpcID,
		},
	}
	cluster2 := &oapi.Resource{
		Id:   cluster2ID,
		Name: "cluster-2",
		Kind: "kubernetes-cluster",
		Metadata: map[string]string{
			"vpc_id": vpcID,
		},
	}

	_, _ = store.Resources.Upsert(ctx, vpc)
	_, _ = store.Resources.Upsert(ctx, cluster1)
	_, _ = store.Resources.Upsert(ctx, cluster2)

	// Get related entities FROM VPC (reverse lookup - who points TO me?)
	vpcEntity := relationships.NewResourceEntity(vpc)
	vpcRelations, err := store.Relationships.GetRelatedEntities(ctx, vpcEntity)
	if err != nil {
		t.Fatalf("GetRelatedEntities failed for VPC: %v", err)
	}

	// VPC should find 2 clusters that point to it
	clusters, ok := vpcRelations["vpc"]
	if !ok {
		t.Fatalf("'vpc' relationship not found")
	}

	if len(clusters) != 2 {
		t.Fatalf("expected 2 clusters pointing to VPC, got %d", len(clusters))
	}

	// All should have Direction = "from" (these entities point FROM them TO vpc)
	for _, cluster := range clusters {
		if cluster.Direction != oapi.From {
			t.Errorf("cluster direction = %v, want 'from' (reverse relationship)", cluster.Direction)
		}
		if cluster.EntityType != "resource" {
			t.Errorf("cluster entity type = %v, want 'resource'", cluster.EntityType)
		}
	}

	// Verify both cluster IDs are present
	clusterIDs := make(map[string]bool)
	for _, cluster := range clusters {
		clusterIDs[cluster.EntityId] = true
	}

	if !clusterIDs[cluster1ID] || !clusterIDs[cluster2ID] {
		t.Errorf("not all clusters found in reverse relationship lookup")
	}
}

// TestGetRelatedEntities_MultipleReferences tests entity with multiple different relationship references
func TestGetRelatedEntities_MultipleReferences(t *testing.T) {
	store := setupTestStoreForRelationships(t)
	ctx := context.Background()

	resourceID := uuid.New().String()
	vpcID := uuid.New().String()
	dbID := uuid.New().String()

	// Create two relationship rules with different references
	// Rule 1: Cluster -> VPC (reference: "vpc")
	rule1 := createSimpleRelationshipRule("vpc", "kubernetes-cluster", "vpc")
	_ = store.Relationships.Upsert(ctx, rule1)

	// Rule 2: Cluster -> Database (reference: "database")
	rule2 := createSimpleRelationshipRule("database", "kubernetes-cluster", "database")
	_ = store.Relationships.Upsert(ctx, rule2)

	// Create resources
	cluster := &oapi.Resource{
		Id:   resourceID,
		Name: "cluster-main",
		Kind: "kubernetes-cluster",
	}
	vpc := &oapi.Resource{
		Id:   vpcID,
		Name: "vpc-main",
		Kind: "vpc",
	}
	db := &oapi.Resource{
		Id:   dbID,
		Name: "db-main",
		Kind: "database",
	}

	_, _ = store.Resources.Upsert(ctx, cluster)
	_, _ = store.Resources.Upsert(ctx, vpc)
	_, _ = store.Resources.Upsert(ctx, db)

	// Get related entities from cluster
	clusterEntity := relationships.NewResourceEntity(cluster)
	relatedEntities, err := store.Relationships.GetRelatedEntities(ctx, clusterEntity)
	if err != nil {
		t.Fatalf("GetRelatedEntities failed: %v", err)
	}

	// Should have 2 different references
	if len(relatedEntities) != 2 {
		t.Fatalf("expected 2 relationship references, got %d", len(relatedEntities))
	}

	// Check vpc reference
	vpcs, ok := relatedEntities["vpc"]
	if !ok {
		t.Errorf("'vpc' reference not found")
	} else if len(vpcs) != 1 {
		t.Errorf("expected 1 VPC, got %d", len(vpcs))
	}

	// Check database reference
	databases, ok := relatedEntities["database"]
	if !ok {
		t.Errorf("'database' reference not found")
	} else if len(databases) != 1 {
		t.Errorf("expected 1 database, got %d", len(databases))
	}
}

// Helper function to create a basic relationship rule (simplified version)
func createSimpleRelationshipRule(reference, fromKind, toKind string) *oapi.RelationshipRule {
	fromSelector := &oapi.Selector{}
	_ = fromSelector.FromJsonSelector(oapi.JsonSelector{
		Json: map[string]any{
			"type":     "kind",
			"operator": "equals",
			"value":    fromKind,
		},
	})

	toSelector := &oapi.Selector{}
	_ = toSelector.FromJsonSelector(oapi.JsonSelector{
		Json: map[string]any{
			"type":     "kind",
			"operator": "equals",
			"value":    toKind,
		},
	})

	matcher := &oapi.RelationshipRule_Matcher{}
	_ = matcher.FromPropertiesMatcher(oapi.PropertiesMatcher{
		Properties: []oapi.PropertyMatcher{},
	})

	return &oapi.RelationshipRule{
		Id:           uuid.New().String(),
		Reference:    reference,
		FromType:     "resource",
		ToType:       "resource",
		FromSelector: fromSelector,
		ToSelector:   toSelector,
		Matcher:      *matcher,
	}
}
