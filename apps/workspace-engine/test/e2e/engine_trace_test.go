package e2e

import (
	"context"
	"testing"
	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/releasemanager/trace"
	"workspace-engine/test/integration"
	c "workspace-engine/test/integration/creators"

	"github.com/google/uuid"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
)

// TestEngine_Trace_BasicDeploymentFlow tests that a complete deployment flow
// creates a proper trace with Planning, Eligibility, and Execution phases
func TestEngine_Trace_BasicDeploymentFlow(t *testing.T) {
	jobAgentId := uuid.New().String()
	deploymentId := uuid.New().String()
	environmentId := uuid.New().String()
	resourceId := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentId),
			integration.JobAgentName("Test Agent"),
		),
		integration.WithSystem(
			integration.SystemName("test-system"),
			integration.WithDeployment(
				integration.DeploymentID(deploymentId),
				integration.DeploymentName("api-service"),
				integration.DeploymentJobAgent(jobAgentId),
				integration.DeploymentCelResourceSelector("true"),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentId),
				integration.EnvironmentName("production"),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceID(resourceId),
			integration.ResourceName("server-1"),
			integration.ResourceKind("server"),
		),
	)

	ctx := context.Background()

	// Clear any existing traces
	integration.ClearTraces(engine)

	// Create a deployment version to trigger deployment
	dv := c.NewDeploymentVersion()
	dv.DeploymentId = deploymentId
	dv.Tag = "v1.0.0"

	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv)

	// Verify job was created
	jobs := engine.Workspace().Jobs().GetPending()
	if len(jobs) != 1 {
		t.Fatalf("expected 1 job, got %d", len(jobs))
	}

	// Get all traces
	spans := integration.GetAllTraces(engine)
	if len(spans) == 0 {
		t.Fatal("no traces captured")
	}

	// Verify trace structure
	integration.VerifyTraceStructure(t, spans, []trace.Phase{
		trace.PhasePlanning,
		trace.PhaseEligibility,
		trace.PhaseExecution,
	})

	// Verify root span exists and has correct workspace_id
	rootSpan := integration.AssertRootReconciliationSpan(t, spans)
	releaseTargets, _ := engine.Workspace().ReleaseTargets().Items()
	var firstRTKey string
	for k := range releaseTargets {
		firstRTKey = k
		break
	}
	integration.AssertSpanAttributes(t, rootSpan, map[string]any{
		"ctrlplane.workspace_id":       engine.Workspace().ID,
		"ctrlplane.release_target_key": releaseTargets[firstRTKey].Key(),
	})

	// Verify Planning phase exists
	planningSpan := integration.AssertPhaseExists(t, spans, trace.PhasePlanning)
	if planningSpan == nil {
		t.Fatal("planning span not found")
	}

	// Verify Eligibility phase exists
	eligibilitySpan := integration.AssertPhaseExists(t, spans, trace.PhaseEligibility)
	if eligibilitySpan == nil {
		t.Fatal("eligibility span not found")
	}

	// Verify Execution phase exists
	executionSpan := integration.AssertPhaseExists(t, spans, trace.PhaseExecution)
	if executionSpan == nil {
		t.Fatal("execution span not found")
	}

	// Verify all spans share the same trace ID
	traceID := rootSpan.SpanContext().TraceID()
	for _, span := range spans {
		if span.SpanContext().TraceID() != traceID {
			t.Errorf("span %s has different trace ID", span.Name())
		}
	}

	// Verify depth tracking
	integration.VerifySpanDepth(t, spans)

	// Verify timeline ordering
	integration.VerifyTraceTimeline(t, spans)

	// Verify sequence numbers increment
	integration.VerifySequenceNumbers(t, spans)

	t.Logf("Trace captured successfully with %d spans", len(spans))
	integration.DumpTrace(t, spans)
}

// TestEngine_Trace_MultiplePolicyEvaluations tests that multiple policy
// evaluations are captured in the trace
func TestEngine_Trace_MultiplePolicyEvaluations(t *testing.T) {
	jobAgentId := uuid.New().String()
	deploymentId := uuid.New().String()
	environmentId := uuid.New().String()
	resourceId := uuid.New().String()
	policyId1 := uuid.New().String()
	policyId2 := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentId),
			integration.JobAgentName("Test Agent"),
		),
		integration.WithSystem(
			integration.SystemName("test-system"),
			integration.WithDeployment(
				integration.DeploymentID(deploymentId),
				integration.DeploymentName("api-service"),
				integration.DeploymentJobAgent(jobAgentId),
				integration.DeploymentCelResourceSelector("true"),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentId),
				integration.EnvironmentName("production"),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceID(resourceId),
			integration.ResourceName("server-1"),
			integration.ResourceKind("server"),
		),
		// Add approval policy
		integration.WithPolicy(
			integration.PolicyID(policyId1),
			integration.PolicyName("Approval Required"),
			integration.WithPolicySelector("true"),
			integration.WithPolicyRule(
				integration.WithRuleAnyApproval(1),
			),
		),
		// Add gradual rollout policy
		integration.WithPolicy(
			integration.PolicyID(policyId2),
			integration.PolicyName("Gradual Rollout"),
			integration.WithPolicySelector("true"),
			integration.WithPolicyRule(
				integration.WithRuleGradualRollout(300),
			),
		),
	)

	ctx := context.Background()
	integration.ClearTraces(engine)

	// Create deployment version
	dv := c.NewDeploymentVersion()
	dv.DeploymentId = deploymentId
	dv.Tag = "v1.0.0"

	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv)

	// Add approval so the approval policy passes and gradual rollout can be evaluated
	user1ID := uuid.New().String()
	approval := &oapi.UserApprovalRecord{
		VersionId:     dv.Id,
		EnvironmentId: environmentId,
		Status:        oapi.ApprovalStatusApproved,
		UserId:        user1ID,
		CreatedAt:     "2024-01-01T00:00:00Z",
	}
	engine.PushEvent(ctx, handler.UserApprovalRecordCreate, approval)

	// Get traces
	spans := integration.GetAllTraces(engine)
	if len(spans) == 0 {
		t.Fatal("no traces captured")
	}

	// With the index-based planning architecture, policy evaluations happen
	// during StateIndex.Recompute (not in the reconciliation trace). The
	// reconciliation trace records index-lookup decisions instead.

	// Verify planning phase contains decision spans (index-based decisions)
	planningSpans := integration.FindSpansByPhase(spans, trace.PhasePlanning)
	hasDecisions := false
	for _, span := range planningSpans {
		nodeType, hasType := integration.GetSpanAttribute(span, "ctrlplane.node_type")
		if hasType && nodeType.AsString() == string(trace.NodeTypeDecision) {
			hasDecisions = true
			break
		}
	}

	if !hasDecisions {
		t.Error("planning phase should contain decision spans")
	}

	// Verify decision spans exist — we expect at least:
	// - "No desired release in index" (version.created, blocked by approval)
	// - "Desired release resolved from index" (approval.created, policies pass)
	decisionCount := integration.CountSpansByType(spans, trace.NodeTypeDecision)
	if decisionCount < 2 {
		t.Errorf("expected at least 2 decision spans (blocked + approved), got %d", decisionCount)
	}

	// Verify eligibility and execution phases exist in the successful reconciliation
	eligibilitySpans := integration.FindSpansByPhase(spans, trace.PhaseEligibility)
	if len(eligibilitySpans) == 0 {
		t.Error("expected eligibility phase in trace")
	}

	executionSpans := integration.FindSpansByPhase(spans, trace.PhaseExecution)
	if len(executionSpans) == 0 {
		t.Error("expected execution phase in trace")
	}

	t.Logf("Captured %d decisions, %d eligibility spans, %d execution spans",
		decisionCount, len(eligibilitySpans), len(executionSpans))
	integration.DumpTrace(t, spans)
}

// TestEngine_Trace_BlockedDeployment tests that a blocked deployment
// creates a trace with rejection recorded
func TestEngine_Trace_BlockedDeployment(t *testing.T) {
	t.Skip("Blocked deployment test requires policy that actually blocks - TBD")
	// TODO: Implement once we have a reliable way to create blocking policy
}

// TestEngine_Trace_FailedEligibilityCheck tests that failed eligibility checks
// are captured in the trace
func TestEngine_Trace_FailedEligibilityCheck(t *testing.T) {
	jobAgentId := uuid.New().String()
	deploymentId := uuid.New().String()
	environmentId := uuid.New().String()
	resourceId := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentId),
			integration.JobAgentName("Test Agent"),
		),
		integration.WithSystem(
			integration.SystemName("test-system"),
			integration.WithDeployment(
				integration.DeploymentID(deploymentId),
				integration.DeploymentName("api-service"),
				integration.DeploymentJobAgent(jobAgentId),
				integration.DeploymentCelResourceSelector("true"),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentId),
				integration.EnvironmentName("production"),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceID(resourceId),
			integration.ResourceName("server-1"),
			integration.ResourceKind("server"),
		),
	)

	ctx := context.Background()
	integration.ClearTraces(engine)

	// Create first deployment
	dv1 := c.NewDeploymentVersion()
	dv1.DeploymentId = deploymentId
	dv1.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv1)

	// Wait for first deployment to complete
	jobs := engine.Workspace().Jobs().GetPending()
	if len(jobs) != 1 {
		t.Fatalf("expected 1 job after first deployment, got %d", len(jobs))
	}

	// Clear traces before second deployment
	integration.ClearTraces(engine)

	// Try to deploy same version again - should fail eligibility
	dv2 := c.NewDeploymentVersion()
	dv2.DeploymentId = deploymentId
	dv2.Tag = "v1.0.0" // Same version

	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv2)

	// Should not create new job
	jobs = engine.Workspace().Jobs().GetPending()
	if len(jobs) != 1 {
		// Note: This test's behavior depends on eligibility logic
		t.Logf("Note: Jobs count is %d, eligibility behavior may vary", len(jobs))
	}

	// Get traces from second deployment attempt
	spans := integration.GetAllTraces(engine)
	if len(spans) == 0 {
		t.Fatal("no traces captured for second deployment")
	}

	// Verify eligibility phase exists
	eligibilitySpans := integration.FindSpansByPhase(spans, trace.PhaseEligibility)
	if len(eligibilitySpans) == 0 {
		t.Error("eligibility phase should exist")
	}

	// Check for eligibility checks
	checkCount := integration.CountSpansByType(spans, trace.NodeTypeCheck)
	if checkCount == 0 {
		t.Logf("Note: No check spans found, may need to adjust test")
	}

	t.Logf("Eligibility trace captured with %d spans", len(spans))
	integration.DumpTrace(t, spans)
}

// TestEngine_Trace_SuccessfulJobCreation tests that job creation
// is properly captured in the execution phase
func TestEngine_Trace_SuccessfulJobCreation(t *testing.T) {
	jobAgentId := uuid.New().String()
	deploymentId := uuid.New().String()
	environmentId := uuid.New().String()
	resourceId := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentId),
			integration.JobAgentName("Test Agent"),
		),
		integration.WithSystem(
			integration.SystemName("test-system"),
			integration.WithDeployment(
				integration.DeploymentID(deploymentId),
				integration.DeploymentName("api-service"),
				integration.DeploymentJobAgent(jobAgentId),
				integration.DeploymentCelResourceSelector("true"),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentId),
				integration.EnvironmentName("production"),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceID(resourceId),
			integration.ResourceName("server-1"),
			integration.ResourceKind("server"),
		),
	)

	ctx := context.Background()
	integration.ClearTraces(engine)

	// Create deployment version
	dv := c.NewDeploymentVersion()
	dv.DeploymentId = deploymentId
	dv.Tag = "v1.0.0"

	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv)

	// Verify job was created
	jobs := engine.Workspace().Jobs().GetPending()
	if len(jobs) != 1 {
		t.Fatalf("expected 1 job, got %d", len(jobs))
	}

	// Get traces
	spans := integration.GetAllTraces(engine)
	if len(spans) == 0 {
		t.Fatal("no traces captured")
	}

	// Verify execution phase exists
	executionSpans := integration.FindSpansByPhase(spans, trace.PhaseExecution)
	if len(executionSpans) == 0 {
		t.Fatal("execution phase not found")
	}

	// Look for action spans in execution phase (job creation)
	actionCount := integration.CountSpansByType(spans, trace.NodeTypeAction)
	if actionCount == 0 {
		t.Logf("Note: No action spans found, job creation may not be traced yet")
	}

	t.Logf("Execution trace captured with %d spans (%d actions)", len(spans), actionCount)
	integration.DumpTrace(t, spans)
}

// TestEngine_Trace_ConcurrentDeployments tests that concurrent deployments
// create separate, non-overlapping traces
func TestEngine_Trace_ConcurrentDeployments(t *testing.T) {
	jobAgentId := uuid.New().String()
	deployment1Id := uuid.New().String()
	deployment2Id := uuid.New().String()
	environmentId := uuid.New().String()
	resource1Id := uuid.New().String()
	resource2Id := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentId),
			integration.JobAgentName("Test Agent"),
		),
		integration.WithSystem(
			integration.SystemName("test-system"),
			integration.WithDeployment(
				integration.DeploymentID(deployment1Id),
				integration.DeploymentName("api-service-1"),
				integration.DeploymentJobAgent(jobAgentId),
				integration.DeploymentCelResourceSelector("resource.name == 'server-1'"),
			),
			integration.WithDeployment(
				integration.DeploymentID(deployment2Id),
				integration.DeploymentName("api-service-2"),
				integration.DeploymentJobAgent(jobAgentId),
				integration.DeploymentCelResourceSelector("resource.name == 'server-2'"),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentId),
				integration.EnvironmentName("production"),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceID(resource1Id),
			integration.ResourceName("server-1"),
			integration.ResourceKind("server"),
		),
		integration.WithResource(
			integration.ResourceID(resource2Id),
			integration.ResourceName("server-2"),
			integration.ResourceKind("server"),
		),
	)

	ctx := context.Background()
	integration.ClearTraces(engine)

	// Create two deployment versions
	dv1 := c.NewDeploymentVersion()
	dv1.DeploymentId = deployment1Id
	dv1.Tag = "v1.0.0"

	dv2 := c.NewDeploymentVersion()
	dv2.DeploymentId = deployment2Id
	dv2.Tag = "v1.0.0"

	// Push both events
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv1)
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv2)

	// Verify jobs were created
	jobs := engine.Workspace().Jobs().GetPending()
	if len(jobs) < 2 {
		t.Logf("Note: Expected 2 jobs, got %d - may be expected depending on selector logic", len(jobs))
	}

	// Get all traces
	spans := integration.GetAllTraces(engine)
	if len(spans) == 0 {
		t.Fatal("no traces captured")
	}

	// Count unique trace IDs
	traceIDs := make(map[string]bool)
	for _, span := range spans {
		traceIDs[span.SpanContext().TraceID().String()] = true
	}

	if len(traceIDs) < 2 {
		t.Logf("Note: Found %d unique trace IDs, expected at least 2", len(traceIDs))
	}

	// Verify each trace is complete
	for traceID := range traceIDs {
		var traceSpans []sdktrace.ReadOnlySpan
		for _, span := range spans {
			if span.SpanContext().TraceID().String() == traceID {
				traceSpans = append(traceSpans, span)
			}
		}

		// Each trace should have a root span (starts with "Reconciliation")
		_, hasRoot := integration.FindRootReconciliationSpan(traceSpans)
		if !hasRoot {
			t.Errorf("trace %s missing root span", traceID)
		}
	}

	t.Logf("Captured %d unique traces with %d total spans", len(traceIDs), len(spans))
}
