package status

import (
	"sync"
	"time"
)

// WorkspaceState represents the current state of a workspace
type WorkspaceState string

const (
	// StateUnknown indicates the workspace state is unknown
	StateUnknown WorkspaceState = "unknown"

	// StateInitializing indicates the workspace is being created
	StateInitializing WorkspaceState = "initializing"

	// StateLoadingFromPersistence indicates loading from persistent store
	StateLoadingFromPersistence WorkspaceState = "loading_from_persistence"

	// StateLoadingKafkaPartitions indicates Kafka partition assignment in progress
	StateLoadingKafkaPartitions WorkspaceState = "loading_kafka_partitions"

	// StateReplayingEvents indicates replaying events from Kafka
	StateReplayingEvents WorkspaceState = "replaying_events"

	// StatePopulatingInitialState indicates populating initial state
	StatePopulatingInitialState WorkspaceState = "populating_initial_state"

	// StateRestoringFromSnapshot indicates restoring from persistence snapshot
	StateRestoringFromSnapshot WorkspaceState = "restoring_from_snapshot"

	// StateReady indicates the workspace is fully loaded and ready
	StateReady WorkspaceState = "ready"

	// StateError indicates the workspace encountered an error
	StateError WorkspaceState = "error"

	// StateUnloading indicates the workspace is being removed from memory
	StateUnloading WorkspaceState = "unloading"
)

// WorkspaceStatus tracks the current status of a workspace
type WorkspaceStatus struct {
	WorkspaceID  string                 `json:"workspaceId"`
	State        WorkspaceState         `json:"state"`
	Message      string                 `json:"message,omitempty"`
	StateEntered time.Time              `json:"stateEntered"`
	LastUpdated  time.Time              `json:"lastUpdated"`
	ErrorMessage string                 `json:"errorMessage,omitempty"`
	Metadata     map[string]interface{} `json:"metadata,omitempty"`
	StateHistory []StateTransition      `json:"stateHistory,omitempty"`

	mu sync.RWMutex
}

// StateTransition represents a state change
type StateTransition struct {
	FromState WorkspaceState `json:"fromState"`
	ToState   WorkspaceState `json:"toState"`
	Timestamp time.Time      `json:"timestamp"`
	Message   string         `json:"message,omitempty"`
}

// NewWorkspaceStatus creates a new workspace status tracker
func NewWorkspaceStatus(workspaceID string) *WorkspaceStatus {
	now := time.Now()
	return &WorkspaceStatus{
		WorkspaceID:  workspaceID,
		State:        StateInitializing,
		StateEntered: now,
		LastUpdated:  now,
		Metadata:     make(map[string]interface{}),
		StateHistory: []StateTransition{},
	}
}

// SetState updates the workspace state
func (s *WorkspaceStatus) SetState(state WorkspaceState, message string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	// Record state transition
	transition := StateTransition{
		FromState: s.State,
		ToState:   state,
		Timestamp: time.Now(),
		Message:   message,
	}
	s.StateHistory = append(s.StateHistory, transition)

	// Limit history to last 20 transitions
	if len(s.StateHistory) > 20 {
		s.StateHistory = s.StateHistory[len(s.StateHistory)-20:]
	}

	s.State = state
	s.Message = message
	s.StateEntered = time.Now()
	s.LastUpdated = time.Now()
}

// SetError sets the workspace to error state
func (s *WorkspaceStatus) SetError(err error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	transition := StateTransition{
		FromState: s.State,
		ToState:   StateError,
		Timestamp: time.Now(),
		Message:   err.Error(),
	}
	s.StateHistory = append(s.StateHistory, transition)

	if len(s.StateHistory) > 20 {
		s.StateHistory = s.StateHistory[len(s.StateHistory)-20:]
	}

	s.State = StateError
	s.ErrorMessage = err.Error()
	s.StateEntered = time.Now()
	s.LastUpdated = time.Now()
}

// UpdateMetadata updates metadata fields
func (s *WorkspaceStatus) UpdateMetadata(key string, value interface{}) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.Metadata[key] = value
	s.LastUpdated = time.Now()
}

// GetSnapshot returns a thread-safe copy of the current status
func (s *WorkspaceStatus) GetSnapshot() WorkspaceStatus {
	s.mu.RLock()
	defer s.mu.RUnlock()

	// Create a deep copy
	metadata := make(map[string]interface{})
	for k, v := range s.Metadata {
		metadata[k] = v
	}

	history := make([]StateTransition, len(s.StateHistory))
	copy(history, s.StateHistory)

	return WorkspaceStatus{
		WorkspaceID:  s.WorkspaceID,
		State:        s.State,
		Message:      s.Message,
		StateEntered: s.StateEntered,
		LastUpdated:  s.LastUpdated,
		ErrorMessage: s.ErrorMessage,
		Metadata:     metadata,
		StateHistory: history,
	}
}

// IsReady returns true if the workspace is in ready state
func (s *WorkspaceStatus) IsReady() bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.State == StateReady
}

// IsError returns true if the workspace is in error state
func (s *WorkspaceStatus) IsError() bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.State == StateError
}

// GetState returns the current state
func (s *WorkspaceStatus) GetState() WorkspaceState {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.State
}

// TimeInCurrentState returns how long the workspace has been in current state
func (s *WorkspaceStatus) TimeInCurrentState() time.Duration {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return time.Since(s.StateEntered)
}
