package store

import (
	"context"
	"fmt"
	"workspace-engine/pkg/changeset"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/selector"
	"workspace-engine/pkg/workspace/relationships"
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

func (r *RelationshipRules) Upsert(ctx context.Context, relationship *oapi.RelationshipRule) error {
	r.repo.RelationshipRules.Set(relationship.Id, relationship)
	if cs, ok := changeset.FromContext[any](ctx); ok {
		cs.Record(changeset.ChangeTypeUpsert, relationship)
	}
	return nil
}

func (r *RelationshipRules) Get(id string) (*oapi.RelationshipRule, bool) {
	return r.repo.RelationshipRules.Get(id)
}

func (r *RelationshipRules) Has(id string) bool {
	return r.repo.RelationshipRules.Has(id)
}

func (r *RelationshipRules) Remove(ctx context.Context, id string) {
	relationship, ok := r.repo.RelationshipRules.Get(id)
	if !ok || relationship == nil {
		return
	}

	r.repo.RelationshipRules.Remove(id)
	if cs, ok := changeset.FromContext[any](ctx); ok {
		cs.Record(changeset.ChangeTypeDelete, relationship)
	}
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
	result := make(map[string][]*oapi.EntityRelation)

	// Find all relationship rules where this entity matches
	for _, rule := range r.repo.RelationshipRules.Items() {

		// Check if this entity matches the "from" selector
		fromMatches := false
		if rule.FromType == entity.GetType() {
			if rule.FromSelector == nil {
				fromMatches = true
			} else {
				matched, err := selector.Match(ctx, rule.FromSelector, entity.Item())
				if err != nil {
					return nil, err
				}
				fromMatches = matched
			}
		}

		// If entity is on the "from" side, find matching "to" entities
		if fromMatches {
			toEntities, err := r.findMatchingEntities(ctx, rule, rule.ToType, rule.ToSelector, entity, true)
			if err != nil {
				return nil, err
			}
			if len(toEntities) > 0 {
				relatedEntities := make([]*oapi.EntityRelation, 0)
				for _, toEntity := range toEntities {
					relatedEntities = append(relatedEntities, &oapi.EntityRelation{
						Rule:       rule,
						Direction:  oapi.To,
						EntityType: toEntity.GetType(),
						EntityId:   toEntity.GetID(),
						Entity:     *toEntity,
					})
				}

				result[rule.Reference] = append(result[rule.Reference], relatedEntities...)
			}
		}

		// Check if this entity matches the "to" selector
		toMatches := false
		if rule.ToType == entity.GetType() {
			if rule.ToSelector == nil {
				toMatches = true
			} else {
				matched, err := selector.Match(ctx, rule.ToSelector, entity.Item())
				if err != nil {
					return nil, err
				}
				toMatches = matched
			}
		}

		// If entity is on the "to" side, find matching "from" entities
		if toMatches && !fromMatches {
			fromEntities, err := r.findMatchingEntities(ctx, rule, rule.FromType, rule.FromSelector, entity, false)
			if err != nil {
				return nil, err
			}
			if len(fromEntities) > 0 {
				relatedEntities := make([]*oapi.EntityRelation, 0)
				for _, fromEntity := range fromEntities {
					relatedEntities = append(relatedEntities, &oapi.EntityRelation{
						Rule:       rule,
						Direction:  oapi.From,
						EntityType: rule.FromType,
						EntityId:   fromEntity.GetID(),
						Entity:     *fromEntity,
					})
				}
				result[rule.Reference] = append(result[rule.Reference], relatedEntities...)
			}
		}
	}

	return result, nil
}

// findMatchingEntities is a helper function that finds entities matching a selector and property matchers
func (r *RelationshipRules) findMatchingEntities(
	ctx context.Context,
	rule *oapi.RelationshipRule,
	entityType oapi.RelatableEntityType,
	entitySelector *oapi.Selector,
	sourceEntity *oapi.RelatableEntity,
	evaluateFromTo bool, // true = evaluate(source, target), false = evaluate(target, source)
) ([]*oapi.RelatableEntity, error) {
	var result []*oapi.RelatableEntity

	switch entityType {
	case "deployment":
		for _, deployment := range r.store.Deployments.Items() {
			deploymentEntity := relationships.NewDeploymentEntity(deployment)
			if entitySelector != nil {
				matched, err := selector.Match(ctx, entitySelector, deploymentEntity.Item())
				if err != nil {
					return nil, err
				}
				if !matched {
					continue
				}
			}

			var matches bool
			if evaluateFromTo {
				matches = relationships.Matches(ctx, &rule.Matcher, sourceEntity, deploymentEntity)
			} else {
				matches = relationships.Matches(ctx, &rule.Matcher, deploymentEntity, sourceEntity)
			}
			if !matches {
				continue
			}

			result = append(result, deploymentEntity)
		}
	case "environment":
		for _, environment := range r.store.Environments.Items() {
			environmentEntity := relationships.NewEnvironmentEntity(environment)
			if entitySelector != nil {
				matched, err := selector.Match(ctx, entitySelector, environmentEntity.Item())
				if err != nil {
					return nil, err
				}
				if !matched {
					continue
				}
			}

			var matches bool
			if evaluateFromTo {
				matches = relationships.Matches(ctx, &rule.Matcher, sourceEntity, environmentEntity)
			} else {
				matches = relationships.Matches(ctx, &rule.Matcher, environmentEntity, sourceEntity)
			}
			if !matches {
				continue
			}

			result = append(result, environmentEntity)
		}
	case "resource":
		for _, resource := range r.store.Resources.Items() {
			resourceEntity := relationships.NewResourceEntity(resource)
			if entitySelector != nil {
				matched, err := selector.Match(ctx, entitySelector, resourceEntity.Item())
				if err != nil {
					return nil, err
				}
				if !matched {
					continue
				}
			}

			// Apply property matchers if any
			var matches bool
			if evaluateFromTo {
				matches = relationships.Matches(ctx, &rule.Matcher, sourceEntity, resourceEntity)
			} else {
				matches = relationships.Matches(ctx, &rule.Matcher, resourceEntity, sourceEntity)
			}
			if !matches {
				continue
			}

			result = append(result, relationships.NewResourceEntity(resource))
		}
	default:
		return nil, fmt.Errorf("unknown entity type: %s", entityType)
	}

	return result, nil
}
