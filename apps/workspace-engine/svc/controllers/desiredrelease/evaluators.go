package desiredrelease

import (
	"context"
	"sort"
	"time"

	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator/approval"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator/deploymentwindow"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator/versioncooldown"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator/versionselector"
)

// policyEvaluators returns evaluators for a single policy rule.
// Evaluator constructors that receive nil getters gracefully return nil,
// and evaluator.CollectEvaluators filters those out.
func policyEvaluators(rule *oapi.PolicyRule) []evaluator.Evaluator {
	return evaluator.CollectEvaluators(
		versionselector.NewEvaluator(rule),

		// The evaluators below require DB-backed Getters adapters that are not
		// yet implemented. Once those adapters exist, replace nil with the
		// concrete getters.
		approval.NewEvaluator(nil, rule),
		deploymentwindow.NewEvaluator(nil, rule),
		versioncooldown.NewEvaluator(nil, rule),
	)
}

// CollectEvaluators builds and sorts the full evaluator set for the given
// policies. Evaluators are sorted by Complexity (cheapest first) so that
// fast-failing checks run before expensive ones.
func CollectEvaluators(policies []*oapi.Policy) []evaluator.Evaluator {
	var evals []evaluator.Evaluator
	for _, p := range policies {
		if p == nil || !p.Enabled {
			continue
		}
		for _, rule := range p.Rules {
			evals = append(evals, policyEvaluators(&rule)...)
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
