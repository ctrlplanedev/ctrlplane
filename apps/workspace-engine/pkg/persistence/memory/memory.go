package memory

import (
	"context"
	"sync"
	"time"

	"workspace-engine/pkg/persistence"
)

// Store is an in-memory implementation of ChangelogStore
// Thread-safe and suitable for testing or development
type Store struct {
	mu      sync.RWMutex
	changes map[string]persistence.Changelog // workspaceID -> changes
}

// NewStore creates a new in-memory changelog store
func NewStore() *Store {
	return &Store{
		changes: make(map[string]persistence.Changelog),
	}
}

// Append adds changes to the in-memory store
func (s *Store) Append(ctx context.Context, changes persistence.Changelog) error {
	if len(changes) == 0 {
		return nil
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	// Set timestamps if not provided
	for i := range changes {
		if changes[i].Timestamp.IsZero() {
			changes[i].Timestamp = time.Now()
		}
	}

	for _, change := range changes {
		s.changes[change.WorkspaceID] = append(s.changes[change.WorkspaceID], change)
	}
	return nil
}

// LoadAll retrieves all changes for a workspace
func (s *Store) LoadAll(ctx context.Context, workspaceID string) (persistence.Changelog, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	changes := s.changes[workspaceID]
	if changes == nil {
		return persistence.Changelog{}, nil
	}

	// Return a copy to prevent external modifications
	result := make(persistence.Changelog, len(changes))
	copy(result, changes)
	return result, nil
}

// Close closes the store (no-op for in-memory implementation)
func (s *Store) Close() error {
	return nil
}

// Clear removes all changes (useful for testing)
func (s *Store) Clear() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.changes = make(map[string]persistence.Changelog)
}

// WorkspaceCount returns the number of workspaces in the store
func (s *Store) WorkspaceCount() int {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return len(s.changes)
}

// ChangeCount returns the total number of changes for a workspace
func (s *Store) ChangeCount(workspaceID string) int {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return len(s.changes[workspaceID])
}
