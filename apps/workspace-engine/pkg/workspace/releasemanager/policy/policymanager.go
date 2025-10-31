package policy

import (
	"context"

	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator/approval"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator/deployableversions"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator/environmentprogression"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator/gradualrollout"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator/pausedversions"
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

func (m *Manager) EvaluatorsForPolicy(rule *oapi.PolicyRule) []evaluator.Evaluator {
	return evaluator.CollectEvaluators(
		approval.NewAnyApprovalEvaluator(m.store, rule.AnyApproval),
		environmentprogression.NewEnvironmentProgressionEvaluator(m.store, rule),
		gradualrollout.NewGradualRolloutEvaluator(m.store, rule),
	)
}

func (m *Manager) GlobalEvaluators() []evaluator.Evaluator {
	return evaluator.CollectEvaluators(
		pausedversions.New(m.store),
		deployableversions.NewDeployableVersionStatusEvaluator(m.store),
	)
}

func (m *Manager) EvaluatePolicy(
	ctx context.Context,
	policy *oapi.Policy,
	scope evaluator.EvaluatorScope,
) *oapi.PolicyEvaluation {
	ctx, span := tracer.Start(ctx, "EvaluatePolicy",
		trace.WithAttributes(
			attribute.String("policy.id", policy.Id),
		))
	defer span.End()

	policyResult := results.NewPolicyEvaluation(results.WithPolicy(policy))
	for _, rule := range policy.Rules {
		evaluators := m.EvaluatorsForPolicy(&rule)
		for _, evaluator := range evaluators {
			if !scope.HasFields(evaluator.ScopeFields()) {
				continue
			}
			result := evaluator.Evaluate(ctx, scope)
			policyResult.AddRuleResult(*result.WithRuleId(rule.Id))
		}
	}

	return policyResult
}
