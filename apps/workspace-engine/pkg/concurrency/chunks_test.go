package concurrency

import (
	"errors"
	"fmt"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

func TestProcessInChunks_EmptySlice(t *testing.T) {
	result, err := ProcessInChunks(
		[]int{},
		2,
		4,
		func(item int) (int, error) {
			return item * 2, nil
		},
	)

	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	if len(result) != 0 {
		t.Fatalf("expected empty result, got %v", result)
	}
}

func TestProcessInChunks_SingleItem(t *testing.T) {
	result, err := ProcessInChunks(
		[]int{5},
		2,
		4,
		func(item int) (int, error) {
			return item * 2, nil
		},
	)

	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	expected := []int{10}
	if len(result) != len(expected) {
		t.Fatalf("expected length %d, got %d", len(expected), len(result))
	}

	if result[0] != expected[0] {
		t.Fatalf("expected %v, got %v", expected, result)
	}
}

func TestProcessInChunks_MultipleItemsSmallChunks(t *testing.T) {
	input := []int{1, 2, 3, 4, 5, 6, 7, 8, 9, 10}
	result, err := ProcessInChunks(
		input,
		3,
		2, // Only 2 concurrent goroutines
		func(item int) (int, error) {
			return item * 2, nil
		},
	)

	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	expected := []int{2, 4, 6, 8, 10, 12, 14, 16, 18, 20}
	if len(result) != len(expected) {
		t.Fatalf("expected length %d, got %d", len(expected), len(result))
	}

	for i, v := range result {
		if v != expected[i] {
			t.Errorf("at index %d: expected %d, got %d", i, expected[i], v)
		}
	}
}

func TestProcessInChunks_ChunkSizeLargerThanSlice(t *testing.T) {
	input := []int{1, 2, 3}
	result, err := ProcessInChunks(
		input,
		10,
		4,
		func(item int) (int, error) {
			return item * 3, nil
		},
	)

	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	expected := []int{3, 6, 9}
	if len(result) != len(expected) {
		t.Fatalf("expected length %d, got %d", len(expected), len(result))
	}

	for i, v := range result {
		if v != expected[i] {
			t.Errorf("at index %d: expected %d, got %d", i, expected[i], v)
		}
	}
}

func TestProcessInChunks_ErrorInProcessing(t *testing.T) {
	input := []int{1, 2, 3, 4, 5}
	expectedErr := errors.New("processing error")
	
	result, err := ProcessInChunks(
		input,
		2,
		4,
		func(item int) (int, error) {
			if item == 3 {
				return 0, expectedErr
			}
			return item * 2, nil
		},
	)

	if err == nil {
		t.Fatalf("expected error, got nil")
	}

	if result != nil {
		t.Fatalf("expected nil result on error, got %v", result)
	}
}

func TestProcessInChunks_PreservesOrder(t *testing.T) {
	// Test that results maintain original order despite parallel processing
	input := make([]int, 100)
	for i := range input {
		input[i] = i
	}

	result, err := ProcessInChunks(
		input,
		10,
		5, // 5 concurrent goroutines
		func(item int) (int, error) {
			return item, nil
		},
	)

	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	if len(result) != len(input) {
		t.Fatalf("expected length %d, got %d", len(input), len(result))
	}

	for i, v := range result {
		if v != i {
			t.Errorf("order not preserved: at index %d expected %d, got %d", i, i, v)
		}
	}
}

func TestProcessInChunks_ChunkSizeZero(t *testing.T) {
	// When chunk size is 0, Chunk returns a single slice with all items
	input := []int{1, 2, 3, 4, 5}
	result, err := ProcessInChunks(
		input,
		0,
		4,
		func(item int) (int, error) {
			return item * 2, nil
		},
	)

	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	expected := []int{2, 4, 6, 8, 10}
	if len(result) != len(expected) {
		t.Fatalf("expected length %d, got %d", len(expected), len(result))
	}

	for i, v := range result {
		if v != expected[i] {
			t.Errorf("at index %d: expected %d, got %d", i, expected[i], v)
		}
	}
}

func TestProcessInChunks_DifferentTypes(t *testing.T) {
	// Test with string to int conversion
	input := []string{"1", "2", "3", "4"}
	result, err := ProcessInChunks(
		input,
		2,
		4,
		func(item string) (int, error) {
			var num int
			_, err := fmt.Sscanf(item, "%d", &num)
			if err != nil {
				return 0, err
			}
			return num * 10, nil
		},
	)

	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	expected := []int{10, 20, 30, 40}
	if len(result) != len(expected) {
		t.Fatalf("expected length %d, got %d", len(expected), len(result))
	}

	for i, v := range result {
		if v != expected[i] {
			t.Errorf("at index %d: expected %d, got %d", i, expected[i], v)
		}
	}
}

func TestProcessInChunks_LargeDataset(t *testing.T) {
	// Test with a larger dataset to ensure parallel processing works correctly
	size := 1000
	input := make([]int, size)
	for i := range input {
		input[i] = i
	}

	result, err := ProcessInChunks(
		input,
		50,
		10, // 10 concurrent goroutines
		func(item int) (int, error) {
			return item * 2, nil
		},
	)

	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	if len(result) != size {
		t.Fatalf("expected length %d, got %d", size, len(result))
	}

	for i, v := range result {
		expected := i * 2
		if v != expected {
			t.Errorf("at index %d: expected %d, got %d", i, expected, v)
		}
	}
}

func TestProcessInChunks_ChunkSizeOne(t *testing.T) {
	// Each item processed in its own goroutine
	input := []int{1, 2, 3, 4, 5}
	result, err := ProcessInChunks(
		input,
		1,
		3, // 3 concurrent goroutines
		func(item int) (int, error) {
			return item + 10, nil
		},
	)

	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	expected := []int{11, 12, 13, 14, 15}
	if len(result) != len(expected) {
		t.Fatalf("expected length %d, got %d", len(expected), len(result))
	}

	for i, v := range result {
		if v != expected[i] {
			t.Errorf("at index %d: expected %d, got %d", i, expected[i], v)
		}
	}
}

func TestProcessInChunks_MaxConcurrencyZero(t *testing.T) {
	// maxConcurrency of 0 should default to unbounded (number of chunks)
	input := []int{1, 2, 3, 4, 5, 6, 7, 8, 9, 10}
	result, err := ProcessInChunks(
		input,
		2,
		0, // Should default to unbounded
		func(item int) (int, error) {
			return item * 2, nil
		},
	)

	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	expected := []int{2, 4, 6, 8, 10, 12, 14, 16, 18, 20}
	if len(result) != len(expected) {
		t.Fatalf("expected length %d, got %d", len(expected), len(result))
	}

	for i, v := range result {
		if v != expected[i] {
			t.Errorf("at index %d: expected %d, got %d", i, expected[i], v)
		}
	}
}

func TestProcessInChunks_MaxConcurrencyNegative(t *testing.T) {
	// maxConcurrency < 0 should default to unbounded (number of chunks)
	input := []int{1, 2, 3, 4, 5}
	result, err := ProcessInChunks(
		input,
		2,
		-5, // Should default to unbounded
		func(item int) (int, error) {
			return item + 5, nil
		},
	)

	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	expected := []int{6, 7, 8, 9, 10}
	if len(result) != len(expected) {
		t.Fatalf("expected length %d, got %d", len(expected), len(result))
	}

	for i, v := range result {
		if v != expected[i] {
			t.Errorf("at index %d: expected %d, got %d", i, expected[i], v)
		}
	}
}

func TestProcessInChunks_ConcurrencyActuallyLimited(t *testing.T) {
	// Test that concurrency is actually limited by tracking concurrent goroutines
	var currentConcurrent int32
	var maxConcurrentObserved int32
	var mu sync.Mutex

	maxAllowed := 3
	input := make([]int, 20)
	for i := range input {
		input[i] = i
	}

	_, err := ProcessInChunks(
		input,
		1, // 1 item per chunk = 20 chunks
		maxAllowed,
		func(item int) (int, error) {
			// Increment concurrent counter
			current := atomic.AddInt32(&currentConcurrent, 1)
			
			// Track max concurrent
			mu.Lock()
			if current > maxConcurrentObserved {
				maxConcurrentObserved = current
			}
			mu.Unlock()
			
			// Simulate work
			time.Sleep(10 * time.Millisecond)
			
			// Decrement concurrent counter
			atomic.AddInt32(&currentConcurrent, -1)
			
			return item * 2, nil
		},
	)

	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	if maxConcurrentObserved > int32(maxAllowed) {
		t.Errorf("concurrency limit violated: max concurrent was %d, limit was %d", maxConcurrentObserved, maxAllowed)
	}

	if maxConcurrentObserved < 1 {
		t.Errorf("expected at least 1 concurrent goroutine, got %d", maxConcurrentObserved)
	}

	t.Logf("Max concurrent goroutines observed: %d (limit: %d)", maxConcurrentObserved, maxAllowed)
}

func TestProcessInChunks_ConcurrencyWithSleep(t *testing.T) {
	// Test that multiple goroutines run in parallel by comparing total time
	maxConcurrency := 5
	itemCount := 10
	sleepDuration := 50 * time.Millisecond
	
	input := make([]int, itemCount)
	for i := range input {
		input[i] = i
	}

	start := time.Now()
	_, err := ProcessInChunks(
		input,
		1, // 1 item per chunk
		maxConcurrency,
		func(item int) (int, error) {
			time.Sleep(sleepDuration)
			return item, nil
		},
	)
	elapsed := time.Since(start)

	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	// With 10 items and max 5 concurrent, we should have 2 batches
	// Each batch takes ~50ms, so total should be ~100ms (plus overhead)
	// If sequential, it would take ~500ms
	expectedMin := sleepDuration * time.Duration(itemCount/maxConcurrency)
	expectedMax := expectedMin + 200*time.Millisecond // Allow for overhead

	if elapsed < expectedMin {
		t.Errorf("execution too fast (%v), parallel execution may not be working", elapsed)
	}
	
	if elapsed > expectedMax {
		t.Errorf("execution too slow (%v), expected around %v", elapsed, expectedMin)
	}

	t.Logf("Execution time: %v (expected ~%v)", elapsed, expectedMin)
}

func TestProcessInChunks_StrictConcurrencyLimit(t *testing.T) {
	// More rigorous test that strictly validates concurrency never exceeds limit
	maxAllowed := 2
	input := make([]int, 10)
	for i := range input {
		input[i] = i
	}

	var mu sync.Mutex
	var concurrent int
	violations := 0

	_, err := ProcessInChunks(
		input,
		1,
		maxAllowed,
		func(item int) (int, error) {
			mu.Lock()
			concurrent++
			if concurrent > maxAllowed {
				violations++
			}
			currentLevel := concurrent
			mu.Unlock()

			// Hold the lock for a bit to ensure overlap
			time.Sleep(20 * time.Millisecond)

			mu.Lock()
			concurrent--
			mu.Unlock()

			// For debugging
			t.Logf("Item %d: concurrent level was %d", item, currentLevel)

			return item, nil
		},
	)

	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	if violations > 0 {
		t.Errorf("concurrency limit violated %d times (max allowed: %d)", violations, maxAllowed)
	}
}

func TestProcessInChunks_ErrorStopsProcessing(t *testing.T) {
	// Verify that when an error occurs, we get it back
	var processedCount int32
	expectedErr := errors.New("intentional error")

	input := make([]int, 100)
	for i := range input {
		input[i] = i
	}

	_, err := ProcessInChunks(
		input,
		10,
		5,
		func(item int) (int, error) {
			atomic.AddInt32(&processedCount, 1)
			time.Sleep(5 * time.Millisecond)
			
			if item == 25 {
				return 0, expectedErr
			}
			return item, nil
		},
	)

	if err == nil {
		t.Fatalf("expected error, got nil")
	}

	if !errors.Is(err, expectedErr) {
		t.Errorf("expected error %v, got %v", expectedErr, err)
	}

	t.Logf("Processed %d items before error", processedCount)
}

