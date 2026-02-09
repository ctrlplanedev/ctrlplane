package v2

import (
	"context"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/reactiveindex/matchindex"
)

type Store interface {
	GetEntity(ctx context.Context, entityID string) (*oapi.RelatableEntity, error)
}

type RelationshipIndex struct {
	rule  *RelationshipRule
	index matchindex.Index
	store Store
}

func NewRelationshipIndex(store Store, rule *RelationshipRule) *RelationshipIndex {
	ri := &RelationshipIndex{store: store, rule: rule}
	ri.index = matchindex.New(ri.match)
	return ri
}

func (ri *RelationshipIndex) Rule() *RelationshipRule {
	return ri.rule
}

func (ri *RelationshipIndex) match(ctx context.Context, fromId string, toId string) (bool, error) {
	if fromId == toId {
		return false, nil
	}

	from, err := ri.store.GetEntity(ctx, fromId)
	if err != nil {
		return false, err
	}

	to, err := ri.store.GetEntity(ctx, toId)
	if err != nil {
		return false, err
	}

	if from == nil || to == nil {
		return false, nil
	}

	return ri.rule.Match(from, to)
}

func (ri *RelationshipIndex) AddEntity(ctx context.Context, entityID string) {
	ri.index.AddEntity(entityID)
	ri.index.AddSelector(entityID)
}

func (ri *RelationshipIndex) RemoveEntity(ctx context.Context, entityID string) {
	ri.index.RemoveEntity(entityID)
	ri.index.RemoveSelector(entityID)
}

func (ri *RelationshipIndex) DirtyEntity(ctx context.Context, entityID string) {
	ri.index.DirtyEntity(entityID)
	ri.index.UpdateSelector(entityID)
}

func (ri *RelationshipIndex) GetChildren(ctx context.Context, entityID string) []string {
	return ri.index.GetMatches(entityID)
}

func (ri *RelationshipIndex) GetParents(ctx context.Context, entityID string) []string {
	return ri.index.GetMatchingSelectors(entityID)
}

func (ri *RelationshipIndex) Recompute(ctx context.Context) int {
	return ri.index.Recompute(ctx)
}

func (ri *RelationshipIndex) IsDirty(ctx context.Context) bool {
	return ri.index.IsDirty()
}

func (ri *RelationshipIndex) DirtyAll(ctx context.Context) {
	ri.index.DirtyAll()
}
