package deployment

import (
	"sync"
	"time"
	"workspace-engine/pkg/oapi"
)

// ReconciliationScheduler tracks when release targets need to be reconciled next.
// This is used to optimize tick handling by only reconciling targets that actually
// need time-based re-evaluation (soak time, max age, gradual rollout, etc.)
type ReconciliationScheduler struct {
	mu sync.RWMutex
	// Map from release target key to next reconciliation time
	schedule map[string]time.Time
}

// NewReconciliationScheduler creates a new reconciliation scheduler.
func NewReconciliationScheduler() *ReconciliationScheduler {
	return &ReconciliationScheduler{
		schedule: make(map[string]time.Time),
	}
}

// Schedule sets the next reconciliation time for a release target.
// If a time is already scheduled and is sooner than nextTime, it keeps the sooner time.
func (rs *ReconciliationScheduler) Schedule(releaseTarget *oapi.ReleaseTarget, nextTime time.Time) {
	rs.mu.Lock()
	defer rs.mu.Unlock()

	key := releaseTarget.Key()
	// Only update if new time is sooner than existing schedule
	if existing, ok := rs.schedule[key]; !ok || nextTime.Before(existing) {
		rs.schedule[key] = nextTime
	}
}

// Remove removes a release target from the schedule (e.g., when deleted).
func (rs *ReconciliationScheduler) Remove(releaseTarget *oapi.ReleaseTarget) {
	rs.mu.Lock()
	defer rs.mu.Unlock()
	delete(rs.schedule, releaseTarget.Key())
}

// GetDue returns all release target keys that need reconciliation by the given time.
func (rs *ReconciliationScheduler) GetDue(by time.Time) []string {
	rs.mu.RLock()
	defer rs.mu.RUnlock()

	var dueKeys []string
	for key, nextTime := range rs.schedule {
		if !nextTime.After(by) {
			dueKeys = append(dueKeys, key)
		}
	}
	return dueKeys
}

// Clear removes entries that have been processed.
func (rs *ReconciliationScheduler) Clear(keys []string) {
	rs.mu.Lock()
	defer rs.mu.Unlock()

	for _, key := range keys {
		delete(rs.schedule, key)
	}
}

// GetNextReconciliationTime returns when a specific target needs reconciliation.
func (rs *ReconciliationScheduler) GetNextReconciliationTime(releaseTarget *oapi.ReleaseTarget) (time.Time, bool) {
	rs.mu.RLock()
	defer rs.mu.RUnlock()

	t, ok := rs.schedule[releaseTarget.Key()]
	return t, ok
}

// Size returns the number of scheduled reconciliations.
func (rs *ReconciliationScheduler) Size() int {
	rs.mu.RLock()
	defer rs.mu.RUnlock()
	return len(rs.schedule)
}
