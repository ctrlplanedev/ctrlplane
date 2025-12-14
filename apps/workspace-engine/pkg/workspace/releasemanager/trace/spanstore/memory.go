package spanstore

import (
	"context"
	"sync"

	sdktrace "go.opentelemetry.io/otel/sdk/trace"
)

// InMemoryStore implements trace.PersistenceStore for testing
type InMemoryStore struct {
	mu    sync.Mutex
	spans []sdktrace.ReadOnlySpan
}

// NewInMemoryStore creates a new in-memory trace store for testing
func NewInMemoryStore() *InMemoryStore {
	return &InMemoryStore{
		spans: make([]sdktrace.ReadOnlySpan, 0),
	}
}

// WriteSpans stores spans in memory
func (s *InMemoryStore) WriteSpans(ctx context.Context, spans []sdktrace.ReadOnlySpan) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.spans = append(s.spans, spans...)
	return nil
}

// GetSpans returns all stored spans (for testing)
func (s *InMemoryStore) GetSpans() []sdktrace.ReadOnlySpan {
	s.mu.Lock()
	defer s.mu.Unlock()
	result := make([]sdktrace.ReadOnlySpan, len(s.spans))
	copy(result, s.spans)
	return result
}

// Clear removes all stored spans (for testing)
func (s *InMemoryStore) Clear() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.spans = make([]sdktrace.ReadOnlySpan, 0)
}
