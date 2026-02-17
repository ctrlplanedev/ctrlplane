package store

import (
	"context"
	"testing"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/statechange"
	"workspace-engine/pkg/workspace/relationships"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ============================================================================
// CEL conversion tests
// ============================================================================

func celMatcher(expr string) oapi.RelationshipRule_Matcher {
	var m oapi.RelationshipRule_Matcher
	_ = m.FromCelMatcher(oapi.CelMatcher{Cel: expr})
	return m
}

func TestRuleToCelExpression_CelMatcher(t *testing.T) {
	rule := &oapi.RelationshipRule{
		FromType: oapi.RelatableEntityTypeResource,
		ToType:   oapi.RelatableEntityTypeDeployment,
		Matcher:  celMatcher("from.name == to.name"),
	}

	expr := ruleToCelExpression(rule)
	assert.Contains(t, expr, `from.type == "resource"`)
	assert.Contains(t, expr, `to.type == "deployment"`)
	assert.Contains(t, expr, `(from.name == to.name)`)
}

func TestRuleToCelExpression_NoMatcher(t *testing.T) {
	rule := &oapi.RelationshipRule{
		FromType: oapi.RelatableEntityTypeResource,
		ToType:   oapi.RelatableEntityTypeEnvironment,
		Matcher:  oapi.RelationshipRule_Matcher{},
	}

	expr := ruleToCelExpression(rule)
	assert.Contains(t, expr, `from.type == "resource"`)
	assert.Contains(t, expr, `to.type == "environment"`)
	// Should only have the type checks
	assert.Equal(t, `from.type == "resource" && to.type == "environment"`, expr)
}

func TestRuleToV2_CelMatcher(t *testing.T) {
	rule := &oapi.RelationshipRule{
		Id:        "rule-1",
		Name:      "test-rule",
		Reference: "ref-1",
		FromType:  oapi.RelatableEntityTypeResource,
		ToType:    oapi.RelatableEntityTypeDeployment,
		Matcher:   celMatcher("from.name == to.name"),
	}

	v2Rule := ruleToV2(rule)
	require.NotNil(t, v2Rule)
	assert.Equal(t, "rule-1", v2Rule.ID)
	assert.Equal(t, "test-rule", v2Rule.Name)
	assert.Equal(t, "ref-1", v2Rule.Reference)
	assert.Contains(t, v2Rule.Matcher.Cel, `from.type == "resource"`)
	assert.Contains(t, v2Rule.Matcher.Cel, "from.name == to.name")
}

func TestRuleToV2_Description(t *testing.T) {
	desc := "my description"
	rule := &oapi.RelationshipRule{
		Id:          "rule-3",
		Name:        "desc-rule",
		Reference:   "ref-3",
		Description: &desc,
		FromType:    oapi.RelatableEntityTypeResource,
		ToType:      oapi.RelatableEntityTypeDeployment,
		Matcher:     celMatcher("true"),
	}

	v2Rule := ruleToV2(rule)
	require.NotNil(t, v2Rule)
	assert.Equal(t, "my description", v2Rule.Description)
}

// ============================================================================
// Integration tests (index set + store)
// ============================================================================

func newTestStore() *Store {
	changeset := statechange.NewChangeSet[any]()
	return New("ws-test", changeset)
}

func upsertResource(t *testing.T, s *Store, r *oapi.Resource) {
	t.Helper()
	_, err := s.Resources.Upsert(context.Background(), r)
	require.NoError(t, err)
}

func upsertDeployment(t *testing.T, s *Store, d *oapi.Deployment) {
	t.Helper()
	err := s.Deployments.Upsert(context.Background(), d)
	require.NoError(t, err)
}

func TestRelationshipIndexes_AddRuleAndRecompute(t *testing.T) {
	ctx := context.Background()
	s := newTestStore()

	// Add entities to the store
	upsertResource(t, s, &oapi.Resource{
		Id: "r1", Name: "app", WorkspaceId: "ws-test", Kind: "pod", Version: "v1",
	})
	upsertDeployment(t, s, &oapi.Deployment{
		Id: "d1", Name: "app", Slug: "d1",
		JobAgentConfig: map[string]any{},
	})

	// Add a CEL-based relationship rule
	rule := &oapi.RelationshipRule{
		Id:        "rule-1",
		Name:      "name-match",
		Reference: "name-match-ref",
		FromType:  oapi.RelatableEntityTypeResource,
		ToType:    oapi.RelatableEntityTypeDeployment,
		Matcher:   celMatcher("from.name == to.name"),
	}

	s.RelationshipIndexes.AddRule(ctx, rule)
	assert.True(t, s.RelationshipIndexes.IsDirty())

	n := s.RelationshipIndexes.Recompute(ctx)
	assert.Greater(t, n, 0)
	assert.False(t, s.RelationshipIndexes.IsDirty())

	// Query relationships for the resource
	entity := relationships.NewResourceEntity(&oapi.Resource{
		Id: "r1", Name: "app", WorkspaceId: "ws-test", Kind: "pod", Version: "v1",
	})
	related, err := s.RelationshipIndexes.GetRelatedEntities(ctx, entity)
	require.NoError(t, err)
	assert.NotEmpty(t, related)
	assert.Contains(t, related, "name-match-ref")
	assert.Len(t, related["name-match-ref"], 1)
	assert.Equal(t, "d1", related["name-match-ref"][0].EntityId)
}

func TestRelationshipIndexes_DirtyEntity(t *testing.T) {
	ctx := context.Background()
	s := newTestStore()

	upsertResource(t, s, &oapi.Resource{
		Id: "r1", Name: "old-name", WorkspaceId: "ws-test", Kind: "pod", Version: "v1",
	})
	upsertDeployment(t, s, &oapi.Deployment{
		Id: "d1", Name: "app", Slug: "d1",
		JobAgentConfig: map[string]any{},
	})

	rule := &oapi.RelationshipRule{
		Id:        "rule-1",
		Name:      "name-match",
		Reference: "ref",
		FromType:  oapi.RelatableEntityTypeResource,
		ToType:    oapi.RelatableEntityTypeDeployment,
		Matcher:   celMatcher("from.name == to.name"),
	}

	s.RelationshipIndexes.AddRule(ctx, rule)
	s.RelationshipIndexes.Recompute(ctx)

	// Initially no match (different names)
	entity := relationships.NewResourceEntity(&oapi.Resource{
		Id: "r1", Name: "old-name", WorkspaceId: "ws-test", Kind: "pod", Version: "v1",
	})
	related, _ := s.RelationshipIndexes.GetRelatedEntities(ctx, entity)
	assert.Empty(t, related)

	// Update resource name to match deployment
	upsertResource(t, s, &oapi.Resource{
		Id: "r1", Name: "app", WorkspaceId: "ws-test", Kind: "pod", Version: "v1",
	})
	s.RelationshipIndexes.DirtyEntity(ctx, "r1")
	s.RelationshipIndexes.Recompute(ctx)

	// Now should match
	entity2 := relationships.NewResourceEntity(&oapi.Resource{
		Id: "r1", Name: "app", WorkspaceId: "ws-test", Kind: "pod", Version: "v1",
	})
	related2, _ := s.RelationshipIndexes.GetRelatedEntities(ctx, entity2)
	assert.NotEmpty(t, related2)
}

func TestRelationshipIndexes_RemoveRule(t *testing.T) {
	ctx := context.Background()
	s := newTestStore()

	upsertResource(t, s, &oapi.Resource{
		Id: "r1", Name: "app", WorkspaceId: "ws-test", Kind: "pod", Version: "v1",
	})
	upsertDeployment(t, s, &oapi.Deployment{
		Id: "d1", Name: "app", Slug: "d1",
		JobAgentConfig: map[string]any{},
	})

	rule := &oapi.RelationshipRule{
		Id:        "rule-1",
		Name:      "name-match",
		Reference: "ref",
		FromType:  oapi.RelatableEntityTypeResource,
		ToType:    oapi.RelatableEntityTypeDeployment,
		Matcher:   celMatcher("from.name == to.name"),
	}

	s.RelationshipIndexes.AddRule(ctx, rule)
	s.RelationshipIndexes.Recompute(ctx)

	entity := relationships.NewResourceEntity(&oapi.Resource{
		Id: "r1", Name: "app", WorkspaceId: "ws-test", Kind: "pod", Version: "v1",
	})
	related, _ := s.RelationshipIndexes.GetRelatedEntities(ctx, entity)
	assert.NotEmpty(t, related)

	// Remove the rule
	s.RelationshipIndexes.RemoveRule("rule-1")

	related2, _ := s.RelationshipIndexes.GetRelatedEntities(ctx, entity)
	assert.Empty(t, related2)
}

func TestRelationshipIndexes_AddEntity(t *testing.T) {
	ctx := context.Background()
	s := newTestStore()

	upsertResource(t, s, &oapi.Resource{
		Id: "r1", Name: "app", WorkspaceId: "ws-test", Kind: "pod", Version: "v1",
	})

	rule := &oapi.RelationshipRule{
		Id:        "rule-1",
		Name:      "name-match",
		Reference: "ref",
		FromType:  oapi.RelatableEntityTypeResource,
		ToType:    oapi.RelatableEntityTypeDeployment,
		Matcher:   celMatcher("from.name == to.name"),
	}
	s.RelationshipIndexes.AddRule(ctx, rule)
	s.RelationshipIndexes.Recompute(ctx)

	// No deployment yet
	entity := relationships.NewResourceEntity(&oapi.Resource{
		Id: "r1", Name: "app", WorkspaceId: "ws-test", Kind: "pod", Version: "v1",
	})
	related, _ := s.RelationshipIndexes.GetRelatedEntities(ctx, entity)
	assert.Empty(t, related)

	// Add a deployment after rule is set up
	upsertDeployment(t, s, &oapi.Deployment{
		Id: "d1", Name: "app", Slug: "d1",
		JobAgentConfig: map[string]any{},
	})
	s.RelationshipIndexes.AddEntity(ctx, "d1")
	s.RelationshipIndexes.Recompute(ctx)

	related2, _ := s.RelationshipIndexes.GetRelatedEntities(ctx, entity)
	assert.NotEmpty(t, related2)
}

func TestRelationshipIndexes_RemoveEntity(t *testing.T) {
	ctx := context.Background()
	s := newTestStore()

	upsertResource(t, s, &oapi.Resource{
		Id: "r1", Name: "app", WorkspaceId: "ws-test", Kind: "pod", Version: "v1",
	})
	upsertDeployment(t, s, &oapi.Deployment{
		Id: "d1", Name: "app", Slug: "d1",
		JobAgentConfig: map[string]any{},
	})

	rule := &oapi.RelationshipRule{
		Id:        "rule-1",
		Name:      "name-match",
		Reference: "ref",
		FromType:  oapi.RelatableEntityTypeResource,
		ToType:    oapi.RelatableEntityTypeDeployment,
		Matcher:   celMatcher("from.name == to.name"),
	}
	s.RelationshipIndexes.AddRule(ctx, rule)
	s.RelationshipIndexes.Recompute(ctx)

	entity := relationships.NewResourceEntity(&oapi.Resource{
		Id: "r1", Name: "app", WorkspaceId: "ws-test", Kind: "pod", Version: "v1",
	})
	related, _ := s.RelationshipIndexes.GetRelatedEntities(ctx, entity)
	assert.NotEmpty(t, related)

	// Remove the deployment
	s.RelationshipIndexes.RemoveEntity(ctx, "d1")

	related2, _ := s.RelationshipIndexes.GetRelatedEntities(ctx, entity)
	assert.Empty(t, related2)
}

func TestRelationshipIndexes_TypeFilterBlocksMismatch(t *testing.T) {
	ctx := context.Background()
	s := newTestStore()

	// Both are resources with the same name
	upsertResource(t, s, &oapi.Resource{
		Id: "r1", Name: "app", WorkspaceId: "ws-test", Kind: "pod", Version: "v1",
	})
	upsertResource(t, s, &oapi.Resource{
		Id: "r2", Name: "app", WorkspaceId: "ws-test", Kind: "pod", Version: "v1",
	})

	// Rule expects resource→deployment, so two resources should NOT match
	rule := &oapi.RelationshipRule{
		Id:        "rule-1",
		Name:      "name-match",
		Reference: "ref",
		FromType:  oapi.RelatableEntityTypeResource,
		ToType:    oapi.RelatableEntityTypeDeployment,
		Matcher:   celMatcher("from.name == to.name"),
	}
	s.RelationshipIndexes.AddRule(ctx, rule)
	s.RelationshipIndexes.Recompute(ctx)

	entity := relationships.NewResourceEntity(&oapi.Resource{
		Id: "r1", Name: "app", WorkspaceId: "ws-test", Kind: "pod", Version: "v1",
	})
	related, err := s.RelationshipIndexes.GetRelatedEntities(ctx, entity)
	require.NoError(t, err)
	assert.Empty(t, related)
}
