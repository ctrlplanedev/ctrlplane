package matchindex

import (
	"context"
	"sort"
	"sync"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// testEvalStore is a simple in-memory store that maps (selectorID, entityID) -> bool.
// Used to drive evaluations in tests without any CEL dependency.
type testEvalStore struct {
	mu      sync.RWMutex
	results map[[2]string]bool
}

func newTestEvalStore() *testEvalStore {
	return &testEvalStore{results: make(map[[2]string]bool)}
}

func (s *testEvalStore) set(selectorID, entityID string, matches bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.results[[2]string{selectorID, entityID}] = matches
}

func (s *testEvalStore) matchFunc(_ context.Context, selectorID, entityID string) (bool, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.results[[2]string{selectorID, entityID}], nil
}

// sorted returns a sorted copy of a string slice for deterministic assertions.
func sorted(s []string) []string {
	out := make([]string, len(s))
	copy(out, s)
	sort.Strings(out)
	return out
}

func TestBasicMembership(t *testing.T) {
	store := newTestEvalStore()
	store.set("sel1", "entityA", true)
	store.set("sel1", "entityB", false)
	store.set("sel2", "entityA", false)
	store.set("sel2", "entityB", true)

	idx := New(store.matchFunc)
	idx.AddSelector("sel1")
	idx.AddSelector("sel2")
	idx.AddEntity("entityA")
	idx.AddEntity("entityB")

	assert.True(t, idx.IsDirty())

	n := idx.Recompute(context.Background())
	assert.Equal(t, 4, n)
	assert.False(t, idx.IsDirty())

	assert.Equal(t, []string{"entityA"}, idx.GetMatches("sel1"))
	assert.Equal(t, []string{"entityB"}, idx.GetMatches("sel2"))

	assert.Equal(t, []string{"sel1"}, idx.GetMatchingSelectors("entityA"))
	assert.Equal(t, []string{"sel2"}, idx.GetMatchingSelectors("entityB"))
}

func TestHasMatch(t *testing.T) {
	store := newTestEvalStore()
	store.set("sel1", "entityA", true)
	store.set("sel1", "entityB", false)

	idx := New(store.matchFunc)
	idx.AddSelector("sel1")
	idx.AddEntity("entityA")
	idx.AddEntity("entityB")
	idx.Recompute(context.Background())

	assert.True(t, idx.HasMatch("sel1", "entityA"))
	assert.False(t, idx.HasMatch("sel1", "entityB"))
	assert.False(t, idx.HasMatch("unknown", "entityA"))
}

func TestDirtyEntity(t *testing.T) {
	store := newTestEvalStore()
	store.set("sel1", "entityA", true)

	idx := New(store.matchFunc)
	idx.AddSelector("sel1")
	idx.AddEntity("entityA")
	idx.Recompute(context.Background())

	assert.True(t, idx.HasMatch("sel1", "entityA"))

	// Entity changes — no longer matches
	store.set("sel1", "entityA", false)
	idx.DirtyEntity("entityA")

	assert.True(t, idx.IsDirty())
	n := idx.Recompute(context.Background())
	assert.Equal(t, 1, n)
	assert.False(t, idx.HasMatch("sel1", "entityA"))
}

func TestUpdateSelector(t *testing.T) {
	store := newTestEvalStore()
	store.set("sel1", "entityA", false)
	store.set("sel1", "entityB", true)

	idx := New(store.matchFunc)
	idx.AddSelector("sel1")
	idx.AddEntity("entityA")
	idx.AddEntity("entityB")
	idx.Recompute(context.Background())

	assert.False(t, idx.HasMatch("sel1", "entityA"))
	assert.True(t, idx.HasMatch("sel1", "entityB"))

	// Selector changes — now entityA matches and entityB doesn't
	store.set("sel1", "entityA", true)
	store.set("sel1", "entityB", false)
	idx.UpdateSelector("sel1")

	n := idx.Recompute(context.Background())
	assert.Equal(t, 2, n)
	assert.True(t, idx.HasMatch("sel1", "entityA"))
	assert.False(t, idx.HasMatch("sel1", "entityB"))
}

func TestDirtyPair(t *testing.T) {
	store := newTestEvalStore()
	store.set("sel1", "entityA", true)
	store.set("sel1", "entityB", true)

	idx := New(store.matchFunc)
	idx.AddSelector("sel1")
	idx.AddEntity("entityA")
	idx.AddEntity("entityB")
	idx.Recompute(context.Background())

	// Only entityA changes
	store.set("sel1", "entityA", false)
	idx.DirtyPair("sel1", "entityA")

	n := idx.Recompute(context.Background())
	assert.Equal(t, 1, n) // only the targeted pair
	assert.False(t, idx.HasMatch("sel1", "entityA"))
	assert.True(t, idx.HasMatch("sel1", "entityB")) // untouched
}

func TestRemoveSelector(t *testing.T) {
	store := newTestEvalStore()
	store.set("sel1", "entityA", true)

	idx := New(store.matchFunc)
	idx.AddSelector("sel1")
	idx.AddEntity("entityA")
	idx.Recompute(context.Background())

	assert.True(t, idx.HasMatch("sel1", "entityA"))

	idx.RemoveSelector("sel1")

	assert.Empty(t, idx.GetMatches("sel1"))
	assert.Empty(t, idx.GetMatchingSelectors("entityA"))
	assert.False(t, idx.HasMatch("sel1", "entityA"))
}

func TestRemoveEntity(t *testing.T) {
	store := newTestEvalStore()
	store.set("sel1", "entityA", true)
	store.set("sel1", "entityB", true)

	idx := New(store.matchFunc)
	idx.AddSelector("sel1")
	idx.AddEntity("entityA")
	idx.AddEntity("entityB")
	idx.Recompute(context.Background())

	assert.True(t, idx.HasMatch("sel1", "entityA"))
	assert.True(t, idx.HasMatch("sel1", "entityB"))

	idx.RemoveEntity("entityA")

	assert.False(t, idx.HasMatch("sel1", "entityA"))
	assert.True(t, idx.HasMatch("sel1", "entityB"))
	assert.Equal(t, []string{"entityB"}, idx.GetMatches("sel1"))
}

func TestDirtyAll(t *testing.T) {
	store := newTestEvalStore()
	store.set("sel1", "entityA", true)
	store.set("sel1", "entityB", true)
	store.set("sel2", "entityA", false)
	store.set("sel2", "entityB", true)

	idx := New(store.matchFunc)
	idx.AddSelector("sel1")
	idx.AddSelector("sel2")
	idx.AddEntity("entityA")
	idx.AddEntity("entityB")
	idx.Recompute(context.Background())

	// Change everything
	store.set("sel1", "entityA", false)
	store.set("sel1", "entityB", false)
	store.set("sel2", "entityA", true)
	store.set("sel2", "entityB", false)

	idx.DirtyAll()
	assert.True(t, idx.IsDirty())

	n := idx.Recompute(context.Background())
	assert.Equal(t, 4, n)

	assert.Empty(t, idx.GetMatches("sel1"))
	assert.Equal(t, []string{"entityA"}, idx.GetMatches("sel2"))
}

func TestNoOpRecompute(t *testing.T) {
	store := newTestEvalStore()
	idx := New(store.matchFunc)
	idx.AddSelector("sel1")
	idx.AddEntity("entityA")
	idx.Recompute(context.Background())

	// Nothing dirty
	n := idx.Recompute(context.Background())
	assert.Equal(t, 0, n)
	assert.False(t, idx.IsDirty())
}

func TestEvalError(t *testing.T) {
	callCount := 0
	errFunc := func(_ context.Context, selectorID, entityID string) (bool, error) {
		callCount++
		return false, assert.AnError
	}

	idx := New(errFunc)
	idx.AddSelector("sel1")
	idx.AddEntity("entityA")
	idx.Recompute(context.Background())

	// Entity should not be in membership when eval returns an error
	assert.False(t, idx.HasMatch("sel1", "entityA"))
	assert.Empty(t, idx.GetMatches("sel1"))
	assert.Equal(t, 1, callCount)
}

func TestRemoveSelectorDuringRecompute(t *testing.T) {
	store := newTestEvalStore()
	store.set("sel1", "entityA", true)

	var idx *MatchIndex
	idx = New(func(ctx context.Context, selectorID, entityID string) (bool, error) {
		// Simulate: selector removed while eval is running
		idx.RemoveSelector("sel1")
		return store.matchFunc(ctx, selectorID, entityID)
	})
	idx.AddSelector("sel1")
	idx.AddEntity("entityA")
	idx.Recompute(context.Background())

	// Selector was removed, result should not be applied
	assert.False(t, idx.HasMatch("sel1", "entityA"))
}

func TestRemoveEntityDuringRecompute(t *testing.T) {
	store := newTestEvalStore()
	store.set("sel1", "entityA", true)

	var idx *MatchIndex
	idx = New(func(ctx context.Context, selectorID, entityID string) (bool, error) {
		// Simulate: entity removed while eval is running
		idx.RemoveEntity("entityA")
		return store.matchFunc(ctx, selectorID, entityID)
	})
	idx.AddSelector("sel1")
	idx.AddEntity("entityA")
	idx.Recompute(context.Background())

	// Entity was removed, result should not be applied
	assert.False(t, idx.HasMatch("sel1", "entityA"))
}

func TestDirtyIgnoresUnregistered(t *testing.T) {
	store := newTestEvalStore()
	idx := New(store.matchFunc)

	// These should be no-ops, not panic
	idx.DirtyEntity("nonexistent")
	idx.DirtyPair("nonexistent-sel", "nonexistent-entity")
	idx.UpdateSelector("nonexistent")

	assert.False(t, idx.IsDirty())
}

func TestMultipleSelectorsSameEntity(t *testing.T) {
	store := newTestEvalStore()
	store.set("sel1", "entityA", true)
	store.set("sel2", "entityA", true)
	store.set("sel3", "entityA", false)

	idx := New(store.matchFunc)
	idx.AddSelector("sel1")
	idx.AddSelector("sel2")
	idx.AddSelector("sel3")
	idx.AddEntity("entityA")
	idx.Recompute(context.Background())

	matching := sorted(idx.GetMatchingSelectors("entityA"))
	assert.Equal(t, []string{"sel1", "sel2"}, matching)
}

func TestDeduplication(t *testing.T) {
	evalCount := 0
	store := newTestEvalStore()
	store.set("sel1", "entityA", true)

	idx := New(func(ctx context.Context, selectorID, entityID string) (bool, error) {
		evalCount++
		return store.matchFunc(ctx, selectorID, entityID)
	})
	idx.AddSelector("sel1")
	idx.AddEntity("entityA")
	idx.Recompute(context.Background())

	evalCount = 0

	// Flag the same pair via all three dirty mechanisms
	idx.DirtyEntity("entityA")
	idx.UpdateSelector("sel1")
	idx.DirtyPair("sel1", "entityA")

	n := idx.Recompute(context.Background())
	// Should still only evaluate once due to deduplication
	assert.Equal(t, 1, n)
	assert.Equal(t, 1, evalCount)
}

func TestConcurrentSafety(t *testing.T) {
	store := newTestEvalStore()
	for i := 0; i < 10; i++ {
		for j := 0; j < 10; j++ {
			store.set(
				"sel"+string(rune('0'+i)),
				"entity"+string(rune('0'+j)),
				(i+j)%2 == 0,
			)
		}
	}

	idx := New(store.matchFunc)

	var wg sync.WaitGroup

	// Register selectors concurrently
	for i := 0; i < 10; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			idx.AddSelector("sel" + string(rune('0'+i)))
		}(i)
	}
	wg.Wait()

	// Register entities concurrently
	for j := 0; j < 10; j++ {
		wg.Add(1)
		go func(j int) {
			defer wg.Done()
			idx.AddEntity("entity" + string(rune('0'+j)))
		}(j)
	}
	wg.Wait()

	// Recompute
	idx.Recompute(context.Background())

	// Dirty + Recompute concurrently
	for i := 0; i < 5; i++ {
		wg.Add(3)
		go func() {
			defer wg.Done()
			idx.DirtyAll()
		}()
		go func() {
			defer wg.Done()
			idx.Recompute(context.Background())
		}()
		go func(i int) {
			defer wg.Done()
			idx.DirtyEntity("entity" + string(rune('0'+i)))
		}(i)
	}
	wg.Wait()

	// Final recompute to settle
	idx.Recompute(context.Background())

	// Verify reads don't panic
	for i := 0; i < 10; i++ {
		_ = idx.GetMatches("sel" + string(rune('0'+i)))
	}
	for j := 0; j < 10; j++ {
		_ = idx.GetMatchingSelectors("entity" + string(rune('0'+j)))
	}
}

func TestAddSelectorIdempotent(t *testing.T) {
	store := newTestEvalStore()
	store.set("sel1", "entityA", true)

	idx := New(store.matchFunc)
	idx.AddSelector("sel1")
	idx.AddEntity("entityA")
	idx.Recompute(context.Background())

	require.True(t, idx.HasMatch("sel1", "entityA"))

	// Re-register same selector — should not lose existing membership
	// until next Recompute, and Recompute should re-evaluate
	idx.AddSelector("sel1")
	assert.True(t, idx.HasMatch("sel1", "entityA"))

	n := idx.Recompute(context.Background())
	assert.Equal(t, 1, n)
	assert.True(t, idx.HasMatch("sel1", "entityA"))
}

func TestEmptyIndex(t *testing.T) {
	idx := New(func(_ context.Context, _, _ string) (bool, error) {
		t.Fatal("eval should not be called on empty index")
		return false, nil
	})

	assert.False(t, idx.IsDirty())
	assert.Equal(t, 0, idx.Recompute(context.Background()))
	assert.Empty(t, idx.GetMatches("anything"))
	assert.Empty(t, idx.GetMatchingSelectors("anything"))
	assert.False(t, idx.HasMatch("a", "b"))
}

// --- Scanner tests ---

func TestForEachMatch(t *testing.T) {
	store := newTestEvalStore()
	store.set("sel1", "entityA", true)
	store.set("sel1", "entityB", true)
	store.set("sel1", "entityC", false)

	idx := New(store.matchFunc)
	idx.AddSelector("sel1")
	idx.AddEntity("entityA")
	idx.AddEntity("entityB")
	idx.AddEntity("entityC")
	idx.Recompute(context.Background())

	var collected []string
	idx.ForEachMatch("sel1", func(entityID string) bool {
		collected = append(collected, entityID)
		return true
	})
	assert.Equal(t, []string{"entityA", "entityB"}, sorted(collected))
}

func TestForEachMatchEarlyStop(t *testing.T) {
	store := newTestEvalStore()
	store.set("sel1", "entityA", true)
	store.set("sel1", "entityB", true)

	idx := New(store.matchFunc)
	idx.AddSelector("sel1")
	idx.AddEntity("entityA")
	idx.AddEntity("entityB")
	idx.Recompute(context.Background())

	count := 0
	idx.ForEachMatch("sel1", func(entityID string) bool {
		count++
		return false // stop after first
	})
	assert.Equal(t, 1, count)
}

func TestForEachMatchingSelector(t *testing.T) {
	store := newTestEvalStore()
	store.set("sel1", "entityA", true)
	store.set("sel2", "entityA", true)
	store.set("sel3", "entityA", false)

	idx := New(store.matchFunc)
	idx.AddSelector("sel1")
	idx.AddSelector("sel2")
	idx.AddSelector("sel3")
	idx.AddEntity("entityA")
	idx.Recompute(context.Background())

	var collected []string
	idx.ForEachMatchingSelector("entityA", func(selectorID string) bool {
		collected = append(collected, selectorID)
		return true
	})
	assert.Equal(t, []string{"sel1", "sel2"}, sorted(collected))
}

func TestCountMatches(t *testing.T) {
	store := newTestEvalStore()
	store.set("sel1", "entityA", true)
	store.set("sel1", "entityB", true)
	store.set("sel1", "entityC", false)

	idx := New(store.matchFunc)
	idx.AddSelector("sel1")
	idx.AddEntity("entityA")
	idx.AddEntity("entityB")
	idx.AddEntity("entityC")
	idx.Recompute(context.Background())

	assert.Equal(t, 2, idx.CountMatches("sel1"))
	assert.Equal(t, 0, idx.CountMatches("unknown"))
}

// --- Stats tests ---

func TestStats(t *testing.T) {
	store := newTestEvalStore()
	store.set("sel1", "entityA", true)
	store.set("sel1", "entityB", false)
	store.set("sel2", "entityA", true)
	store.set("sel2", "entityB", true)

	idx := New(store.matchFunc)
	idx.AddSelector("sel1")
	idx.AddSelector("sel2")
	idx.AddEntity("entityA")
	idx.AddEntity("entityB")

	assert.Equal(t, 2, idx.SelectorCount())
	assert.Equal(t, 2, idx.EntityCount())

	idx.Recompute(context.Background())

	assert.Equal(t, 3, idx.MatchCount()) // sel1->entityA, sel2->entityA, sel2->entityB
	assert.Equal(t, 0, idx.DirtyCount())

	idx.DirtyEntity("entityA")
	assert.Equal(t, 2, idx.DirtyCount()) // entityA x 2 selectors
}

// --- Interface compliance tests ---

func TestReaderInterface(t *testing.T) {
	store := newTestEvalStore()
	store.set("sel1", "entityA", true)

	idx := New(store.matchFunc)
	idx.AddSelector("sel1")
	idx.AddEntity("entityA")
	idx.Recompute(context.Background())

	var reader Reader = idx
	assert.True(t, reader.HasMatch("sel1", "entityA"))
	assert.Equal(t, []string{"entityA"}, reader.GetMatches("sel1"))
	assert.Equal(t, []string{"sel1"}, reader.GetMatchingSelectors("entityA"))
}

func TestWriterInterface(t *testing.T) {
	store := newTestEvalStore()
	store.set("sel1", "entityA", true)

	idx := New(store.matchFunc)

	var writer Writer = idx
	writer.AddSelector("sel1")
	writer.AddEntity("entityA")

	idx.Recompute(context.Background())
	assert.True(t, idx.HasMatch("sel1", "entityA"))

	store.set("sel1", "entityA", false)
	writer.DirtyEntity("entityA")
	idx.Recompute(context.Background())
	assert.False(t, idx.HasMatch("sel1", "entityA"))
}

func TestRecomputerInterface(t *testing.T) {
	store := newTestEvalStore()
	idx := New(store.matchFunc)
	idx.AddSelector("sel1")
	idx.AddEntity("entityA")

	var recomputer Recomputer = idx
	assert.True(t, recomputer.IsDirty())
	recomputer.Recompute(context.Background())
	assert.False(t, recomputer.IsDirty())
}

func TestScannerInterface(t *testing.T) {
	store := newTestEvalStore()
	store.set("sel1", "entityA", true)

	idx := New(store.matchFunc)
	idx.AddSelector("sel1")
	idx.AddEntity("entityA")
	idx.Recompute(context.Background())

	var scanner Scanner = idx
	assert.Equal(t, 1, scanner.CountMatches("sel1"))

	var found string
	scanner.ForEachMatch("sel1", func(entityID string) bool {
		found = entityID
		return false
	})
	assert.Equal(t, "entityA", found)
}

func TestStatsInterface(t *testing.T) {
	store := newTestEvalStore()
	store.set("sel1", "entityA", true)

	idx := New(store.matchFunc)
	idx.AddSelector("sel1")
	idx.AddEntity("entityA")
	idx.Recompute(context.Background())

	var stats Stats = idx
	assert.Equal(t, 1, stats.SelectorCount())
	assert.Equal(t, 1, stats.EntityCount())
	assert.Equal(t, 1, stats.MatchCount())
	assert.Equal(t, 0, stats.DirtyCount())
}

func TestIndexInterface(t *testing.T) {
	store := newTestEvalStore()
	store.set("sel1", "entityA", true)

	idx := New(store.matchFunc)

	var index Index = idx
	index.AddSelector("sel1")
	index.AddEntity("entityA")
	assert.True(t, index.IsDirty())
	index.Recompute(context.Background())
	assert.True(t, index.HasMatch("sel1", "entityA"))
	assert.Equal(t, 1, index.CountMatches("sel1"))
	assert.Equal(t, 1, index.SelectorCount())
}

func TestForEachMatchingSelectorEarlyStop(t *testing.T) {
	store := newTestEvalStore()
	store.set("sel1", "entityA", true)
	store.set("sel2", "entityA", true)

	idx := New(store.matchFunc)
	idx.AddSelector("sel1")
	idx.AddSelector("sel2")
	idx.AddEntity("entityA")
	idx.Recompute(context.Background())

	count := 0
	idx.ForEachMatchingSelector("entityA", func(selectorID string) bool {
		count++
		return false // stop after first
	})
	assert.Equal(t, 1, count)
}

func TestRecompute_StaleDirtySelectorSkipped(t *testing.T) {
	// Defensive branch: dirtySelectors snapshot contains a selector that is
	// no longer in idx.selectors. This can't happen through the public API
	// (RemoveSelector always cleans dirtySelectors), but the code guards
	// against it. We simulate it by injecting a stale dirty entry directly.
	store := newTestEvalStore()
	store.set("sel1", "entityA", true)

	idx := New(store.matchFunc)
	idx.AddSelector("sel1")
	idx.AddEntity("entityA")
	idx.Recompute(context.Background())

	// Inject stale dirty selector: mark "ghost" as dirty but don't register it
	idx.mu.Lock()
	idx.dirtySelectors["ghost"] = true
	idx.mu.Unlock()

	n := idx.Recompute(context.Background())
	assert.Equal(t, 0, n) // ghost is skipped, nothing else is dirty
}

func TestRecompute_StaleDirtyEntitySkipped(t *testing.T) {
	// Defensive branch: dirtyEntities snapshot contains an entity that is
	// no longer in idx.entities. We simulate it by injecting a stale entry.
	store := newTestEvalStore()
	store.set("sel1", "entityA", true)

	idx := New(store.matchFunc)
	idx.AddSelector("sel1")
	idx.AddEntity("entityA")
	idx.Recompute(context.Background())

	// Inject stale dirty entity
	idx.mu.Lock()
	idx.dirtyEntities["ghost"] = true
	idx.mu.Unlock()

	n := idx.Recompute(context.Background())
	assert.Equal(t, 0, n) // ghost is skipped
}

func TestRecompute_MembershipNilDuringApply(t *testing.T) {
	store := newTestEvalStore()
	store.set("sel1", "entityA", true)

	var idx *MatchIndex
	idx = New(func(ctx context.Context, selectorID, entityID string) (bool, error) {
		// Remove selector during evaluation so membership becomes nil
		// when the apply phase runs
		idx.RemoveSelector(selectorID)
		return store.matchFunc(ctx, selectorID, entityID)
	})
	idx.AddSelector("sel1")
	idx.AddEntity("entityA")

	// Re-add selector after eval removes it, but without initializing membership,
	// to hit the members == nil branch. Actually, RemoveSelector deletes
	// membership, and the apply phase checks membership[selector] which will
	// be nil. But we also need idx.selectors[selector] to be true for the
	// apply to reach the nil-membership check. So we re-add the selector
	// inside the eval func after removing it.

	// Reset: use a more targeted approach
	idx = New(func(ctx context.Context, selectorID, entityID string) (bool, error) {
		// Remove and re-add: RemoveSelector deletes membership entry,
		// re-adding creates a new one. But we want membership to be nil.
		// Instead: just remove the selector. The apply phase will skip it
		// because idx.selectors check fails first.
		// To hit members==nil: we need selectors[sel]=true but membership[sel]=nil.
		// This can happen if selector is re-added via a direct manipulation.
		return store.matchFunc(ctx, selectorID, entityID)
	})
	idx.AddSelector("sel1")
	idx.AddEntity("entityA")
	idx.Recompute(context.Background())

	// Now manually dirty, remove membership, but keep selector registered
	idx.DirtyPair("sel1", "entityA")

	// Delete membership entry directly to simulate the edge case
	idx.mu.Lock()
	delete(idx.membership, "sel1")
	idx.mu.Unlock()

	n := idx.Recompute(context.Background())
	assert.Equal(t, 1, n)
	// The result should be skipped because membership is nil
	assert.False(t, idx.HasMatch("sel1", "entityA"))
}
