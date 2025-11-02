package gradualrollout

import (
	"context"
	"fmt"
	"time"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator"
	"workspace-engine/pkg/workspace/releasemanager/policy/results"
	"workspace-engine/pkg/workspace/store"
)

type GradualRolloutEnvironmentSummaryEvaluator struct {
	store *store.Store
	rule  *oapi.GradualRolloutRule
}

func NewSummaryEvaluator(store *store.Store, rule *oapi.GradualRolloutRule) evaluator.Evaluator {
	if rule == nil || store == nil {
		return nil
	}
	return &GradualRolloutEnvironmentSummaryEvaluator{store: store, rule: rule}
}

func (e *GradualRolloutEnvironmentSummaryEvaluator) ScopeFields() evaluator.ScopeFields {
	return evaluator.ScopeEnvironment | evaluator.ScopeVersion
}

// formatDuration converts a duration to a human-readable string
func formatDuration(d time.Duration) string {
	if d < time.Minute {
		return fmt.Sprintf("%d seconds", int(d.Seconds()))
	}
	if d < time.Hour {
		minutes := int(d.Minutes())
		if minutes == 1 {
			return "1 minute"
		}
		return fmt.Sprintf("%d minutes", minutes)
	}
	if d < 24*time.Hour {
		hours := int(d.Hours())
		if hours == 1 {
			return "1 hour"
		}
		return fmt.Sprintf("%d hours", hours)
	}
	days := int(d.Hours() / 24)
	if days == 1 {
		return "1 day"
	}
	return fmt.Sprintf("%d days", days)
}

// pluralize returns "s" if count is not 1, empty string otherwise
func pluralize(count int) string {
	if count == 1 {
		return ""
	}
	return "s"
}

func (e *GradualRolloutEnvironmentSummaryEvaluator) Evaluate(ctx context.Context, scope evaluator.EvaluatorScope) *oapi.RuleEvaluation {
	environment := scope.Environment
	version := scope.Version

	allReleaseTargets, err := e.store.ReleaseTargets.Items(ctx)
	if err != nil {
		return results.NewDeniedResult(fmt.Sprintf("Failed to get release targets: %v", err)).
			WithDetail("error", err.Error())
	}

	releaseTargets := make([]*oapi.ReleaseTarget, 0, len(allReleaseTargets))
	for _, releaseTarget := range allReleaseTargets {
		if releaseTarget.EnvironmentId == environment.Id && releaseTarget.DeploymentId == version.DeploymentId {
			releaseTargets = append(releaseTargets, releaseTarget)
		}
	}

	totalTargets := len(releaseTargets)
	deployedTargets := 0
	pendingTargets := 0
	deniedTargets := 0
	var rolloutStartTime *time.Time
	var estimatedCompletionTime *time.Time
	var nextDeploymentTime *time.Time

	messages := make([]*oapi.RuleEvaluation, 0, totalTargets)

	for _, releaseTarget := range releaseTargets {
		scope := evaluator.EvaluatorScope{
			Environment:   environment,
			Version:       version,
			ReleaseTarget: releaseTarget,
		}
		evaluation := NewEvaluator(e.store, e.rule).Evaluate(ctx, scope)

		messages = append(messages, evaluation)
		var targetTime *time.Time
		if timeStr, ok := evaluation.Details["target_rollout_time"].(string); ok {
			if parsedTime, err := time.Parse(time.RFC3339, timeStr); err == nil {
				targetTime = &parsedTime
			}
		}

		if evaluation.Allowed {
			deployedTargets++
		} else if evaluation.ActionRequired {
			pendingTargets++

			if targetTime != nil {
				if nextDeploymentTime == nil || targetTime.Before(*nextDeploymentTime) {
					nextDeploymentTime = targetTime
				}
				if estimatedCompletionTime == nil || targetTime.After(*estimatedCompletionTime) {
					estimatedCompletionTime = targetTime
				}
			}
		} else {
			deniedTargets++
		}

		// Track rollout start time (earliest)
		if startTimeStr, ok := evaluation.Details["rollout_start_time"].(string); ok {
			if parsedTime, err := time.Parse(time.RFC3339, startTimeStr); err == nil {
				if rolloutStartTime == nil || parsedTime.Before(*rolloutStartTime) {
					rolloutStartTime = &parsedTime
				}
			}
		}
	}

	result := results.NewResult()

	var nextDeploymentTimeStr any
	if nextDeploymentTime != nil {
		nextDeploymentTimeStr = nextDeploymentTime.Format(time.RFC3339)
	}

	var estimatedCompletionTimeStr any
	if estimatedCompletionTime != nil {
		estimatedCompletionTimeStr = estimatedCompletionTime.Format(time.RFC3339)
	}

	var rolloutStartTimeStr any
	if rolloutStartTime != nil {
		rolloutStartTimeStr = rolloutStartTime.Format(time.RFC3339)
	}

	result = result.
		WithDetail("total_targets", totalTargets).
		WithDetail("deployed_targets", deployedTargets).
		WithDetail("pending_targets", pendingTargets).
		WithDetail("denied_targets", deniedTargets).
		WithDetail("rollout_start_time", rolloutStartTimeStr).
		WithDetail("estimated_completion_time", estimatedCompletionTimeStr).
		WithDetail("next_deployment_time", nextDeploymentTimeStr).
		WithDetail("messages", messages)

	// Build the status message
	if totalTargets == 0 {
		return result.Deny().WithMessage("No release targets configured for this environment")
	}

	if deployedTargets == totalTargets {
		return result.Allow().WithMessage(fmt.Sprintf("Rollout complete — All %d target%s successfully deployed",
			totalTargets, pluralize(totalTargets)))
	}

	if deniedTargets == totalTargets {
		return result.Deny().WithMessage(fmt.Sprintf("Rollout blocked — All %d target%s denied deployment",
			deniedTargets, pluralize(deniedTargets)))
	}

	if pendingTargets == totalTargets && nextDeploymentTime == nil {
		return result.WithActionRequired(oapi.Wait).WithMessage("Waiting for rollout to start")
	}

	// Build progress message
	var progressMsg string
	if pendingTargets > 0 && nextDeploymentTime != nil {
		now := time.Now()
		if nextDeploymentTime.After(now) {
			duration := nextDeploymentTime.Sub(now)
			timeUntil := formatDuration(duration)
			progressMsg = fmt.Sprintf("Rollout in progress — %d/%d deployed, %d pending • Next deployment in %s",
				deployedTargets, totalTargets, pendingTargets, timeUntil)
		} else {
			progressMsg = fmt.Sprintf("Rollout in progress — %d/%d deployed, %d pending • Next deployment ready now",
				deployedTargets, totalTargets, pendingTargets)
		}

		if estimatedCompletionTime != nil && estimatedCompletionTime.After(now) {
			completionDuration := estimatedCompletionTime.Sub(now)
			completionTime := formatDuration(completionDuration)
			progressMsg += fmt.Sprintf(" • Est. completion in %s", completionTime)
		}

		return result.WithActionRequired(oapi.Wait).WithMessage(progressMsg)
	}

	if pendingTargets > 0 {
		progressMsg = fmt.Sprintf("Rollout in progress — %d/%d deployed, %d pending",
			deployedTargets, totalTargets, pendingTargets)
		return result.WithActionRequired(oapi.Wait).WithMessage(progressMsg)
	}

	if deniedTargets > 0 {
		return result.Deny().WithMessage(fmt.Sprintf("Rollout partially blocked — %d deployed, %d denied of %d total",
			deployedTargets, deniedTargets, totalTargets))
	}

	// Fallback for unexpected states
	return result.WithActionRequired(oapi.Wait).WithMessage(fmt.Sprintf("Rollout status: %d/%d deployed",
		deployedTargets, totalTargets))
}
