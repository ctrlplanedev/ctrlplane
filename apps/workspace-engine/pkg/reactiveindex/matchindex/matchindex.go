package matchindex

import (
	"context"
	"runtime"
	"sync"
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

// maxPairsPerBatch limits the number of pairs materialized at once during
// recomputation. This bounds peak memory to ~200 MB per batch regardless
// of total entity count, enabling 20K+ entities without OOM.
const maxPairsPerBatch = 2_000_000

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
// Steps 1 and 2 are processed in memory-bounded batches via evaluateCross,
// so peak allocation stays constant regardless of entity count.
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

	// Snapshot registered selectors/entities into ordered slices and lookup
	// sets for stable iteration outside the lock.
	selectorSlice := make([]string, 0, len(idx.selectors))
	selectorSet := make(map[string]bool, len(idx.selectors))
	for s := range idx.selectors {
		selectorSlice = append(selectorSlice, s)
		selectorSet[s] = true
	}
	entitySlice := make([]string, 0, len(idx.entities))
	entitySet := make(map[string]bool, len(idx.entities))
	for e := range idx.entities {
		entitySlice = append(entitySlice, e)
		entitySet[e] = true
	}

	idx.mu.Unlock()

	totalEvals := 0

	// Step 1: dirty selectors × all entities
	var dirtySelectorSlice []string
	for s := range dirtySelectors {
		if selectorSet[s] {
			dirtySelectorSlice = append(dirtySelectorSlice, s)
		}
	}
	if len(dirtySelectorSlice) > 0 && len(entitySlice) > 0 {
		totalEvals += idx.evaluateCross(ctx, dirtySelectorSlice, entitySlice, true)
	}

	// Step 2: dirty entities × non-dirty selectors
	nonDirtySelectors := make([]string, 0, len(selectorSlice))
	for _, s := range selectorSlice {
		if !dirtySelectors[s] {
			nonDirtySelectors = append(nonDirtySelectors, s)
		}
	}
	var dirtyEntitySlice []string
	for e := range dirtyEntities {
		if entitySet[e] {
			dirtyEntitySlice = append(dirtyEntitySlice, e)
		}
	}
	if len(dirtyEntitySlice) > 0 && len(nonDirtySelectors) > 0 {
		totalEvals += idx.evaluateCross(ctx, dirtyEntitySlice, nonDirtySelectors, false)
	}

	// Step 3: explicit dirty pairs, skipping any covered by steps 1 or 2
	for p := range dirtyPairs {
		s, e := p[0], p[1]
		if dirtySelectors[s] || dirtyEntities[e] || !selectorSet[s] || !entitySet[e] {
			continue
		}
		matches, matchErr := idx.eval(ctx, s, e)
		totalEvals++
		if matchErr != nil {
			continue
		}
		idx.mu.Lock()
		if members := idx.membership[s]; members != nil && idx.selectors[s] && idx.entities[e] {
			if matches {
				members[e] = true
			} else {
				delete(members, e)
			}
		}
		idx.mu.Unlock()
	}

	return totalEvals
}

// Result byte values for compact storage in evaluateCross.
const (
	resultTrue byte = 1
	resultErr  byte = 2
)

// evaluateCross evaluates a cross product of rows × cols in memory-bounded
// batches. If selectorIsRow is true, rows are selectors and cols are entities;
// otherwise rows are entities and cols are selectors.
//
// Results are stored in a compact []byte (one byte per pair) instead of
// allocating pair/evalResult structs, reducing per-batch allocation from
// ~300 MB to ~2 MB at 20K entities. Parallelism is achieved via a simple
// WaitGroup-based worker pool partitioned by row ranges.
func (idx *MatchIndex) evaluateCross(ctx context.Context, rows, cols []string, selectorIsRow bool) int {
	if len(rows) == 0 || len(cols) == 0 {
		return 0
	}

	rowsPerBatch := maxPairsPerBatch / len(cols)
	if rowsPerBatch < 1 {
		rowsPerBatch = 1
	}

	numCols := len(cols)
	totalEvals := 0

	for i := 0; i < len(rows); i += rowsPerBatch {
		batchEnd := min(i+rowsPerBatch, len(rows))
		batchRows := rows[i:batchEnd]
		pairCount := len(batchRows) * numCols

		results := make([]byte, pairCount)

		if pairCount <= parallelThreshold {
			for ri, r := range batchRows {
				for ci, c := range cols {
					s, e := r, c
					if !selectorIsRow {
						s, e = c, r
					}
					m, err := idx.eval(ctx, s, e)
					off := ri*numCols + ci
					if err != nil {
						results[off] = resultErr
					} else if m {
						results[off] = resultTrue
					}
				}
			}
		} else {
			numWorkers := runtime.GOMAXPROCS(0)
			rowChunk := (len(batchRows) + numWorkers - 1) / numWorkers
			var wg sync.WaitGroup

			for w := range numWorkers {
				wStart := w * rowChunk
				if wStart >= len(batchRows) {
					break
				}
				wEnd := min(wStart+rowChunk, len(batchRows))
				wg.Add(1)
				go func(rStart, rEnd int) {
					defer wg.Done()
					for ri := rStart; ri < rEnd; ri++ {
						r := batchRows[ri]
						for ci, c := range cols {
							s, e := r, c
							if !selectorIsRow {
								s, e = c, r
							}
							m, err := idx.eval(ctx, s, e)
							off := ri*numCols + ci
							if err != nil {
								results[off] = resultErr
							} else if m {
								results[off] = resultTrue
							}
						}
					}
				}(wStart, wEnd)
			}
			wg.Wait()
		}

		idx.mu.Lock()
		for ri, r := range batchRows {
			for ci, c := range cols {
				off := ri*numCols + ci
				if results[off] == resultErr {
					continue
				}
				s, e := r, c
				if !selectorIsRow {
					s, e = c, r
				}
				if !idx.selectors[s] || !idx.entities[e] {
					continue
				}
				members := idx.membership[s]
				if members == nil {
					continue
				}
				if results[off] == resultTrue {
					members[e] = true
				} else {
					delete(members, e)
				}
			}
		}
		idx.mu.Unlock()

		totalEvals += pairCount
	}

	return totalEvals
}
