package policy

import (
	"context"
)

// Policy interface defines the core contract for deployment policies
// Policies contain multiple rules that determine whether something can deploy to a specific release target
type Policy interface {
	GetID() string
	GetPriority() int

	GetTargets() []ReleaseTarget

	GetRule(ruleID string) (Rule[ReleaseTarget], error)
	GetRules() []Rule[ReleaseTarget]

	// Policy evaluation - evaluates all applicable rules
	Evaluate(ctx context.Context, target ReleaseTarget) (*RuleEvaluationResult, error)
}

type PolicyEvaluationResult struct {
	PolicyID string
	Rules    []RuleEvaluationResult
}

func (r *PolicyEvaluationResult) Passed() bool {
	for _, rule := range r.Rules {
		if !rule.Passed() {
			return false
		}
	}
	return true
}

// PolicyEvaluator handles evaluation of specific policy types
type PolicyEvaluator interface {
	// Evaluate a single policy with all its rules
	Evaluate(ctx context.Context, target ReleaseTarget) (*PolicyEvaluationResult, error)

	// Get policies applicable to a target context
	GetApplicablePolicies(ctx context.Context, target ReleaseTarget) ([]Policy, error)

	// Validate policy configuration
	ValidatePolicy(policy Policy) error
}
