package relationgraph

import (
	"context"
	"fmt"
	"testing"

	"workspace-engine/pkg/oapi"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Helper function to create a test resource
func createTestResource(id, name, workspaceId string, metadata map[string]string) *oapi.Resource {
	return &oapi.Resource{
		Id:          id,
		Name:        name,
		Metadata:    metadata,
		Version:     "v1",
		WorkspaceId: workspaceId,
		Identifier:  id,
		Kind:        "test-kind",
		Config:      map[string]interface{}{},
	}
}

// Helper function to create a test deployment
func createTestDeployment(id, name, systemId string) *oapi.Deployment {
	return &oapi.Deployment{
		Id:             id,
		Name:           name,
		Slug:           name,
		SystemId:       systemId,
		JobAgentConfig: map[string]interface{}{},
	}
}

// Helper function to create a test environment
func createTestEnvironment(id, name, systemId string) *oapi.Environment {
	return &oapi.Environment{
		Id:       id,
		Name:     name,
		SystemId: systemId,
	}
}

// Helper function to create a selector
func createSelector(key, op, value string) *oapi.Selector {
	selector := &oapi.Selector{}
	_ = selector.FromJsonSelector(oapi.JsonSelector{
		Json: map[string]interface{}{
			key: map[string]interface{}{
				op: value,
			},
		},
	})
	return selector
}

// Helper function to create a matcher
func createMatcher() oapi.RelationshipRule_Matcher {
	var matcher oapi.RelationshipRule_Matcher
	_ = matcher.FromPropertiesMatcher(oapi.PropertiesMatcher{
		Properties: []oapi.PropertyMatcher{},
	})
	return matcher
}

// Helper function to create a matcher with property matchers
func createPropertyMatcher(props []oapi.PropertyMatcher) oapi.RelationshipRule_Matcher {
	var matcher oapi.RelationshipRule_Matcher
	_ = matcher.FromPropertiesMatcher(oapi.PropertiesMatcher{
		Properties: props,
	})
	return matcher
}

// TestNewComputationEngine tests the constructor
func TestNewComputationEngine(t *testing.T) {
	provider := newTestProvider(nil, nil, nil, nil)
	entityStore := NewEntityStore(provider)
	cache := NewRelationshipCache()

	engine := NewComputationEngine(entityStore, cache)

	require.NotNil(t, engine)
	assert.NotNil(t, engine.entityStore)
	assert.NotNil(t, engine.cache)
}

// TestComputeForEntity_EntityNotFound tests computation when entity doesn't exist
func TestComputeForEntity_EntityNotFound(t *testing.T) {
	provider := newTestProvider(nil, nil, nil, nil)
	entityStore := NewEntityStore(provider)
	cache := NewRelationshipCache()
	engine := NewComputationEngine(entityStore, cache)

	ctx := context.Background()
	err := engine.ComputeForEntity(ctx, "non-existent-id")

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "entity not found")
}

// TestComputeForEntity_AlreadyComputedNoDirtyRules tests skipping already computed entity
func TestComputeForEntity_AlreadyComputedNoDirtyRules(t *testing.T) {
	resource := createTestResource("res-1", "test-resource", "ws1", map[string]string{"env": "prod"})
	provider := newTestProvider(
		map[string]*oapi.Resource{"res-1": resource},
		nil,
		nil,
		nil,
	)

	entityStore := NewEntityStore(provider)
	cache := NewRelationshipCache()
	engine := NewComputationEngine(entityStore, cache)

	// Mark entity as already computed
	cache.MarkEntityComputed("res-1")

	ctx := context.Background()
	err := engine.ComputeForEntity(ctx, "res-1")

	assert.NoError(t, err)
	// Should not have computed any relationships since no rules exist
	assert.Equal(t, 0, cache.RelationCount())
}

// TestComputeForEntity_SimpleResourceToDeployment tests basic forward relationship
func TestComputeForEntity_SimpleResourceToDeployment(t *testing.T) {
	// Create minimal entities (like the working integration test)
	resource := &oapi.Resource{Id: "res-1", Name: "api-server", WorkspaceId: "ws1"}
	deployment := &oapi.Deployment{Id: "dep-1", Name: "api-deployment", SystemId: "ws1"}

	// Create a rule: Resources -> Deployments (match by workspace/system id)
	matcher := createPropertyMatcher([]oapi.PropertyMatcher{
		{
			FromProperty: []string{"workspace_id"},
			ToProperty:   []string{"system_id"},
			Operator:     "equals",
		},
	})

	rule := &oapi.RelationshipRule{
		Reference: "resource-to-deployment",
		FromType:  oapi.RelatableEntityTypeResource,
		ToType:    oapi.RelatableEntityTypeDeployment,
		Matcher:   matcher,
	}

	provider := newTestProvider(
		map[string]*oapi.Resource{"res-1": resource},
		map[string]*oapi.Deployment{"dep-1": deployment},
		nil,
		map[string]*oapi.RelationshipRule{"resource-to-deployment": rule},
	)

	entityStore := NewEntityStore(provider)
	cache := NewRelationshipCache()
	engine := NewComputationEngine(entityStore, cache)

	ctx := context.Background()
	err := engine.ComputeForEntity(ctx, "res-1")

	require.NoError(t, err)

	// Check that entity is marked as computed
	assert.True(t, cache.IsComputed("res-1"))

	// Check that relationship was created
	relations := cache.Get("res-1")
	require.Len(t, relations, 1, "Should have 1 rule")
	require.Contains(t, relations, "resource-to-deployment")
	require.Len(t, relations["resource-to-deployment"], 1, "Should have 1 relationship")

	rel := relations["resource-to-deployment"][0]
	assert.Equal(t, oapi.To, rel.Direction)
	assert.Equal(t, "dep-1", rel.EntityId)
	assert.Equal(t, oapi.RelatableEntityTypeDeployment, rel.EntityType)
}

// TestComputeForEntity_ReverseRelationship tests reverse relationship (from side)
func TestComputeForEntity_ReverseRelationship(t *testing.T) {
	resource := &oapi.Resource{Id: "res-1", Name: "api-server", WorkspaceId: "ws1"}
	deployment := &oapi.Deployment{Id: "dep-1", Name: "api-deployment", SystemId: "ws1"}

	// Create a rule: Resources -> Deployments (match by workspace/system id)
	matcher := createPropertyMatcher([]oapi.PropertyMatcher{
		{
			FromProperty: []string{"workspace_id"},
			ToProperty:   []string{"system_id"},
			Operator:     "equals",
		},
	})

	rule := &oapi.RelationshipRule{
		Reference: "resource-to-deployment",
		FromType:  oapi.RelatableEntityTypeResource,
		ToType:    oapi.RelatableEntityTypeDeployment,
		Matcher:   matcher,
	}

	provider := newTestProvider(
		map[string]*oapi.Resource{"res-1": resource},
		map[string]*oapi.Deployment{"dep-1": deployment},
		nil,
		map[string]*oapi.RelationshipRule{"resource-to-deployment": rule},
	)

	entityStore := NewEntityStore(provider)
	cache := NewRelationshipCache()
	engine := NewComputationEngine(entityStore, cache)

	ctx := context.Background()
	// Compute for deployment (the "to" side)
	err := engine.ComputeForEntity(ctx, "dep-1")

	require.NoError(t, err)

	// Check that relationship was created (reverse direction)
	relations := cache.Get("dep-1")
	require.Len(t, relations, 1, "Should have 1 rule")
	require.Contains(t, relations, "resource-to-deployment")
	require.Len(t, relations["resource-to-deployment"], 1, "Should have 1 relationship")

	rel := relations["resource-to-deployment"][0]
	assert.Equal(t, oapi.From, rel.Direction)
	assert.Equal(t, "res-1", rel.EntityId)
	assert.Equal(t, oapi.RelatableEntityTypeResource, rel.EntityType)
}

// TestComputeForEntity_SkipSelfRelationship tests that entities don't relate to themselves
func TestComputeForEntity_SkipSelfRelationship(t *testing.T) {
	resource := &oapi.Resource{Id: "res-1", Name: "api-server", WorkspaceId: "ws1"}

	// Create a rule: Resources -> Resources (same type)
	matcher := createPropertyMatcher([]oapi.PropertyMatcher{
		{
			FromProperty: []string{"workspace_id"},
			ToProperty:   []string{"workspace_id"},
			Operator:     "equals",
		},
	})

	rule := &oapi.RelationshipRule{
		Reference: "resource-to-resource",
		FromType:  oapi.RelatableEntityTypeResource,
		ToType:    oapi.RelatableEntityTypeResource,
		Matcher:   matcher,
	}

	provider := newTestProvider(
		map[string]*oapi.Resource{"res-1": resource},
		nil,
		nil,
		map[string]*oapi.RelationshipRule{"resource-to-resource": rule},
	)

	entityStore := NewEntityStore(provider)
	cache := NewRelationshipCache()
	engine := NewComputationEngine(entityStore, cache)

	ctx := context.Background()
	err := engine.ComputeForEntity(ctx, "res-1")

	require.NoError(t, err)

	// Should not have any relationships (self-relationships are skipped)
	relations := cache.Get("res-1")
	if len(relations) > 0 && len(relations["resource-to-resource"]) > 0 {
		t.Error("Expected no relationships (self-relationships should be skipped)")
	}
}

// TestComputeForEntity_DirtyRule tests recomputation when rule is dirty
func TestComputeForEntity_DirtyRule(t *testing.T) {
	resource := &oapi.Resource{Id: "res-1", Name: "api-server", WorkspaceId: "ws1"}
	deployment := &oapi.Deployment{Id: "dep-1", Name: "api-deployment", SystemId: "ws1"}

	matcher := createPropertyMatcher([]oapi.PropertyMatcher{
		{
			FromProperty: []string{"workspace_id"},
			ToProperty:   []string{"system_id"},
			Operator:     "equals",
		},
	})

	rule := &oapi.RelationshipRule{
		Reference: "resource-to-deployment",
		FromType:  oapi.RelatableEntityTypeResource,
		ToType:    oapi.RelatableEntityTypeDeployment,
		Matcher:   matcher,
	}

	provider := newTestProvider(
		map[string]*oapi.Resource{"res-1": resource},
		map[string]*oapi.Deployment{"dep-1": deployment},
		nil,
		map[string]*oapi.RelationshipRule{"resource-to-deployment": rule},
	)

	entityStore := NewEntityStore(provider)
	cache := NewRelationshipCache()
	engine := NewComputationEngine(entityStore, cache)

	ctx := context.Background()

	// First computation
	err := engine.ComputeForEntity(ctx, "res-1")
	require.NoError(t, err)
	assert.True(t, cache.IsComputed("res-1"))

	// Mark rule as dirty
	cache.MarkRuleDirty("resource-to-deployment")

	// Second computation should recompute despite entity being marked as computed
	err = engine.ComputeForEntity(ctx, "res-1")
	require.NoError(t, err)

	// Verify relationships still exist (may have duplicates since cache was marked dirty)
	relations := cache.Get("res-1")
	require.Len(t, relations, 1, "Should have rule key")
	require.NotEmpty(t, relations["resource-to-deployment"], "Should have at least one relationship")
}

// TestComputeForEntity_MultipleRules tests entity with multiple applicable rules
func TestComputeForEntity_MultipleRules(t *testing.T) {
	resource := &oapi.Resource{Id: "res-1", Name: "api-server", WorkspaceId: "ws1"}
	deployment := &oapi.Deployment{Id: "dep-1", Name: "api-deployment", SystemId: "ws1"}
	environment := &oapi.Environment{Id: "env-1", Name: "production", SystemId: "ws1"}

	matcher := createPropertyMatcher([]oapi.PropertyMatcher{
		{
			FromProperty: []string{"workspace_id"},
			ToProperty:   []string{"system_id"},
			Operator:     "equals",
		},
	})

	rule1 := &oapi.RelationshipRule{
		Reference: "resource-to-deployment",
		FromType:  oapi.RelatableEntityTypeResource,
		ToType:    oapi.RelatableEntityTypeDeployment,
		Matcher:   matcher,
	}

	rule2 := &oapi.RelationshipRule{
		Reference: "resource-to-environment",
		FromType:  oapi.RelatableEntityTypeResource,
		ToType:    oapi.RelatableEntityTypeEnvironment,
		Matcher:   matcher,
	}

	provider := newTestProvider(
		map[string]*oapi.Resource{"res-1": resource},
		map[string]*oapi.Deployment{"dep-1": deployment},
		map[string]*oapi.Environment{"env-1": environment},
		map[string]*oapi.RelationshipRule{
			"resource-to-deployment":  rule1,
			"resource-to-environment": rule2,
		},
	)

	entityStore := NewEntityStore(provider)
	cache := NewRelationshipCache()
	engine := NewComputationEngine(entityStore, cache)

	ctx := context.Background()
	err := engine.ComputeForEntity(ctx, "res-1")

	require.NoError(t, err)

	// Check that both rules were processed
	relations := cache.Get("res-1")
	require.Len(t, relations, 2, "Should have 2 rules")
	assert.Contains(t, relations, "resource-to-deployment")
	assert.Contains(t, relations, "resource-to-environment")
	assert.Len(t, relations["resource-to-deployment"], 1)
	assert.Len(t, relations["resource-to-environment"], 1)
}

// TestComputeForEntity_NoMatchingPropertyMatcher tests entity where property matcher fails
func TestComputeForEntity_NoMatchingPropertyMatcher(t *testing.T) {
	// Resource with workspace ws1, deployment with system ws2 (no match)
	resource := &oapi.Resource{Id: "res-1", Name: "api-server", WorkspaceId: "ws1"}
	deployment := &oapi.Deployment{Id: "dep-1", Name: "api-deployment", SystemId: "ws2"}

	matcher := createPropertyMatcher([]oapi.PropertyMatcher{
		{
			FromProperty: []string{"workspace_id"},
			ToProperty:   []string{"system_id"},
			Operator:     "equals",
		},
	})

	rule := &oapi.RelationshipRule{
		Reference: "resource-to-deployment",
		FromType:  oapi.RelatableEntityTypeResource,
		ToType:    oapi.RelatableEntityTypeDeployment,
		Matcher:   matcher,
	}

	provider := newTestProvider(
		map[string]*oapi.Resource{"res-1": resource},
		map[string]*oapi.Deployment{"dep-1": deployment},
		nil,
		map[string]*oapi.RelationshipRule{"resource-to-deployment": rule},
	)

	entityStore := NewEntityStore(provider)
	cache := NewRelationshipCache()
	engine := NewComputationEngine(entityStore, cache)

	ctx := context.Background()
	err := engine.ComputeForEntity(ctx, "res-1")

	require.NoError(t, err)

	// Should have no relationships since property matcher doesn't match
	relations := cache.Get("res-1")
	assert.True(t, len(relations) == 0 || len(relations["resource-to-deployment"]) == 0, "Should have no relationships when property matcher doesn't match")
}

// TestFilterEntities tests the filterEntities method
func TestFilterEntities(t *testing.T) {
	// Create simple resources and deployment
	resource1 := &oapi.Resource{Id: "res-1", Name: "api-server", WorkspaceId: "ws1"}
	resource2 := &oapi.Resource{Id: "res-2", Name: "db-server", WorkspaceId: "ws1"}
	resource3 := &oapi.Resource{Id: "res-3", Name: "cache-server", WorkspaceId: "ws1"}
	deployment := &oapi.Deployment{Id: "dep-1", Name: "api-deployment", SystemId: "sys1"}

	provider := newTestProvider(
		map[string]*oapi.Resource{
			"res-1": resource1,
			"res-2": resource2,
			"res-3": resource3,
		},
		map[string]*oapi.Deployment{"dep-1": deployment},
		nil,
		nil,
	)

	entityStore := NewEntityStore(provider)
	cache := NewRelationshipCache()
	engine := NewComputationEngine(entityStore, cache)

	ctx := context.Background()
	allEntities := entityStore.GetAllEntities()

	tests := []struct {
		name          string
		entityType    oapi.RelatableEntityType
		selector      *oapi.Selector
		expectedCount int
		expectedIDs   []string
	}{
		{
			name:          "Filter by type only - Resources",
			entityType:    oapi.RelatableEntityTypeResource,
			selector:      nil,
			expectedCount: 3,
			expectedIDs:   []string{"res-1", "res-2", "res-3"},
		},
		{
			name:          "Filter by type only - Deployments",
			entityType:    oapi.RelatableEntityTypeDeployment,
			selector:      nil,
			expectedCount: 1,
			expectedIDs:   []string{"dep-1"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			filtered := engine.filterEntities(ctx, allEntities, tt.entityType, tt.selector)
			assert.Len(t, filtered, tt.expectedCount)

			if tt.expectedCount > 0 {
				actualIDs := make([]string, len(filtered))
				for i, entity := range filtered {
					actualIDs[i] = entity.GetID()
				}
				assert.ElementsMatch(t, tt.expectedIDs, actualIDs)
			}
		})
	}
}

// TestMatchesSelector tests the matchesSelector method
func TestMatchesSelector(t *testing.T) {
	resource := &oapi.Resource{Id: "res-1", Name: "api-server", WorkspaceId: "ws1"}
	deployment := &oapi.Deployment{Id: "dep-1", Name: "api-deployment", SystemId: "sys1"}

	provider := newTestProvider(
		map[string]*oapi.Resource{"res-1": resource},
		map[string]*oapi.Deployment{"dep-1": deployment},
		nil,
		nil,
	)

	entityStore := NewEntityStore(provider)
	cache := NewRelationshipCache()
	engine := NewComputationEngine(entityStore, cache)

	ctx := context.Background()
	allEntities := entityStore.GetAllEntities()
	resourceEntity := allEntities[0]

	tests := []struct {
		name           string
		targetType     oapi.RelatableEntityType
		targetSelector *oapi.Selector
		entity         *oapi.RelatableEntity
		expectedMatch  bool
	}{
		{
			name:           "Type matches, no selector",
			targetType:     oapi.RelatableEntityTypeResource,
			targetSelector: nil,
			entity:         resourceEntity,
			expectedMatch:  true,
		},
		{
			name:           "Type doesn't match",
			targetType:     oapi.RelatableEntityTypeDeployment,
			targetSelector: nil,
			entity:         resourceEntity,
			expectedMatch:  false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			matched, err := engine.matchesSelector(ctx, tt.targetType, tt.targetSelector, tt.entity)
			require.NoError(t, err)
			assert.Equal(t, tt.expectedMatch, matched)
		})
	}
}

// Benchmarks

// BenchmarkComputeForEntity benchmarks the main computation method
func BenchmarkComputeForEntity(b *testing.B) {
	sizes := []int{10, 100, 1000}

	for _, size := range sizes {
		b.Run(fmt.Sprintf("entities_%d", size), func(b *testing.B) {
			// Setup test data
			resources := make(map[string]*oapi.Resource, size)
			deployments := make(map[string]*oapi.Deployment, size)

			for i := 0; i < size; i++ {
				resources[fmt.Sprintf("res-%d", i)] = &oapi.Resource{
					Id:          fmt.Sprintf("res-%d", i),
					Name:        fmt.Sprintf("resource-%d", i),
					WorkspaceId: fmt.Sprintf("ws-%d", i),
				}
				deployments[fmt.Sprintf("dep-%d", i)] = &oapi.Deployment{
					Id:       fmt.Sprintf("dep-%d", i),
					Name:     fmt.Sprintf("deployment-%d", i),
					SystemId: fmt.Sprintf("ws-%d", i),
				}
			}

			matcher := createPropertyMatcher([]oapi.PropertyMatcher{
				{
					FromProperty: []string{"workspace_id"},
					ToProperty:   []string{"system_id"},
					Operator:     "equals",
				},
			})

			rule := &oapi.RelationshipRule{
				Reference: "resource-to-deployment",
				FromType:  oapi.RelatableEntityTypeResource,
				ToType:    oapi.RelatableEntityTypeDeployment,
				Matcher:   matcher,
			}

			provider := newTestProvider(
				resources,
				deployments,
				nil,
				map[string]*oapi.RelationshipRule{"resource-to-deployment": rule},
			)

			entityStore := NewEntityStore(provider)
			ctx := context.Background()

			b.ResetTimer()

			for i := 0; i < b.N; i++ {
				cache := NewRelationshipCache()
				engine := NewComputationEngine(entityStore, cache)
				_ = engine.ComputeForEntity(ctx, "res-0")
			}
		})
	}
}

// BenchmarkFilterEntities benchmarks the filterEntities method
func BenchmarkFilterEntities(b *testing.B) {
	sizes := []int{100, 1000, 10000}

	for _, size := range sizes {
		b.Run(fmt.Sprintf("entities_%d", size), func(b *testing.B) {
			resources := make(map[string]*oapi.Resource, size)

			for i := 0; i < size; i++ {
				resources[fmt.Sprintf("res-%d", i)] = &oapi.Resource{
					Id:          fmt.Sprintf("res-%d", i),
					Name:        fmt.Sprintf("resource-%d", i),
					WorkspaceId: "ws1",
				}
			}

			provider := newTestProvider(resources, nil, nil, nil)
			entityStore := NewEntityStore(provider)
			cache := NewRelationshipCache()
			engine := NewComputationEngine(entityStore, cache)

			ctx := context.Background()
			allEntities := entityStore.GetAllEntities()

			b.ResetTimer()

			for i := 0; i < b.N; i++ {
				_ = engine.filterEntities(ctx, allEntities, oapi.RelatableEntityTypeResource, nil)
			}
		})
	}
}

// BenchmarkMatchesSelector benchmarks the matchesSelector method
func BenchmarkMatchesSelector(b *testing.B) {
	resource := &oapi.Resource{Id: "res-1", Name: "api-server", WorkspaceId: "ws1"}
	provider := newTestProvider(
		map[string]*oapi.Resource{"res-1": resource},
		nil,
		nil,
		nil,
	)

	entityStore := NewEntityStore(provider)
	cache := NewRelationshipCache()
	engine := NewComputationEngine(entityStore, cache)

	ctx := context.Background()
	allEntities := entityStore.GetAllEntities()
	entity := allEntities[0]

	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		_, _ = engine.matchesSelector(ctx, oapi.RelatableEntityTypeResource, nil, entity)
	}
}

// BenchmarkProcessRuleForEntity benchmarks processing a single rule
func BenchmarkProcessRuleForEntity(b *testing.B) {
	sizes := []int{10, 100, 1000}

	for _, size := range sizes {
		b.Run(fmt.Sprintf("entities_%d", size), func(b *testing.B) {
			resources := make(map[string]*oapi.Resource, size)
			deployments := make(map[string]*oapi.Deployment, size)

			for i := 0; i < size; i++ {
				resources[fmt.Sprintf("res-%d", i)] = &oapi.Resource{
					Id:          fmt.Sprintf("res-%d", i),
					Name:        fmt.Sprintf("resource-%d", i),
					WorkspaceId: fmt.Sprintf("ws-%d", i),
				}
				deployments[fmt.Sprintf("dep-%d", i)] = &oapi.Deployment{
					Id:       fmt.Sprintf("dep-%d", i),
					Name:     fmt.Sprintf("deployment-%d", i),
					SystemId: fmt.Sprintf("ws-%d", i),
				}
			}

			matcher := createPropertyMatcher([]oapi.PropertyMatcher{
				{
					FromProperty: []string{"workspace_id"},
					ToProperty:   []string{"system_id"},
					Operator:     "equals",
				},
			})

			rule := &oapi.RelationshipRule{
				Reference: "resource-to-deployment",
				FromType:  oapi.RelatableEntityTypeResource,
				ToType:    oapi.RelatableEntityTypeDeployment,
				Matcher:   matcher,
			}

			provider := newTestProvider(resources, deployments, nil, nil)
			entityStore := NewEntityStore(provider)
			cache := NewRelationshipCache()
			engine := NewComputationEngine(entityStore, cache)

			ctx := context.Background()
			allEntities := entityStore.GetAllEntities()
			targetEntity := allEntities[0]

			b.ResetTimer()

			for i := 0; i < b.N; i++ {
				_ = engine.processRuleForEntity(ctx, rule, targetEntity, allEntities)
			}
		})
	}
}

// BenchmarkComputeForEntity_WithPropertyMatcher benchmarks computation with property matching
func BenchmarkComputeForEntity_WithPropertyMatcher(b *testing.B) {
	size := 100
	resources := make(map[string]*oapi.Resource, size)
	deployments := make(map[string]*oapi.Deployment, size)

	for i := 0; i < size; i++ {
		resources[fmt.Sprintf("res-%d", i)] = &oapi.Resource{
			Id:          fmt.Sprintf("res-%d", i),
			Name:        fmt.Sprintf("resource-%d", i),
			WorkspaceId: fmt.Sprintf("ws-%d", i),
		}
		deployments[fmt.Sprintf("dep-%d", i)] = &oapi.Deployment{
			Id:       fmt.Sprintf("dep-%d", i),
			Name:     fmt.Sprintf("deployment-%d", i),
			SystemId: fmt.Sprintf("ws-%d", i),
		}
	}

	matcher := createPropertyMatcher([]oapi.PropertyMatcher{
		{
			FromProperty: []string{"workspace_id"},
			ToProperty:   []string{"system_id"},
			Operator:     "equals",
		},
	})

	rule := &oapi.RelationshipRule{
		Reference: "resource-to-deployment",
		FromType:  oapi.RelatableEntityTypeResource,
		ToType:    oapi.RelatableEntityTypeDeployment,
		Matcher:   matcher,
	}

	provider := newTestProvider(
		resources,
		deployments,
		nil,
		map[string]*oapi.RelationshipRule{"resource-to-deployment": rule},
	)

	entityStore := NewEntityStore(provider)
	ctx := context.Background()

	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		cache := NewRelationshipCache()
		engine := NewComputationEngine(entityStore, cache)
		_ = engine.ComputeForEntity(ctx, "res-0")
	}
}

// BenchmarkComputeForEntity_MultipleRules benchmarks computation with multiple rules
func BenchmarkComputeForEntity_MultipleRules(b *testing.B) {
	numRules := []int{1, 5, 10}

	for _, ruleCount := range numRules {
		b.Run(fmt.Sprintf("rules_%d", ruleCount), func(b *testing.B) {
			size := 100
			resources := make(map[string]*oapi.Resource, size)
			deployments := make(map[string]*oapi.Deployment, size)

			for i := 0; i < size; i++ {
				resources[fmt.Sprintf("res-%d", i)] = &oapi.Resource{
					Id:          fmt.Sprintf("res-%d", i),
					Name:        fmt.Sprintf("resource-%d", i),
					WorkspaceId: "ws1",
				}
				deployments[fmt.Sprintf("dep-%d", i)] = &oapi.Deployment{
					Id:       fmt.Sprintf("dep-%d", i),
					Name:     fmt.Sprintf("deployment-%d", i),
					SystemId: "ws1",
				}
			}

			matcher := createMatcher()
			rules := make(map[string]*oapi.RelationshipRule, ruleCount)
			for i := 0; i < ruleCount; i++ {
				rules[fmt.Sprintf("rule-%d", i)] = &oapi.RelationshipRule{
					Reference: fmt.Sprintf("rule-%d", i),
					FromType:  oapi.RelatableEntityTypeResource,
					ToType:    oapi.RelatableEntityTypeDeployment,
					Matcher:   matcher,
				}
			}

			provider := newTestProvider(resources, deployments, nil, rules)
			entityStore := NewEntityStore(provider)
			ctx := context.Background()

			b.ResetTimer()

			for i := 0; i < b.N; i++ {
				cache := NewRelationshipCache()
				engine := NewComputationEngine(entityStore, cache)
				_ = engine.ComputeForEntity(ctx, "res-0")
			}
		})
	}
}

// TestInvalidateEntity_BasicInvalidation tests that invalidating an entity clears its relationships
func TestInvalidateEntity_BasicInvalidation(t *testing.T) {
	resource := &oapi.Resource{Id: "res-1", Name: "api-server", WorkspaceId: "ws1"}
	deployment := &oapi.Deployment{Id: "dep-1", Name: "api-deployment", SystemId: "ws1"}

	matcher := createPropertyMatcher([]oapi.PropertyMatcher{
		{
			FromProperty: []string{"workspace_id"},
			ToProperty:   []string{"system_id"},
			Operator:     "equals",
		},
	})

	rule := &oapi.RelationshipRule{
		Reference: "resource-to-deployment",
		FromType:  oapi.RelatableEntityTypeResource,
		ToType:    oapi.RelatableEntityTypeDeployment,
		Matcher:   matcher,
	}

	provider := newTestProvider(
		map[string]*oapi.Resource{"res-1": resource},
		map[string]*oapi.Deployment{"dep-1": deployment},
		nil,
		map[string]*oapi.RelationshipRule{"resource-to-deployment": rule},
	)

	entityStore := NewEntityStore(provider)
	cache := NewRelationshipCache()
	engine := NewComputationEngine(entityStore, cache)

	ctx := context.Background()

	// Compute relationships
	err := engine.ComputeForEntity(ctx, "res-1")
	require.NoError(t, err)

	// Verify relationships exist
	relations := cache.Get("res-1")
	require.Len(t, relations, 1)
	require.Len(t, relations["resource-to-deployment"], 1)
	assert.True(t, cache.IsComputed("res-1"))

	// Invalidate the entity
	cache.InvalidateEntity("res-1")

	// Verify relationships are cleared
	relations = cache.Get("res-1")
	assert.Empty(t, relations, "Relationships should be cleared after invalidation")
	assert.False(t, cache.IsComputed("res-1"), "Entity should not be marked as computed after invalidation")
	assert.False(t, cache.IsRuleComputedForEntity("res-1", "resource-to-deployment"), "Rule computation should be cleared")
}

// TestInvalidateEntity_CascadeInvalidation tests that invalidating an entity cascades to entities that reference it
func TestInvalidateEntity_CascadeInvalidation(t *testing.T) {
	resource1 := &oapi.Resource{Id: "res-1", Name: "api-server", WorkspaceId: "ws1"}
	resource2 := &oapi.Resource{Id: "res-2", Name: "db-server", WorkspaceId: "ws1"}
	deployment := &oapi.Deployment{Id: "dep-1", Name: "api-deployment", SystemId: "ws1"}

	matcher := createPropertyMatcher([]oapi.PropertyMatcher{
		{
			FromProperty: []string{"workspace_id"},
			ToProperty:   []string{"system_id"},
			Operator:     "equals",
		},
	})

	rule := &oapi.RelationshipRule{
		Reference: "resource-to-deployment",
		FromType:  oapi.RelatableEntityTypeResource,
		ToType:    oapi.RelatableEntityTypeDeployment,
		Matcher:   matcher,
	}

	provider := newTestProvider(
		map[string]*oapi.Resource{
			"res-1": resource1,
			"res-2": resource2,
		},
		map[string]*oapi.Deployment{"dep-1": deployment},
		nil,
		map[string]*oapi.RelationshipRule{"resource-to-deployment": rule},
	)

	entityStore := NewEntityStore(provider)
	cache := NewRelationshipCache()
	engine := NewComputationEngine(entityStore, cache)

	ctx := context.Background()

	// Compute relationships for both resources (they both relate to dep-1)
	err := engine.ComputeForEntity(ctx, "res-1")
	require.NoError(t, err)
	err = engine.ComputeForEntity(ctx, "res-2")
	require.NoError(t, err)

	// Also compute for deployment (it should have reverse relationships to both resources)
	err = engine.ComputeForEntity(ctx, "dep-1")
	require.NoError(t, err)

	// Verify all entities have relationships
	assert.True(t, cache.HasRelationships("res-1"))
	assert.True(t, cache.HasRelationships("res-2"))
	assert.True(t, cache.HasRelationships("dep-1"))

	// Verify deployment has relationships to both resources
	depRelations := cache.Get("dep-1")
	require.Len(t, depRelations["resource-to-deployment"], 2, "Deployment should relate to both resources")

	// Invalidate the deployment (the referenced entity)
	cache.InvalidateEntity("dep-1")

	// Verify deployment's relationships are cleared
	assert.False(t, cache.HasRelationships("dep-1"), "Deployment should have no relationships")
	assert.False(t, cache.IsComputed("dep-1"), "Deployment should not be marked as computed")

	// Verify resources that referenced the deployment are also invalidated (cascade)
	assert.False(t, cache.HasRelationships("res-1"), "Resource 1 should be invalidated (cascade)")
	assert.False(t, cache.IsComputed("res-1"), "Resource 1 should not be marked as computed (cascade)")
	assert.False(t, cache.HasRelationships("res-2"), "Resource 2 should be invalidated (cascade)")
	assert.False(t, cache.IsComputed("res-2"), "Resource 2 should not be marked as computed (cascade)")
}

// TestInvalidateEntity_ReverseIndexUpdated tests that the reverse index is properly maintained
func TestInvalidateEntity_ReverseIndexUpdated(t *testing.T) {
	resource := &oapi.Resource{Id: "res-1", Name: "api-server", WorkspaceId: "ws1"}
	deployment := &oapi.Deployment{Id: "dep-1", Name: "api-deployment", SystemId: "ws1"}

	matcher := createPropertyMatcher([]oapi.PropertyMatcher{
		{
			FromProperty: []string{"workspace_id"},
			ToProperty:   []string{"system_id"},
			Operator:     "equals",
		},
	})

	rule := &oapi.RelationshipRule{
		Reference: "resource-to-deployment",
		FromType:  oapi.RelatableEntityTypeResource,
		ToType:    oapi.RelatableEntityTypeDeployment,
		Matcher:   matcher,
	}

	provider := newTestProvider(
		map[string]*oapi.Resource{"res-1": resource},
		map[string]*oapi.Deployment{"dep-1": deployment},
		nil,
		map[string]*oapi.RelationshipRule{"resource-to-deployment": rule},
	)

	entityStore := NewEntityStore(provider)
	cache := NewRelationshipCache()
	engine := NewComputationEngine(entityStore, cache)

	ctx := context.Background()

	// Compute relationships
	err := engine.ComputeForEntity(ctx, "res-1")
	require.NoError(t, err)

	// Verify relationship exists
	relations := cache.Get("res-1")
	require.Len(t, relations["resource-to-deployment"], 1)

	// Invalidate the resource
	cache.InvalidateEntity("res-1")

	// Verify reverse index is cleared
	// (We can't directly test the internal reverse index, but we can test behavior)
	// Re-add the same relationship and verify no stale references exist
	err = engine.ComputeForEntity(ctx, "res-1")
	require.NoError(t, err)

	relations = cache.Get("res-1")
	require.Len(t, relations["resource-to-deployment"], 1, "Should have exactly 1 relationship, not duplicates")
}

// TestInvalidateRule_ClearsAllRelationships tests that invalidating a rule clears all relationships using that rule
func TestInvalidateRule_ClearsAllRelationships(t *testing.T) {
	resource1 := &oapi.Resource{Id: "res-1", Name: "api-server", WorkspaceId: "ws1"}
	resource2 := &oapi.Resource{Id: "res-2", Name: "db-server", WorkspaceId: "ws1"}
	deployment := &oapi.Deployment{Id: "dep-1", Name: "api-deployment", SystemId: "ws1"}
	environment := &oapi.Environment{Id: "env-1", Name: "production", SystemId: "ws1"}

	matcher := createPropertyMatcher([]oapi.PropertyMatcher{
		{
			FromProperty: []string{"workspace_id"},
			ToProperty:   []string{"system_id"},
			Operator:     "equals",
		},
	})

	rule1 := &oapi.RelationshipRule{
		Reference: "resource-to-deployment",
		FromType:  oapi.RelatableEntityTypeResource,
		ToType:    oapi.RelatableEntityTypeDeployment,
		Matcher:   matcher,
	}

	rule2 := &oapi.RelationshipRule{
		Reference: "resource-to-environment",
		FromType:  oapi.RelatableEntityTypeResource,
		ToType:    oapi.RelatableEntityTypeEnvironment,
		Matcher:   matcher,
	}

	provider := newTestProvider(
		map[string]*oapi.Resource{
			"res-1": resource1,
			"res-2": resource2,
		},
		map[string]*oapi.Deployment{"dep-1": deployment},
		map[string]*oapi.Environment{"env-1": environment},
		map[string]*oapi.RelationshipRule{
			"resource-to-deployment":  rule1,
			"resource-to-environment": rule2,
		},
	)

	entityStore := NewEntityStore(provider)
	cache := NewRelationshipCache()
	engine := NewComputationEngine(entityStore, cache)

	ctx := context.Background()

	// Compute relationships for both resources
	err := engine.ComputeForEntity(ctx, "res-1")
	require.NoError(t, err)
	err = engine.ComputeForEntity(ctx, "res-2")
	require.NoError(t, err)

	// Verify both resources have relationships for both rules
	res1Relations := cache.Get("res-1")
	require.Len(t, res1Relations, 2, "Resource 1 should have 2 rules")
	require.Len(t, res1Relations["resource-to-deployment"], 1)
	require.Len(t, res1Relations["resource-to-environment"], 1)

	res2Relations := cache.Get("res-2")
	require.Len(t, res2Relations, 2, "Resource 2 should have 2 rules")
	require.Len(t, res2Relations["resource-to-deployment"], 1)
	require.Len(t, res2Relations["resource-to-environment"], 1)

	// Invalidate rule1 (resource-to-deployment)
	cache.InvalidateRule("resource-to-deployment")

	// Verify rule is marked as dirty
	assert.True(t, cache.IsRuleDirty("resource-to-deployment"), "Rule should be marked as dirty")

	// Verify relationships for rule1 are cleared, but rule2 remains
	res1Relations = cache.Get("res-1")
	assert.NotContains(t, res1Relations, "resource-to-deployment", "Rule1 relationships should be cleared")
	require.Len(t, res1Relations, 1, "Should only have rule2 left")
	require.Len(t, res1Relations["resource-to-environment"], 1, "Rule2 relationships should remain")

	res2Relations = cache.Get("res-2")
	assert.NotContains(t, res2Relations, "resource-to-deployment", "Rule1 relationships should be cleared")
	require.Len(t, res2Relations, 1, "Should only have rule2 left")
	require.Len(t, res2Relations["resource-to-environment"], 1, "Rule2 relationships should remain")

	// Verify computation tracking for the invalidated rule is cleared
	assert.False(t, cache.IsRuleComputedForEntity("res-1", "resource-to-deployment"), "Rule computation should be cleared")
	assert.False(t, cache.IsRuleComputedForEntity("res-2", "resource-to-deployment"), "Rule computation should be cleared")

	// Verify other rule's computation tracking remains
	assert.True(t, cache.IsRuleComputedForEntity("res-1", "resource-to-environment"), "Other rule computation should remain")
	assert.True(t, cache.IsRuleComputedForEntity("res-2", "resource-to-environment"), "Other rule computation should remain")
}

// TestInvalidateRule_AllowsRecomputation tests that invalidating a rule allows it to be recomputed
func TestInvalidateRule_AllowsRecomputation(t *testing.T) {
	resource := &oapi.Resource{Id: "res-1", Name: "api-server", WorkspaceId: "ws1"}
	deployment := &oapi.Deployment{Id: "dep-1", Name: "api-deployment", SystemId: "ws1"}

	matcher := createPropertyMatcher([]oapi.PropertyMatcher{
		{
			FromProperty: []string{"workspace_id"},
			ToProperty:   []string{"system_id"},
			Operator:     "equals",
		},
	})

	rule := &oapi.RelationshipRule{
		Reference: "resource-to-deployment",
		FromType:  oapi.RelatableEntityTypeResource,
		ToType:    oapi.RelatableEntityTypeDeployment,
		Matcher:   matcher,
	}

	provider := newTestProvider(
		map[string]*oapi.Resource{"res-1": resource},
		map[string]*oapi.Deployment{"dep-1": deployment},
		nil,
		map[string]*oapi.RelationshipRule{"resource-to-deployment": rule},
	)

	entityStore := NewEntityStore(provider)
	cache := NewRelationshipCache()
	engine := NewComputationEngine(entityStore, cache)

	ctx := context.Background()

	// First computation
	err := engine.ComputeForEntity(ctx, "res-1")
	require.NoError(t, err)

	relations := cache.Get("res-1")
	require.Len(t, relations["resource-to-deployment"], 1)
	assert.True(t, cache.IsComputed("res-1"))
	assert.True(t, cache.IsRuleComputedForEntity("res-1", "resource-to-deployment"))

	// Invalidate the rule
	cache.InvalidateRule("resource-to-deployment")

	// Verify rule is dirty and relationships are cleared
	assert.True(t, cache.IsRuleDirty("resource-to-deployment"))
	relations = cache.Get("res-1")
	assert.Empty(t, relations, "Relationships should be cleared")
	assert.False(t, cache.IsComputed("res-1"), "Entity should be marked as not computed when all rules cleared")

	// Recompute - should work because rule is dirty
	err = engine.ComputeForEntity(ctx, "res-1")
	require.NoError(t, err)

	// Verify relationships are recomputed
	relations = cache.Get("res-1")
	require.Len(t, relations["resource-to-deployment"], 1, "Relationships should be recomputed")
	assert.True(t, cache.IsComputed("res-1"))
	assert.True(t, cache.IsRuleComputedForEntity("res-1", "resource-to-deployment"))
}

// TestInvalidateEntity_DeletedEntityScenario tests invalidation when an entity is deleted
func TestInvalidateEntity_DeletedEntityScenario(t *testing.T) {
	resource := &oapi.Resource{Id: "res-1", Name: "api-server", WorkspaceId: "ws1"}
	deployment := &oapi.Deployment{Id: "dep-1", Name: "api-deployment", SystemId: "ws1"}

	matcher := createPropertyMatcher([]oapi.PropertyMatcher{
		{
			FromProperty: []string{"workspace_id"},
			ToProperty:   []string{"system_id"},
			Operator:     "equals",
		},
	})

	rule := &oapi.RelationshipRule{
		Reference: "resource-to-deployment",
		FromType:  oapi.RelatableEntityTypeResource,
		ToType:    oapi.RelatableEntityTypeDeployment,
		Matcher:   matcher,
	}

	// Create provider with entities
	resourceMap := map[string]*oapi.Resource{"res-1": resource}
	deploymentMap := map[string]*oapi.Deployment{"dep-1": deployment}
	provider := newTestProvider(
		resourceMap,
		deploymentMap,
		nil,
		map[string]*oapi.RelationshipRule{"resource-to-deployment": rule},
	)

	entityStore := NewEntityStore(provider)
	cache := NewRelationshipCache()
	engine := NewComputationEngine(entityStore, cache)

	ctx := context.Background()

	// Compute relationships
	err := engine.ComputeForEntity(ctx, "res-1")
	require.NoError(t, err)

	relations := cache.Get("res-1")
	require.Len(t, relations["resource-to-deployment"], 1)

	// Simulate deletion by removing from provider and invalidating cache
	delete(deploymentMap, "dep-1")
	cache.InvalidateEntity("dep-1")

	// Invalidate entities that referenced the deleted deployment
	cache.InvalidateEntity("res-1")

	// Verify relationships are cleared
	relations = cache.Get("res-1")
	assert.Empty(t, relations, "Relationships should be cleared after deletion")

	// Try to recompute - should work but find no relationships (deployment is gone)
	err = engine.ComputeForEntity(ctx, "res-1")
	require.NoError(t, err)

	relations = cache.Get("res-1")
	assert.Empty(t, relations, "Should have no relationships since deployment was deleted")
}

// TestInvalidateEntity_MultipleReferencesCascade tests cascade with multiple entities referencing the same target
func TestInvalidateEntity_MultipleReferencesCascade(t *testing.T) {
	resource1 := &oapi.Resource{Id: "res-1", Name: "api-server", WorkspaceId: "ws1"}
	resource2 := &oapi.Resource{Id: "res-2", Name: "db-server", WorkspaceId: "ws1"}
	resource3 := &oapi.Resource{Id: "res-3", Name: "cache-server", WorkspaceId: "ws1"}
	deployment := &oapi.Deployment{Id: "dep-1", Name: "shared-deployment", SystemId: "ws1"}

	matcher := createPropertyMatcher([]oapi.PropertyMatcher{
		{
			FromProperty: []string{"workspace_id"},
			ToProperty:   []string{"system_id"},
			Operator:     "equals",
		},
	})

	rule := &oapi.RelationshipRule{
		Reference: "resource-to-deployment",
		FromType:  oapi.RelatableEntityTypeResource,
		ToType:    oapi.RelatableEntityTypeDeployment,
		Matcher:   matcher,
	}

	provider := newTestProvider(
		map[string]*oapi.Resource{
			"res-1": resource1,
			"res-2": resource2,
			"res-3": resource3,
		},
		map[string]*oapi.Deployment{"dep-1": deployment},
		nil,
		map[string]*oapi.RelationshipRule{"resource-to-deployment": rule},
	)

	entityStore := NewEntityStore(provider)
	cache := NewRelationshipCache()
	engine := NewComputationEngine(entityStore, cache)

	ctx := context.Background()

	// Compute relationships for all three resources (all relate to the same deployment)
	err := engine.ComputeForEntity(ctx, "res-1")
	require.NoError(t, err)
	err = engine.ComputeForEntity(ctx, "res-2")
	require.NoError(t, err)
	err = engine.ComputeForEntity(ctx, "res-3")
	require.NoError(t, err)

	// Verify all resources have relationships
	assert.True(t, cache.HasRelationships("res-1"))
	assert.True(t, cache.HasRelationships("res-2"))
	assert.True(t, cache.HasRelationships("res-3"))

	// Invalidate the shared deployment
	cache.InvalidateEntity("dep-1")

	// Verify all resources that referenced the deployment are invalidated
	assert.False(t, cache.HasRelationships("res-1"), "Resource 1 should be invalidated")
	assert.False(t, cache.HasRelationships("res-2"), "Resource 2 should be invalidated")
	assert.False(t, cache.HasRelationships("res-3"), "Resource 3 should be invalidated")
	assert.False(t, cache.IsComputed("res-1"))
	assert.False(t, cache.IsComputed("res-2"))
	assert.False(t, cache.IsComputed("res-3"))
}

// TestInvalidateEntity_NoUnnecessaryCascade tests that invalidation doesn't cascade to unrelated entities
func TestInvalidateEntity_NoUnnecessaryCascade(t *testing.T) {
	resource1 := &oapi.Resource{Id: "res-1", Name: "api-server", WorkspaceId: "ws1"}
	resource2 := &oapi.Resource{Id: "res-2", Name: "db-server", WorkspaceId: "ws2"}
	deployment1 := &oapi.Deployment{Id: "dep-1", Name: "deployment-1", SystemId: "ws1"}
	deployment2 := &oapi.Deployment{Id: "dep-2", Name: "deployment-2", SystemId: "ws2"}

	matcher := createPropertyMatcher([]oapi.PropertyMatcher{
		{
			FromProperty: []string{"workspace_id"},
			ToProperty:   []string{"system_id"},
			Operator:     "equals",
		},
	})

	rule := &oapi.RelationshipRule{
		Reference: "resource-to-deployment",
		FromType:  oapi.RelatableEntityTypeResource,
		ToType:    oapi.RelatableEntityTypeDeployment,
		Matcher:   matcher,
	}

	provider := newTestProvider(
		map[string]*oapi.Resource{
			"res-1": resource1,
			"res-2": resource2,
		},
		map[string]*oapi.Deployment{
			"dep-1": deployment1,
			"dep-2": deployment2,
		},
		nil,
		map[string]*oapi.RelationshipRule{"resource-to-deployment": rule},
	)

	entityStore := NewEntityStore(provider)
	cache := NewRelationshipCache()
	engine := NewComputationEngine(entityStore, cache)

	ctx := context.Background()

	// Compute relationships (res-1 -> dep-1, res-2 -> dep-2, separate pairs)
	err := engine.ComputeForEntity(ctx, "res-1")
	require.NoError(t, err)
	err = engine.ComputeForEntity(ctx, "res-2")
	require.NoError(t, err)

	// Verify both resources have relationships
	assert.True(t, cache.HasRelationships("res-1"))
	assert.True(t, cache.HasRelationships("res-2"))

	// Invalidate dep-1
	cache.InvalidateEntity("dep-1")

	// Verify only res-1 is invalidated (not res-2, since it doesn't reference dep-1)
	assert.False(t, cache.HasRelationships("res-1"), "Resource 1 should be invalidated")
	assert.True(t, cache.HasRelationships("res-2"), "Resource 2 should NOT be invalidated")
	assert.False(t, cache.IsComputed("res-1"))
	assert.True(t, cache.IsComputed("res-2"))
}

// TestInvalidateRule_OnlyAffectsSpecificRule tests that invalidating one rule doesn't affect others
func TestInvalidateRule_OnlyAffectsSpecificRule(t *testing.T) {
	resource := &oapi.Resource{Id: "res-1", Name: "api-server", WorkspaceId: "ws1"}
	deployment := &oapi.Deployment{Id: "dep-1", Name: "api-deployment", SystemId: "ws1"}
	environment := &oapi.Environment{Id: "env-1", Name: "production", SystemId: "ws1"}

	matcherResourceToOthers := createPropertyMatcher([]oapi.PropertyMatcher{
		{
			FromProperty: []string{"workspace_id"},
			ToProperty:   []string{"system_id"},
			Operator:     "equals",
		},
	})

	rule1 := &oapi.RelationshipRule{
		Reference: "resource-to-deployment",
		FromType:  oapi.RelatableEntityTypeResource,
		ToType:    oapi.RelatableEntityTypeDeployment,
		Matcher:   matcherResourceToOthers,
	}

	rule2 := &oapi.RelationshipRule{
		Reference: "resource-to-environment",
		FromType:  oapi.RelatableEntityTypeResource,
		ToType:    oapi.RelatableEntityTypeEnvironment,
		Matcher:   matcherResourceToOthers,
	}

	provider := newTestProvider(
		map[string]*oapi.Resource{"res-1": resource},
		map[string]*oapi.Deployment{"dep-1": deployment},
		map[string]*oapi.Environment{"env-1": environment},
		map[string]*oapi.RelationshipRule{
			"resource-to-deployment":  rule1,
			"resource-to-environment": rule2,
		},
	)

	entityStore := NewEntityStore(provider)
	cache := NewRelationshipCache()
	engine := NewComputationEngine(entityStore, cache)

	ctx := context.Background()

	// Compute relationships for resource only
	err := engine.ComputeForEntity(ctx, "res-1")
	require.NoError(t, err)

	// Verify resource has relationships for both rules
	resRelations := cache.Get("res-1")
	require.Len(t, resRelations, 2)
	require.Contains(t, resRelations, "resource-to-deployment")
	require.Contains(t, resRelations, "resource-to-environment")

	// Invalidate only rule1 (resource-to-deployment)
	cache.InvalidateRule("resource-to-deployment")

	// Verify only rule1 relationships are cleared from resource
	resRelations = cache.Get("res-1")
	assert.NotContains(t, resRelations, "resource-to-deployment", "Invalidated rule should be removed")
	assert.Contains(t, resRelations, "resource-to-environment", "Other rule should remain")
	require.Len(t, resRelations, 1)

	// Verify computation state
	assert.False(t, cache.IsRuleComputedForEntity("res-1", "resource-to-deployment"), "Invalidated rule should not be computed")
	assert.True(t, cache.IsRuleComputedForEntity("res-1", "resource-to-environment"), "Other rule should still be computed")
}

