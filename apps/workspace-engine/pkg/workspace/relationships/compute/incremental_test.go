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

func TestFindRelationsForEntityAndRule_FromEntity(t *testing.T) {
	ctx := context.Background()

	// Create a changed resource
	changedResource := &oapi.Resource{
		Id:          "resource-1",
		Name:        "Resource 1",
		WorkspaceId: "workspace-1",
		Kind:        "pod",
		Version:     "v1",
		Metadata:    map[string]string{"region": "us-east"},
	}

	// Create deployments that should match
	deployment1 := &oapi.Deployment{
		Id:             "deployment-1",
		Name:           "Deployment 1",
		Slug:           "deployment-1",
		SystemId:       "system-1",
		JobAgentConfig: map[string]any{"region": "us-east"},
	}
	deployment2 := &oapi.Deployment{
		Id:             "deployment-2",
		Name:           "Deployment 2",
		Slug:           "deployment-2",
		SystemId:       "system-2",
		JobAgentConfig: map[string]any{"region": "us-west"},
	}

	allEntities := []*oapi.RelatableEntity{
		relationships.NewResourceEntity(changedResource),
		relationships.NewDeploymentEntity(deployment1),
		relationships.NewDeploymentEntity(deployment2),
	}

	// Rule with CEL matcher
	var matcher oapi.RelationshipRule_Matcher
	err := matcher.FromCelMatcher(oapi.CelMatcher{
		Cel: "from.metadata.region == to.jobAgentConfig.region",
	})
	require.NoError(t, err)

	rule := &oapi.RelationshipRule{
		Id:        "rule-123",
		Reference: "test-rule",
		FromType:  oapi.RelatableEntityTypeResource,
		ToType:    oapi.RelatableEntityTypeDeployment,
		Matcher:   matcher,
	}

	// Find relationships for changed resource
	relations := FindRelationsForEntityAndRule(ctx, rule, relationships.NewResourceEntity(changedResource), allEntities)

	// Should only match deployment-1 (same region)
	assert.Len(t, relations, 1)
	assert.Equal(t, "resource-1", relations[0].From.GetID())
	assert.Equal(t, "deployment-1", relations[0].To.GetID())
	assert.Equal(t, "rule-123", relations[0].Rule.Id)
}

func TestFindRelationsForEntityAndRule_ToEntity(t *testing.T) {
	ctx := context.Background()

	// Create resources
	resource1 := &oapi.Resource{
		Id:          "resource-1",
		Name:        "Resource 1",
		WorkspaceId: "workspace-1",
		Kind:        "pod",
		Version:     "v1",
		Metadata:    map[string]string{"region": "us-east"},
	}
	resource2 := &oapi.Resource{
		Id:          "resource-2",
		Name:        "Resource 2",
		WorkspaceId: "workspace-1",
		Kind:        "pod",
		Version:     "v1",
		Metadata:    map[string]string{"region": "us-west"},
	}

	// Create a changed deployment
	changedDeployment := &oapi.Deployment{
		Id:             "deployment-1",
		Name:           "Deployment 1",
		Slug:           "deployment-1",
		SystemId:       "system-1",
		JobAgentConfig: map[string]interface{}{"region": "us-east"},
	}

	allEntities := []*oapi.RelatableEntity{
		relationships.NewResourceEntity(resource1),
		relationships.NewResourceEntity(resource2),
		relationships.NewDeploymentEntity(changedDeployment),
	}

	// Rule with CEL matcher
	var matcher oapi.RelationshipRule_Matcher
	err := matcher.FromCelMatcher(oapi.CelMatcher{
		Cel: "from.metadata.region == to.jobAgentConfig.region",
	})
	require.NoError(t, err)

	rule := &oapi.RelationshipRule{
		Id:        "rule-456",
		Reference: "test-rule",
		FromType:  oapi.RelatableEntityTypeResource,
		ToType:    oapi.RelatableEntityTypeDeployment,
		Matcher:   matcher,
	}

	// Find relationships for changed deployment
	relations := FindRelationsForEntityAndRule(ctx, rule, relationships.NewDeploymentEntity(changedDeployment), allEntities)

	// Should only match resource-1 (same region)
	assert.Len(t, relations, 1)
	assert.Equal(t, "resource-1", relations[0].From.GetID())
	assert.Equal(t, "deployment-1", relations[0].To.GetID())
	assert.Equal(t, "rule-456", relations[0].Rule.Id)
}

func TestFindRelationsForEntityAndRule_SelfReferenceExcluded_FromCase(t *testing.T) {
	ctx := context.Background()

	// Create a changed resource
	changedResource := &oapi.Resource{
		Id:          "resource-1",
		Name:        "app-frontend",
		WorkspaceId: "workspace-1",
		Kind:        "pod",
		Version:     "v1",
	}

	// Create other resources
	resource2 := &oapi.Resource{
		Id:          "resource-2",
		Name:        "app-backend",
		WorkspaceId: "workspace-1",
		Kind:        "pod",
		Version:     "v1",
	}

	allEntities := []*oapi.RelatableEntity{
		relationships.NewResourceEntity(changedResource),
		relationships.NewResourceEntity(resource2),
	}

	// Rule: resource -> resource (same type)
	var matcher oapi.RelationshipRule_Matcher
	err := matcher.FromCelMatcher(oapi.CelMatcher{
		Cel: "from.workspaceId == to.workspaceId",
	})
	require.NoError(t, err)

	rule := &oapi.RelationshipRule{
		Id:        "self-test-from",
		Reference: "test-rule",
		FromType:  oapi.RelatableEntityTypeResource,
		ToType:    oapi.RelatableEntityTypeResource,
		Matcher:   matcher,
	}

	// Find relationships where changed entity participates
	// In a bidirectional rule (resource -> resource), the entity is processed
	// both as "from" and "to", so we get both directions
	relations := FindRelationsForEntityAndRule(ctx, rule, relationships.NewResourceEntity(changedResource), allEntities)

	// Should match:
	// - resource-1 -> resource-2 (as from)
	// - resource-2 -> resource-1 (as to)
	// Should NOT match: resource-1 -> resource-1
	assert.Len(t, relations, 2)

	// Verify no self-relationships
	for _, rel := range relations {
		assert.NotEqual(t, rel.From.GetID(), rel.To.GetID(), "Self-relationship should be excluded in FROM case")
	}
}

func TestFindRelationsForEntityAndRule_SelfReferenceExcluded_ToCase(t *testing.T) {
	ctx := context.Background()

	// Create a changed resource
	changedResource := &oapi.Resource{
		Id:          "resource-1",
		Name:        "app-frontend",
		WorkspaceId: "workspace-1",
		Kind:        "pod",
		Version:     "v1",
	}

	// Create other resources
	resource2 := &oapi.Resource{
		Id:          "resource-2",
		Name:        "app-backend",
		WorkspaceId: "workspace-1",
		Kind:        "pod",
		Version:     "v1",
	}

	allEntities := []*oapi.RelatableEntity{
		relationships.NewResourceEntity(changedResource),
		relationships.NewResourceEntity(resource2),
	}

	// Rule: resource -> resource (same type)
	var matcher oapi.RelationshipRule_Matcher
	err := matcher.FromCelMatcher(oapi.CelMatcher{
		Cel: "from.workspaceId == to.workspaceId",
	})
	require.NoError(t, err)

	rule := &oapi.RelationshipRule{
		Id:        "self-test-to",
		Reference: "test-rule",
		FromType:  oapi.RelatableEntityTypeResource,
		ToType:    oapi.RelatableEntityTypeResource,
		Matcher:   matcher,
	}

	// Find relationships where changed entity is a "to" entity
	relations := FindRelationsForEntityAndRule(ctx, rule, relationships.NewResourceEntity(changedResource), allEntities)

	// Should match:
	// - resource-1 -> resource-2 (changed entity as "from")
	// - resource-2 -> resource-1 (changed entity as "to")
	// Should NOT match: resource-1 -> resource-1
	assert.Len(t, relations, 2)

	// Verify no self-relationships
	for _, rel := range relations {
		assert.NotEqual(t, rel.From.GetID(), rel.To.GetID(), "Self-relationship should be excluded in TO case")
	}
}

func TestFindRelationsForEntityAndRule_BothDirections(t *testing.T) {
	ctx := context.Background()

	// Create a changed resource
	changedResource := &oapi.Resource{
		Id:          "resource-1",
		Name:        "app-frontend",
		WorkspaceId: "workspace-1",
		Kind:        "pod",
		Version:     "v1",
	}

	// Create other resources
	resource2 := &oapi.Resource{
		Id:          "resource-2",
		Name:        "app-backend",
		WorkspaceId: "workspace-1",
		Kind:        "pod",
		Version:     "v1",
	}
	resource3 := &oapi.Resource{
		Id:          "resource-3",
		Name:        "app-database",
		WorkspaceId: "workspace-1",
		Kind:        "database",
		Version:     "v1",
	}

	allEntities := []*oapi.RelatableEntity{
		relationships.NewResourceEntity(changedResource),
		relationships.NewResourceEntity(resource2),
		relationships.NewResourceEntity(resource3),
	}

	// Rule: resource -> resource (same workspaceId)
	var matcher oapi.RelationshipRule_Matcher
	err := matcher.FromCelMatcher(oapi.CelMatcher{
		Cel: "from.workspaceId == to.workspaceId",
	})
	require.NoError(t, err)

	rule := &oapi.RelationshipRule{
		Id:        "bidirectional-rule",
		Reference: "test-rule",
		FromType:  oapi.RelatableEntityTypeResource,
		ToType:    oapi.RelatableEntityTypeResource,
		Matcher:   matcher,
	}

	// Find relationships for changed resource (acts as both from and to)
	relations := FindRelationsForEntityAndRule(ctx, rule, relationships.NewResourceEntity(changedResource), allEntities)

	// Should match:
	// As from: resource-1 -> resource-2, resource-1 -> resource-3
	// As to: resource-2 -> resource-1, resource-3 -> resource-1
	assert.Len(t, relations, 4)

	// Verify no self-relationships
	for _, rel := range relations {
		assert.NotEqual(t, rel.From.GetID(), rel.To.GetID(), "Self-relationship should be excluded")
	}
}

func TestFindRelationsForEntityAndRule_NoMatchWrongType(t *testing.T) {
	ctx := context.Background()

	// Create an environment (wrong type for the rule)
	environment := &oapi.Environment{
		Id:       "env-1",
		Name:     "Production",
		SystemId: "system-1",
	}

	deployment := &oapi.Deployment{
		Id:             "deployment-1",
		Name:           "Deployment 1",
		Slug:           "deployment-1",
		SystemId:       "system-1",
		JobAgentConfig: map[string]interface{}{},
	}

	allEntities := []*oapi.RelatableEntity{
		relationships.NewEnvironmentEntity(environment),
		relationships.NewDeploymentEntity(deployment),
	}

	// Rule: resource -> deployment (environment doesn't match)
	rule := &oapi.RelationshipRule{
		Id:        "type-mismatch",
		Reference: "test-rule",
		FromType:  oapi.RelatableEntityTypeResource,
		ToType:    oapi.RelatableEntityTypeDeployment,
		Matcher:   oapi.RelationshipRule_Matcher{},
	}

	// Find relationships for environment (wrong type)
	relations := FindRelationsForEntityAndRule(ctx, rule, relationships.NewEnvironmentEntity(environment), allEntities)

	// Should have no relationships
	assert.Empty(t, relations)
}

func TestFindRelationsForEntityAndRule_NoMatchSelectorMismatch(t *testing.T) {
	ctx := context.Background()

	// Create a resource that doesn't match selector
	resource := &oapi.Resource{
		Id:          "resource-1",
		Name:        "Resource 1",
		WorkspaceId: "workspace-1",
		Kind:        "pod",
		Version:     "v1",
		Metadata:    map[string]string{"env": "dev"},
	}

	deployment := &oapi.Deployment{
		Id:             "deployment-1",
		Name:           "Deployment 1",
		Slug:           "deployment-1",
		SystemId:       "system-1",
		JobAgentConfig: map[string]interface{}{},
	}

	allEntities := []*oapi.RelatableEntity{
		relationships.NewResourceEntity(resource),
		relationships.NewDeploymentEntity(deployment),
	}

	// Selector that only matches env="prod"
	fromSelector := &oapi.Selector{}
	err := fromSelector.FromCelSelector(oapi.CelSelector{
		Cel: "resource.metadata['env'] == 'prod'",
	})
	require.NoError(t, err)

	rule := &oapi.RelationshipRule{
		Id:           "selector-mismatch",
		Reference:    "test-rule",
		FromType:     oapi.RelatableEntityTypeResource,
		FromSelector: fromSelector,
		ToType:       oapi.RelatableEntityTypeDeployment,
		Matcher:      oapi.RelationshipRule_Matcher{},
	}

	// Resource has env="dev", not "prod"
	relations := FindRelationsForEntityAndRule(ctx, rule, relationships.NewResourceEntity(resource), allEntities)

	// Should have no relationships
	assert.Empty(t, relations)
}

func TestFindRelationsForEntity_MultipleRules(t *testing.T) {
	ctx := context.Background()

	// Create a changed resource
	changedResource := &oapi.Resource{
		Id:          "resource-1",
		Name:        "app-frontend",
		WorkspaceId: "workspace-1",
		Kind:        "pod",
		Version:     "v1",
	}

	// Create a deployment
	deployment := &oapi.Deployment{
		Id:             "deployment-1",
		Name:           "app-frontend",
		Slug:           "app-frontend",
		SystemId:       "workspace-1",
		JobAgentConfig: map[string]interface{}{},
	}

	allEntities := []*oapi.RelatableEntity{
		relationships.NewResourceEntity(changedResource),
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
		Id:        "rule-name",
		Reference: "name-rule",
		FromType:  oapi.RelatableEntityTypeResource,
		ToType:    oapi.RelatableEntityTypeDeployment,
		Matcher:   matcher1,
	}

	// Rule 2: Match by workspaceId = systemId
	var matcher2 oapi.RelationshipRule_Matcher
	err = matcher2.FromPropertiesMatcher(oapi.PropertiesMatcher{
		Properties: []oapi.PropertyMatcher{
			{
				FromProperty: []string{"workspaceId"},
				ToProperty:   []string{"systemId"},
				Operator:     oapi.Equals,
			},
		},
	})
	require.NoError(t, err)

	rule2 := &oapi.RelationshipRule{
		Id:        "rule-workspace",
		Reference: "workspace-rule",
		FromType:  oapi.RelatableEntityTypeResource,
		ToType:    oapi.RelatableEntityTypeDeployment,
		Matcher:   matcher2,
	}

	rules := []*oapi.RelationshipRule{rule1, rule2}

	// Find relationships across all rules
	relations := FindRelationsForEntity(ctx, rules, relationships.NewResourceEntity(changedResource), allEntities)

	// Should match both rules
	assert.Len(t, relations, 2)

	// Check that we have relations from both rules
	ruleIDs := make(map[string]bool)
	for _, rel := range relations {
		ruleIDs[rel.Rule.Id] = true
		assert.Equal(t, "resource-1", rel.From.GetID())
		assert.Equal(t, "deployment-1", rel.To.GetID())
	}

	assert.True(t, ruleIDs["rule-name"], "Should have relation from rule-name")
	assert.True(t, ruleIDs["rule-workspace"], "Should have relation from rule-workspace")
}

func TestFindRemovedRelations(t *testing.T) {
	ctx := context.Background()

	// Create some old relations
	resource := &oapi.Resource{Id: "resource-1"}
	deployment1 := &oapi.Deployment{Id: "deployment-1"}
	deployment2 := &oapi.Deployment{Id: "deployment-2"}
	deployment3 := &oapi.Deployment{Id: "deployment-3"}

	rule := &oapi.RelationshipRule{Id: "rule-1"}

	oldRelations := []*relationships.EntityRelation{
		{
			Rule: rule,
			From: relationships.NewResourceEntity(resource),
			To:   relationships.NewDeploymentEntity(deployment1),
		},
		{
			Rule: rule,
			From: relationships.NewResourceEntity(resource),
			To:   relationships.NewDeploymentEntity(deployment2),
		},
		{
			Rule: rule,
			From: relationships.NewResourceEntity(resource),
			To:   relationships.NewDeploymentEntity(deployment3),
		},
	}

	// New relations (deployment2 was removed)
	newRelations := []*relationships.EntityRelation{
		{
			Rule: rule,
			From: relationships.NewResourceEntity(resource),
			To:   relationships.NewDeploymentEntity(deployment1),
		},
		{
			Rule: rule,
			From: relationships.NewResourceEntity(resource),
			To:   relationships.NewDeploymentEntity(deployment3),
		},
	}

	// Find removed relations
	removedRelations := FindRemovedRelations(ctx, oldRelations, newRelations)

	// Should find that deployment2 was removed
	assert.Len(t, removedRelations, 1)
	assert.Equal(t, "deployment-2", removedRelations[0].To.GetID())
}

func TestFindRemovedRelations_AllRemoved(t *testing.T) {
	ctx := context.Background()

	resource := &oapi.Resource{Id: "resource-1"}
	deployment := &oapi.Deployment{Id: "deployment-1"}
	rule := &oapi.RelationshipRule{Id: "rule-1"}

	oldRelations := []*relationships.EntityRelation{
		{
			Rule: rule,
			From: relationships.NewResourceEntity(resource),
			To:   relationships.NewDeploymentEntity(deployment),
		},
	}

	newRelations := []*relationships.EntityRelation{}

	removedRelations := FindRemovedRelations(ctx, oldRelations, newRelations)

	assert.Len(t, removedRelations, 1)
	assert.Equal(t, "deployment-1", removedRelations[0].To.GetID())
}

func TestFindRemovedRelations_NoneRemoved(t *testing.T) {
	ctx := context.Background()

	resource := &oapi.Resource{Id: "resource-1"}
	deployment := &oapi.Deployment{Id: "deployment-1"}
	rule := &oapi.RelationshipRule{Id: "rule-1"}

	oldRelations := []*relationships.EntityRelation{
		{
			Rule: rule,
			From: relationships.NewResourceEntity(resource),
			To:   relationships.NewDeploymentEntity(deployment),
		},
	}

	newRelations := []*relationships.EntityRelation{
		{
			Rule: rule,
			From: relationships.NewResourceEntity(resource),
			To:   relationships.NewDeploymentEntity(deployment),
		},
	}

	removedRelations := FindRemovedRelations(ctx, oldRelations, newRelations)

	assert.Empty(t, removedRelations)
}

func TestFilterEntitiesByTypeAndSelector(t *testing.T) {
	ctx := context.Background()

	// Create mixed entities
	resource1 := &oapi.Resource{
		Id:          "resource-1",
		Name:        "Resource 1",
		WorkspaceId: "workspace-1",
		Kind:        "pod",
		Version:     "v1",
		Metadata:    map[string]string{"env": "prod"},
	}
	resource2 := &oapi.Resource{
		Id:          "resource-2",
		Name:        "Resource 2",
		WorkspaceId: "workspace-1",
		Kind:        "pod",
		Version:     "v1",
		Metadata:    map[string]string{"env": "dev"},
	}
	deployment := &oapi.Deployment{
		Id:             "deployment-1",
		Name:           "Deployment 1",
		Slug:           "deployment-1",
		SystemId:       "system-1",
		JobAgentConfig: map[string]any{},
	}

	allEntities := []*oapi.RelatableEntity{
		relationships.NewResourceEntity(resource1),
		relationships.NewResourceEntity(resource2),
		relationships.NewDeploymentEntity(deployment),
	}

	// Test 1: Filter by type only (no selector)
	resources := filterEntitiesByTypeAndSelector(ctx, allEntities, oapi.RelatableEntityTypeResource, nil)
	assert.Len(t, resources, 2)

	deployments := filterEntitiesByTypeAndSelector(ctx, allEntities, oapi.RelatableEntityTypeDeployment, nil)
	assert.Len(t, deployments, 1)

	// Test 2: Filter by type and selector
	selector := &oapi.Selector{}
	err := selector.FromCelSelector(oapi.CelSelector{
		Cel: "resource.metadata['env'] == 'prod'",
	})
	require.NoError(t, err)

	prodResources := filterEntitiesByTypeAndSelector(ctx, allEntities, oapi.RelatableEntityTypeResource, selector)
	assert.Len(t, prodResources, 1)
	assert.Equal(t, "resource-1", prodResources[0].GetID())
}

func TestFindRelationsForEntityAndRule_LargeDataset(t *testing.T) {
	ctx := context.Background()

	// Create a changed resource
	changedResource := &oapi.Resource{
		Id:          "resource-changed",
		Name:        "Changed Resource",
		WorkspaceId: "workspace-1",
		Kind:        "pod",
		Version:     "v1",
	}

	// Create many deployments
	numDeployments := 100
	allEntities := []*oapi.RelatableEntity{
		relationships.NewResourceEntity(changedResource),
	}

	for i := 0; i < numDeployments; i++ {
		deployment := &oapi.Deployment{
			Id:             fmt.Sprintf("deployment-%d", i),
			Name:           fmt.Sprintf("Deployment %d", i),
			Slug:           fmt.Sprintf("deployment-%d", i),
			SystemId:       "system-1",
			JobAgentConfig: map[string]interface{}{},
		}
		allEntities = append(allEntities, relationships.NewDeploymentEntity(deployment))
	}

	// Rule that matches all
	rule := &oapi.RelationshipRule{
		Id:        "large-test",
		Reference: "test-rule",
		FromType:  oapi.RelatableEntityTypeResource,
		ToType:    oapi.RelatableEntityTypeDeployment,
		Matcher:   oapi.RelationshipRule_Matcher{},
	}

	// Find relationships
	relations := FindRelationsForEntityAndRule(ctx, rule, relationships.NewResourceEntity(changedResource), allEntities)

	// Should match all 100 deployments
	assert.Len(t, relations, numDeployments)

	// Verify all have correct from entity
	for _, rel := range relations {
		assert.Equal(t, "resource-changed", rel.From.GetID())
		assert.Equal(t, "large-test", rel.Rule.Id)
	}
}
