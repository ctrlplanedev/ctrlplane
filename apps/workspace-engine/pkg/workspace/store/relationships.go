package store

import (
	"context"
	"workspace-engine/pkg/changeset"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/relationships/relationgraph"
	"workspace-engine/pkg/workspace/store/repository"
)

func NewRelationshipRules(store *Store) *RelationshipRules {
	return &RelationshipRules{
		repo:  store.repo,
		store: store,
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

	if err := r.buildGraph(ctx, nil); err != nil {
		return err
	}

	return nil
}

func (r *RelationshipRules) Get(id string) (*oapi.RelationshipRule, bool) {
	return r.repo.RelationshipRules.Get(id)
}

func (r *RelationshipRules) Has(id string) bool {
	return r.repo.RelationshipRules.Has(id)
}

func (r *RelationshipRules) Remove(ctx context.Context, id string) error {
	relationship, ok := r.repo.RelationshipRules.Get(id)
	if !ok || relationship == nil {
		return nil
	}

	r.repo.RelationshipRules.Remove(id)
	if cs, ok := changeset.FromContext[any](ctx); ok {
		cs.Record(changeset.ChangeTypeDelete, relationship)
	}

	r.store.changeset.RecordDelete(relationship)

	return r.buildGraph(ctx, nil)
}

func (r *RelationshipRules) Items() map[string]*oapi.RelationshipRule {
	return r.repo.RelationshipRules.Items()
}

// GetRelatedEntities returns all entities related to the given entity, grouped by relationship reference.
// This includes relationships where the entity is the "from" side (outgoing) or "to" side (incoming).
func (r *RelationshipRules) GetRelatedEntities(
	ctx context.Context,
	entity *oapi.RelatableEntity,
) (
	map[string][]*oapi.EntityRelation,
	error,
) {
	if r.graph == nil {
		if err := r.buildGraph(ctx, nil); err != nil {
			return nil, err
		}
	}

	return r.graph.GetRelatedEntities(entity.GetID()), nil
}

func (r *RelationshipRules) InvalidateGraph(ctx context.Context) error {
	r.graph = nil
	return r.buildGraph(ctx, nil)
}

func (r *RelationshipRules) buildGraph(ctx context.Context, setStatus func(msg string)) (err error) {
	builder := relationgraph.NewBuilder(
		r.store.Resources.Items(),
		r.store.Deployments.Items(),
		r.store.Environments.Items(),
		r.repo.RelationshipRules.Items(),
	).WithParallelProcessing(true)

	if setStatus != nil {
		builder = builder.WithSetStatus(setStatus)
	}

	r.graph, err = builder.Build(ctx)
	return err
}
