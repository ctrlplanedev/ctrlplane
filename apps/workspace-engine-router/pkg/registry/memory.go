package registry

import (
	"sync"
	"time"

	"github.com/charmbracelet/log"
)

// InMemoryRegistry is a thread-safe in-memory implementation of WorkerRegistry
type InMemoryRegistry struct {
	workers          map[string]*WorkerInfo
	partitionWorkers map[int32]string // partition -> workerID
	mu               sync.RWMutex
	heartbeatTimeout time.Duration
}

// NewInMemoryRegistry creates a new in-memory worker registry
func NewInMemoryRegistry(heartbeatTimeout time.Duration) *InMemoryRegistry {
	return &InMemoryRegistry{
		workers:          make(map[string]*WorkerInfo),
		partitionWorkers: make(map[int32]string),
		heartbeatTimeout: heartbeatTimeout,
	}
}

// Register adds or updates a worker in the registry
// When multiple workers claim the same partition, the newest worker (by registration time) takes over
func (r *InMemoryRegistry) Register(workerID, httpAddress string, partitions []int32) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	now := time.Now()
	
	worker, exists := r.workers[workerID]
	if exists {
		// Update existing worker
		// Clear old partition mappings for this worker
		for _, partition := range worker.Partitions {
			if r.partitionWorkers[partition] == workerID {
				delete(r.partitionWorkers, partition)
			}
		}
		worker.HTTPAddress = httpAddress
		worker.Partitions = partitions
		worker.LastHeartbeat = now
		// Keep original RegisteredAt for existing workers
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

	// Detect partition conflicts and assign partitions to newest worker
	conflictingWorkers := make(map[string][]int32) // workerID -> partitions being taken
	
	for _, partition := range partitions {
		if existingWorkerID, exists := r.partitionWorkers[partition]; exists && existingWorkerID != workerID {
			// Partition conflict detected
			existingWorker := r.workers[existingWorkerID]
			
			// Compare registration times - newest worker wins
			if worker.RegisteredAt.After(existingWorker.RegisteredAt) {
				// New worker is newer, take over the partition
				log.Warn("Partition conflict: newer worker taking over",
					"partition", partition,
					"old_worker", existingWorkerID,
					"old_worker_registered_at", existingWorker.RegisteredAt,
					"new_worker", workerID,
					"new_worker_registered_at", worker.RegisteredAt)
				
				conflictingWorkers[existingWorkerID] = append(conflictingWorkers[existingWorkerID], partition)
				r.partitionWorkers[partition] = workerID
			} else {
				// Existing worker is newer, keep it
				log.Warn("Partition conflict: keeping newer existing worker",
					"partition", partition,
					"existing_worker", existingWorkerID,
					"existing_worker_registered_at", existingWorker.RegisteredAt,
					"rejected_worker", workerID,
					"rejected_worker_registered_at", worker.RegisteredAt)
			}
		} else {
			// No conflict, assign partition to this worker
			r.partitionWorkers[partition] = workerID
		}
	}
	
	// Remove partitions from conflicting workers' partition lists
	for conflictingWorkerID, takenPartitions := range conflictingWorkers {
		if conflictingWorker, exists := r.workers[conflictingWorkerID]; exists {
			// Remove taken partitions from worker's partition list
			newPartitions := make([]int32, 0, len(conflictingWorker.Partitions))
			for _, p := range conflictingWorker.Partitions {
				taken := false
				for _, tp := range takenPartitions {
					if p == tp {
						taken = true
						break
					}
				}
				if !taken {
					newPartitions = append(newPartitions, p)
				}
			}
			conflictingWorker.Partitions = newPartitions
			
			// If worker has no partitions left, unregister it
			if len(conflictingWorker.Partitions) == 0 {
				log.Info("Unregistering worker with no remaining partitions",
					"worker_id", conflictingWorkerID)
				delete(r.workers, conflictingWorkerID)
			}
		}
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

