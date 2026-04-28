package policyeval

import (
	"cmp"
	"context"
	"fmt"
	"slices"
	"time"

	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator/approval"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator/deploymentdependency"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator/deploymentversiondependency"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator/deploymentwindow"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator/environmentprogression"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator/gradualrollout"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator/versioncooldown"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator/versionselector"

	"go.opentelemetry.io/otel"
)

var tracer = otel.Tracer("workspace/desiredrelease/policyeval")

func RuleTypes() []string {
	return []string{
		(&versionselector.Evaluator{}).RuleType(),
		(&approval.AnyApprovalEvaluator{}).RuleType(),
		(&environmentprogression.EnvironmentProgressionEvaluator{}).RuleType(),
		(&gradualrollout.GradualRolloutEvaluator{}).RuleType(),
		(&deploymentdependency.DeploymentDependencyEvaluator{}).RuleType(),
		(&deploymentwindow.DeploymentWindowEvaluator{}).RuleType(),
		(&versioncooldown.VersionCooldownEvaluator{}).RuleType(),
	}
}

// ruleEvaluators returns evaluators for a single policy rule.
func ruleEvaluators(_ context.Context, getter Getter, rule *oapi.PolicyRule) []evaluator.Evaluator {
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

// nonRuleEvaluators returns evaluators that are not backed by a policy rule
// and should run once per release target regardless of how many policies exist.
func nonRuleEvaluators(getter Getter) []evaluator.Evaluator {
	return evaluator.CollectEvaluators(
		deploymentversiondependency.NewEvaluator(getter),
	)
}

// CollectEvaluators builds and sorts the full evaluator set for the given
// policies. Evaluators are sorted by Complexity (cheapest first) so that
// fast-failing checks run before expensive ones.
func CollectEvaluators(
	ctx context.Context,
	getter Getter,
	rt *oapi.ReleaseTarget,
	policies []*oapi.Policy,
) []evaluator.Evaluator {
	evals := []evaluator.Evaluator{}

	for _, p := range policies {
		if p == nil || !p.Enabled {
			continue
		}
		for _, rule := range p.Rules {
			evals = append(evals, ruleEvaluators(ctx, getter, &rule)...)
		}
	}

	evals = append(evals, nonRuleEvaluators(getter)...)

	slices.SortFunc(evals, func(a, b evaluator.Evaluator) int {
		return cmp.Compare(a.Complexity(), b.Complexity())
	})

	return evals
}

// VersionedEvaluation pairs a rule evaluation with the version and rule type it
// was evaluated against, since oapi.RuleEvaluation does not carry these.
type VersionedEvaluation struct {
	VersionID string
	RuleType  string
	*oapi.RuleEvaluation
}

// FindDeployableVersionResult holds the outcome of evaluating candidate
// versions against policy rules.
type FindDeployableVersionResult struct {
	Version     *oapi.DeploymentVersion
	NextTime    *time.Time
	Evaluations []VersionedEvaluation
}

// FindDeployableVersion iterates candidate versions (newest-first) and returns
// the first one that passes every evaluator. When no version qualifies,
// NextTime is the earliest NextEvaluationTime across all evaluations.
//
// Policy skips are fetched per candidate version via getter.GetPolicySkips.
// Any evaluator whose RuleId matches a non-expired skip is automatically
// bypassed.
func FindDeployableVersion(
	ctx context.Context,
	getter Getter,
	rt *oapi.ReleaseTarget,
	versions []*oapi.DeploymentVersion,
	evals []evaluator.Evaluator,
	scope evaluator.EvaluatorScope,
) (*FindDeployableVersionResult, error) {
	_, span := tracer.Start(ctx, "FindDeployableVersion")
	defer span.End()

	var earliest *time.Time
	var allEvaluations []VersionedEvaluation

	for _, version := range versions {
		scope.Version = version

		skips, err := getter.GetPolicySkips(ctx, version.Id, rt.EnvironmentId, rt.ResourceId)
		if err != nil {
			return nil, fmt.Errorf("get policy skips: %w", err)
		}

		eligible, err := evaluateVersion(ctx, evals, scope, skips)
		if err != nil {
			return nil, fmt.Errorf("evaluate version: %w", err)
		}

		for _, e := range eligible {
			allEvaluations = append(allEvaluations, VersionedEvaluation{
				VersionID:      version.Id,
				RuleType:       e.ruleType,
				RuleEvaluation: e.RuleEvaluation,
			})
		}

		nextEvaluationTime := eligible.NextEvaluationTime()
		if nextEvaluationTime != nil && (earliest == nil || nextEvaluationTime.Before(*earliest)) {
			earliest = nextEvaluationTime
		}

		if eligible.Allowed() {
			return &FindDeployableVersionResult{
				Version:     version,
				NextTime:    earliest,
				Evaluations: allEvaluations,
			}, nil
		}
	}
	return &FindDeployableVersionResult{
		NextTime:    earliest,
		Evaluations: allEvaluations,
	}, nil
}

// buildSkipSet returns the set of rule IDs that have a non-expired policy skip.
func buildSkipSet(skips []*oapi.PolicySkip) map[string]oapi.PolicySkip {
	set := make(map[string]oapi.PolicySkip, len(skips))
	for _, s := range skips {
		if !s.IsExpired() {
			set[s.RuleId] = *s
		}
	}
	return set
}

type ruleEvaluation struct {
	ruleType string
	*oapi.RuleEvaluation
}

type RuleEvaluations []ruleEvaluation

func (e RuleEvaluations) NextEvaluationTime() *time.Time {
	var soonest *time.Time
	for _, eval := range e {
		if eval.NextEvaluationTime != nil {
			if soonest == nil || eval.NextEvaluationTime.Before(*soonest) {
				soonest = eval.NextEvaluationTime
			}
		}
	}
	return soonest
}

func (e RuleEvaluations) Allowed() bool {
	for _, eval := range e {
		if !eval.Allowed {
			return false
		}
	}
	return true
}

// evaluateVersion runs every evaluator against the scope and short-circuits
// on the first denial. Evaluators whose RuleId appears in skips are bypassed.
func evaluateVersion(
	ctx context.Context,
	evals []evaluator.Evaluator,
	scope evaluator.EvaluatorScope,
	skips []*oapi.PolicySkip,
) (RuleEvaluations, error) {
	skipped := buildSkipSet(skips)
	evaluations := RuleEvaluations{}
	for _, eval := range evals {
		if !scope.HasFields(eval.ScopeFields()) {
			continue
		}

		if skip, ok := skipped[eval.RuleId()]; ok {
			evaluation := oapi.NewRuleEvaluation().
				Allow().
				WithRuleId(eval.RuleId()).
				WithMessage(fmt.Sprintf("Policy skipped: %s", skip.Reason)).
				WithSatisfiedAt(skip.CreatedAt).
				WithDetail("skip_reason", skip.Reason).
				WithDetail("skip_expires_at", skip.ExpiresAt)

			if skip.ExpiresAt != nil {
				evaluation.WithNextEvaluationTime(*skip.ExpiresAt)
			}

			evaluations = append(evaluations, ruleEvaluation{
				ruleType:       eval.RuleType(),
				RuleEvaluation: evaluation,
			})
			continue
		}

		result := eval.Evaluate(ctx, scope)
		if result != nil {
			result.WithRuleId(eval.RuleId())
			evaluations = append(evaluations, ruleEvaluation{
				ruleType:       eval.RuleType(),
				RuleEvaluation: result,
			})
			if !result.Allowed {
				return evaluations, nil
			}
		}
	}
	return evaluations, nil
}
