package store

import (
	"context"
	"workspace-engine/pkg/cmap"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/relationships"
)

type Relations struct {
	store *Store

	relatedEntities cmap.ConcurrentMap[string, *relationships.EntityRelation]
}

func NewRelations(store *Store) *Relations {
	return &Relations{store: store, relatedEntities: cmap.New[*relationships.EntityRelation]()}
}

func (r *Relations) GetRelatableEntities(ctx context.Context) []*oapi.RelatableEntity {
	envs := r.store.Environments.Items()
	deployments := r.store.Deployments.Items()
	resources := r.store.Resources.Items()

	entities := make([]*oapi.RelatableEntity, 0, len(resources)+len(deployments)+len(envs))
	for _, resource := range resources {
		entities = append(entities, relationships.NewResourceEntity(resource))
	}
	for _, deployment := range deployments {
		entities = append(entities, relationships.NewDeploymentEntity(deployment))
	}
	for _, environment := range envs {
		entities = append(entities, relationships.NewEnvironmentEntity(environment))
	}

	return entities
}

func (r *Relations) Upsert(ctx context.Context, entityRelation *relationships.EntityRelation) error {
	r.relatedEntities.Set(entityRelation.Key(), entityRelation)
	r.store.changeset.RecordUpsert(entityRelation)
	return nil
}

func (r *Relations) Get(key string) (*relationships.EntityRelation, bool) {
	return r.relatedEntities.Get(key)
}

func (r *Relations) Remove(key string) {
	entityRelation, ok := r.relatedEntities.Get(key)
	if !ok {
		return
	}
	r.relatedEntities.Remove(key)
	r.store.changeset.RecordDelete(entityRelation)
}

func (r *Relations) Items() map[string]*relationships.EntityRelation {
	return r.relatedEntities.Items()
}

// GetForEntity returns all relations where the entity is either the "from" or "to" entity
func (r *Relations) ForEntity(entity *oapi.RelatableEntity) []*relationships.EntityRelation {
	entityID := entity.GetID()
	entityType := entity.GetType()

	relations := make([]*relationships.EntityRelation, 0)
	for _, relation := range r.relatedEntities.Items() {
		// Check if entity is the "from" entity
		if relation.From.GetID() == entityID && relation.From.GetType() == entityType {
			relations = append(relations, relation)
			continue
		}
		// Check if entity is the "to" entity
		if relation.To.GetID() == entityID && relation.To.GetType() == entityType {
			relations = append(relations, relation)
		}
	}

	return relations
}

func (r *Relations) ForRule(rule *oapi.RelationshipRule) []*relationships.EntityRelation {
	relations := make([]*relationships.EntityRelation, 0)
	for _, relation := range r.relatedEntities.Items() {
		if relation.Rule.Id == rule.Id {
			relations = append(relations, relation)
		}
	}
	return relations
}

func (r *Relations) RemoveForEntity(ctx context.Context, entity *oapi.RelatableEntity) {
	for _, relation := range r.ForEntity(entity) {
		r.Remove(relation.Key())
	}
}

func (r *Relations) RemoveForRule(ctx context.Context, rule *oapi.RelationshipRule) {
	for _, relation := range r.ForRule(rule) {
		r.Remove(relation.Key())
	}
}
