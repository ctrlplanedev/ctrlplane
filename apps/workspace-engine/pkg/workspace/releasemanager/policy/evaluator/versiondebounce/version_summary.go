package versiondebounce

import (
	"context"
	"fmt"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator"
	"workspace-engine/pkg/workspace/releasemanager/policy/results"
	"workspace-engine/pkg/workspace/store"
)

type VersionDebounceVersionSummaryEvaluator struct {
	store  *store.Store
	ruleId string
	rule   *oapi.VersionDebounceRule
}

func NewSummaryEvaluator(store *store.Store, rule *oapi.PolicyRule) evaluator.Evaluator {
	if rule == nil || rule.VersionDebounce == nil || store == nil {
		return nil
	}
	return &VersionDebounceVersionSummaryEvaluator{store: store, ruleId: rule.Id, rule: rule.VersionDebounce}
}

func (e *VersionDebounceVersionSummaryEvaluator) ScopeFields() evaluator.ScopeFields {
	return evaluator.ScopeVersion
}

// RuleType returns the rule type identifier for bypass matching.
func (e *VersionDebounceVersionSummaryEvaluator) RuleType() string {
	return evaluator.RuleTypeVersionDebounce
}

func (e *VersionDebounceVersionSummaryEvaluator) RuleId() string {
	return e.ruleId
}

func (e *VersionDebounceVersionSummaryEvaluator) Complexity() int {
	return 2
}

// pluralize returns "s" if count is not 1, empty string otherwise
func pluralize(count int) string {
	if count == 1 {
		return ""
	}
	return "s"
}

func (e *VersionDebounceVersionSummaryEvaluator) Evaluate(ctx context.Context, scope evaluator.EvaluatorScope) *oapi.RuleEvaluation {
	version := scope.Version

	allReleaseTargets, err := e.store.ReleaseTargets.Items()
	if err != nil {
		return results.NewDeniedResult(fmt.Sprintf("Failed to get release targets: %v", err)).
			WithDetail("error", err.Error())
	}

	releaseTargets := make([]*oapi.ReleaseTarget, 0, len(allReleaseTargets))
	for _, releaseTarget := range allReleaseTargets {
		if releaseTarget.DeploymentId == version.DeploymentId {
			releaseTargets = append(releaseTargets, releaseTarget)
		}
	}

	totalTargets := len(releaseTargets)
	allowedTargets := 0
	deniedTargets := 0
	messages := make([]*oapi.RuleEvaluation, 0, totalTargets)

	for _, releaseTarget := range releaseTargets {
		scope := evaluator.EvaluatorScope{
			Version:       version,
			ReleaseTarget: releaseTarget,
		}
		evaluation := NewEvaluator(e.store, &oapi.PolicyRule{Id: "versionDebounceSummary", VersionDebounce: e.rule}).Evaluate(ctx, scope)

		messages = append(messages, evaluation)

		if evaluation.Allowed {
			allowedTargets++
		} else {
			deniedTargets++
		}
	}

	result := results.NewResult().
		WithDetail("total_targets", totalTargets).
		WithDetail("allowed_targets", allowedTargets).
		WithDetail("denied_targets", deniedTargets).
		WithDetail("messages", messages)

	// Build the status message
	if totalTargets == 0 {
		return result.Deny().WithMessage("No release targets configured for this deployment")
	}

	if allowedTargets == totalTargets {
		return result.Allow().WithMessage(fmt.Sprintf("Version debounce passed — All %d target%s allowed",
			totalTargets, pluralize(totalTargets)))
	}

	if deniedTargets == totalTargets {
		return result.Deny().WithMessage(fmt.Sprintf("Version debounce blocked — All %d target%s denied",
			deniedTargets, pluralize(deniedTargets)))
	}

	// Mixed results - some allowed, some denied
	return result.Deny().WithMessage(fmt.Sprintf("Version debounce partially blocked — %d allowed, %d denied of %d total",
		allowedTargets, deniedTargets, totalTargets))
}


