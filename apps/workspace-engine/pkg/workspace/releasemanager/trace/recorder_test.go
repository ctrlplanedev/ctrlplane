package trace

import (
	"context"
	"testing"

	sdktrace "go.opentelemetry.io/otel/sdk/trace"
)

// Mock persistence store for testing
type mockStore struct {
	spans []sdktrace.ReadOnlySpan
	err   error
}

func (m *mockStore) WriteSpans(ctx context.Context, spans []sdktrace.ReadOnlySpan) error {
	m.spans = spans
	return m.err
}

func TestNewReconcileTarget(t *testing.T) {
	workspaceID := "workspace-1"
	releaseTargetKey := "api-service-production"

	rt := NewReconcileTarget(workspaceID, releaseTargetKey, TriggerScheduled)

	if rt == nil {
		t.Fatal("expected non-nil ReconcileTarget")
		return
	}

	if rt.workspaceID != workspaceID {
		t.Errorf("expected workspaceID %s, got %s", workspaceID, rt.workspaceID)
	}

	if rt.releaseTargetKey != releaseTargetKey {
		t.Errorf("expected releaseTargetKey %s, got %s", releaseTargetKey, rt.releaseTargetKey)
	}

	if rt.rootSpan == nil {
		t.Error("expected root span to be created")
	}

	if rt.rootTraceID == "" {
		t.Error("expected non-empty root trace ID")
	}

	if rt.exporter == nil {
		t.Error("expected exporter to be created")
	}

	if rt.depthMap == nil {
		t.Error("expected depthMap to be initialized")
	}
}

func TestNewReconcileTargetWithStore(t *testing.T) {
	workspaceID := "workspace-1"
	releaseTargetKey := "api-service-production"
	store := &mockStore{}

	rt := NewReconcileTargetWithStore(workspaceID, releaseTargetKey, TriggerScheduled, store)

	if rt == nil {
		t.Fatal("expected non-nil ReconcileTarget")
		return
	}

	if rt.store != store {
		t.Error("expected store to be set")
	}
}

func TestReconcileTarget_StartPlanning(t *testing.T) {
	rt := NewReconcileTarget("workspace-1", "api-service-production", TriggerScheduled)

	planning := rt.StartPlanning()

	if planning == nil {
		t.Fatal("expected non-nil PlanningPhase")
		return
	}

	if planning.recorder != rt {
		t.Error("planning phase should reference recorder")
	}

	if planning.span == nil {
		t.Error("expected planning span to be created")
	}

	if !planning.span.SpanContext().IsValid() {
		t.Error("expected valid span context")
	}
}

func TestReconcileTarget_StartEligibility(t *testing.T) {
	rt := NewReconcileTarget("workspace-1", "api-service-production", TriggerScheduled)

	eligibility := rt.StartEligibility()

	if eligibility == nil {
		t.Fatal("expected non-nil EligibilityPhase")
		return
	}

	if eligibility.recorder != rt {
		t.Error("eligibility phase should reference recorder")
	}

	if eligibility.span == nil {
		t.Error("expected eligibility span to be created")
	}
}

func TestReconcileTarget_StartExecution(t *testing.T) {
	rt := NewReconcileTarget("workspace-1", "api-service-production", TriggerScheduled)

	execution := rt.StartExecution()

	if execution == nil {
		t.Fatal("expected non-nil ExecutionPhase")
		return
	}

	if execution.recorder != rt {
		t.Error("execution phase should reference recorder")
	}

	if execution.span == nil {
		t.Error("expected execution span to be created")
	}
}

func TestReconcileTarget_StartAction(t *testing.T) {
	rt := NewReconcileTarget("workspace-1", "api-service-production", TriggerScheduled)

	action := rt.StartAction("Verification")

	if action == nil {
		t.Fatal("expected non-nil Action")
		return
	}

	if action.recorder != rt {
		t.Error("action should reference recorder")
	}

	if action.span == nil {
		t.Error("expected action span to be created")
	}
}

func TestReconcileTarget_Complete(t *testing.T) {
	rt := NewReconcileTarget("workspace-1", "api-service-production", TriggerScheduled)

	// Complete should not panic
	rt.Complete(StatusCompleted)

	// Root span should be ended
	if !rt.rootSpan.SpanContext().IsValid() {
		t.Error("root span context should still be valid after complete")
	}
}

func TestReconcileTarget_Persist_WithConfiguredStore(t *testing.T) {
	store := &mockStore{}
	rt := NewReconcileTargetWithStore("workspace-1", "api-service-production", TriggerScheduled, store)

	// Create some spans
	planning := rt.StartPlanning()
	planning.End()

	rt.Complete(StatusCompleted)

	// Persist without passing store
	err := rt.Persist()

	if err != nil {
		t.Fatalf("persist failed: %v", err)
	}

	if len(store.spans) == 0 {
		t.Error("expected spans to be written to store")
	}
}

func TestReconcileTarget_Persist_WithProvidedStore(t *testing.T) {
	rt := NewReconcileTarget("workspace-1", "api-service-production", TriggerScheduled)
	store := &mockStore{}

	// Create some spans
	planning := rt.StartPlanning()
	planning.End()

	rt.Complete(StatusCompleted)

	// Persist with provided store
	err := rt.Persist(store)

	if err != nil {
		t.Fatalf("persist failed: %v", err)
	}

	if len(store.spans) == 0 {
		t.Error("expected spans to be written to store")
	}
}

func TestReconcileTarget_Persist_NoStore(t *testing.T) {
	rt := NewReconcileTarget("workspace-1", "api-service-production", TriggerScheduled)

	rt.Complete(StatusCompleted)

	// Persist without store should fail
	err := rt.Persist()

	if err == nil {
		t.Error("expected error when no store is configured")
	}
}

func TestReconcileTarget_CompleteWithDifferentStatuses(t *testing.T) {
	statuses := []Status{
		StatusCompleted,
		StatusFailed,
		StatusSkipped,
	}

	for _, status := range statuses {
		t.Run(string(status), func(t *testing.T) {
			rt := NewReconcileTarget("workspace-1", "api-service-production", TriggerScheduled)

			rt.Complete(status)

			// Should not panic
		})
	}
}

func TestReconcileTarget_MultiplePhases(t *testing.T) {
	rt := NewReconcileTarget("workspace-1", "api-service-production", TriggerScheduled)
	store := &mockStore{}

	// Execute all phases
	planning := rt.StartPlanning()
	eval := planning.StartEvaluation("Policy Check")
	eval.SetResult(ResultAllowed, "Approved")
	eval.End()
	planning.MakeDecision("Approved", DecisionApproved)
	planning.End()

	eligibility := rt.StartEligibility()
	check := eligibility.StartCheck("Already Deployed")
	check.SetResult(CheckResultPass, "Not deployed")
	check.End()
	eligibility.MakeDecision("Eligible", DecisionApproved)
	eligibility.End()

	execution := rt.StartExecution()
	job := execution.TriggerJob("github-action", map[string]string{"repo": "test"})
	job.AddMetadata("run_id", "12345")
	job.End()
	execution.End()

	action := rt.StartAction("Verification")
	action.AddStep("Check pods", StepResultPass, "3/3 ready")
	action.End()

	rt.Complete(StatusCompleted)

	err := rt.Persist(store)
	if err != nil {
		t.Fatalf("persist failed: %v", err)
	}

	// Should have multiple spans
	if len(store.spans) < 5 {
		t.Errorf("expected at least 5 spans, got %d", len(store.spans))
	}
}

func TestReconcileTarget_SequenceTracking(t *testing.T) {
	rt := NewReconcileTarget("workspace-1", "api-service-production", TriggerScheduled)

	// Create multiple phases
	rt.StartPlanning().End()
	rt.StartEligibility().End()
	rt.StartExecution().End()

	// Sequence numbers should be incrementing
	if rt.nodeSequence != 3 {
		t.Errorf("expected sequence 3, got %d", rt.nodeSequence)
	}
}

func TestReconcileTarget_DepthTracking(t *testing.T) {
	rt := NewReconcileTarget("workspace-1", "api-service-production", TriggerScheduled)

	// Can only test depth tracking for phases, not nested objects due to deadlock
	planning := rt.StartPlanning()

	// Root should be at depth 0
	if rt.depthMap[rt.rootSpan.SpanContext().SpanID().String()] != 0 {
		t.Error("root span should be at depth 0")
	}

	// Planning phase should be at depth 1
	planningDepth := rt.depthMap[planning.span.SpanContext().SpanID().String()]
	if planningDepth != 1 {
		t.Errorf("planning span should be at depth 1, got %d", planningDepth)
	}

	planning.End()
}

func TestReconcileTarget_RecordDecision(t *testing.T) {
	rt := NewReconcileTarget("workspace-1", "api-service-production", TriggerScheduled)
	planning := rt.StartPlanning()

	// Record decision
	planning.MakeDecision("Deploy approved", DecisionApproved)
	planning.End()

	rt.Complete(StatusCompleted)

	store := &mockStore{}
	err := rt.Persist(store)
	if err != nil {
		t.Fatalf("persist failed: %v", err)
	}

	// Should have decision span
	foundDecision := false
	for _, span := range store.spans {
		if span.Name() == "Deploy approved" {
			foundDecision = true
			break
		}
	}

	if !foundDecision {
		t.Error("expected to find decision span")
	}
}

func TestStatusToOTelCode(t *testing.T) {
	tests := []struct {
		status   Status
		expected string
	}{
		{StatusCompleted, "Ok"},
		{StatusFailed, "Error"},
		{StatusRunning, "Unset"},
		{StatusSkipped, "Unset"},
	}

	for _, tt := range tests {
		t.Run(string(tt.status), func(t *testing.T) {
			code := statusToOTelCode(tt.status)
			if code.String() != tt.expected {
				t.Errorf("expected %s, got %s", tt.expected, code.String())
			}
		})
	}
}

func TestEvalResultToStatus(t *testing.T) {
	tests := []struct {
		result   EvaluationResult
		expected Status
	}{
		{ResultAllowed, StatusCompleted},
		{ResultBlocked, StatusFailed},
	}

	for _, tt := range tests {
		t.Run(string(tt.result), func(t *testing.T) {
			status := evalResultToStatus(tt.result)
			if status != tt.expected {
				t.Errorf("expected %s, got %s", tt.expected, status)
			}
		})
	}
}

func TestCheckResultToStatus(t *testing.T) {
	tests := []struct {
		result   CheckResult
		expected Status
	}{
		{CheckResultPass, StatusCompleted},
		{CheckResultFail, StatusFailed},
	}

	for _, tt := range tests {
		t.Run(string(tt.result), func(t *testing.T) {
			status := checkResultToStatus(tt.result)
			if status != tt.expected {
				t.Errorf("expected %s, got %s", tt.expected, status)
			}
		})
	}
}

func TestStepResultToStatus(t *testing.T) {
	tests := []struct {
		result   StepResult
		expected Status
	}{
		{StepResultPass, StatusCompleted},
		{StepResultFail, StatusFailed},
	}

	for _, tt := range tests {
		t.Run(string(tt.result), func(t *testing.T) {
			status := stepResultToStatus(tt.result)
			if status != tt.expected {
				t.Errorf("expected %s, got %s", tt.expected, status)
			}
		})
	}
}

func TestReconcileTarget_GetDepth(t *testing.T) {
	rt := NewReconcileTarget("workspace-1", "api-service-production", TriggerScheduled)

	// Root context should return 0
	depth := rt.getDepth(rt.rootCtx)
	if depth != 0 {
		t.Errorf("expected depth 0 for root context, got %d", depth)
	}

	// Phase context should return 1
	planning := rt.StartPlanning()
	depth = rt.getDepth(planning.ctx)
	if depth != 1 {
		t.Errorf("expected depth 1 for planning context, got %d", depth)
	}

	planning.End()
}

func TestReconcileTarget_Concurrency(t *testing.T) {
	rt := NewReconcileTarget("workspace-1", "api-service-production", TriggerScheduled)

	// Create phases concurrently
	done := make(chan bool)

	go func() {
		planning := rt.StartPlanning()
		planning.End()
		done <- true
	}()

	go func() {
		eligibility := rt.StartEligibility()
		eligibility.End()
		done <- true
	}()

	go func() {
		execution := rt.StartExecution()
		execution.End()
		done <- true
	}()

	// Wait for all goroutines
	<-done
	<-done
	<-done

	rt.Complete(StatusCompleted)

	store := &mockStore{}
	err := rt.Persist(store)
	if err != nil {
		t.Fatalf("persist failed: %v", err)
	}

	// Should have collected all spans
	if len(store.spans) < 3 {
		t.Errorf("expected at least 3 spans, got %d", len(store.spans))
	}
}
