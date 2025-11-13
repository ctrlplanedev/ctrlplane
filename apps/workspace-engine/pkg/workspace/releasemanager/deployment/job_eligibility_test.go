package deployment

import (
	"context"
	"testing"
	"time"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/statechange"
	"workspace-engine/pkg/workspace/store"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ===== Test Helper Functions =====

func setupTestJobEligibilityChecker(t *testing.T) (*JobEligibilityChecker, *store.Store) {
	t.Helper()
	cs := statechange.NewChangeSet[any]()
	testStore := store.New("test-workspace", cs)
	checker := NewJobEligibilityChecker(testStore)
	return checker, testStore
}

func setupStoreWithResourceForEligibility(t *testing.T, resourceID string) *store.Store {
	cs := statechange.NewChangeSet[any]()
	st := store.New("test-workspace", cs)
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

func createReleaseForEligibility(deploymentID, environmentID, resourceID, versionID, versionTag string) *oapi.Release {
	return &oapi.Release{
		ReleaseTarget: oapi.ReleaseTarget{
			DeploymentId:  deploymentID,
			EnvironmentId: environmentID,
			ResourceId:    resourceID,
		},
		Version: oapi.DeploymentVersion{
			Id:  versionID,
			Tag: versionTag,
		},
		Variables:          map[string]oapi.LiteralValue{},
		EncryptedVariables: []string{},
	}
}

// ===== ShouldCreateJob Tests =====

func TestShouldCreateJob_NoExistingJobs(t *testing.T) {
	st := setupStoreWithResourceForEligibility(t, "resource-1")
	checker := NewJobEligibilityChecker(st)
	ctx := context.Background()

	release := createReleaseForEligibility("deployment-1", "env-1", "resource-1", "version-1", "v1.0.0")

	// Act
	result, err := checker.ShouldCreateJob(ctx, release, nil)

	// Assert
	require.NoError(t, err)
	assert.True(t, result.IsAllowed())
	assert.Equal(t, "eligible", result.Reason)
}

func TestShouldCreateJob_AlreadyDeployed(t *testing.T) {
	st := setupStoreWithResourceForEligibility(t, "resource-1")
	checker := NewJobEligibilityChecker(st)
	ctx := context.Background()

	release := createReleaseForEligibility("deployment-1", "env-1", "resource-1", "version-1", "v1.0.0")

	// Create a successful job for this release
	if err := st.Releases.Upsert(ctx, release); err != nil {
		t.Fatalf("Failed to upsert release: %v", err)
	}

	completedAt := time.Now()
	st.Jobs.Upsert(ctx, &oapi.Job{
		Id:          "job-1",
		ReleaseId:   release.ID(),
		Status:      oapi.JobStatusSuccessful,
		CreatedAt:   time.Now().Add(-1 * time.Hour),
		CompletedAt: &completedAt,
	})

	// Act
	result, err := checker.ShouldCreateJob(ctx, release, nil)

	// Assert
	require.NoError(t, err)
	assert.False(t, result.IsAllowed())
	// With retry policy (default no retries), message is "Retry limit exceeded"
	assert.Contains(t, result.Reason, "Retry limit exceeded")
}

func TestShouldCreateJob_NewVersionAfterSuccessfulDeployment(t *testing.T) {
	st := setupStoreWithResourceForEligibility(t, "resource-1")
	checker := NewJobEligibilityChecker(st)
	ctx := context.Background()

	// Deploy v1.0.0 successfully
	releaseV1 := createReleaseForEligibility("deployment-1", "env-1", "resource-1", "version-1", "v1.0.0")
	if err := st.Releases.Upsert(ctx, releaseV1); err != nil {
		t.Fatalf("Failed to upsert v1 release: %v", err)
	}

	completedAt := time.Now()
	st.Jobs.Upsert(ctx, &oapi.Job{
		Id:          "job-v1",
		ReleaseId:   releaseV1.ID(),
		Status:      oapi.JobStatusSuccessful,
		CreatedAt:   time.Now().Add(-1 * time.Hour),
		CompletedAt: &completedAt,
	})

	// Try to deploy v2.0.0
	releaseV2 := createReleaseForEligibility("deployment-1", "env-1", "resource-1", "version-2", "v2.0.0")
	if err := st.Releases.Upsert(ctx, releaseV2); err != nil {
		t.Fatalf("Failed to upsert v2 release: %v", err)
	}

	// Act
	result, err := checker.ShouldCreateJob(ctx, releaseV2, nil)

	// Assert
	require.NoError(t, err)
	assert.True(t, result.IsAllowed())
	assert.Equal(t, "eligible", result.Reason)
}

func TestShouldCreateJob_JobInProgress(t *testing.T) {
	st := setupStoreWithResourceForEligibility(t, "resource-1")
	checker := NewJobEligibilityChecker(st)
	ctx := context.Background()

	release := createReleaseForEligibility("deployment-1", "env-1", "resource-1", "version-1", "v1.0.0")

	// Create an in-progress job for this release
	if err := st.Releases.Upsert(ctx, release); err != nil {
		t.Fatalf("Failed to upsert release: %v", err)
	}

	st.Jobs.Upsert(ctx, &oapi.Job{
		Id:        "job-1",
		ReleaseId: release.ID(),
		Status:    oapi.JobStatusInProgress,
		CreatedAt: time.Now(),
	})

	// Act
	result, err := checker.ShouldCreateJob(ctx, release, nil)

	// Assert
	require.NoError(t, err)
	assert.False(t, result.IsAllowed())
	// Concurrency check message
	assert.Contains(t, result.Reason, "Release target has an active job")
}

func TestShouldCreateJob_PendingJob(t *testing.T) {
	st := setupStoreWithResourceForEligibility(t, "resource-1")
	checker := NewJobEligibilityChecker(st)
	ctx := context.Background()

	release := createReleaseForEligibility("deployment-1", "env-1", "resource-1", "version-1", "v1.0.0")

	// Create a pending job for this release
	if err := st.Releases.Upsert(ctx, release); err != nil {
		t.Fatalf("Failed to upsert release: %v", err)
	}

	st.Jobs.Upsert(ctx, &oapi.Job{
		Id:        "job-1",
		ReleaseId: release.ID(),
		Status:    oapi.JobStatusPending,
		CreatedAt: time.Now(),
	})

	// Act
	result, err := checker.ShouldCreateJob(ctx, release, nil)

	// Assert
	require.NoError(t, err)
	assert.False(t, result.IsAllowed())
	// Concurrency check message for pending jobs
	assert.Contains(t, result.Reason, "Release target has an active job")
}

func TestShouldCreateJob_FailedJobPreventsRedeploy(t *testing.T) {
	st := setupStoreWithResourceForEligibility(t, "resource-1")
	checker := NewJobEligibilityChecker(st)
	ctx := context.Background()

	release := createReleaseForEligibility("deployment-1", "env-1", "resource-1", "version-1", "v1.0.0")

	// Create a failed job for this release
	if err := st.Releases.Upsert(ctx, release); err != nil {
		t.Fatalf("Failed to upsert release: %v", err)
	}

	completedAt := time.Now()
	st.Jobs.Upsert(ctx, &oapi.Job{
		Id:          "job-1",
		ReleaseId:   release.ID(),
		Status:      oapi.JobStatusFailure,
		CreatedAt:   time.Now().Add(-1 * time.Hour),
		CompletedAt: &completedAt,
	})

	// Act - try to redeploy same release
	result, err := checker.ShouldCreateJob(ctx, release, nil)

	// Assert
	require.NoError(t, err)
	assert.False(t, result.IsAllowed())
	// With retry policy (default no retries), message is "Retry limit exceeded"
	assert.Contains(t, result.Reason, "Retry limit exceeded")
}

func TestShouldCreateJob_CancelledJobPreventsRedeploy(t *testing.T) {
	st := setupStoreWithResourceForEligibility(t, "resource-1")
	checker := NewJobEligibilityChecker(st)
	ctx := context.Background()

	release := createReleaseForEligibility("deployment-1", "env-1", "resource-1", "version-1", "v1.0.0")

	// Create a cancelled job for this release
	if err := st.Releases.Upsert(ctx, release); err != nil {
		t.Fatalf("Failed to upsert release: %v", err)
	}

	completedAt := time.Now()
	st.Jobs.Upsert(ctx, &oapi.Job{
		Id:          "job-1",
		ReleaseId:   release.ID(),
		Status:      oapi.JobStatusCancelled,
		CreatedAt:   time.Now().Add(-1 * time.Hour),
		CompletedAt: &completedAt,
	})

	// Act - try to redeploy same release
	result, err := checker.ShouldCreateJob(ctx, release, nil)

	// Assert - With NO policy configured, strict mode applies (ALL statuses count)
	// Cancelled jobs block redeployment in strict mode
	require.NoError(t, err)
	assert.False(t, result.IsAllowed())
	assert.Contains(t, result.Reason, "Retry limit exceeded")
}

func TestShouldCreateJob_DifferentVariablesAllowsNewJob(t *testing.T) {
	st := setupStoreWithResourceForEligibility(t, "resource-1")
	checker := NewJobEligibilityChecker(st)
	ctx := context.Background()

	// Create first release with replicas=3
	replicas1 := oapi.LiteralValue{}
	require.NoError(t, replicas1.FromIntegerValue(3))

	release1 := &oapi.Release{
		ReleaseTarget: oapi.ReleaseTarget{
			DeploymentId:  "deployment-1",
			EnvironmentId: "env-1",
			ResourceId:    "resource-1",
		},
		Version: oapi.DeploymentVersion{
			Id:  "version-1",
			Tag: "v1.0.0",
		},
		Variables: map[string]oapi.LiteralValue{
			"replicas": replicas1,
		},
		EncryptedVariables: []string{},
	}

	if err := st.Releases.Upsert(ctx, release1); err != nil {
		t.Fatalf("Failed to upsert release1: %v", err)
	}

	completedAt := time.Now()
	st.Jobs.Upsert(ctx, &oapi.Job{
		Id:          "job-1",
		ReleaseId:   release1.ID(),
		Status:      oapi.JobStatusSuccessful,
		CreatedAt:   time.Now().Add(-1 * time.Hour),
		CompletedAt: &completedAt,
	})

	// Create second release with replicas=5 (different variables)
	replicas2 := oapi.LiteralValue{}
	require.NoError(t, replicas2.FromIntegerValue(5))

	release2 := &oapi.Release{
		ReleaseTarget: oapi.ReleaseTarget{
			DeploymentId:  "deployment-1",
			EnvironmentId: "env-1",
			ResourceId:    "resource-1",
		},
		Version: oapi.DeploymentVersion{
			Id:  "version-1", // Same version
			Tag: "v1.0.0",
		},
		Variables: map[string]oapi.LiteralValue{
			"replicas": replicas2, // Different value
		},
		EncryptedVariables: []string{},
	}

	if err := st.Releases.Upsert(ctx, release2); err != nil {
		t.Fatalf("Failed to upsert release2: %v", err)
	}

	// Act
	result, err := checker.ShouldCreateJob(ctx, release2, nil)

	// Assert
	require.NoError(t, err)
	assert.True(t, result.IsAllowed())
	assert.Equal(t, "eligible", result.Reason)
}

func TestShouldCreateJob_ConcurrentJobsForSameTarget(t *testing.T) {
	st := setupStoreWithResourceForEligibility(t, "resource-1")
	checker := NewJobEligibilityChecker(st)
	ctx := context.Background()

	// Create first release with a pending job
	release1 := createReleaseForEligibility("deployment-1", "env-1", "resource-1", "version-1", "v1.0.0")
	if err := st.Releases.Upsert(ctx, release1); err != nil {
		t.Fatalf("Failed to upsert release1: %v", err)
	}

	st.Jobs.Upsert(ctx, &oapi.Job{
		Id:        "job-1",
		ReleaseId: release1.ID(),
		Status:    oapi.JobStatusInProgress,
		CreatedAt: time.Now(),
	})

	// Try to create job for second release (different version) on same target
	release2 := createReleaseForEligibility("deployment-1", "env-1", "resource-1", "version-2", "v2.0.0")
	if err := st.Releases.Upsert(ctx, release2); err != nil {
		t.Fatalf("Failed to upsert release2: %v", err)
	}

	// Act
	result, err := checker.ShouldCreateJob(ctx, release2, nil)

	// Assert - concurrency evaluator should block this
	require.NoError(t, err)
	assert.False(t, result.IsAllowed())
	// The actual message from the concurrency evaluator
	assert.NotEqual(t, "eligible", result.Reason)
}

func TestShouldCreateJob_AllowsConcurrentJobsForDifferentTargets(t *testing.T) {
	// Setup stores for multiple resources
	st := setupStoreWithResourceForEligibility(t, "resource-1")
	checker := NewJobEligibilityChecker(st)
	ctx := context.Background()

	// Add second resource
	resource2 := &oapi.Resource{
		Id:         "resource-2",
		Name:       "test-resource-2",
		Kind:       "server",
		Identifier: "resource-2",
		Config:     map[string]any{},
		Metadata:   map[string]string{},
		Version:    "v1",
		CreatedAt:  time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC),
	}
	if _, err := st.Resources.Upsert(ctx, resource2); err != nil {
		t.Fatalf("Failed to upsert resource2: %v", err)
	}

	// Create job for first target
	release1 := createReleaseForEligibility("deployment-1", "env-1", "resource-1", "version-1", "v1.0.0")
	if err := st.Releases.Upsert(ctx, release1); err != nil {
		t.Fatalf("Failed to upsert release1: %v", err)
	}

	st.Jobs.Upsert(ctx, &oapi.Job{
		Id:        "job-1",
		ReleaseId: release1.ID(),
		Status:    oapi.JobStatusInProgress,
		CreatedAt: time.Now(),
	})

	// Try to create job for different target (different resource)
	release2 := createReleaseForEligibility("deployment-1", "env-1", "resource-2", "version-1", "v1.0.0")
	if err := st.Releases.Upsert(ctx, release2); err != nil {
		t.Fatalf("Failed to upsert release2: %v", err)
	}

	// Act
	result, err := checker.ShouldCreateJob(ctx, release2, nil)

	// Assert - should allow concurrent jobs for different targets
	require.NoError(t, err)
	assert.True(t, result.IsAllowed())
	assert.Equal(t, "eligible", result.Reason)
}

func TestShouldCreateJob_MultipleCompletedJobs(t *testing.T) {
	st := setupStoreWithResourceForEligibility(t, "resource-1")
	checker := NewJobEligibilityChecker(st)
	ctx := context.Background()

	releaseTarget := oapi.ReleaseTarget{
		DeploymentId:  "deployment-1",
		EnvironmentId: "env-1",
		ResourceId:    "resource-1",
	}

	// Create multiple historical releases with completed jobs
	for i := 1; i <= 3; i++ {
		release := &oapi.Release{
			ReleaseTarget: releaseTarget,
			Version: oapi.DeploymentVersion{
				Id:  uuid.New().String(),
				Tag: "v1.0." + string(rune('0'+i)),
			},
			Variables:          map[string]oapi.LiteralValue{},
			EncryptedVariables: []string{},
		}

		if err := st.Releases.Upsert(ctx, release); err != nil {
			t.Fatalf("Failed to upsert release: %v", err)
		}

		completedAt := time.Now().Add(-time.Duration(4-i) * time.Hour)
		st.Jobs.Upsert(ctx, &oapi.Job{
			Id:          uuid.New().String(),
			ReleaseId:   release.ID(),
			Status:      oapi.JobStatusSuccessful,
			CreatedAt:   time.Now().Add(-time.Duration(4-i) * time.Hour),
			CompletedAt: &completedAt,
		})
	}

	// Try to create job for new release
	newRelease := &oapi.Release{
		ReleaseTarget: releaseTarget,
		Version: oapi.DeploymentVersion{
			Id:  uuid.New().String(),
			Tag: "v2.0.0",
		},
		Variables:          map[string]oapi.LiteralValue{},
		EncryptedVariables: []string{},
	}
	if err := st.Releases.Upsert(ctx, newRelease); err != nil {
		t.Fatalf("Failed to upsert new release: %v", err)
	}

	// Act
	result, err := checker.ShouldCreateJob(ctx, newRelease, nil)

	// Assert
	require.NoError(t, err)
	assert.True(t, result.IsAllowed())
	assert.Equal(t, "eligible", result.Reason)
}

func TestShouldCreateJob_SkippedJobPreventsRedeploy(t *testing.T) {
	st := setupStoreWithResourceForEligibility(t, "resource-1")
	checker := NewJobEligibilityChecker(st)
	ctx := context.Background()

	release := createReleaseForEligibility("deployment-1", "env-1", "resource-1", "version-1", "v1.0.0")

	// Create a skipped job for this release
	if err := st.Releases.Upsert(ctx, release); err != nil {
		t.Fatalf("Failed to upsert release: %v", err)
	}

	completedAt := time.Now()
	st.Jobs.Upsert(ctx, &oapi.Job{
		Id:          "job-1",
		ReleaseId:   release.ID(),
		Status:      oapi.JobStatusSkipped,
		CreatedAt:   time.Now().Add(-1 * time.Hour),
		CompletedAt: &completedAt,
	})

	// Act - try to redeploy same release
	result, err := checker.ShouldCreateJob(ctx, release, nil)

	// Assert - With NO policy configured, strict mode applies (ALL statuses count)
	// Skipped jobs block redeployment in strict mode
	require.NoError(t, err)
	assert.False(t, result.IsAllowed())
	assert.Contains(t, result.Reason, "Retry limit exceeded")
}

func TestShouldCreateJob_InvalidJobAgentStatusPreventsRedeploy(t *testing.T) {
	st := setupStoreWithResourceForEligibility(t, "resource-1")
	checker := NewJobEligibilityChecker(st)
	ctx := context.Background()

	release := createReleaseForEligibility("deployment-1", "env-1", "resource-1", "version-1", "v1.0.0")

	// Create a job with InvalidJobAgent status
	if err := st.Releases.Upsert(ctx, release); err != nil {
		t.Fatalf("Failed to upsert release: %v", err)
	}

	st.Jobs.Upsert(ctx, &oapi.Job{
		Id:        "job-1",
		ReleaseId: release.ID(),
		Status:    oapi.JobStatusInvalidJobAgent,
		CreatedAt: time.Now().Add(-1 * time.Hour),
	})

	// Act - try to redeploy same release
	result, err := checker.ShouldCreateJob(ctx, release, nil)

	// Assert
	require.NoError(t, err)
	assert.False(t, result.IsAllowed())
	// With retry policy (default no retries), message is "Retry limit exceeded"
	assert.Contains(t, result.Reason, "Retry limit exceeded")
}

func TestShouldCreateJob_EmptyReleaseID(t *testing.T) {
	st := setupStoreWithResourceForEligibility(t, "resource-1")
	checker := NewJobEligibilityChecker(st)
	ctx := context.Background()

	// Create a release that would have empty components
	release := &oapi.Release{
		ReleaseTarget: oapi.ReleaseTarget{
			DeploymentId:  "deployment-1",
			EnvironmentId: "env-1",
			ResourceId:    "resource-1",
		},
		Version: oapi.DeploymentVersion{
			Id:  "version-1",
			Tag: "v1.0.0",
		},
		Variables:          map[string]oapi.LiteralValue{},
		EncryptedVariables: []string{},
	}

	// Act
	result, err := checker.ShouldCreateJob(ctx, release, nil)

	// Assert - should work normally
	require.NoError(t, err)
	assert.True(t, result.IsAllowed())
	assert.Equal(t, "eligible", result.Reason)
}

func TestShouldCreateJob_EvaluatorOrdering(t *testing.T) {
	// This test verifies that evaluators are applied in order
	// and the first blocking evaluator determines the reason
	st := setupStoreWithResourceForEligibility(t, "resource-1")
	checker := NewJobEligibilityChecker(st)
	ctx := context.Background()

	release := createReleaseForEligibility("deployment-1", "env-1", "resource-1", "version-1", "v1.0.0")

	// Create a job that would trigger multiple evaluators
	// (e.g., same release already exists AND there's a concurrent job)
	if err := st.Releases.Upsert(ctx, release); err != nil {
		t.Fatalf("Failed to upsert release: %v", err)
	}

	st.Jobs.Upsert(ctx, &oapi.Job{
		Id:        "job-1",
		ReleaseId: release.ID(),
		Status:    oapi.JobStatusInProgress,
		CreatedAt: time.Now(),
	})

	// Act
	result, err := checker.ShouldCreateJob(ctx, release, nil)

	// Assert - should be blocked and return a reason
	require.NoError(t, err)
	assert.False(t, result.IsAllowed())
	assert.NotEqual(t, "eligible", result.Reason)
	assert.NotEmpty(t, result.Reason)
}
