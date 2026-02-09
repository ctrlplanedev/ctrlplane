package matchindex

import "context"

// MatchFunc evaluates whether a selector matches an entity.
// Both arguments are opaque IDs — the implementation resolves them
// to actual expressions/entities as needed.
type MatchFunc func(ctx context.Context, selectorID, entityID string) (bool, error)

// Reader provides read-only access to the materialized match results.
type Reader interface {
	// GetMatches returns entity IDs that match a selector.
	GetMatches(selectorID string) []string
	// GetMatchingSelectors returns selector IDs that match an entity.
	GetMatchingSelectors(entityID string) []string
	// HasMatch checks a specific (selector, entity) pair.
	HasMatch(selectorID, entityID string) bool
}

// Writer mutates selector/entity registration and dirty state.
type Writer interface {
	AddSelector(selectorID string)
	RemoveSelector(selectorID string)
	UpdateSelector(selectorID string)

	AddEntity(entityID string)
	RemoveEntity(entityID string)
	DirtyEntity(entityID string)

	DirtyPair(selectorID, entityID string)
	DirtyAll()
}

// Recomputer processes dirty state and updates materialized results.
type Recomputer interface {
	IsDirty() bool
	Recompute(ctx context.Context) int
}

// Scanner provides allocation-free iteration for hot paths.
type Scanner interface {
	// ForEachMatch iterates entity IDs matching a selector without allocating a slice.
	// Return false from fn to stop iteration.
	ForEachMatch(selectorID string, fn func(entityID string) bool)
	// ForEachMatchingSelector iterates selector IDs matching an entity without allocating a slice.
	// Return false from fn to stop iteration.
	ForEachMatchingSelector(entityID string, fn func(selectorID string) bool)
	// CountMatches returns the number of entities matching a selector.
	CountMatches(selectorID string) int
}

// Stats exposes index cardinality for metrics and tracing.
type Stats interface {
	SelectorCount() int
	EntityCount() int
	MatchCount() int
	DirtyCount() int
}

// Index is the full interface combining all capabilities.
type Index interface {
	Reader
	Writer
	Recomputer
	Scanner
	Stats
}
