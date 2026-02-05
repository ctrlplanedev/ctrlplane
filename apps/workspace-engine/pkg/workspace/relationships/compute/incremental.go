package compute

import (
	"context"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/selector"
	"workspace-engine/pkg/workspace/relationships"
)

func FindRemovedRelations(
	ctx context.Context,
	oldRelations []*relationships.EntityRelation,
	newRelations []*relationships.EntityRelation,
) []*relationships.EntityRelation {
	removedRelations := make([]*relationships.EntityRelation, 0, len(oldRelations))
	if len(oldRelations) == 0 {
		return removedRelations
	}

	if len(newRelations) == 0 {
		return append(removedRelations, oldRelations...)
	}

	newRelationKeys := make(map[string]struct{}, len(newRelations))
	for _, newRelation := range newRelations {
		newRelationKeys[newRelation.Key()] = struct{}{}
	}

	for _, oldRelation := range oldRelations {
		if _, found := newRelationKeys[oldRelation.Key()]; !found {
			removedRelations = append(removedRelations, oldRelation)
		}
	}

	return removedRelations
}

func FindRelationsForEntity(
	ctx context.Context,
	rules []*oapi.RelationshipRule,
	changedEntities *oapi.RelatableEntity,
	allEntities []*oapi.RelatableEntity,
) []*relationships.EntityRelation {
	relations := make([]*relationships.EntityRelation, 0)
	for _, rule := range rules {
		relations = append(relations, FindRelationsForEntityAndRule(ctx, rule, changedEntities, allEntities)...)
	}
	return relations
}

// FindRelationshipsForEntity efficiently computes relationships for a single changed entity.
// This is much faster than recomputing all relationships when only one entity changed.
//
// Performance:
//   - Full recomputation: O(n × m) - e.g., 10k × 10k = 100M comparisons
//   - Incremental update: O(m) or O(n) - e.g., 1 × 10k = 10k comparisons
//   - Speed-up: ~1000x faster for single entity updates!
//
// Use cases:
//   - Entity created/updated/deleted
//   - Real-time relationship updates
//   - Event-driven relationship computation
func FindRelationsForEntityAndRule(
	ctx context.Context,
	rule *oapi.RelationshipRule,
	changedEntity *oapi.RelatableEntity,
	allEntities []*oapi.RelatableEntity,
) []*relationships.EntityRelation {
	ctx, span := tracer.Start(ctx, "FindRelationshipsForEntity")
	defer span.End()

	// Determine if the changed entity is a "from" or "to" entity (or both)
	changedType := changedEntity.GetType()
	isFromEntity := changedType == rule.FromType
	isToEntity := changedType == rule.ToType

	if !isFromEntity && !isToEntity {
		// Entity type doesn't participate in this rule
		return nil
	}

	// Check if changed entity matches its selector
	var matchesFromSelector, matchesToSelector bool
	if isFromEntity {
		if rule.FromSelector == nil {
			matchesFromSelector = true
		} else {
			matched, _ := selector.Match(ctx, rule.FromSelector, changedEntity.Item())
			matchesFromSelector = matched
		}
	}
	if isToEntity {
		if rule.ToSelector == nil {
			matchesToSelector = true
		} else {
			matched, _ := selector.Match(ctx, rule.ToSelector, changedEntity.Item())
			matchesToSelector = matched
		}
	}

	// If entity doesn't match its selector, no relationships
	if (isFromEntity && !matchesFromSelector) && (isToEntity && !matchesToSelector) {
		return nil
	}

	// Build entity cache for CEL matchers
	var entityMapCache relationships.EntityMapCache
	if cm, err := rule.Matcher.AsCelMatcher(); err == nil && cm.Cel != "" {
		entityMapCache = make(relationships.EntityMapCache)
		if entityMap, err := relationships.EntityToMap(changedEntity.Item()); err == nil {
			entityMapCache[changedEntity.GetID()] = entityMap
		}
	}

	var allRelations []*relationships.EntityRelation

	// Case 1: Changed entity is a "from" entity - match against all "to" entities
	if isFromEntity && matchesFromSelector {
		toEntities := filterEntitiesByTypeAndSelector(ctx, allEntities, rule.ToType, rule.ToSelector)

		// Add to entities to cache
		if entityMapCache != nil {
			for _, toEntity := range toEntities {
				if _, exists := entityMapCache[toEntity.GetID()]; !exists {
					if entityMap, err := relationships.EntityToMap(toEntity.Item()); err == nil {
						entityMapCache[toEntity.GetID()] = entityMap
					}
				}
			}
		}

		relations := matchFromEntityToAll(ctx, rule, changedEntity, toEntities, entityMapCache)
		allRelations = append(allRelations, relations...)
	}

	// Case 2: Changed entity is a "to" entity - match all "from" entities against it
	if isToEntity && matchesToSelector {
		fromEntities := filterEntitiesByTypeAndSelector(ctx, allEntities, rule.FromType, rule.FromSelector)

		// Add from entities to cache
		if entityMapCache != nil {
			for _, fromEntity := range fromEntities {
				if _, exists := entityMapCache[fromEntity.GetID()]; !exists {
					if entityMap, err := relationships.EntityToMap(fromEntity.Item()); err == nil {
						entityMapCache[fromEntity.GetID()] = entityMap
					}
				}
			}
		}

		relations := matchToEntityFromAll(ctx, rule, changedEntity, fromEntities, entityMapCache)
		allRelations = append(allRelations, relations...)
	}

	return allRelations
}

// matchToEntityFromAll matches all fromEntities against a single toEntity
func matchToEntityFromAll(
	ctx context.Context,
	rule *oapi.RelationshipRule,
	toEntity *oapi.RelatableEntity,
	fromEntities []*oapi.RelatableEntity,
	entityMapCache relationships.EntityMapCache,
) []*relationships.EntityRelation {
	toID := toEntity.GetID()
	matches := make([]*relationships.EntityRelation, 0, len(fromEntities)/10)

	for _, fromEntity := range fromEntities {
		// Skip self-relationships
		if fromEntity.GetID() == toID {
			continue
		}

		// Check if the matcher matches this pair
		if relationships.MatchesWithCache(ctx, &rule.Matcher, fromEntity, toEntity, entityMapCache) {
			matches = append(matches, &relationships.EntityRelation{
				Rule: rule,
				From: fromEntity,
				To:   toEntity,
			})
		}
	}

	return matches
}

// filterEntitiesByTypeAndSelector filters entities of a specific type matching a selector
func filterEntitiesByTypeAndSelector(
	ctx context.Context,
	entities []*oapi.RelatableEntity,
	entityType oapi.RelatableEntityType,
	entitySelector *oapi.Selector,
) []*oapi.RelatableEntity {
	filtered := make([]*oapi.RelatableEntity, 0, 100)

	for _, entity := range entities {
		if entity.GetType() != entityType {
			continue
		}

		if entitySelector == nil {
			filtered = append(filtered, entity)
			continue
		}

		matched, _ := selector.Match(ctx, entitySelector, entity.Item())
		if matched {
			filtered = append(filtered, entity)
		}
	}

	return filtered
}
