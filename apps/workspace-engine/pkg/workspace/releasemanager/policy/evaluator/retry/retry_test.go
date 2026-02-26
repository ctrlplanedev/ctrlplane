package retry

import (
	"context"
	"testing"
	"time"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/statechange"
	"workspace-engine/pkg/workspace/store"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Helper function to create a test store with a resource
func setupStoreWithResource(t *testing.T, resourceID string) *store.Store {
	sc := statechange.NewChangeSet[any]()
	st := store.New("test-workspace", sc)
	ctx := context.Background()

	resource := &oapi.Resource{
		Id:         resourceID,
		Name:       "test-resource",
		Kind:       "server",
		Identifier: resourceID,
		Config:     map[string]any{},
		Metadata:   map[string]string{},
		Version:    "v1",
		CreatedAt:  time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC),
	}

	if _, err := st.Resources.Upsert(ctx, resource); err != nil {
		t.Fatalf("Failed to upsert resource: %v", err)
	}
	return st
}

func createRelease(deploymentID, envID, resourceID, versionID, tag string) *oapi.Release {
	return &oapi.Release{
		ReleaseTarget: oapi.ReleaseTarget{
			DeploymentId:  deploymentID,
			EnvironmentId: envID,
			ResourceId:    resourceID,
		},
		Version: oapi.DeploymentVersion{
			Id:  versionID,
			Tag: tag,
		},
	}
}

// =============================================================================
// Default Behavior Tests (nil rule = maxRetries:0, no retries allowed)
// =============================================================================

func TestRetryEvaluator_DefaultBehavior_FirstAttempt(t *testing.T) {
	// Default: maxRetries=0, no backoff, count all statuses
	st := setupStoreWithResource(t, "resource-1")
	ctx := context.Background()

	release := createRelease("dep-1", "env-1", "resource-1", "v1", "v1.0.0")
	if err := st.Releases.Upsert(ctx, release); err != nil {
		t.Fatalf("Failed to upsert release: %v", err)
	}

	// Nil rule = default behavior
	eval := NewEvaluatorFromStore(st, nil)
	result := eval.Evaluate(ctx, release)

	assert.True(t, result.Allowed, "First attempt should be allowed")
	assert.Contains(t, result.Message, "First attempt")
	assert.Equal(t, 0, result.Details["max_retries"])
}

func TestRetryEvaluator_DefaultBehavior_SecondAttemptDenied(t *testing.T) {
	// Default behavior: maxRetries=0, no retries allowed
	st := setupStoreWithResource(t, "resource-1")
	ctx := context.Background()

	release := createRelease("dep-1", "env-1", "resource-1", "v1", "v1.0.0")
	if err := st.Releases.Upsert(ctx, release); err != nil {
		t.Fatalf("Failed to upsert release: %v", err)
	}

	// Create a job for this release
	completedAt := time.Now().Add(-1 * time.Hour)
	st.Jobs.Upsert(ctx, &oapi.Job{
		Id:          "job-1",
		ReleaseId:   release.ID(),
		Status:      oapi.JobStatusFailure,
		CreatedAt:   time.Now().Add(-2 * time.Hour),
		CompletedAt: &completedAt,
	})

	eval := NewEvaluatorFromStore(st, nil)
	result := eval.Evaluate(ctx, release)

	assert.False(t, result.Allowed, "Second attempt should be denied with default behavior")
	assert.Contains(t, result.Message, "Retry limit exceeded")
	assert.Equal(t, 1, result.Details["attempt_count"])
	assert.Equal(t, 0, result.Details["max_retries"])
}

func TestRetryEvaluator_DefaultBehavior_AllStatusesCount(t *testing.T) {
	// Default (nil rule): ALL statuses count including cancelled/skipped (strict mode)
	st := setupStoreWithResource(t, "resource-1")
	ctx := context.Background()

	release := createRelease("dep-1", "env-1", "resource-1", "v1", "v1.0.0")
	if err := st.Releases.Upsert(ctx, release); err != nil {
		t.Fatalf("Failed to upsert release: %v", err)
	}

	// Create job with successful status
	completedAt := time.Now().Add(-1 * time.Hour)
	st.Jobs.Upsert(ctx, &oapi.Job{
		Id:          "job-success",
		ReleaseId:   release.ID(),
		Status:      oapi.JobStatusSuccessful,
		CreatedAt:   time.Now().Add(-2 * time.Hour),
		CompletedAt: &completedAt,
	})

	eval := NewEvaluatorFromStore(st, nil)
	result := eval.Evaluate(ctx, release)

	// Successful jobs count with default behavior (maxRetries=0, no policy)
	assert.False(t, result.Allowed, "Successful job should count in default behavior")

	// With nil rule (no policy), should see "all" statuses
	statusList := result.Details["retryable_statuses"].([]string)
	assert.Contains(t, statusList, "all")
}

// =============================================================================
// Max Retries Tests
// =============================================================================

func TestRetryEvaluator_MaxRetries_Zero(t *testing.T) {
	// maxRetries=0 means 1 attempt total (no retries)
	st := setupStoreWithResource(t, "resource-1")
	ctx := context.Background()

	release := createRelease("dep-1", "env-1", "resource-1", "v1", "v1.0.0")
	if err := st.Releases.Upsert(ctx, release); err != nil {
		t.Fatalf("Failed to upsert release: %v", err)
	}

	rule := &oapi.RetryRule{
		MaxRetries: 0,
	}
	eval := NewEvaluatorFromStore(st, rule)

	// First attempt allowed
	result := eval.Evaluate(ctx, release)
	assert.True(t, result.Allowed)

	// Add a failed job
	completedAt := time.Now()
	st.Jobs.Upsert(ctx, &oapi.Job{
		Id:          "job-1",
		ReleaseId:   release.ID(),
		Status:      oapi.JobStatusFailure,
		CreatedAt:   time.Now(),
		CompletedAt: &completedAt,
	})

	// Second attempt denied
	result = eval.Evaluate(ctx, release)
	assert.False(t, result.Allowed)
	assert.Equal(t, 1, result.Details["attempt_count"])
}

func TestRetryEvaluator_MaxRetries_Three(t *testing.T) {
	// maxRetries=3 means 4 attempts total (1 initial + 3 retries)
	st := setupStoreWithResource(t, "resource-1")
	ctx := context.Background()

	release := createRelease("dep-1", "env-1", "resource-1", "v1", "v1.0.0")
	if err := st.Releases.Upsert(ctx, release); err != nil {
		t.Fatalf("Failed to upsert release: %v", err)
	}

	rule := &oapi.RetryRule{
		MaxRetries: 3,
	}
	eval := NewEvaluatorFromStore(st, rule)

	// Simulate 3 attempts
	for i := 1; i <= 3; i++ {
		completedAt := time.Now()
		st.Jobs.Upsert(ctx, &oapi.Job{
			Id:          "job-" + string(rune(i)),
			ReleaseId:   release.ID(),
			Status:      oapi.JobStatusFailure,
			CreatedAt:   time.Now(),
			CompletedAt: &completedAt,
		})

		result := eval.Evaluate(ctx, release)
		assert.True(t, result.Allowed, "Attempt %d should be allowed", i+1)
		assert.Equal(t, i, result.Details["attempt_count"])
	}

	// Add 4th failed job
	completedAt := time.Now()
	st.Jobs.Upsert(ctx, &oapi.Job{
		Id:          "job-4",
		ReleaseId:   release.ID(),
		Status:      oapi.JobStatusFailure,
		CreatedAt:   time.Now(),
		CompletedAt: &completedAt,
	})

	// 5th attempt should be denied
	result := eval.Evaluate(ctx, release)
	assert.False(t, result.Allowed)
	assert.Contains(t, result.Message, "Retry limit exceeded")
	assert.Equal(t, 4, result.Details["attempt_count"])
	assert.Equal(t, 3, result.Details["max_retries"])
}

// =============================================================================
// Status Filtering Tests
// =============================================================================

func TestRetryEvaluator_RetryOnStatuses_OnlyCountsFailures(t *testing.T) {
	st := setupStoreWithResource(t, "resource-1")
	ctx := context.Background()

	release := createRelease("dep-1", "env-1", "resource-1", "v1", "v1.0.0")
	if err := st.Releases.Upsert(ctx, release); err != nil {
		t.Fatalf("Failed to upsert release: %v", err)
	}

	retryOnStatuses := []oapi.JobStatus{oapi.JobStatusFailure}
	rule := &oapi.RetryRule{
		MaxRetries:      1,
		RetryOnStatuses: &retryOnStatuses,
	}
	eval := NewEvaluatorFromStore(st, rule)

	// Add successful job - should NOT count
	completedAt1 := time.Now().Add(-2 * time.Hour)
	st.Jobs.Upsert(ctx, &oapi.Job{
		Id:          "job-success",
		ReleaseId:   release.ID(),
		Status:      oapi.JobStatusSuccessful,
		CreatedAt:   time.Now().Add(-3 * time.Hour),
		CompletedAt: &completedAt1,
	})

	// Add cancelled job - should NOT count
	completedAt2 := time.Now().Add(-1 * time.Hour)
	st.Jobs.Upsert(ctx, &oapi.Job{
		Id:          "job-cancelled",
		ReleaseId:   release.ID(),
		Status:      oapi.JobStatusCancelled,
		CreatedAt:   time.Now().Add(-90 * time.Minute),
		CompletedAt: &completedAt2,
	})

	// Should still be allowed (no failures yet)
	result := eval.Evaluate(ctx, release)
	assert.True(t, result.Allowed, "Should allow when no matching status jobs")
	assert.Contains(t, result.Message, "First attempt")

	// Add failed job - should count
	completedAt3 := time.Now()
	st.Jobs.Upsert(ctx, &oapi.Job{
		Id:          "job-failed",
		ReleaseId:   release.ID(),
		Status:      oapi.JobStatusFailure,
		CreatedAt:   time.Now(),
		CompletedAt: &completedAt3,
	})

	// Should still allow one more retry
	result = eval.Evaluate(ctx, release)
	assert.True(t, result.Allowed, "Should allow first retry")
	assert.Equal(t, 1, result.Details["attempt_count"])

	// Add second failed job
	completedAt4 := time.Now()
	st.Jobs.Upsert(ctx, &oapi.Job{
		Id:          "job-failed-2",
		ReleaseId:   release.ID(),
		Status:      oapi.JobStatusFailure,
		CreatedAt:   time.Now(),
		CompletedAt: &completedAt4,
	})

	// Now should deny (2 failures > maxRetries of 1)
	result = eval.Evaluate(ctx, release)
	assert.False(t, result.Allowed, "Should deny after retry limit")
	assert.Equal(t, 2, result.Details["attempt_count"])
}

func TestRetryEvaluator_RetryOnStatuses_MultipleStatuses(t *testing.T) {
	st := setupStoreWithResource(t, "resource-1")
	ctx := context.Background()

	release := createRelease("dep-1", "env-1", "resource-1", "v1", "v1.0.0")
	if err := st.Releases.Upsert(ctx, release); err != nil {
		t.Fatalf("Failed to upsert release: %v", err)
	}

	retryOnStatuses := []oapi.JobStatus{
		oapi.JobStatusFailure,
		oapi.JobStatusInvalidJobAgent,
		oapi.JobStatusExternalRunNotFound,
	}
	rule := &oapi.RetryRule{
		MaxRetries:      2,
		RetryOnStatuses: &retryOnStatuses,
	}
	eval := NewEvaluatorFromStore(st, rule)

	// Add jobs with different retryable statuses
	completedAt1 := time.Now().Add(-3 * time.Hour)
	st.Jobs.Upsert(ctx, &oapi.Job{
		Id:          "job-1",
		ReleaseId:   release.ID(),
		Status:      oapi.JobStatusFailure,
		CreatedAt:   time.Now().Add(-4 * time.Hour),
		CompletedAt: &completedAt1,
	})

	completedAt2 := time.Now().Add(-2 * time.Hour)
	st.Jobs.Upsert(ctx, &oapi.Job{
		Id:          "job-2",
		ReleaseId:   release.ID(),
		Status:      oapi.JobStatusInvalidJobAgent,
		CreatedAt:   time.Now().Add(-150 * time.Minute),
		CompletedAt: &completedAt2,
	})

	result := eval.Evaluate(ctx, release)
	assert.True(t, result.Allowed, "Should allow (2 attempts <= 2 max retries)")
	assert.Equal(t, 2, result.Details["attempt_count"])

	// Add third retryable status job
	completedAt3 := time.Now()
	st.Jobs.Upsert(ctx, &oapi.Job{
		Id:          "job-3",
		ReleaseId:   release.ID(),
		Status:      oapi.JobStatusExternalRunNotFound,
		CreatedAt:   time.Now(),
		CompletedAt: &completedAt3,
	})

	result = eval.Evaluate(ctx, release)
	assert.False(t, result.Allowed, "Should deny (3 attempts > 2 max retries)")
	assert.Equal(t, 3, result.Details["attempt_count"])

	// Verify all three job IDs are tracked
	jobIds := result.Details["retryable_job_ids"].([]string)
	assert.Len(t, jobIds, 3)
}

// =============================================================================
// Different Releases Don't Interfere
// =============================================================================

func TestRetryEvaluator_DifferentReleasesIndependent(t *testing.T) {
	st := setupStoreWithResource(t, "resource-1")
	ctx := context.Background()

	release1 := createRelease("dep-1", "env-1", "resource-1", "v1", "v1.0.0")
	release2 := createRelease("dep-1", "env-1", "resource-1", "v2", "v2.0.0")

	if err := st.Releases.Upsert(ctx, release1); err != nil {
		t.Fatalf("Failed to upsert release1: %v", err)
	}
	if err := st.Releases.Upsert(ctx, release2); err != nil {
		t.Fatalf("Failed to upsert release2: %v", err)
	}

	rule := &oapi.RetryRule{
		MaxRetries: 0, // No retries
	}
	eval := NewEvaluatorFromStore(st, rule)

	// Add failed job for release1
	completedAt := time.Now()
	st.Jobs.Upsert(ctx, &oapi.Job{
		Id:          "job-r1",
		ReleaseId:   release1.ID(),
		Status:      oapi.JobStatusFailure,
		CreatedAt:   time.Now(),
		CompletedAt: &completedAt,
	})

	// Release2 should still be allowed (different release)
	result := eval.Evaluate(ctx, release2)
	assert.True(t, result.Allowed, "Different release should not be affected")
	assert.Contains(t, result.Message, "First attempt")
}

// =============================================================================
// Linear Backoff Tests
// =============================================================================

func TestRetryEvaluator_LinearBackoff_StillWaiting(t *testing.T) {
	st := setupStoreWithResource(t, "resource-1")
	ctx := context.Background()

	release := createRelease("dep-1", "env-1", "resource-1", "v1", "v1.0.0")
	if err := st.Releases.Upsert(ctx, release); err != nil {
		t.Fatalf("Failed to upsert release: %v", err)
	}

	backoffSeconds := int32(60)
	backoffStrategy := oapi.RetryRuleBackoffStrategyLinear
	rule := &oapi.RetryRule{
		MaxRetries:      3,
		BackoffSeconds:  &backoffSeconds,
		BackoffStrategy: &backoffStrategy,
	}
	eval := NewEvaluatorFromStore(st, rule)

	// Add job that completed 30 seconds ago
	completedAt := time.Now().Add(-30 * time.Second)
	st.Jobs.Upsert(ctx, &oapi.Job{
		Id:          "job-1",
		ReleaseId:   release.ID(),
		Status:      oapi.JobStatusFailure,
		CreatedAt:   time.Now().Add(-1 * time.Hour),
		CompletedAt: &completedAt,
	})

	result := eval.Evaluate(ctx, release)

	// Should be pending (still in backoff period)
	assert.False(t, result.Allowed, "Should not be allowed during backoff")
	assert.True(t, result.ActionRequired, "Should require action (wait)")
	assert.Contains(t, result.Message, "Waiting for retry backoff")
	assert.NotNil(t, result.NextEvaluationTime, "Should have next evaluation time")

	// Check details
	assert.Equal(t, 1, result.Details["attempt_count"])
	assert.Equal(t, 60, result.Details["backoff_seconds"])
	assert.LessOrEqual(t, result.Details["remaining_seconds"].(int), 30)
	assert.Greater(t, result.Details["remaining_seconds"].(int), 25) // Some time tolerance
}

func TestRetryEvaluator_LinearBackoff_BackoffElapsed(t *testing.T) {
	st := setupStoreWithResource(t, "resource-1")
	ctx := context.Background()

	release := createRelease("dep-1", "env-1", "resource-1", "v1", "v1.0.0")
	if err := st.Releases.Upsert(ctx, release); err != nil {
		t.Fatalf("Failed to upsert release: %v", err)
	}

	backoffSeconds := int32(60)
	backoffStrategy := oapi.RetryRuleBackoffStrategyLinear
	rule := &oapi.RetryRule{
		MaxRetries:      3,
		BackoffSeconds:  &backoffSeconds,
		BackoffStrategy: &backoffStrategy,
	}
	eval := NewEvaluatorFromStore(st, rule)

	// Add job that completed 90 seconds ago (backoff elapsed)
	completedAt := time.Now().Add(-90 * time.Second)
	st.Jobs.Upsert(ctx, &oapi.Job{
		Id:          "job-1",
		ReleaseId:   release.ID(),
		Status:      oapi.JobStatusFailure,
		CreatedAt:   time.Now().Add(-2 * time.Minute),
		CompletedAt: &completedAt,
	})

	result := eval.Evaluate(ctx, release)

	// Should be allowed (backoff elapsed)
	assert.True(t, result.Allowed, "Should be allowed after backoff")
	assert.Contains(t, result.Message, "Retry allowed")
	assert.Equal(t, 1, result.Details["attempt_count"])
}

func TestRetryEvaluator_LinearBackoff_ConstantDelay(t *testing.T) {
	st := setupStoreWithResource(t, "resource-1")
	ctx := context.Background()

	release := createRelease("dep-1", "env-1", "resource-1", "v1", "v1.0.0")
	if err := st.Releases.Upsert(ctx, release); err != nil {
		t.Fatalf("Failed to upsert release: %v", err)
	}

	backoffSeconds := int32(30)
	backoffStrategy := oapi.RetryRuleBackoffStrategyLinear
	rule := &oapi.RetryRule{
		MaxRetries:      5,
		BackoffSeconds:  &backoffSeconds,
		BackoffStrategy: &backoffStrategy,
	}
	eval := NewEvaluatorFromStore(st, rule)

	// Simulate multiple retries with linear backoff
	for i := 1; i <= 3; i++ {
		completedAt := time.Now().Add(-20 * time.Second)
		st.Jobs.Upsert(ctx, &oapi.Job{
			Id:          "job-" + string(rune(i)),
			ReleaseId:   release.ID(),
			Status:      oapi.JobStatusFailure,
			CreatedAt:   time.Now().Add(-1 * time.Minute),
			CompletedAt: &completedAt,
		})

		result := eval.Evaluate(ctx, release)

		// All attempts should have same backoff time (30s)
		if !result.Allowed && result.ActionRequired {
			assert.Equal(t, 30, result.Details["backoff_seconds"], "Linear backoff should be constant")
		}
	}
}

// =============================================================================
// Exponential Backoff Tests
// =============================================================================

func TestRetryEvaluator_ExponentialBackoff_DoublesEachRetry(t *testing.T) {
	st := setupStoreWithResource(t, "resource-1")
	ctx := context.Background()

	release := createRelease("dep-1", "env-1", "resource-1", "v1", "v1.0.0")
	if err := st.Releases.Upsert(ctx, release); err != nil {
		t.Fatalf("Failed to upsert release: %v", err)
	}

	backoffSeconds := int32(30)
	backoffStrategy := oapi.RetryRuleBackoffStrategyExponential
	rule := &oapi.RetryRule{
		MaxRetries:      5,
		BackoffSeconds:  &backoffSeconds,
		BackoffStrategy: &backoffStrategy,
	}
	eval := NewEvaluatorFromStore(st, rule)

	expectedBackoffs := map[int]int{
		1: 30,  // 30 * 2^0
		2: 60,  // 30 * 2^1
		3: 120, // 30 * 2^2
		4: 240, // 30 * 2^3
	}

	for attemptCount := 1; attemptCount <= 4; attemptCount++ {
		// Create attemptCount jobs
		for i := 1; i <= attemptCount; i++ {
			completedAt := time.Now().Add(-10 * time.Second)
			st.Jobs.Upsert(ctx, &oapi.Job{
				Id:          "job-" + string(rune(i)),
				ReleaseId:   release.ID(),
				Status:      oapi.JobStatusFailure,
				CreatedAt:   time.Now().Add(-1 * time.Minute),
				CompletedAt: &completedAt,
			})
		}

		result := eval.Evaluate(ctx, release)

		// Should be in backoff period
		require.False(t, result.Allowed, "Should be in backoff for attempt %d", attemptCount)
		require.True(t, result.ActionRequired, "Should require wait for attempt %d", attemptCount)

		actualBackoff := result.Details["backoff_seconds"].(int)
		expectedBackoff := expectedBackoffs[attemptCount]
		assert.Equal(t, expectedBackoff, actualBackoff,
			"Attempt %d should have backoff of %ds, got %ds",
			attemptCount, expectedBackoff, actualBackoff)

		// Clear jobs for next iteration
		for i := 1; i <= attemptCount; i++ {
			delete(st.Jobs.Items(), "job-"+string(rune(i)))
		}
	}
}

func TestRetryEvaluator_ExponentialBackoff_WithCap(t *testing.T) {
	st := setupStoreWithResource(t, "resource-1")
	ctx := context.Background()

	release := createRelease("dep-1", "env-1", "resource-1", "v1", "v1.0.0")
	if err := st.Releases.Upsert(ctx, release); err != nil {
		t.Fatalf("Failed to upsert release: %v", err)
	}

	backoffSeconds := int32(30)
	maxBackoffSeconds := int32(100)
	backoffStrategy := oapi.RetryRuleBackoffStrategyExponential
	rule := &oapi.RetryRule{
		MaxRetries:        5,
		BackoffSeconds:    &backoffSeconds,
		BackoffStrategy:   &backoffStrategy,
		MaxBackoffSeconds: &maxBackoffSeconds,
	}
	eval := NewEvaluatorFromStore(st, rule)

	// Create 4 attempts: 30, 60, 120, 240 -> but 240 should be capped at 100
	for i := 1; i <= 4; i++ {
		completedAt := time.Now().Add(-5 * time.Second)
		st.Jobs.Upsert(ctx, &oapi.Job{
			Id:          "job-" + string(rune(i)),
			ReleaseId:   release.ID(),
			Status:      oapi.JobStatusFailure,
			CreatedAt:   time.Now().Add(-1 * time.Minute),
			CompletedAt: &completedAt,
		})
	}

	result := eval.Evaluate(ctx, release)

	// Backoff should be capped at 100, not 240 (30 * 2^3)
	assert.False(t, result.Allowed)
	assert.Equal(t, 100, result.Details["backoff_seconds"], "Should be capped at maxBackoffSeconds")
}

// =============================================================================
// No Backoff Tests
// =============================================================================

func TestRetryEvaluator_NoBackoff_ImmediateRetry(t *testing.T) {
	st := setupStoreWithResource(t, "resource-1")
	ctx := context.Background()

	release := createRelease("dep-1", "env-1", "resource-1", "v1", "v1.0.0")
	if err := st.Releases.Upsert(ctx, release); err != nil {
		t.Fatalf("Failed to upsert release: %v", err)
	}

	rule := &oapi.RetryRule{
		MaxRetries:     3,
		BackoffSeconds: nil, // No backoff
	}
	eval := NewEvaluatorFromStore(st, rule)

	// Add job that just completed
	completedAt := time.Now().Add(-1 * time.Second)
	st.Jobs.Upsert(ctx, &oapi.Job{
		Id:          "job-1",
		ReleaseId:   release.ID(),
		Status:      oapi.JobStatusFailure,
		CreatedAt:   time.Now().Add(-1 * time.Minute),
		CompletedAt: &completedAt,
	})

	result := eval.Evaluate(ctx, release)

	// Should be allowed immediately (no backoff)
	assert.True(t, result.Allowed, "Should allow immediate retry when no backoff configured")
	assert.Contains(t, result.Message, "Retry allowed")
}

// =============================================================================
// Backoff Timing Tests
// =============================================================================

func TestRetryEvaluator_Backoff_UsesCompletedAt(t *testing.T) {
	st := setupStoreWithResource(t, "resource-1")
	ctx := context.Background()

	release := createRelease("dep-1", "env-1", "resource-1", "v1", "v1.0.0")
	if err := st.Releases.Upsert(ctx, release); err != nil {
		t.Fatalf("Failed to upsert release: %v", err)
	}

	backoffSeconds := int32(60)
	rule := &oapi.RetryRule{
		MaxRetries:     3,
		BackoffSeconds: &backoffSeconds,
	}
	eval := NewEvaluatorFromStore(st, rule)

	// Job created 2 hours ago but completed 30 seconds ago
	completedAt := time.Now().Add(-30 * time.Second)
	st.Jobs.Upsert(ctx, &oapi.Job{
		Id:          "job-1",
		ReleaseId:   release.ID(),
		Status:      oapi.JobStatusFailure,
		CreatedAt:   time.Now().Add(-2 * time.Hour),
		CompletedAt: &completedAt,
	})

	result := eval.Evaluate(ctx, release)

	// Should still be waiting (uses completedAt, not createdAt)
	assert.False(t, result.Allowed)
	assert.Contains(t, result.Message, "Waiting for retry backoff")
	assert.LessOrEqual(t, result.Details["remaining_seconds"].(int), 30)
}

func TestRetryEvaluator_Backoff_FallsBackToCreatedAt(t *testing.T) {
	st := setupStoreWithResource(t, "resource-1")
	ctx := context.Background()

	release := createRelease("dep-1", "env-1", "resource-1", "v1", "v1.0.0")
	if err := st.Releases.Upsert(ctx, release); err != nil {
		t.Fatalf("Failed to upsert release: %v", err)
	}

	backoffSeconds := int32(60)
	retryOnStatuses := []oapi.JobStatus{oapi.JobStatusInProgress, oapi.JobStatusFailure}
	rule := &oapi.RetryRule{
		MaxRetries:      3,
		BackoffSeconds:  &backoffSeconds,
		RetryOnStatuses: &retryOnStatuses, // Explicitly include InProgress to test backoff fallback logic
	}
	eval := NewEvaluatorFromStore(st, rule)

	// Job with no completedAt (still running)
	st.Jobs.Upsert(ctx, &oapi.Job{
		Id:          "job-1",
		ReleaseId:   release.ID(),
		Status:      oapi.JobStatusInProgress,
		CreatedAt:   time.Now().Add(-30 * time.Second),
		CompletedAt: nil, // No completion time
	})

	result := eval.Evaluate(ctx, release)

	// Should still be waiting (uses createdAt as fallback)
	assert.False(t, result.Allowed)
	assert.Contains(t, result.Message, "Waiting for retry backoff")
}

func TestRetryEvaluator_Backoff_NextEvaluationTime(t *testing.T) {
	st := setupStoreWithResource(t, "resource-1")
	ctx := context.Background()

	release := createRelease("dep-1", "env-1", "resource-1", "v1", "v1.0.0")
	if err := st.Releases.Upsert(ctx, release); err != nil {
		t.Fatalf("Failed to upsert release: %v", err)
	}

	backoffSeconds := int32(120)
	rule := &oapi.RetryRule{
		MaxRetries:     3,
		BackoffSeconds: &backoffSeconds,
	}
	eval := NewEvaluatorFromStore(st, rule)

	completedAt := time.Now().Add(-60 * time.Second)
	st.Jobs.Upsert(ctx, &oapi.Job{
		Id:          "job-1",
		ReleaseId:   release.ID(),
		Status:      oapi.JobStatusFailure,
		CreatedAt:   time.Now().Add(-2 * time.Minute),
		CompletedAt: &completedAt,
	})

	result := eval.Evaluate(ctx, release)

	// Verify nextEvaluationTime is set correctly
	require.NotNil(t, result.NextEvaluationTime)

	expectedNextEval := completedAt.Add(120 * time.Second)
	actualNextEval := *result.NextEvaluationTime

	// Allow 1 second tolerance for test execution time
	diff := actualNextEval.Sub(expectedNextEval).Abs()
	assert.LessOrEqual(t, diff, 1*time.Second, "NextEvaluationTime should be approximately 60s from now")
}

// =============================================================================
// Backoff with Status Filtering Tests
// =============================================================================

func TestRetryEvaluator_Backoff_OnlyForRetryableStatuses(t *testing.T) {
	st := setupStoreWithResource(t, "resource-1")
	ctx := context.Background()

	release := createRelease("dep-1", "env-1", "resource-1", "v1", "v1.0.0")
	if err := st.Releases.Upsert(ctx, release); err != nil {
		t.Fatalf("Failed to upsert release: %v", err)
	}

	backoffSeconds := int32(60)
	retryOnStatuses := []oapi.JobStatus{oapi.JobStatusFailure}
	rule := &oapi.RetryRule{
		MaxRetries:      3,
		BackoffSeconds:  &backoffSeconds,
		RetryOnStatuses: &retryOnStatuses,
	}
	eval := NewEvaluatorFromStore(st, rule)

	// Add successful job (not retryable)
	completedAt1 := time.Now().Add(-5 * time.Second)
	st.Jobs.Upsert(ctx, &oapi.Job{
		Id:          "job-success",
		ReleaseId:   release.ID(),
		Status:      oapi.JobStatusSuccessful,
		CreatedAt:   time.Now().Add(-1 * time.Hour),
		CompletedAt: &completedAt1,
	})

	// Should be allowed immediately (successful job doesn't count)
	result := eval.Evaluate(ctx, release)
	assert.True(t, result.Allowed, "Non-retryable status should not trigger backoff")

	// Add failed job (retryable)
	completedAt2 := time.Now().Add(-5 * time.Second)
	st.Jobs.Upsert(ctx, &oapi.Job{
		Id:          "job-failed",
		ReleaseId:   release.ID(),
		Status:      oapi.JobStatusFailure,
		CreatedAt:   time.Now().Add(-10 * time.Second),
		CompletedAt: &completedAt2,
	})

	// Now should be in backoff (failed job counts)
	result = eval.Evaluate(ctx, release)
	assert.False(t, result.Allowed, "Retryable status should trigger backoff")
	assert.Contains(t, result.Message, "Waiting for retry backoff")
	assert.Equal(t, "job-failed", result.Details["most_recent_job_id"])
}

// =============================================================================
// Newest-First Sort Order Tests (version flipping)
// =============================================================================

func TestRetryEvaluator_VersionFlip_AllowsRedeployAfterDifferentRelease(t *testing.T) {
	// When versions flip (v1 → v2 → v1), the retry evaluator must only count
	// consecutive jobs for the CURRENT release from newest to oldest.
	// Jobs for other releases in between should break the streak, resetting the count.
	st := setupStoreWithResource(t, "resource-1")
	ctx := context.Background()

	releaseV1 := createRelease("dep-1", "env-1", "resource-1", "v1", "v1.0.0")
	releaseV2 := createRelease("dep-1", "env-1", "resource-1", "v2", "v2.0.0")

	if err := st.Releases.Upsert(ctx, releaseV1); err != nil {
		t.Fatalf("Failed to upsert releaseV1: %v", err)
	}
	if err := st.Releases.Upsert(ctx, releaseV2); err != nil {
		t.Fatalf("Failed to upsert releaseV2: %v", err)
	}

	eval := NewEvaluatorFromStore(st, nil)

	// Job 1: v1 deployed successfully (oldest)
	completedAt1 := time.Now().Add(-3 * time.Hour)
	st.Jobs.Upsert(ctx, &oapi.Job{
		Id:          "job-v1-first",
		ReleaseId:   releaseV1.ID(),
		Status:      oapi.JobStatusSuccessful,
		CreatedAt:   time.Now().Add(-4 * time.Hour),
		CompletedAt: &completedAt1,
	})

	// Job 2: v2 deployed successfully (middle)
	completedAt2 := time.Now().Add(-2 * time.Hour)
	st.Jobs.Upsert(ctx, &oapi.Job{
		Id:          "job-v2",
		ReleaseId:   releaseV2.ID(),
		Status:      oapi.JobStatusSuccessful,
		CreatedAt:   time.Now().Add(-150 * time.Minute),
		CompletedAt: &completedAt2,
	})

	// Now we want to redeploy v1: the most recent job is for v2,
	// so the consecutive count for v1 should be 0 → first attempt → allowed
	result := eval.Evaluate(ctx, releaseV1)
	assert.True(t, result.Allowed, "Should allow v1 redeploy after v2 was deployed in between")
	assert.Contains(t, result.Message, "First attempt")
}

func TestRetryEvaluator_VersionFlip_CountsOnlyLatestConsecutiveJobs(t *testing.T) {
	// Verifies that with maxRetries=2, only the most recent consecutive jobs
	// for the current release are counted, ignoring older jobs separated by
	// a different release.
	st := setupStoreWithResource(t, "resource-1")
	ctx := context.Background()

	releaseV1 := createRelease("dep-1", "env-1", "resource-1", "v1", "v1.0.0")
	releaseV2 := createRelease("dep-1", "env-1", "resource-1", "v2", "v2.0.0")

	if err := st.Releases.Upsert(ctx, releaseV1); err != nil {
		t.Fatalf("Failed to upsert releaseV1: %v", err)
	}
	if err := st.Releases.Upsert(ctx, releaseV2); err != nil {
		t.Fatalf("Failed to upsert releaseV2: %v", err)
	}

	rule := &oapi.RetryRule{MaxRetries: 2}
	eval := NewEvaluatorFromStore(st, rule)

	// Old v1 job (should be ignored because v2 job separates it)
	completedAt1 := time.Now().Add(-5 * time.Hour)
	st.Jobs.Upsert(ctx, &oapi.Job{
		Id:          "job-v1-old",
		ReleaseId:   releaseV1.ID(),
		Status:      oapi.JobStatusFailure,
		CreatedAt:   time.Now().Add(-6 * time.Hour),
		CompletedAt: &completedAt1,
	})

	// v2 job in between
	completedAt2 := time.Now().Add(-3 * time.Hour)
	st.Jobs.Upsert(ctx, &oapi.Job{
		Id:          "job-v2",
		ReleaseId:   releaseV2.ID(),
		Status:      oapi.JobStatusSuccessful,
		CreatedAt:   time.Now().Add(-4 * time.Hour),
		CompletedAt: &completedAt2,
	})

	// Recent v1 job (only this one should count)
	completedAt3 := time.Now().Add(-1 * time.Hour)
	st.Jobs.Upsert(ctx, &oapi.Job{
		Id:          "job-v1-recent",
		ReleaseId:   releaseV1.ID(),
		Status:      oapi.JobStatusFailure,
		CreatedAt:   time.Now().Add(-2 * time.Hour),
		CompletedAt: &completedAt3,
	})

	result := eval.Evaluate(ctx, releaseV1)
	assert.True(t, result.Allowed, "Should allow retry (only 1 consecutive attempt, max is 2)")
	assert.Equal(t, 1, result.Details["attempt_count"])
}

func TestRetryEvaluator_VersionFlip_DeniesWhenConsecutiveExceedsLimit(t *testing.T) {
	// After flipping back to v1, if consecutive v1 jobs exceed the retry limit,
	// it should be denied.
	st := setupStoreWithResource(t, "resource-1")
	ctx := context.Background()

	releaseV1 := createRelease("dep-1", "env-1", "resource-1", "v1", "v1.0.0")
	releaseV2 := createRelease("dep-1", "env-1", "resource-1", "v2", "v2.0.0")

	if err := st.Releases.Upsert(ctx, releaseV1); err != nil {
		t.Fatalf("Failed to upsert releaseV1: %v", err)
	}
	if err := st.Releases.Upsert(ctx, releaseV2); err != nil {
		t.Fatalf("Failed to upsert releaseV2: %v", err)
	}

	rule := &oapi.RetryRule{MaxRetries: 1}
	eval := NewEvaluatorFromStore(st, rule)

	// v2 job (old, will be skipped because newer v1 jobs come after)
	completedAt1 := time.Now().Add(-5 * time.Hour)
	st.Jobs.Upsert(ctx, &oapi.Job{
		Id:          "job-v2",
		ReleaseId:   releaseV2.ID(),
		Status:      oapi.JobStatusSuccessful,
		CreatedAt:   time.Now().Add(-6 * time.Hour),
		CompletedAt: &completedAt1,
	})

	// Two consecutive v1 jobs (most recent)
	completedAt2 := time.Now().Add(-2 * time.Hour)
	st.Jobs.Upsert(ctx, &oapi.Job{
		Id:          "job-v1-a",
		ReleaseId:   releaseV1.ID(),
		Status:      oapi.JobStatusFailure,
		CreatedAt:   time.Now().Add(-3 * time.Hour),
		CompletedAt: &completedAt2,
	})

	completedAt3 := time.Now().Add(-1 * time.Hour)
	st.Jobs.Upsert(ctx, &oapi.Job{
		Id:          "job-v1-b",
		ReleaseId:   releaseV1.ID(),
		Status:      oapi.JobStatusFailure,
		CreatedAt:   time.Now().Add(-90 * time.Minute),
		CompletedAt: &completedAt3,
	})

	result := eval.Evaluate(ctx, releaseV1)
	assert.False(t, result.Allowed, "Should deny (2 consecutive v1 attempts > maxRetries=1)")
	assert.Contains(t, result.Message, "Retry limit exceeded")
	assert.Equal(t, 2, result.Details["attempt_count"])
}

func TestRetryEvaluator_VersionFlip_MultipleFlips(t *testing.T) {
	// Simulate multiple version flips: v1 → v2 → v1 → v2
	// Each flip should reset the consecutive count.
	st := setupStoreWithResource(t, "resource-1")
	ctx := context.Background()

	releaseV1 := createRelease("dep-1", "env-1", "resource-1", "v1", "v1.0.0")
	releaseV2 := createRelease("dep-1", "env-1", "resource-1", "v2", "v2.0.0")

	if err := st.Releases.Upsert(ctx, releaseV1); err != nil {
		t.Fatalf("Failed to upsert releaseV1: %v", err)
	}
	if err := st.Releases.Upsert(ctx, releaseV2); err != nil {
		t.Fatalf("Failed to upsert releaseV2: %v", err)
	}

	eval := NewEvaluatorFromStore(st, nil)

	// v1 → v2 → v1 → v2 (each successful)
	completedAt1 := time.Now().Add(-4 * time.Hour)
	st.Jobs.Upsert(ctx, &oapi.Job{
		Id: "job-1-v1", ReleaseId: releaseV1.ID(), Status: oapi.JobStatusSuccessful,
		CreatedAt: time.Now().Add(-5 * time.Hour), CompletedAt: &completedAt1,
	})
	completedAt2 := time.Now().Add(-3 * time.Hour)
	st.Jobs.Upsert(ctx, &oapi.Job{
		Id: "job-2-v2", ReleaseId: releaseV2.ID(), Status: oapi.JobStatusSuccessful,
		CreatedAt: time.Now().Add(-210 * time.Minute), CompletedAt: &completedAt2,
	})
	completedAt3 := time.Now().Add(-2 * time.Hour)
	st.Jobs.Upsert(ctx, &oapi.Job{
		Id: "job-3-v1", ReleaseId: releaseV1.ID(), Status: oapi.JobStatusSuccessful,
		CreatedAt: time.Now().Add(-150 * time.Minute), CompletedAt: &completedAt3,
	})
	completedAt4 := time.Now().Add(-1 * time.Hour)
	st.Jobs.Upsert(ctx, &oapi.Job{
		Id: "job-4-v2", ReleaseId: releaseV2.ID(), Status: oapi.JobStatusSuccessful,
		CreatedAt: time.Now().Add(-90 * time.Minute), CompletedAt: &completedAt4,
	})

	// Most recent is v2 → evaluating v1 should see 0 consecutive → first attempt
	resultV1 := eval.Evaluate(ctx, releaseV1)
	assert.True(t, resultV1.Allowed, "v1 should be allowed (most recent job is v2)")
	assert.Contains(t, resultV1.Message, "First attempt")

	// Most recent is v2 → evaluating v2 should see 1 consecutive → denied (maxRetries=0)
	resultV2 := eval.Evaluate(ctx, releaseV2)
	assert.False(t, resultV2.Allowed, "v2 should be denied (most recent job matches, maxRetries=0)")
}

// =============================================================================
// Edge Cases
// =============================================================================

func TestRetryEvaluator_NilStore_ReturnsNil(t *testing.T) {
	rule := &oapi.RetryRule{
		MaxRetries: 3,
	}
	eval := NewEvaluatorFromStore(nil, rule)
	assert.Nil(t, eval, "Should return nil for nil store")
}

func TestRetryEvaluator_MultipleJobsSameRelease_FindsMostRecent(t *testing.T) {
	st := setupStoreWithResource(t, "resource-1")
	ctx := context.Background()

	release := createRelease("dep-1", "env-1", "resource-1", "v1", "v1.0.0")
	if err := st.Releases.Upsert(ctx, release); err != nil {
		t.Fatalf("Failed to upsert release: %v", err)
	}

	backoffSeconds := int32(60)
	rule := &oapi.RetryRule{
		MaxRetries:     3,
		BackoffSeconds: &backoffSeconds,
	}
	eval := NewEvaluatorFromStore(st, rule)

	// Add older job
	oldCompletedAt := time.Now().Add(-2 * time.Hour)
	st.Jobs.Upsert(ctx, &oapi.Job{
		Id:          "job-old",
		ReleaseId:   release.ID(),
		Status:      oapi.JobStatusFailure,
		CreatedAt:   time.Now().Add(-3 * time.Hour),
		CompletedAt: &oldCompletedAt,
	})

	// Add recent job (30s ago)
	recentCompletedAt := time.Now().Add(-30 * time.Second)
	st.Jobs.Upsert(ctx, &oapi.Job{
		Id:          "job-recent",
		ReleaseId:   release.ID(),
		Status:      oapi.JobStatusFailure,
		CreatedAt:   time.Now().Add(-1 * time.Minute),
		CompletedAt: &recentCompletedAt,
	})

	result := eval.Evaluate(ctx, release)

	// Should use most recent job for backoff calculation
	assert.False(t, result.Allowed, "Should be in backoff period")
	assert.Equal(t, "job-recent", result.Details["most_recent_job_id"])
	assert.LessOrEqual(t, result.Details["remaining_seconds"].(int), 30)
}
