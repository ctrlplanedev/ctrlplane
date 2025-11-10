package trace

import (
	"context"
	"testing"
	"time"

	"go.opentelemetry.io/otel/attribute"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	"go.opentelemetry.io/otel/trace"
)

func TestInMemoryExporter_Creation(t *testing.T) {
	exporter := newInMemoryExporter()

	if exporter == nil {
		t.Fatal("expected non-nil exporter")
	}

	if exporter.spans == nil {
		t.Error("expected spans slice to be initialized")
	}

	if len(exporter.spans) != 0 {
		t.Errorf("expected empty spans slice, got %d spans", len(exporter.spans))
	}
}

func TestInMemoryExporter_OnEnd(t *testing.T) {
	exporter := newInMemoryExporter()

	// Create a tracer provider with the exporter
	tp := sdktrace.NewTracerProvider(
		sdktrace.WithSpanProcessor(exporter),
	)
	tracer := tp.Tracer("test")

	// Create and end a span
	ctx := context.Background()
	_, span := tracer.Start(ctx, "test-span",
		trace.WithAttributes(
			attribute.String("test-key", "test-value"),
		),
	)
	span.End()

	// Force flush
	_ = tp.ForceFlush(ctx)

	// Check that span was collected
	spans := exporter.getSpans()
	if len(spans) != 1 {
		t.Fatalf("expected 1 span, got %d", len(spans))
	}

	if spans[0].Name() != "test-span" {
		t.Errorf("expected span name 'test-span', got '%s'", spans[0].Name())
	}
}

func TestInMemoryExporter_MultipleSpans(t *testing.T) {
	exporter := newInMemoryExporter()

	tp := sdktrace.NewTracerProvider(
		sdktrace.WithSpanProcessor(exporter),
	)
	tracer := tp.Tracer("test")
	ctx := context.Background()

	// Create multiple spans
	spanNames := []string{"span1", "span2", "span3", "span4", "span5"}

	for _, name := range spanNames {
		_, span := tracer.Start(ctx, name)
		span.End()
	}

	_ = tp.ForceFlush(ctx)

	// Verify all spans were collected
	spans := exporter.getSpans()
	if len(spans) != len(spanNames) {
		t.Fatalf("expected %d spans, got %d", len(spanNames), len(spans))
	}

	// Verify span names
	for i, span := range spans {
		if span.Name() != spanNames[i] {
			t.Errorf("span %d: expected name '%s', got '%s'", i, spanNames[i], span.Name())
		}
	}
}

func TestInMemoryExporter_NestedSpans(t *testing.T) {
	exporter := newInMemoryExporter()

	tp := sdktrace.NewTracerProvider(
		sdktrace.WithSpanProcessor(exporter),
	)
	tracer := tp.Tracer("test")

	// Create nested spans
	ctx := context.Background()
	ctx1, parent := tracer.Start(ctx, "parent")
	ctx2, child1 := tracer.Start(ctx1, "child1")
	_, child2 := tracer.Start(ctx2, "child2")

	child2.End()
	child1.End()
	parent.End()

	_ = tp.ForceFlush(ctx)

	// Verify all spans were collected
	spans := exporter.getSpans()
	if len(spans) != 3 {
		t.Fatalf("expected 3 spans, got %d", len(spans))
	}

	// Verify parent-child relationships
	childSpan := spans[0] // child2
	if !childSpan.Parent().IsValid() {
		t.Error("child2 should have a parent")
	}
}

func TestInMemoryExporter_OnStart(t *testing.T) {
	exporter := newInMemoryExporter()

	// OnStart should be a no-op
	exporter.OnStart(context.Background(), nil)

	// Should not panic or cause issues
	spans := exporter.getSpans()
	if len(spans) != 0 {
		t.Error("OnStart should not add spans")
	}
}

func TestInMemoryExporter_Shutdown(t *testing.T) {
	exporter := newInMemoryExporter()
	ctx := context.Background()

	err := exporter.Shutdown(ctx)
	if err != nil {
		t.Errorf("Shutdown returned error: %v", err)
	}

	// Should still be able to get spans after shutdown
	spans := exporter.getSpans()
	if spans == nil {
		t.Error("getSpans returned nil after shutdown")
	}
}

func TestInMemoryExporter_ForceFlush(t *testing.T) {
	exporter := newInMemoryExporter()
	ctx := context.Background()

	err := exporter.ForceFlush(ctx)
	if err != nil {
		t.Errorf("ForceFlush returned error: %v", err)
	}
}

func TestInMemoryExporter_Concurrency(t *testing.T) {
	exporter := newInMemoryExporter()

	tp := sdktrace.NewTracerProvider(
		sdktrace.WithSpanProcessor(exporter),
	)
	tracer := tp.Tracer("test")
	ctx := context.Background()

	// Create spans concurrently
	done := make(chan bool)
	numGoroutines := 10
	spansPerGoroutine := 10

	for i := 0; i < numGoroutines; i++ {
		go func(id int) {
			for j := 0; j < spansPerGoroutine; j++ {
				_, span := tracer.Start(ctx, "concurrent-span")
				span.End()
			}
			done <- true
		}(i)
	}

	// Wait for all goroutines
	for i := 0; i < numGoroutines; i++ {
		<-done
	}

	_ = tp.ForceFlush(ctx)

	// Verify all spans were collected
	spans := exporter.getSpans()
	expectedCount := numGoroutines * spansPerGoroutine
	if len(spans) != expectedCount {
		t.Errorf("expected %d spans, got %d", expectedCount, len(spans))
	}
}

func TestInMemoryExporter_SpanAttributes(t *testing.T) {
	exporter := newInMemoryExporter()

	tp := sdktrace.NewTracerProvider(
		sdktrace.WithSpanProcessor(exporter),
	)
	tracer := tp.Tracer("test")
	ctx := context.Background()

	// Create span with attributes
	_, span := tracer.Start(ctx, "test-span",
		trace.WithAttributes(
			attribute.String("key1", "value1"),
			attribute.Int("key2", 42),
			attribute.Bool("key3", true),
		),
	)
	span.End()

	_ = tp.ForceFlush(ctx)

	spans := exporter.getSpans()
	if len(spans) != 1 {
		t.Fatalf("expected 1 span, got %d", len(spans))
	}

	// Verify attributes
	attrs := spans[0].Attributes()
	if len(attrs) < 3 {
		t.Errorf("expected at least 3 attributes, got %d", len(attrs))
	}
}

func TestInMemoryExporter_GetSpans_ThreadSafe(t *testing.T) {
	exporter := newInMemoryExporter()

	tp := sdktrace.NewTracerProvider(
		sdktrace.WithSpanProcessor(exporter),
	)
	tracer := tp.Tracer("test")
	ctx := context.Background()

	// Add spans while reading
	done := make(chan bool)

	go func() {
		for i := 0; i < 100; i++ {
			_, span := tracer.Start(ctx, "span")
			span.End()
			time.Sleep(time.Microsecond)
		}
		done <- true
	}()

	go func() {
		for i := 0; i < 100; i++ {
			_ = exporter.getSpans()
			time.Sleep(time.Microsecond)
		}
		done <- true
	}()

	<-done
	<-done

	// Should not panic
}

