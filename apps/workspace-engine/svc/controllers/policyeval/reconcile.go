package policyeval

import (
	"context"
	"fmt"

	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/store/policies"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator/approval"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator/deploymentdependency"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator/deploymentwindow"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator/environmentprogression"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator/gradualrollout"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator/versioncooldown"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator/versionselector"

	"github.com/google/uuid"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"
	"golang.org/x/sync/errgroup"
)

type versionEvaluation struct {
	VersionID string
	RuleType  string
	*oapi.RuleEvaluation
}

// reconciler holds the state for evaluating a single version against one
// release target.
type reconciler struct {
	getter Getter
	setter Setter
	rt     *ReleaseTarget

	scope    *evaluator.EvaluatorScope
	policies []*oapi.Policy
}

func (r *reconciler) loadInput(ctx context.Context) error {
	scope, err := r.getter.GetReleaseTargetScope(ctx, r.rt)
	if err != nil {
		return fmt.Errorf("get release target scope: %w", err)
	}
	r.scope = scope

	pols, err := r.getter.GetPoliciesForReleaseTarget(ctx, r.rt.ToOAPI())
	if err != nil {
		return fmt.Errorf("get policies: %w", err)
	}
	r.policies = pols

	return nil
}

func ruleEvaluators(getter Getter, rule *oapi.PolicyRule) []evaluator.Evaluator {
	return evaluator.CollectEvaluators(
		versionselector.NewEvaluator(rule),
		approval.NewEvaluator(getter, rule),
		environmentprogression.NewEvaluator(getter, rule),
		gradualrollout.NewEvaluator(getter, rule),
		deploymentdependency.NewEvaluator(getter, rule),
		deploymentwindow.NewEvaluator(getter, rule),
		versioncooldown.NewEvaluator(getter, rule),
	)
}

func collectEvaluators(getter Getter, pols []*oapi.Policy) []evaluator.Evaluator {
	var evals []evaluator.Evaluator
	for _, p := range pols {
		if p == nil || !p.Enabled {
			continue
		}
		for _, rule := range p.Rules {
			evals = append(evals, ruleEvaluators(getter, &rule)...)
		}
	}
	return evals
}

func buildSkipSet(skips []*oapi.PolicySkip) map[string]oapi.PolicySkip {
	set := make(map[string]oapi.PolicySkip, len(skips))
	for _, s := range skips {
		if !s.IsExpired() {
			set[s.RuleId] = *s
		}
	}
	return set
}

func (r *reconciler) evaluateVersion(
	ctx context.Context,
	version *oapi.DeploymentVersion,
) ([]versionEvaluation, error) {
	oapiRT := r.rt.ToOAPI()
	evals := collectEvaluators(r.getter, r.policies)

	scope := evaluator.EvaluatorScope{
		Deployment:  r.scope.Deployment,
		Environment: r.scope.Environment,
		Resource:    r.scope.Resource,
		Version:     version,
	}

	skips, err := r.getter.GetPolicySkips(ctx, version.Id, oapiRT.EnvironmentId, oapiRT.ResourceId)
	if err != nil {
		return nil, fmt.Errorf("get policy skips: %w", err)
	}
	skipped := buildSkipSet(skips)

	var results []versionEvaluation
	for _, eval := range evals {
		if !scope.HasFields(eval.ScopeFields()) {
			continue
		}

		if skip, ok := skipped[eval.RuleId()]; ok {
			re := oapi.NewRuleEvaluation().
				Allow().
				WithRuleId(eval.RuleId()).
				WithMessage(fmt.Sprintf("Policy skipped: %s", skip.Reason)).
				WithSatisfiedAt(skip.CreatedAt).
				WithDetail("skip_reason", skip.Reason).
				WithDetail("skip_expires_at", skip.ExpiresAt)
			if skip.ExpiresAt != nil {
				re.WithNextEvaluationTime(*skip.ExpiresAt)
			}
			results = append(results, versionEvaluation{
				VersionID:      version.Id,
				RuleType:       eval.RuleType(),
				RuleEvaluation: re,
			})
			continue
		}

		result := eval.Evaluate(ctx, scope)
		if result != nil {
			result.WithRuleId(eval.RuleId())
			results = append(results, versionEvaluation{
				VersionID:      version.Id,
				RuleType:       eval.RuleType(),
				RuleEvaluation: result,
			})
		}
	}
	return results, nil
}

func (r *reconciler) persistEvaluations(
	ctx context.Context,
	evals []versionEvaluation,
) error {
	if len(evals) == 0 {
		return nil
	}

	rt := r.rt.ToOAPI()
	params := make([]policies.RuleEvaluationParams, 0, len(evals))
	for _, e := range evals {
		params = append(params, policies.RuleEvaluationParams{
			RuleType:      e.RuleType,
			RuleID:        e.RuleId,
			EnvironmentID: rt.EnvironmentId,
			VersionID:     e.VersionID,
			ResourceID:    rt.ResourceId,
			Evaluation:    e.RuleEvaluation,
		})
	}
	return r.setter.UpsertRuleEvaluations(ctx, params)
}

func toReleaseTargets(oapiTargets []*oapi.ReleaseTarget) ([]*ReleaseTarget, error) {
	targets := make([]*ReleaseTarget, 0, len(oapiTargets))
	for _, o := range oapiTargets {
		depID, err := uuid.Parse(o.DeploymentId)
		if err != nil {
			return nil, fmt.Errorf("parse deployment id: %w", err)
		}
		envID, err := uuid.Parse(o.EnvironmentId)
		if err != nil {
			return nil, fmt.Errorf("parse environment id: %w", err)
		}
		resID, err := uuid.Parse(o.ResourceId)
		if err != nil {
			return nil, fmt.Errorf("parse resource id: %w", err)
		}
		targets = append(targets, &ReleaseTarget{
			DeploymentID:  depID,
			EnvironmentID: envID,
			ResourceID:    resID,
		})
	}
	return targets, nil
}

// Reconcile fetches the version, discovers all release targets for its
// deployment, evaluates policy rules for the version against each release
// target, and persists the results.
func Reconcile(
	ctx context.Context,
	getter Getter,
	setter Setter,
	versionID uuid.UUID,
) (*oapi.DeploymentVersion, error) {
	ctx, span := tracer.Start(ctx, "policyeval.Reconcile")
	defer span.End()

	span.SetAttributes(attribute.String("version_id", versionID.String()))

	version, err := getter.GetVersion(ctx, versionID)
	if err != nil {
		return nil, recordErr(span, "get version", err)
	}

	oapiTargets, err := getter.GetReleaseTargetsForDeployment(ctx, version.DeploymentId)
	if err != nil {
		return nil, recordErr(span, "get release targets", err)
	}

	releaseTargets, err := toReleaseTargets(oapiTargets)
	if err != nil {
		return nil, recordErr(span, "convert release targets", err)
	}
	span.SetAttributes(attribute.Int("release_target_count", len(releaseTargets)))

	if len(releaseTargets) == 0 {
		span.SetStatus(codes.Ok, "no release targets for deployment")
		return version, nil
	}

	g, ctx := errgroup.WithContext(ctx)
	g.SetLimit(10)
	for _, rt := range releaseTargets {
		g.Go(func() error {
			r := &reconciler{getter: getter, setter: setter, rt: rt}

			if err := r.loadInput(ctx); err != nil {
				return fmt.Errorf("load input: %w", err)
			}

			evals, err := r.evaluateVersion(ctx, version)
			if err != nil {
				return fmt.Errorf("evaluate version for rt %s: %w", rt.DeploymentID, err)
			}

			return r.persistEvaluations(ctx, evals)
		})
	}

	if err := g.Wait(); err != nil {
		return nil, recordErr(span, "reconcile release targets", err)
	}

	span.SetStatus(codes.Ok, "policy eval completed")
	return version, nil
}

func recordErr(span trace.Span, msg string, err error) error {
	span.RecordError(err)
	span.SetStatus(codes.Error, msg+" failed")
	return fmt.Errorf("%s: %w", msg, err)
}
