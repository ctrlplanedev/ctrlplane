package eval

import (
	"context"
	"fmt"
	"maps"
	"sort"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

func newID() uuid.UUID { return uuid.New() }

func resourceEntity(id, wsID uuid.UUID, name, kind string, extra map[string]any) EntityData {
	raw := map[string]any{
		"type": "resource",
		"id":   id.String(),
		"name": name,
		"kind": kind,
	}
	maps.Copy(raw, extra)
	return EntityData{ID: id, WorkspaceID: wsID, EntityType: "resource", Raw: raw}
}

func deploymentEntity(id, wsID uuid.UUID, name, slug string, extra map[string]any) EntityData {
	raw := map[string]any{
		"type": "deployment",
		"id":   id.String(),
		"name": name,
		"slug": slug,
	}
	maps.Copy(raw, extra)
	return EntityData{ID: id, WorkspaceID: wsID, EntityType: "deployment", Raw: raw}
}

func environmentEntity(id, wsID uuid.UUID, name string) EntityData {
	return EntityData{
		ID: id, WorkspaceID: wsID, EntityType: "environment",
		Raw: map[string]any{"type": "environment", "id": id.String(), "name": name},
	}
}

func nameMatchRule(ruleID uuid.UUID, ref, fromType, toType string) Rule {
	cel := fmt.Sprintf(
		`from.type == "%s" && to.type == "%s" && from.name == to.name`,
		fromType, toType,
	)
	return Rule{ID: ruleID, Reference: ref, Cel: cel}
}

// mockLoader returns pre-configured candidates by entity type.
type mockLoader struct {
	candidates map[string][]EntityData
	err        error
}

func (m *mockLoader) LoadCandidates(_ context.Context, _ uuid.UUID, entityType string) ([]EntityData, error) {
	if m.err != nil {
		return nil, m.err
	}
	return m.candidates[entityType], nil
}

// sortMatches provides deterministic ordering for assertions.
func sortMatches(ms []Match) {
	sort.Slice(ms, func(i, j int) bool {
		if ms[i].FromEntityID != ms[j].FromEntityID {
			return ms[i].FromEntityID.String() < ms[j].FromEntityID.String()
		}
		return ms[i].ToEntityID.String() < ms[j].ToEntityID.String()
	})
}

// ---------------------------------------------------------------------------
// EvaluateRule
// ---------------------------------------------------------------------------

func TestEvaluateRule_EntityIsFrom_MatchingCandidates(t *testing.T) {
	wsID := newID()
	entityID := newID()
	candidateID := newID()
	ruleID := newID()

	entity := resourceEntity(entityID, wsID, "web", "Server", nil)
	candidate := deploymentEntity(candidateID, wsID, "web", "web", nil)

	rule := nameMatchRule(ruleID, "dep", "resource", "deployment")

	matches, err := EvaluateRule(context.Background(), &entity, &rule, []EntityData{candidate})
	require.NoError(t, err)
	require.Len(t, matches, 1)

	assert.Equal(t, ruleID, matches[0].RuleID)
	assert.Equal(t, "dep", matches[0].Reference)
	assert.Equal(t, entityID, matches[0].FromEntityID)
	assert.Equal(t, "resource", matches[0].FromEntityType)
	assert.Equal(t, candidateID, matches[0].ToEntityID)
	assert.Equal(t, "deployment", matches[0].ToEntityType)
}

func TestEvaluateRule_EntityIsTo_MatchingCandidates(t *testing.T) {
	wsID := newID()
	entityID := newID()
	candidateID := newID()
	ruleID := newID()

	entity := deploymentEntity(entityID, wsID, "api", "api", nil)
	candidate := resourceEntity(candidateID, wsID, "api", "Server", nil)

	rule := nameMatchRule(ruleID, "res", "resource", "deployment")

	matches, err := EvaluateRule(context.Background(), &entity, &rule, []EntityData{candidate})
	require.NoError(t, err)
	require.Len(t, matches, 1)

	assert.Equal(t, candidateID, matches[0].FromEntityID)
	assert.Equal(t, "resource", matches[0].FromEntityType)
	assert.Equal(t, entityID, matches[0].ToEntityID)
	assert.Equal(t, "deployment", matches[0].ToEntityType)
}

func TestEvaluateRule_EntityIsBothFromAndTo(t *testing.T) {
	wsID := newID()
	entityID := newID()
	c1 := newID()
	c2 := newID()
	ruleID := newID()

	entity := resourceEntity(entityID, wsID, "shared", "Server", nil)
	candidate1 := resourceEntity(c1, wsID, "shared", "Server", nil)
	candidate2 := resourceEntity(c2, wsID, "other", "Server", nil)

	rule := Rule{
		ID: ruleID, Reference: "peer", Cel: `from.type == "resource" && to.type == "resource" && from.name == to.name`,
	}

	matches, err := EvaluateRule(context.Background(), &entity, &rule, []EntityData{candidate1, candidate2})
	require.NoError(t, err)

	// entity is both from and to; candidate1 matches in both directions.
	// from-direction: entity→candidate1 (name matches)
	// to-direction:   candidate1→entity (name matches)
	require.Len(t, matches, 2)

	sortMatches(matches)
	ids := []uuid.UUID{matches[0].FromEntityID, matches[0].ToEntityID, matches[1].FromEntityID, matches[1].ToEntityID}
	assert.Contains(t, ids, entityID)
	assert.Contains(t, ids, c1)
}

func TestEvaluateRule_NoMatchingCandidates(t *testing.T) {
	wsID := newID()
	entity := resourceEntity(newID(), wsID, "web", "Server", nil)
	candidate := deploymentEntity(newID(), wsID, "api", "api", nil)

	rule := nameMatchRule(newID(), "dep", "resource", "deployment")

	matches, err := EvaluateRule(context.Background(), &entity, &rule, []EntityData{candidate})
	require.NoError(t, err)
	assert.Empty(t, matches)
}

func TestEvaluateRule_SkipsSelf(t *testing.T) {
	wsID := newID()
	entityID := newID()

	entity := resourceEntity(entityID, wsID, "web", "Server", nil)
	self := resourceEntity(entityID, wsID, "web", "Server", nil)

	rule := Rule{
		ID: newID(), Reference: "self", Cel: `from.type == "resource" && to.type == "resource" && true`,
	}

	matches, err := EvaluateRule(context.Background(), &entity, &rule, []EntityData{self})
	require.NoError(t, err)
	assert.Empty(t, matches)
}

func TestEvaluateRule_EntityTypeNotInRule(t *testing.T) {
	wsID := newID()
	entity := environmentEntity(newID(), wsID, "prod")
	candidate := resourceEntity(newID(), wsID, "web", "Server", nil)

	rule := nameMatchRule(newID(), "dep", "resource", "deployment")

	matches, err := EvaluateRule(context.Background(), &entity, &rule, []EntityData{candidate})
	require.NoError(t, err)
	assert.Empty(t, matches)
}

func TestEvaluateRule_EmptyCandidates(t *testing.T) {
	wsID := newID()
	entity := resourceEntity(newID(), wsID, "web", "Server", nil)
	rule := nameMatchRule(newID(), "dep", "resource", "deployment")

	matches, err := EvaluateRule(context.Background(), &entity, &rule, nil)
	require.NoError(t, err)
	assert.Empty(t, matches)
}

func TestEvaluateRule_CELCompileError(t *testing.T) {
	entity := resourceEntity(newID(), newID(), "web", "Server", nil)
	rule := Rule{
		ID: newID(), Reference: "bad", Cel: "this is not valid CEL !!!",
	}
	candidate := deploymentEntity(newID(), newID(), "web", "web", nil)

	_, err := EvaluateRule(context.Background(), &entity, &rule, []EntityData{candidate})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "compile rule CEL")
}

func TestEvaluateRule_MultipleCandidates_PartialMatch(t *testing.T) {
	wsID := newID()
	entityID := newID()
	c1 := newID()
	c2 := newID()
	c3 := newID()
	ruleID := newID()

	entity := resourceEntity(entityID, wsID, "web", "Server", nil)
	candidates := []EntityData{
		deploymentEntity(c1, wsID, "web", "web", nil),
		deploymentEntity(c2, wsID, "api", "api", nil),
		deploymentEntity(c3, wsID, "backend", "backend", nil),
	}

	rule := nameMatchRule(ruleID, "dep", "resource", "deployment")

	matches, err := EvaluateRule(context.Background(), &entity, &rule, candidates)
	require.NoError(t, err)
	require.Len(t, matches, 1)
	assert.Equal(t, c1, matches[0].ToEntityID)
}

func TestEvaluateRule_CEL_MetadataFieldMatch(t *testing.T) {
	wsID := newID()
	entityID := newID()
	c1 := newID()
	c2 := newID()

	entity := resourceEntity(entityID, wsID, "web", "Server", map[string]any{
		"metadata": map[string]any{"region": "us-east-1"},
	})

	candidates := []EntityData{
		resourceEntity(c1, wsID, "db", "Database", map[string]any{
			"metadata": map[string]any{"region": "us-east-1"},
		}),
		resourceEntity(c2, wsID, "cache", "Cache", map[string]any{
			"metadata": map[string]any{"region": "eu-west-1"},
		}),
	}

	rule := Rule{
		ID: newID(), Reference: "same-region",
		Cel: `from.metadata.region == to.metadata.region`,
	}

	// Same-type rule: entity is evaluated as both from and to.
	// c1 matches in both directions (same region), so we get 2 matches.
	matches, err := EvaluateRule(context.Background(), &entity, &rule, candidates)
	require.NoError(t, err)
	require.Len(t, matches, 2)

	matchedIDs := map[uuid.UUID]bool{}
	for _, m := range matches {
		matchedIDs[m.FromEntityID] = true
		matchedIDs[m.ToEntityID] = true
	}
	assert.True(t, matchedIDs[entityID])
	assert.True(t, matchedIDs[c1])
}

func TestEvaluateRule_CEL_IDMatch(t *testing.T) {
	wsID := newID()
	entityID := newID()
	targetID := newID()
	otherID := newID()

	entity := resourceEntity(entityID, wsID, "web", "Server", nil)
	candidates := []EntityData{
		resourceEntity(targetID, wsID, "db", "Database", nil),
		resourceEntity(otherID, wsID, "cache", "Cache", nil),
	}

	rule := Rule{
		ID: newID(), Reference: "db",
		Cel: fmt.Sprintf(`to.id == "%s"`, targetID.String()),
	}

	matches, err := EvaluateRule(context.Background(), &entity, &rule, candidates)
	require.NoError(t, err)
	require.Len(t, matches, 1)
	assert.Equal(t, targetID, matches[0].ToEntityID)
}

// ---------------------------------------------------------------------------
// EvaluateRules
// ---------------------------------------------------------------------------

func TestEvaluateRules_MultipleRules(t *testing.T) {
	wsID := newID()
	entityID := newID()
	depID := newID()
	envID := newID()

	entity := resourceEntity(entityID, wsID, "web", "Server", nil)

	loader := &mockLoader{
		candidates: map[string][]EntityData{
			"deployment":  {deploymentEntity(depID, wsID, "web", "web", nil)},
			"environment": {environmentEntity(envID, wsID, "web")},
		},
	}

	rules := []Rule{
		nameMatchRule(newID(), "dep", "resource", "deployment"),
		nameMatchRule(newID(), "env", "resource", "environment"),
	}

	matches, err := EvaluateRules(context.Background(), loader, &entity, rules)
	require.NoError(t, err)
	require.Len(t, matches, 2)

	toIDs := map[uuid.UUID]bool{}
	for _, m := range matches {
		toIDs[m.ToEntityID] = true
	}
	assert.True(t, toIDs[depID])
	assert.True(t, toIDs[envID])
}

func TestEvaluateRules_SkipsIrrelevantRules(t *testing.T) {
	wsID := newID()
	entity := environmentEntity(newID(), wsID, "prod")

	loader := &mockLoader{
		candidates: map[string][]EntityData{
			"deployment": {deploymentEntity(newID(), wsID, "prod", "prod", nil)},
		},
	}

	rules := []Rule{
		nameMatchRule(newID(), "dep", "resource", "deployment"),
	}

	matches, err := EvaluateRules(context.Background(), loader, &entity, rules)
	require.NoError(t, err)
	assert.Empty(t, matches)
}

func TestEvaluateRules_EmptyRules(t *testing.T) {
	entity := resourceEntity(newID(), newID(), "web", "Server", nil)
	loader := &mockLoader{}

	matches, err := EvaluateRules(context.Background(), loader, &entity, nil)
	require.NoError(t, err)
	assert.Empty(t, matches)
}

func TestEvaluateRules_LoaderError(t *testing.T) {
	wsID := newID()
	entity := resourceEntity(newID(), wsID, "web", "Server", nil)

	loader := &mockLoader{err: fmt.Errorf("db connection failed")}
	rules := []Rule{nameMatchRule(newID(), "dep", "resource", "deployment")}

	_, err := EvaluateRules(context.Background(), loader, &entity, rules)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "load candidates")
	assert.Contains(t, err.Error(), "db connection failed")
}

func TestEvaluateRules_CELErrorPropagated(t *testing.T) {
	wsID := newID()
	entity := resourceEntity(newID(), wsID, "web", "Server", nil)

	loader := &mockLoader{
		candidates: map[string][]EntityData{
			"deployment": {deploymentEntity(newID(), wsID, "web", "web", nil)},
		},
	}

	rules := []Rule{{
		ID: newID(), Reference: "bad", Cel: "not valid!!!",
	}}

	_, err := EvaluateRules(context.Background(), loader, &entity, rules)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "evaluate rule")
}

// ---------------------------------------------------------------------------
// ResolveForReference
// ---------------------------------------------------------------------------

func TestResolveForReference_FiltersToMatchingReference(t *testing.T) {
	wsID := newID()
	entityID := newID()
	dbID := newID()
	cacheID := newID()

	entity := resourceEntity(entityID, wsID, "web", "Server", nil)

	loader := &mockLoader{
		candidates: map[string][]EntityData{
			"resource": {
				resourceEntity(dbID, wsID, "web", "Database", nil),
				resourceEntity(cacheID, wsID, "web", "Cache", nil),
			},
		},
	}

	dbRuleID := newID()
	cacheRuleID := newID()

	rules := []Rule{
		{
			ID: dbRuleID, Reference: "database",
			Cel: `to.kind == "Database"`,
		},
		{
			ID: cacheRuleID, Reference: "cache",
			Cel: `to.kind == "Cache"`,
		},
	}

	matches, err := ResolveForReference(context.Background(), loader, &entity, rules, "database")
	require.NoError(t, err)
	require.Len(t, matches, 1)
	assert.Equal(t, dbRuleID, matches[0].RuleID)
	assert.Equal(t, "database", matches[0].Reference)
	assert.Equal(t, dbID, matches[0].ToEntityID)
}

func TestResolveForReference_NoMatchingReference(t *testing.T) {
	entity := resourceEntity(newID(), newID(), "web", "Server", nil)
	loader := &mockLoader{}
	rules := []Rule{nameMatchRule(newID(), "dep", "resource", "deployment")}

	matches, err := ResolveForReference(context.Background(), loader, &entity, rules, "nonexistent")
	require.NoError(t, err)
	assert.Nil(t, matches)
}

func TestResolveForReference_EmptyRules(t *testing.T) {
	entity := resourceEntity(newID(), newID(), "web", "Server", nil)
	loader := &mockLoader{}

	matches, err := ResolveForReference(context.Background(), loader, &entity, nil, "anything")
	require.NoError(t, err)
	assert.Nil(t, matches)
}

func TestResolveForReference_MultipleRulesSameReference(t *testing.T) {
	wsID := newID()
	entityID := newID()
	c1 := newID()
	c2 := newID()

	entity := resourceEntity(entityID, wsID, "web", "Server", nil)

	loader := &mockLoader{
		candidates: map[string][]EntityData{
			"resource": {
				resourceEntity(c1, wsID, "db-primary", "Database", nil),
				resourceEntity(c2, wsID, "db-replica", "Database", nil),
			},
		},
	}

	rules := []Rule{
		{
			ID: newID(), Reference: "database",
			Cel: `to.name == "db-primary"`,
		},
		{
			ID: newID(), Reference: "database",
			Cel: `to.name == "db-replica"`,
		},
	}

	matches, err := ResolveForReference(context.Background(), loader, &entity, rules, "database")
	require.NoError(t, err)
	require.Len(t, matches, 2)

	matchedIDs := map[uuid.UUID]bool{}
	for _, m := range matches {
		matchedIDs[m.ToEntityID] = true
	}
	assert.True(t, matchedIDs[c1])
	assert.True(t, matchedIDs[c2])
}

func TestResolveForReference_CrossTypeRule(t *testing.T) {
	wsID := newID()
	entityID := newID()
	depID := newID()

	entity := resourceEntity(entityID, wsID, "api", "Server", nil)

	loader := &mockLoader{
		candidates: map[string][]EntityData{
			"deployment": {deploymentEntity(depID, wsID, "api", "api", nil)},
		},
	}

	rules := []Rule{
		nameMatchRule(newID(), "deploy", "resource", "deployment"),
	}

	matches, err := ResolveForReference(context.Background(), loader, &entity, rules, "deploy")
	require.NoError(t, err)
	require.Len(t, matches, 1)
	assert.Equal(t, entityID, matches[0].FromEntityID)
	assert.Equal(t, depID, matches[0].ToEntityID)
}

func TestResolveForReference_ReverseDirection(t *testing.T) {
	wsID := newID()
	entityID := newID()
	resID := newID()

	entity := deploymentEntity(entityID, wsID, "api", "api", nil)

	loader := &mockLoader{
		candidates: map[string][]EntityData{
			"resource": {resourceEntity(resID, wsID, "api", "Server", nil)},
		},
	}

	rules := []Rule{
		nameMatchRule(newID(), "res", "resource", "deployment"),
	}

	matches, err := ResolveForReference(context.Background(), loader, &entity, rules, "res")
	require.NoError(t, err)
	require.Len(t, matches, 1)
	assert.Equal(t, resID, matches[0].FromEntityID)
	assert.Equal(t, "resource", matches[0].FromEntityType)
	assert.Equal(t, entityID, matches[0].ToEntityID)
	assert.Equal(t, "deployment", matches[0].ToEntityType)
}
