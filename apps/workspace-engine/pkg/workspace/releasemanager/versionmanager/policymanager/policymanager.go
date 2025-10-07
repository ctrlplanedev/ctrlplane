package policymanager

import (
	"context"
	"fmt"
	"time"

	"workspace-engine/pkg/cmap"
	"workspace-engine/pkg/pb"
	"workspace-engine/pkg/workspace/releasemanager/versionmanager/policymanager/results"
	"workspace-engine/pkg/workspace/releasemanager/versionmanager/policymanager/rules/approval"
	"workspace-engine/pkg/workspace/store"
	"workspace-engine/pkg/workspace/store/materialized"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

var tracer = otel.Tracer("workspace/releasemanager/policymanager")

// Manager handles policy evaluation for release decisions.
type Manager struct {
	store *store.Store

	deployableVersions cmap.ConcurrentMap[string, *materialized.MaterializedView[[]*DeployDecision]]

	anyApprovalEvaluator *approval.AnyApprovalEvaluator
}

// New creates a new policy manager.
func New(store *store.Store) *Manager {
	return &Manager{
		store:              store,
		deployableVersions: cmap.New[*materialized.MaterializedView[[]*DeployDecision]](),

		anyApprovalEvaluator: approval.NewAnyApprovalEvaluator(store),
	}
}

// Evaluate evaluates all applicable policies for a deployment and returns a comprehensive decision.
// Performance optimizations:
// - Pre-allocates slices to avoid reallocations
// - Short-circuits on denials (stops evaluating remaining policies)
// - Uses direct function calls (no interface dispatch)
func (m *Manager) Evaluate(
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
			ruleResult, err := m.evaluateRule(ctx, rule, version, releaseTarget)
			if err != nil {
				span.RecordError(err)
				span.SetAttributes(
					attribute.String("error.rule_id", rule.Id),
					attribute.String("error.policy_id", policy.Id),
				)
				return nil, fmt.Errorf("failed to evaluate rule %s in policy %s: %w", rule.Id, policy.Name, err)
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
func (m *Manager) evaluateRule(
	ctx context.Context,
	rule *pb.PolicyRule,
	version *pb.DeploymentVersion,
	releaseTarget *pb.ReleaseTarget,
) (*results.RuleEvaluationResult, error) {
	// Direct switch on rule type - compiler optimizes this to a jump table
	switch {
	case rule.GetAnyApproval() != nil:
		return m.anyApprovalEvaluator.Evaluate(ctx, rule.GetAnyApproval(), version, releaseTarget)
	default:
		return nil, fmt.Errorf("unknown rule type for rule %s", rule.Id)
	}
}
