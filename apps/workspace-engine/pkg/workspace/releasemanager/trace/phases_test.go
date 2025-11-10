package trace

import (
	"testing"
)

// ====== Planning Phase Tests ======

func TestPlanningPhase_StartEvaluation(t *testing.T) {
	rt := NewReconcileTarget("workspace-1", "api-service-production")
	planning := rt.StartPlanning()

	eval := planning.StartEvaluation("Approval Policy")

	if eval == nil {
		t.Fatal("expected non-nil Evaluation")
	}

	if eval.recorder != rt {
		t.Error("evaluation should reference recorder")
	}

	if eval.span == nil {
		t.Error("evaluation span should be created")
	}

	if !eval.span.SpanContext().IsValid() {
		t.Error("evaluation span context should be valid")
	}

	eval.End()
	planning.End()
}

func TestPlanningPhase_MultipleEvaluations(t *testing.T) {
	rt := NewReconcileTarget("workspace-1", "api-service-production")
	planning := rt.StartPlanning()

	// Create multiple evaluations
	eval1 := planning.StartEvaluation("Approval Policy")
	eval1.SetResult(ResultAllowed, "Approved")
	eval1.End()

	eval2 := planning.StartEvaluation("Concurrency Policy")
	eval2.SetResult(ResultAllowed, "Within limits")
	eval2.End()

	eval3 := planning.StartEvaluation("Environment Progression")
	eval3.SetResult(ResultAllowed, "Passed")
	eval3.End()

	planning.End()
	rt.Complete(StatusCompleted)

	store := &mockStore{}
	err := rt.Persist(store)
	if err != nil {
		t.Fatalf("persist failed: %v", err)
	}

	// Should have at least 3 evaluation spans
	evalCount := 0
	for _, span := range store.spans {
		for _, attr := range span.Attributes() {
			if string(attr.Key) == "ctrlplane.node_type" && attr.Value.AsString() == string(NodeTypeEvaluation) {
				evalCount++
				break
			}
		}
	}

	if evalCount < 3 {
		t.Errorf("expected at least 3 evaluation spans, got %d", evalCount)
	}
}

func TestEvaluation_AddMetadata(t *testing.T) {
	rt := NewReconcileTarget("workspace-1", "api-service-production")
	planning := rt.StartPlanning()
	eval := planning.StartEvaluation("Test Policy")

	// Add various metadata types
	eval.AddMetadata("string_key", "string_value")
	eval.AddMetadata("int_key", 42)
	eval.AddMetadata("bool_key", true)

	eval.SetResult(ResultAllowed, "Test")
	eval.End()
	planning.End()

	rt.Complete(StatusCompleted)

	store := &mockStore{}
	err := rt.Persist(store)
	if err != nil {
		t.Fatalf("persist failed: %v", err)
	}

	// Find evaluation span and verify it has events (metadata)
	for _, span := range store.spans {
		if span.Name() == "Test Policy" {
			events := span.Events()
			if len(events) != 3 {
				t.Errorf("expected 3 events, got %d", len(events))
			}
		}
	}
}

func TestEvaluation_SetResultAllowed(t *testing.T) {
	rt := NewReconcileTarget("workspace-1", "api-service-production")
	planning := rt.StartPlanning()
	eval := planning.StartEvaluation("Test Policy")

	eval.SetResult(ResultAllowed, "Approved by admin")
	eval.End()
	planning.End()

	rt.Complete(StatusCompleted)

	store := &mockStore{}
	err := rt.Persist(store)
	if err != nil {
		t.Fatalf("persist failed: %v", err)
	}

	// Find evaluation span and verify status
	for _, span := range store.spans {
		if span.Name() == "Test Policy" {
			// Verify status is OK (StatusCompleted maps to codes.Ok)
			if span.Status().Code.String() != "Ok" {
				t.Errorf("expected status Ok, got %s", span.Status().Code.String())
			}
		}
	}
}

func TestEvaluation_SetResultBlocked(t *testing.T) {
	rt := NewReconcileTarget("workspace-1", "api-service-production")
	planning := rt.StartPlanning()
	eval := planning.StartEvaluation("Test Policy")

	eval.SetResult(ResultBlocked, "Blocked by policy")
	eval.End()
	planning.End()

	rt.Complete(StatusCompleted)

	store := &mockStore{}
	err := rt.Persist(store)
	if err != nil {
		t.Fatalf("persist failed: %v", err)
	}

	// Find evaluation span and verify status
	for _, span := range store.spans {
		if span.Name() == "Test Policy" {
			// Verify status is Error (StatusFailed maps to codes.Error)
			if span.Status().Code.String() != "Error" {
				t.Errorf("expected status Error, got %s", span.Status().Code.String())
			}
		}
	}
}

func TestPlanningPhase_MakeDecisionApproved(t *testing.T) {
	rt := NewReconcileTarget("workspace-1", "api-service-production")
	planning := rt.StartPlanning()

	planning.MakeDecision("Deploy approved", DecisionApproved)
	planning.End()

	rt.Complete(StatusCompleted)

	store := &mockStore{}
	err := rt.Persist(store)
	if err != nil {
		t.Fatalf("persist failed: %v", err)
	}

	// Verify decision span exists
	foundDecision := false
	for _, span := range store.spans {
		if span.Name() == "Deploy approved" {
			foundDecision = true
			// Verify status is OK
			if span.Status().Code.String() != "Ok" {
				t.Errorf("approved decision should have Ok status, got %s", span.Status().Code.String())
			}
		}
	}

	if !foundDecision {
		t.Error("decision span not found")
	}
}

func TestPlanningPhase_MakeDecisionRejected(t *testing.T) {
	rt := NewReconcileTarget("workspace-1", "api-service-production")
	planning := rt.StartPlanning()

	planning.MakeDecision("Deploy rejected", DecisionRejected)
	planning.End()

	rt.Complete(StatusCompleted)

	store := &mockStore{}
	err := rt.Persist(store)
	if err != nil {
		t.Fatalf("persist failed: %v", err)
	}

	// Verify decision span exists with error status
	foundDecision := false
	for _, span := range store.spans {
		if span.Name() == "Deploy rejected" {
			foundDecision = true
			// Verify status is Error
			if span.Status().Code.String() != "Error" {
				t.Errorf("rejected decision should have Error status, got %s", span.Status().Code.String())
			}
		}
	}

	if !foundDecision {
		t.Error("decision span not found")
	}
}

// ====== Eligibility Phase Tests ======

func TestEligibilityPhase_StartCheck(t *testing.T) {
	rt := NewReconcileTarget("workspace-1", "api-service-production")
	eligibility := rt.StartEligibility()

	check := eligibility.StartCheck("Already Deployed")

	if check == nil {
		t.Fatal("expected non-nil Check")
	}

	if check.recorder != rt {
		t.Error("check should reference recorder")
	}

	if check.span == nil {
		t.Error("check span should be created")
	}

	check.End()
	eligibility.End()
}

func TestEligibilityPhase_MultipleChecks(t *testing.T) {
	rt := NewReconcileTarget("workspace-1", "api-service-production")
	eligibility := rt.StartEligibility()

	// Create multiple checks
	check1 := eligibility.StartCheck("Already Deployed")
	check1.SetResult(CheckResultPass, "Not deployed")
	check1.End()

	check2 := eligibility.StartCheck("Failure Count")
	check2.SetResult(CheckResultPass, "0 failures")
	check2.End()

	eligibility.End()
	rt.Complete(StatusCompleted)

	store := &mockStore{}
	err := rt.Persist(store)
	if err != nil {
		t.Fatalf("persist failed: %v", err)
	}

	// Should have at least 2 check spans
	checkCount := 0
	for _, span := range store.spans {
		for _, attr := range span.Attributes() {
			if string(attr.Key) == "ctrlplane.node_type" && attr.Value.AsString() == string(NodeTypeCheck) {
				checkCount++
				break
			}
		}
	}

	if checkCount < 2 {
		t.Errorf("expected at least 2 check spans, got %d", checkCount)
	}
}

func TestCheck_AddMetadata(t *testing.T) {
	rt := NewReconcileTarget("workspace-1", "api-service-production")
	eligibility := rt.StartEligibility()
	check := eligibility.StartCheck("Test Check")

	// Add metadata
	check.AddMetadata("current_version", "v1.0.0")
	check.AddMetadata("attempt_count", 3)

	check.SetResult(CheckResultPass, "Test")
	check.End()
	eligibility.End()

	rt.Complete(StatusCompleted)

	store := &mockStore{}
	err := rt.Persist(store)
	if err != nil {
		t.Fatalf("persist failed: %v", err)
	}

	// Verify check span has events
	for _, span := range store.spans {
		if span.Name() == "Test Check" {
			events := span.Events()
			if len(events) != 2 {
				t.Errorf("expected 2 events, got %d", len(events))
			}
		}
	}
}

func TestCheck_SetResultPass(t *testing.T) {
	rt := NewReconcileTarget("workspace-1", "api-service-production")
	eligibility := rt.StartEligibility()
	check := eligibility.StartCheck("Test Check")

	check.SetResult(CheckResultPass, "Passed check")
	check.End()
	eligibility.End()

	rt.Complete(StatusCompleted)

	store := &mockStore{}
	err := rt.Persist(store)
	if err != nil {
		t.Fatalf("persist failed: %v", err)
	}

	// Verify check span has Ok status
	for _, span := range store.spans {
		if span.Name() == "Test Check" {
			if span.Status().Code.String() != "Ok" {
				t.Errorf("expected status Ok, got %s", span.Status().Code.String())
			}
		}
	}
}

func TestCheck_SetResultFail(t *testing.T) {
	rt := NewReconcileTarget("workspace-1", "api-service-production")
	eligibility := rt.StartEligibility()
	check := eligibility.StartCheck("Test Check")

	check.SetResult(CheckResultFail, "Check failed")
	check.End()
	eligibility.End()

	rt.Complete(StatusCompleted)

	store := &mockStore{}
	err := rt.Persist(store)
	if err != nil {
		t.Fatalf("persist failed: %v", err)
	}

	// Verify check span has Error status
	for _, span := range store.spans {
		if span.Name() == "Test Check" {
			if span.Status().Code.String() != "Error" {
				t.Errorf("expected status Error, got %s", span.Status().Code.String())
			}
		}
	}
}

func TestEligibilityPhase_MakeDecision(t *testing.T) {
	rt := NewReconcileTarget("workspace-1", "api-service-production")
	eligibility := rt.StartEligibility()

	check := eligibility.StartCheck("Test Check")
	check.SetResult(CheckResultPass, "Passed")
	check.End()

	eligibility.MakeDecision("Eligible for deployment", DecisionApproved)
	eligibility.End()

	rt.Complete(StatusCompleted)

	store := &mockStore{}
	err := rt.Persist(store)
	if err != nil {
		t.Fatalf("persist failed: %v", err)
	}

	// Verify decision span exists
	foundDecision := false
	for _, span := range store.spans {
		if span.Name() == "Eligible for deployment" {
			foundDecision = true
		}
	}

	if !foundDecision {
		t.Error("decision span not found")
	}
}

// ====== Execution Phase Tests ======

func TestExecutionPhase_TriggerJob(t *testing.T) {
	rt := NewReconcileTarget("workspace-1", "api-service-production")
	execution := rt.StartExecution()

	job := execution.TriggerJob("github-action", map[string]string{
		"repo":   "test/repo",
		"branch": "main",
	})

	if job == nil {
		t.Fatal("expected non-nil Job")
	}

	if job.recorder != rt {
		t.Error("job should reference recorder")
	}

	if job.span == nil {
		t.Error("job span should be created")
	}

	if job.jobType != "github-action" {
		t.Errorf("expected jobType github-action, got %s", job.jobType)
	}

	job.End()
	execution.End()
}

func TestExecutionPhase_MultipleJobs(t *testing.T) {
	rt := NewReconcileTarget("workspace-1", "api-service-production")
	execution := rt.StartExecution()

	job1 := execution.TriggerJob("github-action", map[string]string{"repo": "test1"})
	job1.End()

	job2 := execution.TriggerJob("kubernetes-job", map[string]string{"namespace": "prod"})
	job2.End()

	execution.End()
	rt.Complete(StatusCompleted)

	store := &mockStore{}
	err := rt.Persist(store)
	if err != nil {
		t.Fatalf("persist failed: %v", err)
	}

	// Verify multiple job spans exist
	jobCount := 0
	for _, span := range store.spans {
		if span.Name() == "Job: github-action" || span.Name() == "Job: kubernetes-job" {
			jobCount++
		}
	}

	if jobCount < 2 {
		t.Errorf("expected at least 2 job spans, got %d", jobCount)
	}
}

func TestJob_AddMetadata(t *testing.T) {
	rt := NewReconcileTarget("workspace-1", "api-service-production")
	execution := rt.StartExecution()
	job := execution.TriggerJob("github-action", map[string]string{})

	job.AddMetadata("run_id", "12345")
	job.AddMetadata("actor", "alice")
	job.AddMetadata("triggered_at", "2024-01-01T00:00:00Z")

	job.End()
	execution.End()

	rt.Complete(StatusCompleted)

	store := &mockStore{}
	err := rt.Persist(store)
	if err != nil {
		t.Fatalf("persist failed: %v", err)
	}

	// Verify job span has events
	for _, span := range store.spans {
		if span.Name() == "Job: github-action" {
			events := span.Events()
			if len(events) != 3 {
				t.Errorf("expected 3 events, got %d", len(events))
			}
		}
	}
}

func TestJob_Token(t *testing.T) {
	rt := NewReconcileTarget("workspace-1", "api-service-production")
	execution := rt.StartExecution()
	job := execution.TriggerJob("github-action", map[string]string{})

	token := job.Token()

	if token == "" {
		t.Error("expected non-empty token")
	}

	// Token should be parseable
	traceID, jobID, err := ParseTraceToken(token)
	if err != nil {
		t.Fatalf("failed to parse token: %v", err)
	}

	if traceID != rt.rootTraceID {
		t.Errorf("token trace ID mismatch: expected %s, got %s", rt.rootTraceID, traceID)
	}

	if jobID != "github-action" {
		t.Errorf("token job ID mismatch: expected github-action, got %s", jobID)
	}

	job.End()
	execution.End()
}

// ====== Action Tests ======

func TestAction_AddMetadata(t *testing.T) {
	rt := NewReconcileTarget("workspace-1", "api-service-production")
	action := rt.StartAction("Verification")

	action.AddMetadata("check_type", "health")
	action.AddMetadata("timeout", 300)
	action.AddMetadata("retries", 3)

	action.End()

	rt.Complete(StatusCompleted)

	store := &mockStore{}
	err := rt.Persist(store)
	if err != nil {
		t.Fatalf("persist failed: %v", err)
	}

	// Verify action span has events
	for _, span := range store.spans {
		if span.Name() == "Verification" {
			events := span.Events()
			if len(events) != 3 {
				t.Errorf("expected 3 events, got %d", len(events))
			}
		}
	}
}

func TestAction_AddStepPass(t *testing.T) {
	rt := NewReconcileTarget("workspace-1", "api-service-production")
	action := rt.StartAction("Verification")

	action.AddStep("Check pods", StepResultPass, "3/3 ready")
	action.AddStep("Check services", StepResultPass, "All healthy")

	action.End()

	rt.Complete(StatusCompleted)

	store := &mockStore{}
	err := rt.Persist(store)
	if err != nil {
		t.Fatalf("persist failed: %v", err)
	}

	// Verify step spans exist
	stepCount := 0
	for _, span := range store.spans {
		if span.Name() == "Check pods" || span.Name() == "Check services" {
			stepCount++
			// Verify status is Ok
			if span.Status().Code.String() != "Ok" {
				t.Errorf("step should have Ok status, got %s", span.Status().Code.String())
			}
		}
	}

	if stepCount < 2 {
		t.Errorf("expected at least 2 step spans, got %d", stepCount)
	}
}

func TestAction_AddStepFail(t *testing.T) {
	rt := NewReconcileTarget("workspace-1", "api-service-production")
	action := rt.StartAction("Verification")

	action.AddStep("Check pods", StepResultFail, "1/3 ready")

	action.End()

	rt.Complete(StatusCompleted)

	store := &mockStore{}
	err := rt.Persist(store)
	if err != nil {
		t.Fatalf("persist failed: %v", err)
	}

	// Verify step span has Error status
	for _, span := range store.spans {
		if span.Name() == "Check pods" {
			if span.Status().Code.String() != "Error" {
				t.Errorf("failed step should have Error status, got %s", span.Status().Code.String())
			}
		}
	}
}

func TestAction_MultipleSteps(t *testing.T) {
	rt := NewReconcileTarget("workspace-1", "api-service-production")
	action := rt.StartAction("Rollback")

	action.AddStep("Stop traffic", StepResultPass, "Traffic stopped")
	action.AddStep("Revert deployment", StepResultPass, "Reverted to v1.0.0")
	action.AddStep("Restart pods", StepResultPass, "All pods restarted")
	action.AddStep("Verify health", StepResultPass, "All healthy")

	action.End()

	rt.Complete(StatusCompleted)

	store := &mockStore{}
	err := rt.Persist(store)
	if err != nil {
		t.Fatalf("persist failed: %v", err)
	}

	// Count step spans
	stepCount := 0
	for _, span := range store.spans {
		// Check if it's a step by looking at node_type
		for _, attr := range span.Attributes() {
			if string(attr.Key) == "ctrlplane.phase" && attr.Value.AsString() == string(PhaseAction) {
				// Count spans that are children of the action
				if span.Name() != "Rollback" {
					stepCount++
				}
				break
			}
		}
	}

	if stepCount < 4 {
		t.Errorf("expected at least 4 step spans, got %d", stepCount)
	}
}

// ====== Phase Integration Tests ======

func TestAllPhases_CompleteFlow(t *testing.T) {
	rt := NewReconcileTarget("workspace-1", "api-service-production")

	// Planning Phase
	planning := rt.StartPlanning()
	eval := planning.StartEvaluation("Approval Policy")
	eval.SetResult(ResultAllowed, "Approved")
	eval.End()
	planning.MakeDecision("Deploy approved", DecisionApproved)
	planning.End()

	// Eligibility Phase
	eligibility := rt.StartEligibility()
	check := eligibility.StartCheck("Already Deployed")
	check.SetResult(CheckResultPass, "Not deployed")
	check.End()
	eligibility.MakeDecision("Eligible", DecisionApproved)
	eligibility.End()

	// Execution Phase
	execution := rt.StartExecution()
	job := execution.TriggerJob("github-action", map[string]string{"repo": "test"})
	job.AddMetadata("run_id", "123")
	job.End()
	execution.End()

	// Action
	action := rt.StartAction("Verification")
	action.AddStep("Check pods", StepResultPass, "3/3 ready")
	action.End()

	rt.Complete(StatusCompleted)

	store := &mockStore{}
	err := rt.Persist(store)
	if err != nil {
		t.Fatalf("persist failed: %v", err)
	}

	// Verify we have spans from all phases
	phases := make(map[string]bool)
	for _, span := range store.spans {
		for _, attr := range span.Attributes() {
			if string(attr.Key) == "ctrlplane.phase" {
				phases[attr.Value.AsString()] = true
			}
		}
	}

	expectedPhases := []string{
		string(PhaseReconciliation),
		string(PhasePlanning),
		string(PhaseEligibility),
		string(PhaseExecution),
		string(PhaseAction),
	}

	for _, phase := range expectedPhases {
		if !phases[phase] {
			t.Errorf("phase %s not found in trace", phase)
		}
	}
}

func TestPhase_EndIdempotent(t *testing.T) {
	rt := NewReconcileTarget("workspace-1", "api-service-production")
	planning := rt.StartPlanning()

	// End should be idempotent
	planning.End()
	planning.End()
	planning.End()

	// Should not panic
	rt.Complete(StatusCompleted)
}

func TestPhase_NestedDepth(t *testing.T) {
	rt := NewReconcileTarget("workspace-1", "api-service-production")

	planning := rt.StartPlanning()
	eval := planning.StartEvaluation("Test")
	eval.End()
	planning.End()

	rt.Complete(StatusCompleted)

	store := &mockStore{}
	err := rt.Persist(store)
	if err != nil {
		t.Fatalf("persist failed: %v", err)
	}

	// Verify depth values
	for _, span := range store.spans {
		var depth int64
		for _, attr := range span.Attributes() {
			if string(attr.Key) == "ctrlplane.depth" {
				depth = attr.Value.AsInt64()
				break
			}
		}

		// Root should be depth 0
		if span.Name() == "Reconciliation" && depth != 0 {
			t.Errorf("root should have depth 0, got %d", depth)
		}

		// Planning should be depth 1
		if span.Name() == "Planning" && depth != 1 {
			t.Errorf("planning should have depth 1, got %d", depth)
		}

		// Evaluation should be depth 2
		if span.Name() == "Test" && depth != 2 {
			t.Errorf("evaluation should have depth 2, got %d", depth)
		}
	}
}

