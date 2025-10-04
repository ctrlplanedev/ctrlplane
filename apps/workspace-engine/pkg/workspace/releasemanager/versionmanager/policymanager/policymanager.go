package policymanager

import (
	"context"
	"fmt"
	"strings"
	"time"

	"workspace-engine/pkg/cmap"
	"workspace-engine/pkg/pb"
	"workspace-engine/pkg/workspace/releasemanager/versionmanager/policymanager/results"
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
}

// New creates a new policy manager.
func New(store *store.Store) *Manager {
	return &Manager{
		store:              store,
		deployableVersions: cmap.New[*materialized.MaterializedView[[]*DeployDecision]](),
	}
}

// Store interfaces for rule evaluation
type ApprovalStore interface {
	HasUserApproved(ctx context.Context, userID, versionID, environmentID string) (bool, error)
	HasRoleApproved(ctx context.Context, roleID, versionID, environmentID string) (bool, error)
	GetApprovalCount(ctx context.Context, versionID, environmentID string) (int, error)
}

type DeploymentStore interface {
	GetActiveDeploymentCount(ctx context.Context, deploymentID, environmentID string) (int, error)
}

type RetryStore interface {
	GetRetryCount(ctx context.Context, versionID, environmentID, resourceID string) (int, error)
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
		summary := "No policies apply to this deployment"
		span.SetAttributes(
			attribute.Bool("decision.can_deploy", true),
			attribute.Bool("decision.is_blocked", false),
			attribute.Bool("decision.is_pending", false),
			attribute.String("decision.summary", summary),
		)
		return &DeployDecision{
			Summary:       summary,
			PolicyResults: nil, // nil slice is faster than empty slice
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
			decision.Summary = m.generateSummary(decision)
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

	// Generate summary
	decision.Summary = m.generateSummary(decision)

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
// Performance: Direct function call - no interface dispatch, no map lookups.
// Each case jumps directly to the evaluation function (~2-3 CPU cycles).
func (m *Manager) evaluateRule(
	ctx context.Context,
	rule *pb.PolicyRule,
	version *pb.DeploymentVersion,
	releaseTarget *pb.ReleaseTarget,
) (*results.RuleEvaluationResult, error) {
	// Direct switch on rule type - compiler optimizes this to a jump table
	switch {
	case rule.GetDenyWindow() != nil:
		return m.evaluateDenyWindow(ctx, rule.Id, rule.GetDenyWindow(), time.Now())

	case rule.GetUserApproval() != nil:
		return m.evaluateUserApproval(ctx, rule.Id, rule.GetUserApproval(), version, releaseTarget)

	case rule.GetRoleApproval() != nil:
		return m.evaluateRoleApproval(ctx, rule.Id, rule.GetRoleApproval(), version, releaseTarget)

	case rule.GetAnyApproval() != nil:
		return m.evaluateAnyApproval(ctx, rule.Id, rule.GetAnyApproval(), version, releaseTarget)

	case rule.GetConcurrency() != nil:
		return m.evaluateConcurrency(ctx, rule.Id, rule.GetConcurrency(), releaseTarget)

	case rule.GetMaxRetries() != nil:
		return m.evaluateMaxRetries(ctx, rule.Id, rule.GetMaxRetries(), version, releaseTarget)

	default:
		return nil, fmt.Errorf("unknown rule type for rule %s", rule.Id)
	}
}

// ============================================================================
// Rule Evaluation Functions
// Each rule type has its own file: rule_*.go
// ============================================================================

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
