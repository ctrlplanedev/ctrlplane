package versioncooldown

import (
	"context"
	"fmt"
	"time"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator"
	"workspace-engine/pkg/workspace/releasemanager/policy/results"
	"workspace-engine/pkg/workspace/store"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

var tracer = otel.Tracer("workspace/releasemanager/policy/evaluator/versioncooldown")

var _ evaluator.Evaluator = &VersionCooldownEvaluator{}

// VersionCooldownEvaluator evaluates whether a version should be deployed based on whether
// enough time has passed since the currently deployed (or in-progress) version was created.
// It only allows versions to be deployed once the cooldown period has elapsed, enabling
// batching of frequent upstream releases into periodic deployments, and prevents rapid
// sequential deployments.
type VersionCooldownEvaluator struct {
	store  *store.Store
	ruleId string
	rule   *oapi.VersionCooldownRule
}

// NewEvaluator creates a new VersionCooldownEvaluator from a policy rule.
// Returns nil if the rule doesn't contain a version cooldown configuration.
func NewEvaluator(store *store.Store, policyRule *oapi.PolicyRule) evaluator.Evaluator {
	if policyRule == nil || policyRule.VersionCooldown == nil || store == nil {
		return nil
	}

	return evaluator.WithMemoization(&VersionCooldownEvaluator{
		store:  store,
		ruleId: policyRule.Id,
		rule:   policyRule.VersionCooldown,
	})
}

// ScopeFields declares that this evaluator needs Version and ReleaseTarget.
// It needs ReleaseTarget to look up the current deployment, and Version to
// compare creation times.
func (e *VersionCooldownEvaluator) ScopeFields() evaluator.ScopeFields {
	return evaluator.ScopeVersion | evaluator.ScopeReleaseTarget
}

// RuleType returns the rule type identifier for bypass matching.
func (e *VersionCooldownEvaluator) RuleType() string {
	return evaluator.RuleTypeVersionCooldown
}

// RuleId returns the rule ID.
func (e *VersionCooldownEvaluator) RuleId() string {
	return e.ruleId
}

// Complexity returns the computational complexity of this evaluator.
func (e *VersionCooldownEvaluator) Complexity() int {
	return 2 // Requires looking up current release and version
}

// formatDuration returns a human-readable duration string.
func formatDuration(d time.Duration) string {
	if d < time.Minute {
		return fmt.Sprintf("%ds", int(d.Seconds()))
	}
	if d < time.Hour {
		return fmt.Sprintf("%dm", int(d.Minutes()))
	}
	if d < 24*time.Hour {
		hours := int(d.Hours())
		minutes := int(d.Minutes()) % 60
		if minutes == 0 {
			return fmt.Sprintf("%dh", hours)
		}
		return fmt.Sprintf("%dh %dm", hours, minutes)
	}
	// Days
	days := int(d.Hours()) / 24
	hours := int(d.Hours()) % 24
	if hours == 0 {
		return fmt.Sprintf("%dd", days)
	}
	return fmt.Sprintf("%dd %dh", days, hours)
}

// Evaluate checks if the candidate version should be allowed based on whether
// enough time has passed since the currently deployed (or in-progress) version was created.
//
// Decision logic:
//   - No previous or in-progress deployment: Allow (first deployment)
//   - Same version as current/in-progress: Allow (redeploy of current version)
//   - Enough time has elapsed since reference version creation: Allow (any version can be deployed)
//   - Not enough time has elapsed: Deny (try next version)
func (e *VersionCooldownEvaluator) Evaluate(
	ctx context.Context,
	scope evaluator.EvaluatorScope,
) *oapi.RuleEvaluation {
	ctx, span := tracer.Start(ctx, "VersionCooldownEvaluator.Evaluate",
		trace.WithAttributes(
			attribute.String("version.id", scope.Version.Id),
			attribute.String("version.tag", scope.Version.Tag),
			attribute.String("release_target.key", scope.ReleaseTarget.Key()),
			attribute.Int("interval_seconds", int(e.rule.IntervalSeconds)),
		))
	defer span.End()

	candidateVersion := scope.Version
	interval := time.Duration(e.rule.IntervalSeconds) * time.Second

	// First, check for any in-progress deployments - these take precedence
	var referenceVersion *oapi.DeploymentVersion
	var referenceSource string

	inProgressJobs := e.store.Jobs.GetJobsInProcessingStateForReleaseTarget(scope.ReleaseTarget)
	if len(inProgressJobs) > 0 {
		// Find the most recently created in-progress job
		var latestJob *oapi.Job
		for _, job := range inProgressJobs {
			if latestJob == nil || job.CreatedAt.After(latestJob.CreatedAt) {
				latestJob = job
			}
		}
		if latestJob != nil {
			release, ok := e.store.Releases.Get(latestJob.ReleaseId)
			if ok && release != nil {
				referenceVersion = &release.Version
				referenceSource = "in_progress"
				span.AddEvent("Found in-progress deployment",
					trace.WithAttributes(
						attribute.String("in_progress_version_id", referenceVersion.Id),
						attribute.String("in_progress_version_tag", referenceVersion.Tag),
					))
			}
		}
	}

	// If no in-progress deployment, use the current (successfully deployed) version
	if referenceVersion == nil {
		currentRelease, _, err := e.store.ReleaseTargets.GetCurrentRelease(ctx, scope.ReleaseTarget)
		if err != nil || currentRelease == nil {
			// No previous deployment - allow first deployment
			span.AddEvent("No previous deployment found, allowing first deployment")
			return results.NewAllowedResult("No previous version deployed - cooldown not applicable").
				WithDetail("reason", "first_deployment").
				WithDetail("candidate_version_id", candidateVersion.Id).
				WithDetail("candidate_version_tag", candidateVersion.Tag)
		}
		referenceVersion = &currentRelease.Version
		referenceSource = "deployed"
	}

	// Check if this is a redeploy of the same version
	if referenceVersion.Id == candidateVersion.Id {
		span.AddEvent("Same version as reference, allowing redeploy")
		return results.NewAllowedResult("Same version as currently deployed/in-progress - redeploy allowed").
			WithDetail("reason", "same_version_redeploy").
			WithDetail("version_id", candidateVersion.Id).
			WithDetail("version_tag", candidateVersion.Tag).
			WithDetail("reference_source", referenceSource)
	}

	now := time.Now()
	timeSinceReferenceCreated := now.Sub(referenceVersion.CreatedAt)
	minElapsedTime := referenceVersion.CreatedAt.Add(interval)

	span.SetAttributes(
		attribute.String("reference_version.id", referenceVersion.Id),
		attribute.String("reference_version.tag", referenceVersion.Tag),
		attribute.String("reference_version.created_at", referenceVersion.CreatedAt.Format(time.RFC3339)),
		attribute.String("reference_source", referenceSource),
		attribute.String("candidate_version.created_at", candidateVersion.CreatedAt.Format(time.RFC3339)),
		attribute.String("current_time", now.Format(time.RFC3339)),
		attribute.String("time_since_reference_created", timeSinceReferenceCreated.String()),
		attribute.String("min_elapsed_time", minElapsedTime.Format(time.RFC3339)),
	)

	// Check if enough time has passed since the reference version was created
	// This allows any version to be deployed once the cooldown period has elapsed,
	// regardless of when the candidate version was created
	if now.After(minElapsedTime) || now.Equal(minElapsedTime) {
		span.AddEvent("Version cooldown passed - sufficient time has elapsed")
		return results.NewAllowedResult(
			fmt.Sprintf("Version cooldown passed — %s has elapsed since %s version (required: %s)",
				formatDuration(timeSinceReferenceCreated),
				referenceSource,
				formatDuration(interval)),
		).
			WithDetail("reason", "cooldown_passed").
			WithDetail("reference_version_id", referenceVersion.Id).
			WithDetail("reference_version_tag", referenceVersion.Tag).
			WithDetail("reference_version_created_at", referenceVersion.CreatedAt.Format(time.RFC3339)).
			WithDetail("reference_source", referenceSource).
			WithDetail("candidate_version_id", candidateVersion.Id).
			WithDetail("candidate_version_tag", candidateVersion.Tag).
			WithDetail("candidate_version_created_at", candidateVersion.CreatedAt.Format(time.RFC3339)).
			WithDetail("time_elapsed", formatDuration(timeSinceReferenceCreated)).
			WithDetail("required_interval", formatDuration(interval))
	}

	// Not enough time has passed since reference version was created - deny
	// This causes the planner to try the next (older) version
	timeRemaining := minElapsedTime.Sub(now)
	span.AddEvent("Version cooldown failed - insufficient time has elapsed")
	return results.NewDeniedResult(
		fmt.Sprintf("Version cooldown: %s remaining until deployment allowed (need %s since %s version)",
			formatDuration(timeRemaining),
			formatDuration(interval),
			referenceSource),
	).
		WithDetail("reason", "cooldown_failed").
		WithDetail("reference_version_id", referenceVersion.Id).
		WithDetail("reference_version_tag", referenceVersion.Tag).
		WithDetail("reference_version_created_at", referenceVersion.CreatedAt.Format(time.RFC3339)).
		WithDetail("reference_source", referenceSource).
		WithDetail("candidate_version_id", candidateVersion.Id).
		WithDetail("candidate_version_tag", candidateVersion.Tag).
		WithDetail("candidate_version_created_at", candidateVersion.CreatedAt.Format(time.RFC3339)).
		WithDetail("time_elapsed", formatDuration(timeSinceReferenceCreated)).
		WithDetail("time_remaining", formatDuration(timeRemaining)).
		WithDetail("required_interval", formatDuration(interval)).
		WithDetail("next_deployment_time", minElapsedTime.Format(time.RFC3339)).
		WithNextEvaluationTime(minElapsedTime)
}
