package registry

import "errors"

var (
	ErrWorkerNotFound       = errors.New("worker not found")
	ErrNoWorkerForPartition = errors.New("no worker assigned to partition")
)

// WorkerRegistry is an interface for managing workspace-engine worker registrations
type WorkerRegistry interface {
	// Register adds or updates a worker in the registry
	Register(workerID, httpAddress string, partitions []int32) error

	// Heartbeat updates the last heartbeat time for a worker
	Heartbeat(workerID string, httpAddress string, partitions []int32) error

	// GetWorkerForPartition returns the worker assigned to the given partition
	GetWorkerForPartition(partition int32) (*WorkerInfo, error)

	// ListWorkers returns all registered workers
	ListWorkers() ([]WorkerInfo, error)

	// Unregister removes a worker from the registry
	Unregister(workerID string) error
}
