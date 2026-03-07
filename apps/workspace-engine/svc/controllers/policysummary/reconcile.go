package policysummary

import (
	"context"
	"fmt"
	"time"

	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/reconcile/events"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator"
	"workspace-engine/svc/controllers/policysummary/summaryeval"

	"github.com/google/uuid"
)

type ReconcileResult struct {
	NextReconcileAt *time.Time
}

type reconciler struct {
	workspaceID uuid.UUID
	getter      Getter
	setter      Setter
}

func (r *reconciler) reconcileEnvironment(ctx context.Context, scope *EnvironmentScope) (*ReconcileResult, error) {
	ctx, span := tracer.Start(ctx, "policysummary.reconcileEnvironment")
	defer span.End()

	env, err := r.getter.GetEnvironment(ctx, scope.EnvironmentID.String())
	if err != nil {
		return nil, fmt.Errorf("get environment: %w", err)
	}

	evalScope := evaluator.EvaluatorScope{
		Environment: env,
	}

	policies, err := r.getter.GetPoliciesForEnvironment(ctx, r.workspaceID, scope.EnvironmentID)
	if err != nil {
		return nil, fmt.Errorf("get policies: %w", err)
	}

	rows, nextTime := r.evaluateAndCollect(ctx, policies, evalScope, func(rule *oapi.PolicyRule) []evaluator.Evaluator {
		return summaryeval.EnvironmentRuleEvaluators(rule)
	})

	for i := range rows {
		rows[i].EnvironmentID = &scope.EnvironmentID
	}

	if err := r.setter.UpsertRuleSummaries(ctx, rows); err != nil {
		return nil, fmt.Errorf("upsert rule summaries: %w", err)
	}

	return &ReconcileResult{NextReconcileAt: nextTime}, nil
}

func (r *reconciler) reconcileEnvironmentVersion(ctx context.Context, scope *EnvironmentVersionScope) (*ReconcileResult, error) {
	ctx, span := tracer.Start(ctx, "policysummary.reconcileEnvironmentVersion")
	defer span.End()

	env, err := r.getter.GetEnvironment(ctx, scope.EnvironmentID.String())
	if err != nil {
		return nil, fmt.Errorf("get environment: %w", err)
	}

	version, err := r.getter.GetVersion(ctx, scope.VersionID)
	if err != nil {
		return nil, fmt.Errorf("get version: %w", err)
	}

	evalScope := evaluator.EvaluatorScope{
		Environment: env,
		Version:     version,
	}

	policies, err := r.getter.GetPoliciesForEnvironment(ctx, r.workspaceID, scope.EnvironmentID)
	if err != nil {
		return nil, fmt.Errorf("get policies: %w", err)
	}

	rows, nextTime := r.evaluateAndCollect(ctx, policies, evalScope, func(rule *oapi.PolicyRule) []evaluator.Evaluator {
		return summaryeval.EnvironmentVersionRuleEvaluators(r.getter, rule)
	})

	for i := range rows {
		rows[i].EnvironmentID = &scope.EnvironmentID
		rows[i].VersionID = &scope.VersionID
	}

	if err := r.setter.UpsertRuleSummaries(ctx, rows); err != nil {
		return nil, fmt.Errorf("upsert rule summaries: %w", err)
	}

	return &ReconcileResult{NextReconcileAt: nextTime}, nil
}

func (r *reconciler) reconcileDeploymentVersion(ctx context.Context, scope *DeploymentVersionScope) (*ReconcileResult, error) {
	ctx, span := tracer.Start(ctx, "policysummary.reconcileDeploymentVersion")
	defer span.End()

	deployment, err := r.getter.GetDeployment(ctx, scope.DeploymentID.String())
	if err != nil {
		return nil, fmt.Errorf("get deployment: %w", err)
	}

	version, err := r.getter.GetVersion(ctx, scope.VersionID)
	if err != nil {
		return nil, fmt.Errorf("get version: %w", err)
	}

	evalScope := evaluator.EvaluatorScope{
		Deployment: deployment,
		Version:    version,
	}

	policies, err := r.getter.GetPoliciesForDeployment(ctx, r.workspaceID, scope.DeploymentID)
	if err != nil {
		return nil, fmt.Errorf("get policies: %w", err)
	}

	rows, nextTime := r.evaluateAndCollect(ctx, policies, evalScope, func(rule *oapi.PolicyRule) []evaluator.Evaluator {
		return summaryeval.DeploymentVersionRuleEvaluators(r.getter, rule)
	})

	for i := range rows {
		rows[i].DeploymentID = &scope.DeploymentID
		rows[i].VersionID = &scope.VersionID
	}

	if err := r.setter.UpsertRuleSummaries(ctx, rows); err != nil {
		return nil, fmt.Errorf("upsert rule summaries: %w", err)
	}

	return &ReconcileResult{NextReconcileAt: nextTime}, nil
}

func (r *reconciler) evaluateAndCollect(
	ctx context.Context,
	policies []*oapi.Policy,
	scope evaluator.EvaluatorScope,
	evaluatorFactory func(rule *oapi.PolicyRule) []evaluator.Evaluator,
) ([]RuleSummaryRow, *time.Time) {
	var rows []RuleSummaryRow
	var nextTime *time.Time

	for _, p := range policies {
		for _, rule := range p.Rules {
			evals := evaluatorFactory(&rule)
			for _, eval := range evals {
				if eval == nil {
					continue
				}
				if !scope.HasFields(eval.ScopeFields()) {
					continue
				}

				result := eval.Evaluate(ctx, scope)
				rows = append(rows, RuleSummaryRow{
					RuleID:     uuid.MustParse(rule.Id),
					Evaluation: result,
				})

				if result.NextEvaluationTime != nil {
					if nextTime == nil || result.NextEvaluationTime.Before(*nextTime) {
						nextTime = result.NextEvaluationTime
					}
				}
			}
		}
	}

	return rows, nextTime
}

func Reconcile(ctx context.Context, workspaceID string, scopeType string, scopeID string, getter Getter, setter Setter) (*ReconcileResult, error) {
	r := &reconciler{
		workspaceID: uuid.MustParse(workspaceID),
		getter:      getter,
		setter:      setter,
	}

	switch scopeType {
	case events.PolicySummaryScopeEnvironment:
		scope, err := ParseEnvironmentScope(scopeID)
		if err != nil {
			return nil, err
		}
		return r.reconcileEnvironment(ctx, scope)

	case events.PolicySummaryScopeEnvironmentVersion:
		scope, err := ParseEnvironmentVersionScope(scopeID)
		if err != nil {
			return nil, err
		}
		return r.reconcileEnvironmentVersion(ctx, scope)

	case events.PolicySummaryScopeDeploymentVersion:
		scope, err := ParseDeploymentVersionScope(scopeID)
		if err != nil {
			return nil, err
		}
		return r.reconcileDeploymentVersion(ctx, scope)

	default:
		return nil, fmt.Errorf("unknown policy summary scope type: %s", scopeType)
	}
}
