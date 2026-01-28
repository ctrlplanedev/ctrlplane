package compute

import (
	"context"
	"fmt"
	"testing"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/relationships"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestFindRuleRelationships_NoSelectorNoMatcher(t *testing.T) {
	ctx := context.Background()

	// Create test resources
	resource1 := &oapi.Resource{
		Id:          "resource-1",
		Name:        "Resource 1",
		WorkspaceId: "workspace-1",
		Kind:        "pod",
		Version:     "v1",
	}
	resource2 := &oapi.Resource{
		Id:          "resource-2",
		Name:        "Resource 2",
		WorkspaceId: "workspace-1",
		Kind:        "service",
		Version:     "v1",
	}

	// Create test deployments
	deployment1 := &oapi.Deployment{
		Id:             "deployment-1",
		Name:           "Deployment 1",
		Slug:           "deployment-1",
		SystemId:       "system-1",
		JobAgentConfig: map[string]any{},
	}
	deployment2 := &oapi.Deployment{
		Id:             "deployment-2",
		Name:           "Deployment 2",
		Slug:           "deployment-2",
		SystemId:       "system-1",
		JobAgentConfig: map[string]any{},
	}

	entities := []*oapi.RelatableEntity{
		relationships.NewResourceEntity(resource1),
		relationships.NewResourceEntity(resource2),
		relationships.NewDeploymentEntity(deployment1),
		relationships.NewDeploymentEntity(deployment2),
	}

	// Rule with no selector and no matcher - should match all resource->deployment pairs
	rule := &oapi.RelationshipRule{
		Reference: "test-rule",
		FromType:  oapi.RelatableEntityTypeResource,
		ToType:    oapi.RelatableEntityTypeDeployment,
		Matcher:   oapi.RelationshipRule_Matcher{},
	}

	result, err := FindRuleRelationships(ctx, rule, entities)
	require.NoError(t, err)

	// Should have 2 resources × 2 deployments = 4 relationships
	assert.Len(t, result, 4)

	// Verify all combinations exist
	expectedPairs := map[string]bool{
		"resource-1:deployment-1": false,
		"resource-1:deployment-2": false,
		"resource-2:deployment-1": false,
		"resource-2:deployment-2": false,
	}

	for _, rel := range result {
		key := rel.From.GetID() + ":" + rel.To.GetID()
		expectedPairs[key] = true
		assert.Equal(t, oapi.RelatableEntityTypeResource, rel.From.GetType())
		assert.Equal(t, oapi.RelatableEntityTypeDeployment, rel.To.GetType())
	}

	for key, found := range expectedPairs {
		assert.True(t, found, "Expected relationship %s not found", key)
	}
}

func TestFindRuleRelationships_WithSelector(t *testing.T) {
	ctx := context.Background()

	// Create test resources with different labels
	resource1 := &oapi.Resource{
		Id:          "resource-1",
		Name:        "Resource 1",
		WorkspaceId: "workspace-1",
		Kind:        "pod",
		Version:     "v1",
		Metadata: map[string]string{
			"env": "prod",
		},
	}
	resource2 := &oapi.Resource{
		Id:          "resource-2",
		Name:        "Resource 2",
		WorkspaceId: "workspace-1",
		Kind:        "pod",
		Version:     "v1",
		Metadata: map[string]string{
			"env": "dev",
		},
	}

	deployment := &oapi.Deployment{
		Id:             "deployment-1",
		Name:           "Deployment 1",
		Slug:           "deployment-1",
		SystemId:       "system-1",
		JobAgentConfig: map[string]any{},
	}

	entities := []*oapi.RelatableEntity{
		relationships.NewResourceEntity(resource1),
		relationships.NewResourceEntity(resource2),
		relationships.NewDeploymentEntity(deployment),
	}

	// Rule with selector that only matches resources with env=prod
	fromSelector := &oapi.Selector{}
	err := fromSelector.FromCelSelector(oapi.CelSelector{
		Cel: "resource.metadata['env'] == 'prod'",
	})
	require.NoError(t, err)

	rule := &oapi.RelationshipRule{
		Reference:    "test-rule",
		FromType:     oapi.RelatableEntityTypeResource,
		FromSelector: fromSelector,
		ToType:       oapi.RelatableEntityTypeDeployment,
		Matcher:      oapi.RelationshipRule_Matcher{},
	}

	result, err := FindRuleRelationships(ctx, rule, entities)
	require.NoError(t, err)

	// Should only match resource-1 (prod) -> deployment-1
	assert.Len(t, result, 1)
	assert.Equal(t, "resource-1", result[0].From.GetID())
	assert.Equal(t, "deployment-1", result[0].To.GetID())
}

func TestFindRuleRelationships_WithCELMatcher(t *testing.T) {
	ctx := context.Background()

	// Create test resources
	resource1 := &oapi.Resource{
		Id:          "resource-1",
		Name:        "Resource 1",
		WorkspaceId: "workspace-1",
		Kind:        "pod",
		Version:     "v1",
	}
	resource2 := &oapi.Resource{
		Id:          "resource-2",
		Name:        "Resource 2",
		WorkspaceId: "workspace-2",
		Kind:        "pod",
		Version:     "v1",
	}

	// Create test deployments
	deployment1 := &oapi.Deployment{
		Id:             "deployment-1",
		Name:           "Deployment 1",
		Slug:           "deployment-1",
		SystemId:       "system-1",
		JobAgentConfig: map[string]any{"workspaceId": "workspace-1"},
	}
	deployment2 := &oapi.Deployment{
		Id:             "deployment-2",
		Name:           "Deployment 2",
		Slug:           "deployment-2",
		SystemId:       "system-2",
		JobAgentConfig: map[string]any{"workspaceId": "workspace-2"},
	}

	entities := []*oapi.RelatableEntity{
		relationships.NewResourceEntity(resource1),
		relationships.NewResourceEntity(resource2),
		relationships.NewDeploymentEntity(deployment1),
		relationships.NewDeploymentEntity(deployment2),
	}

	// Rule with CEL matcher that matches workspaceId
	var matcher oapi.RelationshipRule_Matcher
	err := matcher.FromCelMatcher(oapi.CelMatcher{
		Cel: "from.workspaceId == to.jobAgentConfig.workspaceId",
	})
	require.NoError(t, err)

	rule := &oapi.RelationshipRule{
		Reference: "test-rule",
		FromType:  oapi.RelatableEntityTypeResource,
		ToType:    oapi.RelatableEntityTypeDeployment,
		Matcher:   matcher,
	}

	result, err := FindRuleRelationships(ctx, rule, entities)
	require.NoError(t, err)

	// Should only match pairs with same workspaceId
	assert.Len(t, result, 2)

	for _, rel := range result {
		fromResource := rel.From.Item().(*oapi.Resource)
		toDeployment := rel.To.Item().(*oapi.Deployment)
		assert.Equal(t, fromResource.WorkspaceId, toDeployment.JobAgentConfig["workspaceId"])
	}
}

func TestFindRuleRelationships_WithPropertyMatcher(t *testing.T) {
	ctx := context.Background()

	// Create test resources
	resource1 := &oapi.Resource{
		Id:          "resource-1",
		Name:        "app-frontend",
		WorkspaceId: "workspace-1",
		Kind:        "pod",
		Version:     "v1",
	}
	resource2 := &oapi.Resource{
		Id:          "resource-2",
		Name:        "app-backend",
		WorkspaceId: "workspace-1",
		Kind:        "pod",
		Version:     "v1",
	}

	// Create test deployments
	deployment1 := &oapi.Deployment{
		Id:             "deployment-1",
		Name:           "app-frontend",
		Slug:           "app-frontend",
		SystemId:       "system-1",
		JobAgentConfig: map[string]any{},
	}

	entities := []*oapi.RelatableEntity{
		relationships.NewResourceEntity(resource1),
		relationships.NewResourceEntity(resource2),
		relationships.NewDeploymentEntity(deployment1),
	}

	// Rule with property matcher that matches exact name
	var matcher oapi.RelationshipRule_Matcher
	err := matcher.FromPropertiesMatcher(oapi.PropertiesMatcher{
		Properties: []oapi.PropertyMatcher{
			{
				FromProperty: []string{"name"},
				ToProperty:   []string{"name"},
				Operator:     oapi.Equals,
			},
		},
	})
	require.NoError(t, err)

	rule := &oapi.RelationshipRule{
		Reference: "test-rule",
		FromType:  oapi.RelatableEntityTypeResource,
		ToType:    oapi.RelatableEntityTypeDeployment,
		Matcher:   matcher,
	}

	result, err := FindRuleRelationships(ctx, rule, entities)
	require.NoError(t, err)

	// Should only match resource-1 (app-frontend) because deployment name equals "app-frontend"
	assert.Len(t, result, 1)
	if len(result) > 0 {
		assert.Equal(t, "resource-1", result[0].From.GetID())
		assert.Equal(t, "deployment-1", result[0].To.GetID())
	}
}

func TestFindRuleRelationships_SelfRelationshipExcluded(t *testing.T) {
	ctx := context.Background()

	// Create test resources that could match themselves
	resource1 := &oapi.Resource{
		Id:          "resource-1",
		Name:        "Resource 1",
		WorkspaceId: "workspace-1",
		Kind:        "pod",
		Version:     "v1",
	}
	resource2 := &oapi.Resource{
		Id:          "resource-2",
		Name:        "Resource 2",
		WorkspaceId: "workspace-1",
		Kind:        "pod",
		Version:     "v1",
	}

	entities := []*oapi.RelatableEntity{
		relationships.NewResourceEntity(resource1),
		relationships.NewResourceEntity(resource2),
	}

	// Rule where from and to are the same type - should exclude self-relationships
	rule := &oapi.RelationshipRule{
		Reference: "test-rule",
		FromType:  oapi.RelatableEntityTypeResource,
		ToType:    oapi.RelatableEntityTypeResource,
		Matcher:   oapi.RelationshipRule_Matcher{},
	}

	result, err := FindRuleRelationships(ctx, rule, entities)
	require.NoError(t, err)

	// Should have 2 relationships (1->2 and 2->1), but NOT 1->1 or 2->2
	assert.Len(t, result, 2)

	for _, rel := range result {
		// Ensure no self-relationships
		assert.NotEqual(t, rel.From.GetID(), rel.To.GetID(), "Self-relationship should be excluded")
	}
}

func TestFindRuleRelationships_EmptyEntities(t *testing.T) {
	ctx := context.Background()

	rule := &oapi.RelationshipRule{
		Reference: "test-rule",
		FromType:  oapi.RelatableEntityTypeResource,
		ToType:    oapi.RelatableEntityTypeDeployment,
		Matcher:   oapi.RelationshipRule_Matcher{},
	}

	result, err := FindRuleRelationships(ctx, rule, []*oapi.RelatableEntity{})
	require.NoError(t, err)
	assert.Empty(t, result)
}

func TestFindRuleRelationships_NoMatchingFromEntities(t *testing.T) {
	ctx := context.Background()

	// Only create deployments, no resources
	deployment := &oapi.Deployment{
		Id:             "deployment-1",
		Name:           "Deployment 1",
		Slug:           "deployment-1",
		SystemId:       "system-1",
		JobAgentConfig: map[string]any{},
	}

	entities := []*oapi.RelatableEntity{
		relationships.NewDeploymentEntity(deployment),
	}

	// Rule expects resources as from type
	rule := &oapi.RelationshipRule{
		Reference: "test-rule",
		FromType:  oapi.RelatableEntityTypeResource,
		ToType:    oapi.RelatableEntityTypeDeployment,
		Matcher:   oapi.RelationshipRule_Matcher{},
	}

	result, err := FindRuleRelationships(ctx, rule, entities)
	require.NoError(t, err)
	assert.Empty(t, result)
}

func TestFindRuleRelationships_NoMatchingToEntities(t *testing.T) {
	ctx := context.Background()

	// Only create resources, no deployments
	resource := &oapi.Resource{
		Id:          "resource-1",
		Name:        "Resource 1",
		WorkspaceId: "workspace-1",
		Kind:        "pod",
		Version:     "v1",
	}

	entities := []*oapi.RelatableEntity{
		relationships.NewResourceEntity(resource),
	}

	// Rule expects deployments as to type
	rule := &oapi.RelationshipRule{
		Reference: "test-rule",
		FromType:  oapi.RelatableEntityTypeResource,
		ToType:    oapi.RelatableEntityTypeDeployment,
		Matcher:   oapi.RelationshipRule_Matcher{},
	}

	result, err := FindRuleRelationships(ctx, rule, entities)
	require.NoError(t, err)
	assert.Empty(t, result)
}

func TestFindRuleRelationships_EnvironmentToResource(t *testing.T) {
	ctx := context.Background()

	// Create test environment
	environment := &oapi.Environment{
		Id:       "env-1",
		Name:     "Production",
		SystemId: "system-1",
	}

	// Create test resources
	resource := &oapi.Resource{
		Id:          "resource-1",
		Name:        "Resource 1",
		WorkspaceId: "workspace-1",
		Kind:        "pod",
		Version:     "v1",
	}

	entities := []*oapi.RelatableEntity{
		relationships.NewEnvironmentEntity(environment),
		relationships.NewResourceEntity(resource),
	}

	// Rule from environment to resource
	rule := &oapi.RelationshipRule{
		Reference: "test-rule",
		FromType:  oapi.RelatableEntityTypeEnvironment,
		ToType:    oapi.RelatableEntityTypeResource,
		Matcher:   oapi.RelationshipRule_Matcher{},
	}

	result, err := FindRuleRelationships(ctx, rule, entities)
	require.NoError(t, err)

	assert.Len(t, result, 1)
	assert.Equal(t, "env-1", result[0].From.GetID())
	assert.Equal(t, "resource-1", result[0].To.GetID())
	assert.Equal(t, oapi.RelatableEntityTypeEnvironment, result[0].From.GetType())
	assert.Equal(t, oapi.RelatableEntityTypeResource, result[0].To.GetType())
}

func TestFindRuleRelationships_MultipleMatcherConditions(t *testing.T) {
	ctx := context.Background()

	// Create test resources  with workspaceId for matching
	resource1 := &oapi.Resource{
		Id:          "resource-1",
		Name:        "prod-app",
		WorkspaceId: "workspace-1",
		Kind:        "pod",
		Version:     "v1",
	}
	resource2 := &oapi.Resource{
		Id:          "resource-2",
		Name:        "dev-app",
		WorkspaceId: "workspace-2",
		Kind:        "pod",
		Version:     "v1",
	}

	// Create test deployments with matching systemIds
	deployment1 := &oapi.Deployment{
		Id:             "deployment-1",
		Name:           "prod-deploy",
		Slug:           "prod-deploy",
		SystemId:       "workspace-1",
		JobAgentConfig: map[string]any{},
	}
	deployment2 := &oapi.Deployment{
		Id:             "deployment-2",
		Name:           "dev-deploy",
		Slug:           "dev-deploy",
		SystemId:       "workspace-2",
		JobAgentConfig: map[string]any{},
	}

	entities := []*oapi.RelatableEntity{
		relationships.NewResourceEntity(resource1),
		relationships.NewResourceEntity(resource2),
		relationships.NewDeploymentEntity(deployment1),
		relationships.NewDeploymentEntity(deployment2),
	}

	// Rule with property matcher that matches workspaceId to systemId
	var matcher oapi.RelationshipRule_Matcher
	err := matcher.FromPropertiesMatcher(oapi.PropertiesMatcher{
		Properties: []oapi.PropertyMatcher{
			{
				FromProperty: []string{"workspaceId"},
				ToProperty:   []string{"systemId"},
				Operator:     oapi.Equals,
			},
		},
	})
	require.NoError(t, err)

	rule := &oapi.RelationshipRule{
		Reference: "test-rule",
		FromType:  oapi.RelatableEntityTypeResource,
		ToType:    oapi.RelatableEntityTypeDeployment,
		Matcher:   matcher,
	}

	result, err := FindRuleRelationships(ctx, rule, entities)
	require.NoError(t, err)

	// Should match where workspaceId equals systemId
	assert.Len(t, result, 2)

	for _, rel := range result {
		fromResource := rel.From.Item().(*oapi.Resource)
		toDeployment := rel.To.Item().(*oapi.Deployment)

		// WorkspaceId should equal systemId
		assert.Equal(t, fromResource.WorkspaceId, toDeployment.SystemId)
	}
}

func TestFilterEntities(t *testing.T) {
	ctx := context.Background()

	// Create mixed entities
	resource1 := &oapi.Resource{
		Id:          "resource-1",
		Name:        "Resource 1",
		WorkspaceId: "workspace-1",
		Kind:        "pod",
		Version:     "v1",
		Metadata: map[string]string{
			"env": "prod",
		},
	}
	resource2 := &oapi.Resource{
		Id:          "resource-2",
		Name:        "Resource 2",
		WorkspaceId: "workspace-1",
		Kind:        "pod",
		Version:     "v1",
		Metadata: map[string]string{
			"env": "dev",
		},
	}

	deployment1 := &oapi.Deployment{
		Id:             "deployment-1",
		Name:           "Deployment 1",
		Slug:           "deployment-1",
		SystemId:       "system-1",
		JobAgentConfig: map[string]any{},
	}

	entities := []*oapi.RelatableEntity{
		relationships.NewResourceEntity(resource1),
		relationships.NewResourceEntity(resource2),
		relationships.NewDeploymentEntity(deployment1),
	}

	// Test filtering with selectors
	fromSelector := &oapi.Selector{}
	err := fromSelector.FromCelSelector(oapi.CelSelector{
		Cel: "resource.metadata['env'] == 'prod'",
	})
	require.NoError(t, err)

	fromEntities, toEntities := filterEntities(
		ctx,
		entities,
		oapi.RelatableEntityTypeResource,
		fromSelector,
		oapi.RelatableEntityTypeDeployment,
		nil,
	)

	assert.Len(t, fromEntities, 1, "Should filter to only prod resources")
	assert.Equal(t, "resource-1", fromEntities[0].GetID())

	assert.Len(t, toEntities, 1, "Should include all deployments")
	assert.Equal(t, "deployment-1", toEntities[0].GetID())
}

func TestFindRuleRelationships_RuleIDIsSet(t *testing.T) {
	ctx := context.Background()

	// Create test entities
	resource := &oapi.Resource{
		Id:          "resource-1",
		Name:        "Resource 1",
		WorkspaceId: "workspace-1",
		Kind:        "pod",
		Version:     "v1",
	}

	deployment := &oapi.Deployment{
		Id:             "deployment-1",
		Name:           "Deployment 1",
		Slug:           "deployment-1",
		SystemId:       "system-1",
		JobAgentConfig: map[string]any{},
	}

	entities := []*oapi.RelatableEntity{
		relationships.NewResourceEntity(resource),
		relationships.NewDeploymentEntity(deployment),
	}

	// Rule with specific ID
	rule := &oapi.RelationshipRule{
		Id:        "rule-123",
		Reference: "test-rule",
		Name:      "Test Rule",
		FromType:  oapi.RelatableEntityTypeResource,
		ToType:    oapi.RelatableEntityTypeDeployment,
		Matcher:   oapi.RelationshipRule_Matcher{},
	}

	result, err := FindRuleRelationships(ctx, rule, entities)
	require.NoError(t, err)

	// Verify Rule is set correctly
	assert.Len(t, result, 1)
	assert.NotNil(t, result[0].Rule, "Rule should be set")
	assert.Equal(t, "rule-123", result[0].Rule.Id)
	assert.Equal(t, "test-rule", result[0].Rule.Reference)
	assert.Equal(t, "Test Rule", result[0].Rule.Name)
}

func TestFindRuleRelationships_MultipleRules(t *testing.T) {
	ctx := context.Background()

	// Create test entities
	resource := &oapi.Resource{
		Id:          "resource-1",
		Name:        "app-frontend",
		WorkspaceId: "workspace-1",
		Kind:        "pod",
		Version:     "v1",
	}

	deployment := &oapi.Deployment{
		Id:             "deployment-1",
		Name:           "app-frontend",
		Slug:           "app-frontend",
		SystemId:       "system-1",
		JobAgentConfig: map[string]any{},
	}

	entities := []*oapi.RelatableEntity{
		relationships.NewResourceEntity(resource),
		relationships.NewDeploymentEntity(deployment),
	}

	// Rule 1: Match by name
	var matcher1 oapi.RelationshipRule_Matcher
	err := matcher1.FromPropertiesMatcher(oapi.PropertiesMatcher{
		Properties: []oapi.PropertyMatcher{
			{
				FromProperty: []string{"name"},
				ToProperty:   []string{"name"},
				Operator:     oapi.Equals,
			},
		},
	})
	require.NoError(t, err)

	rule1 := &oapi.RelationshipRule{
		Id:        "rule-name-match",
		Reference: "name-match-rule",
		Name:      "Name Match Rule",
		FromType:  oapi.RelatableEntityTypeResource,
		ToType:    oapi.RelatableEntityTypeDeployment,
		Matcher:   matcher1,
	}

	// Rule 2: No matcher (matches all)
	rule2 := &oapi.RelationshipRule{
		Id:        "rule-all-match",
		Reference: "all-match-rule",
		Name:      "All Match Rule",
		FromType:  oapi.RelatableEntityTypeResource,
		ToType:    oapi.RelatableEntityTypeDeployment,
		Matcher:   oapi.RelationshipRule_Matcher{},
	}

	// Test rule 1
	result1, err := FindRuleRelationships(ctx, rule1, entities)
	require.NoError(t, err)
	assert.Len(t, result1, 1)
	assert.Equal(t, "rule-name-match", result1[0].Rule.Id)

	// Test rule 2
	result2, err := FindRuleRelationships(ctx, rule2, entities)
	require.NoError(t, err)
	assert.Len(t, result2, 1)
	assert.Equal(t, "rule-all-match", result2[0].Rule.Id)

	// Verify they create different relationship keys
	assert.NotEqual(t, result1[0].Key(), result2[0].Key(), "Different rules should produce different keys")
}

func TestFindRuleRelationships_ParallelProcessing(t *testing.T) {
	ctx := context.Background()

	// Create enough entities to trigger parallel processing (>10000 pairs)
	// 150 resources × 70 deployments = 10,500 pairs
	resources := make([]*oapi.Resource, 150)
	for i := 0; i < 150; i++ {
		resources[i] = &oapi.Resource{
			Id:          fmt.Sprintf("resource-%d", i),
			Name:        fmt.Sprintf("Resource %d", i),
			WorkspaceId: "workspace-1",
			Kind:        "pod",
			Version:     "v1",
		}
	}

	deployments := make([]*oapi.Deployment, 70)
	for i := 0; i < 70; i++ {
		deployments[i] = &oapi.Deployment{
			Id:             fmt.Sprintf("deployment-%d", i),
			Name:           fmt.Sprintf("Deployment %d", i),
			Slug:           fmt.Sprintf("deployment-%d", i),
			SystemId:       "system-1",
			JobAgentConfig: map[string]any{},
		}
	}

	entities := make([]*oapi.RelatableEntity, 0, len(resources)+len(deployments))
	for _, r := range resources {
		entities = append(entities, relationships.NewResourceEntity(r))
	}
	for _, d := range deployments {
		entities = append(entities, relationships.NewDeploymentEntity(d))
	}

	// Rule that matches all (no selector, no matcher)
	rule := &oapi.RelationshipRule{
		Id:        "parallel-test-rule",
		Reference: "parallel-test",
		Name:      "Parallel Test Rule",
		FromType:  oapi.RelatableEntityTypeResource,
		ToType:    oapi.RelatableEntityTypeDeployment,
		Matcher:   oapi.RelationshipRule_Matcher{},
	}

	result, err := FindRuleRelationships(ctx, rule, entities)
	require.NoError(t, err)

	// Should match all combinations: 150 × 70 = 10,500
	assert.Len(t, result, 10500)

	// Verify all have the correct rule ID
	for _, rel := range result {
		assert.Equal(t, "parallel-test-rule", rel.Rule.Id, "Rule ID should be set in parallel processing")
		assert.Equal(t, oapi.RelatableEntityTypeResource, rel.From.GetType())
		assert.Equal(t, oapi.RelatableEntityTypeDeployment, rel.To.GetType())
	}
}

func TestFindRuleRelationships_KeyUniqueness(t *testing.T) {
	ctx := context.Background()

	// Create test entities
	resource := &oapi.Resource{
		Id:          "resource-1",
		Name:        "Resource 1",
		WorkspaceId: "workspace-1",
		Kind:        "pod",
		Version:     "v1",
	}

	deployment := &oapi.Deployment{
		Id:             "deployment-1",
		Name:           "Deployment 1",
		Slug:           "deployment-1",
		SystemId:       "system-1",
		JobAgentConfig: map[string]any{},
	}

	entities := []*oapi.RelatableEntity{
		relationships.NewResourceEntity(resource),
		relationships.NewDeploymentEntity(deployment),
	}

	// Two different rules
	rule1 := &oapi.RelationshipRule{
		Id:        "rule-1",
		Reference: "test-rule-1",
		FromType:  oapi.RelatableEntityTypeResource,
		ToType:    oapi.RelatableEntityTypeDeployment,
		Matcher:   oapi.RelationshipRule_Matcher{},
	}

	rule2 := &oapi.RelationshipRule{
		Id:        "rule-2",
		Reference: "test-rule-2",
		FromType:  oapi.RelatableEntityTypeResource,
		ToType:    oapi.RelatableEntityTypeDeployment,
		Matcher:   oapi.RelationshipRule_Matcher{},
	}

	result1, err := FindRuleRelationships(ctx, rule1, entities)
	require.NoError(t, err)

	result2, err := FindRuleRelationships(ctx, rule2, entities)
	require.NoError(t, err)

	// Both should have one relationship
	assert.Len(t, result1, 1)
	assert.Len(t, result2, 1)

	// Keys should be different because they have different rule IDs
	key1 := result1[0].Key()
	key2 := result2[0].Key()
	assert.NotEqual(t, key1, key2, "Keys should be unique per rule")

	// Keys should contain the rule ID
	assert.Contains(t, key1, "rule-1")
	assert.Contains(t, key2, "rule-2")
}
