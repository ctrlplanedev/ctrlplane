package integration

import (
	"fmt"
	"testing"
	"workspace-engine/pkg/workspace/releasemanager/trace"

	"go.opentelemetry.io/otel/attribute"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
)

// GetAllTraces retrieves all traces from the trace store
func GetAllTraces(tw *TestWorkspace) []sdktrace.ReadOnlySpan {
	return tw.TraceStore().GetSpans()
}

// ClearTraces clears all traces from the store (useful between tests)
func ClearTraces(tw *TestWorkspace) {
	tw.TraceStore().Clear()
}

// FindSpanByName locates a specific span by name in a trace
func FindSpanByName(spans []sdktrace.ReadOnlySpan, name string) (sdktrace.ReadOnlySpan, bool) {
	for _, span := range spans {
		if span.Name() == name {
			return span, true
		}
	}
	return nil, false
}

// FindSpansByPhase finds all spans for a specific phase
func FindSpansByPhase(spans []sdktrace.ReadOnlySpan, phase trace.Phase) []sdktrace.ReadOnlySpan {
	var result []sdktrace.ReadOnlySpan
	for _, span := range spans {
		for _, attr := range span.Attributes() {
			if string(attr.Key) == "ctrlplane.phase" && attr.Value.AsString() == string(phase) {
				result = append(result, span)
				break
			}
		}
	}
	return result
}

// VerifyTraceStructure validates the trace hierarchy
func VerifyTraceStructure(t *testing.T, spans []sdktrace.ReadOnlySpan, expectedPhases []trace.Phase) {
	t.Helper()

	if len(spans) == 0 {
		t.Fatal("no spans found in trace")
	}

	// Verify root span exists
	var rootSpan sdktrace.ReadOnlySpan
	for _, span := range spans {
		if span.Name() == "Reconciliation" {
			rootSpan = span
			break
		}
	}
	if rootSpan == nil {
		t.Fatal("root 'Reconciliation' span not found")
	}

	// Verify expected phases exist
	for _, expectedPhase := range expectedPhases {
		phaseSpans := FindSpansByPhase(spans, expectedPhase)
		if len(phaseSpans) == 0 {
			t.Errorf("expected phase %s not found in trace", expectedPhase)
		}
	}

	// Verify all spans share the same trace ID
	traceID := rootSpan.SpanContext().TraceID()
	for _, span := range spans {
		if span.SpanContext().TraceID() != traceID {
			t.Errorf("span %s has different trace ID", span.Name())
		}
	}
}

// AssertSpanAttributes verifies specific attributes on a span
func AssertSpanAttributes(t *testing.T, span sdktrace.ReadOnlySpan, expectedAttrs map[string]interface{}) {
	t.Helper()

	attrs := make(map[string]attribute.Value)
	for _, attr := range span.Attributes() {
		attrs[string(attr.Key)] = attr.Value
	}

	for key, expectedValue := range expectedAttrs {
		attr, exists := attrs[key]
		if !exists {
			t.Errorf("attribute %s not found on span %s", key, span.Name())
			continue
		}

		// Compare values based on type
		switch v := expectedValue.(type) {
		case string:
			if attr.AsString() != v {
				t.Errorf("attribute %s: expected %v, got %v", key, v, attr.AsString())
			}
		case int:
			if int(attr.AsInt64()) != v {
				t.Errorf("attribute %s: expected %v, got %v", key, v, attr.AsInt64())
			}
		case bool:
			if attr.AsBool() != v {
				t.Errorf("attribute %s: expected %v, got %v", key, v, attr.AsBool())
			}
		default:
			t.Errorf("unsupported attribute type for %s", key)
		}
	}
}

// VerifyTraceTimeline checks that span timestamps are logically ordered
func VerifyTraceTimeline(t *testing.T, spans []sdktrace.ReadOnlySpan) {
	t.Helper()

	for _, span := range spans {
		if span.EndTime().Before(span.StartTime()) {
			t.Errorf("span %s: end time before start time", span.Name())
		}

		// Find parent span and verify it encompasses child
		if span.Parent().IsValid() {
			parentSpanID := span.Parent().SpanID()
			for _, potentialParent := range spans {
				if potentialParent.SpanContext().SpanID() == parentSpanID {
					if span.StartTime().Before(potentialParent.StartTime()) {
						t.Errorf("span %s starts before its parent %s", span.Name(), potentialParent.Name())
					}
					if !potentialParent.EndTime().IsZero() && !span.EndTime().IsZero() {
						if span.EndTime().After(potentialParent.EndTime()) {
							t.Errorf("span %s ends after its parent %s", span.Name(), potentialParent.Name())
						}
					}
					break
				}
			}
		}
	}
}

// ExtractTraceMetadata extracts metadata from span events
func ExtractTraceMetadata(span sdktrace.ReadOnlySpan) map[string]interface{} {
	metadata := make(map[string]interface{})

	for _, event := range span.Events() {
		for _, attr := range event.Attributes {
			key := string(attr.Key)
			switch attr.Value.Type() {
			case attribute.STRING:
				metadata[key] = attr.Value.AsString()
			case attribute.INT64:
				metadata[key] = attr.Value.AsInt64()
			case attribute.BOOL:
				metadata[key] = attr.Value.AsBool()
			case attribute.FLOAT64:
				metadata[key] = attr.Value.AsFloat64()
			}
		}
	}

	return metadata
}

// GetSpanAttribute retrieves a specific attribute value from a span
func GetSpanAttribute(span sdktrace.ReadOnlySpan, key string) (attribute.Value, bool) {
	for _, attr := range span.Attributes() {
		if string(attr.Key) == key {
			return attr.Value, true
		}
	}
	return attribute.Value{}, false
}

// VerifySpanDepth checks that spans have correct depth values
func VerifySpanDepth(t *testing.T, spans []sdktrace.ReadOnlySpan) {
	t.Helper()

	for _, span := range spans {
		depthAttr, hasDepth := GetSpanAttribute(span, "ctrlplane.depth")
		if !hasDepth {
			t.Errorf("span %s missing depth attribute", span.Name())
			continue
		}

		depth := int(depthAttr.AsInt64())

		// Root should be depth 0
		if span.Name() == "Reconciliation" && depth != 0 {
			t.Errorf("root span should have depth 0, got %d", depth)
		}

		// Verify parent depth relationship
		if span.Parent().IsValid() {
			parentSpanID := span.Parent().SpanID()
			for _, potentialParent := range spans {
				if potentialParent.SpanContext().SpanID() == parentSpanID {
					parentDepth, hasParentDepth := GetSpanAttribute(potentialParent, "ctrlplane.depth")
					if hasParentDepth {
						expectedDepth := int(parentDepth.AsInt64()) + 1
						if depth != expectedDepth {
							t.Errorf("span %s has depth %d but parent %s has depth %d (expected %d)",
								span.Name(), depth, potentialParent.Name(), int(parentDepth.AsInt64()), expectedDepth)
						}
					}
					break
				}
			}
		}
	}
}

// VerifySequenceNumbers checks that sequence numbers are unique and range from 0 to N-1
func VerifySequenceNumbers(t *testing.T, spans []sdktrace.ReadOnlySpan) {
	t.Helper()

	var sequences []int
	seenSequences := make(map[int]bool)

	for _, span := range spans {
		seqAttr, hasSeq := GetSpanAttribute(span, "ctrlplane.sequence")
		if hasSeq {
			seq := int(seqAttr.AsInt64())
			sequences = append(sequences, seq)

			// Check for duplicates
			if seenSequences[seq] {
				t.Errorf("duplicate sequence number found: %d in sequences %v", seq, sequences)
			}
			seenSequences[seq] = true
		}
	}

	// Verify all sequences from 0 to N-1 are present
	n := len(sequences)
	for i := 0; i < n; i++ {
		if !seenSequences[i] {
			t.Errorf("sequence number %d missing (expected 0 to %d): %v", i, n-1, sequences)
			break
		}
	}

	// Check no sequence is out of range
	for seq := range seenSequences {
		if seq < 0 || seq >= n {
			t.Errorf("sequence number %d out of range (expected 0 to %d): %v", seq, n-1, sequences)
			break
		}
	}
}

// DumpTrace prints all spans for debugging
func DumpTrace(t *testing.T, spans []sdktrace.ReadOnlySpan) {
	t.Helper()
	t.Logf("=== Trace Dump (%d spans) ===", len(spans))

	for i, span := range spans {
		depth, _ := GetSpanAttribute(span, "ctrlplane.depth")
		seq, _ := GetSpanAttribute(span, "ctrlplane.sequence")
		phase, _ := GetSpanAttribute(span, "ctrlplane.phase")
		nodeType, _ := GetSpanAttribute(span, "ctrlplane.node_type")
		status, _ := GetSpanAttribute(span, "ctrlplane.status")

		t.Logf("[%d] %s (phase=%s, type=%s, status=%s, depth=%d, seq=%d)",
			i,
			span.Name(),
			phase.AsString(),
			nodeType.AsString(),
			status.AsString(),
			depth.AsInt64(),
			seq.AsInt64(),
		)
	}
}

// CountSpansByType counts spans of a specific node type
func CountSpansByType(spans []sdktrace.ReadOnlySpan, nodeType trace.NodeType) int {
	count := 0
	for _, span := range spans {
		typeAttr, hasType := GetSpanAttribute(span, "ctrlplane.node_type")
		if hasType && typeAttr.AsString() == string(nodeType) {
			count++
		}
	}
	return count
}

// AssertSpanExists verifies a span with specific name exists
func AssertSpanExists(t *testing.T, spans []sdktrace.ReadOnlySpan, name string) sdktrace.ReadOnlySpan {
	t.Helper()

	span, found := FindSpanByName(spans, name)
	if !found {
		t.Fatalf("span %q not found in trace", name)
	}
	return span
}

// AssertSpanCount verifies the total number of spans
func AssertSpanCount(t *testing.T, spans []sdktrace.ReadOnlySpan, expected int) {
	t.Helper()

	if len(spans) != expected {
		t.Errorf("expected %d spans, got %d", expected, len(spans))
		DumpTrace(t, spans)
	}
}

// AssertPhaseExists verifies a phase span exists
func AssertPhaseExists(t *testing.T, spans []sdktrace.ReadOnlySpan, phase trace.Phase) sdktrace.ReadOnlySpan {
	t.Helper()

	phaseSpans := FindSpansByPhase(spans, phase)
	if len(phaseSpans) == 0 {
		t.Fatalf("phase %s not found in trace", phase)
		return nil
	}
	return phaseSpans[0]
}

// VerifyNoTrace ensures no trace was created (for blocked/skipped deployments)
func VerifyNoTrace(t *testing.T, spans []sdktrace.ReadOnlySpan, phaseName string) {
	t.Helper()

	for _, span := range spans {
		if span.Name() == phaseName {
			t.Errorf("unexpected span %s found in trace", phaseName)
		}
	}
}

// GetSpanByPhaseAndType finds a span matching both phase and node type
func GetSpanByPhaseAndType(spans []sdktrace.ReadOnlySpan, phase trace.Phase, nodeType trace.NodeType) (sdktrace.ReadOnlySpan, error) {
	for _, span := range spans {
		phaseAttr, hasPhase := GetSpanAttribute(span, "ctrlplane.phase")
		typeAttr, hasType := GetSpanAttribute(span, "ctrlplane.node_type")

		if hasPhase && hasType &&
			phaseAttr.AsString() == string(phase) &&
			typeAttr.AsString() == string(nodeType) {
			return span, nil
		}
	}
	return nil, fmt.Errorf("span with phase=%s and type=%s not found", phase, nodeType)
}
