package materialized

import (
	"errors"
	"fmt"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

// TestBasicGetAndTrigger tests basic get and trigger operations
func TestBasicGetAndTrigger(t *testing.T) {
	callCount := 0
	rf := func(keys []string) (map[string]int, error) {
		callCount++
		result := make(map[string]int)
		for _, k := range keys {
			result[k] = len(k) // simple computation: length of key
		}
		return result, nil
	}

	allKeys := func() []string { return []string{} }
	mv := New(rf, allKeys)

	// Initially empty
	val, ver := mv.Get("test")
	if val != 0 || ver != 0 {
		t.Errorf("expected zero values, got val=%d, ver=%d", val, ver)
	}

	// Trigger and wait
	err := mv.TriggerAndWait([]string{"test"})
	if err != nil {
		t.Fatalf("TriggerAndWait failed: %v", err)
	}

	val, ver = mv.Get("test")
	if val != 4 || ver != 1 {
		t.Errorf("expected val=4, ver=1, got val=%d, ver=%d", val, ver)
	}

	if callCount != 1 {
		t.Errorf("expected 1 recompute call, got %d", callCount)
	}
}

// TestMultipleKeys tests triggering multiple keys at once
func TestMultipleKeys(t *testing.T) {
	rf := func(keys []string) (map[string]int, error) {
		result := make(map[string]int)
		for _, k := range keys {
			result[k] = len(k)
		}
		return result, nil
	}

	allKeys := func() []string { return []string{} }
	mv := New(rf, allKeys)

	keys := []string{"a", "bb", "ccc", "dddd"}
	err := mv.TriggerAndWait(keys)
	if err != nil {
		t.Fatalf("TriggerAndWait failed: %v", err)
	}

	for _, k := range keys {
		val, ver := mv.Get(k)
		if val != len(k) {
			t.Errorf("key %s: expected val=%d, got %d", k, len(k), val)
		}
		if ver != 1 {
			t.Errorf("key %s: expected ver=1, got %d", k, ver)
		}
	}
}

// TestVersionIncrement tests that versions increment properly
func TestVersionIncrement(t *testing.T) {
	callCount := 0
	rf := func(keys []string) (map[string]int, error) {
		callCount++
		result := make(map[string]int)
		for _, k := range keys {
			result[k] = callCount * len(k)
		}
		return result, nil
	}

	allKeys := func() []string { return []string{} }
	mv := New(rf, allKeys)

	// First trigger
	err := mv.TriggerAndWait([]string{"test"})
	if err != nil {
		t.Fatalf("TriggerAndWait failed: %v", err)
	}

	val1, ver1 := mv.Get("test")
	if val1 != 4 || ver1 != 1 {
		t.Errorf("first trigger: expected val=4, ver=1, got val=%d, ver=%d", val1, ver1)
	}

	// Second trigger - should increment version
	err = mv.TriggerAndWait([]string{"test"})
	if err != nil {
		t.Fatalf("second TriggerAndWait failed: %v", err)
	}

	val2, ver2 := mv.Get("test")
	if val2 != 8 || ver2 != 2 {
		t.Errorf("second trigger: expected val=8, ver=2, got val=%d, ver=%d", val2, ver2)
	}
}

// TestDedupe tests that duplicate keys are deduped
func TestDedupe(t *testing.T) {
	var mu sync.Mutex
	receivedKeys := [][]string{}
	
	rf := func(keys []string) (map[string]int, error) {
		mu.Lock()
		receivedKeys = append(receivedKeys, append([]string{}, keys...))
		mu.Unlock()
		
		result := make(map[string]int)
		for _, k := range keys {
			result[k] = len(k)
		}
		return result, nil
	}

	allKeys := func() []string { return []string{} }
	mv := New(rf, allKeys)

	// Trigger with duplicates
	err := mv.TriggerAndWait([]string{"a", "b", "a", "c", "b"})
	if err != nil {
		t.Fatalf("TriggerAndWait failed: %v", err)
	}

	mu.Lock()
	defer mu.Unlock()
	
	if len(receivedKeys) != 1 {
		t.Fatalf("expected 1 batch, got %d", len(receivedKeys))
	}

	// Should have received exactly 3 unique keys
	if len(receivedKeys[0]) != 3 {
		t.Errorf("expected 3 unique keys, got %d: %v", len(receivedKeys[0]), receivedKeys[0])
	}
}

// TestWaitForAtLeast tests the waiting mechanism
func TestWaitForAtLeast(t *testing.T) {
	rf := func(keys []string) (map[string]int, error) {
		time.Sleep(50 * time.Millisecond)
		result := make(map[string]int)
		for _, k := range keys {
			result[k] = len(k)
		}
		return result, nil
	}

	allKeys := func() []string { return []string{} }
	mv := New(rf, allKeys)

	// Start async trigger
	go func() {
		mv.Trigger([]string{"test"}, false)
	}()

	// Wait for version 1 with timeout
	done := make(chan struct{})
	go func() {
		mv.WaitForAtLeast("test", 1)
		close(done)
	}()

	select {
	case <-done:
		// Success
	case <-time.After(200 * time.Millisecond):
		t.Fatal("WaitForAtLeast timed out")
	}

	_, ver := mv.Get("test")
	if ver < 1 {
		t.Errorf("expected version >= 1, got %d", ver)
	}
}

// TestBatchingAndCoalescing tests that concurrent triggers are batched and coalesced
func TestBatchingAndCoalescing(t *testing.T) {
	var mu sync.Mutex
	batches := [][]string{}
	
	rf := func(keys []string) (map[string]int, error) {
		mu.Lock()
		batches = append(batches, append([]string{}, keys...))
		mu.Unlock()
		
		time.Sleep(100 * time.Millisecond) // simulate slow computation
		
		result := make(map[string]int)
		for _, k := range keys {
			result[k] = len(k)
		}
		return result, nil
	}

	allKeys := func() []string { return []string{} }
	mv := New(rf, allKeys)

	// Trigger same key multiple times while computation is in progress
	var wg sync.WaitGroup
	for i := 0; i < 5; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			mv.Trigger([]string{"test"}, false)
		}()
		time.Sleep(10 * time.Millisecond) // stagger the triggers
	}

	wg.Wait()
	time.Sleep(300 * time.Millisecond) // wait for all batches to complete

	mu.Lock()
	defer mu.Unlock()

	// Should have 2 batches: first one, and one coalesced rerun
	if len(batches) != 2 {
		t.Errorf("expected 2 batches (original + coalesced), got %d: %v", len(batches), batches)
	}

	// Both batches should have "test"
	for i, batch := range batches {
		if len(batch) != 1 || batch[0] != "test" {
			t.Errorf("batch %d: expected [test], got %v", i, batch)
		}
	}
}

// TestConcurrentDifferentKeys tests concurrent triggers of different keys
func TestConcurrentDifferentKeys(t *testing.T) {
	var callCount int32
	
	rf := func(keys []string) (map[string]int, error) {
		atomic.AddInt32(&callCount, 1)
		result := make(map[string]int)
		for _, k := range keys {
			result[k] = len(k)
		}
		return result, nil
	}

	allKeys := func() []string { return []string{} }
	mv := New(rf, allKeys)

	// Trigger different keys concurrently
	var wg sync.WaitGroup
	keys := []string{"a", "b", "c", "d", "e"}
	
	for _, k := range keys {
		wg.Add(1)
		k := k // capture
		go func() {
			defer wg.Done()
			err := mv.TriggerAndWait([]string{k})
			if err != nil {
				t.Errorf("TriggerAndWait(%s) failed: %v", k, err)
			}
		}()
	}

	wg.Wait()

	// All keys should be computed
	for _, k := range keys {
		val, ver := mv.Get(k)
		if val != len(k) {
			t.Errorf("key %s: expected val=%d, got %d", k, len(k), val)
		}
		if ver != 1 {
			t.Errorf("key %s: expected ver=1, got %d", k, ver)
		}
	}

	// Should have made multiple calls (keys processed in batches/parallel)
	count := atomic.LoadInt32(&callCount)
	if count < 1 {
		t.Errorf("expected at least 1 call, got %d", count)
	}
}

// TestRecomputeError tests error handling in recompute function
func TestRecomputeError(t *testing.T) {
	var shouldError int32 = 1 // use atomic
	
	rf := func(keys []string) (map[string]int, error) {
		if atomic.LoadInt32(&shouldError) == 1 {
			return nil, errors.New("computation failed")
		}
		result := make(map[string]int)
		for _, k := range keys {
			result[k] = len(k)
		}
		return result, nil
	}

	allKeys := func() []string { return []string{} }
	mv := New(rf, allKeys)

	// First trigger will error - fire and forget
	mv.Trigger([]string{"test"}, false)
	time.Sleep(50 * time.Millisecond)

	// Value should not be updated
	val, ver := mv.Get("test")
	if val != 0 || ver != 0 {
		t.Errorf("after error: expected val=0, ver=0, got val=%d, ver=%d", val, ver)
	}

	// Now allow success
	atomic.StoreInt32(&shouldError, 0)
	err := mv.TriggerAndWait([]string{"test"})
	if err != nil {
		t.Fatalf("TriggerAndWait failed: %v", err)
	}

	val, ver = mv.Get("test")
	if val != 4 || ver != 1 {
		t.Errorf("after success: expected val=4, ver=1, got val=%d, ver=%d", val, ver)
	}
}

// TestPartialResults tests that only returned keys are updated
func TestPartialResults(t *testing.T) {
	rf := func(keys []string) (map[string]int, error) {
		result := make(map[string]int)
		// Only return results for keys starting with 'a'
		for _, k := range keys {
			if len(k) > 0 && k[0] == 'a' {
				result[k] = len(k)
			}
		}
		return result, nil
	}

	allKeys := func() []string { return []string{} }
	mv := New(rf, allKeys)

	// Note: We can't use TriggerAndWait with keys that won't be returned
	// because the wait will hang (banana's version never increments).
	// Instead, we trigger and wait manually for the keys we expect.
	
	// Get initial versions
	_, initialApple := mv.Get("apple")
	_, initialApricot := mv.Get("apricot")
	
	// Trigger all keys (won't wait)
	mv.Trigger([]string{"apple", "banana", "apricot"}, false)
	
	// Wait for the keys we expect to be updated
	mv.WaitForAtLeast("apple", initialApple+1)
	mv.WaitForAtLeast("apricot", initialApricot+1)
	
	// Small delay to ensure processing is complete
	time.Sleep(50 * time.Millisecond)

	// Keys starting with 'a' should be updated
	val, ver := mv.Get("apple")
	if val != 5 || ver != 1 {
		t.Errorf("apple: expected val=5, ver=1, got val=%d, ver=%d", val, ver)
	}

	val, ver = mv.Get("apricot")
	if val != 7 || ver != 1 {
		t.Errorf("apricot: expected val=7, ver=1, got val=%d, ver=%d", val, ver)
	}

	// banana should not be updated
	val, ver = mv.Get("banana")
	if val != 0 || ver != 0 {
		t.Errorf("banana: expected val=0, ver=0, got val=%d, ver=%d", val, ver)
	}
}

// TestTriggerAll tests triggering all keys in the view
func TestTriggerAll(t *testing.T) {
	var callCount int32
	
	rf := func(keys []string) (map[string]int, error) {
		n := atomic.AddInt32(&callCount, 1)
		result := make(map[string]int)
		for _, k := range keys {
			result[k] = int(n) * 100
		}
		return result, nil
	}

	// Track all keys
	var mu sync.Mutex
	allKeysList := []string{}
	allKeys := func() []string {
		mu.Lock()
		defer mu.Unlock()
		result := make([]string, len(allKeysList))
		copy(result, allKeysList)
		return result
	}

	mv := New(rf, allKeys)

	// Populate with some keys
	initialKeys := []string{"a", "b", "c", "d", "e"}
	mu.Lock()
	allKeysList = append(allKeysList, initialKeys...)
	mu.Unlock()

	err := mv.TriggerAndWait(initialKeys)
	if err != nil {
		t.Fatalf("initial TriggerAndWait failed: %v", err)
	}

	// All should have value 100 (first call)
	for _, k := range initialKeys {
		val, ver := mv.Get(k)
		if val != 100 || ver != 1 {
			t.Errorf("key %s: expected val=100, ver=1, got val=%d, ver=%d", k, val, ver)
		}
	}

	// TriggerAll should recompute all of them
	err = mv.TriggerAllAndWait()
	if err != nil {
		t.Fatalf("TriggerAllAndWait failed: %v", err)
	}

	// All should have value 200 (second call) and version 2
	for _, k := range initialKeys {
		val, ver := mv.Get(k)
		if val != 200 || ver != 2 {
			t.Errorf("key %s after TriggerAll: expected val=200, ver=2, got val=%d, ver=%d", k, val, ver)
		}
	}

	totalCalls := atomic.LoadInt32(&callCount)
	if totalCalls < 2 {
		t.Errorf("expected at least 2 calls, got %d", totalCalls)
	}
}

// TestTriggerAllEmpty tests TriggerAll on empty view
func TestTriggerAllEmpty(t *testing.T) {
	var callCount int32
	
	rf := func(keys []string) (map[string]int, error) {
		atomic.AddInt32(&callCount, 1)
		return make(map[string]int), nil
	}

	allKeys := func() []string { return []string{} }
	mv := New(rf, allKeys)

	// TriggerAll on empty view should be a no-op
	err := mv.TriggerAllAndWait()
	if err != nil {
		t.Fatalf("TriggerAllAndWait on empty view failed: %v", err)
	}

	count := atomic.LoadInt32(&callCount)
	if count != 0 {
		t.Errorf("expected 0 calls on empty view, got %d", count)
	}
}

// TestConcurrentReadWrite tests concurrent reads during writes
func TestConcurrentReadWrite(t *testing.T) {
	rf := func(keys []string) (map[string]int, error) {
		time.Sleep(20 * time.Millisecond)
		result := make(map[string]int)
		for _, k := range keys {
			result[k] = len(k)
		}
		return result, nil
	}

	allKeys := func() []string { return []string{} }
	mv := New(rf, allKeys)

	// Start writes
	go func() {
		for i := 0; i < 10; i++ {
			mv.Trigger([]string{fmt.Sprintf("key%d", i)}, false)
			time.Sleep(5 * time.Millisecond)
		}
	}()

	// Concurrent reads
	var wg sync.WaitGroup
	for i := 0; i < 50; i++ {
		wg.Add(1)
		go func(n int) {
			defer wg.Done()
			for j := 0; j < 10; j++ {
				mv.Get(fmt.Sprintf("key%d", n%10))
				time.Sleep(2 * time.Millisecond)
			}
		}(i)
	}

	wg.Wait()
	// If we get here without deadlock or race, test passes
}

// TestStressCoalescing stress tests the coalescing behavior
func TestStressCoalescing(t *testing.T) {
	var mu sync.Mutex
	batches := []int{}
	
	rf := func(keys []string) (map[string]int, error) {
		mu.Lock()
		batches = append(batches, len(keys))
		mu.Unlock()
		
		time.Sleep(50 * time.Millisecond) // slow enough to trigger coalescing
		
		result := make(map[string]int)
		for _, k := range keys {
			result[k] = len(k)
		}
		return result, nil
	}

	allKeys := func() []string { return []string{} }
	mv := New(rf, allKeys)

	// Hammer same key with many triggers
	var wg sync.WaitGroup
	for i := 0; i < 100; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			mv.Trigger([]string{"test"}, false)
		}()
	}

	wg.Wait()
	time.Sleep(200 * time.Millisecond) // wait for processing

	mu.Lock()
	batchCount := len(batches)
	mu.Unlock()

	// Should have coalesced into just a few batches (definitely < 100)
	if batchCount >= 100 {
		t.Errorf("poor coalescing: expected << 100 batches, got %d", batchCount)
	}

	t.Logf("Coalesced 100 triggers into %d batches", batchCount)

	// Final version should be at least 2 (original + 1 coalesced rerun)
	_, ver := mv.Get("test")
	if ver < 2 {
		t.Logf("Warning: expected version >= 2 for coalescing test, got %d", ver)
	}
}

// TestRaceConditions uses race detector to find race conditions
func TestRaceConditions(t *testing.T) {
	rf := func(keys []string) (map[string]int, error) {
		result := make(map[string]int)
		for _, k := range keys {
			result[k] = len(k)
		}
		return result, nil
	}

	allKeys := func() []string { return []string{} }
	mv := New(rf, allKeys)

	// Many concurrent operations
	var wg sync.WaitGroup
	for i := 0; i < 20; i++ {
		// Trigger
		wg.Add(1)
		go func(n int) {
			defer wg.Done()
			mv.Trigger([]string{fmt.Sprintf("k%d", n%5)}, n%2 == 0)
		}(i)

		// Get
		wg.Add(1)
		go func(n int) {
			defer wg.Done()
			mv.Get(fmt.Sprintf("k%d", n%5))
		}(i)

		// WaitForAtLeast
		wg.Add(1)
		go func(n int) {
			defer wg.Done()
			done := make(chan struct{})
			go func() {
				mv.WaitForAtLeast(fmt.Sprintf("k%d", n%5), 0)
				close(done)
			}()
			select {
			case <-done:
			case <-time.After(100 * time.Millisecond):
			}
		}(i)
	}

	wg.Wait()
}

// TestVersionMonotonicity ensures versions only increase
func TestVersionMonotonicity(t *testing.T) {
	var callNum int32
	
	rf := func(keys []string) (map[string]int, error) {
		n := atomic.AddInt32(&callNum, 1)
		result := make(map[string]int)
		for _, k := range keys {
			result[k] = int(n)
		}
		return result, nil
	}

	allKeys := func() []string { return []string{} }
	mv := New(rf, allKeys)

	// Trigger same key many times and check versions always increase
	prevVersion := uint64(0)
	for i := 0; i < 10; i++ {
		err := mv.TriggerAndWait([]string{"test"})
		if err != nil {
			t.Fatalf("trigger %d failed: %v", i, err)
		}

		_, ver := mv.Get("test")
		if ver <= prevVersion {
			t.Errorf("version did not increase: prev=%d, current=%d", prevVersion, ver)
		}
		prevVersion = ver
	}

	if prevVersion != 10 {
		t.Errorf("expected final version=10, got %d", prevVersion)
	}
}

// TestEmptyKeysList tests triggering with empty keys list
func TestEmptyKeysList(t *testing.T) {
	var called bool
	
	rf := func(keys []string) (map[string]int, error) {
		called = true
		return make(map[string]int), nil
	}

	allKeys := func() []string { return []string{} }
	mv := New(rf, allKeys)

	err := mv.TriggerAndWait([]string{})
	if err != nil {
		t.Fatalf("TriggerAndWait with empty keys failed: %v", err)
	}

	if called {
		t.Error("recompute should not be called for empty keys list")
	}
}

// TestNilReturnMap tests behavior when recompute returns nil map
func TestNilReturnMap(t *testing.T) {
	var callCount int32
	
	rf := func(keys []string) (map[string]int, error) {
		atomic.AddInt32(&callCount, 1)
		return nil, nil // nil map, no error
	}

	allKeys := func() []string { return []string{} }
	mv := New(rf, allKeys)

	// Can't use TriggerAndWait with nil results because version never increments
	mv.Trigger([]string{"test"}, false)
	time.Sleep(50 * time.Millisecond) // wait for processing

	// Version should not increment for nil results
	_, ver := mv.Get("test")
	if ver != 0 {
		t.Errorf("expected version=0 for nil result, got %d", ver)
	}
	
	count := atomic.LoadInt32(&callCount)
	if count != 1 {
		t.Errorf("expected 1 call, got %d", count)
	}
}

// BenchmarkSingleKeyTrigger benchmarks triggering a single key
func BenchmarkSingleKeyTrigger(b *testing.B) {
	rf := func(keys []string) (map[string]int, error) {
		result := make(map[string]int)
		for _, k := range keys {
			result[k] = len(k)
		}
		return result, nil
	}

	allKeys := func() []string { return []string{} }
	mv := New(rf, allKeys)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		mv.TriggerAndWait([]string{"test"})
	}
}

// BenchmarkConcurrentReads benchmarks concurrent reads
func BenchmarkConcurrentReads(b *testing.B) {
	rf := func(keys []string) (map[string]int, error) {
		result := make(map[string]int)
		for _, k := range keys {
			result[k] = len(k)
		}
		return result, nil
	}

	allKeys := func() []string { return []string{} }
	mv := New(rf, allKeys)
	mv.TriggerAndWait([]string{"test"})

	b.ResetTimer()
	b.RunParallel(func(pb *testing.PB) {
		for pb.Next() {
			mv.Get("test")
		}
	})
}

// BenchmarkBatchTrigger benchmarks triggering batches of keys
func BenchmarkBatchTrigger(b *testing.B) {
	rf := func(keys []string) (map[string]int, error) {
		result := make(map[string]int)
		for _, k := range keys {
			result[k] = len(k)
		}
		return result, nil
	}

	allKeys := func() []string { return []string{} }
	mv := New(rf, allKeys)
	keys := make([]string, 100)
	for i := range keys {
		keys[i] = fmt.Sprintf("key%d", i)
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		mv.TriggerAndWait(keys)
	}
}
