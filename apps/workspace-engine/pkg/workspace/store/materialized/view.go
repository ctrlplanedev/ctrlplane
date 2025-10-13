package materialized

import (
	"context"
	"errors"
	"sync"
)

// RecomputeFunc recomputes the materialized value.
type RecomputeFunc[V any] func(ctx context.Context) (V, error)

// UpdateFunc applies an incremental update to the current value.
// Receives the current value and returns the updated value.
type UpdateFunc[V any] func(V) (V, error)

// MaterializedView caches a single computed value.
// Similar to exec.Cmd, it provides Start/Wait/Run semantics for recomputation.
// Multiple recompute requests while one is running coalesce into a single re-run.
type MaterializedView[V any] struct {
	mu      sync.RWMutex
	val     V
	inProg  bool
	pending bool       // true if another recompute was requested while inProg
	done    chan error // closed when computation completes

	recompute RecomputeFunc[V]
}

// Option is a functional option for configuring a MaterializedView.
type Option[V any] func(*MaterializedView[V])

// New creates a new materialized view with the given recompute function.
// Optional configuration can be provided via Option functions.
func New[V any](rf RecomputeFunc[V], opts ...Option[V]) *MaterializedView[V] {
	mv := &MaterializedView[V]{
		recompute: rf,
		mu:        sync.RWMutex{},
	}

	// Apply options
	for _, opt := range opts {
		opt(mv)
	}

	_ = mv.StartRecompute(context.Background())

	return mv
}

// Get returns the current cached value.
func (m *MaterializedView[V]) Get() V {
	_ = m.WaitIfRunning()
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.val
}

var ErrAlreadyStarted = errors.New("recompute already in progress")

func IsAlreadyStarted(err error) bool {
	return errors.Is(err, ErrAlreadyStarted)
}

// StartRecompute begins recomputation asynchronously.
// Returns ErrAlreadyStarted if a computation is already in progress.
// If already in progress, marks that a re-run is needed after completion.
func (m *MaterializedView[V]) StartRecompute(ctx context.Context) error {
	m.mu.Lock()

	if m.inProg {
		// Mark that we need to re-run after current completes
		m.pending = true
		m.mu.Unlock()
		return ErrAlreadyStarted
	}

	m.inProg = true
	m.done = make(chan error, 1)
	m.mu.Unlock()

	go m.runCompute(ctx)
	return nil
}

// WaitRecompute waits for the recomputation started by StartRecompute to complete.
// Returns an error if no computation is in progress.
func (m *MaterializedView[V]) WaitRecompute() error {
	m.mu.RLock()
	done := m.done
	m.mu.RUnlock()

	if done == nil {
		return errors.New("no computation in progress")
	}

	return <-done
}

// WaitIfRunning waits for any in-progress computation to complete.
// If no computation is running, returns immediately without error.
func (m *MaterializedView[V]) WaitIfRunning() error {
	m.mu.RLock()
	done := m.done
	m.mu.RUnlock()

	if done == nil {
		return nil
	}

	return <-done
}

// RunRecompute recomputes the value synchronously (equivalent to StartRecompute + WaitRecompute).
// If a computation is already in progress, waits for it to complete.
func (m *MaterializedView[V]) RunRecompute(ctx context.Context) error {
	if err := m.StartRecompute(ctx); err != nil {
		// If already in progress, wait for it
		if errors.Is(err, ErrAlreadyStarted) {
			return m.WaitRecompute()
		}
		return err
	}
	return m.WaitRecompute()
}

// ApplyUpdate applies an incremental update to the cached value without full recomputation.
// If a full recompute is in progress, marks pending to trigger a full recompute after completion.
// This is useful for incremental updates that are cheaper than full recomputation.
// Returns the updated value and any error from the update function.
// func (m *MaterializedView[V]) ApplyUpdate(updateFn UpdateFunc[V]) (V, error) {
// 	m.mu.Lock()

// 	// If a full recompute is in progress, mark pending and return current value
// 	// The full recompute will capture this update when it completes
// 	if m.inProg {
// 		m.pending = true
// 		val := m.val
// 		m.mu.Unlock()
// 		return val, nil
// 	}

// 	// Apply the update function to the current value
// 	newVal, err := updateFn(m.val)
// 	if err != nil {
// 		m.mu.Unlock()
// 		var zero V
// 		return zero, err
// 	}

// 	// Update the cached value
// 	m.val = newVal
// 	m.mu.Unlock()

// 	return newVal, nil
// }

// runCompute executes the recompute function and publishes the result.
// If pending requests came in while running, keeps recomputing until no more pending work.
func (m *MaterializedView[V]) runCompute(ctx context.Context) {
	var lastErr error

	// Keep recomputing while there's pending work
	for {
		// Compute without locks
		val, err := m.recompute(ctx)
		lastErr = err

		m.mu.Lock()

		// Publish result on success
		if err == nil {
			m.val = val
		}

		// Check if more work came in while we were computing
		if m.pending {
			m.pending = false
			m.mu.Unlock()
			// Loop again to recompute
			continue
		}

		// No more pending work - mark complete
		m.inProg = false
		done := m.done
		m.done = nil
		m.mu.Unlock()

		// Send result to all waiters
		done <- lastErr
		close(done)
		return
	}
}
