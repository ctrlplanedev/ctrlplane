package store

import (
	"context"
	"workspace-engine/pkg/changeset"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/relationships/relationgraph"
	"workspace-engine/pkg/workspace/store/repository"
)

type StoreEntityProvider struct {
	store *Store
}

func (s *StoreEntityProvider) GetResources() map[string]*oapi.Resource {
	return s.store.repo.Resources
}

func (s *StoreEntityProvider) GetDeployments() map[string]*oapi.Deployment {
	return s.store.repo.Deployments
}

func (s *StoreEntityProvider) GetEnvironments() map[string]*oapi.Environment {
	return s.store.repo.Environments
}

func (s *StoreEntityProvider) GetRelationshipRules() map[string]*oapi.RelationshipRule {
	return s.store.repo.RelationshipRules
}

func (s *StoreEntityProvider) GetRelationshipRule(reference string) (*oapi.RelationshipRule, bool) {
	return s.store.repo.RelationshipRules.Get(reference)
}

func NewRelationshipRules(store *Store) *RelationshipRules {
	graph := relationgraph.NewGraph(&StoreEntityProvider{store: store})
	return &RelationshipRules{
		repo:  store.repo,
		store: store,
		graph: graph,
	}
}

type RelationshipRules struct {
	repo  *repository.InMemoryStore
	store *Store

	graph *relationgraph.Graph
}

func (r *RelationshipRules) Upsert(ctx context.Context, relationship *oapi.RelationshipRule) error {
	r.repo.RelationshipRules.Set(relationship.Id, relationship)
	if cs, ok := changeset.FromContext[any](ctx); ok {
		cs.Record(changeset.ChangeTypeUpsert, relationship)
	}

	r.store.changeset.RecordUpsert(relationship)
	r.graph.InvalidateRule(relationship.Reference)

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
	return r.repo.RelationshipRules
}

func (r *RelationshipRules) GetRelatedEntities(ctx context.Context, entity *oapi.RelatableEntity) (map[string][]*oapi.EntityRelation, error) {
	return nil, nil
}
