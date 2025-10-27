package registry

import "time"

// WorkerInfo represents a registered workspace-engine worker
type WorkerInfo struct {
	WorkerID      string
	HTTPAddress   string
	Partitions    []int32
	LastHeartbeat time.Time
	RegisteredAt  time.Time
}

// IsHealthy checks if the worker's heartbeat is within the timeout
func (w *WorkerInfo) IsHealthy(timeout time.Duration) bool {
	return time.Since(w.LastHeartbeat) < timeout
}
