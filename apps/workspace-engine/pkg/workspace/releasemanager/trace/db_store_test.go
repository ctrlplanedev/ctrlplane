package trace

import (
	"context"
	"testing"

	sdktrace "go.opentelemetry.io/otel/sdk/trace"
)

// TestDBStore_WriteSpans_MissingWorkspaceID verifies that spans without workspace_id are rejected
func TestDBStore_WriteSpans_MissingWorkspaceID(t *testing.T) {
	// Create a span without workspace_id attribute
	rt := NewReconcileTarget("", "test-target", TriggerScheduled) // Empty workspace ID
	planning := rt.StartPlanning()
	planning.End()
	rt.Complete(StatusCompleted)

	// Get the spans
	spans := rt.exporter.getSpans()
	if len(spans) == 0 {
		t.Fatal("expected at least one span")
	}

	// Create a mock store (we don't need actual DB for this test)
	store := &DBStore{pool: nil}

	// Try to write spans - should fail with descriptive error
	err := store.WriteSpans(context.Background(), spans)
	if err == nil {
		t.Fatal("expected error when workspace_id is missing, got nil")
	}

	// Verify error message contains useful information
	expectedSubstrings := []string{
		"missing required attribute",
		attrWorkspaceID,
	}

	errMsg := err.Error()
	for _, substr := range expectedSubstrings {
		if !contains(errMsg, substr) {
			t.Errorf("error message should contain %q, got: %s", substr, errMsg)
		}
	}
}

// TestDBStore_WriteSpans_ValidWorkspaceID verifies validation passes with valid workspace_id
func TestDBStore_WriteSpans_ValidWorkspaceID(t *testing.T) {
	// Create a span with valid workspace_id
	rt := NewReconcileTarget("workspace-123", "test-target", TriggerScheduled)
	planning := rt.StartPlanning()
	planning.End()
	rt.Complete(StatusCompleted)

	// Get the spans
	spans := rt.exporter.getSpans()
	if len(spans) == 0 {
		t.Fatal("expected at least one span")
	}

	// Verify all spans have workspace_id attribute
	for _, span := range spans {
		hasWorkspaceID := false
		for _, attr := range span.Attributes() {
			if string(attr.Key) == attrWorkspaceID {
				hasWorkspaceID = true
				workspaceID := attr.Value.AsString()
				if workspaceID == "" {
					t.Errorf("workspace_id attribute is empty for span %q", span.Name())
				}
				break
			}
		}
		if !hasWorkspaceID {
			t.Errorf("span %q missing workspace_id attribute", span.Name())
		}
	}

	// Note: We can't test actual DB insertion without a real database connection
	// but we've verified the spans have the required attribute
}

// TestDBStore_WriteSpans_EmptySpanList verifies empty span list is handled gracefully
func TestDBStore_WriteSpans_EmptySpanList(t *testing.T) {
	store := &DBStore{pool: nil}
	err := store.WriteSpans(context.Background(), []sdktrace.ReadOnlySpan{})
	if err != nil {
		t.Errorf("expected no error for empty span list, got: %v", err)
	}
}

// TestDBStore_WriteSpans_MultipleSpans_OneMissingWorkspaceID verifies batch fails if any span is invalid
func TestDBStore_WriteSpans_MultipleSpans_OneMissingWorkspaceID(t *testing.T) {
	// Create spans with and without workspace_id
	validRT := NewReconcileTarget("workspace-valid", "test-target", TriggerScheduled)
	validPlanning := validRT.StartPlanning()
	validPlanning.End()
	validRT.Complete(StatusCompleted)

	invalidRT := NewReconcileTarget("", "test-target", TriggerScheduled) // Empty workspace ID
	invalidPlanning := invalidRT.StartPlanning()
	invalidPlanning.End()
	invalidRT.Complete(StatusCompleted)

	// Combine spans
	validSpans := validRT.exporter.getSpans()
	invalidSpans := invalidRT.exporter.getSpans()
	allSpans := append(validSpans, invalidSpans...)

	store := &DBStore{pool: nil}

	// Should fail because one span is missing workspace_id
	err := store.WriteSpans(context.Background(), allSpans)
	if err == nil {
		t.Fatal("expected error when one span is missing workspace_id, got nil")
	}

	if !contains(err.Error(), "missing required attribute") {
		t.Errorf("error should mention missing attribute, got: %s", err.Error())
	}
}

// Helper function to check if string contains substring
func contains(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(substr) == 0 ||
		(len(s) > 0 && len(substr) > 0 && findSubstring(s, substr)))
}

func findSubstring(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
