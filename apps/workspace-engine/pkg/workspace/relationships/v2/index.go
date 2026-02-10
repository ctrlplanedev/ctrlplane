package v2

import (
	"context"
	"fmt"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/reactiveindex/matchindex"
	"workspace-engine/pkg/workspace/relationships"
)

type Store interface {
	GetEntity(ctx context.Context, entityID string) (*oapi.RelatableEntity, error)
	GetEntityMap(ctx context.Context, entityID string) (map[string]any, error)
}

type RelationshipIndex struct {
	rule       *RelationshipRule
	index      matchindex.Index
	store      Store
	matcher    *relationships.CelMatcher
	entityMaps map[string]map[string]any
}

func NewRelationshipIndex(store Store, rule *RelationshipRule) (*RelationshipIndex, error) {
	matcher, err := relationships.NewCelMatcher(&rule.Matcher)
	if err != nil {
		return nil, fmt.Errorf("failed to compile CEL matcher: %w", err)
	}

	ri := &RelationshipIndex{
		store:      store,
		rule:       rule,
		matcher:    matcher,
		entityMaps: make(map[string]map[string]any),
	}
	ri.index = matchindex.New(ri.match)
	return ri, nil
}

func (ri *RelationshipIndex) Rule() *RelationshipRule {
	return ri.rule
}

func (ri *RelationshipIndex) match(_ context.Context, fromId string, toId string) (bool, error) {
	if fromId == toId {
		return false, nil
	}

	fromMap, ok := ri.entityMaps[fromId]
	if !ok {
		return false, nil
	}

	toMap, ok := ri.entityMaps[toId]
	if !ok {
		return false, nil
	}

	return ri.matcher.Evaluate(fromMap, toMap), nil
}

func (ri *RelationshipIndex) AddEntity(ctx context.Context, entityID string) {
	if m, err := ri.store.GetEntityMap(ctx, entityID); err == nil && m != nil {
		ri.entityMaps[entityID] = m
	}
	ri.index.AddEntity(entityID)
	ri.index.AddSelector(entityID)
}

func (ri *RelationshipIndex) RemoveEntity(_ context.Context, entityID string) {
	delete(ri.entityMaps, entityID)
	ri.index.RemoveEntity(entityID)
	ri.index.RemoveSelector(entityID)
}

func (ri *RelationshipIndex) DirtyEntity(ctx context.Context, entityID string) {
	if m, err := ri.store.GetEntityMap(ctx, entityID); err == nil && m != nil {
		ri.entityMaps[entityID] = m
	}
	ri.index.DirtyEntity(entityID)
	ri.index.UpdateSelector(entityID)
}

func (ri *RelationshipIndex) GetChildren(_ context.Context, entityID string) []string {
	return ri.index.GetMatches(entityID)
}

func (ri *RelationshipIndex) GetParents(_ context.Context, entityID string) []string {
	return ri.index.GetMatchingSelectors(entityID)
}

func (ri *RelationshipIndex) Recompute(ctx context.Context) int {
	return ri.index.Recompute(ctx)
}

func (ri *RelationshipIndex) IsDirty(_ context.Context) bool {
	return ri.index.IsDirty()
}

func (ri *RelationshipIndex) DirtyAll(_ context.Context) {
	ri.index.DirtyAll()
}
