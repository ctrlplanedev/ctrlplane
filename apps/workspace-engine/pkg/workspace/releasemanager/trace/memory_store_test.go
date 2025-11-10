package trace

import (
	"context"
	"sync"
	"testing"

	sdktrace "go.opentelemetry.io/otel/sdk/trace"
)

func TestNewInMemoryStore(t *testing.T) {
	store := NewInMemoryStore()

	if store == nil {
		t.Fatal("expected non-nil store")
	}

	if store.spans == nil {
		t.Error("expected spans slice to be initialized")
	}

	if len(store.spans) != 0 {
		t.Error("expected empty spans slice")
	}
}

func TestInMemoryStore_WriteSpans(t *testing.T) {
	store := NewInMemoryStore()
	ctx := context.Background()

	// Create a test trace
	rt := NewReconcileTarget("workspace-1", "api-service-production")
	planning := rt.StartPlanning()
	planning.End()
	rt.Complete(StatusCompleted)

	// Get spans from the recorder
	spans := rt.exporter.getSpans()
	if len(spans) == 0 {
		t.Fatal("expected spans from recorder")
	}

	// Write to store
	err := store.WriteSpans(ctx, spans)
	if err != nil {
		t.Fatalf("WriteSpans failed: %v", err)
	}

	// Verify spans were stored
	storedSpans := store.GetSpans()
	if len(storedSpans) != len(spans) {
		t.Errorf("expected %d spans, got %d", len(spans), len(storedSpans))
	}
}

func TestInMemoryStore_WriteSpansEmpty(t *testing.T) {
	store := NewInMemoryStore()
	ctx := context.Background()

	// Write empty spans
	err := store.WriteSpans(ctx, []sdktrace.ReadOnlySpan{})
	if err != nil {
		t.Fatalf("WriteSpans with empty slice should not fail: %v", err)
	}

	// Store should still be empty
	spans := store.GetSpans()
	if len(spans) != 0 {
		t.Errorf("expected 0 spans, got %d", len(spans))
	}
}

func TestInMemoryStore_GetSpans(t *testing.T) {
	store := NewInMemoryStore()
	ctx := context.Background()

	// Write some spans
	rt := NewReconcileTarget("workspace-1", "api-service-production")
	rt.Complete(StatusCompleted)
	spans := rt.exporter.getSpans()
	
	err := store.WriteSpans(ctx, spans)
	if err != nil {
		t.Fatalf("WriteSpans failed: %v", err)
	}

	// Get spans
	retrieved := store.GetSpans()

	if len(retrieved) != len(spans) {
		t.Errorf("expected %d spans, got %d", len(spans), len(retrieved))
	}

	// Verify spans match
	for i, span := range spans {
		if retrieved[i].SpanContext().SpanID() != span.SpanContext().SpanID() {
			t.Errorf("span %d ID mismatch", i)
		}
	}
}

func TestInMemoryStore_GetSpansCopy(t *testing.T) {
	store := NewInMemoryStore()
	ctx := context.Background()

	// Write some spans
	rt := NewReconcileTarget("workspace-1", "api-service-production")
	rt.Complete(StatusCompleted)
	spans := rt.exporter.getSpans()
	
	err := store.WriteSpans(ctx, spans)
	if err != nil {
		t.Fatalf("WriteSpans failed: %v", err)
	}

	// Get spans twice
	spans1 := store.GetSpans()
	spans2 := store.GetSpans()

	// Should be copies, not the same slice
	if &spans1[0] == &spans2[0] {
		t.Error("GetSpans should return copies, not same slice")
	}

	// But content should match
	if len(spans1) != len(spans2) {
		t.Error("span counts should match")
	}
}

func TestInMemoryStore_Clear(t *testing.T) {
	store := NewInMemoryStore()
	ctx := context.Background()

	// Write some spans
	rt := NewReconcileTarget("workspace-1", "api-service-production")
	planning := rt.StartPlanning()
	planning.End()
	rt.Complete(StatusCompleted)
	spans := rt.exporter.getSpans()
	
	err := store.WriteSpans(ctx, spans)
	if err != nil {
		t.Fatalf("WriteSpans failed: %v", err)
	}

	// Verify spans exist
	if len(store.GetSpans()) == 0 {
		t.Fatal("expected spans before clear")
	}

	// Clear store
	store.Clear()

	// Verify spans are gone
	if len(store.GetSpans()) != 0 {
		t.Error("expected 0 spans after clear")
	}
}

func TestInMemoryStore_ConcurrentWrites(t *testing.T) {
	store := NewInMemoryStore()
	ctx := context.Background()

	var wg sync.WaitGroup
	numGoroutines := 10

	// Write spans concurrently
	for i := 0; i < numGoroutines; i++ {
		wg.Add(1)
		go func(id int) {
			defer wg.Done()

			rt := NewReconcileTarget("workspace-1", "test")
			planning := rt.StartPlanning()
			planning.End()
			rt.Complete(StatusCompleted)
			spans := rt.exporter.getSpans()

			if err := store.WriteSpans(ctx, spans); err != nil {
				t.Errorf("goroutine %d: WriteSpans failed: %v", id, err)
			}
		}(i)
	}

	wg.Wait()

	// All spans should be stored
	allSpans := store.GetSpans()
	
	// We expect at least numGoroutines * 2 spans (root + planning per goroutine)
	expectedMin := numGoroutines * 2
	if len(allSpans) < expectedMin {
		t.Errorf("expected at least %d spans from concurrent writes, got %d", expectedMin, len(allSpans))
	}
}

func TestInMemoryStore_ConcurrentReads(t *testing.T) {
	store := NewInMemoryStore()
	ctx := context.Background()

	// Write initial spans
	rt := NewReconcileTarget("workspace-1", "test")
	planning := rt.StartPlanning()
	planning.End()
	rt.Complete(StatusCompleted)
	spans := rt.exporter.getSpans()
	
	if err := store.WriteSpans(ctx, spans); err != nil {
		t.Fatalf("WriteSpans failed: %v", err)
	}

	var wg sync.WaitGroup
	numReaders := 20

	// Read concurrently
	for i := 0; i < numReaders; i++ {
		wg.Add(1)
		go func(id int) {
			defer wg.Done()
			
			retrieved := store.GetSpans()
			if len(retrieved) == 0 {
				t.Errorf("reader %d: expected non-empty spans", id)
			}
		}(i)
	}

	wg.Wait()
}

func TestInMemoryStore_ConcurrentReadWrite(t *testing.T) {
	store := NewInMemoryStore()
	ctx := context.Background()

	var wg sync.WaitGroup
	numWriters := 5
	numReaders := 10

	// Concurrent writers
	for i := 0; i < numWriters; i++ {
		wg.Add(1)
		go func(id int) {
			defer wg.Done()

			rt := NewReconcileTarget("workspace-1", "test")
			rt.Complete(StatusCompleted)
			spans := rt.exporter.getSpans()

			if err := store.WriteSpans(ctx, spans); err != nil {
				t.Errorf("writer %d: WriteSpans failed: %v", id, err)
			}
		}(i)
	}

	// Concurrent readers
	for i := 0; i < numReaders; i++ {
		wg.Add(1)
		go func(id int) {
			defer wg.Done()
			
			// Just read, don't validate count since writes are happening
			_ = store.GetSpans()
		}(i)
	}

	wg.Wait()

	// Final verification - all writes should be present
	finalSpans := store.GetSpans()
	if len(finalSpans) < numWriters {
		t.Errorf("expected at least %d spans after concurrent read/write, got %d", numWriters, len(finalSpans))
	}
}

func TestInMemoryStore_MultipleWrites(t *testing.T) {
	store := NewInMemoryStore()
	ctx := context.Background()

	// Write first batch
	rt1 := NewReconcileTarget("workspace-1", "test-1")
	rt1.Complete(StatusCompleted)
	spans1 := rt1.exporter.getSpans()
	
	err := store.WriteSpans(ctx, spans1)
	if err != nil {
		t.Fatalf("first WriteSpans failed: %v", err)
	}

	count1 := len(store.GetSpans())

	// Write second batch
	rt2 := NewReconcileTarget("workspace-1", "test-2")
	rt2.Complete(StatusCompleted)
	spans2 := rt2.exporter.getSpans()
	
	err = store.WriteSpans(ctx, spans2)
	if err != nil {
		t.Fatalf("second WriteSpans failed: %v", err)
	}

	count2 := len(store.GetSpans())

	// Second count should be greater than first
	if count2 <= count1 {
		t.Errorf("expected spans to accumulate: first=%d, second=%d", count1, count2)
	}

	// Should have both batches
	expectedTotal := len(spans1) + len(spans2)
	if count2 != expectedTotal {
		t.Errorf("expected %d total spans, got %d", expectedTotal, count2)
	}
}

func TestInMemoryStore_LargeBatch(t *testing.T) {
	store := NewInMemoryStore()
	ctx := context.Background()

	// Create a trace with many spans
	rt := NewReconcileTarget("workspace-1", "test")
	planning := rt.StartPlanning()
	
	// Create many evaluations
	for i := 0; i < 100; i++ {
		eval := planning.StartEvaluation("Policy")
		eval.SetResult(ResultAllowed, "Approved")
		eval.End()
	}
	
	planning.End()
	rt.Complete(StatusCompleted)

	spans := rt.exporter.getSpans()
	
	err := store.WriteSpans(ctx, spans)
	if err != nil {
		t.Fatalf("WriteSpans failed: %v", err)
	}

	// Verify all spans stored
	storedSpans := store.GetSpans()
	if len(storedSpans) != len(spans) {
		t.Errorf("expected %d spans, got %d", len(spans), len(storedSpans))
	}

	// Should have at least 102 spans (root + planning + 100 evaluations)
	if len(storedSpans) < 102 {
		t.Errorf("expected at least 102 spans, got %d", len(storedSpans))
	}
}

func TestInMemoryStore_PreservesSpanData(t *testing.T) {
	store := NewInMemoryStore()
	ctx := context.Background()

	// Create trace with metadata
	rt := NewReconcileTarget("workspace-1", "api-service-production")
	planning := rt.StartPlanning()
	eval := planning.StartEvaluation("Test Policy")
	eval.AddMetadata("key1", "value1")
	eval.AddMetadata("key2", 42)
	eval.SetResult(ResultAllowed, "Approved")
	eval.End()
	planning.End()
	rt.Complete(StatusCompleted)

	spans := rt.exporter.getSpans()
	
	err := store.WriteSpans(ctx, spans)
	if err != nil {
		t.Fatalf("WriteSpans failed: %v", err)
	}

	// Retrieve and verify span data
	storedSpans := store.GetSpans()
	
	// Find the evaluation span
	var evalSpan sdktrace.ReadOnlySpan
	for _, span := range storedSpans {
		if span.Name() == "Test Policy" {
			evalSpan = span
			break
		}
	}

	if evalSpan == nil {
		t.Fatal("evaluation span not found")
	}

	// Verify events (metadata) are preserved
	events := evalSpan.Events()
	if len(events) != 2 {
		t.Errorf("expected 2 events, got %d", len(events))
	}

	// Verify attributes are preserved
	hasStatus := false
	hasResult := false
	for _, attr := range evalSpan.Attributes() {
		if string(attr.Key) == "ctrlplane.status" {
			hasStatus = true
		}
		if string(attr.Key) == "ctrlplane.result" {
			hasResult = true
		}
	}

	if !hasStatus {
		t.Error("status attribute not preserved")
	}
	if !hasResult {
		t.Error("result attribute not preserved")
	}
}

func TestInMemoryStore_ClearAfterMultipleWrites(t *testing.T) {
	store := NewInMemoryStore()
	ctx := context.Background()

	// Write multiple batches
	for i := 0; i < 5; i++ {
		rt := NewReconcileTarget("workspace-1", "test")
		rt.Complete(StatusCompleted)
		spans := rt.exporter.getSpans()
		
		if err := store.WriteSpans(ctx, spans); err != nil {
			t.Fatalf("WriteSpans %d failed: %v", i, err)
		}
	}

	// Verify spans exist
	if len(store.GetSpans()) == 0 {
		t.Fatal("expected spans before clear")
	}

	// Clear
	store.Clear()

	// Verify empty
	if len(store.GetSpans()) != 0 {
		t.Error("expected 0 spans after clear")
	}

	// Write again after clear
	rt := NewReconcileTarget("workspace-1", "test")
	rt.Complete(StatusCompleted)
	spans := rt.exporter.getSpans()
	
	if err := store.WriteSpans(ctx, spans); err != nil {
		t.Fatalf("WriteSpans after clear failed: %v", err)
	}

	// Should only have new spans
	newSpans := store.GetSpans()
	if len(newSpans) != len(spans) {
		t.Errorf("expected %d spans after clear and write, got %d", len(spans), len(newSpans))
	}
}

func TestInMemoryStore_NilContext(t *testing.T) {
	store := NewInMemoryStore()

	rt := NewReconcileTarget("workspace-1", "test")
	rt.Complete(StatusCompleted)
	spans := rt.exporter.getSpans()

	// WriteSpans should handle nil context
	err := store.WriteSpans(nil, spans)
	if err != nil {
		t.Fatalf("WriteSpans with nil context failed: %v", err)
	}

	// Verify spans were still stored
	if len(store.GetSpans()) != len(spans) {
		t.Error("spans should be stored even with nil context")
	}
}

