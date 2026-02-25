package policy

import (
	"context"

	"workspace-engine/pkg/concurrency"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator/approval"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator/deployableversions"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator/deploymentdependency"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator/deploymentwindow"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator/environmentprogression"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator/gradualrollout"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator/versioncooldown"
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
		approval.NewEvaluatorFromStore(m.store, rule),
		environmentprogression.NewEvaluatorFromStore(m.store, rule),
		gradualrollout.NewEvaluatorFromStore(m.store, rule),
		versionselector.NewEvaluator(rule),
		deploymentdependency.NewEvaluator(m.store, rule),
		deploymentwindow.NewEvaluatorFromStore(m.store, rule),
		versioncooldown.NewEvaluatorFromStore(m.store, rule),
	)
}

func (m *Manager) PlannerGlobalEvaluators() []evaluator.Evaluator {
	return evaluator.CollectEvaluators(
		deployableversions.NewEvaluatorFromStore(m.store),
	)
}

func (m *Manager) SummaryPolicyEvaluators(rule *oapi.PolicyRule) []evaluator.Evaluator {
	return EvaluatorsForSummary(m.store, rule)
}

// evalTask pairs an evaluator with the rule ID it belongs to, so results can
// be attributed back to their originating rule after parallel execution.
type evalTask struct {
	eval   evaluator.Evaluator
	ruleId string
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

	// Pre-collect all evaluator tasks, filtering out nils and scope mismatches
	// up-front so the parallel dispatch only contains actionable work.
	var tasks []evalTask
	for _, rule := range policy.Rules {
		for _, eval := range evaluators(&rule) {
			if eval == nil {
				continue
			}
			if !scope.HasFields(eval.ScopeFields()) {
				continue
			}
			tasks = append(tasks, evalTask{eval: eval, ruleId: rule.Id})
		}
	}

	span.SetAttributes(attribute.Int("evaluator_count", len(tasks)))

	// Run all evaluations in parallel using ProcessInChunks. Each evaluator is
	// a freshly created instance with no shared mutable state — they only read
	// from the store — so concurrent execution is safe.
	evalResults, err := concurrency.ProcessInChunks(ctx, tasks,
		func(ctx context.Context, t evalTask) (oapi.RuleEvaluation, error) {
			result := t.eval.Evaluate(ctx, scope)
			return *result.WithRuleId(t.ruleId), nil
		},
		concurrency.WithChunkSize(1),
	)

	policyResult := results.NewPolicyEvaluation(results.WithPolicy(policy))
	if err != nil {
		span.RecordError(err)
		return policyResult
	}
	for _, result := range evalResults {
		policyResult.AddRuleResult(result)
	}

	return policyResult
}
