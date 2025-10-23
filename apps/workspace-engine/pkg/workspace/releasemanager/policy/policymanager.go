package policy

import (
	"context"
	"fmt"

	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/releasemanager/policy/results"
	"workspace-engine/pkg/workspace/store"

	"go.opentelemetry.io/otel"
)

var tracer = otel.Tracer("workspace/releasemanager/policymanager")

// Manager handles user-defined policy evaluation for release decisions.
// User-defined policies include: approval requirements, environment progression, etc.
//
// Note: System-level job eligibility checks (retry logic, duplicate prevention)
// are handled separately by deployment.JobEligibilityChecker.
type Manager struct {
	store *store.Store

	evaluatorFactory *EvaluatorFactory
}

// New creates a new policy manager.
func New(store *store.Store) *Manager {
	return &Manager{
		store:            store,
		evaluatorFactory: NewEvaluatorFactory(store),
	}
}

func (m *Manager) GetPoliciesForReleaseTarget(ctx context.Context, releaseTarget *oapi.ReleaseTarget) (map[string]*oapi.Policy, error) {
	return m.store.ReleaseTargets.GetPolicies(ctx, releaseTarget)
}

// EvaluateWorkspace evaluates all workspace-scoped policies and returns a comprehensive decision.
func (m *Manager) EvaluateWorkspace(
	ctx context.Context,
	policies map[string]*oapi.Policy,
) (*oapi.DeployDecision, error) {
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
			policyResult.RuleResults = append(policyResult.RuleResults, *ruleResult)
		}

		decision.PolicyResults = append(decision.PolicyResults, *policyResult)
	}

	return decision, nil
}

// EvaluateVersion evaluates user-defined policies for a deployment version.
// User policies include: approval requirements, environment progression, etc.
func (m *Manager) EvaluateVersion(
	ctx context.Context,
	version *oapi.DeploymentVersion,
	releaseTarget *oapi.ReleaseTarget,
) (*oapi.DeployDecision, error) {
	ctx, span := tracer.Start(ctx, "PolicyManager.EvaluateVersion")
	defer span.End()

	decision := NewDeployDecision()

	policies, err := m.GetPoliciesForReleaseTarget(ctx, releaseTarget)
	if err != nil {
		span.RecordError(err)
		return nil, fmt.Errorf("failed to get policies for release target: %w", err)
	}

	// Fast path: no policies = allowed
	if len(policies) == 0 {
		return decision, nil
	}

	// Evaluate each user-defined policy using the factory
	for _, policy := range policies {
		policyResult := results.NewPolicyEvaluation(results.WithPolicy(policy))

		// Use factory to evaluate all version-scoped rules
		ruleResults := m.evaluatorFactory.EvaluateVersionScopedPolicyRules(ctx, policy, releaseTarget, version)
		if ruleResults == nil {
			return nil, fmt.Errorf("failed to evaluate version-scoped policy rules")
		}

		for _, ruleResult := range ruleResults {
			policyResult.AddRuleResult(*ruleResult)
		}

		decision.PolicyResults = append(decision.PolicyResults, *policyResult)
	}

	return decision, nil
}

// EvaluateRelease evaluates user-defined policies for a release.
// User policies include: approval requirements, environment progression, etc.
//
// Note: This no longer includes system job eligibility checks (skip deployed, retry limits).
// Those are handled by deployment.JobEligibilityChecker.
func (m *Manager) EvaluateRelease(
	ctx context.Context,
	release *oapi.Release,
) (*oapi.DeployDecision, error) {
	ctx, span := tracer.Start(ctx, "PolicyManager.EvaluateRelease")
	defer span.End()

	decision := NewDeployDecision()

	policies, err := m.GetPoliciesForReleaseTarget(ctx, &release.ReleaseTarget)
	if err != nil {
		span.RecordError(err)
		return nil, fmt.Errorf("failed to get policies for release target: %w", err)
	}

	// Fast path: no policies = allowed
	if len(policies) == 0 {
		return decision, nil
	}

	for _, policy := range policies {
		policyResult := results.NewPolicyEvaluation(results.WithPolicy(policy))
		ruleResults := m.evaluatorFactory.EvaluateReleaseScopedPolicyRules(ctx, policy, &release.ReleaseTarget, release)
		if ruleResults == nil {
			return nil, fmt.Errorf("failed to evaluate release-scoped policy rules: %w", err)
		}
		for _, ruleResult := range ruleResults {
			policyResult.AddRuleResult(*ruleResult)
		}
		decision.PolicyResults = append(decision.PolicyResults, *policyResult)
	}

	return decision, nil
}
