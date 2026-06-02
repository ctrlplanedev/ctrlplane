package policyeval

import (
	"cmp"
	"context"
	"fmt"
	"iter"
	"slices"
	"time"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
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
// The versions iterator is consumed lazily so callers can stream version
// history without buffering it all in memory; iteration stops as soon as a
// deployable version is found.
//
// Policy skips are fetched per candidate version via getter.GetPolicySkips.
// Any evaluator whose RuleId matches a non-expired skip is automatically
// bypassed.
func FindDeployableVersion(
	ctx context.Context,
	getter Getter,
	rt *oapi.ReleaseTarget,
	versions iter.Seq2[*oapi.DeploymentVersion, error],
	evals []evaluator.Evaluator,
	scope evaluator.EvaluatorScope,
) (*FindDeployableVersionResult, error) {
	_, span := tracer.Start(ctx, "FindDeployableVersion")
	defer span.End()

	var earliest *time.Time
	var allEvaluations []VersionedEvaluation
	var found *oapi.DeploymentVersion
	var iterErr error
	var scanned int

	for version, err := range versions {
		if err != nil {
			iterErr = fmt.Errorf("iter candidate versions: %w", err)
			break
		}
		scanned++
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
			found = version
			break
		}
	}
	span.SetAttributes(
		attribute.String("deployment.id", rt.DeploymentId),
		attribute.Int("versions.scanned", scanned),
		attribute.Bool("version.found", found != nil),
	)
	if iterErr != nil {
		return nil, iterErr
	}
	return &FindDeployableVersionResult{
		Version:     found,
		NextTime:    earliest,
		Evaluations: allEvaluations,
	}, nil
}

// FilterEvaluatorsByRuleID returns evaluators whose RuleId is not in excludeIDs.
// The function never mutates the input slice. When excludeIDs is empty the
// input is returned as-is (shared backing storage); otherwise a freshly
// allocated slice is returned.
func FilterEvaluatorsByRuleID(
	evals []evaluator.Evaluator,
	excludeIDs []string,
) []evaluator.Evaluator {
	if len(excludeIDs) == 0 {
		return evals
	}
	excludeSet := make(map[string]struct{}, len(excludeIDs))
	for _, id := range excludeIDs {
		excludeSet[id] = struct{}{}
	}
	kept := make([]evaluator.Evaluator, 0, len(evals))
	for _, e := range evals {
		if _, skip := excludeSet[e.RuleId()]; !skip {
			kept = append(kept, e)
		}
	}
	return kept
}

// ListDeployableVersions iterates candidate versions and returns every version
// that passes the full evaluator set for the given release target. Unlike
// FindDeployableVersion it does not short-circuit on the first allowed version;
// callers receive the complete eligible set in iteration order.
func ListDeployableVersions(
	ctx context.Context,
	getter Getter,
	rt *oapi.ReleaseTarget,
	versions iter.Seq2[*oapi.DeploymentVersion, error],
	evals []evaluator.Evaluator,
	scope evaluator.EvaluatorScope,
) ([]*oapi.DeploymentVersion, error) {
	_, span := tracer.Start(ctx, "ListDeployableVersions")
	defer span.End()

	var eligible []*oapi.DeploymentVersion
	var scanned int

	for version, err := range versions {
		if err != nil {
			return nil, fmt.Errorf("iter candidate versions: %w", err)
		}
		scanned++
		scope.Version = version

		skips, err := getter.GetPolicySkips(ctx, version.Id, rt.EnvironmentId, rt.ResourceId)
		if err != nil {
			return nil, fmt.Errorf("get policy skips: %w", err)
		}

		evaluations, err := evaluateVersion(ctx, evals, scope, skips)
		if err != nil {
			return nil, fmt.Errorf("evaluate version: %w", err)
		}

		if evaluations.Allowed() {
			eligible = append(eligible, version)
		}
	}

	span.SetAttributes(
		attribute.String("deployment.id", rt.DeploymentId),
		attribute.Int("versions.scanned", scanned),
		attribute.Int("versions.eligible", len(eligible)),
	)
	return eligible, nil
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
				WithDetail("skip_id", skip.Id).
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
