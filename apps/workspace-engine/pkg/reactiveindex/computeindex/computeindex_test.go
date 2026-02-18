package computeindex

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"sync"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// testStore is a simple in-memory store that maps entityID -> value.
// Used to drive evaluations in tests without any external dependency.
type testStore struct {
	mu     sync.RWMutex
	values map[string]string
}

func newTestStore() *testStore {
	return &testStore{values: make(map[string]string)}
}

func (s *testStore) set(entityID, value string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.values[entityID] = value
}

func (s *testStore) computeFunc(_ context.Context, entityID string) (string, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	v, ok := s.values[entityID]
	if !ok {
		return "", errors.New("entity not found")
	}
	return v, nil
}

// sorted returns a sorted copy of a string slice for deterministic assertions.
func sorted(s []string) []string {
	out := make([]string, len(s))
	copy(out, s)
	sort.Strings(out)
	return out
}

// --- Interface compliance tests ---

func TestInterfaceCompliance_Index(t *testing.T) {
	var _ Index[string] = (*ComputedIndex[string])(nil)
}

func TestInterfaceCompliance_Reader(t *testing.T) {
	var _ Reader[string] = (*ComputedIndex[string])(nil)
}

func TestInterfaceCompliance_Writer(t *testing.T) {
	var _ Writer = (*ComputedIndex[string])(nil)
}

func TestInterfaceCompliance_Recomputer(t *testing.T) {
	var _ Recomputer = (*ComputedIndex[string])(nil)
}

func TestInterfaceCompliance_Stats(t *testing.T) {
	var _ Stats = (*ComputedIndex[string])(nil)
}

// --- Core behavior tests ---

func TestBasicAddGetRecompute(t *testing.T) {
	store := newTestStore()
	store.set("e1", "value1")
	store.set("e2", "value2")

	idx := New(store.computeFunc)
	idx.AddEntity("e1")
	idx.AddEntity("e2")

	// Before recompute, Get should not return values
	_, ok := idx.Get("e1")
	assert.False(t, ok)

	assert.True(t, idx.IsDirty())
	assert.Equal(t, 2, idx.DirtyCount())
	assert.Equal(t, 2, idx.EntityCount())

	n := idx.Recompute(context.Background())
	assert.Equal(t, 2, n)

	assert.False(t, idx.IsDirty())
	assert.Equal(t, 0, idx.DirtyCount())

	v1, ok := idx.Get("e1")
	require.True(t, ok)
	assert.Equal(t, "value1", v1)

	v2, ok := idx.Get("e2")
	require.True(t, ok)
	assert.Equal(t, "value2", v2)
}

func TestDirtyEntityRecomputes(t *testing.T) {
	store := newTestStore()
	store.set("e1", "original")

	idx := New(store.computeFunc)
	idx.AddEntity("e1")
	idx.Recompute(context.Background())

	v, ok := idx.Get("e1")
	require.True(t, ok)
	assert.Equal(t, "original", v)

	// Mutate the underlying data and mark dirty
	store.set("e1", "updated")
	idx.DirtyEntity("e1")
	assert.True(t, idx.IsDirty())

	n := idx.Recompute(context.Background())
	assert.Equal(t, 1, n)

	v, ok = idx.Get("e1")
	require.True(t, ok)
	assert.Equal(t, "updated", v)
}

func TestRemoveEntity(t *testing.T) {
	store := newTestStore()
	store.set("e1", "value1")

	idx := New(store.computeFunc)
	idx.AddEntity("e1")
	idx.Recompute(context.Background())

	v, ok := idx.Get("e1")
	require.True(t, ok)
	assert.Equal(t, "value1", v)

	idx.RemoveEntity("e1")
	assert.Equal(t, 0, idx.EntityCount())
	assert.Equal(t, 0, idx.DirtyCount())

	_, ok = idx.Get("e1")
	assert.False(t, ok)
}

func TestRemoveEntityClearsDirty(t *testing.T) {
	store := newTestStore()
	store.set("e1", "value1")

	idx := New(store.computeFunc)
	idx.AddEntity("e1")
	// e1 is now dirty (pending first compute)
	assert.Equal(t, 1, idx.DirtyCount())

	idx.RemoveEntity("e1")
	assert.Equal(t, 0, idx.DirtyCount())
	assert.False(t, idx.IsDirty())
}

func TestDirtyAll(t *testing.T) {
	store := newTestStore()
	store.set("e1", "v1")
	store.set("e2", "v2")
	store.set("e3", "v3")

	idx := New(store.computeFunc)
	idx.AddEntity("e1")
	idx.AddEntity("e2")
	idx.AddEntity("e3")
	idx.Recompute(context.Background())

	assert.Equal(t, 0, idx.DirtyCount())

	store.set("e1", "v1-new")
	store.set("e2", "v2-new")
	store.set("e3", "v3-new")

	idx.DirtyAll()
	assert.Equal(t, 3, idx.DirtyCount())

	n := idx.Recompute(context.Background())
	assert.Equal(t, 3, n)

	v1, _ := idx.Get("e1")
	v2, _ := idx.Get("e2")
	v3, _ := idx.Get("e3")
	assert.Equal(t, "v1-new", v1)
	assert.Equal(t, "v2-new", v2)
	assert.Equal(t, "v3-new", v3)
}

func TestNoOpRecomputeWhenClean(t *testing.T) {
	store := newTestStore()
	store.set("e1", "value1")

	idx := New(store.computeFunc)
	idx.AddEntity("e1")
	idx.Recompute(context.Background())

	assert.False(t, idx.IsDirty())

	n := idx.Recompute(context.Background())
	assert.Equal(t, 0, n)
}

func TestErrorHandling_ValueNotUpdated(t *testing.T) {
	store := newTestStore()
	store.set("e1", "initial")

	idx := New(store.computeFunc)
	idx.AddEntity("e1")
	idx.Recompute(context.Background())

	v, ok := idx.Get("e1")
	require.True(t, ok)
	assert.Equal(t, "initial", v)

	// Remove from store so computeFunc returns an error
	store.mu.Lock()
	delete(store.values, "e1")
	store.mu.Unlock()

	idx.DirtyEntity("e1")
	n := idx.Recompute(context.Background())
	assert.Equal(t, 1, n) // evaluation was attempted

	// Value should remain unchanged — error means no update
	v, ok = idx.Get("e1")
	require.True(t, ok)
	assert.Equal(t, "initial", v)
}

func TestDirtyEntityIgnoresUnregistered(t *testing.T) {
	store := newTestStore()
	idx := New(store.computeFunc)

	// Dirtying an unregistered entity should not panic or add state
	idx.DirtyEntity("nonexistent")
	assert.Equal(t, 0, idx.EntityCount())
	assert.Equal(t, 0, idx.DirtyCount())
	assert.False(t, idx.IsDirty())
}

func TestGetNonexistentEntity(t *testing.T) {
	store := newTestStore()
	idx := New(store.computeFunc)

	_, ok := idx.Get("nonexistent")
	assert.False(t, ok)
}

func TestForEach(t *testing.T) {
	store := newTestStore()
	store.set("e1", "v1")
	store.set("e2", "v2")
	store.set("e3", "v3")

	idx := New(store.computeFunc)
	idx.AddEntity("e1")
	idx.AddEntity("e2")
	idx.AddEntity("e3")
	idx.Recompute(context.Background())

	var entities []string
	idx.ForEach(func(entityID string, _ string) bool {
		entities = append(entities, entityID)
		return true
	})

	assert.Equal(t, []string{"e1", "e2", "e3"}, sorted(entities))
}

func TestForEach_EarlyStop(t *testing.T) {
	store := newTestStore()
	store.set("e1", "v1")
	store.set("e2", "v2")
	store.set("e3", "v3")

	idx := New(store.computeFunc)
	idx.AddEntity("e1")
	idx.AddEntity("e2")
	idx.AddEntity("e3")
	idx.Recompute(context.Background())

	count := 0
	idx.ForEach(func(_ string, _ string) bool {
		count++
		return false // stop after first
	})

	assert.Equal(t, 1, count)
}

func TestRemoveDuringRecompute(t *testing.T) {
	// Entity is removed while recompute's ComputeFunc is executing.
	// The result for the removed entity should be discarded in the apply phase.
	var idx *ComputedIndex[string]
	idx = New(func(_ context.Context, entityID string) (string, error) {
		if entityID == "e1" {
			// Simulate concurrent removal during evaluation
			idx.RemoveEntity("e1")
		}
		return "computed-" + entityID, nil
	})
	idx.AddEntity("e1")
	idx.AddEntity("e2")

	n := idx.Recompute(context.Background())
	assert.Equal(t, 2, n) // both were evaluated

	// e1 was removed mid-evaluation — its result should NOT be applied
	_, ok := idx.Get("e1")
	assert.False(t, ok)
	assert.Equal(t, 1, idx.EntityCount())

	// e2 should still be present
	v2, ok := idx.Get("e2")
	assert.True(t, ok)
	assert.Equal(t, "computed-e2", v2)
}

func TestAddEntityIsIdempotent(t *testing.T) {
	store := newTestStore()
	store.set("e1", "value1")

	idx := New(store.computeFunc)
	idx.AddEntity("e1")
	idx.AddEntity("e1") // duplicate

	assert.Equal(t, 1, idx.EntityCount())
	// Should have 1 dirty entry, not 2
	assert.Equal(t, 1, idx.DirtyCount())
}

func TestRemoveEntityIsIdempotent(t *testing.T) {
	store := newTestStore()
	idx := New(store.computeFunc)

	// Removing a non-existent entity should not panic
	idx.RemoveEntity("nonexistent")
	assert.Equal(t, 0, idx.EntityCount())
}

func TestReaddEntity(t *testing.T) {
	store := newTestStore()
	store.set("e1", "first")

	idx := New(store.computeFunc)
	idx.AddEntity("e1")
	idx.Recompute(context.Background())

	v, ok := idx.Get("e1")
	require.True(t, ok)
	assert.Equal(t, "first", v)

	idx.RemoveEntity("e1")
	_, ok = idx.Get("e1")
	assert.False(t, ok)

	store.set("e1", "second")
	idx.AddEntity("e1")
	idx.Recompute(context.Background())

	v, ok = idx.Get("e1")
	require.True(t, ok)
	assert.Equal(t, "second", v)
}

func TestEmptyIndex(t *testing.T) {
	store := newTestStore()
	idx := New(store.computeFunc)

	assert.Equal(t, 0, idx.EntityCount())
	assert.Equal(t, 0, idx.DirtyCount())
	assert.False(t, idx.IsDirty())

	n := idx.Recompute(context.Background())
	assert.Equal(t, 0, n)
}

func TestConcurrentSafety(t *testing.T) {
	store := newTestStore()
	for i := 0; i < 100; i++ {
		store.set("e"+string(rune('A'+i%26)), "v"+string(rune('A'+i%26)))
	}

	idx := New(store.computeFunc)

	var wg sync.WaitGroup
	ctx := context.Background()

	// Concurrent adds
	for i := 0; i < 50; i++ {
		wg.Add(1)
		go func(n int) {
			defer wg.Done()
			idx.AddEntity("e" + string(rune('A'+n%26)))
		}(i)
	}

	// Concurrent recomputes
	for i := 0; i < 10; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			idx.Recompute(ctx)
		}()
	}

	// Concurrent reads
	for i := 0; i < 50; i++ {
		wg.Add(1)
		go func(n int) {
			defer wg.Done()
			idx.Get("e" + string(rune('A'+n%26)))
		}(i)
	}

	// Concurrent dirties
	for i := 0; i < 20; i++ {
		wg.Add(1)
		go func(n int) {
			defer wg.Done()
			idx.DirtyEntity("e" + string(rune('A'+n%26)))
		}(i)
	}

	wg.Wait()

	// Final recompute should not panic
	idx.Recompute(ctx)
}

func TestGenericTypeInt(t *testing.T) {
	idx := New(func(_ context.Context, entityID string) (int, error) {
		return len(entityID), nil
	})

	idx.AddEntity("a")
	idx.AddEntity("abc")
	idx.Recompute(context.Background())

	v, ok := idx.Get("a")
	require.True(t, ok)
	assert.Equal(t, 1, v)

	v, ok = idx.Get("abc")
	require.True(t, ok)
	assert.Equal(t, 3, v)
}

func TestGenericTypeStruct(t *testing.T) {
	type State struct {
		Name   string
		Active bool
	}

	idx := New(func(_ context.Context, entityID string) (State, error) {
		return State{Name: entityID, Active: true}, nil
	})

	idx.AddEntity("server-1")
	idx.Recompute(context.Background())

	v, ok := idx.Get("server-1")
	require.True(t, ok)
	assert.Equal(t, State{Name: "server-1", Active: true}, v)
}

func TestGenericTypePointer(t *testing.T) {
	type Release struct {
		Version string
	}

	idx := New(func(_ context.Context, entityID string) (*Release, error) {
		return &Release{Version: "v1.0-" + entityID}, nil
	})

	idx.AddEntity("deploy-1")
	idx.Recompute(context.Background())

	v, ok := idx.Get("deploy-1")
	require.True(t, ok)
	require.NotNil(t, v)
	assert.Equal(t, "v1.0-deploy-1", v.Version)
}

// --- Parallel recompute tests ---

func TestParallelRecompute_BasicCorrectness(t *testing.T) {
	store := newTestStore()
	for i := 0; i < 100; i++ {
		id := fmt.Sprintf("e%d", i)
		store.set(id, fmt.Sprintf("value-%d", i))
	}

	idx := New(store.computeFunc, WithConcurrency(4))
	for i := 0; i < 100; i++ {
		idx.AddEntity(fmt.Sprintf("e%d", i))
	}

	n := idx.Recompute(context.Background())
	assert.Equal(t, 100, n)

	for i := 0; i < 100; i++ {
		id := fmt.Sprintf("e%d", i)
		v, ok := idx.Get(id)
		require.True(t, ok, "entity %s missing", id)
		assert.Equal(t, fmt.Sprintf("value-%d", i), v)
	}
}

func TestParallelRecompute_ErrorsDoNotOverwriteValues(t *testing.T) {
	store := newTestStore()
	store.set("good", "ok")

	idx := New(store.computeFunc, WithConcurrency(4))
	idx.AddEntity("good")
	idx.AddEntity("missing") // will error

	n := idx.Recompute(context.Background())
	assert.Equal(t, 2, n)

	v, ok := idx.Get("good")
	require.True(t, ok)
	assert.Equal(t, "ok", v)

	_, ok = idx.Get("missing")
	assert.False(t, ok)
}

func TestParallelRecompute_ConcurrentSafety(t *testing.T) {
	store := newTestStore()
	for i := 0; i < 200; i++ {
		store.set(fmt.Sprintf("e%d", i), fmt.Sprintf("v%d", i))
	}

	idx := New(store.computeFunc, WithConcurrency(8))

	var wg sync.WaitGroup
	ctx := context.Background()

	for i := 0; i < 200; i++ {
		idx.AddEntity(fmt.Sprintf("e%d", i))
	}

	// Concurrent recomputes + reads + dirties
	for i := 0; i < 10; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			idx.Recompute(ctx)
		}()
	}

	for i := 0; i < 50; i++ {
		wg.Add(1)
		go func(n int) {
			defer wg.Done()
			idx.Get(fmt.Sprintf("e%d", n))
		}(i)
	}

	for i := 0; i < 20; i++ {
		wg.Add(1)
		go func(n int) {
			defer wg.Done()
			idx.DirtyEntity(fmt.Sprintf("e%d", n))
		}(i)
	}

	wg.Wait()
	idx.Recompute(ctx)
}

func TestParallelRecompute_SingleEntity(t *testing.T) {
	store := newTestStore()
	store.set("only", "one")

	idx := New(store.computeFunc, WithConcurrency(4))
	idx.AddEntity("only")

	n := idx.Recompute(context.Background())
	assert.Equal(t, 1, n)

	v, ok := idx.Get("only")
	require.True(t, ok)
	assert.Equal(t, "one", v)
}

func TestWithAutoConcurrency(t *testing.T) {
	store := newTestStore()
	store.set("e1", "v1")

	idx := New(store.computeFunc, WithAutoConcurrency())
	idx.AddEntity("e1")
	idx.Recompute(context.Background())

	v, ok := idx.Get("e1")
	require.True(t, ok)
	assert.Equal(t, "v1", v)
}
