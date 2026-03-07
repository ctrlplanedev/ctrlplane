package policysummary

import (
	"context"
	"fmt"
	"time"

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

func (r *reconciler) reconcile(ctx context.Context, scope *Scope) (*ReconcileResult, error) {
	ctx, span := tracer.Start(ctx, "policysummary.reconcile")
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

	var rows []RuleSummaryRow
	var nextTime *time.Time

	for _, p := range policies {
		for _, rule := range p.Rules {
			evals := summaryeval.RuleEvaluators(r.getter, r.workspaceID.String(), &rule)
			for _, eval := range evals {
				if eval == nil {
					continue
				}
				if !evalScope.HasFields(eval.ScopeFields()) {
					continue
				}

				result := eval.Evaluate(ctx, evalScope)
				rows = append(rows, RuleSummaryRow{
					RuleID:        uuid.MustParse(rule.Id),
					EnvironmentID: scope.EnvironmentID,
					VersionID:     scope.VersionID,
					Evaluation:    result,
				})

				if result.NextEvaluationTime != nil {
					if nextTime == nil || result.NextEvaluationTime.Before(*nextTime) {
						nextTime = result.NextEvaluationTime
					}
				}
			}
		}
	}

	if err := r.setter.UpsertRuleSummaries(ctx, rows); err != nil {
		return nil, fmt.Errorf("upsert rule summaries: %w", err)
	}

	return &ReconcileResult{NextReconcileAt: nextTime}, nil
}

func Reconcile(ctx context.Context, workspaceID string, scopeID string, getter Getter, setter Setter) (*ReconcileResult, error) {
	scope, err := ParseScope(scopeID)
	if err != nil {
		return nil, err
	}

	r := &reconciler{
		workspaceID: uuid.MustParse(workspaceID),
		getter:      getter,
		setter:      setter,
	}

	return r.reconcile(ctx, scope)
}
