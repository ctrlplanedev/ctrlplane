package policymanager

import (
	"context"
	"fmt"
	"strings"

	"workspace-engine/pkg/pb"
	"workspace-engine/pkg/workspace/releasemanager/policymanager/evaluator"
	"workspace-engine/pkg/workspace/releasemanager/policymanager/evaluator/policies"
	"workspace-engine/pkg/workspace/releasemanager/policymanager/evaluator/results"
	"workspace-engine/pkg/workspace/store"
)

// Manager handles policy evaluation for release decisions.
type Manager struct {
	store     *store.Store
	evaluator *policies.PolicyEvaluator
}

// New creates a new policy manager with the default rule registry.
func New(store *store.Store) *Manager {
	// TODO: Implement ApprovalStore interface on store
	// For now, passing nil - approval rules will need this implemented
	deps := &RuleDependencies{
		ApprovalStore: nil, // store should implement rules.ApprovalStore
	}
	registry := NewDefaultRegistry(deps)
	evaluator := policies.NewPolicyEvaluator(registry)

	return &Manager{
		store:     store,
		evaluator: evaluator,
	}
}

// Evaluate evaluates all applicable policies for a deployment and returns a comprehensive decision.
func (m *Manager) Evaluate(
	ctx context.Context,
	version *pb.DeploymentVersion,
	releaseTarget *pb.ReleaseTarget,
) (*DeployDecision, error) {
	// Get all policies that apply to this release target
	applicablePolicies := m.store.Policies.GetPoliciesForReleaseTarget(ctx, releaseTarget)

	// If no policies apply, deployment is allowed
	if len(applicablePolicies) == 0 {
		return &DeployDecision{
			Summary:        "No policies apply to this deployment",
			PolicyResults:  []*results.PolicyEvaluationResult{},
		}, nil
	}

	// Evaluate each policy
	decision := &DeployDecision{
		PolicyResults:  make([]*results.PolicyEvaluationResult, 0),
	}

	for _, policy := range applicablePolicies {
		evalCtx := evaluator.NewEvaluationContext(
			m.store,
			version,
			releaseTarget,
			policy,
		)

		policyResult, err := m.evaluator.Evaluate(ctx, evalCtx)
		if err != nil {
			return nil, fmt.Errorf("failed to evaluate policy %s: %w", policy.Name, err)
		}

		decision.PolicyResults = append(decision.PolicyResults, policyResult)
	}

	// Generate summary
	decision.Summary = m.generateSummary(decision)

	return decision, nil
}

// generateSummary creates a human-readable summary of the deployment decision.
func (m *Manager) generateSummary(decision *DeployDecision) string {
	if decision.CanDeploy() {
		return "All policies passed - deployment allowed"
	}

	if decision.IsBlocked() {
		// Collect all denial reasons
		var denialReasons []string
		for _, policyResult := range decision.PolicyResults {
			for _, ruleResult := range policyResult.RuleResults {
				if !ruleResult.Allowed && !ruleResult.RequiresAction {
					denialReasons = append(denialReasons, fmt.Sprintf(
						"%s: %s",
						ruleResult.RuleType,
						ruleResult.Reason,
					))
				}
			}
		}
		return fmt.Sprintf("Deployment blocked - %s", strings.Join(denialReasons, "; "))
	}

	if decision.IsPending() {
		// Collect all pending actions
		approvalCount := 0
		waitCount := 0
		for _, action := range decision.GetPendingActions() {
			if action.ActionType == "approval" {
				approvalCount++
			} else if action.ActionType == "wait" {
				waitCount++
			}
		}

		var parts []string
		if approvalCount > 0 {
			parts = append(parts, fmt.Sprintf("%d approval(s) required", approvalCount))
		}
		if waitCount > 0 {
			parts = append(parts, fmt.Sprintf("%d wait condition(s)", waitCount))
		}

		return fmt.Sprintf("Deployment pending - %s", strings.Join(parts, ", "))
	}

	return "Unknown deployment status"
}
