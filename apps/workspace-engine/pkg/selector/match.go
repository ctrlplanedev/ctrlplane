package selector

import (
	"context"
	"fmt"
	"time"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/selector/langs/cel"
	"workspace-engine/pkg/selector/langs/jsonselector"
	"workspace-engine/pkg/selector/langs/jsonselector/unknown"
	"workspace-engine/pkg/selector/langs/util"

	"github.com/dgraph-io/ristretto/v2"
)

var matchCache, _ = ristretto.NewCache(&ristretto.Config[string, bool]{
	NumCounters: 1e7,     // 10M counters for admission policy
	MaxCost:     1 << 26, // 64MB
	BufferItems: 64,
})

type NoMatchableCondition struct {
}

func (n *NoMatchableCondition) Matches(entity any) (bool, error) {
	return false, nil
}

type YesMatchableCondition struct {
}

func (y *YesMatchableCondition) Matches(entity any) (bool, error) {
	return true, nil
}

func Matchable(ctx context.Context, selector *oapi.Selector) (util.MatchableCondition, error) {
	jsonSelector, err := selector.AsJsonSelector()
	if err == nil && len(jsonSelector.Json) != 0 {
		unknownCondition, err := unknown.ParseFromMap(jsonSelector.Json)
		if err != nil {
			return &NoMatchableCondition{}, err
		}

		condition, err := jsonselector.ConvertToSelector(ctx, unknownCondition)
		if err != nil {
			return &NoMatchableCondition{}, err
		}

		return condition, nil
	}

	cselSelector, err := selector.AsCelSelector()
	if err != nil {
		return &NoMatchableCondition{}, fmt.Errorf("selector is not a cel or json selector")
	}

	if cselSelector.Cel == "" {
		return &NoMatchableCondition{}, fmt.Errorf("cel selector is empty")
	}

	condition, err := cel.Compile(cselSelector.Cel)
	if err != nil {
		return &NoMatchableCondition{}, err
	}
	return condition, nil
}

// entityCacheKey generates a cache key component for an entity.
// Includes UpdatedAt timestamp where available to invalidate on changes.
// Returns empty string for entities without valid timestamps (e.g., test fixtures),
// which disables caching for those entities.
func entityCacheKey(item any) string {
	switch e := item.(type) {
	case *oapi.Resource:
		if e.UpdatedAt != nil {
			return e.Id + "@" + e.UpdatedAt.Format(time.RFC3339Nano)
		}
		if e.CreatedAt.IsZero() {
			return "" // Don't cache entities without timestamps
		}
		return e.Id + "@" + e.CreatedAt.Format(time.RFC3339Nano)
	case oapi.Resource:
		if e.UpdatedAt != nil {
			return e.Id + "@" + e.UpdatedAt.Format(time.RFC3339Nano)
		}
		if e.CreatedAt.IsZero() {
			return "" // Don't cache entities without timestamps
		}
		return e.Id + "@" + e.CreatedAt.Format(time.RFC3339Nano)
	case *oapi.Job:
		if e.UpdatedAt.IsZero() {
			return "" // Don't cache entities without timestamps
		}
		return e.Id + "@" + e.UpdatedAt.Format(time.RFC3339Nano)
	case oapi.Job:
		if e.UpdatedAt.IsZero() {
			return "" // Don't cache entities without timestamps
		}
		return e.Id + "@" + e.UpdatedAt.Format(time.RFC3339Nano)
	}
	return ""
}

func Match(ctx context.Context, selector *oapi.Selector, item any) (bool, error) {
	if selector == nil {
		return false, nil
	}

	// Try cache lookup
	selectorHash := selector.Hash()
	entityKey := entityCacheKey(item)
	if selectorHash != "" && entityKey != "" {
		cacheKey := selectorHash + ":" + entityKey
		if result, found := matchCache.Get(cacheKey); found {
			return result, nil
		}
	}

	matchable, err := Matchable(ctx, selector)
	if err != nil {
		return false, err
	}

	result, err := matchable.Matches(item)
	if err != nil {
		return false, err
	}

	// Cache the result
	if selectorHash != "" && entityKey != "" {
		cacheKey := selectorHash + ":" + entityKey
		matchCache.SetWithTTL(cacheKey, result, 1, 5*time.Minute)
	}

	return result, nil
}
