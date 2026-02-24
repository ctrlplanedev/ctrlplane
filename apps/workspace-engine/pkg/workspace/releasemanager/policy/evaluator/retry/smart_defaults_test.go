package retry

import (
	"context"
	"testing"
	"time"
	"workspace-engine/pkg/oapi"

	"github.com/stretchr/testify/assert"
)

// =============================================================================
// Smart Default Tests (maxRetries > 0 but no retryOnStatuses specified)
// =============================================================================

func TestRetryEvaluator_SmartDefault_OnlyCountsFailures(t *testing.T) {
	// When maxRetries is set but retryOnStatuses is not specified,
	// it should default to only counting failures and invalidIntegration
	st := setupStoreWithResource(t, "resource-1")
	ctx := context.Background()

	release := createRelease("dep-1", "env-1", "resource-1", "v1", "v1.0.0")
	if err := st.Releases.Upsert(ctx, release); err != nil {
		t.Fatalf("Failed to upsert release: %v", err)
	}

	// Create retry rule with maxRetries but no retryOnStatuses
	maxRetries := int32(2)
	rule := &oapi.RetryRule{
		MaxRetries: maxRetries,
		// retryOnStatuses is nil - should default to [failure, invalidIntegration]
	}
	evaluator := NewEvaluatorFromStore(st, rule)

	// Add a successful job - should NOT count toward retry limit
	completedAt := time.Now()
	st.Jobs.Upsert(ctx, &oapi.Job{
		Id:          "job-1-success",
		ReleaseId:   release.ID(),
		Status:      oapi.JobStatusSuccessful,
		CreatedAt:   time.Now().Add(-5 * time.Minute),
		CompletedAt: &completedAt,
	})

	// Should still allow deployment (successful jobs don't count)
	result := evaluator.Evaluate(ctx, release)
	assert.True(t, result.Allowed, "Should allow after successful job (success doesn't count)")
	assert.Contains(t, result.Message, "0/2")

	// Add a failed job - should count
	st.Jobs.Upsert(ctx, &oapi.Job{
		Id:          "job-2-failure",
		ReleaseId:   release.ID(),
		Status:      oapi.JobStatusFailure,
		CreatedAt:   time.Now().Add(-3 * time.Minute),
		CompletedAt: &completedAt,
	})

	result = evaluator.Evaluate(ctx, release)
	assert.True(t, result.Allowed, "Should allow after 1 failure (1/2 attempts)")
	assert.Contains(t, result.Message, "1/2")
}

func TestRetryEvaluator_SmartDefault_CountsInvalidIntegration(t *testing.T) {
	st := setupStoreWithResource(t, "resource-1")
	ctx := context.Background()

	release := createRelease("dep-1", "env-1", "resource-1", "v1", "v1.0.0")
	if err := st.Releases.Upsert(ctx, release); err != nil {
		t.Fatalf("Failed to upsert release: %v", err)
	}

	maxRetries := int32(1)
	rule := &oapi.RetryRule{
		MaxRetries: maxRetries,
		// retryOnStatuses is nil - should default to [failure, invalidIntegration, invalidJobAgent]
	}
	evaluator := NewEvaluatorFromStore(st, rule)

	// Add an invalidIntegration job - should count
	completedAt := time.Now()
	st.Jobs.Upsert(ctx, &oapi.Job{
		Id:          "job-1-invalid",
		ReleaseId:   release.ID(),
		Status:      oapi.JobStatusInvalidIntegration,
		CreatedAt:   time.Now().Add(-1 * time.Minute),
		CompletedAt: &completedAt,
	})

	result := evaluator.Evaluate(ctx, release)
	assert.True(t, result.Allowed, "Should allow after 1 invalidIntegration (1/1 attempts)")
	assert.Contains(t, result.Message, "1/1")

	// Add another invalidIntegration - should exceed limit
	st.Jobs.Upsert(ctx, &oapi.Job{
		Id:          "job-2-invalid",
		ReleaseId:   release.ID(),
		Status:      oapi.JobStatusInvalidIntegration,
		CreatedAt:   time.Now(),
		CompletedAt: &completedAt,
	})

	result = evaluator.Evaluate(ctx, release)
	assert.False(t, result.Allowed, "Should deny after 2 invalidIntegration (exceeds limit)")
	assert.Contains(t, result.Message, "Retry limit exceeded")
}

func TestRetryEvaluator_SmartDefault_DoesNotCountCancelled(t *testing.T) {
	st := setupStoreWithResource(t, "resource-1")
	ctx := context.Background()

	release := createRelease("dep-1", "env-1", "resource-1", "v1", "v1.0.0")
	if err := st.Releases.Upsert(ctx, release); err != nil {
		t.Fatalf("Failed to upsert release: %v", err)
	}

	maxRetries := int32(1)
	rule := &oapi.RetryRule{
		MaxRetries: maxRetries,
	}
	evaluator := NewEvaluatorFromStore(st, rule)

	// Add multiple cancelled jobs - should NOT count
	completedAt := time.Now()
	st.Jobs.Upsert(ctx, &oapi.Job{
		Id:          "job-1-cancelled",
		ReleaseId:   release.ID(),
		Status:      oapi.JobStatusCancelled,
		CreatedAt:   time.Now().Add(-5 * time.Minute),
		CompletedAt: &completedAt,
	})
	st.Jobs.Upsert(ctx, &oapi.Job{
		Id:          "job-2-cancelled",
		ReleaseId:   release.ID(),
		Status:      oapi.JobStatusCancelled,
		CreatedAt:   time.Now().Add(-3 * time.Minute),
		CompletedAt: &completedAt,
	})

	// Should still allow (cancelled jobs don't count with smart default)
	result := evaluator.Evaluate(ctx, release)
	assert.True(t, result.Allowed, "Should allow deployment (cancelled doesn't count with smart default)")
	assert.Contains(t, result.Message, "0/1")
}

func TestRetryEvaluator_SmartDefault_MixedStatuses(t *testing.T) {
	st := setupStoreWithResource(t, "resource-1")
	ctx := context.Background()

	release := createRelease("dep-1", "env-1", "resource-1", "v1", "v1.0.0")
	if err := st.Releases.Upsert(ctx, release); err != nil {
		t.Fatalf("Failed to upsert release: %v", err)
	}

	maxRetries := int32(2)
	rule := &oapi.RetryRule{
		MaxRetries: maxRetries,
	}
	evaluator := NewEvaluatorFromStore(st, rule)

	completedAt := time.Now()

	// Add jobs in various states - only failure and invalidIntegration should count
	st.Jobs.Upsert(ctx, &oapi.Job{
		Id:          "job-1-success",
		ReleaseId:   release.ID(),
		Status:      oapi.JobStatusSuccessful,
		CreatedAt:   time.Now().Add(-10 * time.Minute),
		CompletedAt: &completedAt,
	})

	st.Jobs.Upsert(ctx, &oapi.Job{
		Id:          "job-2-cancelled",
		ReleaseId:   release.ID(),
		Status:      oapi.JobStatusCancelled,
		CreatedAt:   time.Now().Add(-8 * time.Minute),
		CompletedAt: &completedAt,
	})

	st.Jobs.Upsert(ctx, &oapi.Job{
		Id:          "job-3-failure",
		ReleaseId:   release.ID(),
		Status:      oapi.JobStatusFailure,
		CreatedAt:   time.Now().Add(-6 * time.Minute),
		CompletedAt: &completedAt,
	})

	st.Jobs.Upsert(ctx, &oapi.Job{
		Id:          "job-4-skipped",
		ReleaseId:   release.ID(),
		Status:      oapi.JobStatusSkipped,
		CreatedAt:   time.Now().Add(-4 * time.Minute),
		CompletedAt: &completedAt,
	})

	st.Jobs.Upsert(ctx, &oapi.Job{
		Id:          "job-5-invalid",
		ReleaseId:   release.ID(),
		Status:      oapi.JobStatusInvalidIntegration,
		CreatedAt:   time.Now().Add(-2 * time.Minute),
		CompletedAt: &completedAt,
	})

	// Should count: failure + invalidIntegration = 2 attempts
	result := evaluator.Evaluate(ctx, release)
	assert.True(t, result.Allowed, "Should allow: 2 retryable jobs (failure + invalidIntegration) = 2/2 attempts")
	assert.Contains(t, result.Message, "2/2")

	// Add one more failure - should exceed
	st.Jobs.Upsert(ctx, &oapi.Job{
		Id:          "job-6-failure",
		ReleaseId:   release.ID(),
		Status:      oapi.JobStatusFailure,
		CreatedAt:   time.Now(),
		CompletedAt: &completedAt,
	})

	result = evaluator.Evaluate(ctx, release)
	assert.False(t, result.Allowed, "Should deny: 3 retryable jobs exceeds limit of 2")
	assert.Contains(t, result.Message, "Retry limit exceeded")
	assert.Contains(t, result.Message, "3/2")
}

func TestRetryEvaluator_ExplicitStatuses_OverridesSmartDefault(t *testing.T) {
	// If user explicitly sets retryOnStatuses, it should override the smart default
	st := setupStoreWithResource(t, "resource-1")
	ctx := context.Background()

	release := createRelease("dep-1", "env-1", "resource-1", "v1", "v1.0.0")
	if err := st.Releases.Upsert(ctx, release); err != nil {
		t.Fatalf("Failed to upsert release: %v", err)
	}

	maxRetries := int32(2)
	// Explicitly set to only count cancelled (unusual but tests override)
	retryOnStatuses := []oapi.JobStatus{oapi.JobStatusCancelled}
	rule := &oapi.RetryRule{
		MaxRetries:      maxRetries,
		RetryOnStatuses: &retryOnStatuses,
	}
	evaluator := NewEvaluatorFromStore(st, rule)

	completedAt := time.Now()

	// Add a failure - should NOT count (only cancelled counts)
	st.Jobs.Upsert(ctx, &oapi.Job{
		Id:          "job-1-failure",
		ReleaseId:   release.ID(),
		Status:      oapi.JobStatusFailure,
		CreatedAt:   time.Now().Add(-5 * time.Minute),
		CompletedAt: &completedAt,
	})

	result := evaluator.Evaluate(ctx, release)
	assert.True(t, result.Allowed, "Should allow (failure doesn't count, only cancelled does)")
	assert.Contains(t, result.Message, "0/2")

	// Add cancelled job - should count
	st.Jobs.Upsert(ctx, &oapi.Job{
		Id:          "job-2-cancelled",
		ReleaseId:   release.ID(),
		Status:      oapi.JobStatusCancelled,
		CreatedAt:   time.Now(),
		CompletedAt: &completedAt,
	})

	result = evaluator.Evaluate(ctx, release)
	assert.True(t, result.Allowed, "Should allow after 1 cancelled (1/2 attempts)")
	assert.Contains(t, result.Message, "1/2")
}

func TestRetryEvaluator_ZeroMaxRetries_CountsSuccessfulAndErrors(t *testing.T) {
	// When maxRetries=0, counts failures, invalidIntegration, AND successful
	// But NOT cancelled/skipped (to allow redeployment after cancellation)
	st := setupStoreWithResource(t, "resource-1")
	ctx := context.Background()

	release := createRelease("dep-1", "env-1", "resource-1", "v1", "v1.0.0")
	if err := st.Releases.Upsert(ctx, release); err != nil {
		t.Fatalf("Failed to upsert release: %v", err)
	}

	maxRetries := int32(0)
	rule := &oapi.RetryRule{
		MaxRetries: maxRetries,
	}
	evaluator := NewEvaluatorFromStore(st, rule)

	completedAt := time.Now()

	// Add a successful job - should count (strict mode: successful counts for maxRetries=0)
	st.Jobs.Upsert(ctx, &oapi.Job{
		Id:          "job-1-success",
		ReleaseId:   release.ID(),
		Status:      oapi.JobStatusSuccessful,
		CreatedAt:   time.Now(),
		CompletedAt: &completedAt,
	})

	result := evaluator.Evaluate(ctx, release)
	assert.False(t, result.Allowed, "Should deny: maxRetries=0 means no retries after success")
	assert.Contains(t, result.Message, "Retry limit exceeded")
}

func TestRetryEvaluator_ZeroMaxRetries_AllowsAfterCancelled(t *testing.T) {
	// When maxRetries=0, cancelled jobs should NOT count
	// This allows redeployment after a resource deletion/cancellation
	st := setupStoreWithResource(t, "resource-1")
	ctx := context.Background()

	release := createRelease("dep-1", "env-1", "resource-1", "v1", "v1.0.0")
	if err := st.Releases.Upsert(ctx, release); err != nil {
		t.Fatalf("Failed to upsert release: %v", err)
	}

	maxRetries := int32(0)
	rule := &oapi.RetryRule{
		MaxRetries: maxRetries,
	}
	evaluator := NewEvaluatorFromStore(st, rule)

	completedAt := time.Now()

	// Add a cancelled job - should NOT count
	st.Jobs.Upsert(ctx, &oapi.Job{
		Id:          "job-1-cancelled",
		ReleaseId:   release.ID(),
		Status:      oapi.JobStatusCancelled,
		CreatedAt:   time.Now(),
		CompletedAt: &completedAt,
	})

	result := evaluator.Evaluate(ctx, release)
	assert.True(t, result.Allowed, "Should allow: cancelled jobs don't count, even with maxRetries=0")
	assert.Contains(t, result.Message, "First attempt")
}
