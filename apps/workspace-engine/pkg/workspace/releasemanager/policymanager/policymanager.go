package policymanager

import (
	"context"
	"fmt"
	"time"

	"workspace-engine/pkg/pb"
	"workspace-engine/pkg/workspace/releasemanager/policymanager/evaluator/approval"
	"workspace-engine/pkg/workspace/releasemanager/policymanager/evaluator/skipdeployed"
	"workspace-engine/pkg/workspace/releasemanager/policymanager/results"
	"workspace-engine/pkg/workspace/store"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

var tracer = otel.Tracer("workspace/releasemanager/policymanager")

// Manager handles policy evaluation for release decisions.
type Manager struct {
	store                 *store.Store
	releaseRuleEvaluators []results.ReleaseRuleEvaluator
}

// New creates a new policy manager.
func New(store *store.Store) *Manager {
	return &Manager{
		store: store,
		releaseRuleEvaluators: []results.ReleaseRuleEvaluator{
			skipdeployed.NewSkipDeployedEvaluator(store),
		},
	}
}

func (m *Manager) EvaluateRelease(
	ctx context.Context,
	release *pb.Release,
) (*DeployDecision, error) {
	startTime := time.Now()
	decision := &DeployDecision{
		PolicyResults: make([]*results.PolicyEvaluationResult, 0, len(m.releaseRuleEvaluators)),
		EvaluatedAt:   startTime,
	}
	for _, evaluator := range m.releaseRuleEvaluators {
		policyResult := results.NewPolicyEvaluation("", "")
		ruleResult, err := evaluator.Evaluate(ctx, release.ReleaseTarget, release)
		if err != nil {
			return nil, err
		}

		policyResult.AddRuleResult(ruleResult)
	}
	return decision, nil
}

// Evaluate evaluates all applicable policies for a deployment and returns a comprehensive decision.
// Performance optimizations:
// - Pre-allocates slices to avoid reallocations
// - Short-circuits on denials (stops evaluating remaining policies)
// - Uses direct function calls (no interface dispatch)
func (m *Manager) EvaluateVersion(
	ctx context.Context,
	version *pb.DeploymentVersion,
	releaseTarget *pb.ReleaseTarget,
) (*DeployDecision, error) {
	startTime := time.Now()
	ctx, span := tracer.Start(ctx, "PolicyManager.Evaluate",
		trace.WithAttributes(
			attribute.String("deployment.id", releaseTarget.DeploymentId),
			attribute.String("environment.id", releaseTarget.EnvironmentId),
			attribute.String("resource.id", releaseTarget.ResourceId),
			attribute.String("version.id", version.Id),
		))
	defer span.End()

	// Get all policies that apply to this release target
	applicablePolicies := m.store.Policies.GetPoliciesForReleaseTarget(ctx, releaseTarget)

	span.SetAttributes(
		attribute.Int("policies.count", len(applicablePolicies)),
	)

	// Fast path: no policies = allowed
	if len(applicablePolicies) == 0 {
		span.SetAttributes(
			attribute.Bool("decision.can_deploy", true),
			attribute.Bool("decision.is_blocked", false),
			attribute.Bool("decision.is_pending", false),
		)
		return &DeployDecision{
			PolicyResults: make([]*results.PolicyEvaluationResult, 0),
			EvaluatedAt:   startTime,
		}, nil
	}

	// Pre-allocate to avoid reallocations (performance optimization)
	decision := &DeployDecision{
		PolicyResults: make([]*results.PolicyEvaluationResult, 0, len(applicablePolicies)),
		EvaluatedAt:   startTime,
	}

	totalRules := 0

	// Evaluate each policy
	for _, policy := range applicablePolicies {
		policyResult := results.NewPolicyEvaluation(policy.Id, policy.Name)

		// Pre-allocate rule results slice
		policyResult.RuleResults = make([]*results.RuleEvaluationResult, 0, len(policy.Rules))

		// Evaluate each rule in the policy
		for _, rule := range policy.Rules {
			totalRules++
			evaluator, err := m.getVersionRuleEvaluator(ctx, rule, version, releaseTarget)
			if err != nil {
				span.RecordError(err)
				span.SetAttributes(
					attribute.String("error.rule_id", rule.Id),
					attribute.String("error.policy_id", policy.Id),
				)
				return nil, fmt.Errorf("failed to evaluate rule %s in policy %s: %w", rule.Id, policy.Name, err)
			}

			ruleResult, err := evaluator.Evaluate(ctx, releaseTarget, version)
			if err != nil {
				span.RecordError(fmt.Errorf("failed to evaluate rule %s in policy %s: invalid rule result type", rule.Id, policy.Name))
				span.SetAttributes(
					attribute.String("error.rule_id", rule.Id),
					attribute.String("error.policy_id", policy.Id),
				)
				return nil, fmt.Errorf("failed to evaluate rule %s in policy %s: invalid rule result type", rule.Id, policy.Name)
			}

			policyResult.AddRuleResult(ruleResult)
		}

		decision.PolicyResults = append(decision.PolicyResults, policyResult)

		// Performance: If blocked (not pending), can stop evaluating remaining policies
		// Comment this out if you need to collect ALL policy violations for reporting
		if policyResult.HasDenials() {
			span.SetAttributes(
				attribute.Int("rules.evaluated", totalRules),
				attribute.Bool("decision.can_deploy", decision.CanDeploy()),
				attribute.Bool("decision.is_blocked", decision.IsBlocked()),
				attribute.Bool("decision.is_pending", decision.IsPending()),
				attribute.Int("decision.pending_actions", len(decision.GetPendingActions())),
				attribute.Bool("evaluation.short_circuited", true),
			)
			return decision, nil
		}
	}

	span.SetAttributes(
		attribute.Int("rules.evaluated", totalRules),
		attribute.Bool("decision.can_deploy", decision.CanDeploy()),
		attribute.Bool("decision.is_blocked", decision.IsBlocked()),
		attribute.Bool("decision.is_pending", decision.IsPending()),
		attribute.Int("decision.pending_actions", len(decision.GetPendingActions())),
		attribute.Bool("evaluation.short_circuited", false),
	)

	return decision, nil
}

// evaluateRule evaluates a single policy rule using direct dispatch.
func (m *Manager) getVersionRuleEvaluator(
	_ context.Context,
	rule *pb.PolicyRule,
	_ *pb.DeploymentVersion,
	_ *pb.ReleaseTarget,
) (results.VersionRuleEvaluator, error) {
	// Direct switch on rule type - compiler optimizes this to a jump table
	switch {
	case rule.GetAnyApproval() != nil:
		return approval.NewAnyApprovalEvaluator(m.store, rule.GetAnyApproval()), nil
	default:
		return nil, fmt.Errorf("unknown rule type for rule %s", rule.Id)
	}
}
