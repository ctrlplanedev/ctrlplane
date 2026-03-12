package selector

import (
	"context"
	"time"

	"github.com/dgraph-io/ristretto/v2"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/selector/langs/cel"
	"workspace-engine/pkg/selector/langs/util"
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

func Matchable(ctx context.Context, selector string) (util.MatchableCondition, error) {
	condition, err := cel.Compile(selector)
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

func Match(ctx context.Context, selector string, item any) (bool, error) {
	if selector == "" || selector == "false" {
		return false, nil
	}

	// Try cache lookup
	selectorHash := oapi.SelectorHash(selector)
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
