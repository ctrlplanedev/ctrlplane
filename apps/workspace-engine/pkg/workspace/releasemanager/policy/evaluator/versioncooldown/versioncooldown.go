package versioncooldown

import (
	"context"
	"fmt"
	"sort"
	"sync"
	"time"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator"
	"workspace-engine/pkg/workspace/releasemanager/policy/results"
	"workspace-engine/pkg/workspace/store"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
)

var tracer = otel.Tracer("workspace/releasemanager/policy/evaluator/versioncooldown")

var _ evaluator.Evaluator = &VersionCooldownEvaluator{}

// VersionCooldownEvaluator evaluates whether a version should be deployed based on whether
// enough time has passed since the currently deployed (or in-progress) version was created.
// It only allows versions to be deployed once the cooldown period has elapsed, enabling
// batching of frequent upstream releases into periodic deployments, and prevents rapid
// sequential deployments.
//
// Performance note: the reference version (from in-progress or current deployment) depends
// only on the release target, not the candidate version. It is resolved once and cached so
// that iterating through N candidate versions does not repeat the expensive job/release
// lookups N times.
type VersionCooldownEvaluator struct {
	getters Getters
	ruleId  string
	rule    *oapi.VersionCooldownRule

	// refOnce guards the one-time resolution of the reference version.
	// The reference version is the same for all candidate versions evaluated
	// against the same release target, so we resolve it once and reuse it.
	refOnce   sync.Once
	refResult *referenceResult
}

// referenceResult caches the outcome of resolving the reference version for a
// release target. A nil version means no previous deployment exists (first deploy).
type referenceResult struct {
	version *oapi.DeploymentVersion
	source  string // "in_progress" or "deployed"
}

// NewEvaluator creates a new VersionCooldownEvaluator from a policy rule.
// Returns nil if the rule doesn't contain a version cooldown configuration.
func NewEvaluatorFromStore(store *store.Store, policyRule *oapi.PolicyRule) evaluator.Evaluator {
	if store == nil {
		return nil
	}
	return NewEvaluator(&storeGetters{store: store}, policyRule)
}

func NewEvaluator(getters Getters, policyRule *oapi.PolicyRule) evaluator.Evaluator {
	if policyRule == nil || policyRule.VersionCooldown == nil || getters == nil {
		return nil
	}

	return evaluator.WithMemoization(&VersionCooldownEvaluator{
		getters: getters,
		ruleId:  policyRule.Id,
		rule:    policyRule.VersionCooldown,
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
	return 2
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
	days := int(d.Hours()) / 24
	hours := int(d.Hours()) % 24
	if hours == 0 {
		return fmt.Sprintf("%dd", days)
	}
	return fmt.Sprintf("%dd %dh", days, hours)
}

// resolveReferenceVersion finds the version to compare cooldown against.
// It checks in-progress jobs first (they take precedence), then falls back to
// the current (successfully deployed + verified) release.
//
// The result is cached because it depends only on the release target state, not
// the candidate version — so it is identical across all candidate evaluations.
func (e *VersionCooldownEvaluator) resolveReferenceVersion(ctx context.Context, releaseTarget *oapi.ReleaseTarget) *referenceResult {
	e.refOnce.Do(func() {
		e.refResult = e.doResolveReferenceVersion(ctx, releaseTarget)
	})
	return e.refResult
}

func (e *VersionCooldownEvaluator) doResolveReferenceVersion(ctx context.Context, releaseTarget *oapi.ReleaseTarget) *referenceResult {
	// Fetch all jobs for this release target once and derive both in-progress
	// and current release from the same data set, avoiding duplicate
	// GetJobsForReleaseTarget calls.
	allJobs := e.getters.GetJobsForReleaseTarget(releaseTarget)

	// Check for in-progress deployments first — these take precedence.
	var latestInProgressJob *oapi.Job
	for _, job := range allJobs {
		if !job.IsInProcessingState() {
			continue
		}
		if latestInProgressJob == nil || job.CreatedAt.After(latestInProgressJob.CreatedAt) {
			latestInProgressJob = job
		}
	}

	if latestInProgressJob != nil {
		release, ok := e.getters.GetRelease(latestInProgressJob.ReleaseId)
		if ok && release != nil {
			return &referenceResult{version: &release.Version, source: "in_progress"}
		}
	}

	// No in-progress deployment — find the current release from the same job
	// set. This inlines the GetCurrentRelease logic to avoid refetching all
	// jobs from the store a second time.
	successfulJobs := make([]*oapi.Job, 0, len(allJobs))
	for _, job := range allJobs {
		if job.Status == oapi.JobStatusSuccessful && job.CompletedAt != nil {
			successfulJobs = append(successfulJobs, job)
		}
	}

	sort.Slice(successfulJobs, func(i, j int) bool {
		return successfulJobs[i].CompletedAt.After(*successfulJobs[j].CompletedAt)
	})

	for _, job := range successfulJobs {
		release, ok := e.getters.GetRelease(job.ReleaseId)
		if !ok || release == nil {
			continue
		}

		status := e.getters.GetJobVerificationStatus(job.Id)
		if status == "" || status == oapi.JobVerificationStatusPassed {
			return &referenceResult{version: &release.Version, source: "deployed"}
		}
	}

	return &referenceResult{version: nil, source: ""}
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
	_, span := tracer.Start(ctx, "VersionCooldownEvaluator.Evaluate")
	defer span.End()

	candidateVersion := scope.Version
	interval := time.Duration(e.rule.IntervalSeconds) * time.Second

	// Resolve the reference version once (cached across candidate versions).
	ref := e.resolveReferenceVersion(ctx, scope.ReleaseTarget())

	if ref.version == nil {
		return results.NewAllowedResult("No previous version deployed - cooldown not applicable").
			WithDetail("reason", "first_deployment").
			WithDetail("candidate_version_id", candidateVersion.Id).
			WithDetail("candidate_version_tag", candidateVersion.Tag)
	}

	referenceVersion := ref.version
	referenceSource := ref.source

	// Redeploy of the same version is always allowed.
	if referenceVersion.Id == candidateVersion.Id {
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
		attribute.String("reference_source", referenceSource),
		attribute.Int("interval_seconds", int(e.rule.IntervalSeconds)),
	)

	// Cooldown passed — allow any version to be deployed.
	if !now.Before(minElapsedTime) {
		return results.NewAllowedResult(
			fmt.Sprintf("Version cooldown passed — %s has elapsed since %s version (required: %s)",
				formatDuration(timeSinceReferenceCreated),
				referenceSource,
				formatDuration(interval)),
		).
			WithDetail("reason", "cooldown_passed").
			WithDetail("reference_version_id", referenceVersion.Id).
			WithDetail("reference_version_tag", referenceVersion.Tag).
			WithDetail("reference_source", referenceSource).
			WithDetail("candidate_version_id", candidateVersion.Id).
			WithDetail("candidate_version_tag", candidateVersion.Tag).
			WithDetail("time_elapsed", formatDuration(timeSinceReferenceCreated)).
			WithDetail("required_interval", formatDuration(interval))
	}

	// Cooldown not yet passed — deny and tell the planner when to retry.
	timeRemaining := minElapsedTime.Sub(now)
	return results.NewDeniedResult(
		fmt.Sprintf("Version cooldown: %s remaining until deployment allowed (need %s since %s version)",
			formatDuration(timeRemaining),
			formatDuration(interval),
			referenceSource),
	).
		WithDetail("reason", "cooldown_failed").
		WithDetail("reference_version_id", referenceVersion.Id).
		WithDetail("reference_version_tag", referenceVersion.Tag).
		WithDetail("reference_source", referenceSource).
		WithDetail("candidate_version_id", candidateVersion.Id).
		WithDetail("candidate_version_tag", candidateVersion.Tag).
		WithDetail("time_remaining", formatDuration(timeRemaining)).
		WithDetail("required_interval", formatDuration(interval)).
		WithDetail("next_deployment_time", minElapsedTime.Format(time.RFC3339)).
		WithNextEvaluationTime(minElapsedTime)
}
