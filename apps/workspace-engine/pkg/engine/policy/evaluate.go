package policy

import (
	"context"
	rt "workspace-engine/pkg/engine/policy/releasetargets"
	"workspace-engine/pkg/engine/policy/rules"
	"workspace-engine/pkg/model/policy"
)

type PolicyEvaluationResult struct {
	PolicyID string
	Rules    []rules.RuleEvaluationResult
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
	Evaluate(ctx context.Context, policy *policy.Policy, target rt.ReleaseTarget) (*PolicyEvaluationResult, error)

	// Get policies applicable to a target context
	GetApplicablePolicies(ctx context.Context, target rt.ReleaseTarget) ([]*policy.Policy, error)
}
