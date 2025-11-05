package relationgraph

import (
	"context"
	"fmt"

	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/selector"
	"workspace-engine/pkg/workspace/relationships"

	"github.com/charmbracelet/log"
	"go.opentelemetry.io/otel/attribute"
)

// ComputationEngine handles the actual computation of relationships
// It uses EntityStore for data and writes results to RelationshipCache
type ComputationEngine struct {
	entityStore *EntityStore
	cache       *RelationshipCache
}

// NewComputationEngine creates a new computation engine
func NewComputationEngine(entityStore *EntityStore, cache *RelationshipCache) *ComputationEngine {
	return &ComputationEngine{
		entityStore: entityStore,
		cache:       cache,
	}
}

// ComputeForEntity computes relationships for a single entity across all rules
func (e *ComputationEngine) ComputeForEntity(ctx context.Context, entityID string) error {
	ctx, span := tracer.Start(ctx, "relationgraph.ComputeForEntity")
	defer span.End()

	span.SetAttributes(
		attribute.String("entity_id", entityID),
	)

	// Check if entity is already computed and no rules are dirty
	alreadyComputed := e.cache.IsComputed(entityID)
	hasDirtyRules := e.cache.HasDirtyRules()

	if alreadyComputed && !hasDirtyRules {
		log.Info("Entity already computed with no dirty rules", "entity_id", entityID)
		return nil
	}

	// Get all entities once for matching
	allEntities := e.entityStore.GetAllEntities()

	// Find the entity we're computing for
	var targetEntity *oapi.RelatableEntity
	for _, entity := range allEntities {
		if entity.GetID() == entityID {
			targetEntity = entity
			break
		}
	}

	if targetEntity == nil {
		log.Warn("Entity not found", "entity_id", entityID)
		return fmt.Errorf("entity not found: %s", entityID)
	}

	entityType := targetEntity.GetType()
	log.Info("Computing relationships for entity", "entity_id", entityID, "type", entityType)

	// Process each rule that involves this entity type
	rules := e.entityStore.GetRules()
	for _, rule := range rules {
		// Skip rules that don't involve this entity type
		if rule.FromType != entityType && rule.ToType != entityType {
			continue
		}

		// Skip if already computed for this rule and rule is not dirty
		alreadyComputedForRule := e.cache.IsRuleComputedForEntity(entityID, rule.Reference)
		ruleDirty := e.cache.IsRuleDirty(rule.Reference)

		if alreadyComputedForRule && !ruleDirty {
			continue
		}

		log.Info("Processing rule for entity", "entity_id", entityID, "rule", rule.Reference)

		if err := e.processRuleForEntity(ctx, rule, targetEntity, allEntities); err != nil {
			log.Error("Failed to process rule for entity", "entity_id", entityID, "rule", rule.Reference, "error", err)
			return err
		}

		// Mark rule as computed for this entity
		e.cache.MarkRuleComputedForEntity(entityID, rule.Reference)
	}

	// Mark entity as computed
	e.cache.MarkEntityComputed(entityID)

	log.Info("Completed computing relationships for entity", "entity_id", entityID)
	return nil
}

// processRuleForEntity evaluates a single rule for a specific entity
func (e *ComputationEngine) processRuleForEntity(
	ctx context.Context,
	rule *oapi.RelationshipRule,
	targetEntity *oapi.RelatableEntity,
	allEntities []*oapi.RelatableEntity,
) error {
	ctx, span := tracer.Start(ctx, "relationgraph.processRuleForEntity")
	defer span.End()

	span.SetAttributes(
		attribute.String("rule.reference", rule.Reference),
		attribute.String("entity.id", targetEntity.GetID()),
		attribute.String("entity.type", string(targetEntity.GetType())),
	)

	entityID := targetEntity.GetID()

	// Build entity map cache if using CEL matcher
	var entityMapCache relationships.EntityMapCache
	if cm, err := rule.Matcher.AsCelMatcher(); err == nil && cm.Cel != "" {
		entityMapCache = relationships.BuildEntityMapCache(allEntities)
	}

	// Check if entity matches the "from" selector
	fromMatches, _ := e.matchesSelector(ctx, rule.FromType, rule.FromSelector, targetEntity)

	if fromMatches {
		// Entity is on the "from" side, find matching "to" entities
		toEntities := e.filterEntities(ctx, allEntities, rule.ToType, rule.ToSelector)

		for _, toEntity := range toEntities {
			// Skip self-relationships
			if toEntity.GetID() == entityID {
				continue
			}

			if relationships.MatchesWithCache(ctx, &rule.Matcher, targetEntity, toEntity, entityMapCache) {
				// Add forward relationship: target -> to
				e.cache.Add(entityID, rule.Reference, &oapi.EntityRelation{
					Rule:       rule,
					Direction:  oapi.To,
					EntityType: toEntity.GetType(),
					EntityId:   toEntity.GetID(),
					Entity:     *toEntity,
				})
			}
		}
	}

	// Check if entity matches the "to" selector
	toMatches, _ := e.matchesSelector(ctx, rule.ToType, rule.ToSelector, targetEntity)

	if toMatches {
		// Entity is on the "to" side, find matching "from" entities
		fromEntities := e.filterEntities(ctx, allEntities, rule.FromType, rule.FromSelector)

		for _, fromEntity := range fromEntities {
			// Skip self-relationships
			if fromEntity.GetID() == entityID {
				continue
			}

			if relationships.MatchesWithCache(ctx, &rule.Matcher, fromEntity, targetEntity, entityMapCache) {
				// Add reverse relationship: target <- from
				e.cache.Add(entityID, rule.Reference, &oapi.EntityRelation{
					Rule:       rule,
					Direction:  oapi.From,
					EntityType: fromEntity.GetType(),
					EntityId:   fromEntity.GetID(),
					Entity:     *fromEntity,
				})
			}
		}
	}

	return nil
}

// filterEntities filters entities by type and selector
func (e *ComputationEngine) filterEntities(
	ctx context.Context,
	entities []*oapi.RelatableEntity,
	entityType oapi.RelatableEntityType,
	entitySelector *oapi.Selector,
) []*oapi.RelatableEntity {
	filtered := make([]*oapi.RelatableEntity, 0)

	for _, entity := range entities {
		if entity.GetType() != entityType {
			continue
		}

		// If no selector, match all entities of this type
		if entitySelector == nil {
			filtered = append(filtered, entity)
			continue
		}

		// Check selector match
		matched, _ := selector.Match(ctx, entitySelector, entity.Item())
		if matched {
			filtered = append(filtered, entity)
		}
	}

	return filtered
}

// matchesSelector checks if an entity matches the given type and selector
func (e *ComputationEngine) matchesSelector(
	ctx context.Context,
	targetType oapi.RelatableEntityType,
	targetSelector *oapi.Selector,
	entity *oapi.RelatableEntity,
) (bool, error) {
	if targetType != entity.GetType() {
		return false, nil
	}
	if targetSelector == nil {
		return true, nil
	}
	return selector.Match(ctx, targetSelector, entity.Item())
}
