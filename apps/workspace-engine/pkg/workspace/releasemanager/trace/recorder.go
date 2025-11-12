package trace

import (
	"context"
	"fmt"
	"sync"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	"go.opentelemetry.io/otel/trace"
)

// ReconcileTarget is the main entry point for trace recording
type ReconcileTarget struct {
	workspaceID      string
	releaseTargetKey string
	releaseID        *string
	jobID            *string
	trigger          TriggerReason

	store PersistenceStore

	// OTel components
	tracerProvider *sdktrace.TracerProvider
	tracer         trace.Tracer
	exporter       *inMemoryExporter

	// Root span and context
	rootSpan    trace.Span
	rootCtx     context.Context
	rootTraceID string

	// Tracking
	mu           sync.Mutex
	nodeSequence int
	depthMap     map[string]int
}

// NewReconcileTarget creates a new trace recorder for reconciliation
func NewReconcileTarget(workspaceID, releaseTargetKey string, trigger TriggerReason) *ReconcileTarget {
	return newReconcileTarget(workspaceID, releaseTargetKey, trigger, nil)
}

// NewReconcileTargetWithStore creates a new trace recorder with pre-configured store
func NewReconcileTargetWithStore(workspaceID, releaseTargetKey string, trigger TriggerReason, store PersistenceStore) *ReconcileTarget {
	return newReconcileTarget(workspaceID, releaseTargetKey, trigger, store)
}

func newReconcileTarget(workspaceID, releaseTargetKey string, trigger TriggerReason, store PersistenceStore) *ReconcileTarget {
	exporter := newInMemoryExporter()

	tp := sdktrace.NewTracerProvider(
		sdktrace.WithSpanProcessor(exporter),
		sdktrace.WithSampler(sdktrace.AlwaysSample()),
	)

	tracer := tp.Tracer("ctrlplane.trace")

	attrs := buildAttributes(
		PhaseReconciliation,
		NodeTypePhase,
		StatusRunning,
		0,
		0,
		workspaceID,
		&releaseTargetKey,
		WithTrigger(trigger),
	)

	// Create a more descriptive span name including the trigger reason
	spanName := fmt.Sprintf("Reconciliation (%s)", trigger)

	rootCtx, rootSpan := tracer.Start(context.Background(), spanName,
		trace.WithAttributes(attrs...),
	)

	rt := &ReconcileTarget{
		workspaceID:      workspaceID,
		releaseTargetKey: releaseTargetKey,
		trigger:          trigger,
		store:            store,
		tracerProvider:   tp,
		tracer:           tracer,
		exporter:         exporter,
		rootSpan:         rootSpan,
		rootCtx:          rootCtx,
		rootTraceID:      rootSpan.SpanContext().TraceID().String(),
		nodeSequence:     0,
		depthMap:         make(map[string]int),
	}

	// Track root span depth
	rt.depthMap[rootSpan.SpanContext().SpanID().String()] = 0

	return rt
}

// buildOptions creates common attribute options from recorder state
func (r *ReconcileTarget) buildOptions() []AttributeOption {
	var opts []AttributeOption
	if r.releaseID != nil {
		opts = append(opts, WithReleaseID(*r.releaseID))
	}
	if r.jobID != nil {
		opts = append(opts, WithJobID(*r.jobID))
	}
	return opts
}

// StartPlanning starts the planning phase
func (r *ReconcileTarget) StartPlanning() *PlanningPhase {
	r.mu.Lock()
	r.nodeSequence++
	seq := r.nodeSequence
	depth := 1
	r.mu.Unlock()

	attrs := buildAttributes(
		PhasePlanning,
		NodeTypePhase,
		StatusRunning,
		depth,
		seq,
		r.workspaceID,
		&r.releaseTargetKey,
		r.buildOptions()...,
	)

	ctx, span := r.tracer.Start(r.rootCtx, "Planning",
		trace.WithAttributes(attrs...),
	)

	r.mu.Lock()
	r.depthMap[span.SpanContext().SpanID().String()] = depth
	r.mu.Unlock()

	return &PlanningPhase{
		recorder: r,
		ctx:      ctx,
		span:     span,
	}
}

// StartEligibility starts the eligibility phase
func (r *ReconcileTarget) StartEligibility() *EligibilityPhase {
	r.mu.Lock()
	r.nodeSequence++
	seq := r.nodeSequence
	depth := 1
	r.mu.Unlock()

	attrs := buildAttributes(
		PhaseEligibility,
		NodeTypePhase,
		StatusRunning,
		depth,
		seq,
		r.workspaceID,
		&r.releaseTargetKey,
		r.buildOptions()...,
	)

	ctx, span := r.tracer.Start(r.rootCtx, "Eligibility",
		trace.WithAttributes(attrs...),
	)

	r.mu.Lock()
	r.depthMap[span.SpanContext().SpanID().String()] = depth
	r.mu.Unlock()

	return &EligibilityPhase{
		recorder: r,
		ctx:      ctx,
		span:     span,
	}
}

// StartExecution starts the execution phase
func (r *ReconcileTarget) StartExecution() *ExecutionPhase {
	r.mu.Lock()
	r.nodeSequence++
	seq := r.nodeSequence
	depth := 1
	r.mu.Unlock()

	attrs := buildAttributes(
		PhaseExecution,
		NodeTypePhase,
		StatusRunning,
		depth,
		seq,
		r.workspaceID,
		&r.releaseTargetKey,
		r.buildOptions()...,
	)

	ctx, span := r.tracer.Start(r.rootCtx, "Execution",
		trace.WithAttributes(attrs...),
	)

	r.mu.Lock()
	r.depthMap[span.SpanContext().SpanID().String()] = depth
	r.mu.Unlock()

	return &ExecutionPhase{
		recorder: r,
		ctx:      ctx,
		span:     span,
	}
}

// StartAction starts a general-purpose action
func (r *ReconcileTarget) StartAction(name string) *Action {
	r.mu.Lock()
	r.nodeSequence++
	seq := r.nodeSequence
	depth := 1
	r.mu.Unlock()

	attrs := buildAttributes(
		PhaseAction,
		NodeTypeAction,
		StatusRunning,
		depth,
		seq,
		r.workspaceID,
		&r.releaseTargetKey,
		r.buildOptions()...,
	)

	ctx, span := r.tracer.Start(r.rootCtx, name,
		trace.WithAttributes(attrs...),
	)

	r.mu.Lock()
	r.depthMap[span.SpanContext().SpanID().String()] = depth
	r.mu.Unlock()

	return &Action{
		recorder: r,
		ctx:      ctx,
		span:     span,
	}
}

// Complete marks the entire reconciliation as complete
func (r *ReconcileTarget) Complete(status Status) {
	r.rootSpan.SetAttributes(attribute.String(attrStatus, string(status)))

	var code codes.Code
	if status == StatusCompleted {
		code = codes.Ok
	} else if status == StatusFailed {
		code = codes.Error
	} else {
		code = codes.Unset
	}

	r.rootSpan.SetStatus(code, string(status))
	r.rootSpan.End()
	// SimpleSpanProcessor exports spans synchronously, no flush needed
}

// Persist writes all spans to the persistence store
func (r *ReconcileTarget) Persist(store ...PersistenceStore) error {
	var targetStore PersistenceStore

	if len(store) > 0 {
		targetStore = store[0]
	} else if r.store != nil {
		targetStore = r.store
	} else {
		return fmt.Errorf("no persistence store configured")
	}

	// SimpleSpanProcessor exports spans synchronously, spans are already collected
	ctx := context.Background()
	spans := r.exporter.getSpans()
	return targetStore.WriteSpans(ctx, spans)
}

// Helper methods

// RootTraceID returns the root trace ID for this reconciliation
func (r *ReconcileTarget) RootTraceID() string {
	return r.rootTraceID
}

// SetJobID sets the job ID for this reconciliation
// This should be called after a job is created to associate all subsequent spans with the job
func (r *ReconcileTarget) SetJobID(jobID string) {
	r.jobID = &jobID
	// Update the root span with the job ID
	r.rootSpan.SetAttributes(attribute.String("ctrlplane.job_id", jobID))
}

func (r *ReconcileTarget) getDepth(ctx context.Context) int {
	span := trace.SpanFromContext(ctx)
	if !span.SpanContext().IsValid() {
		return 0
	}

	r.mu.Lock()
	defer r.mu.Unlock()

	spanID := span.SpanContext().SpanID().String()
	if depth, ok := r.depthMap[spanID]; ok {
		return depth
	}

	return 0
}

func (r *ReconcileTarget) recordDecision(ctx context.Context, name string, decision Decision) {
	// Get depth BEFORE locking to avoid deadlock
	depth := r.getDepth(ctx) + 1

	r.mu.Lock()
	r.nodeSequence++
	seq := r.nodeSequence
	r.mu.Unlock()

	status := StatusCompleted
	if decision == DecisionRejected {
		status = StatusFailed
	}

	attrs := buildAttributes(
		PhasePlanning, // Will be overridden by actual phase
		NodeTypeDecision,
		status,
		depth,
		seq,
		r.workspaceID,
		&r.releaseTargetKey,
		r.buildOptions()...,
	)

	_, span := r.tracer.Start(ctx, name,
		trace.WithAttributes(attrs...),
	)

	span.SetAttributes(attribute.String("ctrlplane.decision", string(decision)))

	if decision == DecisionApproved {
		span.SetStatus(codes.Ok, string(decision))
	} else {
		span.SetStatus(codes.Error, string(decision))
	}

	span.End()
}

func statusToOTelCode(status Status) codes.Code {
	switch status {
	case StatusCompleted:
		return codes.Ok
	case StatusFailed:
		return codes.Error
	default:
		return codes.Unset
	}
}

func evalResultToStatus(result EvaluationResult) Status {
	if result == ResultAllowed {
		return StatusCompleted
	}
	return StatusFailed
}

func checkResultToStatus(result CheckResult) Status {
	if result == CheckResultPass {
		return StatusCompleted
	}
	return StatusFailed
}

func stepResultToStatus(result StepResult) Status {
	if result == StepResultPass {
		return StatusCompleted
	}
	return StatusFailed
}
