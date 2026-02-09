package store

import (
	"context"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/store/repository"

	"go.opentelemetry.io/otel/attribute"
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

	entityRelations := r.store.Relations.ForEntity(entity)

	relationsByRule := make(map[string][]*oapi.EntityRelation)

	entityID := entity.GetID()
	entityType := entity.GetType()

	for _, rel := range entityRelations {
		ruleReference := rel.Rule.Reference

		var direction oapi.RelationDirection
		var relatedEntity *oapi.RelatableEntity

		if rel.From.GetID() == entityID && rel.From.GetType() == entityType {
			direction = oapi.From
			relatedEntity = rel.To
		} else {
			direction = oapi.To
			relatedEntity = rel.From
		}

		entityRelation := &oapi.EntityRelation{
			Direction:  direction,
			Entity:     *relatedEntity,
			EntityId:   relatedEntity.GetID(),
			EntityType: relatedEntity.GetType(),
			Rule:       *rel.Rule,
		}

		relationsByRule[ruleReference] = append(relationsByRule[ruleReference], entityRelation)
	}

	span.SetAttributes(
		attribute.String("entity.id", entityID),
		attribute.String("entity.type", string(entityType)),
		attribute.Int("relations.total", len(entityRelations)),
		attribute.Int("relations.rules", len(relationsByRule)),
	)

	return relationsByRule, nil
}
