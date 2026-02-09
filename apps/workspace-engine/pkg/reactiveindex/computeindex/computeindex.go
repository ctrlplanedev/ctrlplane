package computeindex

import (
	"context"
	"sync"
)

// Compile-time interface check.
var _ Index[any] = (*ComputedIndex[any])(nil)

// ComputedIndex maintains a materialized mapping of entity IDs to computed
// values, with dirty-flag tracking for minimal recomputation.
//
// Usage:
//  1. Create with New(computeFunc)
//  2. Register entities with AddEntity
//  3. Call Recompute to evaluate dirty entities
//  4. Read values with Get / ForEach
//  5. Flag changes with DirtyEntity / DirtyAll
//  6. Call Recompute again to process changes
type ComputedIndex[V any] struct {
	mu   sync.RWMutex
	eval ComputeFunc[V]

	// entities tracks registered entity IDs.
	entities map[string]bool

	// values is the materialized result: entityID -> computed value.
	values map[string]V

	// dirty: entities needing recomputation.
	dirty map[string]bool
}

// New creates a new ComputedIndex with the given compute function.
func New[V any](eval ComputeFunc[V]) *ComputedIndex[V] {
	return &ComputedIndex[V]{
		eval:     eval,
		entities: make(map[string]bool),
		values:   make(map[string]V),
		dirty:    make(map[string]bool),
	}
}

// --- Writer ---

// AddEntity registers an entity. It is marked dirty so it gets computed
// on the next Recompute.
func (idx *ComputedIndex[V]) AddEntity(entityID string) {
	idx.mu.Lock()
	defer idx.mu.Unlock()

	idx.entities[entityID] = true
	idx.dirty[entityID] = true
}

// RemoveEntity removes an entity and its computed value.
func (idx *ComputedIndex[V]) RemoveEntity(entityID string) {
	idx.mu.Lock()
	defer idx.mu.Unlock()

	delete(idx.entities, entityID)
	delete(idx.values, entityID)
	delete(idx.dirty, entityID)
}

// DirtyEntity marks an entity as changed. It will be recomputed on the
// next Recompute.
func (idx *ComputedIndex[V]) DirtyEntity(entityID string) {
	idx.mu.Lock()
	defer idx.mu.Unlock()

	if !idx.entities[entityID] {
		return
	}
	idx.dirty[entityID] = true
}

// DirtyAll marks all entities as dirty, forcing a full recomputation
// on the next Recompute.
func (idx *ComputedIndex[V]) DirtyAll() {
	idx.mu.Lock()
	defer idx.mu.Unlock()

	for entityID := range idx.entities {
		idx.dirty[entityID] = true
	}
}

// --- Reader ---

// Get retrieves the computed value for an entity.
// Returns the value and true if present, or the zero value and false if not.
func (idx *ComputedIndex[V]) Get(entityID string) (V, bool) {
	idx.mu.RLock()
	defer idx.mu.RUnlock()

	val, ok := idx.values[entityID]
	return val, ok
}

// ForEach iterates over all entities and their computed values.
// Return false from fn to stop iteration.
func (idx *ComputedIndex[V]) ForEach(fn func(entityID string, value V) bool) {
	idx.mu.RLock()
	defer idx.mu.RUnlock()

	for entityID, value := range idx.values {
		if !fn(entityID, value) {
			return
		}
	}
}

// --- Stats ---

// EntityCount returns the number of registered entities.
func (idx *ComputedIndex[V]) EntityCount() int {
	idx.mu.RLock()
	defer idx.mu.RUnlock()

	return len(idx.entities)
}

// DirtyCount returns the number of entities pending recomputation.
func (idx *ComputedIndex[V]) DirtyCount() int {
	idx.mu.RLock()
	defer idx.mu.RUnlock()

	return len(idx.dirty)
}

// --- Recomputer ---

// IsDirty returns true if there are entities pending recomputation.
func (idx *ComputedIndex[V]) IsDirty() bool {
	idx.mu.RLock()
	defer idx.mu.RUnlock()

	return len(idx.dirty) > 0
}

// Recompute processes all dirty entities and updates their computed values.
// It snapshots dirty state under the lock, evaluates outside the lock (since
// ComputeFunc may be expensive), then applies results under the lock.
// Returns the number of evaluations performed.
func (idx *ComputedIndex[V]) Recompute(ctx context.Context) int {
	idx.mu.Lock()

	// Snapshot and clear dirty state
	dirty := idx.dirty
	idx.dirty = make(map[string]bool)

	// Filter to only entities that are still registered
	toEval := make([]string, 0, len(dirty))
	for entityID := range dirty {
		if idx.entities[entityID] {
			toEval = append(toEval, entityID)
		}
	}

	idx.mu.Unlock()

	if len(toEval) == 0 {
		return 0
	}

	// Evaluate outside the lock — ComputeFunc may be expensive
	type evalResult struct {
		entityID string
		value    V
		err      error
	}
	results := make([]evalResult, 0, len(toEval))
	for _, entityID := range toEval {
		value, err := idx.eval(ctx, entityID)
		results = append(results, evalResult{entityID, value, err})
	}

	// Apply results under the lock
	idx.mu.Lock()
	defer idx.mu.Unlock()

	for _, r := range results {
		if r.err != nil {
			continue
		}

		// Double-check: entity may have been removed during evaluation
		if !idx.entities[r.entityID] {
			continue
		}

		idx.values[r.entityID] = r.value
	}

	return len(results)
}
