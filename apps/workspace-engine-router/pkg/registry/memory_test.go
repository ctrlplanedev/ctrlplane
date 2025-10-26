package registry

import (
	"fmt"
	"sync"
	"testing"
	"time"
)

func TestNewInMemoryRegistry(t *testing.T) {
	timeout := 30 * time.Second
	reg := NewInMemoryRegistry(timeout)

	if reg == nil {
		t.Fatal("Expected non-nil registry")
	}

	if reg.heartbeatTimeout != timeout {
		t.Errorf("Expected timeout %v, got %v", timeout, reg.heartbeatTimeout)
	}
}

func TestRegister_NewWorker(t *testing.T) {
	reg := NewInMemoryRegistry(30 * time.Second)

	err := reg.Register("worker-1", "http://localhost:8080", []int32{0, 1, 2})
	if err != nil {
		t.Fatalf("Failed to register worker: %v", err)
	}

	// Verify worker is registered
	worker, err := reg.GetWorkerForPartition(0)
	if err != nil {
		t.Fatalf("Failed to get worker: %v", err)
	}

	if worker.WorkerID != "worker-1" {
		t.Errorf("Expected worker-1, got %s", worker.WorkerID)
	}

	if worker.HTTPAddress != "http://localhost:8080" {
		t.Errorf("Expected http://localhost:8080, got %s", worker.HTTPAddress)
	}

	if len(worker.Partitions) != 3 {
		t.Errorf("Expected 3 partitions, got %d", len(worker.Partitions))
	}
}

func TestRegister_UpdateExistingWorker(t *testing.T) {
	reg := NewInMemoryRegistry(30 * time.Second)

	// Register worker
	err := reg.Register("worker-1", "http://localhost:8080", []int32{0, 1})
	if err != nil {
		t.Fatalf("Failed to register worker: %v", err)
	}

	// Wait to ensure different timestamp
	time.Sleep(10 * time.Millisecond)

	// Update worker with different address and partitions
	err = reg.Register("worker-1", "http://localhost:9090", []int32{2, 3})
	if err != nil {
		t.Fatalf("Failed to update worker: %v", err)
	}

	// Verify old partitions are no longer assigned to worker-1
	_, err = reg.GetWorkerForPartition(0)
	if err == nil {
		t.Error("Expected error for partition 0 (should be unassigned)")
	}

	// Verify new partitions are assigned
	worker, err := reg.GetWorkerForPartition(2)
	if err != nil {
		t.Fatalf("Failed to get worker for partition 2: %v", err)
	}

	if worker.WorkerID != "worker-1" {
		t.Errorf("Expected worker-1, got %s", worker.WorkerID)
	}

	if worker.HTTPAddress != "http://localhost:9090" {
		t.Errorf("Expected http://localhost:9090, got %s", worker.HTTPAddress)
	}
}

func TestRegister_PartitionConflict_NewerWins(t *testing.T) {
	reg := NewInMemoryRegistry(30 * time.Second)

	// Register older worker
	err := reg.Register("worker-1", "http://worker1:8080", []int32{0, 1, 2})
	if err != nil {
		t.Fatalf("Failed to register worker-1: %v", err)
	}

	// Wait to ensure different timestamp
	time.Sleep(10 * time.Millisecond)

	// Register newer worker with overlapping partitions
	err = reg.Register("worker-2", "http://worker2:8080", []int32{0, 1})
	if err != nil {
		t.Fatalf("Failed to register worker-2: %v", err)
	}

	// Verify newer worker owns partitions 0 and 1
	worker, err := reg.GetWorkerForPartition(0)
	if err != nil {
		t.Fatalf("Failed to get worker for partition 0: %v", err)
	}
	if worker.WorkerID != "worker-2" {
		t.Errorf("Expected worker-2 for partition 0, got %s", worker.WorkerID)
	}

	worker, err = reg.GetWorkerForPartition(1)
	if err != nil {
		t.Fatalf("Failed to get worker for partition 1: %v", err)
	}
	if worker.WorkerID != "worker-2" {
		t.Errorf("Expected worker-2 for partition 1, got %s", worker.WorkerID)
	}

	// Verify older worker still owns partition 2
	worker, err = reg.GetWorkerForPartition(2)
	if err != nil {
		t.Fatalf("Failed to get worker for partition 2: %v", err)
	}
	if worker.WorkerID != "worker-1" {
		t.Errorf("Expected worker-1 for partition 2, got %s", worker.WorkerID)
	}

	// Verify worker-1's partitions were updated
	workers, err := reg.ListWorkers()
	if err != nil {
		t.Fatalf("Failed to list workers: %v", err)
	}

	for _, w := range workers {
		if w.WorkerID == "worker-1" {
			if len(w.Partitions) != 1 || w.Partitions[0] != 2 {
				t.Errorf("Expected worker-1 to have only partition [2], got %v", w.Partitions)
			}
		}
	}
}

func TestRegister_PartitionConflict_OlderKept(t *testing.T) {
	reg := NewInMemoryRegistry(30 * time.Second)

	// Register worker-1
	err := reg.Register("worker-1", "http://worker1:8080", []int32{0, 1, 2})
	if err != nil {
		t.Fatalf("Failed to register worker-1: %v", err)
	}

	// Manually set an earlier registration time for worker-2
	// This simulates worker-2 being older but registering after worker-1
	reg.mu.Lock()
	worker2 := &WorkerInfo{
		WorkerID:      "worker-2",
		HTTPAddress:   "http://worker2:8080",
		Partitions:    []int32{0, 1},
		LastHeartbeat: time.Now().Add(-10 * time.Second),
		RegisteredAt:  time.Now().Add(-10 * time.Second), // Older registration
	}
	reg.workers["worker-2"] = worker2
	reg.mu.Unlock()

	// Now update worker-2 (which is older than worker-1)
	err = reg.Register("worker-2", "http://worker2:8080", []int32{0, 1})
	if err != nil {
		t.Fatalf("Failed to register worker-2: %v", err)
	}

	// Verify worker-1 (newer) still owns partitions 0 and 1
	worker, err := reg.GetWorkerForPartition(0)
	if err != nil {
		t.Fatalf("Failed to get worker for partition 0: %v", err)
	}
	if worker.WorkerID != "worker-1" {
		t.Errorf("Expected worker-1 to keep partition 0 (it's newer), got %s", worker.WorkerID)
	}
}

func TestRegister_AllPartitionsTakenOver_WorkerRemoved(t *testing.T) {
	reg := NewInMemoryRegistry(30 * time.Second)

	// Register worker-1 with partitions 0, 1
	err := reg.Register("worker-1", "http://worker1:8080", []int32{0, 1})
	if err != nil {
		t.Fatalf("Failed to register worker-1: %v", err)
	}

	// Wait to ensure different timestamp
	time.Sleep(10 * time.Millisecond)

	// Register worker-2 with same partitions (newer, should take over)
	err = reg.Register("worker-2", "http://worker2:8080", []int32{0, 1})
	if err != nil {
		t.Fatalf("Failed to register worker-2: %v", err)
	}

	// Verify worker-1 is removed (no partitions left)
	workers, err := reg.ListWorkers()
	if err != nil {
		t.Fatalf("Failed to list workers: %v", err)
	}

	for _, w := range workers {
		if w.WorkerID == "worker-1" {
			t.Error("Expected worker-1 to be removed after losing all partitions")
		}
	}

	// Verify only worker-2 exists
	if len(workers) != 1 {
		t.Errorf("Expected 1 worker, got %d", len(workers))
	}
}

func TestHeartbeat_Success(t *testing.T) {
	reg := NewInMemoryRegistry(30 * time.Second)

	// Register worker
	err := reg.Register("worker-1", "http://localhost:8080", []int32{0})
	if err != nil {
		t.Fatalf("Failed to register worker: %v", err)
	}

	// Get initial heartbeat time
	worker, _ := reg.GetWorkerForPartition(0)
	initialHeartbeat := worker.LastHeartbeat

	// Wait a bit
	time.Sleep(10 * time.Millisecond)

	// Send heartbeat
	err = reg.Heartbeat("worker-1", "http://localhost:8080", []int32{0})
	if err != nil {
		t.Fatalf("Failed to send heartbeat: %v", err)
	}

	// Verify heartbeat was updated
	worker, _ = reg.GetWorkerForPartition(0)
	if !worker.LastHeartbeat.After(initialHeartbeat) {
		t.Error("Expected heartbeat to be updated")
	}
}

func TestHeartbeat_WorkerNotFound(t *testing.T) {
	reg := NewInMemoryRegistry(30 * time.Second)

	err := reg.Heartbeat("nonexistent-worker", "http://localhost:8080", []int32{0})
	if err != ErrWorkerNotFound {
		t.Errorf("Expected ErrWorkerNotFound, got %v", err)
	}
}

func TestGetWorkerForPartition_Success(t *testing.T) {
	reg := NewInMemoryRegistry(30 * time.Second)

	err := reg.Register("worker-1", "http://localhost:8080", []int32{5})
	if err != nil {
		t.Fatalf("Failed to register worker: %v", err)
	}

	worker, err := reg.GetWorkerForPartition(5)
	if err != nil {
		t.Fatalf("Failed to get worker: %v", err)
	}

	if worker.WorkerID != "worker-1" {
		t.Errorf("Expected worker-1, got %s", worker.WorkerID)
	}
}

func TestGetWorkerForPartition_NoWorker(t *testing.T) {
	reg := NewInMemoryRegistry(30 * time.Second)

	_, err := reg.GetWorkerForPartition(5)
	if err != ErrNoWorkerForPartition {
		t.Errorf("Expected ErrNoWorkerForPartition, got %v", err)
	}
}

func TestGetWorkerForPartition_UnhealthyWorker(t *testing.T) {
	reg := NewInMemoryRegistry(1 * time.Second) // 1 second timeout

	// Register worker
	err := reg.Register("worker-1", "http://localhost:8080", []int32{0})
	if err != nil {
		t.Fatalf("Failed to register worker: %v", err)
	}

	// Wait for worker to become unhealthy
	time.Sleep(2 * time.Second)

	// Try to get worker - should fail because it's unhealthy
	_, err = reg.GetWorkerForPartition(0)
	if err != ErrWorkerNotFound {
		t.Errorf("Expected ErrWorkerNotFound for unhealthy worker, got %v", err)
	}
}

func TestListWorkers_OnlyHealthy(t *testing.T) {
	reg := NewInMemoryRegistry(1 * time.Second)

	// Register two workers
	reg.Register("worker-1", "http://worker1:8080", []int32{0})
	reg.Register("worker-2", "http://worker2:8080", []int32{1})

	// Verify both are listed
	workers, err := reg.ListWorkers()
	if err != nil {
		t.Fatalf("Failed to list workers: %v", err)
	}
	if len(workers) != 2 {
		t.Errorf("Expected 2 workers, got %d", len(workers))
	}

	// Wait for workers to become unhealthy
	time.Sleep(2 * time.Second)

	// List workers again - should be empty
	workers, err = reg.ListWorkers()
	if err != nil {
		t.Fatalf("Failed to list workers: %v", err)
	}
	if len(workers) != 0 {
		t.Errorf("Expected 0 healthy workers, got %d", len(workers))
	}
}

func TestUnregister_Success(t *testing.T) {
	reg := NewInMemoryRegistry(30 * time.Second)

	// Register worker
	err := reg.Register("worker-1", "http://localhost:8080", []int32{0, 1})
	if err != nil {
		t.Fatalf("Failed to register worker: %v", err)
	}

	// Unregister worker
	err = reg.Unregister("worker-1")
	if err != nil {
		t.Fatalf("Failed to unregister worker: %v", err)
	}

	// Verify worker is gone
	_, err = reg.GetWorkerForPartition(0)
	if err != ErrNoWorkerForPartition {
		t.Errorf("Expected ErrNoWorkerForPartition after unregister, got %v", err)
	}

	// Verify not in list
	workers, _ := reg.ListWorkers()
	if len(workers) != 0 {
		t.Errorf("Expected 0 workers after unregister, got %d", len(workers))
	}
}

func TestUnregister_WorkerNotFound(t *testing.T) {
	reg := NewInMemoryRegistry(30 * time.Second)

	err := reg.Unregister("nonexistent-worker")
	if err != ErrWorkerNotFound {
		t.Errorf("Expected ErrWorkerNotFound, got %v", err)
	}
}

func TestCleanupStaleWorkers(t *testing.T) {
	reg := NewInMemoryRegistry(1 * time.Second)

	// Register workers
	reg.Register("worker-1", "http://worker1:8080", []int32{0})
	reg.Register("worker-2", "http://worker2:8080", []int32{1})

	// Wait for workers to become stale
	time.Sleep(2 * time.Second)

	// Cleanup stale workers
	count := reg.CleanupStaleWorkers()
	if count != 2 {
		t.Errorf("Expected 2 stale workers cleaned up, got %d", count)
	}

	// Verify workers are gone
	workers, _ := reg.ListWorkers()
	if len(workers) != 0 {
		t.Errorf("Expected 0 workers after cleanup, got %d", len(workers))
	}

	// Verify partitions are unassigned
	_, err := reg.GetWorkerForPartition(0)
	if err != ErrNoWorkerForPartition {
		t.Errorf("Expected ErrNoWorkerForPartition after cleanup, got %v", err)
	}
}

func TestCleanupStaleWorkers_KeepsHealthy(t *testing.T) {
	reg := NewInMemoryRegistry(2 * time.Second)

	// Register workers
	reg.Register("worker-1", "http://worker1:8080", []int32{0})
	reg.Register("worker-2", "http://worker2:8080", []int32{1})

	// Wait for workers to approach staleness
	time.Sleep(1500 * time.Millisecond)

	// Send heartbeat for worker-1 only (refreshes it)
	reg.Heartbeat("worker-1", "http://localhost:8080", []int32{0})

	// Wait for worker-2 to become stale (but worker-1 stays fresh)
	time.Sleep(1 * time.Second)

	// Cleanup stale workers
	count := reg.CleanupStaleWorkers()
	if count != 1 {
		t.Errorf("Expected 1 stale worker cleaned up, got %d", count)
	}

	// Verify worker-1 is still there
	workers, _ := reg.ListWorkers()
	if len(workers) != 1 {
		t.Errorf("Expected 1 worker after cleanup, got %d", len(workers))
	}
	if len(workers) > 0 && workers[0].WorkerID != "worker-1" {
		t.Errorf("Expected worker-1 to remain, got %s", workers[0].WorkerID)
	}
}

func TestConcurrentAccess(t *testing.T) {
	reg := NewInMemoryRegistry(30 * time.Second)
	
	var wg sync.WaitGroup
	numGoroutines := 10
	numOperations := 100

	// Concurrent registrations
	wg.Add(numGoroutines)
	for i := 0; i < numGoroutines; i++ {
		go func(id int) {
			defer wg.Done()
			for j := 0; j < numOperations; j++ {
				workerID := "worker-" + string(rune(id))
				reg.Register(workerID, "http://localhost:8080", []int32{int32(id)})
			}
		}(i)
	}

	// Concurrent heartbeats
	wg.Add(numGoroutines)
	for i := 0; i < numGoroutines; i++ {
		go func(id int) {
			defer wg.Done()
			for j := 0; j < numOperations; j++ {
				workerID := "worker-" + string(rune(id))
				reg.Heartbeat(workerID, "http://localhost:8080", []int32{int32(id)})
			}
		}(i)
	}

	// Concurrent reads
	wg.Add(numGoroutines)
	for i := 0; i < numGoroutines; i++ {
		go func(id int) {
			defer wg.Done()
			for j := 0; j < numOperations; j++ {
				reg.GetWorkerForPartition(int32(id))
				reg.ListWorkers()
			}
		}(i)
	}

	wg.Wait()

	// Verify registry is still consistent
	workers, err := reg.ListWorkers()
	if err != nil {
		t.Errorf("Registry inconsistent after concurrent access: %v", err)
	}

	// Should have some workers registered
	if len(workers) == 0 {
		t.Error("Expected some workers after concurrent operations")
	}
}

func TestGetWorkerForPartition_ReturnsCopy(t *testing.T) {
	reg := NewInMemoryRegistry(30 * time.Second)

	reg.Register("worker-1", "http://localhost:8080", []int32{0})

	worker1, _ := reg.GetWorkerForPartition(0)
	worker2, _ := reg.GetWorkerForPartition(0)

	// Modify one
	worker1.HTTPAddress = "http://modified:9090"

	// Verify the other is unchanged
	if worker2.HTTPAddress == "http://modified:9090" {
		t.Error("GetWorkerForPartition should return a copy, not a reference")
	}
}

func BenchmarkRegister(b *testing.B) {
	reg := NewInMemoryRegistry(30 * time.Second)
	
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		workerID := "worker-" + string(rune(i%100))
		reg.Register(workerID, "http://localhost:8080", []int32{int32(i % 10)})
	}
}

func BenchmarkGetWorkerForPartition(b *testing.B) {
	reg := NewInMemoryRegistry(30 * time.Second)
	
	// Pre-populate registry
	for i := 0; i < 10; i++ {
		workerID := "worker-" + string(rune(i))
		reg.Register(workerID, "http://localhost:8080", []int32{int32(i)})
	}
	
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		reg.GetWorkerForPartition(int32(i % 10))
	}
}

func BenchmarkHeartbeat(b *testing.B) {
	reg := NewInMemoryRegistry(30 * time.Second)
	reg.Register("worker-1", "http://localhost:8080", []int32{0})
	
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		reg.Heartbeat("worker-1", "http://localhost:8080", []int32{0})
	}
}

// Contract Tests: These tests verify the core contract that GetWorkerForPartition
// MUST always return the most recently registered worker for a partition.
// Any implementation of WorkerRegistry interface must pass these tests.

func TestContract_GetWorkerForPartition_AlwaysReturnsNewestWorker(t *testing.T) {
	t.Run("two workers same partition newer wins", func(t *testing.T) {
		reg := NewInMemoryRegistry(30 * time.Second)

		// Register first worker
		reg.Register("worker-old", "http://old:8080", []int32{5})
		
		// Verify old worker owns partition
		worker, err := reg.GetWorkerForPartition(5)
		if err != nil {
			t.Fatalf("Failed to get worker: %v", err)
		}
		if worker.WorkerID != "worker-old" {
			t.Fatalf("Expected worker-old initially, got %s", worker.WorkerID)
		}

		// Wait to ensure different registration time
		time.Sleep(10 * time.Millisecond)

		// Register newer worker with same partition
		reg.Register("worker-new", "http://new:8080", []int32{5})

		// CONTRACT: GetWorkerForPartition MUST return the newer worker
		worker, err = reg.GetWorkerForPartition(5)
		if err != nil {
			t.Fatalf("Failed to get worker: %v", err)
		}
		if worker.WorkerID != "worker-new" {
			t.Errorf("CONTRACT VIOLATION: GetWorkerForPartition must return newest worker, got %s instead of worker-new", worker.WorkerID)
		}
	})

	t.Run("three workers sequential registrations", func(t *testing.T) {
		reg := NewInMemoryRegistry(30 * time.Second)

		// Register workers sequentially with same partition
		reg.Register("worker-1", "http://w1:8080", []int32{3})
		time.Sleep(10 * time.Millisecond)

		reg.Register("worker-2", "http://w2:8080", []int32{3})
		time.Sleep(10 * time.Millisecond)

		reg.Register("worker-3", "http://w3:8080", []int32{3})

		// CONTRACT: Must return the most recent (worker-3)
		worker, err := reg.GetWorkerForPartition(3)
		if err != nil {
			t.Fatalf("Failed to get worker: %v", err)
		}
		if worker.WorkerID != "worker-3" {
			t.Errorf("CONTRACT VIOLATION: Expected worker-3 (newest), got %s", worker.WorkerID)
		}
	})

	t.Run("multiple partitions with different registration times", func(t *testing.T) {
		reg := NewInMemoryRegistry(30 * time.Second)

		// Register worker-1 with partitions 0, 1, 2
		reg.Register("worker-1", "http://w1:8080", []int32{0, 1, 2})
		time.Sleep(10 * time.Millisecond)

		// Register worker-2 with partition 1 only (newer)
		reg.Register("worker-2", "http://w2:8080", []int32{1})
		time.Sleep(10 * time.Millisecond)

		// Register worker-3 with partition 2 only (newest)
		reg.Register("worker-3", "http://w3:8080", []int32{2})

		// CONTRACT: Partition 0 should still belong to worker-1
		worker, _ := reg.GetWorkerForPartition(0)
		if worker.WorkerID != "worker-1" {
			t.Errorf("Expected worker-1 for partition 0, got %s", worker.WorkerID)
		}

		// CONTRACT: Partition 1 should belong to worker-2 (newer than worker-1)
		worker, _ = reg.GetWorkerForPartition(1)
		if worker.WorkerID != "worker-2" {
			t.Errorf("CONTRACT VIOLATION: Expected worker-2 for partition 1 (newer), got %s", worker.WorkerID)
		}

		// CONTRACT: Partition 2 should belong to worker-3 (newest)
		worker, _ = reg.GetWorkerForPartition(2)
		if worker.WorkerID != "worker-3" {
			t.Errorf("CONTRACT VIOLATION: Expected worker-3 for partition 2 (newest), got %s", worker.WorkerID)
		}
	})

	t.Run("worker re-registration maintains newest principle", func(t *testing.T) {
		reg := NewInMemoryRegistry(30 * time.Second)

		// Register worker-1
		reg.Register("worker-1", "http://w1:8080", []int32{7})
		time.Sleep(10 * time.Millisecond)

		// Register worker-2 with same partition (takes over)
		reg.Register("worker-2", "http://w2:8080", []int32{7})
		time.Sleep(10 * time.Millisecond)

		// Worker-1 re-registers (now it's the newest)
		reg.Register("worker-1", "http://w1:8080", []int32{7})

		// CONTRACT: Worker-1 should now own the partition (most recent registration)
		worker, err := reg.GetWorkerForPartition(7)
		if err != nil {
			t.Fatalf("Failed to get worker: %v", err)
		}
		if worker.WorkerID != "worker-1" {
			t.Errorf("CONTRACT VIOLATION: Expected worker-1 (re-registered most recently), got %s", worker.WorkerID)
		}
	})
}

func TestContract_GetWorkerForPartition_ConsistentAcrossMultipleCalls(t *testing.T) {
	reg := NewInMemoryRegistry(30 * time.Second)

	// Setup: Register two workers with overlapping partition
	reg.Register("worker-old", "http://old:8080", []int32{10})
	time.Sleep(10 * time.Millisecond)
	reg.Register("worker-new", "http://new:8080", []int32{10})

	// CONTRACT: Multiple calls to GetWorkerForPartition should return the same worker
	// (assuming no new registrations)
	results := make(map[string]int)
	for i := 0; i < 100; i++ {
		worker, err := reg.GetWorkerForPartition(10)
		if err != nil {
			t.Fatalf("Failed to get worker on iteration %d: %v", i, err)
		}
		results[worker.WorkerID]++
	}

	// Should only see one worker (the newest one)
	if len(results) != 1 {
		t.Errorf("CONTRACT VIOLATION: GetWorkerForPartition returned different workers: %v", results)
	}

	// And it should be the newest worker
	if _, ok := results["worker-new"]; !ok {
		t.Errorf("CONTRACT VIOLATION: Expected worker-new, got %v", results)
	}
}

func TestContract_GetWorkerForPartition_NewestAfterManyRegistrations(t *testing.T) {
	reg := NewInMemoryRegistry(30 * time.Second)

	// Register many workers for the same partition
	numWorkers := 20
	for i := 0; i < numWorkers; i++ {
		workerID := fmt.Sprintf("worker-%d", i)
		reg.Register(workerID, fmt.Sprintf("http://w%d:8080", i), []int32{15})
		time.Sleep(1 * time.Millisecond) // Ensure different timestamps
	}

	// CONTRACT: Must return the last registered worker (newest)
	expectedWorkerID := fmt.Sprintf("worker-%d", numWorkers-1)
	worker, err := reg.GetWorkerForPartition(15)
	if err != nil {
		t.Fatalf("Failed to get worker: %v", err)
	}

	if worker.WorkerID != expectedWorkerID {
		t.Errorf("CONTRACT VIOLATION: Expected %s (newest of %d workers), got %s",
			expectedWorkerID, numWorkers, worker.WorkerID)
	}
}

func TestContract_GetWorkerForPartition_NewestWinsEvenWithComplexScenarios(t *testing.T) {
	reg := NewInMemoryRegistry(30 * time.Second)

	// Complex scenario: Multiple workers, multiple partitions, multiple registrations
	
	// Time T1: worker-A registers with partitions 1,2,3
	reg.Register("worker-A", "http://a:8080", []int32{1, 2, 3})
	time.Sleep(5 * time.Millisecond)

	// Time T2: worker-B registers with partitions 2,3,4
	reg.Register("worker-B", "http://b:8080", []int32{2, 3, 4})
	time.Sleep(5 * time.Millisecond)

	// Time T3: worker-C registers with partitions 3,4,5
	reg.Register("worker-C", "http://c:8080", []int32{3, 4, 5})
	time.Sleep(5 * time.Millisecond)

	// Time T4: worker-D (new worker) registers with partition 3
	// This tests that a brand new worker can take over from existing workers
	reg.Register("worker-D", "http://d:8080", []int32{3})

	// CONTRACT: Verify each partition is owned by the newest registered worker
	tests := []struct {
		partition   int32
		expected    string
		reason      string
		shouldExist bool
	}{
		{1, "worker-A", "only worker-A registered for partition 1", true},
		{2, "worker-B", "worker-B registered after worker-A for partition 2", true},
		{3, "worker-D", "worker-D (new worker) registered most recently for partition 3", true},
		{4, "worker-C", "worker-C registered after worker-B for partition 4", true},
		{5, "worker-C", "only worker-C registered for partition 5", true},
	}

	for _, tt := range tests {
		worker, err := reg.GetWorkerForPartition(tt.partition)
		if !tt.shouldExist {
			if err == nil {
				t.Errorf("Expected error for partition %d, but got worker %s", tt.partition, worker.WorkerID)
			}
			continue
		}
		if err != nil {
			t.Errorf("Failed to get worker for partition %d: %v", tt.partition, err)
			continue
		}
		if worker.WorkerID != tt.expected {
			t.Errorf("CONTRACT VIOLATION for partition %d: expected %s (%s), got %s",
				tt.partition, tt.expected, tt.reason, worker.WorkerID)
		}
	}
}

func TestContract_GetWorkerForPartition_NewerWorkerEvenIfOlderIsHealthier(t *testing.T) {
	reg := NewInMemoryRegistry(30 * time.Second)

	// Register old worker and immediately send heartbeat
	reg.Register("worker-old", "http://old:8080", []int32{20})
	reg.Heartbeat("worker-old", "http://old:8080", []int32{20}) // Fresh heartbeat

	time.Sleep(10 * time.Millisecond)

	// Register new worker without heartbeat
	reg.Register("worker-new", "http://new:8080", []int32{20})
	// Don't send heartbeat for new worker

	// CONTRACT: Even though old worker has fresher heartbeat, new worker should be returned
	// because it was registered more recently
	worker, err := reg.GetWorkerForPartition(20)
	if err != nil {
		t.Fatalf("Failed to get worker: %v", err)
	}

	if worker.WorkerID != "worker-new" {
		t.Errorf("CONTRACT VIOLATION: Newest registration should win regardless of heartbeat freshness, got %s", worker.WorkerID)
	}
}

func TestContract_GetWorkerForPartition_ReturnsErrorForUnassignedPartition(t *testing.T) {
	reg := NewInMemoryRegistry(30 * time.Second)

	// Register worker with some partitions
	reg.Register("worker-1", "http://w1:8080", []int32{1, 2, 3})

	// CONTRACT: Requesting unassigned partition should return error
	_, err := reg.GetWorkerForPartition(99)
	if err == nil {
		t.Error("CONTRACT VIOLATION: Expected error for unassigned partition, got nil")
	}
	if err != ErrNoWorkerForPartition {
		t.Errorf("CONTRACT VIOLATION: Expected ErrNoWorkerForPartition, got %v", err)
	}
}

