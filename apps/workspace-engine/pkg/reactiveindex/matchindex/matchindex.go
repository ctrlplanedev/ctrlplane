package matchindex

import (
	"context"
	"sync"

	"workspace-engine/pkg/concurrency"
)

// Compile-time interface checks.
var _ Index = (*MatchIndex)(nil)

// MatchIndex maintains a materialized many-to-many mapping of selectors to
// matching entities, with dirty-flag tracking for minimal recomputation.
//
// Usage:
//  1. Create with New(matchFunc)
//  2. Register selectors and entities
//  3. Call Recompute to evaluate dirty pairs
//  4. Read membership with GetMatches / GetMatchingSelectors / HasMatch
//  5. Flag changes with DirtyEntity / UpdateSelector / DirtyPair
//  6. Call Recompute again to process changes
type MatchIndex struct {
	mu   sync.RWMutex
	eval MatchFunc

	// selectors tracks registered selector IDs.
	selectors map[string]bool

	// entities tracks all known entity IDs.
	entities map[string]bool

	// membership is the materialized result: selectorID -> set of matching entityIDs.
	membership map[string]map[string]bool

	// dirtyEntities: entities needing re-evaluation against all selectors.
	dirtyEntities map[string]bool

	// dirtySelectors: selectors needing re-evaluation against all entities.
	dirtySelectors map[string]bool

	// dirtyPairs: specific (selectorID, entityID) pairs to re-evaluate.
	dirtyPairs map[[2]string]bool
}

// New creates a new MatchIndex with the given match function.
func New(eval MatchFunc) *MatchIndex {
	return &MatchIndex{
		eval:           eval,
		selectors:      make(map[string]bool),
		entities:       make(map[string]bool),
		membership:     make(map[string]map[string]bool),
		dirtyEntities:  make(map[string]bool),
		dirtySelectors: make(map[string]bool),
		dirtyPairs:     make(map[[2]string]bool),
	}
}

// --- Writer: Selector registration ---

// AddSelector registers a selector to be tracked.
// It is marked dirty so it gets evaluated against all entities on the next Recompute.
func (idx *MatchIndex) AddSelector(selectorID string) {
	idx.mu.Lock()
	defer idx.mu.Unlock()

	idx.selectors[selectorID] = true
	if idx.membership[selectorID] == nil {
		idx.membership[selectorID] = make(map[string]bool)
	}
	idx.dirtySelectors[selectorID] = true
}

// RemoveSelector stops tracking a selector and drops its membership.
func (idx *MatchIndex) RemoveSelector(selectorID string) {
	idx.mu.Lock()
	defer idx.mu.Unlock()

	delete(idx.selectors, selectorID)
	delete(idx.membership, selectorID)
	delete(idx.dirtySelectors, selectorID)
}

// UpdateSelector marks a selector as changed (e.g., its CEL expression was edited).
// All its memberships become stale and will be re-evaluated on the next Recompute.
func (idx *MatchIndex) UpdateSelector(selectorID string) {
	idx.mu.Lock()
	defer idx.mu.Unlock()

	if !idx.selectors[selectorID] {
		return
	}
	idx.dirtySelectors[selectorID] = true
}

// --- Writer: Entity registration ---

// AddEntity registers an entity. It is marked dirty so it gets evaluated
// against all selectors on the next Recompute.
func (idx *MatchIndex) AddEntity(entityID string) {
	idx.mu.Lock()
	defer idx.mu.Unlock()

	idx.entities[entityID] = true
	idx.dirtyEntities[entityID] = true
}

// RemoveEntity removes an entity from all memberships and stops tracking it.
func (idx *MatchIndex) RemoveEntity(entityID string) {
	idx.mu.Lock()
	defer idx.mu.Unlock()

	delete(idx.entities, entityID)
	delete(idx.dirtyEntities, entityID)
	for _, members := range idx.membership {
		delete(members, entityID)
	}
}

// --- Writer: Flagging dirty ---

// DirtyEntity marks an entity as changed. It will be re-evaluated against all
// selectors on the next Recompute.
func (idx *MatchIndex) DirtyEntity(entityID string) {
	idx.mu.Lock()
	defer idx.mu.Unlock()

	if !idx.entities[entityID] {
		return
	}
	idx.dirtyEntities[entityID] = true
}

// DirtyPair marks a single (selector, entity) pair for re-evaluation.
// Use this when you know only one specific combination is affected.
func (idx *MatchIndex) DirtyPair(selectorID string, entityID string) {
	idx.mu.Lock()
	defer idx.mu.Unlock()

	if !idx.selectors[selectorID] || !idx.entities[entityID] {
		return
	}
	idx.dirtyPairs[[2]string{selectorID, entityID}] = true
}

// DirtyAll marks all entities as dirty, forcing a full re-evaluation on the
// next Recompute. Use this as a periodic safety net.
func (idx *MatchIndex) DirtyAll() {
	idx.mu.Lock()
	defer idx.mu.Unlock()

	for entityID := range idx.entities {
		idx.dirtyEntities[entityID] = true
	}
}

// --- Reader ---

// GetMatches returns the entity IDs that match a selector.
// Returns the materialized membership — no computation happens here.
func (idx *MatchIndex) GetMatches(selectorID string) []string {
	idx.mu.RLock()
	defer idx.mu.RUnlock()

	members := idx.membership[selectorID]
	result := make([]string, 0, len(members))
	for entityID := range members {
		result = append(result, entityID)
	}
	return result
}

// GetMatchingSelectors returns the selector IDs that match a given entity.
// This is the reverse lookup.
func (idx *MatchIndex) GetMatchingSelectors(entityID string) []string {
	idx.mu.RLock()
	defer idx.mu.RUnlock()

	result := make([]string, 0)
	for selectorID, members := range idx.membership {
		if members[entityID] {
			result = append(result, selectorID)
		}
	}
	return result
}

// HasMatch checks whether a specific (selector, entity) pair is in the
// materialized membership.
func (idx *MatchIndex) HasMatch(selectorID string, entityID string) bool {
	idx.mu.RLock()
	defer idx.mu.RUnlock()

	members := idx.membership[selectorID]
	if members == nil {
		return false
	}
	return members[entityID]
}

// --- Scanner ---

// ForEachMatch iterates entity IDs matching a selector without allocating a slice.
// Return false from fn to stop iteration.
func (idx *MatchIndex) ForEachMatch(selectorID string, fn func(entityID string) bool) {
	idx.mu.RLock()
	defer idx.mu.RUnlock()

	for entityID := range idx.membership[selectorID] {
		if !fn(entityID) {
			return
		}
	}
}

// ForEachMatchingSelector iterates selector IDs matching an entity without allocating a slice.
// Return false from fn to stop iteration.
func (idx *MatchIndex) ForEachMatchingSelector(entityID string, fn func(selectorID string) bool) {
	idx.mu.RLock()
	defer idx.mu.RUnlock()

	for selectorID, members := range idx.membership {
		if members[entityID] {
			if !fn(selectorID) {
				return
			}
		}
	}
}

// CountMatches returns the number of entities matching a selector.
func (idx *MatchIndex) CountMatches(selectorID string) int {
	idx.mu.RLock()
	defer idx.mu.RUnlock()

	return len(idx.membership[selectorID])
}

// --- Stats ---

// SelectorCount returns the number of registered selectors.
func (idx *MatchIndex) SelectorCount() int {
	idx.mu.RLock()
	defer idx.mu.RUnlock()

	return len(idx.selectors)
}

// EntityCount returns the number of registered entities.
func (idx *MatchIndex) EntityCount() int {
	idx.mu.RLock()
	defer idx.mu.RUnlock()

	return len(idx.entities)
}

// MatchCount returns the total number of (selector, entity) matches.
func (idx *MatchIndex) MatchCount() int {
	idx.mu.RLock()
	defer idx.mu.RUnlock()

	count := 0
	for _, members := range idx.membership {
		count += len(members)
	}
	return count
}

// DirtyCount returns the number of pending pairs to evaluate on next Recompute.
func (idx *MatchIndex) DirtyCount() int {
	idx.mu.RLock()
	defer idx.mu.RUnlock()

	// Each dirty entity evaluates against all selectors, each dirty selector
	// evaluates against all entities, plus explicit dirty pairs.
	count := len(idx.dirtyEntities)*len(idx.selectors) +
		len(idx.dirtySelectors)*len(idx.entities) +
		len(idx.dirtyPairs)
	return count
}

// --- Recomputer ---

// IsDirty returns true if there is pending work to process.
func (idx *MatchIndex) IsDirty() bool {
	idx.mu.RLock()
	defer idx.mu.RUnlock()

	return len(idx.dirtyEntities) > 0 || len(idx.dirtySelectors) > 0 || len(idx.dirtyPairs) > 0
}

// pair is an internal type for tracking (selector, entity) evaluation work.
type pair struct {
	selector string
	entity   string
}

// parallelThreshold is the minimum number of pairs before we fan out to
// a worker pool. Below this, the goroutine scheduling + span overhead
// exceeds the benefit.
const parallelThreshold = 256

// evalResult is the outcome of a single (selector, entity) evaluation.
type evalResult struct {
	p       pair
	matches bool
	err     error
}

// Recompute processes all dirty flags and updates the membership.
// It snapshots dirty state under the lock, evaluates outside the lock (since
// MatchFunc may be expensive), then applies results under the lock.
// Returns the number of evaluations performed.
//
// Pair deduplication uses algebraic set subtraction instead of materializing a
// map of all pairs. The three dirty sources are processed in order:
//
//  1. dirtySelectors × allEntities       (unconditional)
//  2. allSelectors   × dirtyEntities     (skip selector ∈ dirtySelectors)
//  3. dirtyPairs                         (skip selector ∈ dirtySelectors OR entity ∈ dirtyEntities)
//
// Each pair is produced by exactly one step, so no intermediate set is needed.
// When the pair count exceeds parallelThreshold, evaluation is distributed
// across a worker pool via ProcessInChunks.
func (idx *MatchIndex) Recompute(ctx context.Context) int {
	idx.mu.Lock()

	// Snapshot and clear dirty state
	dirtyEntities := idx.dirtyEntities
	dirtySelectors := idx.dirtySelectors
	dirtyPairs := idx.dirtyPairs
	idx.dirtyEntities = make(map[string]bool)
	idx.dirtySelectors = make(map[string]bool)
	idx.dirtyPairs = make(map[[2]string]bool)

	if len(dirtyEntities) == 0 && len(dirtySelectors) == 0 && len(dirtyPairs) == 0 {
		idx.mu.Unlock()
		return 0
	}

	// Snapshot registered selectors/entities for stable iteration and O(1)
	// membership checks outside the lock.
	selectorSnap := make(map[string]bool, len(idx.selectors))
	for s := range idx.selectors {
		selectorSnap[s] = true
	}
	entitySnap := make(map[string]bool, len(idx.entities))
	for e := range idx.entities {
		entitySnap[e] = true
	}

	// Pre-compute the exact pair count so the pairs slice is allocated once.
	validDirtySelectorCount := 0
	for s := range dirtySelectors {
		if selectorSnap[s] {
			validDirtySelectorCount++
		}
	}
	validDirtyEntityCount := 0
	for e := range dirtyEntities {
		if entitySnap[e] {
			validDirtyEntityCount++
		}
	}
	dirtyPairCount := 0
	for p := range dirtyPairs {
		s, e := p[0], p[1]
		if !dirtySelectors[s] && !dirtyEntities[e] && selectorSnap[s] && entitySnap[e] {
			dirtyPairCount++
		}
	}
	totalPairs := validDirtySelectorCount*len(entitySnap) +
		validDirtyEntityCount*(len(selectorSnap)-validDirtySelectorCount) +
		dirtyPairCount

	if totalPairs == 0 {
		idx.mu.Unlock()
		return 0
	}

	idx.mu.Unlock()

	// Generate all pairs using algebraic dedup.
	pairs := make([]pair, 0, totalPairs)

	// Step 1: dirty selectors × all entities
	for s := range dirtySelectors {
		if !selectorSnap[s] {
			continue
		}
		for e := range entitySnap {
			pairs = append(pairs, pair{s, e})
		}
	}

	// Step 2: all selectors × dirty entities, skipping selectors covered by step 1
	for e := range dirtyEntities {
		if !entitySnap[e] {
			continue
		}
		for s := range selectorSnap {
			if dirtySelectors[s] {
				continue
			}
			pairs = append(pairs, pair{s, e})
		}
	}

	// Step 3: explicit dirty pairs, skipping any covered by steps 1 or 2
	for p := range dirtyPairs {
		s, e := p[0], p[1]
		if dirtySelectors[s] || dirtyEntities[e] {
			continue
		}
		if !selectorSnap[s] || !entitySnap[e] {
			continue
		}
		pairs = append(pairs, pair{s, e})
	}

	if len(pairs) == 0 {
		return 0
	}

	// Evaluate — sequential for small workloads, parallel for large.
	var results []evalResult
	if len(pairs) <= parallelThreshold {
		results = make([]evalResult, len(pairs))
		for i, p := range pairs {
			matches, err := idx.eval(ctx, p.selector, p.entity)
			results[i] = evalResult{p, matches, err}
		}
	} else {
		var err error
		results, err = concurrency.ProcessInChunks(ctx, pairs,
			func(ctx context.Context, p pair) (evalResult, error) {
				matches, err := idx.eval(ctx, p.selector, p.entity)
				return evalResult{p, matches, err}, nil
			},
		)
		if err != nil {
			return 0
		}
	}

	// Apply results under the lock
	idx.mu.Lock()
	defer idx.mu.Unlock()

	for _, r := range results {
		if r.err != nil {
			continue
		}

		if !idx.selectors[r.p.selector] || !idx.entities[r.p.entity] {
			continue
		}

		members := idx.membership[r.p.selector]
		if members == nil {
			continue
		}

		if r.matches {
			members[r.p.entity] = true
		} else {
			delete(members, r.p.entity)
		}
	}

	return len(results)
}
