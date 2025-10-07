package results

import (
	"context"
	"workspace-engine/pkg/pb"
)

type VersionRuleEvaluator interface {
	Evaluate(
		ctx context.Context,
		releaseTarget *pb.ReleaseTarget,
		version *pb.DeploymentVersion,
	) (*RuleEvaluationResult, error)
}

type ReleaseRuleEvaluator interface {
	Evaluate(
		ctx context.Context,
		releaseTarget *pb.ReleaseTarget,
		release *pb.Release,
	) (*RuleEvaluationResult, error)
}

type ReleaseTargetRuleEvaluator interface {
	Evaluate(
		ctx context.Context,
		releaseTarget *pb.ReleaseTarget,
	) (*RuleEvaluationResult, error)
}

// EvaluationResult represents the outcome of evaluating a policy rule.
type RuleEvaluationResult struct {
	// Allowed indicates whether the rule permits the deployment
	Allowed bool

	// Reason provides a human-readable explanation for the result
	Reason string

	// Details contains structured information about the evaluation
	// (e.g., approval status, concurrent deployments count)
	Details map[string]any

	// RequiresAction indicates if the rule needs external action before proceeding
	// (e.g., approval rules require someone to approve)
	RequiresAction bool

	// ActionType describes what action is needed (e.g., "approval", "wait")
	ActionType string
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
func NewPendingResult(ruleType, actionType, reason string) *RuleEvaluationResult {
	return &RuleEvaluationResult{
		Allowed:        false,
		Reason:         reason,
		Details:        make(map[string]any),
		RequiresAction: true,
		ActionType:     actionType,
	}
}

// NewDeniedResult creates a result indicating the rule denies the deployment.
func NewDeniedResult(reason string) *RuleEvaluationResult {
	return &RuleEvaluationResult{
		Allowed:        false,
		Reason:         reason,
		Details:        make(map[string]any),
		RequiresAction: false,
	}
}

// NewAllowedResult creates a result indicating the rule allows the deployment.
func NewAllowedResult(reason string) *RuleEvaluationResult {
	return &RuleEvaluationResult{
		Allowed:        true,
		Reason:         reason,
		Details:        make(map[string]any),
		RequiresAction: false,
	}
}
