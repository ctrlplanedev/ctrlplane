package relationgraph

import (
	"context"
	"fmt"
	"testing"
	"time"

	"workspace-engine/pkg/oapi"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// testEntityProvider implements EntityProvider for testing
type testEntityProvider struct {
	resources    map[string]*oapi.Resource
	deployments  map[string]*oapi.Deployment
	environments map[string]*oapi.Environment
	rules        map[string]*oapi.RelationshipRule
}

func (t *testEntityProvider) GetResources() map[string]*oapi.Resource {
	if t.resources == nil {
		return make(map[string]*oapi.Resource)
	}
	return t.resources
}

func (t *testEntityProvider) GetDeployments() map[string]*oapi.Deployment {
	if t.deployments == nil {
		return make(map[string]*oapi.Deployment)
	}
	return t.deployments
}

func (t *testEntityProvider) GetEnvironments() map[string]*oapi.Environment {
	if t.environments == nil {
		return make(map[string]*oapi.Environment)
	}
	return t.environments
}

func (t *testEntityProvider) GetRelationshipRules() map[string]*oapi.RelationshipRule {
	if t.rules == nil {
		return make(map[string]*oapi.RelationshipRule)
	}
	return t.rules
}

func (t *testEntityProvider) GetRelationshipRule(reference string) (*oapi.RelationshipRule, bool) {
	if t.rules == nil {
		return nil, false
	}
	rule, ok := t.rules[reference]
	return rule, ok
}

// Helper function to create a test provider
func newTestProvider(
	resources map[string]*oapi.Resource,
	deployments map[string]*oapi.Deployment,
	environments map[string]*oapi.Environment,
	rules map[string]*oapi.RelationshipRule,
) *testEntityProvider {
	return &testEntityProvider{
		resources:    resources,
		deployments:  deployments,
		environments: environments,
		rules:        rules,
	}
}

// TestNewGraph tests creating a new graph
func TestNewGraph(t *testing.T) {
	provider := newTestProvider(nil, nil, nil, nil)
	graph := NewGraph(provider)

	require.NotNil(t, graph, "NewGraph should not return nil")
	require.NotNil(t, graph.cache, "cache should be initialized")
	require.NotNil(t, graph.entityStore, "entityStore should be initialized")
	require.NotNil(t, graph.engine, "engine should be initialized")
	assert.False(t, graph.buildTime.IsZero(), "buildTime should be set")

	stats := graph.GetStats()
	assert.Equal(t, 0, stats.EntityCount, "EntityCount should be 0")
	assert.Equal(t, 0, stats.RuleCount, "RuleCount should be 0")
	assert.Equal(t, 0, stats.RelationCount, "RelationCount should be 0")
}

// TestGraph_AddRelation tests adding relations to the graph
func TestGraph_AddRelation(t *testing.T) {
	provider := newTestProvider(nil, nil, nil, nil)
	graph := NewGraph(provider)

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

	stats := graph.GetStats()
	assert.Equal(t, 1, stats.RelationCount, "Should have 1 relation")

	relations := graph.GetRelatedEntities("resource-1")
	assert.Len(t, relations, 1, "Should have 1 rule reference")

	ruleRelations, ok := relations["test-rule"]
	require.True(t, ok, "Should have relations for 'test-rule'")
	assert.Len(t, ruleRelations, 1, "Should have 1 relation for rule")
	assert.Equal(t, "deployment-1", ruleRelations[0].EntityId, "Should relate to deployment-1")
}

// TestGraph_GetRelatedEntities tests getting related entities for a single entity
func TestGraph_GetRelatedEntities(t *testing.T) {
	provider := newTestProvider(nil, nil, nil, nil)
	graph := NewGraph(provider)

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

	assert.Len(t, relations, 2, "Should have 2 rule references")
	assert.Len(t, relations["test-rule"], 2, "Should have 2 relations for 'test-rule'")
	assert.Len(t, relations["another-rule"], 1, "Should have 1 relation for 'another-rule'")
}

// TestGraph_GetRelatedEntities_Empty tests getting relations for non-existent entity
func TestGraph_GetRelatedEntities_Empty(t *testing.T) {
	provider := newTestProvider(nil, nil, nil, nil)
	graph := NewGraph(provider)

	relations := graph.GetRelatedEntities("nonexistent-entity")

	assert.NotNil(t, relations, "Should return empty map, not nil")
	assert.Empty(t, relations, "Should have no relations")
}

// TestGraph_GetRelatedEntitiesBatch tests batch retrieval of related entities
func TestGraph_GetRelatedEntitiesBatch(t *testing.T) {
	provider := newTestProvider(nil, nil, nil, nil)
	graph := NewGraph(provider)

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

	assert.Len(t, results, 3, "Should have 3 results")
	assert.NotEmpty(t, results["resource-1"], "Should have relations for resource-1")
	assert.NotEmpty(t, results["resource-2"], "Should have relations for resource-2")
	assert.Empty(t, results["resource-3"], "Should have no relations for resource-3")
}

// TestGraph_GetRelatedEntitiesBatch_Empty tests batch retrieval with empty input
func TestGraph_GetRelatedEntitiesBatch_Empty(t *testing.T) {
	provider := newTestProvider(nil, nil, nil, nil)
	graph := NewGraph(provider)

	results := graph.GetRelatedEntitiesBatch([]string{})

	assert.NotNil(t, results, "Should return empty map, not nil")
	assert.Empty(t, results, "Should have no results")
}

// TestGraph_GetRelationsByReference tests getting relations by reference
func TestGraph_GetRelationsByReference(t *testing.T) {
	provider := newTestProvider(nil, nil, nil, nil)
	graph := NewGraph(provider)

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

	assert.Len(t, results, 2, "Should have 2 entities with 'test-rule'")
	assert.Contains(t, results, "resource-1", "Should include resource-1")
	assert.Contains(t, results, "resource-2", "Should include resource-2")

	// Test non-existent reference
	emptyResults := graph.GetRelationsByReference("nonexistent-rule")
	assert.Empty(t, emptyResults, "Should have no results for nonexistent rule")
}

// TestGraph_HasRelationships tests checking if entity has relationships
func TestGraph_HasRelationships(t *testing.T) {
	provider := newTestProvider(nil, nil, nil, nil)
	graph := NewGraph(provider)

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
			assert.Equal(t, tt.expected, result)
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
			provider := newTestProvider(nil, nil, nil, nil)
			graph := NewGraph(provider)
			graph.buildTime = tt.buildTime

			result := graph.IsStale(tt.ttl)
			assert.Equal(t, tt.expected, result)
		})
	}
}

// TestGraph_GetStats tests getting graph statistics
func TestGraph_GetStats(t *testing.T) {
	// Create a graph with actual entities and rules
	resources := make(map[string]*oapi.Resource)
	for i := 0; i < 100; i++ {
		id := fmt.Sprintf("r%d", i)
		resources[id] = &oapi.Resource{Id: id, WorkspaceId: "ws1"}
	}

	var matcher oapi.RelationshipRule_Matcher
	_ = matcher.FromPropertiesMatcher(oapi.PropertiesMatcher{
		Properties: []oapi.PropertyMatcher{
			{FromProperty: []string{"workspace_id"}, ToProperty: []string{"system_id"}, Operator: "equals"},
		},
	})

	rules := map[string]*oapi.RelationshipRule{
		"rule1": {Reference: "rule1", FromType: oapi.RelatableEntityTypeResource, ToType: oapi.RelatableEntityTypeDeployment, Matcher: matcher},
		"rule2": {Reference: "rule2", FromType: oapi.RelatableEntityTypeResource, ToType: oapi.RelatableEntityTypeEnvironment, Matcher: matcher},
		"rule3": {Reference: "rule3", FromType: oapi.RelatableEntityTypeDeployment, ToType: oapi.RelatableEntityTypeEnvironment, Matcher: matcher},
		"rule4": {Reference: "rule4", FromType: oapi.RelatableEntityTypeEnvironment, ToType: oapi.RelatableEntityTypeResource, Matcher: matcher},
		"rule5": {Reference: "rule5", FromType: oapi.RelatableEntityTypeResource, ToType: oapi.RelatableEntityTypeResource, Matcher: matcher},
	}

	provider := newTestProvider(resources, map[string]*oapi.Deployment{}, map[string]*oapi.Environment{}, rules)
	graph := NewGraph(provider)

	// Wait a bit to ensure age is non-zero
	time.Sleep(10 * time.Millisecond)

	stats := graph.GetStats()

	assert.Equal(t, 100, stats.EntityCount, "Should have 100 entities")
	assert.Equal(t, 5, stats.RuleCount, "Should have 5 rules")
	assert.False(t, stats.BuildTime.IsZero(), "BuildTime should be set")
	assert.Greater(t, stats.Age, time.Duration(0), "Age should be greater than 0")
}

// TestGraph_Concurrency tests concurrent access to graph
func TestGraph_Concurrency(t *testing.T) {
	provider := newTestProvider(nil, nil, nil, nil)
	graph := NewGraph(provider)

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
	provider := newTestProvider(nil, nil, nil, nil)
	graph := NewGraph(provider)

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

// TestNewGraphWithRepo tests creating a graph with a repository
func TestNewGraphWithRepo(t *testing.T) {
	resources := map[string]*oapi.Resource{
		"r1": {Id: "r1", WorkspaceId: "ws1"},
	}
	deployments := map[string]*oapi.Deployment{
		"d1": {Id: "d1", SystemId: "sys1"},
	}
	environments := map[string]*oapi.Environment{
		"e1": {Id: "e1", SystemId: "sys1"},
	}
	rules := map[string]*oapi.RelationshipRule{
		"rule1": {Id: "rule1", Reference: "rule1", FromType: oapi.RelatableEntityTypeResource, ToType: oapi.RelatableEntityTypeDeployment},
	}

	provider := newTestProvider(resources, deployments, environments, rules)
	graph := NewGraph(provider)

	if graph == nil {
		t.Fatal("NewGraph returned nil")
	}

	if graph.entityStore == nil {
		t.Fatal("entityStore should be set")
	}

	if graph.cache == nil {
		t.Fatal("cache should be set")
	}

	if graph.engine == nil {
		t.Fatal("engine should be set")
	}

	// Check that entities and rules are accessible through the stats
	stats := graph.GetStats()
	if stats.EntityCount != 3 { // 1 resource + 1 deployment + 1 environment
		t.Errorf("expected 3 entities, got %d", stats.EntityCount)
	}

	if stats.RuleCount != 1 {
		t.Errorf("expected 1 rule, got %d", stats.RuleCount)
	}
}

// TestGraph_InvalidateEntity tests invalidating an entity's cache
func TestGraph_InvalidateEntity(t *testing.T) {
	provider := newTestProvider(nil, nil, nil, nil)
	graph := NewGraph(provider)

	rule := &oapi.RelationshipRule{
		Reference: "test-rule",
		FromType:  oapi.RelatableEntityTypeResource,
		ToType:    oapi.RelatableEntityTypeDeployment,
	}

	// Add relationships for entity
	graph.addRelation("resource-1", "test-rule", &oapi.EntityRelation{
		Rule:       rule,
		Direction:  oapi.To,
		EntityType: oapi.RelatableEntityTypeDeployment,
		EntityId:   "deployment-1",
	})

	// Mark as computed
	graph.markEntityComputed("resource-1")

	// Verify entity has relationships and is marked computed
	if !graph.HasRelationships("resource-1") {
		t.Error("expected resource-1 to have relationships")
	}

	if !graph.IsComputed("resource-1") {
		t.Error("expected resource-1 to be marked computed")
	}

	// Invalidate the entity
	graph.InvalidateEntity("resource-1")

	// Verify entity no longer has cached relationships
	if graph.HasRelationships("resource-1") {
		t.Error("expected resource-1 to have no relationships after invalidation")
	}

	if graph.IsComputed("resource-1") {
		t.Error("expected resource-1 to not be marked computed after invalidation")
	}
}

// TestGraph_InvalidateEntity_CascadeInvalidation tests reverse index invalidation
func TestGraph_InvalidateEntity_CascadeInvalidation(t *testing.T) {
	provider := newTestProvider(nil, nil, nil, nil)
	graph := NewGraph(provider)

	rule := &oapi.RelationshipRule{
		Reference: "test-rule",
		FromType:  oapi.RelatableEntityTypeResource,
		ToType:    oapi.RelatableEntityTypeDeployment,
	}

	// Add relationship: resource-1 -> deployment-1
	// This should also track that deployment-1 is "used in" resource-1
	graph.addRelation("resource-1", "test-rule", &oapi.EntityRelation{
		Rule:       rule,
		Direction:  oapi.To,
		EntityType: oapi.RelatableEntityTypeDeployment,
		EntityId:   "deployment-1",
	})

	graph.markEntityComputed("resource-1")

	// Verify reverse index is set up by checking that invalidating deployment-1 affects resource-1
	// (We can't access entityUsedIn directly anymore since it's internal to cache)

	// Invalidate deployment-1 (the related entity)
	// This should cascade and also invalidate resource-1
	graph.InvalidateEntity("deployment-1")

	// Both entities should be invalidated
	if graph.IsComputed("deployment-1") {
		t.Error("expected deployment-1 to not be marked computed")
	}

	if graph.IsComputed("resource-1") {
		t.Error("expected resource-1 to also be invalidated due to cascade")
	}

	if graph.HasRelationships("resource-1") {
		t.Error("expected resource-1 relationships to be cleared")
	}
}

// TestGraph_InvalidateRule tests invalidating a specific rule
func TestGraph_InvalidateRule(t *testing.T) {
	provider := newTestProvider(nil, nil, nil, nil)
	graph := NewGraph(provider)

	rule1 := &oapi.RelationshipRule{
		Reference: "rule-1",
		FromType:  oapi.RelatableEntityTypeResource,
		ToType:    oapi.RelatableEntityTypeDeployment,
	}

	rule2 := &oapi.RelationshipRule{
		Reference: "rule-2",
		FromType:  oapi.RelatableEntityTypeResource,
		ToType:    oapi.RelatableEntityTypeEnvironment,
	}

	// Add relationships for both rules
	graph.addRelation("resource-1", "rule-1", &oapi.EntityRelation{
		Rule:       rule1,
		Direction:  oapi.To,
		EntityType: oapi.RelatableEntityTypeDeployment,
		EntityId:   "deployment-1",
	})

	graph.addRelation("resource-1", "rule-2", &oapi.EntityRelation{
		Rule:       rule2,
		Direction:  oapi.To,
		EntityType: oapi.RelatableEntityTypeEnvironment,
		EntityId:   "env-1",
	})

	// Verify entity has both rules
	relations := graph.GetRelatedEntities("resource-1")
	if len(relations) != 2 {
		t.Errorf("expected 2 rules, got %d", len(relations))
	}

	// Invalidate rule-1
	graph.InvalidateRule("rule-1")

	// Verify rule-1 is marked dirty
	if !graph.IsRuleDirty("rule-1") {
		t.Error("expected rule-1 to be marked dirty")
	}

	// Verify rule-1 relationships are removed but rule-2 remains
	relations = graph.GetRelatedEntities("resource-1")
	if len(relations) != 1 {
		t.Errorf("expected 1 rule after invalidation, got %d", len(relations))
	}

	if _, hasRule1 := relations["rule-1"]; hasRule1 {
		t.Error("expected rule-1 to be removed")
	}

	if _, hasRule2 := relations["rule-2"]; !hasRule2 {
		t.Error("expected rule-2 to remain")
	}
}

// TestGraph_AddRule tests adding a rule via provider and invalidating
func TestGraph_AddRule(t *testing.T) {
	provider := newTestProvider(nil, nil, nil, nil)
	graph := NewGraph(provider)

	rule := &oapi.RelationshipRule{
		Id:        "new-rule",
		Reference: "new-rule",
		FromType:  oapi.RelatableEntityTypeResource,
		ToType:    oapi.RelatableEntityTypeDeployment,
	}

	// Add rule to provider (simulating what store layer does)
	provider.rules = map[string]*oapi.RelationshipRule{"new-rule": rule}

	// Then invalidate in graph (store layer would call this)
	graph.InvalidateRule(rule.Reference)

	// Verify rule is accessible via provider
	if !graph.hasRule("new-rule") {
		t.Error("expected rule to be added to provider")
	}

	// Verify rule is marked dirty in cache
	if !graph.IsRuleDirty("new-rule") {
		t.Error("expected new rule to be marked dirty")
	}
}

// TestGraph_RemoveRule tests removing a rule via provider and invalidating
func TestGraph_RemoveRule(t *testing.T) {
	rule := &oapi.RelationshipRule{
		Id:        "test-rule",
		Reference: "test-rule",
		FromType:  oapi.RelatableEntityTypeResource,
		ToType:    oapi.RelatableEntityTypeDeployment,
	}

	provider := newTestProvider(nil, nil, nil, map[string]*oapi.RelationshipRule{"test-rule": rule})
	graph := NewGraph(provider)

	// Create relationships using the rule
	graph.addRelation("resource-1", "test-rule", &oapi.EntityRelation{
		Rule:       rule,
		Direction:  oapi.To,
		EntityType: oapi.RelatableEntityTypeDeployment,
		EntityId:   "deployment-1",
	})

	// Verify relationship exists
	if !graph.HasRelationships("resource-1") {
		t.Error("expected resource-1 to have relationships")
	}

	// Remove the rule from provider (simulating what store layer does)
	delete(provider.rules, "test-rule")

	// Then invalidate in graph (store layer would call this)
	graph.InvalidateRule("test-rule")

	// Verify rule is removed from provider
	if graph.hasRule("test-rule") {
		t.Error("expected rule to be removed from provider")
	}

	// Verify relationships using the rule are invalidated
	if graph.HasRelationships("resource-1") {
		t.Error("expected relationships to be cleared when rule is invalidated")
	}
}

// TestGraph_IsComputed tests checking if entity is computed
func TestGraph_IsComputed(t *testing.T) {
	provider := newTestProvider(nil, nil, nil, nil)
	graph := NewGraph(provider)

	// Initially not computed
	if graph.IsComputed("resource-1") {
		t.Error("expected resource-1 to not be computed initially")
	}

	// Mark as computed
	graph.markEntityComputed("resource-1")

	// Now should be computed
	if !graph.IsComputed("resource-1") {
		t.Error("expected resource-1 to be computed after marking")
	}
}

// TestGraph_IsRuleDirty tests checking if rule is dirty
func TestGraph_IsRuleDirty(t *testing.T) {
	provider := newTestProvider(nil, nil, nil, nil)
	graph := NewGraph(provider)

	// Initially not dirty
	if graph.IsRuleDirty("test-rule") {
		t.Error("expected test-rule to not be dirty initially")
	}

	// Invalidate rule
	graph.InvalidateRule("test-rule")

	// Now should be dirty
	if !graph.IsRuleDirty("test-rule") {
		t.Error("expected test-rule to be dirty after invalidation")
	}
}

// TestGraph_ReverseIndex tests reverse index tracking
func TestGraph_ReverseIndex(t *testing.T) {
	provider := newTestProvider(nil, nil, nil, nil)
	graph := NewGraph(provider)

	rule := &oapi.RelationshipRule{
		Reference: "test-rule",
		FromType:  oapi.RelatableEntityTypeResource,
		ToType:    oapi.RelatableEntityTypeDeployment,
	}

	// Add multiple entities that reference the same deployment
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
		EntityId:   "deployment-1",
	})

	graph.addRelation("resource-3", "test-rule", &oapi.EntityRelation{
		Rule:       rule,
		Direction:  oapi.To,
		EntityType: oapi.RelatableEntityTypeDeployment,
		EntityId:   "deployment-1",
	})

	// Verify reverse index works by checking cascade invalidation
	// When deployment-1 is invalidated, all three resources should also be invalidated
	graph.markEntityComputed("resource-1")
	graph.markEntityComputed("resource-2")
	graph.markEntityComputed("resource-3")

	// All resources should be computed now
	if !graph.IsComputed("resource-1") || !graph.IsComputed("resource-2") || !graph.IsComputed("resource-3") {
		t.Error("expected all resources to be computed")
	}

	// Invalidate deployment-1 - should cascade to all three resources
	graph.InvalidateEntity("deployment-1")

	// All resources should now be invalidated
	if graph.IsComputed("resource-1") || graph.IsComputed("resource-2") || graph.IsComputed("resource-3") {
		t.Error("expected all resources to be invalidated after deployment-1 invalidation")
	}
}

// TestGraph_LazyLoadingIntegration tests the complete lazy loading workflow
func TestGraph_LazyLoadingIntegration(t *testing.T) {
	// Setup test data
	resources := map[string]*oapi.Resource{
		"r1": {Id: "r1", Name: "resource-1", WorkspaceId: "ws1"},
		"r2": {Id: "r2", Name: "resource-2", WorkspaceId: "ws1"},
	}

	deployments := map[string]*oapi.Deployment{
		"d1": {Id: "d1", Name: "deployment-1", SystemId: "ws1"},
		"d2": {Id: "d2", Name: "deployment-2", SystemId: "ws2"},
	}

	// Rule: resources connect to deployments where workspace_id equals system_id
	var matcher oapi.RelationshipRule_Matcher
	_ = matcher.FromPropertiesMatcher(oapi.PropertiesMatcher{
		Properties: []oapi.PropertyMatcher{
			{
				FromProperty: []string{"workspace_id"},
				ToProperty:   []string{"system_id"},
				Operator:     "equals",
			},
		},
	})

	rules := map[string]*oapi.RelationshipRule{
		"resource-to-deployment": {
			Reference: "resource-to-deployment",
			FromType:  oapi.RelatableEntityTypeResource,
			ToType:    oapi.RelatableEntityTypeDeployment,
			Matcher:   matcher,
		},
	}

	// Create graph with stores (no computation yet)
	provider := newTestProvider(resources, deployments, map[string]*oapi.Environment{}, rules)
	graph := NewGraph(provider)

	// Verify no relationships are computed initially
	if graph.IsComputed("r1") {
		t.Error("expected r1 to not be computed initially")
	}

	if graph.HasRelationships("r1") {
		t.Error("expected r1 to have no relationships initially")
	}

	// Compute relationships for r1 lazily
	ctx := context.Background()
	err := graph.ComputeForEntity(ctx, "r1")
	if err != nil {
		t.Fatalf("failed to compute for entity: %v", err)
	}

	// Now r1 should be computed
	if !graph.IsComputed("r1") {
		t.Error("expected r1 to be computed after calling ComputeForEntity")
	}

	// r1 should have relationship to d1 (ws1 == ws1)
	r1Relations := graph.GetRelatedEntities("r1")
	if len(r1Relations) != 1 {
		t.Errorf("expected 1 rule for r1, got %d", len(r1Relations))
	}

	ruleRels := r1Relations["resource-to-deployment"]
	if len(ruleRels) != 1 {
		t.Errorf("expected 1 deployment for r1, got %d", len(ruleRels))
	}

	if ruleRels[0].EntityId != "d1" {
		t.Errorf("expected r1 to be related to d1, got %s", ruleRels[0].EntityId)
	}

	// r2 should still not be computed
	if graph.IsComputed("r2") {
		t.Error("expected r2 to not be computed yet")
	}

	// Compute relationships for r2
	err = graph.ComputeForEntity(ctx, "r2")
	if err != nil {
		t.Fatalf("failed to compute for entity r2: %v", err)
	}

	// Now r2 should also be computed with same relationship
	r2Relations := graph.GetRelatedEntities("r2")
	if len(r2Relations["resource-to-deployment"]) != 1 {
		t.Errorf("expected 1 deployment for r2, got %d", len(r2Relations["resource-to-deployment"]))
	}

	// Test invalidation: invalidate r1
	graph.InvalidateEntity("r1")

	// r1 should no longer be computed
	if graph.IsComputed("r1") {
		t.Error("expected r1 to not be computed after invalidation")
	}

	// r1 should have no cached relationships
	if graph.HasRelationships("r1") {
		t.Error("expected r1 to have no relationships after invalidation")
	}

	// r2 should still be computed (selective invalidation)
	if !graph.IsComputed("r2") {
		t.Error("expected r2 to still be computed after r1 invalidation")
	}

	// Test rule invalidation
	graph.InvalidateRule("resource-to-deployment")

	// Rule should be marked dirty
	if !graph.IsRuleDirty("resource-to-deployment") {
		t.Error("expected rule to be marked dirty")
	}

	// r2 relationships should be cleared
	if graph.HasRelationships("r2") {
		t.Error("expected r2 relationships to be cleared after rule invalidation")
	}

	// Recompute r1 - should work even after invalidation
	err = graph.ComputeForEntity(ctx, "r1")
	if err != nil {
		t.Fatalf("failed to recompute for entity r1: %v", err)
	}

	// r1 should have relationships again
	r1Relations = graph.GetRelatedEntities("r1")
	if len(r1Relations["resource-to-deployment"]) != 1 {
		t.Errorf("expected 1 deployment for r1 after recompute, got %d", len(r1Relations["resource-to-deployment"]))
	}
}

// TestGraph_ComputeForEntity_NonexistentEntity tests computing for non-existent entity
func TestGraph_ComputeForEntity_NonexistentEntity(t *testing.T) {
	resources := map[string]*oapi.Resource{
		"r1": {Id: "r1", WorkspaceId: "ws1"},
	}

	provider := newTestProvider(resources, map[string]*oapi.Deployment{}, map[string]*oapi.Environment{}, map[string]*oapi.RelationshipRule{})
	graph := NewGraph(provider)

	ctx := context.Background()
	err := graph.ComputeForEntity(ctx, "nonexistent")

	if err == nil {
		t.Error("expected error when computing for nonexistent entity")
	}
}

// TestGraph_GetRelatedEntitiesWithCompute tests automatic lazy loading via GetRelatedEntitiesWithCompute
func TestGraph_GetRelatedEntitiesWithCompute(t *testing.T) {
	// Setup test data
	resources := map[string]*oapi.Resource{
		"r1": {Id: "r1", WorkspaceId: "ws1"},
	}

	deployments := map[string]*oapi.Deployment{
		"d1": {Id: "d1", SystemId: "ws1"},
	}

	var matcher oapi.RelationshipRule_Matcher
	_ = matcher.FromPropertiesMatcher(oapi.PropertiesMatcher{
		Properties: []oapi.PropertyMatcher{
			{
				FromProperty: []string{"workspace_id"},
				ToProperty:   []string{"system_id"},
				Operator:     "equals",
			},
		},
	})

	rules := map[string]*oapi.RelationshipRule{
		"resource-to-deployment": {
			Reference: "resource-to-deployment",
			FromType:  oapi.RelatableEntityTypeResource,
			ToType:    oapi.RelatableEntityTypeDeployment,
			Matcher:   matcher,
		},
	}

	provider := newTestProvider(resources, deployments, map[string]*oapi.Environment{}, rules)
	graph := NewGraph(provider)

	ctx := context.Background()

	// First call should trigger computation
	relations, err := graph.GetRelatedEntitiesWithCompute(ctx, "r1")
	if err != nil {
		t.Fatalf("failed to get related entities: %v", err)
	}

	if len(relations) != 1 {
		t.Errorf("expected 1 rule, got %d", len(relations))
	}

	// Verify entity is now computed
	if !graph.IsComputed("r1") {
		t.Error("expected r1 to be computed after GetRelatedEntitiesWithCompute")
	}

	// Second call should use cache (no recomputation)
	relations2, err := graph.GetRelatedEntitiesWithCompute(ctx, "r1")
	if err != nil {
		t.Fatalf("failed to get related entities (cached): %v", err)
	}

	// Should get same results
	if len(relations2) != len(relations) {
		t.Errorf("expected same number of relations from cache, got %d vs %d", len(relations2), len(relations))
	}
}
