package materialized

import (
	"context"
	"errors"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

// TestBasicGetAndTrigger tests basic get and trigger operations
func TestBasicGetAndTrigger(t *testing.T) {
	var callCount int32
	rf := func(ctx context.Context) (int, error) {
		n := atomic.AddInt32(&callCount, 1)
		return int(n) * 100, nil
	}

	mv := New(rf)

	// Wait for initial computation to complete (New calls StartRecompute automatically)
	err := mv.WaitRecompute()
	if err != nil {
		t.Fatalf("WaitRecompute failed: %v", err)
	}

	// After initial computation from New(), value should be 100
	val := mv.Get()
	if val != 100 {
		t.Errorf("expected val=100 after New(), got val=%d", val)
	}

	if atomic.LoadInt32(&callCount) != 1 {
		t.Errorf("expected 1 recompute call from New(), got %d", callCount)
	}

	// Trigger another computation
	err = mv.RunRecompute(context.Background())
	if err != nil {
		t.Fatalf("RunRecompute failed: %v", err)
	}

	val = mv.Get()
	if val != 200 {
		t.Errorf("expected val=200 after second recompute, got val=%d", val)
	}

	if atomic.LoadInt32(&callCount) != 2 {
		t.Errorf("expected 2 recompute calls total, got %d", callCount)
	}
}

// TestMultipleTriggers tests that values update on each trigger
func TestMultipleTriggers(t *testing.T) {
	var callCount int32
	rf := func(ctx context.Context) (int, error) {
		return int(atomic.AddInt32(&callCount, 1)) * 100, nil
	}

	mv := New(rf)

	// Wait for initial computation to complete (New calls StartRecompute automatically)
	err := mv.WaitRecompute()
	if err != nil {
		if !strings.Contains(err.Error(), "recompute not in progress") {
			t.Fatalf("WaitRecompute failed: %v", err)
		}
	}

	val1 := mv.Get()
	if val1 != 100 {
		t.Errorf("first trigger: expected val=100, got val=%d", val1)
	}

	// Second trigger - should update value
	err = mv.RunRecompute(context.Background())
	if err != nil {
		t.Fatalf("second Trigger failed: %v", err)
	}

	val2 := mv.Get()
	if val2 != 200 {
		t.Errorf("second trigger: expected val=200, got val=%d", val2)
	}
}

// TestConcurrentReadWrite tests concurrent reads during writes
func TestConcurrentReadWrite(t *testing.T) {
	var callCount int32
	rf := func(ctx context.Context) (int, error) {
		return int(atomic.AddInt32(&callCount, 1)), nil
	}

	mv := New(rf)

	// Start writes
	go func() {
		for i := 0; i < 10; i++ {
			_ = mv.RunRecompute(context.Background())
		}
	}()

	// Concurrent reads
	var wg sync.WaitGroup
	for i := 0; i < 50; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for j := 0; j < 10; j++ {
				mv.Get()
			}
		}()
	}

	wg.Wait()
	// If we get here without deadlock or race, test passes
}

// TestRecomputeError tests error handling in recompute function
func TestRecomputeError(t *testing.T) {
	var shouldError int32 = 1

	rf := func(ctx context.Context) (int, error) {
		if atomic.LoadInt32(&shouldError) == 1 {
			return 0, errors.New("computation failed")
		}
		return 42, nil
	}

	mv := New(rf)

	// First trigger will error
	err := mv.RunRecompute(context.Background())
	if err == nil {
		t.Error("expected error, got nil")
	}

	// Value should not be updated
	val := mv.Get()
	if val != 0 {
		t.Errorf("after error: expected val=0, got val=%d", val)
	}

	// Now allow success
	atomic.StoreInt32(&shouldError, 0)
	err = mv.RunRecompute(context.Background())
	if err != nil {
		t.Fatalf("Trigger failed: %v", err)
	}

	val = mv.Get()
	if val != 42 {
		t.Errorf("after success: expected val=42, got val=%d", val)
	}
}

// TestStartWaitRun tests the StartRecompute/WaitRecompute/RunRecompute API
func TestStartWaitRun(t *testing.T) {
	var callCount int32
	rf := func(ctx context.Context) (int, error) {
		return int(atomic.AddInt32(&callCount, 1)) * 100, nil
	}

	mv := New(rf)

	// Wait for initial computation to complete (New calls StartRecompute automatically)
	err := mv.WaitRecompute()
	if err != nil {
		t.Fatalf("WaitRecompute failed: %v", err)
	}

	val := mv.Get()
	if val != 100 {
		t.Errorf("expected val=100, got val=%d", val)
	}

	// Test RunRecompute (should be equivalent to StartRecompute + WaitRecompute)
	_ = mv.RunRecompute(context.Background())

	val = mv.Get()
	if val != 200 {
		t.Errorf("expected val=200, got val=%d", val)
	}
}

// TestStartAlreadyStarted tests that StartRecompute returns error if already running
func TestStartAlreadyStarted(t *testing.T) {
	var once sync.Once
	started := make(chan struct{})
	block := make(chan struct{})
	var callCount int32

	rf := func(ctx context.Context) (int, error) {
		n := atomic.AddInt32(&callCount, 1)
		// Only close started on first call
		once.Do(func() { close(started) })
		<-block // block until we release
		return int(n) * 10, nil
	}

	mv := New(rf)

	// Wait for initial computation to start (New calls StartRecompute automatically)
	<-started

	// Try to start again while first is running - should mark pending
	err := mv.StartRecompute(context.Background())
	if err == nil {
		t.Error("expected ErrAlreadyStarted, got nil")
	}
	if !IsAlreadyStarted(err) {
		t.Errorf("expected ErrAlreadyStarted, got %v", err)
	}

	// Release the blocked computation (will unblock both the first run and the pending rerun)
	close(block)

	// Wait for all computations to complete (including the pending rerun)
	err = mv.WaitRecompute()
	if err != nil {
		t.Errorf("WaitRecompute failed: %v", err)
	}

	// Should have run twice: original + rerun from pending
	count := atomic.LoadInt32(&callCount)
	if count != 2 {
		t.Errorf("expected 2 calls (original + pending rerun), got %d", count)
	}

	// Final value should be from second call
	val := mv.Get()
	if val != 20 {
		t.Errorf("expected val=20, got %d", val)
	}
}

// TestRunWhileInProgress tests that RunRecompute waits for in-progress computation including reruns
func TestRunWhileInProgress(t *testing.T) {
	var once sync.Once
	started := make(chan struct{})
	block := make(chan struct{})
	var callCount int32

	rf := func(ctx context.Context) (int, error) {
		n := atomic.AddInt32(&callCount, 1)
		// Only signal started on first call
		once.Do(func() { close(started) })
		<-block
		return int(n) * 100, nil
	}

	mv := New(rf)

	// Start first computation
	_ = mv.StartRecompute(context.Background())
	<-started

	// Call RunRecompute while first is in progress - should mark pending and wait for all to complete
	var runErr error
	done := make(chan struct{})
	go func() {
		runErr = mv.RunRecompute(context.Background())
		close(done)
	}()

	// Give RunRecompute a chance to call StartRecompute and get ErrAlreadyStarted (marking pending)
	time.Sleep(20 * time.Millisecond)

	// Release the blocked computation (will unblock both runs)
	close(block)

	// Wait for RunRecompute to complete (should wait for both original + rerun)
	<-done

	if runErr != nil {
		t.Errorf("RunRecompute failed: %v", runErr)
	}

	// Should have run twice: original + rerun from pending
	count := atomic.LoadInt32(&callCount)
	if count != 2 {
		t.Errorf("expected 2 calls (original + rerun), got %d", count)
	}

	val := mv.Get()
	if val != 200 {
		t.Errorf("expected val=200 (from second run), got val=%d", val)
	}
}

// TestCoalescingRerun tests that multiple triggers while running collapse into one re-run
func TestCoalescingRerun(t *testing.T) {
	var mu sync.Mutex
	callTimes := []time.Time{}

	rf := func(ctx context.Context) (int, error) {
		mu.Lock()
		callTimes = append(callTimes, time.Now())
		mu.Unlock()
		time.Sleep(100 * time.Millisecond) // slow computation
		return 42, nil
	}

	mv := New(rf)

	// Start first computation
	_ = mv.StartRecompute(context.Background())

	// While it's running, trigger multiple times
	time.Sleep(20 * time.Millisecond) // ensure first has started
	for i := 0; i < 5; i++ {
		_ = mv.StartRecompute(context.Background()) // These should all set pending=true
		time.Sleep(10 * time.Millisecond)
	}

	// Wait for processing to complete
	time.Sleep(300 * time.Millisecond)

	mu.Lock()
	numCalls := len(callTimes)
	mu.Unlock()

	// Should have exactly 2 calls: original + 1 coalesced re-run
	if numCalls != 2 {
		t.Errorf("expected 2 calls (original + coalesced rerun), got %d", numCalls)
	}

	t.Logf("Coalesced 5 triggers while running into 1 re-run (total 2 calls)")
}

// TestRaceConditions uses race detector to find race conditions
func TestRaceConditions(t *testing.T) {
	var callNum int32
	rf := func(ctx context.Context) (int, error) {
		return int(atomic.AddInt32(&callNum, 1)), nil
	}

	mv := New(rf)

	// Many concurrent operations
	var wg sync.WaitGroup
	for i := 0; i < 20; i++ {
		// RunRecompute
		wg.Add(1)
		go func() {
			defer wg.Done()
			_ = mv.RunRecompute(context.Background())
		}()

		// Get
		wg.Add(1)
		go func() {
			defer wg.Done()
			mv.Get()
		}()

		// StartRecompute + WaitRecompute
		wg.Add(1)
		go func() {
			defer wg.Done()
			if err := mv.StartRecompute(context.Background()); err == nil {
				_ = mv.WaitRecompute()
			}
		}()
	}

	wg.Wait()
}

// BenchmarkTrigger benchmarks triggering
func BenchmarkTrigger(b *testing.B) {
	rf := func(ctx context.Context) (int, error) {
		return 42, nil
	}

	mv := New(rf)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = mv.RunRecompute(context.Background())
	}
}

// BenchmarkConcurrentReads benchmarks concurrent reads
func BenchmarkConcurrentReads(b *testing.B) {
	rf := func(ctx context.Context) (int, error) {
		return 42, nil
	}

	mv := New(rf)
	if err := mv.RunRecompute(context.Background()); err != nil {
		b.Fatalf("RunRecompute failed: %v", err)
	}

	b.ResetTimer()
	b.RunParallel(func(pb *testing.PB) {
		for pb.Next() {
			mv.Get()
		}
	})
}

// TestApplyUpdate tests the incremental update functionality
// func TestApplyUpdate(t *testing.T) {
// 	var callCount int32
// 	rf := func() (int, error) {
// 		return int(atomic.AddInt32(&callCount, 1)) * 100, nil
// 	}

// 	mv := New(rf)

// 	// Wait for initial computation to complete (New calls StartRecompute automatically)
// 	err := mv.WaitRecompute()
// 	if err != nil {
// 		t.Fatalf("WaitRecompute failed: %v", err)
// 	}

// 	val := mv.Get()
// 	if val != 100 {
// 		t.Errorf("expected val=100, got val=%d", val)
// 	}

// 	// Apply an incremental update
// 	updatedVal, err := mv.ApplyUpdate(func(current int) (int, error) {
// 		return current + 50, nil
// 	})
// 	if err != nil {
// 		t.Fatalf("ApplyUpdate failed: %v", err)
// 	}

// 	if updatedVal != 150 {
// 		t.Errorf("expected updated val=150, got val=%d", updatedVal)
// 	}

// 	val = mv.Get()
// 	if val != 150 {
// 		t.Errorf("expected cached val=150, got val=%d", val)
// 	}

// 	// Verify that the recompute function wasn't called again
// 	if atomic.LoadInt32(&callCount) != 1 {
// 		t.Errorf("expected 1 recompute call (only initial), got %d", callCount)
// 	}
// }

// TestApplyUpdateError tests error handling in ApplyUpdate
// func TestApplyUpdateError(t *testing.T) {
// 	rf := func() (int, error) {
// 		return 100, nil
// 	}

// 	mv := New(rf)
// 	mv.RunRecompute()

// 	// Apply an update that errors
// 	_, err := mv.ApplyUpdate(func(current int) (int, error) {
// 		return 0, errors.New("update failed")
// 	})
// 	if err == nil {
// 		t.Error("expected error, got nil")
// 	}

// 	// Value should remain unchanged
// 	val := mv.Get()
// 	if val != 100 {
// 		t.Errorf("expected val=100 (unchanged), got val=%d", val)
// 	}
// }

// TestApplyUpdateWhileRecomputing tests ApplyUpdate behavior during recompute
// func TestApplyUpdateWhileRecomputing(t *testing.T) {
// 	started := make(chan struct{})
// 	block := make(chan struct{})
// 	var callCount int32

// 	rf := func() (int, error) {
// 		n := atomic.AddInt32(&callCount, 1)
// 		if n == 1 {
// 			close(started)
// 			<-block
// 		}
// 		return int(n) * 100, nil
// 	}

// 	mv := New(rf)

// 	// Start a recompute in background
// 	go mv.StartRecompute()
// 	<-started

// 	// Try to apply an update while recompute is in progress
// 	// It should mark pending and trigger a full recompute after current one finishes
// 	updatedVal, err := mv.ApplyUpdate(func(current int) (int, error) {
// 		return current + 50, nil
// 	})
// 	if err != nil {
// 		t.Fatalf("ApplyUpdate failed: %v", err)
// 	}

// 	// Should return current value (which is still zero since recompute hasn't finished)
// 	if updatedVal != 0 {
// 		t.Errorf("expected val=0 (current value), got val=%d", updatedVal)
// 	}

// 	// Release the recompute
// 	close(block)

// 	// Wait for all computations to complete
// 	time.Sleep(100 * time.Millisecond)

// 	// Should have run twice: original + rerun from pending
// 	count := atomic.LoadInt32(&callCount)
// 	if count != 2 {
// 		t.Errorf("expected 2 calls (original + rerun from pending), got %d", count)
// 	}

// 	// Final value should be from the second recompute
// 	val := mv.Get()
// 	if val != 200 {
// 		t.Errorf("expected val=200 (from second recompute), got val=%d", val)
// 	}
// }

// TestApplyUpdateMapType tests ApplyUpdate with map types (like the deployment resources use case)
// func TestApplyUpdateMapType(t *testing.T) {
// 	var callCount int32
// 	rf := func() (map[string]int, error) {
// 		atomic.AddInt32(&callCount, 1)
// 		return map[string]int{"a": 1, "b": 2}, nil
// 	}

// 	mv := New(rf)

// 	// Wait for initial computation to complete (New calls StartRecompute automatically)
// 	err := mv.WaitRecompute()
// 	if err != nil {
// 		t.Fatalf("WaitRecompute failed: %v", err)
// 	}

// 	// Apply an incremental update - add a new entry
// 	updatedVal, err := mv.ApplyUpdate(func(current map[string]int) (map[string]int, error) {
// 		current["c"] = 3
// 		return current, nil
// 	})
// 	if err != nil {
// 		t.Fatalf("ApplyUpdate failed: %v", err)
// 	}

// 	if len(updatedVal) != 3 {
// 		t.Errorf("expected 3 entries, got %d", len(updatedVal))
// 	}

// 	// Apply another update - remove an entry
// 	updatedVal, err = mv.ApplyUpdate(func(current map[string]int) (map[string]int, error) {
// 		delete(current, "a")
// 		return current, nil
// 	})
// 	if err != nil {
// 		t.Fatalf("second ApplyUpdate failed: %v", err)
// 	}

// 	if len(updatedVal) != 2 {
// 		t.Errorf("expected 2 entries after delete, got %d", len(updatedVal))
// 	}

// 	if _, ok := updatedVal["a"]; ok {
// 		t.Error("expected 'a' to be deleted")
// 	}

// 	// Verify that the recompute function was only called once (during initialization)
// 	if atomic.LoadInt32(&callCount) != 1 {
// 		t.Errorf("expected 1 recompute call, got %d", callCount)
// 	}
// }

// TestConcurrentApplyUpdate tests concurrent ApplyUpdate calls
// func TestConcurrentApplyUpdate(t *testing.T) {
// 	rf := func() (int, error) {
// 		return 0, nil
// 	}

// 	mv := New(rf)
// 	mv.RunRecompute()

// 	// Apply many concurrent updates
// 	var wg sync.WaitGroup
// 	for i := 0; i < 100; i++ {
// 		wg.Add(1)
// 		go func() {
// 			defer wg.Done()
// 			mv.ApplyUpdate(func(current int) (int, error) {
// 				return current + 1, nil
// 			})
// 		}()
// 	}

// 	wg.Wait()

// 	// Final value should be 100 (all updates applied)
// 	val := mv.Get()
// 	if val != 100 {
// 		t.Errorf("expected val=100, got val=%d", val)
// 	}
// }

// TestWithImmediateCompute tests the WithImmediateCompute option
func TestWithImmediateCompute(t *testing.T) {
	started := make(chan struct{})
	block := make(chan struct{})
	var callCount int32

	rf := func(ctx context.Context) (int, error) {
		n := atomic.AddInt32(&callCount, 1)
		close(started)
		<-block
		return int(n) * 100, nil
	}

	// Create with immediate compute
	mv := New(rf)

	// Wait for it to actually start
	<-started

	// Verify it started computing
	if atomic.LoadInt32(&callCount) == 0 {
		t.Error("expected recompute to have been called")
	}

	// Release the computation
	close(block)

	// Wait for the computation to complete
	err := mv.WaitRecompute()
	if err != nil {
		t.Fatalf("WaitRecompute failed: %v", err)
	}

	val := mv.Get()
	if val != 100 {
		t.Errorf("expected val=100, got val=%d", val)
	}

	if atomic.LoadInt32(&callCount) != 1 {
		t.Errorf("expected 1 recompute call, got %d", callCount)
	}
}

// TestWithoutImmediateCompute tests the default behavior (WITH immediate compute)
func TestWithoutImmediateCompute(t *testing.T) {
	var callCount int32
	rf := func(ctx context.Context) (int, error) {
		return int(atomic.AddInt32(&callCount, 1)) * 100, nil
	}

	// Create - now triggers immediate computation
	mv := New(rf)

	// Wait for initial computation to complete
	err := mv.WaitRecompute()
	if err != nil {
		t.Fatalf("WaitRecompute failed: %v", err)
	}

	// Should have called recompute once (from New)
	if atomic.LoadInt32(&callCount) != 1 {
		t.Errorf("expected 1 recompute call from New(), got %d", callCount)
	}

	// Value should be 100
	val := mv.Get()
	if val != 100 {
		t.Errorf("expected val=100, got val=%d", val)
	}

	// Manually trigger another recompute
	err = mv.RunRecompute(context.Background())
	if err != nil {
		t.Fatalf("RunRecompute failed: %v", err)
	}

	val = mv.Get()
	if val != 200 {
		t.Errorf("expected val=200, got val=%d", val)
	}

	if atomic.LoadInt32(&callCount) != 2 {
		t.Errorf("expected 2 recompute calls, got %d", callCount)
	}
}
