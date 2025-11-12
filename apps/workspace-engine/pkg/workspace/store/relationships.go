package store

import (
	"context"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/store/repository"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
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
	_, span := tracer.Start(ctx, "GetRelatedEntities")
	defer span.End()

	// Get all relations for the entity
	entityRelations := r.store.Relations.ForEntity(entity)

	// Group by rule ID
	relationsByRule := make(map[string][]*oapi.EntityRelation)

	entityID := entity.GetID()
	entityType := entity.GetType()

	span.SetAttributes(
		attribute.String("entity.id", entityID),
		attribute.String("entity.type", string(entityType)),
		attribute.Int("entity_relations.count", len(entityRelations)),
	)

	for _, rel := range entityRelations {
		// Use rule Reference as the key (not ID) for variable resolution
		ruleReference := rel.Rule.Reference

		// Determine direction and related entity
		var direction oapi.RelationDirection
		var relatedEntity *oapi.RelatableEntity

		if rel.From.GetID() == entityID && rel.From.GetType() == entityType {
			// This entity is the "from" entity, so direction is "from"
			direction = oapi.From
			relatedEntity = rel.To
		} else {
			// This entity is the "to" entity, so direction is "to"
			direction = oapi.To
			relatedEntity = rel.From
		}

		// Convert to oapi.EntityRelation
		entityRelation := &oapi.EntityRelation{
			Direction:  direction,
			Entity:     *relatedEntity,
			EntityId:   relatedEntity.GetID(),
			EntityType: relatedEntity.GetType(),
			Rule:       *rel.Rule,
		}

		span.AddEvent("Adding entity relation", trace.WithAttributes(
			attribute.String("rule.reference", ruleReference),
			attribute.String("direction", string(direction)),
			attribute.String("related_entity.id", relatedEntity.GetID()),
			attribute.String("related_entity.type", string(relatedEntity.GetType())),
		))

		relationsByRule[ruleReference] = append(relationsByRule[ruleReference], entityRelation)
	}

	return relationsByRule, nil
}
