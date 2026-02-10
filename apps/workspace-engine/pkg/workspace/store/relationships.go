package store

import (
	"context"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/store/repository"
)

func NewRelationshipRules(store *Store) *RelationshipRules {
	rr := &RelationshipRules{
		repo:  store.repo,
		store: store,
	}

	return rr
}

type RelationshipRules struct {
	repo  *repository.InMemoryStore
	store *Store
}

func (r *RelationshipRules) Upsert(ctx context.Context, relationship *oapi.RelationshipRule) error {
	r.repo.RelationshipRules.Set(relationship.Id, relationship)
	r.store.changeset.RecordUpsert(relationship)
	return nil
}

func (r *RelationshipRules) Get(id string) (*oapi.RelationshipRule, bool) {
	return r.repo.RelationshipRules.Get(id)
}

func (r *RelationshipRules) Remove(ctx context.Context, id string) error {
	relationship, ok := r.repo.RelationshipRules.Get(id)
	if !ok || relationship == nil {
		return nil
	}

	r.repo.RelationshipRules.Remove(id)
	r.store.changeset.RecordDelete(relationship)

	return nil
}

func (r *RelationshipRules) Items() map[string]*oapi.RelationshipRule {
	return r.repo.RelationshipRules.Items()
}

func (r *RelationshipRules) GetRelatedEntities(ctx context.Context, entity *oapi.RelatableEntity) (map[string][]*oapi.EntityRelation, error) {
	return r.store.RelationshipIndexes.GetRelatedEntities(ctx, entity)
}
