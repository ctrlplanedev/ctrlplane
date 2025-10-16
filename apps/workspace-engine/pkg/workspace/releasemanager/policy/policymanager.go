package policy

import (
	"context"
	"fmt"

	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator/deployableversions"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator/skipdeployed"
	"workspace-engine/pkg/workspace/releasemanager/policy/results"
	"workspace-engine/pkg/workspace/store"

	"go.opentelemetry.io/otel"
)

var tracer = otel.Tracer("workspace/releasemanager/policymanager")

// Manager handles policy evaluation for release decisions.
type Manager struct {
	store *store.Store

	evaluatorFactory *EvaluatorFactory

	defaultVersionRuleEvaluators []evaluator.VersionScopedEvaluator
	defaultReleaseRuleEvaluators []evaluator.ReleaseScopedEvaluator
}

// New creates a new policy manager.
func New(store *store.Store) *Manager {
	return &Manager{
		store:            store,
		evaluatorFactory: NewEvaluatorFactory(store),
		defaultVersionRuleEvaluators: []evaluator.VersionScopedEvaluator{
			deployableversions.NewDeployableVersionStatusEvaluator(store),
		},
		defaultReleaseRuleEvaluators: []evaluator.ReleaseScopedEvaluator{
			skipdeployed.NewSkipDeployedEvaluator(store),
		},
	}
}

func (m *Manager) GetPoliciesForReleaseTarget(ctx context.Context, releaseTarget *oapi.ReleaseTarget) (map[string]*oapi.Policy, error) {
	return m.store.ReleaseTargets.GetPolicies(ctx, releaseTarget)
}

// EvaluateWorkspace evaluates all workspace-scoped policies and returns a comprehensive decision.
func (m *Manager) EvaluateWorkspace(
	ctx context.Context,
	policies map[string]*oapi.Policy,
) (*DeployDecision, error) {
	ctx, span := tracer.Start(ctx, "EvaluateWorkspace")
	defer span.End()

	decision := NewDeployDecision()

	// Fast path: no policies = allowed
	if len(policies) == 0 {
		return decision, nil
	}

	// Evaluate each policy using the factory
	for _, policy := range policies {
		policyResult := results.NewPolicyEvaluation(results.WithPolicy(policy))

		// Use factory to evaluate all workspace-scoped rules
		ruleResults := m.evaluatorFactory.EvaluateWorkspaceScopedPolicyRules(ctx, policy)
		if ruleResults == nil {
			return nil, fmt.Errorf("failed to evaluate workspace-scoped policy rules")
		}

		for _, ruleResult := range ruleResults {
			policyResult.AddRuleResult(ruleResult)
		}

		decision.PolicyResults = append(decision.PolicyResults, policyResult)
	}

	return decision, nil
}

// EvaluateVersion evaluates all applicable policies for a deployment version and returns a comprehensive decision.
func (m *Manager) EvaluateVersion(
	ctx context.Context,
	version *oapi.DeploymentVersion,
	releaseTarget *oapi.ReleaseTarget,
) (*DeployDecision, error) {
	ctx, span := tracer.Start(ctx, "PolicyManager.EvaluateVersion")
	defer span.End()

	decision := NewDeployDecision()

	policies, err := m.GetPoliciesForReleaseTarget(ctx, releaseTarget)
	if err != nil {
		span.RecordError(err)
		return nil, fmt.Errorf("failed to get policies for release target: %w", err)
	}

	// Run default version rule evaluators (e.g., version status checks)
	if len(m.defaultVersionRuleEvaluators) > 0 {
		policyResult := results.NewPolicyEvaluation()
		for _, evaluator := range m.defaultVersionRuleEvaluators {
			ruleResult, err := evaluator.Evaluate(ctx, releaseTarget, version)
			if err != nil {
				return nil, err
			}
			policyResult.AddRuleResult(ruleResult)
		}
		decision.PolicyResults = append(decision.PolicyResults, policyResult)
	}

	// Fast path: no policies = allowed
	if len(policies) == 0 {
		return decision, nil
	}

	// Evaluate each policy using the factory
	for _, policy := range policies {
		policyResult := results.NewPolicyEvaluation(results.WithPolicy(policy))

		// Use factory to evaluate all version-scoped rules
		ruleResults := m.evaluatorFactory.EvaluateVersionScopedPolicyRules(ctx, policy, releaseTarget, version)
		if ruleResults == nil {
			return nil, fmt.Errorf("failed to evaluate version-scoped policy rules")
		}

		for _, ruleResult := range ruleResults {
			policyResult.AddRuleResult(ruleResult)
		}

		decision.PolicyResults = append(decision.PolicyResults, policyResult)
	}

	return decision, nil
}

func (m *Manager) EvaluateRelease(
	ctx context.Context,
	release *oapi.Release,
) (*DeployDecision, error) {
	ctx, span := tracer.Start(ctx, "PolicyManager.EvaluateRelease")
	defer span.End()

	decision := NewDeployDecision()
	policies, err := m.GetPoliciesForReleaseTarget(ctx, &release.ReleaseTarget)
	if err != nil {
		span.RecordError(err)
		return nil, fmt.Errorf("failed to get policies for release target: %w", err)
	}

	for _, policy := range policies {
		policyResult := results.NewPolicyEvaluation(results.WithPolicy(policy))
		ruleResults := m.evaluatorFactory.EvaluateReleaseScopedPolicyRules(ctx, policy, &release.ReleaseTarget, release)
		if ruleResults == nil {
			return nil, fmt.Errorf("failed to evaluate release-scoped policy rules: %w", err)
		}
		for _, ruleResult := range ruleResults {
			policyResult.AddRuleResult(ruleResult)
		}
		decision.PolicyResults = append(decision.PolicyResults, policyResult)
	}

	return decision, nil
}
