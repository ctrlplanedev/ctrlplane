package versioncooldown

import (
	"context"
	"fmt"
	"time"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator"
	"workspace-engine/pkg/workspace/releasemanager/policy/results"
	"workspace-engine/pkg/workspace/store"
)

type VersionCooldownVersionSummaryEvaluator struct {
	store  *store.Store
	ruleId string
	rule   *oapi.VersionCooldownRule
}

func NewSummaryEvaluator(store *store.Store, rule *oapi.PolicyRule) evaluator.Evaluator {
	if rule == nil || rule.VersionCooldown == nil || store == nil {
		return nil
	}
	return &VersionCooldownVersionSummaryEvaluator{store: store, ruleId: rule.Id, rule: rule.VersionCooldown}
}

func (e *VersionCooldownVersionSummaryEvaluator) ScopeFields() evaluator.ScopeFields {
	return evaluator.ScopeVersion
}

// RuleType returns the rule type identifier for bypass matching.
func (e *VersionCooldownVersionSummaryEvaluator) RuleType() string {
	return evaluator.RuleTypeVersionCooldown
}

func (e *VersionCooldownVersionSummaryEvaluator) RuleId() string {
	return e.ruleId
}

func (e *VersionCooldownVersionSummaryEvaluator) Complexity() int {
	return 2
}

// pluralize returns "s" if count is not 1, empty string otherwise
func pluralize(count int) string {
	if count == 1 {
		return ""
	}
	return "s"
}

func (e *VersionCooldownVersionSummaryEvaluator) Evaluate(ctx context.Context, scope evaluator.EvaluatorScope) *oapi.RuleEvaluation {
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
	var nextDeploymentTime *time.Time
	messages := make([]*oapi.RuleEvaluation, 0, totalTargets)

	for _, releaseTarget := range releaseTargets {
		scope := evaluator.EvaluatorScope{
			Version:       version,
			ReleaseTarget: releaseTarget,
		}
		evaluation := NewEvaluator(e.store, &oapi.PolicyRule{Id: "versionCooldownSummary", VersionCooldown: e.rule}).Evaluate(ctx, scope)

		messages = append(messages, evaluation)

		if evaluation.Allowed {
			allowedTargets++
		} else {
			deniedTargets++
			// Track the earliest next deployment time from denied evaluations
			if evaluation.NextEvaluationTime != nil {
				if nextDeploymentTime == nil || evaluation.NextEvaluationTime.Before(*nextDeploymentTime) {
					nextDeploymentTime = evaluation.NextEvaluationTime
				}
			}
		}
	}

	result := results.NewResult().
		WithDetail("total_targets", totalTargets).
		WithDetail("allowed_targets", allowedTargets).
		WithDetail("denied_targets", deniedTargets).
		WithDetail("messages", messages)

	// Add next deployment time to details if available
	if nextDeploymentTime != nil {
		result = result.
			WithDetail("next_deployment_time", nextDeploymentTime.Format(time.RFC3339)).
			WithNextEvaluationTime(*nextDeploymentTime)
	}

	// Build the status message
	if totalTargets == 0 {
		return result.Deny().WithMessage("No release targets configured for this deployment")
	}

	if allowedTargets == totalTargets {
		return result.Allow().WithMessage(fmt.Sprintf("Version cooldown passed — All %d target%s allowed",
			totalTargets, pluralize(totalTargets)))
	}

	if deniedTargets == totalTargets {
		msg := fmt.Sprintf("Version cooldown blocked — %d target%s denied",
			deniedTargets, pluralize(deniedTargets))
		if nextDeploymentTime != nil {
			timeRemaining := time.Until(*nextDeploymentTime)
			if timeRemaining > 0 {
				msg += fmt.Sprintf(" • Next deployment possible in %s", formatDuration(timeRemaining))
			} else {
				msg += " • Next deployment possible now"
			}
		}
		return result.Deny().WithMessage(msg)
	}

	// Mixed results - some allowed, some denied
	msg := fmt.Sprintf("Version cooldown partially blocked — %d allowed, %d denied of %d total",
		allowedTargets, deniedTargets, totalTargets)
	if nextDeploymentTime != nil {
		timeRemaining := time.Until(*nextDeploymentTime)
		if timeRemaining > 0 {
			msg += fmt.Sprintf(" • Next deployment possible in %s", formatDuration(timeRemaining))
		} else {
			msg += " • Next deployment possible now"
		}
	}
	return result.Deny().WithMessage(msg)
}
