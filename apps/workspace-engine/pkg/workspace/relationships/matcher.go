package relationships

import (
	"context"
	"encoding/json"
	"fmt"
	"workspace-engine/pkg/oapi"

	"github.com/charmbracelet/log"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/codes"
)

var tracer = otel.Tracer("workspace-engine/pkg/workspace/relationships/matcher")

// EntityMapCache stores pre-computed map representations of entities for CEL evaluation
// Key is entity ID, value is the map representation
type EntityMapCache map[string]map[string]any

func Matches(ctx context.Context, matcher *oapi.RelationshipRule_Matcher, from *oapi.RelatableEntity, to *oapi.RelatableEntity) bool {
	ctx, span := tracer.Start(ctx, "Relationships.Matches")
	defer span.End()

	pm, err := matcher.AsPropertiesMatcher()

	if err != nil {
		log.Warn("failed to get properties matcher", "error", err)
		span.SetStatus(codes.Error, "failed to get properties matcher")
		return false
	}

	if len(pm.Properties) > 0 {
		for _, pm := range pm.Properties {
			matcher := NewPropertyMatcher(&pm)
			if !matcher.Evaluate(ctx, from, to) {
				return false
			}
		}
		return true
	}

	cm, err := matcher.AsCelMatcher()
	if err != nil {
		log.Warn("failed to get cel matcher", "error", err)
	}

	if err == nil && cm.Cel != "" {
		matcher, err := NewCelMatcher(&cm)
		if err != nil {
			log.Warn("failed to new cel matcher", "error", err)
			return false
		}

		// Always convert entities to maps without any cache
		fromMap, _ := entityToMap(from.Item())
		toMap, _ := entityToMap(to.Item())

		return matcher.Evaluate(ctx, fromMap, toMap)
	}

	// No matcher specified - match by selectors only
	return true
}

// MatchesWithCache evaluates a matcher with optional cached entity maps for performance
// If cache is provided and contains the entities, it will use cached maps instead of converting
func MatchesWithCache(ctx context.Context, matcher *oapi.RelationshipRule_Matcher, from *oapi.RelatableEntity, to *oapi.RelatableEntity, cache EntityMapCache) bool {
	ctx, span := tracer.Start(ctx, "Relationships.MatchesWithCache")
	defer span.End()

	pm, err := matcher.AsPropertiesMatcher()

	if err != nil {
		log.Warn("failed to get properties matcher", "error", err)
	}

	if err == nil && len(pm.Properties) > 0 {
		for _, pm := range pm.Properties {
			matcher := NewPropertyMatcher(&pm)
			if !matcher.Evaluate(ctx, from, to) {
				return false
			}
		}
		return true
	}

	cm, err := matcher.AsCelMatcher()
	if err != nil {
		log.Warn("failed to get cel matcher", "error", err)
	}

	if err == nil && cm.Cel != "" {
		matcher, err := NewCelMatcher(&cm)
		if err != nil {
			log.Warn("failed to new cel matcher", "error", err)
			return false
		}

		// Use cached maps if available, otherwise convert on-demand
		var fromMap, toMap map[string]any
		if cache != nil {
			var ok bool
			fromMap, ok = cache[from.GetID()]
			if !ok {
				fromMap, _ = entityToMap(from.Item())
			}
			toMap, ok = cache[to.GetID()]
			if !ok {
				toMap, _ = entityToMap(to.Item())
			}
		} else {
			fromMap, _ = entityToMap(from.Item())
			toMap, _ = entityToMap(to.Item())
		}

		return matcher.Evaluate(ctx, fromMap, toMap)
	}

	// No matcher specified - match by selectors only
	return true
}

// BuildEntityMapCache pre-computes map representations for all entities
// This is expensive but only needs to be done once per rule evaluation
func BuildEntityMapCache(entities []*oapi.RelatableEntity) EntityMapCache {
	cache := make(EntityMapCache, len(entities))
	for _, entity := range entities {
		if entityMap, err := entityToMap(entity.Item()); err == nil {
			cache[entity.GetID()] = entityMap
		}
	}
	return cache
}

// EntityToMap converts an entity (Resource, Deployment, or Environment) to a map for CEL evaluation
// This is exported for use in incremental relationship computation
func EntityToMap(entity any) (map[string]any, error) {
	return entityToMap(entity)
}

// entityToMap converts an entity (Resource, Deployment, or Environment) to a map for CEL evaluation
func entityToMap(entity any) (map[string]any, error) {
	// Marshal to JSON and back to map to ensure CEL-compatible structure
	jsonBytes, err := json.Marshal(entity)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal entity: %w", err)
	}

	var result map[string]any
	if err := json.Unmarshal(jsonBytes, &result); err != nil {
		return nil, fmt.Errorf("failed to unmarshal entity: %w", err)
	}

	return result, nil
}
