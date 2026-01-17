package trace

import (
	"context"
	"fmt"
	"time"

	"go.opentelemetry.io/otel/attribute"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
)

// Phase represents the high-level phase of execution
type Phase string

const (
	PhaseReconciliation Phase = "reconciliation"
	PhasePlanning       Phase = "planning"
	PhaseEligibility    Phase = "eligibility"
	PhaseExecution      Phase = "execution"
	PhaseAction         Phase = "action"
	PhaseExternal       Phase = "external"
)

// NodeType represents the type of trace node
type NodeType string

const (
	NodeTypePhase      NodeType = "phase"
	NodeTypeEvaluation NodeType = "evaluation"
	NodeTypeCheck      NodeType = "check"
	NodeTypeDecision   NodeType = "decision"
	NodeTypeAction     NodeType = "action"
)

// EvaluationResult represents results for policy evaluations
type EvaluationResult string

const (
	ResultAllowed EvaluationResult = "allowed"
	ResultBlocked EvaluationResult = "blocked"
)

// CheckResult represents results for eligibility checks
type CheckResult string

const (
	CheckResultPass CheckResult = "pass"
	CheckResultFail CheckResult = "fail"
)

// StepResult represents results for action steps
type StepResult string

const (
	StepResultPass StepResult = "pass"
	StepResultFail StepResult = "fail"
)

// Decision represents final decision outcomes
type Decision string

const (
	DecisionApproved Decision = "approved"
	DecisionRejected Decision = "rejected"
)

// Status represents overall phase/reconciliation status
type Status string

const (
	StatusRunning   Status = "running"
	StatusCompleted Status = "completed"
	StatusFailed    Status = "failed"
	StatusSkipped   Status = "skipped"
)

// TriggerReason represents why a reconciliation was triggered
type TriggerReason string

const (
	TriggerScheduled           TriggerReason = "scheduled"            // Periodic scheduled reconciliation
	TriggerDeploymentCreated   TriggerReason = "deployment.created"   // New deployment created
	TriggerDeploymentUpdated   TriggerReason = "deployment.updated"   // Deployment configuration changed
	TriggerEnvironmentCreated  TriggerReason = "environment.created"  // New environment created
	TriggerEnvironmentUpdated  TriggerReason = "environment.updated"  // Environment configuration changed
	TriggerResourceCreated     TriggerReason = "resource.created"     // New resource added
	TriggerResourceUpdated     TriggerReason = "resource.updated"     // Resource configuration changed
	TriggerVersionCreated      TriggerReason = "version.created"      // New deployment version created
	TriggerApprovalCreated     TriggerReason = "approval.created"     // User approval granted
	TriggerApprovalUpdated     TriggerReason = "approval.updated"     // User approval status changed
	TriggerPolicyUpdated       TriggerReason = "policy.updated"       // Policy configuration changed
	TriggerVariablesUpdated    TriggerReason = "variables.updated"    // Deployment or resource variables changed
	TriggerJobAgentUpdated     TriggerReason = "jobagent.updated"     // Job agent configuration changed
	TriggerJobSuccess          TriggerReason = "job.success"          // Job was successful
	TriggerJobFailure          TriggerReason = "job.failure"          // Job failed
	TriggerVerificationFailure TriggerReason = "verification.failure" // Verification failed
	TriggerManual              TriggerReason = "manual"               // Manually triggered (e.g., force redeploy)
	TriggerFirstBoot           TriggerReason = "first_boot"           // Initial workspace startup
)

// PersistenceStore interface for storing trace spans
type PersistenceStore interface {
	WriteSpans(ctx context.Context, spans []sdktrace.ReadOnlySpan) error
}

// Attribute keys for trace spans (exported for use by spanstore package)
const (
	AttrPhase         = "ctrlplane.phase"
	AttrNodeType      = "ctrlplane.node_type"
	AttrStatus        = "ctrlplane.status"
	AttrJobID         = "ctrlplane.job_id"
	AttrReleaseID     = "ctrlplane.release_id"
	AttrReleaseTarget = "ctrlplane.release_target_key"
	AttrParentTraceID = "ctrlplane.parent_trace_id"
	AttrDepth         = "ctrlplane.depth"
	AttrSequence      = "ctrlplane.sequence"
	AttrWorkspaceID   = "ctrlplane.workspace_id"
	AttrTrigger       = "ctrlplane.trigger"
)

// Internal aliases for backward compatibility within the trace package
const (
	attrPhase         = AttrPhase
	attrNodeType      = AttrNodeType
	attrStatus        = AttrStatus
	attrJobID         = AttrJobID
	attrReleaseID     = AttrReleaseID
	attrReleaseTarget = AttrReleaseTarget
	attrParentTraceID = AttrParentTraceID
	attrDepth         = AttrDepth
	attrSequence      = AttrSequence
	attrWorkspaceID   = AttrWorkspaceID
	attrTrigger       = AttrTrigger
)

// AttributeOptions holds optional parameters for building attributes
type AttributeOptions struct {
	releaseID     *string
	jobID         *string
	parentTraceID *string
	trigger       *TriggerReason
}

// AttributeOption is a function that configures AttributeOptions
type AttributeOption func(*AttributeOptions)

// WithReleaseID sets the release ID attribute
func WithReleaseID(releaseID string) AttributeOption {
	return func(o *AttributeOptions) {
		o.releaseID = &releaseID
	}
}

// WithJobID sets the job ID attribute
func WithJobID(jobID string) AttributeOption {
	return func(o *AttributeOptions) {
		o.jobID = &jobID
	}
}

// WithParentTraceID sets the parent trace ID attribute
func WithParentTraceID(parentTraceID string) AttributeOption {
	return func(o *AttributeOptions) {
		o.parentTraceID = &parentTraceID
	}
}

// WithTrigger sets the trigger reason attribute
func WithTrigger(trigger TriggerReason) AttributeOption {
	return func(o *AttributeOptions) {
		o.trigger = &trigger
	}
}

// buildAttributes creates OTel attributes for spans
func buildAttributes(
	phase Phase,
	nodeType NodeType,
	status Status,
	depth int,
	sequence int,
	workspaceID string,
	releaseTargetKey *string,
	opts ...AttributeOption,
) []attribute.KeyValue {
	options := &AttributeOptions{}
	for _, opt := range opts {
		opt(options)
	}

	attrs := []attribute.KeyValue{
		attribute.String(attrPhase, string(phase)),
		attribute.String(attrNodeType, string(nodeType)),
		attribute.String(attrStatus, string(status)),
		attribute.Int(attrDepth, depth),
		attribute.Int(attrSequence, sequence),
		attribute.String(attrWorkspaceID, workspaceID),
	}

	if releaseTargetKey != nil {
		attrs = append(attrs, attribute.String(attrReleaseTarget, *releaseTargetKey))
	}
	if options.releaseID != nil {
		attrs = append(attrs, attribute.String(attrReleaseID, *options.releaseID))
	}
	if options.jobID != nil {
		attrs = append(attrs, attribute.String(attrJobID, *options.jobID))
	}
	if options.parentTraceID != nil {
		attrs = append(attrs, attribute.String(attrParentTraceID, *options.parentTraceID))
	}
	if options.trigger != nil {
		attrs = append(attrs, attribute.String(attrTrigger, string(*options.trigger)))
	}

	return attrs
}

// metadataToAttributes converts metadata to OTel attributes
func metadataToAttributes(key string, value interface{}) []attribute.KeyValue {
	switch v := value.(type) {
	case string:
		return []attribute.KeyValue{attribute.String(key, v)}
	case int:
		return []attribute.KeyValue{attribute.Int64(key, int64(v))}
	case int64:
		return []attribute.KeyValue{attribute.Int64(key, v)}
	case float64:
		return []attribute.KeyValue{attribute.Float64(key, v)}
	case bool:
		return []attribute.KeyValue{attribute.Bool(key, v)}
	case []string:
		return []attribute.KeyValue{attribute.StringSlice(key, v)}
	case time.Time:
		return []attribute.KeyValue{attribute.String(key, v.Format(time.RFC3339))}
	default:
		return []attribute.KeyValue{attribute.String(key, fmt.Sprintf("%v", v))}
	}
}
