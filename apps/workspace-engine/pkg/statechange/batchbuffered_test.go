package statechange

import (
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestBatchBufferedChangeSet_Basic(t *testing.T) {
	inner := NewChangeSet[TestEntity]()

	var batches [][]StateChange[TestEntity]
	var mu sync.Mutex

	processFunc := func(changes []StateChange[TestEntity]) error {
		mu.Lock()
		defer mu.Unlock()
		batches = append(batches, changes)
		return nil
	}

	bcs := NewBatchBufferedChangeSet(inner, processFunc,
		WithBatchSize[TestEntity](10),
		WithFlushInterval[TestEntity](50*time.Millisecond),
	)

	// Record 5 changes (less than batch size, will flush on interval)
	for i := 0; i < 5; i++ {
		bcs.RecordUpsert(TestEntity{ID: string(rune('A' + i)), Name: "Test"})
	}

	// Wait for flush interval
	time.Sleep(100 * time.Millisecond)
	bcs.Close()

	mu.Lock()
	defer mu.Unlock()

	// Should have received one batch with 5 changes
	assert.GreaterOrEqual(t, len(batches), 1)
	totalChanges := 0
	for _, batch := range batches {
		totalChanges += len(batch)
	}
	assert.Equal(t, 5, totalChanges)
}

func TestBatchBufferedChangeSet_Deduplication(t *testing.T) {
	inner := NewChangeSet[TestEntity]()

	var processedBatches [][]StateChange[TestEntity]
	var mu sync.Mutex

	processFunc := func(changes []StateChange[TestEntity]) error {
		mu.Lock()
		defer mu.Unlock()
		processedBatches = append(processedBatches, changes)
		return nil
	}

	bcs := NewBatchBufferedChangeSet(inner, processFunc,
		WithKeyFunc(func(e TestEntity) string { return e.ID }),
		WithBatchSize[TestEntity](100),
		WithFlushInterval[TestEntity](50*time.Millisecond),
	)

	// Record multiple updates to the same entity
	bcs.RecordUpsert(TestEntity{ID: "1", Name: "First"})
	bcs.RecordUpsert(TestEntity{ID: "1", Name: "Second"})
	bcs.RecordUpsert(TestEntity{ID: "1", Name: "Third"})
	bcs.RecordUpsert(TestEntity{ID: "1", Name: "Final"})

	// Also record a different entity
	bcs.RecordUpsert(TestEntity{ID: "2", Name: "Other"})

	// Wait for flush
	time.Sleep(100 * time.Millisecond)
	bcs.Close()

	mu.Lock()
	defer mu.Unlock()

	// Should have deduplicated to 2 entities (ID=1 and ID=2)
	totalChanges := 0
	for _, batch := range processedBatches {
		totalChanges += len(batch)
	}
	assert.Equal(t, 2, totalChanges)

	// Find the entity with ID=1 and verify it has the final value
	for _, batch := range processedBatches {
		for _, change := range batch {
			if change.Entity.ID == "1" {
				assert.Equal(t, "Final", change.Entity.Name)
			}
		}
	}
}

func TestBatchBufferedChangeSet_BatchSizeFlush(t *testing.T) {
	inner := NewChangeSet[TestEntity]()

	var batchCount int
	var mu sync.Mutex

	processFunc := func(changes []StateChange[TestEntity]) error {
		mu.Lock()
		defer mu.Unlock()
		batchCount++
		return nil
	}

	bcs := NewBatchBufferedChangeSet(inner, processFunc,
		WithKeyFunc(func(e TestEntity) string { return e.ID }),
		WithBatchSize[TestEntity](5),
		WithFlushInterval[TestEntity](10*time.Second), // Long interval, won't trigger
	)

	// Record 12 unique entities (should trigger 2 batch flushes at size 5)
	for i := 0; i < 12; i++ {
		bcs.RecordUpsert(TestEntity{ID: string(rune('A' + i)), Name: "Test"})
	}

	// Give time for processing
	time.Sleep(50 * time.Millisecond)
	bcs.Close()

	mu.Lock()
	defer mu.Unlock()

	// Should have at least 2 batches (5 + 5) + final flush (2)
	assert.GreaterOrEqual(t, batchCount, 2)
}

func TestBatchBufferedChangeSet_DeleteOverwritesUpsert(t *testing.T) {
	inner := NewChangeSet[TestEntity]()

	var processedBatches [][]StateChange[TestEntity]
	var mu sync.Mutex

	processFunc := func(changes []StateChange[TestEntity]) error {
		mu.Lock()
		defer mu.Unlock()
		processedBatches = append(processedBatches, changes)
		return nil
	}

	bcs := NewBatchBufferedChangeSet(inner, processFunc,
		WithKeyFunc(func(e TestEntity) string { return e.ID }),
		WithBatchSize[TestEntity](100),
		WithFlushInterval[TestEntity](50*time.Millisecond),
	)

	// Upsert then delete same entity
	bcs.RecordUpsert(TestEntity{ID: "1", Name: "Created"})
	bcs.RecordDelete(TestEntity{ID: "1", Name: "Deleted"})

	time.Sleep(100 * time.Millisecond)
	bcs.Close()

	mu.Lock()
	defer mu.Unlock()

	// Should only have the delete
	assert.Equal(t, 1, len(processedBatches))
	assert.Equal(t, 1, len(processedBatches[0]))
	assert.Equal(t, StateChangeDelete, processedBatches[0][0].Type)
}

func TestBatchBufferedChangeSet_PauseResume(t *testing.T) {
	inner := NewChangeSet[TestEntity]()

	var processedBatches [][]StateChange[TestEntity]
	var mu sync.Mutex

	processFunc := func(changes []StateChange[TestEntity]) error {
		mu.Lock()
		defer mu.Unlock()
		processedBatches = append(processedBatches, changes)
		return nil
	}

	bcs := NewBatchBufferedChangeSet(inner, processFunc,
		WithKeyFunc(func(e TestEntity) string { return e.ID }),
		WithBatchSize[TestEntity](100),
		WithFlushInterval[TestEntity](50*time.Millisecond),
	)

	// Record while running
	bcs.RecordUpsert(TestEntity{ID: "1", Name: "First"})

	// Pause and record more
	bcs.Pause()
	bcs.RecordUpsert(TestEntity{ID: "2", Name: "Paused"})
	bcs.RecordUpsert(TestEntity{ID: "3", Name: "Paused"})

	// Resume and record
	bcs.Resume()
	bcs.RecordUpsert(TestEntity{ID: "4", Name: "Resumed"})

	time.Sleep(100 * time.Millisecond)
	bcs.Close()

	mu.Lock()
	defer mu.Unlock()

	// Count total processed
	totalProcessed := 0
	for _, batch := range processedBatches {
		totalProcessed += len(batch)
	}

	// Should only have processed 2 (1 and 4, not 2 and 3 which were paused)
	assert.Equal(t, 2, totalProcessed)
}

func TestBatchBufferedChangeSet_Flush(t *testing.T) {
	inner := NewChangeSet[TestEntity]()

	var processedBatches [][]StateChange[TestEntity]
	var mu sync.Mutex

	processFunc := func(changes []StateChange[TestEntity]) error {
		mu.Lock()
		defer mu.Unlock()
		processedBatches = append(processedBatches, changes)
		return nil
	}

	bcs := NewBatchBufferedChangeSet(inner, processFunc,
		WithBatchSize[TestEntity](100),                // Large batch size
		WithFlushInterval[TestEntity](10*time.Second), // Long interval
	)

	// Record some changes
	bcs.RecordUpsert(TestEntity{ID: "1", Name: "First"})
	bcs.RecordUpsert(TestEntity{ID: "2", Name: "Second"})
	bcs.RecordUpsert(TestEntity{ID: "3", Name: "Third"})

	// Allow goroutine to consume from buffer channel
	time.Sleep(10 * time.Millisecond)

	// Force flush - should process immediately without waiting
	bcs.Flush()

	mu.Lock()
	batchCount := len(processedBatches)
	totalProcessed := 0
	for _, batch := range processedBatches {
		totalProcessed += len(batch)
	}
	mu.Unlock()

	// Should have processed all 3 immediately
	assert.Equal(t, 1, batchCount)
	assert.Equal(t, 3, totalProcessed)

	// Record more and flush again
	bcs.RecordUpsert(TestEntity{ID: "4", Name: "Fourth"})
	time.Sleep(10 * time.Millisecond)
	bcs.Flush()

	mu.Lock()
	batchCount = len(processedBatches)
	mu.Unlock()

	assert.Equal(t, 2, batchCount)

	bcs.Close()
}

func TestBatchBufferedChangeSet_FlushEmpty(t *testing.T) {
	inner := NewChangeSet[TestEntity]()

	var batchCount int
	var mu sync.Mutex

	processFunc := func(changes []StateChange[TestEntity]) error {
		mu.Lock()
		defer mu.Unlock()
		batchCount++
		return nil
	}

	bcs := NewBatchBufferedChangeSet(inner, processFunc)

	// Flush with no pending changes should not call process
	bcs.Flush()

	mu.Lock()
	count := batchCount
	mu.Unlock()

	assert.Equal(t, 0, count)

	bcs.Close()
}

func TestBatchBufferedChangeSet_NoDeduplication(t *testing.T) {
	inner := NewChangeSet[TestEntity]()

	var processedBatches [][]StateChange[TestEntity]
	var mu sync.Mutex

	processFunc := func(changes []StateChange[TestEntity]) error {
		mu.Lock()
		defer mu.Unlock()
		processedBatches = append(processedBatches, changes)
		return nil
	}

	// No WithKeyFunc - no deduplication
	bcs := NewBatchBufferedChangeSet(inner, processFunc,
		WithBatchSize[TestEntity](100),
		WithFlushInterval[TestEntity](50*time.Millisecond),
	)

	// Record multiple updates to the same entity
	bcs.RecordUpsert(TestEntity{ID: "1", Name: "First"})
	bcs.RecordUpsert(TestEntity{ID: "1", Name: "Second"})
	bcs.RecordUpsert(TestEntity{ID: "1", Name: "Third"})
	bcs.RecordUpsert(TestEntity{ID: "1", Name: "Fourth"})

	time.Sleep(100 * time.Millisecond)
	bcs.Close()

	mu.Lock()
	defer mu.Unlock()

	// Without deduplication, all 4 changes should be processed
	totalChanges := 0
	for _, batch := range processedBatches {
		totalChanges += len(batch)
	}
	assert.Equal(t, 4, totalChanges)

	// Verify order is preserved
	allChanges := make([]StateChange[TestEntity], 0)
	for _, batch := range processedBatches {
		allChanges = append(allChanges, batch...)
	}
	assert.Equal(t, "First", allChanges[0].Entity.Name)
	assert.Equal(t, "Second", allChanges[1].Entity.Name)
	assert.Equal(t, "Third", allChanges[2].Entity.Name)
	assert.Equal(t, "Fourth", allChanges[3].Entity.Name)
}

func TestBatchBufferedChangeSet_Ignore(t *testing.T) {
	inner := NewChangeSet[TestEntity]()

	processFunc := func(changes []StateChange[TestEntity]) error {
		return nil
	}

	bcs := NewBatchBufferedChangeSet(inner, processFunc,
		WithFlushInterval[TestEntity](50*time.Millisecond),
	)

	// Initially not ignored
	assert.False(t, bcs.IsIgnored())

	// Record first change
	bcs.RecordUpsert(TestEntity{ID: "1", Name: "First"})

	// Ignore via delegation to inner
	bcs.Ignore()
	assert.True(t, bcs.IsIgnored())

	// These should be ignored by inner
	bcs.RecordUpsert(TestEntity{ID: "2", Name: "Ignored"})
	bcs.RecordDelete(TestEntity{ID: "3", Name: "Ignored"})

	// Unignore and record more
	bcs.Unignore()
	assert.False(t, bcs.IsIgnored())

	bcs.RecordUpsert(TestEntity{ID: "4", Name: "Fourth"})

	bcs.Close()

	// Inner should only have 1 and 4 (2 and 3 were ignored)
	assert.Len(t, inner.Changes(), 2)
	assert.Equal(t, "1", inner.Changes()[0].Entity.ID)
	assert.Equal(t, "4", inner.Changes()[1].Entity.ID)
}

func TestBatchBufferedChangeSet_IsPaused(t *testing.T) {
	inner := NewChangeSet[TestEntity]()

	processFunc := func(changes []StateChange[TestEntity]) error {
		return nil
	}

	bcs := NewBatchBufferedChangeSet(inner, processFunc)

	// Initially not paused
	assert.False(t, bcs.IsPaused())

	bcs.Pause()
	assert.True(t, bcs.IsPaused())

	bcs.Resume()
	assert.False(t, bcs.IsPaused())

	bcs.Close()
}

func TestBatchBufferedChangeSet_WithBatchBuffer(t *testing.T) {
	inner := NewChangeSet[TestEntity]()

	processFunc := func(changes []StateChange[TestEntity]) error {
		return nil
	}

	// Test that WithBatchBuffer option is applied
	bcs := NewBatchBufferedChangeSet(inner, processFunc,
		WithBatchBuffer[TestEntity](5000),
		WithFlushInterval[TestEntity](50*time.Millisecond),
	)

	// Record changes to verify it works
	bcs.RecordUpsert(TestEntity{ID: "1", Name: "Test"})

	bcs.Close()

	assert.Len(t, inner.Changes(), 1)
}

func TestBatchBufferedChangeSet_WithBatchOnError(t *testing.T) {
	inner := NewChangeSet[TestEntity]()

	var errors []error
	var errorMu sync.Mutex

	processFunc := func(changes []StateChange[TestEntity]) error {
		return assert.AnError
	}

	bcs := NewBatchBufferedChangeSet(inner, processFunc,
		WithBatchOnError[TestEntity](func(err error) {
			errorMu.Lock()
			defer errorMu.Unlock()
			errors = append(errors, err)
		}),
		WithFlushInterval[TestEntity](50*time.Millisecond),
	)

	bcs.RecordUpsert(TestEntity{ID: "1", Name: "Test"})

	time.Sleep(100 * time.Millisecond)
	bcs.Close()

	errorMu.Lock()
	defer errorMu.Unlock()

	// Error handler should have been called
	assert.GreaterOrEqual(t, len(errors), 1)
}
