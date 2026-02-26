package retry

import (
	"context"
	"fmt"
	"math"
	"sort"
	"time"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator"
	"workspace-engine/pkg/workspace/releasemanager/policy/results"
	"workspace-engine/pkg/workspace/store"
)

var _ evaluator.JobEvaluator = &RetryEvaluator{}

// RetryEvaluator enforces retry limits for failed deployments based on job status.
// It counts previous consecutive job attempts for the same release that match the configured
// retryable statuses and denies job creation if the limit is exceeded.
//
// When backoff is configured, it calculates the required wait time between retries
// and returns a Pending result if insufficient time has elapsed.
type RetryEvaluator struct {
	getters Getters
	rule    *oapi.RetryRule
}

// NewEvaluator creates a new retry evaluator.
// Returns nil if the store is nil.
//
// If rule is nil, uses default behavior: maxRetries=0 (one attempt only),
// counting all job statuses toward the limit.
func NewEvaluatorFromStore(store *store.Store, rule *oapi.RetryRule) evaluator.JobEvaluator {
	if store == nil {
		return nil
	}
	return NewEvaluator(&storeGetters{store: store}, rule)
}

func NewEvaluator(getters Getters, rule *oapi.RetryRule) evaluator.JobEvaluator {
	if getters == nil {
		return nil
	}

	// Default: maxRetries=0 (one attempt only)
	if rule == nil {
		rule = &oapi.RetryRule{
			MaxRetries:      0,
			RetryOnStatuses: nil, // nil = count ALL statuses (strict mode)
			BackoffSeconds:  nil,
		}
		return &RetryEvaluator{
			getters: getters,
			rule:    rule,
		}
	}

	// Smart defaults: Apply ONLY when an explicit policy is configured but retryOnStatuses is not specified
	if rule.RetryOnStatuses == nil || len(*rule.RetryOnStatuses) == 0 {
		defaultStatuses := []oapi.JobStatus{
			oapi.JobStatusFailure,
			oapi.JobStatusInvalidIntegration,
			oapi.JobStatusInvalidJobAgent,
		}

		if rule.MaxRetries == 0 {
			defaultStatuses = append(defaultStatuses, oapi.JobStatusSuccessful)
		}

		rule.RetryOnStatuses = &defaultStatuses
	}

	return &RetryEvaluator{
		getters: getters,
		rule:    rule,
	}
}

// Evaluate checks if the release has exceeded its retry limit or is in backoff period.
// Counts previous consecutive job attempts for this exact release that match the configured
// retryable statuses (e.g., failure, timeout).
//
// Returns:
//   - Denied: If retry limit exceeded
//   - Pending: If in backoff period (includes nextEvaluationTime)
//   - Allowed: If under retry limit and backoff period has elapsed
func (e *RetryEvaluator) Evaluate(
	ctx context.Context,
	release *oapi.Release,
) *oapi.RuleEvaluation {
	releaseTarget := release.ReleaseTarget

	// Get all jobs for this release target
	jobsMap := e.getters.GetJobsForReleaseTarget(&releaseTarget)
	jobs := make([]*oapi.Job, 0, len(jobsMap))
	for _, job := range jobsMap {
		jobs = append(jobs, job)
	}
	sort.Slice(jobs, func(i, j int) bool {
		return jobs[i].CreatedAt.Before(jobs[j].CreatedAt)
	})

	// Build a map of retryable statuses for efficient lookup
	retryableStatuses := e.buildRetryableStatusMap()

	// Count previous consecutive attempts and find most recent retryable job
	attemptCount := 0
	matchingJobIds := make([]string, 0)
	var mostRecentJob *oapi.Job
	var mostRecentTime time.Time

	for _, job := range jobs {
		// Only count jobs for this exact release
		if job.ReleaseId != release.ID() {
			break
		}

		// Check if job status is retryable (or if all statuses count)
		isRetryable := retryableStatuses == nil || retryableStatuses[job.Status]
		if !isRetryable {
			break
		}

		attemptCount++
		matchingJobIds = append(matchingJobIds, job.Id)

		// Track most recent retryable job for backoff calculation
		jobTime := job.CreatedAt
		if job.CompletedAt != nil {
			jobTime = *job.CompletedAt
		}

		if mostRecentJob == nil || jobTime.After(mostRecentTime) {
			mostRecentJob = job
			mostRecentTime = jobTime
		}
	}

	maxRetries := int(e.rule.MaxRetries)

	// Check if we've exceeded the retry limit
	if attemptCount > maxRetries {
		return results.
			NewDeniedResult(
				fmt.Sprintf("Retry limit exceeded (%d/%d attempts)", attemptCount, maxRetries),
			).
			WithDetail("release_id", release.ID()).
			WithDetail("attempt_count", attemptCount).
			WithDetail("max_retries", maxRetries).
			WithDetail("version", release.Version.Tag).
			WithDetail("retryable_job_ids", matchingJobIds).
			WithDetail("retryable_statuses", e.getRetryableStatusStrings())
	}

	// Check backoff period if we have previous attempts
	if attemptCount > 0 && e.rule.BackoffSeconds != nil && *e.rule.BackoffSeconds > 0 && mostRecentJob != nil {
		backoffResult := e.evaluateBackoff(mostRecentJob, attemptCount, release, matchingJobIds)
		if backoffResult != nil {
			return backoffResult
		}
	}

	// Under the retry limit and backoff satisfied - allow job creation
	if attemptCount == 0 {
		return results.
			NewAllowedResult(
				fmt.Sprintf("First attempt (0/%d retries used)", maxRetries),
			).
			WithDetail("release_id", release.ID()).
			WithDetail("max_retries", maxRetries).
			WithDetail("version", release.Version.Tag)
	}

	return results.
		NewAllowedResult(
			fmt.Sprintf("Retry allowed (%d/%d attempts)", attemptCount, maxRetries),
		).
		WithDetail("release_id", release.ID()).
		WithDetail("attempt_count", attemptCount).
		WithDetail("max_retries", maxRetries).
		WithDetail("version", release.Version.Tag).
		WithDetail("retryable_job_ids", matchingJobIds)
}

// buildRetryableStatusMap creates a map of statuses that should count toward retry limit.
// Note: By the time this is called, smart defaults have already been applied in NewEvaluator,
// so retryOnStatuses should always be populated (never nil).
func (e *RetryEvaluator) buildRetryableStatusMap() map[oapi.JobStatus]bool {
	if e.rule.RetryOnStatuses == nil || len(*e.rule.RetryOnStatuses) == 0 {
		// Should not happen after smart defaults are applied in NewEvaluator
		return nil
	}

	statusMap := make(map[oapi.JobStatus]bool)
	for _, status := range *e.rule.RetryOnStatuses {
		statusMap[status] = true
	}
	return statusMap
}

// getRetryableStatusStrings returns the list of retryable statuses as strings for details.
func (e *RetryEvaluator) getRetryableStatusStrings() []string {
	if e.rule.RetryOnStatuses == nil || len(*e.rule.RetryOnStatuses) == 0 {
		return []string{"all"}
	}

	statuses := make([]string, 0, len(*e.rule.RetryOnStatuses))
	for _, status := range *e.rule.RetryOnStatuses {
		statuses = append(statuses, string(status))
	}
	return statuses
}

// evaluateBackoff checks if sufficient time has elapsed since the last attempt.
// Returns a Pending result with nextEvaluationTime if still in backoff period, nil otherwise.
func (e *RetryEvaluator) evaluateBackoff(
	mostRecentJob *oapi.Job,
	attemptCount int,
	release *oapi.Release,
	matchingJobIds []string,
) *oapi.RuleEvaluation {
	// Calculate required backoff duration based on strategy
	backoffSeconds := *e.rule.BackoffSeconds
	backoffDuration := e.calculateBackoffDuration(attemptCount, backoffSeconds)

	// Get the time of the most recent attempt
	mostRecentTime := mostRecentJob.CreatedAt
	if mostRecentJob.CompletedAt != nil {
		mostRecentTime = *mostRecentJob.CompletedAt
	}

	// Calculate when the next retry is allowed
	nextAllowedTime := mostRecentTime.Add(backoffDuration)
	now := time.Now()

	// Check if we're still in the backoff period
	if now.Before(nextAllowedTime) {
		remainingSeconds := int(nextAllowedTime.Sub(now).Seconds())
		return results.
			NewPendingResult(
				"wait",
				fmt.Sprintf("Waiting for retry backoff (%ds remaining)", remainingSeconds),
			).
			WithDetail("release_id", release.ID()).
			WithDetail("attempt_count", attemptCount).
			WithDetail("max_retries", int(e.rule.MaxRetries)).
			WithDetail("version", release.Version.Tag).
			WithDetail("retryable_job_ids", matchingJobIds).
			WithDetail("backoff_seconds", int(backoffDuration.Seconds())).
			WithDetail("remaining_seconds", remainingSeconds).
			WithDetail("most_recent_job_id", mostRecentJob.Id).
			WithDetail("most_recent_job_time", mostRecentTime.Format(time.RFC3339)).
			WithNextEvaluationTime(nextAllowedTime)
	}

	// Backoff period has elapsed
	return nil
}

// calculateBackoffDuration calculates the backoff duration based on the strategy.
// For linear: constant backoffSeconds
// For exponential: backoffSeconds * 2^(attemptCount-1), capped by maxBackoffSeconds
func (e *RetryEvaluator) calculateBackoffDuration(attemptCount int, baseBackoffSeconds int32) time.Duration {
	strategy := oapi.RetryRuleBackoffStrategyLinear
	if e.rule.BackoffStrategy != nil {
		strategy = *e.rule.BackoffStrategy
	}

	var backoffSeconds int32

	switch strategy {
	case oapi.RetryRuleBackoffStrategyExponential:
		// Exponential: backoffSeconds * 2^(attemptCount-1)
		// attemptCount starts at 1, so first retry uses base backoff
		exponent := max(attemptCount-1, 0)
		multiplier := math.Pow(2, float64(exponent))
		backoffSeconds = int32(float64(baseBackoffSeconds) * multiplier)

		// Apply max backoff cap if configured
		if e.rule.MaxBackoffSeconds != nil && backoffSeconds > *e.rule.MaxBackoffSeconds {
			backoffSeconds = *e.rule.MaxBackoffSeconds
		}

	case oapi.RetryRuleBackoffStrategyLinear:
		fallthrough
	default:
		backoffSeconds = baseBackoffSeconds
	}

	return time.Duration(backoffSeconds) * time.Second
}
