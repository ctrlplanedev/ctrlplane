package registry

import (
	"sync"
	"time"
)

// InMemoryRegistry is a thread-safe in-memory implementation of WorkerRegistry
type InMemoryRegistry struct {
	workers          map[string]*WorkerInfo
	partitionWorkers map[int32]string // partition -> workerID
	mu               sync.RWMutex
	heartbeatTimeout int
}

// NewInMemoryRegistry creates a new in-memory worker registry
func NewInMemoryRegistry(heartbeatTimeout int) *InMemoryRegistry {
	return &InMemoryRegistry{
		workers:          make(map[string]*WorkerInfo),
		partitionWorkers: make(map[int32]string),
		heartbeatTimeout: heartbeatTimeout,
	}
}

// Register adds or updates a worker in the registry
func (r *InMemoryRegistry) Register(workerID, httpAddress string, partitions []int32) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	now := time.Now()
	
	worker, exists := r.workers[workerID]
	if exists {
		// Update existing worker
		// Clear old partition mappings
		for _, partition := range worker.Partitions {
			if r.partitionWorkers[partition] == workerID {
				delete(r.partitionWorkers, partition)
			}
		}
		worker.HTTPAddress = httpAddress
		worker.Partitions = partitions
		worker.LastHeartbeat = now
	} else {
		// Create new worker
		worker = &WorkerInfo{
			WorkerID:      workerID,
			HTTPAddress:   httpAddress,
			Partitions:    partitions,
			LastHeartbeat: now,
			RegisteredAt:  now,
		}
		r.workers[workerID] = worker
	}

	// Update partition mappings
	for _, partition := range partitions {
		r.partitionWorkers[partition] = workerID
	}

	return nil
}

// Heartbeat updates the last heartbeat time for a worker
func (r *InMemoryRegistry) Heartbeat(workerID string) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	worker, exists := r.workers[workerID]
	if !exists {
		return ErrWorkerNotFound
	}

	worker.LastHeartbeat = time.Now()
	return nil
}

// GetWorkerForPartition returns the worker assigned to the given partition
func (r *InMemoryRegistry) GetWorkerForPartition(partition int32) (*WorkerInfo, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	workerID, exists := r.partitionWorkers[partition]
	if !exists {
		return nil, ErrNoWorkerForPartition
	}

	worker, exists := r.workers[workerID]
	if !exists {
		// Inconsistent state - partition mapping exists but worker doesn't
		return nil, ErrWorkerNotFound
	}

	// Check if worker is healthy
	if !worker.IsHealthy(r.heartbeatTimeout) {
		return nil, ErrWorkerNotFound
	}

	// Return a copy to avoid race conditions
	workerCopy := *worker
	return &workerCopy, nil
}

// ListWorkers returns all registered workers
func (r *InMemoryRegistry) ListWorkers() ([]WorkerInfo, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	workers := make([]WorkerInfo, 0, len(r.workers))
	for _, worker := range r.workers {
		// Only include healthy workers
		if worker.IsHealthy(r.heartbeatTimeout) {
			workers = append(workers, *worker)
		}
	}

	return workers, nil
}

// Unregister removes a worker from the registry
func (r *InMemoryRegistry) Unregister(workerID string) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	worker, exists := r.workers[workerID]
	if !exists {
		return ErrWorkerNotFound
	}

	// Remove partition mappings
	for _, partition := range worker.Partitions {
		if r.partitionWorkers[partition] == workerID {
			delete(r.partitionWorkers, partition)
		}
	}

	// Remove worker
	delete(r.workers, workerID)
	return nil
}

// CleanupStaleWorkers removes workers that haven't sent a heartbeat within the timeout
// This should be called periodically by a background goroutine
func (r *InMemoryRegistry) CleanupStaleWorkers() int {
	r.mu.Lock()
	defer r.mu.Unlock()

	staleWorkers := make([]string, 0)
	for workerID, worker := range r.workers {
		if !worker.IsHealthy(r.heartbeatTimeout) {
			staleWorkers = append(staleWorkers, workerID)
		}
	}

	// Remove stale workers
	for _, workerID := range staleWorkers {
		worker := r.workers[workerID]
		
		// Remove partition mappings
		for _, partition := range worker.Partitions {
			if r.partitionWorkers[partition] == workerID {
				delete(r.partitionWorkers, partition)
			}
		}
		
		// Remove worker
		delete(r.workers, workerID)
	}

	return len(staleWorkers)
}

