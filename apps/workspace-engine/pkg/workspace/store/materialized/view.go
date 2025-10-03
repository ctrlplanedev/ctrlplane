package materialized

import (
	"slices"
	"sync"

	cmap "workspace-engine/pkg/cmap"
)

// RecomputeFunc recomputes values for the given keys and returns the results.
// Any key omitted from the returned map is treated as "no update".
type RecomputeFunc[V any] func(keys []string) (map[string]V, error)

// ListAllKeysFunc lists all keys that exist/should exist (used by TriggerAll).
type ListAllKeysFunc func() []string

// MaterializedView stores per-key values & versions using concurrent maps,
// coalesces recomputes, and provides an optional wait-for-freshness API.
type MaterializedView[V any] struct {
	// Only used to coordinate Waiters and avoid missed notifications.
	mu   sync.Mutex
	cond *sync.Cond

	// Concurrent, lock-free maps for actual data & coordination.
	val     cmap.ConcurrentMap[string, V]
	version cmap.ConcurrentMap[string, uint64]
	inProg  cmap.ConcurrentMap[string, struct{}] // keys currently recomputing in some batch
	pending cmap.ConcurrentMap[string, struct{}] // keys invalidated while inProg

	recompute RecomputeFunc[V]
	allKeys   ListAllKeysFunc
}

func New[V any](rf RecomputeFunc[V], allKeys ListAllKeysFunc) *MaterializedView[V] {
	mv := &MaterializedView[V]{
		val:       cmap.New[V](),
		version:   cmap.New[uint64](),
		inProg:    cmap.New[struct{}](),
		pending:   cmap.New[struct{}](),
		recompute: rf,
		allKeys:   allKeys,
	}
	mv.cond = sync.NewCond(&mv.mu)
	return mv
}

// Get returns the last published value (zero if absent) and its version.
func (m *MaterializedView[V]) Get(k string) (V, uint64) {
	v, _ := m.val.Get(k)
	ver, _ := m.version.Get(k)
	return v, ver
}

// WaitForAtLeast blocks until version(k) >= target.
// We use a small condvar so callers don’t spin or miss publications.
func (m *MaterializedView[V]) WaitForAtLeast(k string, target uint64) {
	m.mu.Lock()
	defer m.mu.Unlock()
	for {
		cur, _ := m.version.Get(k)
		if cur >= target {
			return
		}
		m.cond.Wait()
	}
}

// Trigger recomputes just these keys. If wait==true, it blocks until each key
// publishes a strictly newer version than at call time.
func (m *MaterializedView[V]) Trigger(keys []string, wait bool) error {
	if len(keys) == 0 {
		return nil
	}
	slices.Sort(keys)
	keys = slices.Compact(keys)

	type waitFor struct{ k string; target uint64 }
	toWait := make([]waitFor, 0, len(keys))
	runnable := make([]string, 0, len(keys))

	// Decide targets and pick runnable keys.
	for _, k := range keys {
		cur, _ := m.version.Get(k)
		if m.inProg.SetIfAbsent(k, struct{}{}) {
			runnable = append(runnable, k)
		} else {
			m.pending.Set(k, struct{}{})
		}
		if wait {
			toWait = append(toWait, waitFor{k: k, target: cur + 1})
		}
	}

	if len(runnable) > 0 {
		go m.runBatch(runnable)
	}

	if wait {
		for _, w := range toWait {
			m.WaitForAtLeast(w.k, w.target)
		}
	}
	return nil
}

// TriggerAll recomputes ALL known keys. If wait==true, waits until each key
// publishes a strictly newer version than at call time.
func (m *MaterializedView[V]) TriggerAll(wait bool) error {
	keys := m.allKeys()
	if len(keys) == 0 {
		return nil
	}

	type waitFor struct{ k string; target uint64 }
	toWait := make([]waitFor, 0, len(keys))
	if wait {
		for _, k := range keys {
			cur, _ := m.version.Get(k)
			toWait = append(toWait, waitFor{k: k, target: cur + 1})
		}
	}
	if err := m.Trigger(keys, false); err != nil {
		return err
	}
	if wait {
		for _, w := range toWait {
			m.WaitForAtLeast(w.k, w.target)
		}
	}
	return nil
}

func (m *MaterializedView[V]) TriggerAndWait(keys []string) error { return m.Trigger(keys, true) }
func (m *MaterializedView[V]) TriggerAllAndWait() error           { return m.TriggerAll(true) }

// runBatch executes recompute(keys) and publishes results.
// We hold no locks while computing; publish uses a tiny critical section only to
// Broadcast so Waiters don’t miss it.
func (m *MaterializedView[V]) runBatch(keys []string) {
	// Compute without locks
	out, err := m.recompute(keys)

	// Mark batch done + publish under a short critical section (for cond.Broadcast).
	m.mu.Lock()
	defer m.mu.Unlock()

	// Mark these keys as no longer in progress
	for _, k := range keys {
		m.inProg.Remove(k)
	}

	// Publish results and bump per-key versions
	if err == nil && out != nil {
		for k, v := range out {
			m.val.Set(k, v)
			cur, _ := m.version.Get(k)
			m.version.Set(k, cur+1)
		}
	}
	// Wake any waiters (they read version via cmap safely).
	m.cond.Broadcast()

	// If keys were invalidated again while we were running, collapse to one follow-up batch.
	var rerun []string
	for _, k := range keys {
		if _, ok := m.pending.Pop(k); ok { // Pop=> remove & tell if existed
			if m.inProg.SetIfAbsent(k, struct{}{}) {
				rerun = append(rerun, k)
			}
		}
	}
	if len(rerun) > 0 {
		go m.runBatch(rerun)
	}
}
