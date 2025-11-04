package relationgraph

import (
	"context"
	"fmt"
	"testing"

	"workspace-engine/pkg/oapi"
)

// TestNewBuilder tests creating a new builder
func TestNewBuilder(t *testing.T) {
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
		"rule1": {Reference: "rule1", FromType: oapi.RelatableEntityTypeResource, ToType: oapi.RelatableEntityTypeDeployment},
	}

	builder := NewBuilder(resources, deployments, environments, rules)

	if builder == nil {
		t.Fatal("NewBuilder returned nil")
	}

	if builder.resources == nil {
		t.Error("resources should be set")
	}

	if builder.deployments == nil {
		t.Error("deployments should be set")
	}

	if builder.environments == nil {
		t.Error("environments should be set")
	}

	if builder.rules == nil {
		t.Error("rules should be set")
	}

	// Check default options are set
	if builder.options.MaxConcurrency != 10 {
		t.Errorf("expected MaxConcurrency 10, got %d", builder.options.MaxConcurrency)
	}
}

// TestBuilder_WithOptions tests setting custom options
func TestBuilder_WithOptions(t *testing.T) {
	builder := NewBuilder(
		map[string]*oapi.Resource{},
		map[string]*oapi.Deployment{},
		map[string]*oapi.Environment{},
		map[string]*oapi.RelationshipRule{},
	)

	// Test WithMaxConcurrency
	result := builder.WithMaxConcurrency(20)

	// Should return the builder for chaining
	if result != builder {
		t.Error("WithMaxConcurrency should return the builder")
	}

	if builder.options.MaxConcurrency != 20 {
		t.Errorf("expected MaxConcurrency 20, got %d", builder.options.MaxConcurrency)
	}

	// Test WithParallelProcessing
	result2 := builder.WithParallelProcessing(true)

	if result2 != builder {
		t.Error("WithParallelProcessing should return the builder")
	}

	if !builder.options.UseParallelProcessing {
		t.Error("UseParallelProcessing should be true")
	}

	// Test WithChunkSize
	result3 := builder.WithChunkSize(50)

	if result3 != builder {
		t.Error("WithChunkSize should return the builder")
	}

	if builder.options.ChunkSize != 50 {
		t.Errorf("expected ChunkSize 50, got %d", builder.options.ChunkSize)
	}
}

// TestBuilder_GetAllEntities tests collecting all entities
func TestBuilder_GetAllEntities(t *testing.T) {
	resources := map[string]*oapi.Resource{
		"r1": {Id: "r1", WorkspaceId: "ws1"},
		"r2": {Id: "r2", WorkspaceId: "ws1"},
	}
	deployments := map[string]*oapi.Deployment{
		"d1": {Id: "d1", SystemId: "sys1"},
	}
	environments := map[string]*oapi.Environment{
		"e1": {Id: "e1", SystemId: "sys1"},
		"e2": {Id: "e2", SystemId: "sys1"},
		"e3": {Id: "e3", SystemId: "sys1"},
	}

	builder := NewBuilder(
		resources,
		deployments,
		environments,
		map[string]*oapi.RelationshipRule{},
	)

	entities := builder.getAllEntities()

	// Should have all entities: 2 resources + 1 deployment + 3 environments = 6
	expectedCount := 6
	if len(entities) != expectedCount {
		t.Errorf("expected %d entities, got %d", expectedCount, len(entities))
	}

	// Count by type
	resourceCount := 0
	deploymentCount := 0
	environmentCount := 0

	for _, entity := range entities {
		switch entity.GetType() {
		case oapi.RelatableEntityTypeResource:
			resourceCount++
		case oapi.RelatableEntityTypeDeployment:
			deploymentCount++
		case oapi.RelatableEntityTypeEnvironment:
			environmentCount++
		}
	}

	if resourceCount != 2 {
		t.Errorf("expected 2 resources, got %d", resourceCount)
	}

	if deploymentCount != 1 {
		t.Errorf("expected 1 deployment, got %d", deploymentCount)
	}

	if environmentCount != 3 {
		t.Errorf("expected 3 environments, got %d", environmentCount)
	}
}

// TestBuilder_FilterEntities tests filtering entities by type and selector
func TestBuilder_FilterEntities(t *testing.T) {
	builder := NewBuilder(
		map[string]*oapi.Resource{
			"r1": {Id: "r1", Name: "prod-resource", WorkspaceId: "ws1", Metadata: map[string]string{"env": "production"}},
			"r2": {Id: "r2", Name: "dev-resource", WorkspaceId: "ws1", Metadata: map[string]string{"env": "development"}},
		},
		map[string]*oapi.Deployment{
			"d1": {Id: "d1", Name: "prod-deploy", SystemId: "sys1"},
		},
		map[string]*oapi.Environment{},
		map[string]*oapi.RelationshipRule{},
	)

	allEntities := builder.getAllEntities()

	tests := []struct {
		name          string
		entityType    oapi.RelatableEntityType
		selector      *oapi.Selector
		expectedCount int
	}{
		{
			name:          "filter resources with no selector",
			entityType:    oapi.RelatableEntityTypeResource,
			selector:      nil,
			expectedCount: 2,
		},
		{
			name:          "filter deployments with no selector",
			entityType:    oapi.RelatableEntityTypeDeployment,
			selector:      nil,
			expectedCount: 1,
		},
		{
			name:          "filter environments with no selector",
			entityType:    oapi.RelatableEntityTypeEnvironment,
			selector:      nil,
			expectedCount: 0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			filtered := builder.filterEntities(context.Background(), allEntities, tt.entityType, tt.selector)

			if len(filtered) != tt.expectedCount {
				t.Errorf("expected %d entities, got %d", tt.expectedCount, len(filtered))
			}

			// Verify all filtered entities have correct type
			for _, entity := range filtered {
				if entity.GetType() != tt.entityType {
					t.Errorf("expected type %v, got %v", tt.entityType, entity.GetType())
				}
			}
		})
	}
}

// TestBuilder_Build_Empty tests building a graph with no entities or rules
func TestBuilder_Build_Empty(t *testing.T) {
	builder := NewBuilder(
		map[string]*oapi.Resource{},
		map[string]*oapi.Deployment{},
		map[string]*oapi.Environment{},
		map[string]*oapi.RelationshipRule{},
	)

	graph, err := builder.Build(context.Background())

	if err != nil {
		t.Fatalf("Build failed: %v", err)
	}

	if graph == nil {
		t.Fatal("Build returned nil graph")
	}

	stats := graph.GetStats()
	if stats.EntityCount != 0 {
		t.Errorf("expected EntityCount 0, got %d", stats.EntityCount)
	}

	if stats.RuleCount != 0 {
		t.Errorf("expected RuleCount 0, got %d", stats.RuleCount)
	}

	if stats.RelationCount != 0 {
		t.Errorf("expected RelationCount 0, got %d", stats.RelationCount)
	}
}

// TestBuilder_Build_SimpleRelationship tests building a graph with a simple relationship
func TestBuilder_Build_SimpleRelationship(t *testing.T) {
	resources := map[string]*oapi.Resource{
		"r1": {Id: "r1", Name: "resource-1", WorkspaceId: "ws1"},
	}

	deployments := map[string]*oapi.Deployment{
		"d1": {Id: "d1", Name: "deployment-1", SystemId: "ws1"},
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

	builder := NewBuilder(
		resources,
		deployments,
		map[string]*oapi.Environment{},
		rules,
	)

	graph, err := builder.Build(context.Background())

	if err != nil {
		t.Fatalf("Build failed: %v", err)
	}

	stats := graph.GetStats()
	if stats.EntityCount != 2 {
		t.Errorf("expected EntityCount 2, got %d", stats.EntityCount)
	}

	if stats.RuleCount != 1 {
		t.Errorf("expected RuleCount 1, got %d", stats.RuleCount)
	}

	// Should have 2 relations: r1->d1 and d1->r1
	if stats.RelationCount != 2 {
		t.Errorf("expected RelationCount 2, got %d", stats.RelationCount)
	}

	// Check forward relationship: r1 -> d1
	r1Relations := graph.GetRelatedEntities("r1")
	if len(r1Relations) == 0 {
		t.Fatal("expected relations for r1")
	}

	ruleRelations := r1Relations["resource-to-deployment"]
	if len(ruleRelations) != 1 {
		t.Errorf("expected 1 relation, got %d", len(ruleRelations))
	}

	if ruleRelations[0].EntityId != "d1" {
		t.Errorf("expected EntityId 'd1', got %s", ruleRelations[0].EntityId)
	}

	if ruleRelations[0].Direction != oapi.To {
		t.Errorf("expected Direction 'to', got %v", ruleRelations[0].Direction)
	}

	// Check reverse relationship: d1 -> r1
	d1Relations := graph.GetRelatedEntities("d1")
	if len(d1Relations) == 0 {
		t.Fatal("expected relations for d1")
	}

	reverseRelations := d1Relations["resource-to-deployment"]
	if len(reverseRelations) != 1 {
		t.Errorf("expected 1 reverse relation, got %d", len(reverseRelations))
	}

	if reverseRelations[0].EntityId != "r1" {
		t.Errorf("expected EntityId 'r1', got %s", reverseRelations[0].EntityId)
	}

	if reverseRelations[0].Direction != oapi.From {
		t.Errorf("expected Direction 'from', got %v", reverseRelations[0].Direction)
	}
}

// TestBuilder_Build_NoMatches tests building a graph where no entities match
func TestBuilder_Build_NoMatches(t *testing.T) {
	resources := map[string]*oapi.Resource{
		"r1": {Id: "r1", Name: "resource-1", WorkspaceId: "ws1"},
	}

	deployments := map[string]*oapi.Deployment{
		"d1": {Id: "d1", Name: "deployment-1", SystemId: "ws2"},
	}

	// Rule that won't match (different workspace/system IDs)
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

	builder := NewBuilder(
		resources,
		deployments,
		map[string]*oapi.Environment{},
		rules,
	)

	graph, err := builder.Build(context.Background())

	if err != nil {
		t.Fatalf("Build failed: %v", err)
	}

	stats := graph.GetStats()
	if stats.RelationCount != 0 {
		t.Errorf("expected RelationCount 0, got %d", stats.RelationCount)
	}

	// Verify no relations exist
	r1Relations := graph.GetRelatedEntities("r1")
	if len(r1Relations) != 0 {
		t.Errorf("expected no relations for r1, got %d", len(r1Relations))
	}

	d1Relations := graph.GetRelatedEntities("d1")
	if len(d1Relations) != 0 {
		t.Errorf("expected no relations for d1, got %d", len(d1Relations))
	}
}

// TestBuilder_Build_MultipleRules tests building a graph with multiple rules
func TestBuilder_Build_MultipleRules(t *testing.T) {
	resources := map[string]*oapi.Resource{
		"r1": {Id: "r1", Name: "prod-resource", WorkspaceId: "ws1", Metadata: map[string]string{"env": "production"}},
	}

	deployments := map[string]*oapi.Deployment{
		"d1": {Id: "d1", Name: "prod-deployment", SystemId: "ws1"},
	}

	environments := map[string]*oapi.Environment{
		"e1": {Id: "e1", Name: "prod", SystemId: "ws1"},
	}

	var matcher1 oapi.RelationshipRule_Matcher
	_ = matcher1.FromPropertiesMatcher(oapi.PropertiesMatcher{
		Properties: []oapi.PropertyMatcher{
			{
				FromProperty: []string{"workspace_id"},
				ToProperty:   []string{"system_id"},
				Operator:     "equals",
			},
		},
	})

	var matcher2 oapi.RelationshipRule_Matcher
	_ = matcher2.FromPropertiesMatcher(oapi.PropertiesMatcher{
		Properties: []oapi.PropertyMatcher{
			{
				FromProperty: []string{"name"},
				ToProperty:   []string{"name"},
				Operator:     "contains",
			},
		},
	})

	rules := map[string]*oapi.RelationshipRule{
		"resource-to-deployment": {
			Reference: "resource-to-deployment",
			FromType:  oapi.RelatableEntityTypeResource,
			ToType:    oapi.RelatableEntityTypeDeployment,
			Matcher:   matcher1,
		},
		"deployment-to-environment": {
			Reference: "deployment-to-environment",
			FromType:  oapi.RelatableEntityTypeDeployment,
			ToType:    oapi.RelatableEntityTypeEnvironment,
			Matcher:   matcher2,
		},
	}

	builder := NewBuilder(
		resources,
		deployments,
		environments,
		rules,
	)

	graph, err := builder.Build(context.Background())

	if err != nil {
		t.Fatalf("Build failed: %v", err)
	}

	stats := graph.GetStats()
	if stats.RuleCount != 2 {
		t.Errorf("expected RuleCount 2, got %d", stats.RuleCount)
	}

	// Should have relations for both rules
	// resource-to-deployment: r1->d1, d1->r1 (2 relations)
	// deployment-to-environment: d1->e1, e1->d1 (2 relations)
	// Total: 4 relations
	if stats.RelationCount != 4 {
		t.Errorf("expected RelationCount 4, got %d", stats.RelationCount)
	}

	// Verify r1 has relation to d1
	r1Relations := graph.GetRelatedEntities("r1")
	if len(r1Relations["resource-to-deployment"]) != 1 {
		t.Error("expected r1 to have relation to d1")
	}

	// Verify d1 has relations to both r1 and e1
	d1Relations := graph.GetRelatedEntities("d1")
	if len(d1Relations) != 2 {
		t.Errorf("expected d1 to have 2 rule relations, got %d", len(d1Relations))
	}

	// Verify e1 has relation to d1
	e1Relations := graph.GetRelatedEntities("e1")
	if len(e1Relations["deployment-to-environment"]) != 1 {
		t.Error("expected e1 to have relation to d1")
	}
}

// TestBuilder_Build_ManyToMany tests building a graph with many-to-many relationships
func TestBuilder_Build_ManyToMany(t *testing.T) {
	resources := map[string]*oapi.Resource{
		"r1": {Id: "r1", WorkspaceId: "ws1"},
		"r2": {Id: "r2", WorkspaceId: "ws1"},
	}

	deployments := map[string]*oapi.Deployment{
		"d1": {Id: "d1", SystemId: "ws1"},
		"d2": {Id: "d2", SystemId: "ws1"},
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

	builder := NewBuilder(
		resources,
		deployments,
		map[string]*oapi.Environment{},
		rules,
	)

	graph, err := builder.Build(context.Background())

	if err != nil {
		t.Fatalf("Build failed: %v", err)
	}

	// Each resource should connect to both deployments and vice versa
	// r1->d1, r1->d2, r2->d1, r2->d2 (4 forward relations)
	// d1->r1, d1->r2, d2->r1, d2->r2 (4 reverse relations)
	// Total: 8 relations
	stats := graph.GetStats()
	if stats.RelationCount != 8 {
		t.Errorf("expected RelationCount 8, got %d", stats.RelationCount)
	}

	// Verify r1 has 2 relations (to d1 and d2)
	r1Relations := graph.GetRelatedEntities("r1")
	if len(r1Relations["resource-to-deployment"]) != 2 {
		t.Errorf("expected r1 to have 2 relations, got %d", len(r1Relations["resource-to-deployment"]))
	}

	// Verify d1 has 2 relations (to r1 and r2)
	d1Relations := graph.GetRelatedEntities("d1")
	if len(d1Relations["resource-to-deployment"]) != 2 {
		t.Errorf("expected d1 to have 2 relations, got %d", len(d1Relations["resource-to-deployment"]))
	}
}

// TestBuilder_Build_WithSelectors tests building with entity selectors
func TestBuilder_Build_WithSelectors(t *testing.T) {
	resources := map[string]*oapi.Resource{
		"r1": {Id: "r1", Name: "prod-resource", WorkspaceId: "ws1", Metadata: map[string]string{"env": "production"}},
		"r2": {Id: "r2", Name: "dev-resource", WorkspaceId: "ws1", Metadata: map[string]string{"env": "development"}},
	}

	deployments := map[string]*oapi.Deployment{
		"d1": {Id: "d1", SystemId: "ws1"},
	}

	// Create selector using CEL expression to match resources with env=production metadata
	var selector oapi.Selector
	_ = selector.FromCelSelector(oapi.CelSelector{
		Cel: "resource.metadata['env'] == 'production'",
	})

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

	// Rule that only applies to production resources
	rules := map[string]*oapi.RelationshipRule{
		"prod-resource-to-deployment": {
			Reference:    "prod-resource-to-deployment",
			FromType:     oapi.RelatableEntityTypeResource,
			ToType:       oapi.RelatableEntityTypeDeployment,
			FromSelector: &selector,
			Matcher:      matcher,
		},
	}

	builder := NewBuilder(
		resources,
		deployments,
		map[string]*oapi.Environment{},
		rules,
	)

	graph, err := builder.Build(context.Background())

	if err != nil {
		t.Fatalf("Build failed: %v", err)
	}

	// Only r1 (production) should have a relation to d1
	// r1->d1, d1->r1 (2 relations)
	stats := graph.GetStats()
	if stats.RelationCount != 2 {
		t.Errorf("expected RelationCount 2, got %d", stats.RelationCount)
	}

	// Verify r1 has relation to d1
	r1Relations := graph.GetRelatedEntities("r1")
	if len(r1Relations["prod-resource-to-deployment"]) != 1 {
		t.Error("expected r1 to have relation to d1")
	}

	// Verify r2 has no relations
	r2Relations := graph.GetRelatedEntities("r2")
	if len(r2Relations) != 0 {
		t.Errorf("expected r2 to have no relations, got %d", len(r2Relations))
	}
}

// TestBuilder_Build_WithStatusUpdates tests status update callback functionality
func TestBuilder_Build_WithStatusUpdates(t *testing.T) {
	resources := map[string]*oapi.Resource{
		"r1": {Id: "r1", WorkspaceId: "ws1"},
		"r2": {Id: "r2", WorkspaceId: "ws1"},
	}

	deployments := map[string]*oapi.Deployment{
		"d1": {Id: "d1", SystemId: "ws1"},
		"d2": {Id: "d2", SystemId: "ws1"},
	}

	var matcher1 oapi.RelationshipRule_Matcher
	_ = matcher1.FromPropertiesMatcher(oapi.PropertiesMatcher{
		Properties: []oapi.PropertyMatcher{
			{
				FromProperty: []string{"workspace_id"},
				ToProperty:   []string{"system_id"},
				Operator:     "equals",
			},
		},
	})

	var matcher2 oapi.RelationshipRule_Matcher
	_ = matcher2.FromPropertiesMatcher(oapi.PropertiesMatcher{
		Properties: []oapi.PropertyMatcher{
			{
				FromProperty: []string{"id"},
				ToProperty:   []string{"id"},
				Operator:     "not_equals",
			},
		},
	})

	rules := map[string]*oapi.RelationshipRule{
		"rule1": {
			Reference: "rule1",
			FromType:  oapi.RelatableEntityTypeResource,
			ToType:    oapi.RelatableEntityTypeDeployment,
			Matcher:   matcher1,
		},
		"rule2": {
			Reference: "rule2",
			FromType:  oapi.RelatableEntityTypeResource,
			ToType:    oapi.RelatableEntityTypeDeployment,
			Matcher:   matcher2,
		},
	}

	// Capture status messages
	var statusMessages []string
	setStatus := func(msg string) {
		statusMessages = append(statusMessages, msg)
	}

	builder := NewBuilder(
		resources,
		deployments,
		map[string]*oapi.Environment{},
		rules,
	).WithSetStatus(setStatus)

	graph, err := builder.Build(context.Background())

	if err != nil {
		t.Fatalf("Build failed: %v", err)
	}

	if graph == nil {
		t.Fatal("Build returned nil graph")
	}

	// Verify status messages were called
	if len(statusMessages) == 0 {
		t.Error("expected status messages, got none")
	}

	// Should have: initial message, rule processing messages, and final message
	if len(statusMessages) < 3 {
		t.Errorf("expected at least 3 status messages, got %d", len(statusMessages))
	}

	// Check first message
	if statusMessages[0] != "Building relationship graph..." {
		t.Errorf("expected first message to be 'Building relationship graph...', got %s", statusMessages[0])
	}

	// Check last message
	lastMsg := statusMessages[len(statusMessages)-1]
	if lastMsg != "Relationship graph built successfully" {
		t.Errorf("expected last message to be 'Relationship graph built successfully', got %s", lastMsg)
	}

	// Check for percentage in middle messages
	hasPercentage := false
	for i := 1; i < len(statusMessages)-1; i++ {
		if len(statusMessages[i]) > 0 && (statusMessages[i][len(statusMessages[i])-1] == '%' || statusMessages[i][len(statusMessages[i])-2] == '%') {
			hasPercentage = true
			break
		}
	}

	if !hasPercentage {
		t.Error("expected at least one status message with percentage")
	}
}

// TestBuilder_Build_ParallelProcessing tests parallel processing of entity pairs
func TestBuilder_Build_ParallelProcessing(t *testing.T) {
	// Create a larger dataset to benefit from parallel processing
	resources := make(map[string]*oapi.Resource)
	deployments := make(map[string]*oapi.Deployment)

	// Create 150 resources
	for i := 0; i < 150; i++ {
		id := fmt.Sprintf("r%d", i)
		resources[id] = &oapi.Resource{
			Id:          id,
			WorkspaceId: "ws1",
		}
	}

	// Create 50 deployments
	for i := 0; i < 50; i++ {
		id := fmt.Sprintf("d%d", i)
		deployments[id] = &oapi.Deployment{
			Id:       id,
			SystemId: "ws1",
		}
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

	// Build with sequential processing
	sequentialBuilder := NewBuilder(
		resources,
		deployments,
		map[string]*oapi.Environment{},
		rules,
	)

	sequentialGraph, err := sequentialBuilder.Build(context.Background())
	if err != nil {
		t.Fatalf("Sequential build failed: %v", err)
	}

	// Build with parallel processing
	parallelBuilder := NewBuilder(
		resources,
		deployments,
		map[string]*oapi.Environment{},
		rules,
	).WithParallelProcessing(true).WithChunkSize(50).WithMaxConcurrency(4)

	parallelGraph, err := parallelBuilder.Build(context.Background())
	if err != nil {
		t.Fatalf("Parallel build failed: %v", err)
	}

	// Both should produce identical results
	seqStats := sequentialGraph.GetStats()
	parStats := parallelGraph.GetStats()

	if seqStats.RelationCount != parStats.RelationCount {
		t.Errorf("RelationCount mismatch: sequential=%d, parallel=%d", seqStats.RelationCount, parStats.RelationCount)
	}

	if seqStats.EntityCount != parStats.EntityCount {
		t.Errorf("EntityCount mismatch: sequential=%d, parallel=%d", seqStats.EntityCount, parStats.EntityCount)
	}

	// Verify a sample resource has the same relationships in both graphs
	seqRelations := sequentialGraph.GetRelatedEntities("r0")
	parRelations := parallelGraph.GetRelatedEntities("r0")

	if len(seqRelations) != len(parRelations) {
		t.Errorf("r0 relation count mismatch: sequential=%d, parallel=%d", len(seqRelations), len(parRelations))
	}

	// Expected: 150 resources × 50 deployments × 2 (bidirectional) = 15,000 relations
	expectedRelations := 150 * 50 * 2
	if seqStats.RelationCount != expectedRelations {
		t.Errorf("expected %d relations, got %d", expectedRelations, seqStats.RelationCount)
	}
}
