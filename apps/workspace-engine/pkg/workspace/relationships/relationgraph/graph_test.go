package relationgraph

import (
	"testing"
	"time"

	"workspace-engine/pkg/oapi"
)

// TestNewGraph tests creating a new graph
func TestNewGraph(t *testing.T) {
	graph := NewGraph()

	if graph == nil {
		t.Fatal("NewGraph returned nil")
	}

	if graph.entityRelations == nil {
		t.Error("entityRelations map should be initialized")
	}

	if graph.buildTime.IsZero() {
		t.Error("buildTime should be set")
	}

	if graph.entityCount != 0 {
		t.Errorf("expected entityCount 0, got %d", graph.entityCount)
	}

	if graph.ruleCount != 0 {
		t.Errorf("expected ruleCount 0, got %d", graph.ruleCount)
	}

	if graph.relationCount != 0 {
		t.Errorf("expected relationCount 0, got %d", graph.relationCount)
	}
}

// TestGraph_AddRelation tests adding relations to the graph
func TestGraph_AddRelation(t *testing.T) {
	graph := NewGraph()

	rule := &oapi.RelationshipRule{
		Reference: "test-rule",
		FromType:  oapi.RelatableEntityTypeResource,
		ToType:    oapi.RelatableEntityTypeDeployment,
	}

	relation := &oapi.EntityRelation{
		Rule:       rule,
		Direction:  oapi.To,
		EntityType: oapi.RelatableEntityTypeDeployment,
		EntityId:   "deployment-1",
	}

	graph.addRelation("resource-1", "test-rule", relation)

	if graph.relationCount != 1 {
		t.Errorf("expected relationCount 1, got %d", graph.relationCount)
	}

	relations := graph.GetRelatedEntities("resource-1")
	if len(relations) != 1 {
		t.Errorf("expected 1 relation map, got %d", len(relations))
	}

	ruleRelations, ok := relations["test-rule"]
	if !ok {
		t.Fatal("expected relations for 'test-rule'")
	}

	if len(ruleRelations) != 1 {
		t.Errorf("expected 1 relation, got %d", len(ruleRelations))
	}

	if ruleRelations[0].EntityId != "deployment-1" {
		t.Errorf("expected EntityId 'deployment-1', got %s", ruleRelations[0].EntityId)
	}
}

// TestGraph_GetRelatedEntities tests getting related entities for a single entity
func TestGraph_GetRelatedEntities(t *testing.T) {
	graph := NewGraph()

	rule := &oapi.RelationshipRule{
		Reference: "test-rule",
		FromType:  oapi.RelatableEntityTypeResource,
		ToType:    oapi.RelatableEntityTypeDeployment,
	}

	// Add multiple relations
	graph.addRelation("resource-1", "test-rule", &oapi.EntityRelation{
		Rule:       rule,
		Direction:  oapi.To,
		EntityType: oapi.RelatableEntityTypeDeployment,
		EntityId:   "deployment-1",
	})

	graph.addRelation("resource-1", "test-rule", &oapi.EntityRelation{
		Rule:       rule,
		Direction:  oapi.To,
		EntityType: oapi.RelatableEntityTypeDeployment,
		EntityId:   "deployment-2",
	})

	graph.addRelation("resource-1", "another-rule", &oapi.EntityRelation{
		Rule:       rule,
		Direction:  oapi.To,
		EntityType: oapi.RelatableEntityTypeEnvironment,
		EntityId:   "env-1",
	})

	// Test getting relations
	relations := graph.GetRelatedEntities("resource-1")

	if len(relations) != 2 {
		t.Errorf("expected 2 rule references, got %d", len(relations))
	}

	testRuleRelations := relations["test-rule"]
	if len(testRuleRelations) != 2 {
		t.Errorf("expected 2 relations for 'test-rule', got %d", len(testRuleRelations))
	}

	anotherRuleRelations := relations["another-rule"]
	if len(anotherRuleRelations) != 1 {
		t.Errorf("expected 1 relation for 'another-rule', got %d", len(anotherRuleRelations))
	}
}

// TestGraph_GetRelatedEntities_Empty tests getting relations for non-existent entity
func TestGraph_GetRelatedEntities_Empty(t *testing.T) {
	graph := NewGraph()

	relations := graph.GetRelatedEntities("nonexistent-entity")

	if relations == nil {
		t.Error("expected empty map, got nil")
	}

	if len(relations) != 0 {
		t.Errorf("expected empty map, got %d relations", len(relations))
	}
}

// TestGraph_GetRelatedEntitiesBatch tests batch retrieval of related entities
func TestGraph_GetRelatedEntitiesBatch(t *testing.T) {
	graph := NewGraph()

	rule := &oapi.RelationshipRule{
		Reference: "test-rule",
		FromType:  oapi.RelatableEntityTypeResource,
		ToType:    oapi.RelatableEntityTypeDeployment,
	}

	// Add relations for multiple entities
	graph.addRelation("resource-1", "test-rule", &oapi.EntityRelation{
		Rule:       rule,
		Direction:  oapi.To,
		EntityType: oapi.RelatableEntityTypeDeployment,
		EntityId:   "deployment-1",
	})

	graph.addRelation("resource-2", "test-rule", &oapi.EntityRelation{
		Rule:       rule,
		Direction:  oapi.To,
		EntityType: oapi.RelatableEntityTypeDeployment,
		EntityId:   "deployment-2",
	})

	// Test batch retrieval
	entityIDs := []string{"resource-1", "resource-2", "resource-3"}
	results := graph.GetRelatedEntitiesBatch(entityIDs)

	if len(results) != 3 {
		t.Errorf("expected 3 results, got %d", len(results))
	}

	// Check resource-1
	if len(results["resource-1"]) == 0 {
		t.Error("expected relations for resource-1")
	}

	// Check resource-2
	if len(results["resource-2"]) == 0 {
		t.Error("expected relations for resource-2")
	}

	// Check resource-3 (doesn't exist)
	if len(results["resource-3"]) != 0 {
		t.Error("expected empty map for resource-3")
	}
}

// TestGraph_GetRelatedEntitiesBatch_Empty tests batch retrieval with empty input
func TestGraph_GetRelatedEntitiesBatch_Empty(t *testing.T) {
	graph := NewGraph()

	results := graph.GetRelatedEntitiesBatch([]string{})

	if results == nil {
		t.Error("expected empty map, got nil")
	}

	if len(results) != 0 {
		t.Errorf("expected empty map, got %d results", len(results))
	}
}

// TestGraph_GetRelationsByReference tests getting relations by reference
func TestGraph_GetRelationsByReference(t *testing.T) {
	graph := NewGraph()

	rule := &oapi.RelationshipRule{
		Reference: "test-rule",
		FromType:  oapi.RelatableEntityTypeResource,
		ToType:    oapi.RelatableEntityTypeDeployment,
	}

	// Add relations with same reference for different entities
	graph.addRelation("resource-1", "test-rule", &oapi.EntityRelation{
		Rule:       rule,
		Direction:  oapi.To,
		EntityType: oapi.RelatableEntityTypeDeployment,
		EntityId:   "deployment-1",
	})

	graph.addRelation("resource-2", "test-rule", &oapi.EntityRelation{
		Rule:       rule,
		Direction:  oapi.To,
		EntityType: oapi.RelatableEntityTypeDeployment,
		EntityId:   "deployment-2",
	})

	graph.addRelation("resource-1", "another-rule", &oapi.EntityRelation{
		Rule:       rule,
		Direction:  oapi.To,
		EntityType: oapi.RelatableEntityTypeEnvironment,
		EntityId:   "env-1",
	})

	// Test getting relations by reference
	results := graph.GetRelationsByReference("test-rule")

	if len(results) != 2 {
		t.Errorf("expected 2 entities with 'test-rule', got %d", len(results))
	}

	if _, ok := results["resource-1"]; !ok {
		t.Error("expected resource-1 in results")
	}

	if _, ok := results["resource-2"]; !ok {
		t.Error("expected resource-2 in results")
	}

	// Test non-existent reference
	emptyResults := graph.GetRelationsByReference("nonexistent-rule")
	if len(emptyResults) != 0 {
		t.Errorf("expected empty results for nonexistent rule, got %d", len(emptyResults))
	}
}

// TestGraph_HasRelationships tests checking if entity has relationships
func TestGraph_HasRelationships(t *testing.T) {
	graph := NewGraph()

	rule := &oapi.RelationshipRule{
		Reference: "test-rule",
		FromType:  oapi.RelatableEntityTypeResource,
		ToType:    oapi.RelatableEntityTypeDeployment,
	}

	// Add relation for one entity
	graph.addRelation("resource-1", "test-rule", &oapi.EntityRelation{
		Rule:       rule,
		Direction:  oapi.To,
		EntityType: oapi.RelatableEntityTypeDeployment,
		EntityId:   "deployment-1",
	})

	tests := []struct {
		name     string
		entityID string
		expected bool
	}{
		{
			name:     "entity with relationships",
			entityID: "resource-1",
			expected: true,
		},
		{
			name:     "entity without relationships",
			entityID: "resource-2",
			expected: false,
		},
		{
			name:     "nonexistent entity",
			entityID: "nonexistent",
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := graph.HasRelationships(tt.entityID)
			if result != tt.expected {
				t.Errorf("expected %v, got %v", tt.expected, result)
			}
		})
	}
}

// TestGraph_IsStale tests checking if graph is stale
func TestGraph_IsStale(t *testing.T) {
	tests := []struct {
		name      string
		buildTime time.Time
		ttl       time.Duration
		expected  bool
	}{
		{
			name:      "fresh graph",
			buildTime: time.Now(),
			ttl:       5 * time.Minute,
			expected:  false,
		},
		{
			name:      "stale graph",
			buildTime: time.Now().Add(-10 * time.Minute),
			ttl:       5 * time.Minute,
			expected:  true,
		},
		{
			name:      "graph at ttl boundary",
			buildTime: time.Now().Add(-5 * time.Minute),
			ttl:       5 * time.Minute,
			expected:  true,
		},
		{
			name:      "zero ttl",
			buildTime: time.Now(),
			ttl:       0,
			expected:  true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			graph := &Graph{
				entityRelations: make(map[string]map[string][]*oapi.EntityRelation),
				buildTime:       tt.buildTime,
			}

			result := graph.IsStale(tt.ttl)
			if result != tt.expected {
				t.Errorf("expected %v, got %v", tt.expected, result)
			}
		})
	}
}

// TestGraph_GetStats tests getting graph statistics
func TestGraph_GetStats(t *testing.T) {
	graph := NewGraph()
	graph.entityCount = 100
	graph.ruleCount = 5
	graph.relationCount = 250

	// Wait a bit to ensure age is non-zero
	time.Sleep(10 * time.Millisecond)

	stats := graph.GetStats()

	if stats.EntityCount != 100 {
		t.Errorf("expected EntityCount 100, got %d", stats.EntityCount)
	}

	if stats.RuleCount != 5 {
		t.Errorf("expected RuleCount 5, got %d", stats.RuleCount)
	}

	if stats.RelationCount != 250 {
		t.Errorf("expected RelationCount 250, got %d", stats.RelationCount)
	}

	if stats.BuildTime.IsZero() {
		t.Error("expected BuildTime to be set")
	}

	if stats.Age == 0 {
		t.Error("expected Age to be greater than 0")
	}

	if stats.Age < 0 {
		t.Error("expected Age to be positive")
	}
}

// TestGraph_Concurrency tests concurrent access to graph
func TestGraph_Concurrency(t *testing.T) {
	graph := NewGraph()

	rule := &oapi.RelationshipRule{
		Reference: "test-rule",
		FromType:  oapi.RelatableEntityTypeResource,
		ToType:    oapi.RelatableEntityTypeDeployment,
	}

	// Add initial relation
	graph.addRelation("resource-1", "test-rule", &oapi.EntityRelation{
		Rule:       rule,
		Direction:  oapi.To,
		EntityType: oapi.RelatableEntityTypeDeployment,
		EntityId:   "deployment-1",
	})

	// Test concurrent reads
	done := make(chan bool)
	for i := 0; i < 10; i++ {
		go func() {
			relations := graph.GetRelatedEntities("resource-1")
			if len(relations) == 0 {
				t.Error("expected relations")
			}
			done <- true
		}()
	}

	for i := 0; i < 10; i++ {
		<-done
	}
}

// TestGraph_GetRelatedEntities_ImmutableReturn tests that returned data cannot mutate graph
func TestGraph_GetRelatedEntities_ImmutableReturn(t *testing.T) {
	graph := NewGraph()

	rule := &oapi.RelationshipRule{
		Reference: "test-rule",
		FromType:  oapi.RelatableEntityTypeResource,
		ToType:    oapi.RelatableEntityTypeDeployment,
	}

	graph.addRelation("resource-1", "test-rule", &oapi.EntityRelation{
		Rule:       rule,
		Direction:  oapi.To,
		EntityType: oapi.RelatableEntityTypeDeployment,
		EntityId:   "deployment-1",
	})

	// Get relations
	relations1 := graph.GetRelatedEntities("resource-1")

	// Modify the returned map
	delete(relations1, "test-rule")

	// Get relations again
	relations2 := graph.GetRelatedEntities("resource-1")

	// Should still have the relation
	if len(relations2) != 1 {
		t.Errorf("expected 1 relation, got %d - graph was mutated", len(relations2))
	}

	if _, ok := relations2["test-rule"]; !ok {
		t.Error("expected 'test-rule' to still exist - graph was mutated")
	}
}

