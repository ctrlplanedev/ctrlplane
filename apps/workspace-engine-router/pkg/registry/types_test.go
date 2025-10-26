package registry

import (
	"testing"
	"time"
)

func TestWorkerInfo_IsHealthy_WithinTimeout(t *testing.T) {
	worker := &WorkerInfo{
		WorkerID:      "worker-1",
		HTTPAddress:   "http://localhost:8080",
		Partitions:    []int32{0, 1, 2},
		LastHeartbeat: time.Now(),
		RegisteredAt:  time.Now(),
	}

	timeout := 30 * time.Second

	if !worker.IsHealthy(timeout) {
		t.Error("Expected worker to be healthy when last heartbeat is current")
	}
}

func TestWorkerInfo_IsHealthy_ExceededTimeout(t *testing.T) {
	worker := &WorkerInfo{
		WorkerID:      "worker-1",
		HTTPAddress:   "http://localhost:8080",
		Partitions:    []int32{0, 1, 2},
		LastHeartbeat: time.Now().Add(-60 * time.Second), // 60 seconds ago
		RegisteredAt:  time.Now().Add(-60 * time.Second),
	}

	timeout := 30 * time.Second

	if worker.IsHealthy(timeout) {
		t.Error("Expected worker to be unhealthy when last heartbeat exceeds timeout")
	}
}

func TestWorkerInfo_IsHealthy_ExactlyAtTimeout(t *testing.T) {
	timeout := 30 * time.Second
	
	worker := &WorkerInfo{
		WorkerID:      "worker-1",
		HTTPAddress:   "http://localhost:8080",
		Partitions:    []int32{0, 1, 2},
		LastHeartbeat: time.Now().Add(-timeout),
		RegisteredAt:  time.Now().Add(-timeout),
	}

	// At exactly the timeout, should be unhealthy (time.Since >= timeout)
	if worker.IsHealthy(timeout) {
		t.Error("Expected worker to be unhealthy when exactly at timeout boundary")
	}
}

func TestWorkerInfo_IsHealthy_JustBeforeTimeout(t *testing.T) {
	timeout := 30 * time.Second
	
	worker := &WorkerInfo{
		WorkerID:      "worker-1",
		HTTPAddress:   "http://localhost:8080",
		Partitions:    []int32{0, 1, 2},
		LastHeartbeat: time.Now().Add(-timeout + 100*time.Millisecond),
		RegisteredAt:  time.Now().Add(-timeout),
	}

	// Just before timeout should still be healthy
	if !worker.IsHealthy(timeout) {
		t.Error("Expected worker to be healthy when just before timeout")
	}
}

func TestWorkerInfo_IsHealthy_ZeroTimeout(t *testing.T) {
	worker := &WorkerInfo{
		WorkerID:      "worker-1",
		HTTPAddress:   "http://localhost:8080",
		Partitions:    []int32{0, 1, 2},
		LastHeartbeat: time.Now(),
		RegisteredAt:  time.Now(),
	}

	// With zero timeout, worker should always be unhealthy
	if worker.IsHealthy(0) {
		t.Error("Expected worker to be unhealthy with zero timeout")
	}
}

func TestWorkerInfo_IsHealthy_VeryShortTimeout(t *testing.T) {
	worker := &WorkerInfo{
		WorkerID:      "worker-1",
		HTTPAddress:   "http://localhost:8080",
		Partitions:    []int32{0, 1, 2},
		LastHeartbeat: time.Now().Add(-10 * time.Millisecond),
		RegisteredAt:  time.Now(),
	}

	timeout := 1 * time.Millisecond

	// With very short timeout, worker should be unhealthy
	if worker.IsHealthy(timeout) {
		t.Error("Expected worker to be unhealthy with very short timeout")
	}
}

func TestWorkerInfo_IsHealthy_VeryLongTimeout(t *testing.T) {
	worker := &WorkerInfo{
		WorkerID:      "worker-1",
		HTTPAddress:   "http://localhost:8080",
		Partitions:    []int32{0, 1, 2},
		LastHeartbeat: time.Now().Add(-5 * time.Minute),
		RegisteredAt:  time.Now().Add(-5 * time.Minute),
	}

	timeout := 24 * time.Hour

	// With very long timeout, worker should be healthy
	if !worker.IsHealthy(timeout) {
		t.Error("Expected worker to be healthy with very long timeout")
	}
}

func TestWorkerInfo_IsHealthy_FutureHeartbeat(t *testing.T) {
	// Edge case: heartbeat in the future (clock skew)
	worker := &WorkerInfo{
		WorkerID:      "worker-1",
		HTTPAddress:   "http://localhost:8080",
		Partitions:    []int32{0, 1, 2},
		LastHeartbeat: time.Now().Add(5 * time.Minute), // 5 minutes in the future
		RegisteredAt:  time.Now(),
	}

	timeout := 30 * time.Second

	// Future heartbeat should be considered healthy (negative time since)
	if !worker.IsHealthy(timeout) {
		t.Error("Expected worker to be healthy with future heartbeat (clock skew)")
	}
}

