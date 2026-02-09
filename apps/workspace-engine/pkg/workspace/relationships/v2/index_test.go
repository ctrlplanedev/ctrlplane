package v2

import (
	"context"
	"errors"
	"testing"
	"workspace-engine/pkg/oapi"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// mockStore implements the Store interface for testing.
type mockStore struct {
	entities   map[string]*oapi.RelatableEntity
	entityMaps map[string]map[string]any
	err        error
	// errOnID lets specific IDs return an error
	errOnID map[string]error
}

func newMockStore() *mockStore {
	return &mockStore{
		entities:   make(map[string]*oapi.RelatableEntity),
		entityMaps: make(map[string]map[string]any),
		errOnID:    make(map[string]error),
	}
}

func (m *mockStore) GetEntity(_ context.Context, entityID string) (*oapi.RelatableEntity, error) {
	if m.err != nil {
		return nil, m.err
	}
	if err, ok := m.errOnID[entityID]; ok {
		return nil, err
	}
	return m.entities[entityID], nil
}

func (m *mockStore) GetEntityMap(_ context.Context, entityID string) (map[string]any, error) {
	if m.err != nil {
		return nil, m.err
	}
	if err, ok := m.errOnID[entityID]; ok {
		return nil, err
	}
	if em, ok := m.entityMaps[entityID]; ok {
		return em, nil
	}
	return nil, nil
}

func (m *mockStore) addResource(r *oapi.Resource) {
	m.entityMaps[r.Id] = map[string]any{
		"type":        "resource",
		"id":          r.Id,
		"name":        r.Name,
		"kind":        r.Kind,
		"version":     r.Version,
		"workspaceId": r.WorkspaceId,
	}
}

func (m *mockStore) addDeployment(d *oapi.Deployment) {
	m.entityMaps[d.Id] = map[string]any{
		"type":     "deployment",
		"id":       d.Id,
		"name":     d.Name,
		"slug":     d.Slug,
		"systemId": d.SystemId,
	}
}

func makeResource(id, name string) *oapi.Resource {
	return &oapi.Resource{
		Id:          id,
		Name:        name,
		WorkspaceId: "ws-1",
		Kind:        "pod",
		Version:     "v1",
	}
}

func makeDeployment(id, name string) *oapi.Deployment {
	return &oapi.Deployment{
		Id:             id,
		Name:           name,
		Slug:           id,
		SystemId:       "system-1",
		JobAgentConfig: map[string]any{},
	}
}

func celRule(expr string) *RelationshipRule {
	return &RelationshipRule{
		ID:   "rule-1",
		Name: "test-rule",
		Matcher: oapi.CelMatcher{
			Cel: expr,
		},
	}
}

func TestNewRelationshipIndex(t *testing.T) {
	store := newMockStore()
	rule := celRule("from.name == to.name")
	idx, err := NewRelationshipIndex(store, rule)

	require.NoError(t, err)
	assert.NotNil(t, idx)
	assert.Equal(t, rule, idx.Rule())
}

func TestRelationshipIndex_AddEntityAndRecompute(t *testing.T) {
	ctx := context.Background()
	store := newMockStore()

	r := makeResource("r1", "app")
	d := makeDeployment("d1", "app")
	store.addResource(r)
	store.addDeployment(d)

	rule := celRule("from.name == to.name")
	idx, err := NewRelationshipIndex(store, rule)
	require.NoError(t, err)

	idx.AddEntity(ctx, "r1")
	idx.AddEntity(ctx, "d1")

	assert.True(t, idx.IsDirty(ctx))

	evals := idx.Recompute(ctx)
	assert.Greater(t, evals, 0)
	assert.False(t, idx.IsDirty(ctx))

	// r1 should match d1 (same name "app") and vice versa
	children := idx.GetChildren(ctx, "r1")
	assert.Contains(t, children, "d1")

	parents := idx.GetParents(ctx, "d1")
	assert.Contains(t, parents, "r1")
}

func TestRelationshipIndex_NoMatchWhenNamesDiffer(t *testing.T) {
	ctx := context.Background()
	store := newMockStore()

	r := makeResource("r1", "frontend")
	d := makeDeployment("d1", "backend")
	store.addResource(r)
	store.addDeployment(d)

	rule := celRule("from.name == to.name")
	idx, err := NewRelationshipIndex(store, rule)
	require.NoError(t, err)

	idx.AddEntity(ctx, "r1")
	idx.AddEntity(ctx, "d1")
	idx.Recompute(ctx)

	assert.Empty(t, idx.GetChildren(ctx, "r1"))
	assert.Empty(t, idx.GetParents(ctx, "d1"))
}

func TestRelationshipIndex_RemoveEntity(t *testing.T) {
	ctx := context.Background()
	store := newMockStore()

	r := makeResource("r1", "app")
	d := makeDeployment("d1", "app")
	store.addResource(r)
	store.addDeployment(d)

	rule := celRule("from.name == to.name")
	idx, err := NewRelationshipIndex(store, rule)
	require.NoError(t, err)

	idx.AddEntity(ctx, "r1")
	idx.AddEntity(ctx, "d1")
	idx.Recompute(ctx)

	assert.Contains(t, idx.GetChildren(ctx, "r1"), "d1")

	idx.RemoveEntity(ctx, "d1")
	assert.Empty(t, idx.GetChildren(ctx, "r1"))
}

func TestRelationshipIndex_DirtyEntity(t *testing.T) {
	ctx := context.Background()
	store := newMockStore()

	r := makeResource("r1", "app")
	d := makeDeployment("d1", "app")
	store.addResource(r)
	store.addDeployment(d)

	rule := celRule("from.name == to.name")
	idx, err := NewRelationshipIndex(store, rule)
	require.NoError(t, err)

	idx.AddEntity(ctx, "r1")
	idx.AddEntity(ctx, "d1")
	idx.Recompute(ctx)

	assert.False(t, idx.IsDirty(ctx))

	idx.DirtyEntity(ctx, "r1")
	assert.True(t, idx.IsDirty(ctx))

	evals := idx.Recompute(ctx)
	assert.Greater(t, evals, 0)
	assert.False(t, idx.IsDirty(ctx))
}

func TestRelationshipIndex_DirtyAll(t *testing.T) {
	ctx := context.Background()
	store := newMockStore()

	r := makeResource("r1", "app")
	d := makeDeployment("d1", "app")
	store.addResource(r)
	store.addDeployment(d)

	rule := celRule("from.name == to.name")
	idx, err := NewRelationshipIndex(store, rule)
	require.NoError(t, err)

	idx.AddEntity(ctx, "r1")
	idx.AddEntity(ctx, "d1")
	idx.Recompute(ctx)

	assert.False(t, idx.IsDirty(ctx))

	idx.DirtyAll(ctx)
	assert.True(t, idx.IsDirty(ctx))

	evals := idx.Recompute(ctx)
	assert.Greater(t, evals, 0)
}

func TestRelationshipIndex_SelfMatchExcluded(t *testing.T) {
	ctx := context.Background()
	store := newMockStore()

	r := makeResource("r1", "app")
	store.addResource(r)

	// "true" would match everything, but self should be excluded
	rule := celRule("true")
	idx, err := NewRelationshipIndex(store, rule)
	require.NoError(t, err)

	idx.AddEntity(ctx, "r1")
	idx.Recompute(ctx)

	assert.Empty(t, idx.GetChildren(ctx, "r1"))
}

func TestRelationshipIndex_MatchStoreErrorFrom(t *testing.T) {
	ctx := context.Background()
	store := newMockStore()

	d := makeDeployment("d1", "app")
	store.addDeployment(d)
	store.errOnID["r1"] = errors.New("not found")

	rule := celRule("true")
	idx, err := NewRelationshipIndex(store, rule)
	require.NoError(t, err)

	idx.AddEntity(ctx, "r1")
	idx.AddEntity(ctx, "d1")
	idx.Recompute(ctx)

	// Error on "from" entity means no match
	assert.Empty(t, idx.GetChildren(ctx, "r1"))
}

func TestRelationshipIndex_MatchStoreErrorTo(t *testing.T) {
	ctx := context.Background()
	store := newMockStore()

	r := makeResource("r1", "app")
	store.addResource(r)
	store.errOnID["d1"] = errors.New("not found")

	rule := celRule("true")
	idx, err := NewRelationshipIndex(store, rule)
	require.NoError(t, err)

	idx.AddEntity(ctx, "r1")
	idx.AddEntity(ctx, "d1")
	idx.Recompute(ctx)

	assert.Empty(t, idx.GetChildren(ctx, "r1"))
}

func TestRelationshipIndex_MatchNilFrom(t *testing.T) {
	ctx := context.Background()
	store := newMockStore()

	// r1 is registered in the index but NOT in the store, so GetEntityMap returns nil
	d := makeDeployment("d1", "app")
	store.addDeployment(d)

	rule := celRule("true")
	idx, err := NewRelationshipIndex(store, rule)
	require.NoError(t, err)

	idx.AddEntity(ctx, "r1")
	idx.AddEntity(ctx, "d1")
	idx.Recompute(ctx)

	assert.Empty(t, idx.GetChildren(ctx, "r1"))
}

func TestRelationshipIndex_MatchNilTo(t *testing.T) {
	ctx := context.Background()
	store := newMockStore()

	r := makeResource("r1", "app")
	store.addResource(r)
	// d1 not in store

	rule := celRule("true")
	idx, err := NewRelationshipIndex(store, rule)
	require.NoError(t, err)

	idx.AddEntity(ctx, "r1")
	idx.AddEntity(ctx, "d1")
	idx.Recompute(ctx)

	assert.Empty(t, idx.GetChildren(ctx, "r1"))
}

func TestRelationshipIndex_IsDirtyFalseWhenEmpty(t *testing.T) {
	ctx := context.Background()
	store := newMockStore()
	rule := celRule("true")
	idx, err := NewRelationshipIndex(store, rule)
	require.NoError(t, err)

	assert.False(t, idx.IsDirty(ctx))
}

func TestRelationshipIndex_RecomputeNoEntities(t *testing.T) {
	ctx := context.Background()
	store := newMockStore()
	rule := celRule("true")
	idx, err := NewRelationshipIndex(store, rule)
	require.NoError(t, err)

	evals := idx.Recompute(ctx)
	assert.Equal(t, 0, evals)
}

func TestRelationshipIndex_GetChildrenEmpty(t *testing.T) {
	ctx := context.Background()
	store := newMockStore()
	rule := celRule("true")
	idx, err := NewRelationshipIndex(store, rule)
	require.NoError(t, err)

	assert.Empty(t, idx.GetChildren(ctx, "nonexistent"))
}

func TestRelationshipIndex_GetParentsEmpty(t *testing.T) {
	ctx := context.Background()
	store := newMockStore()
	rule := celRule("true")
	idx, err := NewRelationshipIndex(store, rule)
	require.NoError(t, err)

	assert.Empty(t, idx.GetParents(ctx, "nonexistent"))
}

func TestRelationshipIndex_MultipleEntities(t *testing.T) {
	ctx := context.Background()
	store := newMockStore()

	r1 := makeResource("r1", "app")
	r2 := makeResource("r2", "api")
	d1 := makeDeployment("d1", "app")
	d2 := makeDeployment("d2", "api")
	store.addResource(r1)
	store.addResource(r2)
	store.addDeployment(d1)
	store.addDeployment(d2)

	rule := celRule("from.name == to.name")
	idx, err := NewRelationshipIndex(store, rule)
	require.NoError(t, err)

	idx.AddEntity(ctx, "r1")
	idx.AddEntity(ctx, "r2")
	idx.AddEntity(ctx, "d1")
	idx.AddEntity(ctx, "d2")
	idx.Recompute(ctx)

	// r1 ("app") matches d1 ("app"), not d2
	children := idx.GetChildren(ctx, "r1")
	assert.Contains(t, children, "d1")
	assert.NotContains(t, children, "d2")

	// r2 ("api") matches d2 ("api"), not d1
	children2 := idx.GetChildren(ctx, "r2")
	assert.Contains(t, children2, "d2")
	assert.NotContains(t, children2, "d1")
}

func TestRelationshipIndex_DirtyEntityAfterUpdate(t *testing.T) {
	ctx := context.Background()
	store := newMockStore()

	r := makeResource("r1", "old-name")
	d := makeDeployment("d1", "new-name")
	store.addResource(r)
	store.addDeployment(d)

	rule := celRule("from.name == to.name")
	idx, err := NewRelationshipIndex(store, rule)
	require.NoError(t, err)

	idx.AddEntity(ctx, "r1")
	idx.AddEntity(ctx, "d1")
	idx.Recompute(ctx)

	assert.Empty(t, idx.GetChildren(ctx, "r1"))

	// Update the resource name in the store
	updated := makeResource("r1", "new-name")
	store.addResource(updated)

	idx.DirtyEntity(ctx, "r1")
	idx.Recompute(ctx)

	assert.Contains(t, idx.GetChildren(ctx, "r1"), "d1")
}

func TestRelationshipIndex_RemoveAndReaddEntity(t *testing.T) {
	ctx := context.Background()
	store := newMockStore()

	r := makeResource("r1", "app")
	d := makeDeployment("d1", "app")
	store.addResource(r)
	store.addDeployment(d)

	rule := celRule("from.name == to.name")
	idx, err := NewRelationshipIndex(store, rule)
	require.NoError(t, err)

	idx.AddEntity(ctx, "r1")
	idx.AddEntity(ctx, "d1")
	idx.Recompute(ctx)
	assert.Contains(t, idx.GetChildren(ctx, "r1"), "d1")

	idx.RemoveEntity(ctx, "r1")
	assert.Empty(t, idx.GetParents(ctx, "d1"))

	// Re-add
	idx.AddEntity(ctx, "r1")
	idx.Recompute(ctx)
	assert.Contains(t, idx.GetChildren(ctx, "r1"), "d1")
}

func TestRelationshipIndex_RuleGetter(t *testing.T) {
	store := newMockStore()
	rule := &RelationshipRule{
		ID:          "rule-abc",
		Name:        "my-rule",
		Description: "desc",
		Reference:   "ref",
		Matcher:     oapi.CelMatcher{Cel: "true"},
	}
	idx, err := NewRelationshipIndex(store, rule)
	require.NoError(t, err)

	got := idx.Rule()
	require.NotNil(t, got)
	assert.Equal(t, "rule-abc", got.ID)
	assert.Equal(t, "my-rule", got.Name)
	assert.Equal(t, "desc", got.Description)
	assert.Equal(t, "ref", got.Reference)
}

func TestNewRelationshipIndex_InvalidCEL(t *testing.T) {
	store := newMockStore()
	rule := &RelationshipRule{
		ID:      "bad-rule",
		Matcher: oapi.CelMatcher{Cel: "invalid $$$ expression"},
	}
	_, err := NewRelationshipIndex(store, rule)
	assert.Error(t, err)
}
