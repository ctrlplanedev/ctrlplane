package policy

import (
	"context"

	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator/approval"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator/deployableversions"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator/deploymentdependency"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator/deploymentwindow"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator/environmentprogression"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator/gradualrollout"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator/versiondebounce"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator/versionselector"
	"workspace-engine/pkg/workspace/releasemanager/policy/results"
	"workspace-engine/pkg/workspace/store"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

var tracer = otel.Tracer("workspace/releasemanager/policymanager")

// Manager handles user-defined policy evaluation for release decisions.
// User-defined policies include: approval requirements, environment progression, etc.
//
// Note: System-level job eligibility checks (retry logic, duplicate prevention)
// are handled separately by deployment.JobEligibilityChecker.
type Manager struct {
	store *store.Store
}

// New creates a new policy manager.
func New(store *store.Store) *Manager {
	return &Manager{
		store: store,
	}
}

func (m *Manager) PlannerPolicyEvaluators(rule *oapi.PolicyRule) []evaluator.Evaluator {
	return evaluator.CollectEvaluators(
		approval.NewEvaluator(m.store, rule),
		environmentprogression.NewEvaluator(m.store, rule),
		gradualrollout.NewEvaluator(m.store, rule),
		versionselector.NewEvaluator(m.store, rule),
		deploymentdependency.NewEvaluator(m.store, rule),
		deploymentwindow.NewEvaluator(m.store, rule),
		versiondebounce.NewEvaluator(m.store, rule),
	)
}

func (m *Manager) PlannerGlobalEvaluators() []evaluator.Evaluator {
	return evaluator.CollectEvaluators(
		deployableversions.NewEvaluator(m.store),
	)
}

func (m *Manager) SummaryPolicyEvaluators(rule *oapi.PolicyRule) []evaluator.Evaluator {
	return evaluator.CollectEvaluators(
		deploymentwindow.NewEvaluator(m.store, rule),
		approval.NewEvaluator(m.store, rule),
		environmentprogression.NewEvaluator(m.store, rule),
		gradualrollout.NewSummaryEvaluator(m.store, rule),
		versiondebounce.NewSummaryEvaluator(m.store, rule),
	)
}

func (m *Manager) EvaluateWithPolicy(
	ctx context.Context,
	policy *oapi.Policy,
	scope evaluator.EvaluatorScope,
	evaluators func(rule *oapi.PolicyRule) []evaluator.Evaluator,
) *oapi.PolicyEvaluation {
	ctx, span := tracer.Start(ctx, "EvaluatePolicy",
		trace.WithAttributes(
			attribute.String("policy.id", policy.Id),
		))
	defer span.End()

	policyResult := results.NewPolicyEvaluation(results.WithPolicy(policy))
	for _, rule := range policy.Rules {
		for _, evaluator := range evaluators(&rule) {
			if evaluator == nil {
				continue
			}
			if !scope.HasFields(evaluator.ScopeFields()) {
				continue
			}
			result := evaluator.Evaluate(ctx, scope)
			policyResult.AddRuleResult(*result.WithRuleId(rule.Id))
		}
	}

	return policyResult
}
