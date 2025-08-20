// Package policy provides core types and interfaces for policy evaluation and rule management.
// This package defines the fundamental structures used throughout the workspace engine
// for policy-based decision making, including rule evaluation, condition checking,
// and policy decision outcomes.
package rules

import (
	"context"
	"time"
	rt "workspace-engine/pkg/engine/policy/releasetargets"
	"workspace-engine/pkg/model"
	"workspace-engine/pkg/model/deployment"
)

// PolicyDecision represents the possible outcomes when a policy rule is evaluated.
// It determines how the system should respond to a particular policy check.
type PolicyDecision string

const (
	// PolicyDecisionAllow indicates that the policy allows the requested action.
	// This is the positive outcome where no restrictions are applied.
	PolicyDecisionAllow PolicyDecision = "allow"

	// PolicyDecisionDeny indicates that the policy explicitly denies the requested action.
	// This will typically block or prevent the action from proceeding.
	PolicyDecisionDeny PolicyDecision = "deny"

	// PolicyDecisionWarn indicates that the policy allows the action but with warnings.
	// This allows the action to proceed while flagging potential issues or concerns.
	PolicyDecisionWarn PolicyDecision = "warn"
)

// ConditionResult represents the evaluation result of an individual condition within a policy rule.
// Each condition checks a specific field or attribute against expected criteria, providing
// detailed feedback about what was checked and whether it passed.
type ConditionResult struct {
	// Field is the name or identifier of the field being evaluated
	Field string

	// Expected contains the expected value or criteria for this condition
	Expected any

	// Actual contains the actual value that was found during evaluation
	Actual any

	// Passed indicates whether this specific condition was satisfied
	Passed bool

	// Message provides human-readable details about the condition evaluation,
	// including context about why it passed or failed
	Message string
}

// RuleEvaluationResult contains the complete result of evaluating a policy rule against a target.
// It includes both the high-level decision and detailed information about how that decision
// was reached, including individual condition results and any warnings generated.
type RuleEvaluationResult struct {
	// RuleID is the unique identifier of the rule that was evaluated
	RuleID string

	// Decision is the final policy decision made by this rule evaluation
	Decision PolicyDecision

	// Message provides a summary explanation of the rule evaluation result
	Message string

	// EvaluatedAt records when this rule evaluation was performed
	EvaluatedAt time.Time

	// Conditions contains the detailed results of each individual condition
	// that was evaluated as part of this rule. This provides granular insight
	// into which specific checks passed or failed.
	Conditions []ConditionResult

	// Warnings contains any warning messages generated during rule evaluation.
	// These are non-blocking issues that should be brought to attention but
	// don't necessarily prevent the action from proceeding.
	Warnings []string
}

// Passed returns true if the rule evaluation did not result in a denial.
// This is a convenience method that considers both "allow" and "warn" decisions
// as passing, since they both permit the action to continue.
func (r *RuleEvaluationResult) Passed() bool {
	return r.Decision != PolicyDecisionDeny
}

type RuleType string

const (
	RuleTypeMock RuleType = "mock"

	RuleTypeEnvironmentVersionRollout RuleType = "environment-version-rollout"
	RuleTypeVersionAnyApproval        RuleType = "version-any-approval"
)

// Rule is a generic interface that defines the contract for all policy rules.
// Rules are responsible for evaluating targets (which can be any type) against
// specific criteria and returning detailed evaluation results.
//
// The Target type parameter allows rules to be strongly typed for the specific
// types of objects they evaluate (e.g., deployments, releases, resources).
type Rule interface {
	model.Entity

	GetPolicyID() string

	// Evaluate performs the actual rule evaluation against the provided target.
	// It returns a detailed evaluation result that includes the decision,
	// condition results, and any warnings or messages.
	//
	// The context can be used for cancellation, timeouts, and passing
	// request-scoped values needed during evaluation.
	Evaluate(ctx context.Context, target rt.ReleaseTarget, version deployment.DeploymentVersion) (*RuleEvaluationResult, error)

	GetType() RuleType
}

type BaseRule struct {
	ID       string
	PolicyID string
}

func (r *BaseRule) GetID() string {
	return r.ID
}

func (r *BaseRule) GetPolicyID() string {
	return r.PolicyID
}
