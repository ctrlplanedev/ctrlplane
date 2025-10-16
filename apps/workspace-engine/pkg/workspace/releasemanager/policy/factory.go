package policy

import (
	"context"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator/approval"
	"workspace-engine/pkg/workspace/releasemanager/policy/results"
	"workspace-engine/pkg/workspace/store"
)

// EvaluatorFactory creates and coordinates policy rule evaluators.
// It maps policy rules to their corresponding evaluator implementations
// and orchestrates the evaluation of all rules in a policy.
type EvaluatorFactory struct {
	store *store.Store
}

func NewEvaluatorFactory(store *store.Store) *EvaluatorFactory {
	return &EvaluatorFactory{store: store}
}

// EvaluateVersionScopedPolicyRules evaluates all version-scoped rules in a policy.
// Returns nil if any rule evaluation fails.
func (f *EvaluatorFactory) EvaluateVersionScopedPolicyRules(
	ctx context.Context,
	policy *oapi.Policy,
	releaseTarget *oapi.ReleaseTarget,
	version *oapi.DeploymentVersion,
) []*results.RuleEvaluationResult {
	return evaluateRules(policy, func(rule *oapi.PolicyRule) (*results.RuleEvaluationResult, error) {
		eval := f.createVersionScopedEvaluator(rule)
		if eval == nil {
			return nil, nil // Skip unknown rule types
		}
		return eval.Evaluate(ctx, releaseTarget, version)
	})
}

// EvaluateTargetScopedPolicyRules evaluates all target-scoped rules in a policy.
// Returns nil if any rule evaluation fails.
func (f *EvaluatorFactory) EvaluateTargetScopedPolicyRules(
	ctx context.Context,
	policy *oapi.Policy,
	releaseTarget *oapi.ReleaseTarget,
) []*results.RuleEvaluationResult {
	return evaluateRules(policy, func(rule *oapi.PolicyRule) (*results.RuleEvaluationResult, error) {
		eval := f.createTargetScopedEvaluator(rule)
		if eval == nil {
			return nil, nil // Skip unknown rule types
		}
		return eval.Evaluate(ctx, releaseTarget)
	})
}

// EvaluateReleaseScopedPolicyRules evaluates all release-scoped rules in a policy.
// Returns nil if any rule evaluation fails.
func (f *EvaluatorFactory) EvaluateReleaseScopedPolicyRules(
	ctx context.Context,
	policy *oapi.Policy,
	releaseTarget *oapi.ReleaseTarget,
	release *oapi.Release,
) []*results.RuleEvaluationResult {
	return evaluateRules(policy, func(rule *oapi.PolicyRule) (*results.RuleEvaluationResult, error) {
		eval := f.createReleaseScopedEvaluator(rule)
		if eval == nil {
			return nil, nil // Skip unknown rule types
		}
		return eval.Evaluate(ctx, release)
	})
}

// EvaluateWorkspaceScopedPolicyRules evaluates all workspace-scoped rules in a policy.
// Returns nil if any rule evaluation fails.
func (f *EvaluatorFactory) EvaluateWorkspaceScopedPolicyRules(
	ctx context.Context,
	policy *oapi.Policy,
) []*results.RuleEvaluationResult {
	return evaluateRules(policy, func(rule *oapi.PolicyRule) (*results.RuleEvaluationResult, error) {
		eval := f.createWorkspaceScopedEvaluator(rule)
		if eval == nil {
			return nil, nil // Skip unknown rule types
		}
		return eval.Evaluate(ctx)
	})
}

// evaluateRules is a helper that evaluates all rules in a policy using the provided evaluator function.
func evaluateRules(
	policy *oapi.Policy,
	evalFn func(*oapi.PolicyRule) (*results.RuleEvaluationResult, error),
) []*results.RuleEvaluationResult {
	ruleResults := make([]*results.RuleEvaluationResult, 0, len(policy.Rules))

	for _, rule := range policy.Rules {
		result, err := evalFn(&rule)
		if err != nil {
			return nil
		}
		if result != nil {
			ruleResults = append(ruleResults, result)
		}
	}

	return ruleResults
}

// createVersionScopedEvaluator creates a version-scoped evaluator for the given rule.
// Returns nil for unknown rule types.
func (f *EvaluatorFactory) createVersionScopedEvaluator(rule *oapi.PolicyRule) evaluator.VersionScopedEvaluator {
	switch {
	case rule.AnyApproval != nil:
		return approval.NewAnyApprovalEvaluator(f.store, rule.AnyApproval)
	default:
		return nil
	}
}

// createTargetScopedEvaluator creates a target-scoped evaluator for the given rule.
// Returns nil for unknown rule types.
func (f *EvaluatorFactory) createTargetScopedEvaluator(rule *oapi.PolicyRule) evaluator.TargetScopedEvaluator {
	switch {
	default:
		return nil
	}
}

// createReleaseScopedEvaluator creates a release-scoped evaluator for the given rule.
// Returns nil for unknown rule types.
func (f *EvaluatorFactory) createReleaseScopedEvaluator(rule *oapi.PolicyRule) evaluator.ReleaseScopedEvaluator {
	switch {
	default:
		return nil
	}
}

// createWorkspaceScopedEvaluator creates a workspace-scoped evaluator for the given rule.
// Returns nil for unknown rule types.
func (f *EvaluatorFactory) createWorkspaceScopedEvaluator(rule *oapi.PolicyRule) evaluator.WorkspaceScopedEvaluator {
	switch {
	default:
		return nil
	}
}
