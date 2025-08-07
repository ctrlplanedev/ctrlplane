package policy

import (
	"context"
)

// Policy interface defines the core contract for deployment policies
// Policies contain multiple rules that determine whether something can deploy to a specific release target
type Policy[Target any] interface {
	GetID() string
	GetPriority() int

	GetTargets() []Target

	GetRule(ruleID string) (Rule[Target], error)
	GetRules() []Rule[Target]

	// Policy evaluation - evaluates all applicable rules
	Evaluate(ctx context.Context, target Target) (*RuleEvaluationResult, error)
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
type PolicyEvaluator[Target any] interface {
	// Evaluate a single policy with all its rules
	Evaluate(ctx context.Context, target Target) (*PolicyEvaluationResult, error)

	// Get policies applicable to a target context
	GetApplicablePolicies(ctx context.Context, target Target) ([]Policy[Target], error)

	// Validate policy configuration
	ValidatePolicy(policy Policy[Target]) error
}

// PolicyRepository interface for policy data access

type PolicyRepository[Target any] interface {
	// Basic CRUD operations
	GetPolicy(ctx context.Context, policyID string) (Policy[Target], error)
	CreatePolicy(ctx context.Context, policy Policy[Target]) error
	UpdatePolicy(ctx context.Context, policy Policy[Target]) error

	// Policy querying
	GetPoliciesForTarget(ctx context.Context, target Target) ([]Policy[Target], error)
	GetAllPolicies(ctx context.Context) ([]Policy[Target], error)
}
