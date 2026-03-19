package relationshipeval

import (
	"context"
	"fmt"
	"sort"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"workspace-engine/pkg/reconcile"
)

// ---------------------------------------------------------------------------
// Mock Getter
// ---------------------------------------------------------------------------

type mockGetter struct {
	entityInfo     *EntityInfo
	entityInfoErr  error
	rules          []RuleInfo
	rulesErr       error
	candidates     map[string][]EntityInfo // keyed by entity type
	candidatesErr  error
	existingRels   []ExistingRelationship
	existingRelErr error
}

func (m *mockGetter) GetEntityInfo(_ context.Context, _ string, _ uuid.UUID) (*EntityInfo, error) {
	return m.entityInfo, m.entityInfoErr
}

func (m *mockGetter) GetRulesForWorkspace(_ context.Context, _ uuid.UUID) ([]RuleInfo, error) {
	return m.rules, m.rulesErr
}

func (m *mockGetter) StreamCandidateEntities(
	_ context.Context,
	_ uuid.UUID,
	entityType string,
	_ int,
	batches chan<- []EntityInfo,
) error {
	defer close(batches)
	if m.candidatesErr != nil {
		return m.candidatesErr
	}
	if candidates, ok := m.candidates[entityType]; ok && len(candidates) > 0 {
		batches <- candidates
	}
	return nil
}

func (m *mockGetter) GetExistingRelationships(
	_ context.Context,
	_ string,
	_ uuid.UUID,
) ([]ExistingRelationship, error) {
	return m.existingRels, m.existingRelErr
}

// ---------------------------------------------------------------------------
// Mock Setter
// ---------------------------------------------------------------------------

type mockSetter struct {
	calls []setCall
	err   error
}

type setCall struct {
	entityType    string
	entityID      uuid.UUID
	relationships []ComputedRelationship
}

func (m *mockSetter) SetComputedRelationships(
	_ context.Context,
	entityType string,
	entityID uuid.UUID,
	relationships []ComputedRelationship,
) error {
	m.calls = append(m.calls, setCall{
		entityType:    entityType,
		entityID:      entityID,
		relationships: relationships,
	})
	return m.err
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

func newID() uuid.UUID { return uuid.New() }

func resourceEntity(
	id, workspaceID uuid.UUID,
	name, kind string,
	metadata map[string]any,
) EntityInfo {
	raw := map[string]any{
		"type":     "resource",
		"id":       id.String(),
		"name":     name,
		"kind":     kind,
		"metadata": metadata,
	}
	return EntityInfo{
		ID:          id,
		WorkspaceID: workspaceID,
		EntityType:  "resource",
		Raw:         raw,
	}
}

func deploymentEntity(
	id, workspaceID uuid.UUID,
	name, slug string,
	metadata map[string]any,
) EntityInfo {
	raw := map[string]any{
		"type":     "deployment",
		"id":       id.String(),
		"name":     name,
		"slug":     slug,
		"metadata": metadata,
	}
	return EntityInfo{
		ID:          id,
		WorkspaceID: workspaceID,
		EntityType:  "deployment",
		Raw:         raw,
	}
}

func environmentEntity(id, workspaceID uuid.UUID, name string, metadata map[string]any) EntityInfo {
	raw := map[string]any{
		"type":     "environment",
		"id":       id.String(),
		"name":     name,
		"metadata": metadata,
	}
	return EntityInfo{
		ID:          id,
		WorkspaceID: workspaceID,
		EntityType:  "environment",
		Raw:         raw,
	}
}

func makeRule(id uuid.UUID, cel string) RuleInfo {
	return RuleInfo{
		ID:  id,
		Cel: cel,
	}
}

func sortRelationships(rels []ComputedRelationship) {
	sort.Slice(rels, func(i, j int) bool {
		if rels[i].RuleID != rels[j].RuleID {
			return rels[i].RuleID.String() < rels[j].RuleID.String()
		}
		if rels[i].FromEntityID != rels[j].FromEntityID {
			return rels[i].FromEntityID.String() < rels[j].FromEntityID.String()
		}
		return rels[i].ToEntityID.String() < rels[j].ToEntityID.String()
	})
}

// ---------------------------------------------------------------------------
// FormatScopeID / ParseScopeID
// ---------------------------------------------------------------------------

func TestFormatScopeID(t *testing.T) {
	id := newID()
	got := FormatScopeID("resource", id.String())
	assert.Equal(t, "resource:"+id.String(), got)
}

func TestParseScopeID(t *testing.T) {
	t.Run("valid", func(t *testing.T) {
		id := newID()
		eType, eID, err := ParseScopeID("deployment:" + id.String())
		require.NoError(t, err)
		assert.Equal(t, "deployment", eType)
		assert.Equal(t, id, eID)
	})

	t.Run("no colon", func(t *testing.T) {
		_, _, err := ParseScopeID("nocolon")
		assert.ErrorContains(t, err, "invalid scope id format")
	})

	t.Run("bad uuid", func(t *testing.T) {
		_, _, err := ParseScopeID("resource:not-a-uuid")
		require.Error(t, err)
	})

	t.Run("roundtrip", func(t *testing.T) {
		id := newID()
		scopeID := FormatScopeID("environment", id.String())
		eType, eID, err := ParseScopeID(scopeID)
		require.NoError(t, err)
		assert.Equal(t, "environment", eType)
		assert.Equal(t, id, eID)
	})
}

// ---------------------------------------------------------------------------
// Process: invalid scope ID
// ---------------------------------------------------------------------------

func TestProcess_InvalidScopeID(t *testing.T) {
	ctrl := NewController(&mockGetter{}, &mockSetter{})

	_, err := ctrl.Process(context.Background(), reconcile.Item{
		ScopeID: "bad-scope-no-colon",
	})
	assert.ErrorContains(t, err, "parse scope id")
}

func TestProcess_BadUUIDInScopeID(t *testing.T) {
	ctrl := NewController(&mockGetter{}, &mockSetter{})

	_, err := ctrl.Process(context.Background(), reconcile.Item{
		ScopeID: "resource:not-a-uuid",
	})
	assert.ErrorContains(t, err, "parse scope id")
}

// ---------------------------------------------------------------------------
// Process: GetEntityInfo error
// ---------------------------------------------------------------------------

func TestProcess_GetEntityInfoError(t *testing.T) {
	getter := &mockGetter{
		entityInfoErr: fmt.Errorf("db connection failed"),
	}
	ctrl := NewController(getter, &mockSetter{})

	_, err := ctrl.Process(context.Background(), reconcile.Item{
		ScopeID: FormatScopeID("resource", newID().String()),
	})
	assert.ErrorContains(t, err, "get entity info")
}

// ---------------------------------------------------------------------------
// Process: GetRulesForWorkspace error
// ---------------------------------------------------------------------------

func TestProcess_GetRulesError(t *testing.T) {
	id := newID()
	wsID := newID()
	getter := &mockGetter{
		entityInfo: &EntityInfo{ID: id, WorkspaceID: wsID, EntityType: "resource"},
		rulesErr:   fmt.Errorf("rules query failed"),
	}
	ctrl := NewController(getter, &mockSetter{})

	_, err := ctrl.Process(context.Background(), reconcile.Item{
		ScopeID: FormatScopeID("resource", id.String()),
	})
	assert.ErrorContains(t, err, "get rules")
}

// ---------------------------------------------------------------------------
// Process: no rules → empty relationships
// ---------------------------------------------------------------------------

func TestProcess_NoRules(t *testing.T) {
	id := newID()
	wsID := newID()
	setter := &mockSetter{}
	getter := &mockGetter{
		entityInfo: &EntityInfo{ID: id, WorkspaceID: wsID, EntityType: "resource"},
		rules:      nil,
	}
	ctrl := NewController(getter, setter)

	_, err := ctrl.Process(context.Background(), reconcile.Item{
		ScopeID: FormatScopeID("resource", id.String()),
	})
	require.NoError(t, err)
	require.Len(t, setter.calls, 1)
	assert.Empty(t, setter.calls[0].relationships)
}

// ---------------------------------------------------------------------------
// Process: entity is "from" side, matching candidates
// ---------------------------------------------------------------------------

func TestProcess_EntityIsFrom_MatchingCandidates(t *testing.T) {
	wsID := newID()
	ruleID := newID()
	resourceID := newID()
	depID1 := newID()
	depID2 := newID()
	depNoMatch := newID()

	entity := resourceEntity(
		resourceID,
		wsID,
		"my-api",
		"Service",
		map[string]any{"team": "platform"},
	)

	celExpr := `from.type == "resource" && to.type == "deployment" && from.metadata.team == to.metadata.team`

	getter := &mockGetter{
		entityInfo: &entity,
		rules:      []RuleInfo{makeRule(ruleID, celExpr)},
		candidates: map[string][]EntityInfo{
			"deployment": {
				deploymentEntity(
					depID1,
					wsID,
					"deploy-1",
					"deploy-1",
					map[string]any{"team": "platform"},
				),
				deploymentEntity(
					depID2,
					wsID,
					"deploy-2",
					"deploy-2",
					map[string]any{"team": "platform"},
				),
				deploymentEntity(
					depNoMatch,
					wsID,
					"deploy-3",
					"deploy-3",
					map[string]any{"team": "other"},
				),
			},
		},
	}
	setter := &mockSetter{}
	ctrl := NewController(getter, setter)

	_, err := ctrl.Process(context.Background(), reconcile.Item{
		ScopeID: FormatScopeID("resource", resourceID.String()),
	})
	require.NoError(t, err)
	require.Len(t, setter.calls, 1)

	rels := setter.calls[0].relationships
	sortRelationships(rels)
	assert.Len(t, rels, 2)

	ids := []uuid.UUID{rels[0].ToEntityID, rels[1].ToEntityID}
	sort.Slice(ids, func(i, j int) bool { return ids[i].String() < ids[j].String() })
	expected := []uuid.UUID{depID1, depID2}
	sort.Slice(expected, func(i, j int) bool { return expected[i].String() < expected[j].String() })
	assert.Equal(t, expected, ids)

	for _, rel := range rels {
		assert.Equal(t, ruleID, rel.RuleID)
		assert.Equal(t, "resource", rel.FromEntityType)
		assert.Equal(t, resourceID, rel.FromEntityID)
		assert.Equal(t, "deployment", rel.ToEntityType)
	}
}

// ---------------------------------------------------------------------------
// Process: entity is "to" side, matching candidates
// ---------------------------------------------------------------------------

func TestProcess_EntityIsTo_MatchingCandidates(t *testing.T) {
	wsID := newID()
	ruleID := newID()
	deploymentID := newID()
	resID1 := newID()
	resID2 := newID()

	entity := deploymentEntity(
		deploymentID,
		wsID,
		"my-deploy",
		"my-deploy",
		map[string]any{"app": "web"},
	)

	celExpr := `from.type == "resource" && to.type == "deployment" && from.metadata.app == to.metadata.app`

	getter := &mockGetter{
		entityInfo: &entity,
		rules:      []RuleInfo{makeRule(ruleID, celExpr)},
		candidates: map[string][]EntityInfo{
			"resource": {
				resourceEntity(resID1, wsID, "res-1", "Pod", map[string]any{"app": "web"}),
				resourceEntity(resID2, wsID, "res-2", "Pod", map[string]any{"app": "web"}),
				resourceEntity(newID(), wsID, "res-no-match", "Pod", map[string]any{"app": "api"}),
			},
		},
	}
	setter := &mockSetter{}
	ctrl := NewController(getter, setter)

	_, err := ctrl.Process(context.Background(), reconcile.Item{
		ScopeID: FormatScopeID("deployment", deploymentID.String()),
	})
	require.NoError(t, err)
	require.Len(t, setter.calls, 1)

	rels := setter.calls[0].relationships
	assert.Len(t, rels, 2)
	for _, rel := range rels {
		assert.Equal(t, ruleID, rel.RuleID)
		assert.Equal(t, "resource", rel.FromEntityType)
		assert.Equal(t, "deployment", rel.ToEntityType)
		assert.Equal(t, deploymentID, rel.ToEntityID)
	}

	fromIDs := []uuid.UUID{rels[0].FromEntityID, rels[1].FromEntityID}
	sort.Slice(fromIDs, func(i, j int) bool { return fromIDs[i].String() < fromIDs[j].String() })
	expected := []uuid.UUID{resID1, resID2}
	sort.Slice(expected, func(i, j int) bool { return expected[i].String() < expected[j].String() })
	assert.Equal(t, expected, fromIDs)
}

// ---------------------------------------------------------------------------
// Process: entity participates as both "from" and "to" in a rule
// (e.g. resource→resource self-referential rule)
// ---------------------------------------------------------------------------

func TestProcess_EntityIsBothFromAndTo(t *testing.T) {
	wsID := newID()
	ruleID := newID()
	entityID := newID()
	candidateA := newID()
	candidateB := newID()

	entity := resourceEntity(entityID, wsID, "my-resource", "Pod", map[string]any{"env": "prod"})

	celExpr := `from.type == "resource" && to.type == "resource" && from.metadata.env == to.metadata.env`

	getter := &mockGetter{
		entityInfo: &entity,
		rules:      []RuleInfo{makeRule(ruleID, celExpr)},
		candidates: map[string][]EntityInfo{
			"resource": {
				entity, // itself — should be skipped
				resourceEntity(candidateA, wsID, "other-a", "Pod", map[string]any{"env": "prod"}),
				resourceEntity(candidateB, wsID, "other-b", "Pod", map[string]any{"env": "prod"}),
				resourceEntity(newID(), wsID, "staging", "Pod", map[string]any{"env": "staging"}),
			},
		},
	}
	setter := &mockSetter{}
	ctrl := NewController(getter, setter)

	_, err := ctrl.Process(context.Background(), reconcile.Item{
		ScopeID: FormatScopeID("resource", entityID.String()),
	})
	require.NoError(t, err)
	require.Len(t, setter.calls, 1)

	rels := setter.calls[0].relationships
	// Entity matches as "from" → 2 to-candidates, and as "to" → 2 from-candidates = 4 total
	assert.Len(t, rels, 4)

	var fromRels, toRels []ComputedRelationship
	for _, rel := range rels {
		if rel.FromEntityID == entityID {
			fromRels = append(fromRels, rel)
		}
		if rel.ToEntityID == entityID {
			toRels = append(toRels, rel)
		}
	}
	assert.Len(t, fromRels, 2, "entity should be 'from' in 2 relationships")
	assert.Len(t, toRels, 2, "entity should be 'to' in 2 relationships")
}

// ---------------------------------------------------------------------------
// Process: no matching candidates → empty relationships
// ---------------------------------------------------------------------------

func TestProcess_NoMatchingCandidates(t *testing.T) {
	wsID := newID()
	ruleID := newID()
	entityID := newID()

	entity := resourceEntity(
		entityID,
		wsID,
		"my-resource",
		"Service",
		map[string]any{"team": "alpha"},
	)

	celExpr := `from.type == "resource" && to.type == "deployment" && from.metadata.team == to.metadata.team`

	getter := &mockGetter{
		entityInfo: &entity,
		rules:      []RuleInfo{makeRule(ruleID, celExpr)},
		candidates: map[string][]EntityInfo{
			"deployment": {
				deploymentEntity(newID(), wsID, "dep", "dep", map[string]any{"team": "beta"}),
			},
		},
	}
	setter := &mockSetter{}
	ctrl := NewController(getter, setter)

	_, err := ctrl.Process(context.Background(), reconcile.Item{
		ScopeID: FormatScopeID("resource", entityID.String()),
	})
	require.NoError(t, err)
	require.Len(t, setter.calls, 1)
	assert.Empty(t, setter.calls[0].relationships)
}

// ---------------------------------------------------------------------------
// Process: entity type doesn't participate in any rule
// ---------------------------------------------------------------------------

func TestProcess_EntityTypeNotInAnyRule(t *testing.T) {
	wsID := newID()
	entityID := newID()

	entity := environmentEntity(entityID, wsID, "staging", nil)

	celExpr := `from.type == "resource" && to.type == "deployment" && from.name == to.name`

	getter := &mockGetter{
		entityInfo: &entity,
		rules:      []RuleInfo{makeRule(newID(), celExpr)},
	}
	setter := &mockSetter{}
	ctrl := NewController(getter, setter)

	_, err := ctrl.Process(context.Background(), reconcile.Item{
		ScopeID: FormatScopeID("environment", entityID.String()),
	})
	require.NoError(t, err)
	require.Len(t, setter.calls, 1)
	assert.Empty(t, setter.calls[0].relationships)
}

// ---------------------------------------------------------------------------
// Process: multiple rules, mixed matches
// ---------------------------------------------------------------------------

func TestProcess_MultipleRules(t *testing.T) {
	wsID := newID()
	ruleA := newID()
	ruleB := newID()
	entityID := newID()
	depMatch := newID()
	envMatch := newID()

	entity := resourceEntity(
		entityID,
		wsID,
		"my-api",
		"Service",
		map[string]any{"team": "platform"},
	)

	celA := `from.type == "resource" && to.type == "deployment" && from.metadata.team == to.metadata.team`
	celB := `from.type == "resource" && to.type == "environment" && from.name == to.name`

	getter := &mockGetter{
		entityInfo: &entity,
		rules: []RuleInfo{
			makeRule(ruleA, celA),
			makeRule(ruleB, celB),
		},
		candidates: map[string][]EntityInfo{
			"deployment": {
				deploymentEntity(depMatch, wsID, "dep", "dep", map[string]any{"team": "platform"}),
				deploymentEntity(
					newID(),
					wsID,
					"dep-no",
					"dep-no",
					map[string]any{"team": "other"},
				),
			},
			"environment": {
				environmentEntity(envMatch, wsID, "my-api", nil),
				environmentEntity(newID(), wsID, "other-env", nil),
			},
		},
	}
	setter := &mockSetter{}
	ctrl := NewController(getter, setter)

	_, err := ctrl.Process(context.Background(), reconcile.Item{
		ScopeID: FormatScopeID("resource", entityID.String()),
	})
	require.NoError(t, err)
	require.Len(t, setter.calls, 1)

	rels := setter.calls[0].relationships
	assert.Len(t, rels, 2)

	var foundDep, foundEnv bool
	for _, rel := range rels {
		if rel.RuleID == ruleA && rel.ToEntityID == depMatch {
			foundDep = true
			assert.Equal(t, "resource", rel.FromEntityType)
			assert.Equal(t, "deployment", rel.ToEntityType)
		}
		if rel.RuleID == ruleB && rel.ToEntityID == envMatch {
			foundEnv = true
			assert.Equal(t, "resource", rel.FromEntityType)
			assert.Equal(t, "environment", rel.ToEntityType)
		}
	}
	assert.True(t, foundDep, "should have matched deployment via ruleA")
	assert.True(t, foundEnv, "should have matched environment via ruleB")
}

// ---------------------------------------------------------------------------
// Process: entity skips itself in candidate stream
// ---------------------------------------------------------------------------

func TestProcess_SkipsSelfInCandidates(t *testing.T) {
	wsID := newID()
	ruleID := newID()
	entityID := newID()

	entity := resourceEntity(entityID, wsID, "self-ref", "Pod", map[string]any{"env": "prod"})

	celExpr := `from.type == "resource" && to.type == "resource" && from.metadata.env == to.metadata.env`

	getter := &mockGetter{
		entityInfo: &entity,
		rules:      []RuleInfo{makeRule(ruleID, celExpr)},
		candidates: map[string][]EntityInfo{
			"resource": {entity}, // only itself
		},
	}
	setter := &mockSetter{}
	ctrl := NewController(getter, setter)

	_, err := ctrl.Process(context.Background(), reconcile.Item{
		ScopeID: FormatScopeID("resource", entityID.String()),
	})
	require.NoError(t, err)
	require.Len(t, setter.calls, 1)
	assert.Empty(t, setter.calls[0].relationships)
}

// ---------------------------------------------------------------------------
// Process: CEL compile error
// ---------------------------------------------------------------------------

func TestProcess_CELCompileError_SkipsRule(t *testing.T) {
	wsID := newID()
	entityID := newID()

	entity := resourceEntity(entityID, wsID, "r", "Pod", nil)

	setter := &mockSetter{}
	getter := &mockGetter{
		entityInfo: &entity,
		rules: []RuleInfo{
			makeRule(newID(), "this is not valid CEL !!!"),
		},
		candidates: map[string][]EntityInfo{
			"deployment": {deploymentEntity(newID(), wsID, "d", "d", nil)},
		},
	}
	ctrl := NewController(getter, setter)

	_, err := ctrl.Process(context.Background(), reconcile.Item{
		ScopeID: FormatScopeID("resource", entityID.String()),
	})
	require.NoError(t, err)
	require.Len(t, setter.calls, 1)
	assert.Empty(t, setter.calls[0].relationships)
}

// ---------------------------------------------------------------------------
// Process: SetComputedRelationships error propagated
// ---------------------------------------------------------------------------

func TestProcess_SetterError(t *testing.T) {
	wsID := newID()
	entityID := newID()

	entity := resourceEntity(entityID, wsID, "r", "Pod", nil)

	getter := &mockGetter{
		entityInfo: &entity,
		rules:      nil,
	}
	setter := &mockSetter{err: fmt.Errorf("db write failed")}
	ctrl := NewController(getter, setter)

	_, err := ctrl.Process(context.Background(), reconcile.Item{
		ScopeID: FormatScopeID("resource", entityID.String()),
	})
	assert.ErrorContains(t, err, "set computed relationships")
}

// ---------------------------------------------------------------------------
// Process: StreamCandidateEntities error propagated
// ---------------------------------------------------------------------------

func TestProcess_StreamCandidatesError(t *testing.T) {
	wsID := newID()
	entityID := newID()
	ruleID := newID()

	entity := resourceEntity(entityID, wsID, "r", "Pod", nil)

	celExpr := `from.type == "resource" && to.type == "deployment" && from.name == to.name`

	getter := &mockGetter{
		entityInfo:    &entity,
		rules:         []RuleInfo{makeRule(ruleID, celExpr)},
		candidatesErr: fmt.Errorf("stream failed"),
	}
	ctrl := NewController(getter, &mockSetter{})

	_, err := ctrl.Process(context.Background(), reconcile.Item{
		ScopeID: FormatScopeID("resource", entityID.String()),
	})
	assert.ErrorContains(t, err, "stream failed")
}

// ---------------------------------------------------------------------------
// Process: SetComputedRelationships receives correct entity info
// ---------------------------------------------------------------------------

func TestProcess_SetterReceivesCorrectEntityInfo(t *testing.T) {
	wsID := newID()
	entityID := newID()

	entity := resourceEntity(entityID, wsID, "r", "Pod", nil)

	getter := &mockGetter{
		entityInfo: &entity,
		rules:      nil,
	}
	setter := &mockSetter{}
	ctrl := NewController(getter, setter)

	_, err := ctrl.Process(context.Background(), reconcile.Item{
		ScopeID: FormatScopeID("resource", entityID.String()),
	})
	require.NoError(t, err)
	require.Len(t, setter.calls, 1)
	assert.Equal(t, "resource", setter.calls[0].entityType)
	assert.Equal(t, entityID, setter.calls[0].entityID)
}

// ---------------------------------------------------------------------------
// CEL: name-based matching
// ---------------------------------------------------------------------------

func TestProcess_CEL_NameMatching(t *testing.T) {
	wsID := newID()
	ruleID := newID()
	entityID := newID()
	matchID := newID()

	entity := resourceEntity(entityID, wsID, "shared-name", "Pod", nil)

	celExpr := `from.type == "resource" && to.type == "deployment" && from.name == to.name`

	getter := &mockGetter{
		entityInfo: &entity,
		rules:      []RuleInfo{makeRule(ruleID, celExpr)},
		candidates: map[string][]EntityInfo{
			"deployment": {
				deploymentEntity(matchID, wsID, "shared-name", "shared-name", nil),
				deploymentEntity(newID(), wsID, "different", "different", nil),
			},
		},
	}
	setter := &mockSetter{}
	ctrl := NewController(getter, setter)

	_, err := ctrl.Process(context.Background(), reconcile.Item{
		ScopeID: FormatScopeID("resource", entityID.String()),
	})
	require.NoError(t, err)

	rels := setter.calls[0].relationships
	require.Len(t, rels, 1)
	assert.Equal(t, matchID, rels[0].ToEntityID)
}

// ---------------------------------------------------------------------------
// CEL: nested config field matching
// ---------------------------------------------------------------------------

func TestProcess_CEL_ConfigFieldMatching(t *testing.T) {
	wsID := newID()
	ruleID := newID()
	entityID := newID()
	matchID := newID()

	entity := EntityInfo{
		ID: entityID, WorkspaceID: wsID, EntityType: "resource",
		Raw: map[string]any{
			"type":   "resource",
			"id":     entityID.String(),
			"name":   "api-server",
			"config": map[string]any{"region": "us-east-1"},
		},
	}

	celExpr := `from.type == "resource" && to.type == "deployment" && from.config.region == to.metadata.region`

	matchDep := EntityInfo{
		ID: matchID, WorkspaceID: wsID, EntityType: "deployment",
		Raw: map[string]any{
			"type":     "deployment",
			"id":       matchID.String(),
			"name":     "dep",
			"metadata": map[string]any{"region": "us-east-1"},
		},
	}
	noMatchDep := EntityInfo{
		ID: newID(), WorkspaceID: wsID, EntityType: "deployment",
		Raw: map[string]any{
			"type":     "deployment",
			"id":       newID().String(),
			"name":     "dep2",
			"metadata": map[string]any{"region": "eu-west-1"},
		},
	}

	getter := &mockGetter{
		entityInfo: &entity,
		rules:      []RuleInfo{makeRule(ruleID, celExpr)},
		candidates: map[string][]EntityInfo{
			"deployment": {matchDep, noMatchDep},
		},
	}
	setter := &mockSetter{}
	ctrl := NewController(getter, setter)

	_, err := ctrl.Process(context.Background(), reconcile.Item{
		ScopeID: FormatScopeID("resource", entityID.String()),
	})
	require.NoError(t, err)

	rels := setter.calls[0].relationships
	require.Len(t, rels, 1)
	assert.Equal(t, matchID, rels[0].ToEntityID)
}

// ---------------------------------------------------------------------------
// CEL: string function (contains)
// ---------------------------------------------------------------------------

func TestProcess_CEL_StringContains(t *testing.T) {
	wsID := newID()
	ruleID := newID()
	entityID := newID()
	matchID := newID()

	entity := resourceEntity(entityID, wsID, "prod-api-server", "Service", nil)

	celExpr := `from.type == "resource" && to.type == "deployment" && from.name.contains(to.slug)`

	getter := &mockGetter{
		entityInfo: &entity,
		rules:      []RuleInfo{makeRule(ruleID, celExpr)},
		candidates: map[string][]EntityInfo{
			"deployment": {
				deploymentEntity(matchID, wsID, "api-server-deploy", "api-server", nil),
				deploymentEntity(newID(), wsID, "worker-deploy", "worker", nil),
			},
		},
	}
	setter := &mockSetter{}
	ctrl := NewController(getter, setter)

	_, err := ctrl.Process(context.Background(), reconcile.Item{
		ScopeID: FormatScopeID("resource", entityID.String()),
	})
	require.NoError(t, err)

	rels := setter.calls[0].relationships
	require.Len(t, rels, 1)
	assert.Equal(t, matchID, rels[0].ToEntityID)
}

// ---------------------------------------------------------------------------
// CEL: missing key treated as non-match (no error)
// ---------------------------------------------------------------------------

func TestProcess_CEL_MissingKeyNonMatch(t *testing.T) {
	wsID := newID()
	ruleID := newID()
	entityID := newID()

	entity := resourceEntity(entityID, wsID, "r", "Pod", map[string]any{"env": "prod"})

	celExpr := `from.type == "resource" && to.type == "deployment" && from.metadata.env == to.metadata.env`

	depWithoutMetadata := EntityInfo{
		ID: newID(), WorkspaceID: wsID, EntityType: "deployment",
		Raw: map[string]any{
			"type": "deployment",
			"id":   newID().String(),
			"name": "dep",
		},
	}

	getter := &mockGetter{
		entityInfo: &entity,
		rules:      []RuleInfo{makeRule(ruleID, celExpr)},
		candidates: map[string][]EntityInfo{
			"deployment": {depWithoutMetadata},
		},
	}
	setter := &mockSetter{}
	ctrl := NewController(getter, setter)

	_, err := ctrl.Process(context.Background(), reconcile.Item{
		ScopeID: FormatScopeID("resource", entityID.String()),
	})
	require.NoError(t, err)
	assert.Empty(t, setter.calls[0].relationships)
}

// ---------------------------------------------------------------------------
// CEL: logical OR matching
// ---------------------------------------------------------------------------

func TestProcess_CEL_LogicalOr(t *testing.T) {
	wsID := newID()
	ruleID := newID()
	entityID := newID()
	matchByName := newID()
	matchByKind := newID()

	entity := resourceEntity(entityID, wsID, "my-api", "Service", nil)

	celExpr := `from.type == "resource" && to.type == "deployment" && (from.name == to.name || from.kind == to.slug)`

	getter := &mockGetter{
		entityInfo: &entity,
		rules:      []RuleInfo{makeRule(ruleID, celExpr)},
		candidates: map[string][]EntityInfo{
			"deployment": {
				deploymentEntity(matchByName, wsID, "my-api", "something", nil),
				deploymentEntity(matchByKind, wsID, "other", "Service", nil),
				deploymentEntity(newID(), wsID, "unrelated", "unrelated", nil),
			},
		},
	}
	setter := &mockSetter{}
	ctrl := NewController(getter, setter)

	_, err := ctrl.Process(context.Background(), reconcile.Item{
		ScopeID: FormatScopeID("resource", entityID.String()),
	})
	require.NoError(t, err)

	rels := setter.calls[0].relationships
	assert.Len(t, rels, 2)

	ids := []uuid.UUID{rels[0].ToEntityID, rels[1].ToEntityID}
	sort.Slice(ids, func(i, j int) bool { return ids[i].String() < ids[j].String() })
	expected := []uuid.UUID{matchByName, matchByKind}
	sort.Slice(expected, func(i, j int) bool { return expected[i].String() < expected[j].String() })
	assert.Equal(t, expected, ids)
}

// ---------------------------------------------------------------------------
// CEL: boolean expression matching all candidates
// ---------------------------------------------------------------------------

func TestProcess_CEL_MatchAll(t *testing.T) {
	wsID := newID()
	ruleID := newID()
	entityID := newID()
	depA := newID()
	depB := newID()

	entity := resourceEntity(entityID, wsID, "r", "Pod", nil)

	celExpr := `from.type == "resource" && to.type == "deployment" && true`

	getter := &mockGetter{
		entityInfo: &entity,
		rules:      []RuleInfo{makeRule(ruleID, celExpr)},
		candidates: map[string][]EntityInfo{
			"deployment": {
				deploymentEntity(depA, wsID, "a", "a", nil),
				deploymentEntity(depB, wsID, "b", "b", nil),
			},
		},
	}
	setter := &mockSetter{}
	ctrl := NewController(getter, setter)

	_, err := ctrl.Process(context.Background(), reconcile.Item{
		ScopeID: FormatScopeID("resource", entityID.String()),
	})
	require.NoError(t, err)
	assert.Len(t, setter.calls[0].relationships, 2)
}

// ---------------------------------------------------------------------------
// CEL: boolean expression matching none
// ---------------------------------------------------------------------------

func TestProcess_CEL_MatchNone(t *testing.T) {
	wsID := newID()
	ruleID := newID()
	entityID := newID()

	entity := resourceEntity(entityID, wsID, "r", "Pod", nil)

	celExpr := `from.type == "resource" && to.type == "deployment" && false`

	getter := &mockGetter{
		entityInfo: &entity,
		rules:      []RuleInfo{makeRule(ruleID, celExpr)},
		candidates: map[string][]EntityInfo{
			"deployment": {
				deploymentEntity(newID(), wsID, "a", "a", nil),
			},
		},
	}
	setter := &mockSetter{}
	ctrl := NewController(getter, setter)

	_, err := ctrl.Process(context.Background(), reconcile.Item{
		ScopeID: FormatScopeID("resource", entityID.String()),
	})
	require.NoError(t, err)
	assert.Empty(t, setter.calls[0].relationships)
}

// ---------------------------------------------------------------------------
// Process: environment → resource relationship
// ---------------------------------------------------------------------------

func TestProcess_EnvironmentToResource(t *testing.T) {
	wsID := newID()
	ruleID := newID()
	envID := newID()
	resMatch := newID()

	entity := environmentEntity(envID, wsID, "production", map[string]any{"tier": "prod"})

	celExpr := `from.type == "environment" && to.type == "resource" && from.metadata.tier == to.metadata.tier`

	getter := &mockGetter{
		entityInfo: &entity,
		rules:      []RuleInfo{makeRule(ruleID, celExpr)},
		candidates: map[string][]EntityInfo{
			"resource": {
				resourceEntity(
					resMatch,
					wsID,
					"prod-db",
					"Database",
					map[string]any{"tier": "prod"},
				),
				resourceEntity(newID(), wsID, "dev-db", "Database", map[string]any{"tier": "dev"}),
			},
		},
	}
	setter := &mockSetter{}
	ctrl := NewController(getter, setter)

	_, err := ctrl.Process(context.Background(), reconcile.Item{
		ScopeID: FormatScopeID("environment", envID.String()),
	})
	require.NoError(t, err)

	rels := setter.calls[0].relationships
	require.Len(t, rels, 1)
	assert.Equal(t, ruleID, rels[0].RuleID)
	assert.Equal(t, "environment", rels[0].FromEntityType)
	assert.Equal(t, envID, rels[0].FromEntityID)
	assert.Equal(t, "resource", rels[0].ToEntityType)
	assert.Equal(t, resMatch, rels[0].ToEntityID)
}

// ---------------------------------------------------------------------------
// Process: large candidate set with selective matching
// ---------------------------------------------------------------------------

func TestProcess_LargeCandidateSet(t *testing.T) {
	wsID := newID()
	ruleID := newID()
	entityID := newID()

	entity := resourceEntity(entityID, wsID, "needle", "Service", map[string]any{"match": "yes"})

	celExpr := `from.type == "resource" && to.type == "deployment" && from.metadata.match == to.metadata.match`

	var candidates []EntityInfo
	var expectedMatches []uuid.UUID
	for i := range 100 {
		id := newID()
		meta := map[string]any{"match": "no"}
		if i%10 == 0 {
			meta["match"] = "yes"
			expectedMatches = append(expectedMatches, id)
		}
		candidates = append(
			candidates,
			deploymentEntity(id, wsID, fmt.Sprintf("dep-%d", i), fmt.Sprintf("dep-%d", i), meta),
		)
	}

	getter := &mockGetter{
		entityInfo: &entity,
		rules:      []RuleInfo{makeRule(ruleID, celExpr)},
		candidates: map[string][]EntityInfo{
			"deployment": candidates,
		},
	}
	setter := &mockSetter{}
	ctrl := NewController(getter, setter)

	_, err := ctrl.Process(context.Background(), reconcile.Item{
		ScopeID: FormatScopeID("resource", entityID.String()),
	})
	require.NoError(t, err)

	rels := setter.calls[0].relationships
	assert.Len(t, rels, len(expectedMatches))

	gotIDs := make([]uuid.UUID, len(rels))
	for i, r := range rels {
		gotIDs[i] = r.ToEntityID
	}
	sort.Slice(gotIDs, func(i, j int) bool { return gotIDs[i].String() < gotIDs[j].String() })
	sort.Slice(
		expectedMatches,
		func(i, j int) bool { return expectedMatches[i].String() < expectedMatches[j].String() },
	)
	assert.Equal(t, expectedMatches, gotIDs)
}

// ---------------------------------------------------------------------------
// Process: rule from_type doesn't match entity and to_type doesn't match
//          → rule produces zero relationships
// ---------------------------------------------------------------------------

func TestProcess_RuleIrrelevantToEntity(t *testing.T) {
	wsID := newID()
	ruleID := newID()
	entityID := newID()

	entity := resourceEntity(entityID, wsID, "r", "Pod", nil)

	celExpr := `from.type == "deployment" && to.type == "environment" && from.name == to.name`

	getter := &mockGetter{
		entityInfo: &entity,
		rules:      []RuleInfo{makeRule(ruleID, celExpr)},
	}
	setter := &mockSetter{}
	ctrl := NewController(getter, setter)

	_, err := ctrl.Process(context.Background(), reconcile.Item{
		ScopeID: FormatScopeID("resource", entityID.String()),
	})
	require.NoError(t, err)
	assert.Empty(t, setter.calls[0].relationships)
}

// ---------------------------------------------------------------------------
// Process: empty candidate stream
// ---------------------------------------------------------------------------

func TestProcess_EmptyCandidateStream(t *testing.T) {
	wsID := newID()
	ruleID := newID()
	entityID := newID()

	entity := resourceEntity(entityID, wsID, "r", "Pod", nil)

	celExpr := `from.type == "resource" && to.type == "deployment" && true`

	getter := &mockGetter{
		entityInfo: &entity,
		rules:      []RuleInfo{makeRule(ruleID, celExpr)},
		candidates: map[string][]EntityInfo{
			"deployment": {},
		},
	}
	setter := &mockSetter{}
	ctrl := NewController(getter, setter)

	_, err := ctrl.Process(context.Background(), reconcile.Item{
		ScopeID: FormatScopeID("resource", entityID.String()),
	})
	require.NoError(t, err)
	assert.Empty(t, setter.calls[0].relationships)
}

// ---------------------------------------------------------------------------
// Relationship direction correctness
// ---------------------------------------------------------------------------

func TestProcess_RelationshipDirectionCorrectness(t *testing.T) {
	wsID := newID()
	ruleID := newID()

	t.Run("from_entity produces from=entity, to=candidate", func(t *testing.T) {
		entityID := newID()
		candidateID := newID()

		entity := resourceEntity(entityID, wsID, "from-entity", "Service", nil)
		celExpr := `from.type == "resource" && to.type == "deployment" && true`

		getter := &mockGetter{
			entityInfo: &entity,
			rules:      []RuleInfo{makeRule(ruleID, celExpr)},
			candidates: map[string][]EntityInfo{
				"deployment": {deploymentEntity(candidateID, wsID, "dep", "dep", nil)},
			},
		}
		setter := &mockSetter{}
		ctrl := NewController(getter, setter)

		_, err := ctrl.Process(context.Background(), reconcile.Item{
			ScopeID: FormatScopeID("resource", entityID.String()),
		})
		require.NoError(t, err)
		require.Len(t, setter.calls[0].relationships, 1)

		rel := setter.calls[0].relationships[0]
		assert.Equal(t, entityID, rel.FromEntityID)
		assert.Equal(t, "resource", rel.FromEntityType)
		assert.Equal(t, candidateID, rel.ToEntityID)
		assert.Equal(t, "deployment", rel.ToEntityType)
	})

	t.Run("to_entity produces from=candidate, to=entity", func(t *testing.T) {
		entityID := newID()
		candidateID := newID()

		entity := deploymentEntity(entityID, wsID, "to-entity", "to-entity", nil)
		celExpr := `from.type == "resource" && to.type == "deployment" && true`

		getter := &mockGetter{
			entityInfo: &entity,
			rules:      []RuleInfo{makeRule(ruleID, celExpr)},
			candidates: map[string][]EntityInfo{
				"resource": {resourceEntity(candidateID, wsID, "res", "Pod", nil)},
			},
		}
		setter := &mockSetter{}
		ctrl := NewController(getter, setter)

		_, err := ctrl.Process(context.Background(), reconcile.Item{
			ScopeID: FormatScopeID("deployment", entityID.String()),
		})
		require.NoError(t, err)
		require.Len(t, setter.calls[0].relationships, 1)

		rel := setter.calls[0].relationships[0]
		assert.Equal(t, candidateID, rel.FromEntityID)
		assert.Equal(t, "resource", rel.FromEntityType)
		assert.Equal(t, entityID, rel.ToEntityID)
		assert.Equal(t, "deployment", rel.ToEntityType)
	})
}

// ---------------------------------------------------------------------------
// CEL: complex metadata matching with has() macro
// ---------------------------------------------------------------------------

func TestProcess_CEL_HasMacro(t *testing.T) {
	wsID := newID()
	ruleID := newID()
	entityID := newID()
	matchID := newID()

	entity := resourceEntity(entityID, wsID, "r", "Pod", map[string]any{"special": "true"})

	celExpr := `from.type == "resource" && to.type == "deployment" && has(from.metadata.special) && has(to.metadata.special)`

	getter := &mockGetter{
		entityInfo: &entity,
		rules:      []RuleInfo{makeRule(ruleID, celExpr)},
		candidates: map[string][]EntityInfo{
			"deployment": {
				deploymentEntity(matchID, wsID, "d1", "d1", map[string]any{"special": "true"}),
				deploymentEntity(newID(), wsID, "d2", "d2", map[string]any{}),
				deploymentEntity(newID(), wsID, "d3", "d3", nil),
			},
		},
	}
	setter := &mockSetter{}
	ctrl := NewController(getter, setter)

	_, err := ctrl.Process(context.Background(), reconcile.Item{
		ScopeID: FormatScopeID("resource", entityID.String()),
	})
	require.NoError(t, err)

	rels := setter.calls[0].relationships
	require.Len(t, rels, 1)
	assert.Equal(t, matchID, rels[0].ToEntityID)
}

// ---------------------------------------------------------------------------
// CEL: numeric comparison
// ---------------------------------------------------------------------------

func TestProcess_CEL_NumericComparison(t *testing.T) {
	wsID := newID()
	ruleID := newID()
	entityID := newID()
	matchID := newID()

	entity := EntityInfo{
		ID: entityID, WorkspaceID: wsID, EntityType: "resource",
		Raw: map[string]any{
			"type":     "resource",
			"id":       entityID.String(),
			"name":     "r",
			"metadata": map[string]any{"priority": int64(10)},
		},
	}

	celExpr := `from.type == "resource" && to.type == "deployment" && int(from.metadata.priority) > int(to.metadata.priority)`

	matchDep := EntityInfo{
		ID: matchID, WorkspaceID: wsID, EntityType: "deployment",
		Raw: map[string]any{
			"type":     "deployment",
			"id":       matchID.String(),
			"name":     "d",
			"metadata": map[string]any{"priority": int64(5)},
		},
	}
	noMatchDep := EntityInfo{
		ID: newID(), WorkspaceID: wsID, EntityType: "deployment",
		Raw: map[string]any{
			"type":     "deployment",
			"id":       newID().String(),
			"name":     "d2",
			"metadata": map[string]any{"priority": int64(20)},
		},
	}

	getter := &mockGetter{
		entityInfo: &entity,
		rules:      []RuleInfo{makeRule(ruleID, celExpr)},
		candidates: map[string][]EntityInfo{
			"deployment": {matchDep, noMatchDep},
		},
	}
	setter := &mockSetter{}
	ctrl := NewController(getter, setter)

	_, err := ctrl.Process(context.Background(), reconcile.Item{
		ScopeID: FormatScopeID("resource", entityID.String()),
	})
	require.NoError(t, err)

	rels := setter.calls[0].relationships
	require.Len(t, rels, 1)
	assert.Equal(t, matchID, rels[0].ToEntityID)
}

// ---------------------------------------------------------------------------
// CEL: in-list matching via sets
// ---------------------------------------------------------------------------

func TestProcess_CEL_InListMatching(t *testing.T) {
	wsID := newID()
	ruleID := newID()
	entityID := newID()
	matchID := newID()

	entity := resourceEntity(entityID, wsID, "r", "Pod", map[string]any{"env": "prod"})

	celExpr := `from.type == "resource" && to.type == "deployment" && from.metadata.env in ["prod", "staging"]`

	getter := &mockGetter{
		entityInfo: &entity,
		rules:      []RuleInfo{makeRule(ruleID, celExpr)},
		candidates: map[string][]EntityInfo{
			"deployment": {deploymentEntity(matchID, wsID, "d", "d", nil)},
		},
	}
	setter := &mockSetter{}
	ctrl := NewController(getter, setter)

	_, err := ctrl.Process(context.Background(), reconcile.Item{
		ScopeID: FormatScopeID("resource", entityID.String()),
	})
	require.NoError(t, err)

	rels := setter.calls[0].relationships
	require.Len(t, rels, 1)
	assert.Equal(t, matchID, rels[0].ToEntityID)
}

// ---------------------------------------------------------------------------
// CEL context: "from" and "to" correctly assigned based on direction
// ---------------------------------------------------------------------------

func TestProcess_CEL_DirectionalContextAssignment(t *testing.T) {
	wsID := newID()
	ruleID := newID()
	entityID := newID()
	candID := newID()

	entity := resourceEntity(entityID, wsID, "alpha", "Service", nil)
	candidate := deploymentEntity(candID, wsID, "beta", "beta", nil)

	// Asymmetric expression: only matches when from.name == "alpha"
	celExpr := `from.type == "resource" && to.type == "deployment" && from.name == "alpha"`

	getter := &mockGetter{
		entityInfo: &entity,
		rules:      []RuleInfo{makeRule(ruleID, celExpr)},
		candidates: map[string][]EntityInfo{
			"deployment": {candidate},
		},
	}
	setter := &mockSetter{}
	ctrl := NewController(getter, setter)

	_, err := ctrl.Process(context.Background(), reconcile.Item{
		ScopeID: FormatScopeID("resource", entityID.String()),
	})
	require.NoError(t, err)

	rels := setter.calls[0].relationships
	require.Len(t, rels, 1, "entity named 'alpha' is 'from', so expression should match")
}

func TestProcess_CEL_DirectionalContextAssignment_Reverse(t *testing.T) {
	wsID := newID()
	ruleID := newID()
	entityID := newID()
	candID := newID()

	entity := deploymentEntity(entityID, wsID, "beta", "beta", nil)
	candidate := resourceEntity(candID, wsID, "alpha", "Service", nil)

	// Same asymmetric expression, but now the deployment is evaluated as "to"
	// so candidates (resources) become "from"
	celExpr := `from.type == "resource" && to.type == "deployment" && from.name == "alpha"`

	getter := &mockGetter{
		entityInfo: &entity,
		rules:      []RuleInfo{makeRule(ruleID, celExpr)},
		candidates: map[string][]EntityInfo{
			"resource": {candidate},
		},
	}
	setter := &mockSetter{}
	ctrl := NewController(getter, setter)

	_, err := ctrl.Process(context.Background(), reconcile.Item{
		ScopeID: FormatScopeID("deployment", entityID.String()),
	})
	require.NoError(t, err)

	rels := setter.calls[0].relationships
	require.Len(t, rels, 1, "candidate named 'alpha' should be placed in 'from' context and match")
	assert.Equal(t, candID, rels[0].FromEntityID)
	assert.Equal(t, entityID, rels[0].ToEntityID)
}

// ---------------------------------------------------------------------------
// Metadata property equality: incoming and outgoing connection counts
// ---------------------------------------------------------------------------

func TestProcess_MetadataPropertyEquality_IncomingOutgoing(t *testing.T) {
	wsID := newID()
	ruleID := newID()

	celExpr := `from.type == "resource" && to.type == "deployment" && from.metadata.region == to.metadata.region`

	depUSEast1 := newID()
	depUSEast2 := newID()
	depEUWest := newID()

	resUSEast1 := newID()
	resUSEast2 := newID()
	resUSEast3 := newID()
	resEUWest := newID()

	deployments := []EntityInfo{
		deploymentEntity(
			depUSEast1,
			wsID,
			"dep-us-1",
			"dep-us-1",
			map[string]any{"region": "us-east"},
		),
		deploymentEntity(
			depUSEast2,
			wsID,
			"dep-us-2",
			"dep-us-2",
			map[string]any{"region": "us-east"},
		),
		deploymentEntity(depEUWest, wsID, "dep-eu", "dep-eu", map[string]any{"region": "eu-west"}),
	}

	resources := []EntityInfo{
		resourceEntity(
			resUSEast1,
			wsID,
			"res-us-1",
			"Service",
			map[string]any{"region": "us-east"},
		),
		resourceEntity(
			resUSEast2,
			wsID,
			"res-us-2",
			"Service",
			map[string]any{"region": "us-east"},
		),
		resourceEntity(
			resUSEast3,
			wsID,
			"res-us-3",
			"Service",
			map[string]any{"region": "us-east"},
		),
		resourceEntity(resEUWest, wsID, "res-eu", "Service", map[string]any{"region": "eu-west"}),
	}

	t.Run("resource entity produces outgoing edges to matching deployments", func(t *testing.T) {
		entity := resources[0] // region=us-east
		getter := &mockGetter{
			entityInfo: &entity,
			rules:      []RuleInfo{makeRule(ruleID, celExpr)},
			candidates: map[string][]EntityInfo{"deployment": deployments},
		}
		setter := &mockSetter{}
		ctrl := NewController(getter, setter)

		_, err := ctrl.Process(context.Background(), reconcile.Item{
			ScopeID: FormatScopeID("resource", entity.ID.String()),
		})
		require.NoError(t, err)
		require.Len(t, setter.calls, 1)

		rels := setter.calls[0].relationships
		assert.Len(
			t,
			rels,
			2,
			"resource with region=us-east should connect to 2 deployments with region=us-east",
		)

		for _, rel := range rels {
			assert.Equal(t, ruleID, rel.RuleID)
			assert.Equal(t, "resource", rel.FromEntityType)
			assert.Equal(t, entity.ID, rel.FromEntityID, "entity should be on the 'from' side")
			assert.Equal(t, "deployment", rel.ToEntityType)
		}
		toIDs := []uuid.UUID{rels[0].ToEntityID, rels[1].ToEntityID}
		sort.Slice(toIDs, func(i, j int) bool { return toIDs[i].String() < toIDs[j].String() })
		expected := []uuid.UUID{depUSEast1, depUSEast2}
		sort.Slice(
			expected,
			func(i, j int) bool { return expected[i].String() < expected[j].String() },
		)
		assert.Equal(t, expected, toIDs)
	})

	t.Run("deployment entity produces incoming edges from matching resources", func(t *testing.T) {
		entity := deployments[0] // region=us-east
		getter := &mockGetter{
			entityInfo: &entity,
			rules:      []RuleInfo{makeRule(ruleID, celExpr)},
			candidates: map[string][]EntityInfo{"resource": resources},
		}
		setter := &mockSetter{}
		ctrl := NewController(getter, setter)

		_, err := ctrl.Process(context.Background(), reconcile.Item{
			ScopeID: FormatScopeID("deployment", entity.ID.String()),
		})
		require.NoError(t, err)
		require.Len(t, setter.calls, 1)

		rels := setter.calls[0].relationships
		assert.Len(
			t,
			rels,
			3,
			"deployment with region=us-east should have 3 incoming edges from resources with region=us-east",
		)

		for _, rel := range rels {
			assert.Equal(t, ruleID, rel.RuleID)
			assert.Equal(t, "resource", rel.FromEntityType)
			assert.Equal(t, "deployment", rel.ToEntityType)
			assert.Equal(t, entity.ID, rel.ToEntityID, "entity should be on the 'to' side")
		}
		fromIDs := make([]uuid.UUID, len(rels))
		for i, r := range rels {
			fromIDs[i] = r.FromEntityID
		}
		sort.Slice(
			fromIDs,
			func(i, j int) bool { return fromIDs[i].String() < fromIDs[j].String() },
		)
		expected := []uuid.UUID{resUSEast1, resUSEast2, resUSEast3}
		sort.Slice(
			expected,
			func(i, j int) bool { return expected[i].String() < expected[j].String() },
		)
		assert.Equal(t, expected, fromIDs)
	})

	t.Run("eu-west resource only connects to eu-west deployment", func(t *testing.T) {
		entity := resources[3] // region=eu-west
		getter := &mockGetter{
			entityInfo: &entity,
			rules:      []RuleInfo{makeRule(ruleID, celExpr)},
			candidates: map[string][]EntityInfo{"deployment": deployments},
		}
		setter := &mockSetter{}
		ctrl := NewController(getter, setter)

		_, err := ctrl.Process(context.Background(), reconcile.Item{
			ScopeID: FormatScopeID("resource", entity.ID.String()),
		})
		require.NoError(t, err)

		rels := setter.calls[0].relationships
		require.Len(t, rels, 1, "resource with region=eu-west should connect to 1 deployment")
		assert.Equal(t, depEUWest, rels[0].ToEntityID)
	})

	t.Run("eu-west deployment only has incoming from eu-west resource", func(t *testing.T) {
		entity := deployments[2] // region=eu-west
		getter := &mockGetter{
			entityInfo: &entity,
			rules:      []RuleInfo{makeRule(ruleID, celExpr)},
			candidates: map[string][]EntityInfo{"resource": resources},
		}
		setter := &mockSetter{}
		ctrl := NewController(getter, setter)

		_, err := ctrl.Process(context.Background(), reconcile.Item{
			ScopeID: FormatScopeID("deployment", entity.ID.String()),
		})
		require.NoError(t, err)

		rels := setter.calls[0].relationships
		require.Len(t, rels, 1, "deployment with region=eu-west should have 1 incoming edge")
		assert.Equal(t, resEUWest, rels[0].FromEntityID)
		assert.Equal(t, entity.ID, rels[0].ToEntityID)
	})
}

// ---------------------------------------------------------------------------
// Same-type metadata equality: incoming + outgoing on self-referential rule
// ---------------------------------------------------------------------------

func TestProcess_SameTypeMetadataEquality_IncomingOutgoing(t *testing.T) {
	wsID := newID()
	ruleID := newID()

	celExpr := `from.type == "resource" && to.type == "resource" && from.metadata.cluster == to.metadata.cluster`

	entityID := newID()
	peerA := newID()
	peerB := newID()
	differentCluster := newID()

	entity := resourceEntity(entityID, wsID, "main", "Pod", map[string]any{"cluster": "prod-1"})

	candidates := []EntityInfo{
		entity,
		resourceEntity(peerA, wsID, "peer-a", "Pod", map[string]any{"cluster": "prod-1"}),
		resourceEntity(peerB, wsID, "peer-b", "Pod", map[string]any{"cluster": "prod-1"}),
		resourceEntity(
			differentCluster,
			wsID,
			"staging",
			"Pod",
			map[string]any{"cluster": "staging"},
		),
	}

	getter := &mockGetter{
		entityInfo: &entity,
		rules:      []RuleInfo{makeRule(ruleID, celExpr)},
		candidates: map[string][]EntityInfo{"resource": candidates},
	}
	setter := &mockSetter{}
	ctrl := NewController(getter, setter)

	_, err := ctrl.Process(context.Background(), reconcile.Item{
		ScopeID: FormatScopeID("resource", entityID.String()),
	})
	require.NoError(t, err)
	require.Len(t, setter.calls, 1)

	rels := setter.calls[0].relationships

	var outgoing, incoming []ComputedRelationship
	for _, rel := range rels {
		if rel.FromEntityID == entityID {
			outgoing = append(outgoing, rel)
		}
		if rel.ToEntityID == entityID {
			incoming = append(incoming, rel)
		}
	}

	assert.Len(t, outgoing, 2, "entity should have 2 outgoing edges (to peerA and peerB)")
	assert.Len(t, incoming, 2, "entity should have 2 incoming edges (from peerA and peerB)")
	assert.Len(t, rels, 4, "total relationships = 2 outgoing + 2 incoming")

	outToIDs := make([]uuid.UUID, len(outgoing))
	for i, r := range outgoing {
		outToIDs[i] = r.ToEntityID
	}
	sort.Slice(outToIDs, func(i, j int) bool { return outToIDs[i].String() < outToIDs[j].String() })
	expectedPeers := []uuid.UUID{peerA, peerB}
	sort.Slice(
		expectedPeers,
		func(i, j int) bool { return expectedPeers[i].String() < expectedPeers[j].String() },
	)
	assert.Equal(t, expectedPeers, outToIDs)

	inFromIDs := make([]uuid.UUID, len(incoming))
	for i, r := range incoming {
		inFromIDs[i] = r.FromEntityID
	}
	sort.Slice(
		inFromIDs,
		func(i, j int) bool { return inFromIDs[i].String() < inFromIDs[j].String() },
	)
	assert.Equal(t, expectedPeers, inFromIDs)
}

// ---------------------------------------------------------------------------
// Multiple rules, some match, some don't
// ---------------------------------------------------------------------------

func TestProcess_MixedRuleResults(t *testing.T) {
	wsID := newID()
	ruleMatches := newID()
	ruleNoMatch := newID()
	entityID := newID()
	depID := newID()

	entity := resourceEntity(entityID, wsID, "api", "Service", map[string]any{"team": "core"})

	matchCel := `from.type == "resource" && to.type == "deployment" && from.metadata.team == to.metadata.team`
	noMatchCel := `from.type == "resource" && to.type == "deployment" && from.name == "nonexistent"`

	getter := &mockGetter{
		entityInfo: &entity,
		rules: []RuleInfo{
			makeRule(ruleMatches, matchCel),
			makeRule(ruleNoMatch, noMatchCel),
		},
		candidates: map[string][]EntityInfo{
			"deployment": {
				deploymentEntity(depID, wsID, "d", "d", map[string]any{"team": "core"}),
			},
		},
	}
	setter := &mockSetter{}
	ctrl := NewController(getter, setter)

	_, err := ctrl.Process(context.Background(), reconcile.Item{
		ScopeID: FormatScopeID("resource", entityID.String()),
	})
	require.NoError(t, err)

	rels := setter.calls[0].relationships
	require.Len(t, rels, 1)
	assert.Equal(t, ruleMatches, rels[0].RuleID)
	assert.Equal(t, depID, rels[0].ToEntityID)
}
