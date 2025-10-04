package policies

import (
	"context"
	"fmt"

	"workspace-engine/pkg/workspace/releasemanager/policymanager/evaluator"
	"workspace-engine/pkg/workspace/releasemanager/policymanager/evaluator/results"
	"workspace-engine/pkg/workspace/releasemanager/policymanager/rules"
)

// NewPolicyEvaluator creates a new policy evaluator with the given registry.
func NewPolicyEvaluator(registry *rules.RuleRegistry) *PolicyEvaluator {
	return &PolicyEvaluator{
		registry: registry,
	}
}

// PolicyEvaluator orchestrates the evaluation of all rules in a policy.
type PolicyEvaluator struct {
	registry *rules.RuleRegistry
}

// Evaluate evaluates all rules in the evaluation context's policy.
// It returns a comprehensive result showing the outcome of each rule.
func (pe *PolicyEvaluator) Evaluate(ctx context.Context, evalCtx *evaluator.EvaluationContext) (*results.PolicyEvaluationResult, error) {
	result := results.NewPolicyEvaluation(evalCtx.Policy.Id, evalCtx.Policy.Name)

	// Evaluate each rule in the policy
	for _, rule := range evalCtx.Policy.Rules {
		evaluator, err := pe.registry.CreateEvaluator(rule)
		if err != nil {
			return nil, fmt.Errorf("failed to create evaluator for rule: %w", err)
		}

		ruleResult, err := evaluator.Evaluate(ctx, evalCtx)
		if err != nil {
			return nil, fmt.Errorf("failed to evaluate rule %s: %w", evaluator.RuleID(), err)
		}

		result.AddRuleResult(ruleResult)
	}

	result.GenerateSummary()
	return result, nil
}
