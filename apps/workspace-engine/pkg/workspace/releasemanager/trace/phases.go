package trace

import (
	"context"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"
)

// PlanningPhase represents the planning phase
type PlanningPhase struct {
	recorder *ReconcileTarget
	ctx      context.Context
	span     trace.Span
}

// StartEvaluation starts a new policy evaluation
func (p *PlanningPhase) StartEvaluation(name string) *Evaluation {
	// Get depth BEFORE locking to avoid deadlock
	depth := p.recorder.getDepth(p.ctx) + 1

	p.recorder.mu.Lock()
	p.recorder.nodeSequence++
	seq := p.recorder.nodeSequence
	p.recorder.mu.Unlock()

	attrs := buildAttributes(
		PhasePlanning,
		NodeTypeEvaluation,
		StatusRunning,
		depth,
		seq,
		p.recorder.workspaceID,
		&p.recorder.releaseTargetKey,
		p.recorder.buildOptions()...,
	)

	ctx, span := p.recorder.tracer.Start(p.ctx, name,
		trace.WithAttributes(attrs...),
	)

	p.recorder.mu.Lock()
	p.recorder.depthMap[span.SpanContext().SpanID().String()] = depth
	p.recorder.mu.Unlock()

	return &Evaluation{
		recorder: p.recorder,
		ctx:      ctx,
		span:     span,
	}
}

// MakeDecision makes the final planning decision
func (p *PlanningPhase) MakeDecision(message string, decision Decision) {
	p.recorder.recordDecision(p.ctx, message, decision)
}

// End completes the planning phase
func (p *PlanningPhase) End() {
	p.span.SetAttributes(attribute.String(attrStatus, string(StatusCompleted)))
	p.span.SetStatus(codes.Ok, string(StatusCompleted))
	p.span.End()
}

// Evaluation represents a policy evaluation
type Evaluation struct {
	recorder *ReconcileTarget
	ctx      context.Context
	span     trace.Span
}

func (e *Evaluation) SetAttributes(attributes ...attribute.KeyValue) *Evaluation {
	e.span.SetAttributes(attributes...)
	return e
}

// AddMetadata adds metadata to the evaluation
func (e *Evaluation) AddMetadata(key string, value interface{}) *Evaluation {
	attrs := metadataToAttributes(key, value)
	e.span.AddEvent(key, trace.WithAttributes(attrs...))
	return e
}

// SetResult sets the evaluation result
func (e *Evaluation) SetResult(result EvaluationResult, message string) *Evaluation {
	status := evalResultToStatus(result)
	e.span.SetAttributes(
		attribute.String(attrStatus, string(status)),
		attribute.String("ctrlplane.message", message),
		attribute.String("ctrlplane.result", string(result)),
	)

	code := statusToOTelCode(status)
	e.span.SetStatus(code, message)
	return e
}

// End completes the evaluation
func (e *Evaluation) End() {
	e.span.End()
}

// EligibilityPhase represents the eligibility phase
type EligibilityPhase struct {
	recorder *ReconcileTarget
	ctx      context.Context
	span     trace.Span
}

// StartCheck starts a new eligibility check
func (e *EligibilityPhase) StartCheck(name string) *Check {
	// Get depth BEFORE locking to avoid deadlock
	depth := e.recorder.getDepth(e.ctx) + 1

	e.recorder.mu.Lock()
	e.recorder.nodeSequence++
	seq := e.recorder.nodeSequence
	e.recorder.mu.Unlock()

	attrs := buildAttributes(
		PhaseEligibility,
		NodeTypeCheck,
		StatusRunning,
		depth,
		seq,
		e.recorder.workspaceID,
		&e.recorder.releaseTargetKey,
		e.recorder.buildOptions()...,
	)

	ctx, span := e.recorder.tracer.Start(e.ctx, name,
		trace.WithAttributes(attrs...),
	)

	e.recorder.mu.Lock()
	e.recorder.depthMap[span.SpanContext().SpanID().String()] = depth
	e.recorder.mu.Unlock()

	return &Check{
		recorder: e.recorder,
		ctx:      ctx,
		span:     span,
	}
}

// MakeDecision makes the final eligibility decision
func (e *EligibilityPhase) MakeDecision(message string, decision Decision) {
	e.recorder.recordDecision(e.ctx, message, decision)
}

// End completes the eligibility phase
func (e *EligibilityPhase) End() {
	e.span.SetAttributes(attribute.String(attrStatus, string(StatusCompleted)))
	e.span.SetStatus(codes.Ok, string(StatusCompleted))
	e.span.End()
}

// Check represents an eligibility check
type Check struct {
	recorder *ReconcileTarget
	ctx      context.Context
	span     trace.Span
}

// AddMetadata adds metadata to the check
func (c *Check) AddMetadata(key string, value interface{}) *Check {
	attrs := metadataToAttributes(key, value)
	c.span.AddEvent(key, trace.WithAttributes(attrs...))
	return c
}

// SetResult sets the check result
func (c *Check) SetResult(result CheckResult, message string) *Check {
	status := checkResultToStatus(result)
	c.span.SetAttributes(
		attribute.String(attrStatus, string(status)),
		attribute.String("ctrlplane.result", string(result)),
	)

	code := statusToOTelCode(status)
	c.span.SetStatus(code, message)
	return c
}

// End completes the check
func (c *Check) End() {
	c.span.End()
}

// ExecutionPhase represents the execution phase
type ExecutionPhase struct {
	recorder *ReconcileTarget
	ctx      context.Context
	span     trace.Span
}

// StartAction starts an action under the execution phase
func (e *ExecutionPhase) StartAction(name string) *Action {
	// Get depth BEFORE locking to avoid deadlock
	depth := e.recorder.getDepth(e.ctx) + 1

	e.recorder.mu.Lock()
	e.recorder.nodeSequence++
	seq := e.recorder.nodeSequence
	e.recorder.mu.Unlock()

	attrs := buildAttributes(
		PhaseExecution,
		NodeTypeAction,
		StatusRunning,
		depth,
		seq,
		e.recorder.workspaceID,
		&e.recorder.releaseTargetKey,
		e.recorder.buildOptions()...,
	)

	ctx, span := e.recorder.tracer.Start(e.ctx, name,
		trace.WithAttributes(attrs...),
	)

	e.recorder.mu.Lock()
	e.recorder.depthMap[span.SpanContext().SpanID().String()] = depth
	e.recorder.mu.Unlock()

	return &Action{
		recorder: e.recorder,
		ctx:      ctx,
		span:     span,
	}
}

// TriggerJob triggers a deployment job
func (e *ExecutionPhase) TriggerJob(jobType string, config map[string]string) *Job {
	// Get depth BEFORE locking to avoid deadlock
	depth := e.recorder.getDepth(e.ctx) + 1

	e.recorder.mu.Lock()
	e.recorder.nodeSequence++
	seq := e.recorder.nodeSequence
	e.recorder.mu.Unlock()

	attrs := buildAttributes(
		PhaseExecution,
		NodeTypeAction,
		StatusRunning,
		depth,
		seq,
		e.recorder.workspaceID,
		&e.recorder.releaseTargetKey,
		e.recorder.buildOptions()...,
	)

	// Add job type and config as attributes
	attrs = append(attrs, attribute.String("ctrlplane.job_type", jobType))
	for k, v := range config {
		attrs = append(attrs, attribute.String("ctrlplane.job_config."+k, v))
	}

	ctx, span := e.recorder.tracer.Start(e.ctx, "Job: "+jobType,
		trace.WithAttributes(attrs...),
	)

	e.recorder.mu.Lock()
	e.recorder.depthMap[span.SpanContext().SpanID().String()] = depth
	e.recorder.mu.Unlock()

	return &Job{
		recorder: e.recorder,
		ctx:      ctx,
		span:     span,
		jobType:  jobType,
	}
}

// End completes the execution phase
func (e *ExecutionPhase) End() {
	e.span.SetAttributes(attribute.String(attrStatus, string(StatusCompleted)))
	e.span.SetStatus(codes.Ok, string(StatusCompleted))
	e.span.End()
}

// Job represents a triggered deployment job
type Job struct {
	recorder *ReconcileTarget
	ctx      context.Context
	span     trace.Span
	jobType  string
}

// AddMetadata adds metadata to the job
func (j *Job) AddMetadata(key string, value interface{}) *Job {
	attrs := metadataToAttributes(key, value)
	j.span.AddEvent(key, trace.WithAttributes(attrs...))
	return j
}

// Token generates a trace token for external systems
func (j *Job) Token() string {
	traceID := j.recorder.rootTraceID
	jobID := j.jobType // Use job type as identifier

	// Generate token with 24h expiration
	return GenerateDefaultTraceToken(traceID, jobID)
}

// End completes the job
func (j *Job) End() {
	j.span.SetAttributes(attribute.String(attrStatus, string(StatusCompleted)))
	j.span.SetStatus(codes.Ok, string(StatusCompleted))
	j.span.End()
}

// Action represents a general-purpose action
type Action struct {
	recorder *ReconcileTarget
	ctx      context.Context
	span     trace.Span
}

// AddMetadata adds metadata to the action
func (a *Action) AddMetadata(key string, value interface{}) *Action {
	attrs := metadataToAttributes(key, value)
	a.span.AddEvent(key, trace.WithAttributes(attrs...))
	return a
}

// AddStep adds a step to the action (completes immediately)
func (a *Action) AddStep(name string, result StepResult, message string, attributes ...attribute.KeyValue) *Action {
	// Get depth BEFORE locking to avoid deadlock
	depth := a.recorder.getDepth(a.ctx) + 1

	a.recorder.mu.Lock()
	a.recorder.nodeSequence++
	seq := a.recorder.nodeSequence
	a.recorder.mu.Unlock()

	status := stepResultToStatus(result)

	attrs := buildAttributes(
		PhaseAction,
		NodeTypeAction,
		status,
		depth,
		seq,
		a.recorder.workspaceID,
		&a.recorder.releaseTargetKey,
		a.recorder.buildOptions()...,
	)
	attrs = append(attrs, attributes...)
	attrs = append(attrs, attribute.String("ctrlplane.result", string(result)))

	_, span := a.recorder.tracer.Start(a.ctx, name,
		trace.WithAttributes(attrs...),
	)

	code := statusToOTelCode(status)
	span.SetStatus(code, message)
	span.End()

	return a
}

// End completes the action
func (a *Action) End() {
	a.span.SetAttributes(attribute.String(attrStatus, string(StatusCompleted)))
	a.span.SetStatus(codes.Ok, string(StatusCompleted))
	a.span.End()
}
