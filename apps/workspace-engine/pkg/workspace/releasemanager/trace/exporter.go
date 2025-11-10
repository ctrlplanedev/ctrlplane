package trace

import (
	"context"
	"sync"

	sdktrace "go.opentelemetry.io/otel/sdk/trace"
)

// inMemoryExporter collects spans in memory for later persistence
// Implements SpanProcessor interface for synchronous span collection
type inMemoryExporter struct {
	mu    sync.Mutex
	spans []sdktrace.ReadOnlySpan
}

func newInMemoryExporter() *inMemoryExporter {
	return &inMemoryExporter{
		spans: make([]sdktrace.ReadOnlySpan, 0),
	}
}

// OnStart is called when a span starts (no-op)
func (e *inMemoryExporter) OnStart(parent context.Context, s sdktrace.ReadWriteSpan) {}

// OnEnd is called when a span ends - collect it
func (e *inMemoryExporter) OnEnd(s sdktrace.ReadOnlySpan) {
	if s == nil {
		return
	}
	e.mu.Lock()
	defer e.mu.Unlock()
	e.spans = append(e.spans, s)
}

// Shutdown stops the exporter
func (e *inMemoryExporter) Shutdown(ctx context.Context) error {
	return nil
}

// ForceFlush is a no-op for in-memory collection
func (e *inMemoryExporter) ForceFlush(ctx context.Context) error {
	return nil
}

// getSpans returns all collected spans
func (e *inMemoryExporter) getSpans() []sdktrace.ReadOnlySpan {
	e.mu.Lock()
	defer e.mu.Unlock()
	result := make([]sdktrace.ReadOnlySpan, len(e.spans))
	copy(result, e.spans)
	return result
}

