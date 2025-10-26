package status

import (
	"sync"
)

// Tracker manages status for all workspaces
type Tracker struct {
	statuses map[string]*WorkspaceStatus
	mu       sync.RWMutex
}

// NewTracker creates a new status tracker
func NewTracker() *Tracker {
	return &Tracker{
		statuses: make(map[string]*WorkspaceStatus),
	}
}

// GetOrCreate gets existing status or creates a new one
func (t *Tracker) GetOrCreate(workspaceID string) *WorkspaceStatus {
	t.mu.Lock()
	defer t.mu.Unlock()

	if status, exists := t.statuses[workspaceID]; exists {
		return status
	}

	status := NewWorkspaceStatus(workspaceID)
	t.statuses[workspaceID] = status
	return status
}

// Get retrieves the status for a workspace
func (t *Tracker) Get(workspaceID string) (*WorkspaceStatus, bool) {
	t.mu.RLock()
	defer t.mu.RUnlock()

	status, exists := t.statuses[workspaceID]
	return status, exists
}

// GetSnapshot returns a snapshot of the status
func (t *Tracker) GetSnapshot(workspaceID string) (WorkspaceStatus, bool) {
	t.mu.RLock()
	defer t.mu.RUnlock()

	status, exists := t.statuses[workspaceID]
	if !exists {
		return WorkspaceStatus{}, false
	}

	return status.GetSnapshot(), true
}

// ListAll returns snapshots of all workspace statuses
func (t *Tracker) ListAll() []WorkspaceStatus {
	t.mu.RLock()
	defer t.mu.RUnlock()

	snapshots := make([]WorkspaceStatus, 0, len(t.statuses))
	for _, status := range t.statuses {
		snapshots = append(snapshots, status.GetSnapshot())
	}

	return snapshots
}

// Remove removes a workspace status
func (t *Tracker) Remove(workspaceID string) {
	t.mu.Lock()
	defer t.mu.Unlock()

	delete(t.statuses, workspaceID)
}

// Count returns the number of tracked workspaces
func (t *Tracker) Count() int {
	t.mu.RLock()
	defer t.mu.RUnlock()

	return len(t.statuses)
}

// CountByState returns the number of workspaces in each state
func (t *Tracker) CountByState() map[WorkspaceState]int {
	t.mu.RLock()
	defer t.mu.RUnlock()

	counts := make(map[WorkspaceState]int)
	for _, status := range t.statuses {
		state := status.GetState()
		counts[state]++
	}

	return counts
}

// Global status tracker instance
var globalTracker = NewTracker()

// Global returns the global status tracker
func Global() *Tracker {
	return globalTracker
}
