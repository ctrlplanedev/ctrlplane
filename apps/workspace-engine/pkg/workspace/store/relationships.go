package store

import (
	"context"
	"workspace-engine/pkg/changeset"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/relationships/relationgraph"
	"workspace-engine/pkg/workspace/store/repository"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
)

var relationshipsTracer = otel.Tracer("workspace.store.relationships")

type StoreEntityProvider struct {
	store *Store
}

func (s *StoreEntityProvider) GetResources() map[string]*oapi.Resource {
	return s.store.repo.Resources.Items()
}

func (s *StoreEntityProvider) GetDeployments() map[string]*oapi.Deployment {
	return s.store.repo.Deployments.Items()
}

func (s *StoreEntityProvider) GetEnvironments() map[string]*oapi.Environment {
	return s.store.Environments.Items()
}

func (s *StoreEntityProvider) GetRelationshipRules() map[string]*oapi.RelationshipRule {
	return s.store.repo.RelationshipRules.Items()
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

	r.graph.InvalidateRule(relationship.Reference)

	return nil
}

func (r *RelationshipRules) Items() map[string]*oapi.RelationshipRule {
	return r.repo.RelationshipRules.Items()
}

// InvalidateEntity clears the cached relationships for a specific entity
// This is useful when entities are modified in ways that might affect their relationships
func (r *RelationshipRules) InvalidateEntity(entityID string) {
	r.graph.InvalidateEntity(entityID)
}

// InvalidateEntityAndPotentialSources invalidates an entity and all entities that might have relationships to it.
// This should be called when an entity is created or updated, as it may become a new target in existing relationships.
func (r *RelationshipRules) InvalidateEntityAndPotentialSources(entityID string, entityType oapi.RelatableEntityType) {
	// Always invalidate the entity itself
	r.graph.InvalidateEntity(entityID)

	// Find all rules where this entity type could be a target
	// For each such rule, we need to invalidate entities of the FromType
	// since they might now have new relationships to this entity
	for _, rule := range r.repo.RelationshipRules.Items() {
		if rule.ToType != entityType {
			continue
		}

		// This rule could create relationships TO our entity
		// Invalidate all entities of the FromType since their relationships may have changed
		// We use InvalidateByType to efficiently clear all entities of that type
		r.InvalidateEntitiesByType(rule.FromType)
	}
}

// InvalidateEntitiesByType invalidates all entities of a specific type
// This is used when a new potential target is added to ensure all sources recompute
func (r *RelationshipRules) InvalidateEntitiesByType(entityType oapi.RelatableEntityType) {
	switch entityType {
	case oapi.RelatableEntityTypeResource:
		for id := range r.store.repo.Resources.Items() {
			r.graph.InvalidateEntity(id)
		}
	case oapi.RelatableEntityTypeDeployment:
		for id := range r.store.repo.Deployments.Items() {
			r.graph.InvalidateEntity(id)
		}
	case oapi.RelatableEntityTypeEnvironment:
		for id := range r.store.Environments.Items() {
			r.graph.InvalidateEntity(id)
		}
	}
}

func (r *RelationshipRules) GetRelatedEntities(ctx context.Context, entity *oapi.RelatableEntity) (map[string][]*oapi.EntityRelation, error) {
	ctx, span := relationshipsTracer.Start(ctx, "GetRelatedEntities")
	defer span.End()

	span.SetAttributes(
		attribute.String("entity.id", entity.GetID()),
		attribute.String("entity.type", string(entity.GetType())),
	)

	return r.graph.GetRelatedEntitiesWithCompute(ctx, entity.GetID())
}
