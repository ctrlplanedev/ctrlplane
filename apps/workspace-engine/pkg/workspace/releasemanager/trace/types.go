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

// PersistenceStore interface for storing trace spans
type PersistenceStore interface {
	WriteSpans(ctx context.Context, spans []sdktrace.ReadOnlySpan) error
}

// Internal attribute keys
const (
	attrPhase         = "ctrlplane.phase"
	attrNodeType      = "ctrlplane.node_type"
	attrStatus        = "ctrlplane.status"
	attrJobID         = "ctrlplane.job_id"
	attrReleaseID     = "ctrlplane.release_id"
	attrReleaseTarget = "ctrlplane.release_target_key"
	attrParentTraceID = "ctrlplane.parent_trace_id"
	attrDepth         = "ctrlplane.depth"
	attrSequence      = "ctrlplane.sequence"
	attrWorkspaceID   = "ctrlplane.workspace_id"
)

// buildAttributes creates OTel attributes for spans
func buildAttributes(
	phase Phase,
	nodeType NodeType,
	status Status,
	depth int,
	sequence int,
	workspaceID string,
	releaseTargetKey *string,
	releaseID *string,
	jobID *string,
	parentTraceID *string,
) []attribute.KeyValue {
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
	if releaseID != nil {
		attrs = append(attrs, attribute.String(attrReleaseID, *releaseID))
	}
	if jobID != nil {
		attrs = append(attrs, attribute.String(attrJobID, *jobID))
	}
	if parentTraceID != nil {
		attrs = append(attrs, attribute.String(attrParentTraceID, *parentTraceID))
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
