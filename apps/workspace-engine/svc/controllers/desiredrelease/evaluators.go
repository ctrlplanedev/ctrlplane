package desiredrelease

import (
	"context"
	"sort"
	"time"

	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator/approval"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator/deployableversions"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator/deploymentwindow"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator/versionselector"
)

// --- Adapters mapping reconciler Getter to evaluator Getters interfaces ---

var _ approval.Getters = (*approvalAdapter)(nil)

type approvalAdapter struct {
	getter Getter
	ctx    context.Context
}

func (a *approvalAdapter) GetApprovalRecords(versionID, environmentID string) []*oapi.UserApprovalRecord {
	records, _ := a.getter.GetApprovalRecords(a.ctx, versionID, environmentID)
	return records
}

var _ deploymentwindow.Getters = (*deploymentWindowAdapter)(nil)

type deploymentWindowAdapter struct {
	getter Getter
	ctx    context.Context
}

func (a *deploymentWindowAdapter) HasCurrentRelease(ctx context.Context, releaseTarget *oapi.ReleaseTarget) bool {
	rt := &ReleaseTarget{}
	if err := rt.FromOapi(releaseTarget); err != nil {
		return false
	}
	has, _ := a.getter.HasCurrentRelease(ctx, rt)
	return has
}

var _ deployableversions.Getters = (*deployableVersionsAdapter)(nil)

type deployableVersionsAdapter struct {
	getter Getter
	ctx    context.Context
	rt     *ReleaseTarget
}

func (a *deployableVersionsAdapter) GetReleases() map[string]*oapi.Release {
	release, _ := a.getter.GetCurrentRelease(a.ctx, a.rt)
	if release == nil {
		return nil
	}
	return map[string]*oapi.Release{release.ID(): release}
}

// policyEvaluators returns evaluators for a single policy rule.
func policyEvaluators(ctx context.Context, getter Getter, rule *oapi.PolicyRule) []evaluator.Evaluator {
	return evaluator.CollectEvaluators(
		versionselector.NewEvaluator(rule),
		approval.NewEvaluator(&approvalAdapter{getter: getter, ctx: ctx}, rule),
		deploymentwindow.NewEvaluator(&deploymentWindowAdapter{getter: getter, ctx: ctx}, rule),
	)
}

// CollectEvaluators builds and sorts the full evaluator set for the given
// policies. Evaluators are sorted by Complexity (cheapest first) so that
// fast-failing checks run before expensive ones.
func CollectEvaluators(ctx context.Context, getter Getter, rt *ReleaseTarget, policies []*oapi.Policy) []evaluator.Evaluator {
	var evals []evaluator.Evaluator

	evals = append(evals, deployableversions.NewEvaluator(
		&deployableVersionsAdapter{getter: getter, ctx: ctx, rt: rt},
	))

	for _, p := range policies {
		if p == nil || !p.Enabled {
			continue
		}
		for _, rule := range p.Rules {
			evals = append(evals, policyEvaluators(ctx, getter, &rule)...)
		}
	}

	sort.Slice(evals, func(i, j int) bool {
		return evals[i].Complexity() < evals[j].Complexity()
	})

	return evals
}

// FindDeployableVersion iterates candidate versions (newest-first) and returns
// the first one that passes every evaluator. When no version qualifies, the
// second return value is the earliest NextEvaluationTime across all denials,
// telling the caller when to retry.
func FindDeployableVersion(
	ctx context.Context,
	versions []*oapi.DeploymentVersion,
	evals []evaluator.Evaluator,
	scope evaluator.EvaluatorScope,
) (*oapi.DeploymentVersion, *time.Time) {
	var earliest *time.Time

	for _, version := range versions {
		scope.Version = version

		eligible, nextTime := evaluateVersion(ctx, evals, scope)
		if eligible {
			return version, nil
		}
		if nextTime != nil && (earliest == nil || nextTime.Before(*earliest)) {
			earliest = nextTime
		}
	}
	return nil, earliest
}

// evaluateVersion runs every evaluator against the scope and short-circuits
// on the first denial. Returns the eligible bool and the earliest
// NextEvaluationTime from the denying result (if any).
func evaluateVersion(ctx context.Context, evals []evaluator.Evaluator, scope evaluator.EvaluatorScope) (bool, *time.Time) {
	for _, eval := range evals {
		if !scope.HasFields(eval.ScopeFields()) {
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
