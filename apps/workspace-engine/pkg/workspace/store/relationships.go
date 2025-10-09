package store

import (
	"context"
	"workspace-engine/pkg/pb"
	"workspace-engine/pkg/workspace/store/repository"
)

func NewRelationshipRules(store *Store) *RelationshipRules {
	return &RelationshipRules{
		repo:  store.repo,
		store: store,
	}
}

type RelationshipRules struct {
	repo  *repository.Repository
	store *Store
}


func (r *RelationshipRules) Upsert(ctx context.Context, relationship *pb.RelationshipRule) error {
	r.repo.RelationshipRules.Set(relationship.Id, relationship)
	return nil
}

func (r *RelationshipRules) Get(id string) (*pb.RelationshipRule, bool) {
	return r.repo.RelationshipRules.Get(id)
}

func (r *RelationshipRules) Has(id string) bool {
	return r.repo.RelationshipRules.Has(id)
}

func (r *RelationshipRules) Remove(id string) {
	r.repo.RelationshipRules.Remove(id)
}

func (r *RelationshipRules) GetRelations(ctx context.Context, entity any) map[string][]any {
	return nil
}
