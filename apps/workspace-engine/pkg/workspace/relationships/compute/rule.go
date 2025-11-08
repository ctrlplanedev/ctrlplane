package compute

import (
	"context"
	"workspace-engine/pkg/concurrency"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/selector"
	"workspace-engine/pkg/workspace/relationships"

	"github.com/charmbracelet/log"
	"go.opentelemetry.io/otel"
)

var tracer = otel.Tracer("workspace-engine/pkg/workspace/relationships/compute")

// FindRuleRelationships returns all entity relationships across all rules in the store.
// It returns a slice of EntityRelation, where each relation shows the From and To entities.
// Uses parallel processing for large datasets.
func FindRuleRelationships(ctx context.Context, rule *oapi.RelationshipRule, entities []*oapi.RelatableEntity) ([]*relationships.EntityRelation, error) {
	ctx, span := tracer.Start(ctx, "FindRuleRelationships")
	defer span.End()

	// Filter entities that match the "from" selector
	fromEntities, toEntities := filterEntities(ctx, entities, rule.FromType, rule.FromSelector, rule.ToType, rule.ToSelector)

	if len(fromEntities) == 0 || len(toEntities) == 0 {
		return nil, nil
	}

	entityMapCache := relationships.BuildEntityMapCache(entities)

	// For small datasets, use serial processing
	totalPairs := len(fromEntities) * len(toEntities)
	if totalPairs < 10000 {
		return bruteForceMatch(ctx, rule, fromEntities, toEntities, entityMapCache)
	}

	log.Warn("Using parallel processing for large datasets", "totalPairs", totalPairs)

	results, err := concurrency.ProcessInChunks(
		ctx,
		fromEntities,
		func(ctx context.Context, fromEntity *oapi.RelatableEntity) ([]*relationships.EntityRelation, error) {
			return matchFromEntityToAll(ctx, rule, fromEntity, toEntities, entityMapCache), nil
		},
		concurrency.WithChunkSize(50),
	)

	if err != nil {
		return nil, err
	}

	// Flatten the results (ProcessInChunks returns [][]*EntityRelation)
	totalMatches := 0
	for _, chunk := range results {
		totalMatches += len(chunk)
	}

	allRelations := make([]*relationships.EntityRelation, 0, totalMatches)
	for _, chunk := range results {
		allRelations = append(allRelations, chunk...)
	}

	return allRelations, nil
}

// matchFromEntityToAll matches a single fromEntity against all toEntities.
// This function runs in parallel for different fromEntities.
func matchFromEntityToAll(
	ctx context.Context,
	rule *oapi.RelationshipRule,
	fromEntity *oapi.RelatableEntity,
	toEntities []*oapi.RelatableEntity,
	entityMapCache relationships.EntityMapCache,
) []*relationships.EntityRelation {
	fromID := fromEntity.GetID()
	matches := make([]*relationships.EntityRelation, 0, len(toEntities)/10) // Estimate 10% match rate

	for _, toEntity := range toEntities {
		// Skip self-relationships
		if fromID == toEntity.GetID() {
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

// filterEntities filters entities by type and selector for both from and to in a single loop
func filterEntities(
	ctx context.Context,
	entities []*oapi.RelatableEntity,
	fromType oapi.RelatableEntityType,
	fromSelector *oapi.Selector,
	toType oapi.RelatableEntityType,
	toSelector *oapi.Selector,
) (fromEntities, toEntities []*oapi.RelatableEntity) {
	ctx, span := tracer.Start(ctx, "filterEntities")
	defer span.End()

	fromEntities = make([]*oapi.RelatableEntity, 0, 1000)
	toEntities = make([]*oapi.RelatableEntity, 0, 1000)

	for _, entity := range entities {
		entityType := entity.GetType()

		// Check if entity matches "from" criteria
		if entityType == fromType {
			addToFrom := fromSelector == nil
			if !addToFrom {
				matched, _ := selector.Match(ctx, fromSelector, entity.Item())
				addToFrom = matched
			}
			if addToFrom {
				fromEntities = append(fromEntities, entity)
			}
		}

		// Check if entity matches "to" criteria
		if entityType == toType {
			addToTo := toSelector == nil
			if !addToTo {
				matched, _ := selector.Match(ctx, toSelector, entity.Item())
				addToTo = matched
			}
			if addToTo {
				toEntities = append(toEntities, entity)
			}
		}
	}

	return fromEntities, toEntities
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func bruteForceMatch(
	ctx context.Context,
	rule *oapi.RelationshipRule,
	fromEntities []*oapi.RelatableEntity,
	toEntities []*oapi.RelatableEntity,
	entityMapCache relationships.EntityMapCache,
) ([]*relationships.EntityRelation, error) {
	estimatedMatches := min(len(fromEntities)*len(toEntities)/100, 10000)
	allRelations := make([]*relationships.EntityRelation, 0, estimatedMatches)

	// Check all combinations of from and to entities
	for _, fromEntity := range fromEntities {
		fromId := fromEntity.GetID()
		for _, toEntity := range toEntities {
			toId := toEntity.GetID()
			// Skip self-relationships
			if fromId == toId {
				continue
			}

			// Check if the matcher matches this pair
			if relationships.MatchesWithCache(ctx, &rule.Matcher, fromEntity, toEntity, entityMapCache) {
				entityRelation := &relationships.EntityRelation{
					Rule: rule,
					From: fromEntity,
					To:   toEntity,
				}
				allRelations = append(allRelations, entityRelation)
			}
		}
	}

	return allRelations, nil
}
