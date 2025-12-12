package statechange

import (
	"fmt"
	"sync"
	"time"
)

// KeyFunc extracts a unique key from an entity for deduplication.
type KeyFunc[T any] func(entity T) string

// BatchProcessFunc is called with a batch of deduplicated changes.
type BatchProcessFunc[T any] func(changes []StateChange[T]) error

// BatchBufferedChangeSet collects changes into batches, deduplicates them,
// and processes them asynchronously. This reduces write pressure and ensures
// only the latest state per entity is processed.
type BatchBufferedChangeSet[T any] struct {
	inner         ChangeSet[T]
	keyFunc       KeyFunc[T]
	process       BatchProcessFunc[T]
	buffer        chan StateChange[T]
	flushCh       chan chan struct{} // sends done channel to signal flush complete
	done          chan struct{}
	wg            sync.WaitGroup
	onError       func(error)
	bufferSz      int
	batchSize     int
	flushInterval time.Duration
	paused        bool
	pauseMu       sync.RWMutex
}

// BatchBufferedOption configures a BatchBufferedChangeSet.
type BatchBufferedOption[T any] func(*BatchBufferedChangeSet[T])

// WithBatchBuffer sets the channel buffer size. Default is 1000.
func WithBatchBuffer[T any](size int) BatchBufferedOption[T] {
	return func(b *BatchBufferedChangeSet[T]) {
		b.bufferSz = size
	}
}

// WithBatchSize sets the max batch size before flush. Default is 100.
func WithBatchSize[T any](size int) BatchBufferedOption[T] {
	return func(b *BatchBufferedChangeSet[T]) {
		b.batchSize = size
	}
}

// WithFlushInterval sets the max time between flushes. Default is 1 second.
func WithFlushInterval[T any](interval time.Duration) BatchBufferedOption[T] {
	return func(b *BatchBufferedChangeSet[T]) {
		b.flushInterval = interval
	}
}

// WithBatchOnError sets a callback for batch process errors.
func WithBatchOnError[T any](handler func(error)) BatchBufferedOption[T] {
	return func(b *BatchBufferedChangeSet[T]) {
		b.onError = handler
	}
}

// WithKeyFunc sets a key function for deduplication.
// If not set, no deduplication occurs and all changes are processed.
func WithKeyFunc[T any](keyFunc KeyFunc[T]) BatchBufferedOption[T] {
	return func(b *BatchBufferedChangeSet[T]) {
		b.keyFunc = keyFunc
	}
}

// NewBatchBufferedChangeSet creates a ChangeSet that batches changes
// and processes them asynchronously.
//
// If a keyFunc is provided via WithKeyFunc, changes are deduplicated by key
// and only the latest change per key is kept. Without a keyFunc, all changes
// are processed in order.
//
// Batches are flushed when they reach batchSize or after flushInterval.
func NewBatchBufferedChangeSet[T any](
	inner ChangeSet[T],
	process BatchProcessFunc[T],
	opts ...BatchBufferedOption[T],
) *BatchBufferedChangeSet[T] {
	b := &BatchBufferedChangeSet[T]{
		inner:         inner,
		keyFunc:       nil, // No deduplication by default
		process:       process,
		bufferSz:      1000,
		batchSize:     100,
		flushInterval: time.Second,
		onError:       func(error) {},
		done:          make(chan struct{}),
		flushCh:       make(chan chan struct{}),
	}

	for _, opt := range opts {
		opt(b)
	}

	b.buffer = make(chan StateChange[T], b.bufferSz)
	b.wg.Add(1)
	go b.run()

	return b
}

func (b *BatchBufferedChangeSet[T]) run() {
	defer b.wg.Done()

	ticker := time.NewTicker(b.flushInterval)
	defer ticker.Stop()

	// Use map for deduplication if keyFunc is set, otherwise use slice
	var pendingMap map[string]StateChange[T]
	var pendingSlice []StateChange[T]

	if b.keyFunc != nil {
		pendingMap = make(map[string]StateChange[T])
	} else {
		pendingSlice = make([]StateChange[T], 0, b.batchSize)
	}

	pendingCount := func() int {
		if b.keyFunc != nil {
			return len(pendingMap)
		}
		return len(pendingSlice)
	}

	addChange := func(change StateChange[T]) {
		if b.keyFunc != nil {
			key := b.keyFunc(change.Entity)
			pendingMap[key] = change
		} else {
			pendingSlice = append(pendingSlice, change)
		}
	}

	flush := func() {
		if pendingCount() == 0 {
			return
		}

		var batch []StateChange[T]
		if b.keyFunc != nil {
			batch = make([]StateChange[T], 0, len(pendingMap))
			for _, change := range pendingMap {
				batch = append(batch, change)
			}
			pendingMap = make(map[string]StateChange[T])
		} else {
			batch = pendingSlice
			pendingSlice = make([]StateChange[T], 0, b.batchSize)
		}

		if err := b.process(batch); err != nil {
			b.onError(err)
		}
	}

	for {
		select {
		case change := <-b.buffer:
			addChange(change)

			if pendingCount() >= b.batchSize {
				flush()
			}

		case <-ticker.C:
			flush()

		case doneCh := <-b.flushCh:
			// Force flush requested
			flush()
			close(doneCh) // Signal completion

		case <-b.done:
			// Drain remaining changes from buffer
			for {
				select {
				case change := <-b.buffer:
					addChange(change)
				default:
					// Buffer empty, flush remaining
					flush()
					return
				}
			}
		}
	}
}

// Pause temporarily disables processing.
func (b *BatchBufferedChangeSet[T]) Pause() {
	b.pauseMu.Lock()
	defer b.pauseMu.Unlock()
	b.paused = true
}

// Resume re-enables processing.
func (b *BatchBufferedChangeSet[T]) Resume() {
	b.pauseMu.Lock()
	defer b.pauseMu.Unlock()
	b.paused = false
}

// IsPaused returns whether processing is currently paused.
func (b *BatchBufferedChangeSet[T]) IsPaused() bool {
	b.pauseMu.RLock()
	defer b.pauseMu.RUnlock()
	return b.paused
}

func (b *BatchBufferedChangeSet[T]) send(change StateChange[T]) {
	b.pauseMu.RLock()
	paused := b.paused
	b.pauseMu.RUnlock()

	if paused {
		return
	}

	select {
	case b.buffer <- change:
	default:
		b.onError(fmt.Errorf("batch buffer full, dropping change"))
	}
}

// RecordUpsert records an upsert and queues it for batch processing.
func (b *BatchBufferedChangeSet[T]) RecordUpsert(entity T) {
	b.inner.RecordUpsert(entity)

	b.send(StateChange[T]{
		Type:      StateChangeUpsert,
		Entity:    entity,
		Timestamp: time.Now(),
	})
}

// RecordDelete records a delete and queues it for batch processing.
func (b *BatchBufferedChangeSet[T]) RecordDelete(entity T) {
	b.inner.RecordDelete(entity)

	b.send(StateChange[T]{
		Type:      StateChangeDelete,
		Entity:    entity,
		Timestamp: time.Now(),
	})
}

// Flush forces an immediate flush of pending changes and waits for completion.
func (b *BatchBufferedChangeSet[T]) Flush() {
	doneCh := make(chan struct{})
	select {
	case b.flushCh <- doneCh:
		<-doneCh // Wait for flush to complete
	case <-b.done:
		// Already closed
	}
}

// Close stops the background processor and flushes remaining changes.
func (b *BatchBufferedChangeSet[T]) Close() {
	close(b.done)
	b.wg.Wait()
}

// Ignore delegates to the inner ChangeSet.
func (b *BatchBufferedChangeSet[T]) Ignore() {
	b.inner.Ignore()
}

// Unignore delegates to the inner ChangeSet.
func (b *BatchBufferedChangeSet[T]) Unignore() {
	b.inner.Unignore()
}

// IsIgnored delegates to the inner ChangeSet.
func (b *BatchBufferedChangeSet[T]) IsIgnored() bool {
	return b.inner.IsIgnored()
}

var _ ChangeSet[any] = (*BatchBufferedChangeSet[any])(nil)
