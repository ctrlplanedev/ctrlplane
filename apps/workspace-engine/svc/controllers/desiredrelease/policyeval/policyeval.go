package policyeval

import (
	"cmp"
	"context"
	"slices"
	"time"

	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator/approval"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator/deployableversions"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator/deploymentwindow"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator/versionselector"
)

// Getter provides the data-access methods needed by policy evaluators.
type Getter interface {
	GetApprovalRecords(ctx context.Context, versionID, environmentID string) ([]*oapi.UserApprovalRecord, error)
	HasCurrentRelease(ctx context.Context, rt *oapi.ReleaseTarget) (bool, error)
	GetCurrentRelease(ctx context.Context, rt *oapi.ReleaseTarget) (*oapi.Release, error)
	GetPolicySkips(ctx context.Context, versionID, environmentID, resourceID string) ([]*oapi.PolicySkip, error)
}

// ruleEvaluators returns evaluators for a single policy rule.
func ruleEvaluators(ctx context.Context, getter Getter, rule *oapi.PolicyRule) []evaluator.Evaluator {
	return evaluator.CollectEvaluators(
		versionselector.NewEvaluator(rule),
		approval.NewEvaluator(&approvalAdapter{getter: getter, ctx: ctx}, rule),
		deploymentwindow.NewEvaluator(&deploymentWindowAdapter{getter: getter, ctx: ctx}, rule),
	)
}

// CollectEvaluators builds and sorts the full evaluator set for the given
// policies. Evaluators are sorted by Complexity (cheapest first) so that
// fast-failing checks run before expensive ones.
func CollectEvaluators(ctx context.Context, getter Getter, rt *oapi.ReleaseTarget, policies []*oapi.Policy) []evaluator.Evaluator {
	evals := []evaluator.Evaluator{
		deployableversions.NewEvaluator(
			&deployableVersionsAdapter{getter: getter, ctx: ctx, rt: rt},
		),
	}

	for _, p := range policies {
		if p == nil || !p.Enabled {
			continue
		}
		for _, rule := range p.Rules {
			evals = append(evals, ruleEvaluators(ctx, getter, &rule)...)
		}
	}

	slices.SortFunc(evals, func(a, b evaluator.Evaluator) int {
		return cmp.Compare(a.Complexity(), b.Complexity())
	})

	return evals
}

// FindDeployableVersion iterates candidate versions (newest-first) and returns
// the first one that passes every evaluator. When no version qualifies, the
// second return value is the earliest NextEvaluationTime across all denials,
// telling the caller when to retry.
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
) (*oapi.DeploymentVersion, *time.Time) {
	var earliest *time.Time

	for _, version := range versions {
		scope.Version = version

		skips, _ := getter.GetPolicySkips(ctx, version.Id, rt.EnvironmentId, rt.ResourceId)

		eligible, nextTime := evaluateVersion(ctx, evals, scope, skips)
		if eligible {
			return version, nil
		}
		if nextTime != nil && (earliest == nil || nextTime.Before(*earliest)) {
			earliest = nextTime
		}
	}
	return nil, earliest
}

// buildSkipSet returns the set of rule IDs that have a non-expired policy skip.
func buildSkipSet(skips []*oapi.PolicySkip) map[string]bool {
	set := make(map[string]bool, len(skips))
	for _, s := range skips {
		if !s.IsExpired() {
			set[s.RuleId] = true
		}
	}
	return set
}

// evaluateVersion runs every evaluator against the scope and short-circuits
// on the first denial. Evaluators whose RuleId appears in skips are bypassed.
func evaluateVersion(ctx context.Context, evals []evaluator.Evaluator, scope evaluator.EvaluatorScope, skips []*oapi.PolicySkip) (bool, *time.Time) {
	skipped := buildSkipSet(skips)

	for _, eval := range evals {
		if !scope.HasFields(eval.ScopeFields()) {
			continue
		}
		if skipped[eval.RuleId()] {
			continue
		}
		result := eval.Evaluate(ctx, scope)
		if result == nil || !result.Allowed {
			if result != nil {
				return false, result.NextEvaluationTime
			}
			return false, nil
		}
	}
	return true, nil
}
