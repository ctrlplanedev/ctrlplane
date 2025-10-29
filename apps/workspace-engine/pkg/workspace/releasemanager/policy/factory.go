package policy

import (
	"context"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator/approval"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator/environmentprogression"
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

func (f *EvaluatorFactory) EvaluateEnvironmentAndVersionScopedPolicyRules(
	ctx context.Context,
	policy *oapi.Policy,
	environment *oapi.Environment,
	version *oapi.DeploymentVersion,
) []*oapi.RuleEvaluation {
	return evaluateRules(policy, func(rule *oapi.PolicyRule) ([]*oapi.RuleEvaluation, error) {
		eval := f.createEnvironmentAndVersionScopedEvaluator(rule)
		if eval == nil {
			return nil, nil // Skip unknown rule types
		}
		ruleResults := make([]*oapi.RuleEvaluation, 0, len(eval))
		for _, eval := range eval {
			result, err := eval.Evaluate(ctx, environment, version)
			if err != nil {
				return nil, err
			}
			ruleResults = append(ruleResults, result)
		}
		return ruleResults, nil
	})
}

// EvaluateVersionScopedPolicyRules evaluates all version-scoped rules in a policy.
// Returns nil if any rule evaluation fails.
func (f *EvaluatorFactory) EvaluateVersionScopedPolicyRules(
	ctx context.Context,
	policy *oapi.Policy,
	version *oapi.DeploymentVersion,
) []*oapi.RuleEvaluation {
	return evaluateRules(policy, func(rule *oapi.PolicyRule) ([]*oapi.RuleEvaluation, error) {
		eval := f.createVersionScopedEvaluator(rule)
		if eval == nil {
			return nil, nil // Skip unknown rule types
		}
		ruleResults := make([]*oapi.RuleEvaluation, 0, len(eval))
		for _, eval := range eval {
			result, err := eval.Evaluate(ctx, version)
			if err != nil {
				return nil, err
			}
			ruleResults = append(ruleResults, result)
		}
		return ruleResults, nil
	})
}

// EvaluateTargetScopedPolicyRules evaluates all target-scoped rules in a policy.
// Returns nil if any rule evaluation fails.
func (f *EvaluatorFactory) EvaluateTargetScopedPolicyRules(
	ctx context.Context,
	policy *oapi.Policy,
	releaseTarget *oapi.ReleaseTarget,
) []*oapi.RuleEvaluation {
	return evaluateRules(policy, func(rule *oapi.PolicyRule) ([]*oapi.RuleEvaluation, error) {
		evals := f.createTargetScopedEvaluator(rule)
		if evals == nil {
			return nil, nil // Skip unknown rule types
		}
		ruleResults := make([]*oapi.RuleEvaluation, 0, len(evals))
		for _, eval := range evals {
			result, err := eval.Evaluate(ctx, releaseTarget)
			if err != nil {
				return nil, err
			}
			ruleResults = append(ruleResults, result)
		}
		return ruleResults, nil
	})
}

// EvaluateReleaseScopedPolicyRules evaluates all release-scoped rules in a policy.
// Returns nil if any rule evaluation fails.
func (f *EvaluatorFactory) EvaluateReleaseScopedPolicyRules(
	ctx context.Context,
	policy *oapi.Policy,
	release *oapi.Release,
) []*oapi.RuleEvaluation {
	return evaluateRules(policy, func(rule *oapi.PolicyRule) ([]*oapi.RuleEvaluation, error) {
		evals := f.createReleaseScopedEvaluator(rule)
		if evals == nil {
			return nil, nil // Skip unknown rule types
		}
		ruleResults := make([]*oapi.RuleEvaluation, 0, len(evals))
		for _, eval := range evals {
			result, err := eval.Evaluate(ctx, release)
			if err != nil {
				return nil, err
			}
			ruleResults = append(ruleResults, result)
		}
		return ruleResults, nil
	})
}

// EvaluateWorkspaceScopedPolicyRules evaluates all workspace-scoped rules in a policy.
// Returns nil if any rule evaluation fails.
func (f *EvaluatorFactory) EvaluateWorkspaceScopedPolicyRules(
	ctx context.Context,
	policy *oapi.Policy,
) []*oapi.RuleEvaluation {
	return evaluateRules(policy, func(rule *oapi.PolicyRule) ([]*oapi.RuleEvaluation, error) {
		eval := f.createWorkspaceScopedEvaluator(rule)
		if eval == nil {
			return nil, nil // Skip unknown rule types
		}
		ruleResults := make([]*oapi.RuleEvaluation, 0, len(eval))
		for _, eval := range eval {
			result, err := eval.Evaluate(ctx)
			if err != nil {
				return nil, err
			}
			ruleResults = append(ruleResults, result)
		}
		return ruleResults, nil
	})
}

// evaluateRules is a helper that evaluates all rules in a policy using the provided evaluator function.
func evaluateRules(
	policy *oapi.Policy,
	evalFn func(*oapi.PolicyRule) ([]*oapi.RuleEvaluation, error),
) []*oapi.RuleEvaluation {
	ruleResults := make([]*oapi.RuleEvaluation, 0, len(policy.Rules))

	for _, rule := range policy.Rules {
		result, err := evalFn(&rule)
		if err != nil {
			return nil
		}
		ruleResults = append(ruleResults, result...)

	}

	return ruleResults
}

// createEnvironmentAndVersionScopedEvaluator creates a environment and version-scoped evaluator for the given rule.
// Returns nil for unknown rule types.
func (f *EvaluatorFactory) createEnvironmentAndVersionScopedEvaluator(rule *oapi.PolicyRule) []evaluator.EnvironmentAndVersionScopedEvaluator {
	evaluators := []evaluator.EnvironmentAndVersionScopedEvaluator{}
	if rule.AnyApproval != nil {
		evaluators = append(evaluators, approval.NewAnyApprovalEvaluator(f.store, rule.AnyApproval))
	}
	if rule.EnvironmentProgression != nil {
		evaluators = append(evaluators, environmentprogression.NewEnvironmentProgressionEvaluator(f.store, rule.EnvironmentProgression))
	}
	return evaluators
}

// createVersionScopedEvaluator creates a version-scoped evaluator for the given rule.
// Returns nil for unknown rule types.
func (f *EvaluatorFactory) createVersionScopedEvaluator(rule *oapi.PolicyRule) []evaluator.VersionScopedEvaluator {
	evaluators := []evaluator.VersionScopedEvaluator{}
	return evaluators
}

// createTargetScopedEvaluator creates a target-scoped evaluator for the given rule.
// Returns nil for unknown rule types.
func (f *EvaluatorFactory) createTargetScopedEvaluator(rule *oapi.PolicyRule) []evaluator.TargetScopedEvaluator {
	evaluators := []evaluator.TargetScopedEvaluator{}
	return evaluators
}

// createReleaseScopedEvaluator creates a release-scoped evaluator for the given rule.
// Returns nil for unknown rule types.
func (f *EvaluatorFactory) createReleaseScopedEvaluator(rule *oapi.PolicyRule) []evaluator.ReleaseScopedEvaluator {
	switch {
	default:
		return nil
	}
}

// createWorkspaceScopedEvaluator creates a workspace-scoped evaluator for the given rule.
// Returns nil for unknown rule types.
func (f *EvaluatorFactory) createWorkspaceScopedEvaluator(rule *oapi.PolicyRule) []evaluator.WorkspaceScopedEvaluator {
	evaluators := []evaluator.WorkspaceScopedEvaluator{}
	return evaluators
}
