package results

import (
	"context"
	"workspace-engine/pkg/oapi"
)

type VersionRuleEvaluator interface {
	Evaluate(
		ctx context.Context,
		releaseTarget *oapi.ReleaseTarget,
		version *oapi.DeploymentVersion,
	) (*RuleEvaluationResult, error)
}

type ReleaseRuleEvaluator interface {
	Evaluate(
		ctx context.Context,
		releaseTarget *oapi.ReleaseTarget,
		release *oapi.Release,
	) (*RuleEvaluationResult, error)
}

type ReleaseTargetRuleEvaluator interface {
	Evaluate(
		ctx context.Context,
		releaseTarget *oapi.ReleaseTarget,
	) (*RuleEvaluationResult, error)
}

type ActionType string

const (
	ActionTypeApproval ActionType = "approval"
	ActionTypeWait     ActionType = "wait"
)

// EvaluationResult represents the outcome of evaluating a policy rule.
type RuleEvaluationResult struct {
	// Allowed indicates whether the rule permits the deployment
	Allowed bool

	// Reason provides a human-readable explanation for the result
	Reason string

	// Details contains structured information about the evaluation
	// (e.g., approval status, concurrent deployments count)
	Details map[string]any

	// ActionRequired indicates if the rule needs external action before proceeding
	// (e.g., approval rules require someone to approve)
	ActionRequired bool

	// ActionType describes what action is needed (e.g., "approval", "wait")
	ActionType ActionType
}

// WithDetail adds a detail to the result and returns the result for chaining.
func (r *RuleEvaluationResult) WithDetail(key string, value any) *RuleEvaluationResult {
	if r.Details == nil {
		r.Details = make(map[string]any)
	}
	r.Details[key] = value
	return r
}

// NewPendingResult creates a result indicating the rule requires action before proceeding.
func NewPendingResult(actionType ActionType, reason string) *RuleEvaluationResult {
	return &RuleEvaluationResult{
		Allowed:        false,
		Reason:         reason,
		Details:        make(map[string]any),
		ActionRequired: true,
		ActionType:     actionType,
	}
}

// NewDeniedResult creates a result indicating the rule denies the deployment.
func NewDeniedResult(reason string) *RuleEvaluationResult {
	return &RuleEvaluationResult{
		Allowed:        false,
		Reason:         reason,
		Details:        make(map[string]any),
		ActionRequired: false,
	}
}

// NewAllowedResult creates a result indicating the rule allows the deployment.
func NewAllowedResult(reason string) *RuleEvaluationResult {
	return &RuleEvaluationResult{
		Allowed:        true,
		Reason:         reason,
		Details:        make(map[string]any),
		ActionRequired: false,
	}
}
