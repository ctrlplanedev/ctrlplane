package skipdeployed

import (
	"context"
	"testing"
	"time"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/store"
)

// Helper function to create a test store with a resource
func setupStoreWithResource(t *testing.T, resourceID string) *store.Store {
	st := store.New("test-workspace")
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

func TestSkipDeployedEvaluator_NoPreviousDeployment(t *testing.T) {
	// Setup: No previous jobs
	st := setupStoreWithResource(t, "resource-1")
	evaluator := NewSkipDeployedEvaluator(st)

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
	}

	// Act
	result, err := evaluator.Evaluate(context.Background(), release)

	// Assert
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if !result.Allowed {
		t.Errorf("expected allowed when no previous deployment, got denied: %s", result.Message)
	}

	if result.Message != "No previous deployment found" {
		t.Errorf("expected 'No previous deployment found', got '%s'", result.Message)
	}
}

func TestSkipDeployedEvaluator_PreviousDeploymentFailed(t *testing.T) {
	// Setup: Previous deployment failed
	st := setupStoreWithResource(t, "resource-1")
	ctx := context.Background()

	releaseTarget := &oapi.ReleaseTarget{
		DeploymentId:  "deployment-1",
		EnvironmentId: "env-1",
		ResourceId:    "resource-1",
	}

	previousRelease := &oapi.Release{
		ReleaseTarget: *releaseTarget,
		Version: oapi.DeploymentVersion{
			Id:  "version-1",
			Tag: "v1.0.0",
		},
	}

	// Create failed job with completion time
	completedAt := time.Now()
	if err := st.Releases.Upsert(ctx, previousRelease); err != nil {
		t.Fatalf("Failed to upsert previous release: %v", err)
	}
	st.Jobs.Upsert(ctx, &oapi.Job{
		Id:          "job-1",
		ReleaseId:   previousRelease.ID(),
		Status:      oapi.Failure,
		CreatedAt:   time.Now().Add(-1 * time.Hour),
		CompletedAt: &completedAt,
	})

	evaluator := NewSkipDeployedEvaluator(st)

	// Act: Try to deploy same release again
	result, err := evaluator.Evaluate(ctx, previousRelease)

	// Assert: Should DENY retry because failed jobs are now considered (validJobStatuses filter removed)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if result.Allowed {
		t.Errorf("expected denied for retry after failure (failed jobs are now tracked), got allowed: %s", result.Message)
	}

	if result.Details["existing_job_id"] != "job-1" {
		t.Errorf("expected existing_job_id=job-1, got %v", result.Details["existing_job_id"])
	}

	if result.Details["job_status"] != string(oapi.Failure) {
		t.Errorf("expected job_status=failure, got %v", result.Details["job_status"])
	}
}

func TestSkipDeployedEvaluator_AlreadyDeployed(t *testing.T) {
	// Setup: Previous successful deployment of same release
	st := setupStoreWithResource(t, "resource-1")
	ctx := context.Background()

	releaseTarget := &oapi.ReleaseTarget{
		DeploymentId:  "deployment-1",
		EnvironmentId: "env-1",
		ResourceId:    "resource-1",
	}

	deployedRelease := &oapi.Release{
		ReleaseTarget: *releaseTarget,
		Version: oapi.DeploymentVersion{
			Id:  "version-1",
			Tag: "v1.0.0",
		},
	}

	// Create successful job with completion time
	completedAt := time.Now()
	if err := st.Releases.Upsert(ctx, deployedRelease); err != nil {
		t.Fatalf("Failed to upsert deployed release: %v", err)
	}
	st.Jobs.Upsert(ctx, &oapi.Job{
		Id:          "job-1",
		ReleaseId:   deployedRelease.ID(),
		Status:      oapi.Successful,
		CreatedAt:   time.Now().Add(-1 * time.Hour),
		CompletedAt: &completedAt,
	})

	evaluator := NewSkipDeployedEvaluator(st)

	// Act: Try to deploy same release again
	result, err := evaluator.Evaluate(ctx, deployedRelease)

	// Assert: Should deny re-deployment
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if result.Allowed {
		t.Errorf("expected denied when already deployed, got allowed: %s", result.Message)
	}

	if result.Details["existing_job_id"] != "job-1" {
		t.Errorf("expected existing_job_id=job-1, got %v", result.Details["existing_job_id"])
	}

	if result.Details["version"] != "v1.0.0" {
		t.Errorf("expected version=v1.0.0, got %v", result.Details["version"])
	}

	if result.Details["job_status"] != string(oapi.Successful) {
		t.Errorf("expected job_status=SUCCESSFUL, got %v", result.Details["job_status"])
	}
}

func TestSkipDeployedEvaluator_NewVersionAfterSuccessful(t *testing.T) {
	// Setup: v1.0.0 deployed successfully, now deploying v2.0.0
	st := setupStoreWithResource(t, "resource-1")
	ctx := context.Background()

	releaseTarget := &oapi.ReleaseTarget{
		DeploymentId:  "deployment-1",
		EnvironmentId: "env-1",
		ResourceId:    "resource-1",
	}

	// v1.0.0 deployed
	v1Release := &oapi.Release{
		ReleaseTarget: *releaseTarget,
		Version: oapi.DeploymentVersion{
			Id:  "version-1",
			Tag: "v1.0.0",
		},
	}

	completedAt := time.Now().Add(-1 * time.Hour)
	if err := st.Releases.Upsert(ctx, v1Release); err != nil {
		t.Fatalf("Failed to upsert v1 release: %v", err)
	}
	st.Jobs.Upsert(ctx, &oapi.Job{
		Id:          "job-v1",
		ReleaseId:   v1Release.ID(),
		Status:      oapi.Successful,
		CreatedAt:   time.Now().Add(-2 * time.Hour),
		CompletedAt: &completedAt,
	})

	// v2.0.0 to deploy
	v2Release := &oapi.Release{
		ReleaseTarget: *releaseTarget,
		Version: oapi.DeploymentVersion{
			Id:  "version-2",
			Tag: "v2.0.0",
		},
	}
	if err := st.Releases.Upsert(ctx, v2Release); err != nil {
		t.Fatalf("Failed to upsert v2 release: %v", err)
	}

	evaluator := NewSkipDeployedEvaluator(st)

	// Act: Try to deploy v2.0.0
	result, err := evaluator.Evaluate(ctx, v2Release)

	// Assert: Should allow deploying new version
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if !result.Allowed {
		t.Errorf("expected allowed for new version, got denied: %s", result.Message)
	}

	if result.Details["previous_release_id"] != v1Release.ID() {
		t.Errorf("expected previous_release_id=%s, got %v", v1Release.ID(), result.Details["previous_release_id"])
	}
}

func TestSkipDeployedEvaluator_JobInProgressNotSuccessful(t *testing.T) {
	// Setup: Previous job is in progress
	st := setupStoreWithResource(t, "resource-1")
	ctx := context.Background()

	releaseTarget := &oapi.ReleaseTarget{
		DeploymentId:  "deployment-1",
		EnvironmentId: "env-1",
		ResourceId:    "resource-1",
	}

	release := &oapi.Release{
		ReleaseTarget: *releaseTarget,
		Version: oapi.DeploymentVersion{
			Id:  "version-1",
			Tag: "v1.0.0",
		},
	}

	// Create in-progress job
	if err := st.Releases.Upsert(ctx, release); err != nil {
		t.Fatalf("Failed to upsert release: %v", err)
	}
	st.Jobs.Upsert(ctx, &oapi.Job{
		Id:        "job-1",
		ReleaseId: release.ID(),
		Status:    oapi.InProgress,
		CreatedAt: time.Now(),
	})

	evaluator := NewSkipDeployedEvaluator(st)

	// Act: Check same release
	result, err := evaluator.Evaluate(ctx, release)

	// Assert: Should DENY - same release already has a job, even if in progress
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if result.Allowed {
		t.Errorf("expected denied when same release job in progress, got allowed: %s", result.Message)
	}

	if result.Details["job_status"] != string(oapi.InProgress) {
		t.Errorf("expected job_status to be IN_PROGRESS, got %v", result.Details["job_status"])
	}

	if result.Details["existing_job_id"] != "job-1" {
		t.Errorf("expected existing_job_id=job-1, got %v", result.Details["existing_job_id"])
	}
}

func TestSkipDeployedEvaluator_CancelledJobPreventsRedeploy(t *testing.T) {
	// Setup: Previous job was cancelled
	st := setupStoreWithResource(t, "resource-1")
	ctx := context.Background()

	releaseTarget := &oapi.ReleaseTarget{
		DeploymentId:  "deployment-1",
		EnvironmentId: "env-1",
		ResourceId:    "resource-1",
	}

	release := &oapi.Release{
		ReleaseTarget: *releaseTarget,
		Version: oapi.DeploymentVersion{
			Id:  "version-1",
			Tag: "v1.0.0",
		},
	}

	// Create cancelled job with completion time
	completedAt := time.Now()
	if err := st.Releases.Upsert(ctx, release); err != nil {
		t.Fatalf("Failed to upsert release: %v", err)
	}
	st.Jobs.Upsert(ctx, &oapi.Job{
		Id:          "job-1",
		ReleaseId:   release.ID(),
		Status:      oapi.Cancelled,
		CreatedAt:   time.Now().Add(-1 * time.Hour),
		CompletedAt: &completedAt,
	})

	evaluator := NewSkipDeployedEvaluator(st)

	// Act: Try to deploy same release again
	result, err := evaluator.Evaluate(ctx, release)

	// Assert: Should DENY retry because cancelled jobs are now considered (validJobStatuses filter removed)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if result.Allowed {
		t.Errorf("expected denied for retry after cancellation (cancelled jobs are now tracked), got allowed: %s", result.Message)
	}

	if result.Details["existing_job_id"] != "job-1" {
		t.Errorf("expected existing_job_id=job-1, got %v", result.Details["existing_job_id"])
	}

	if result.Details["job_status"] != string(oapi.Cancelled) {
		t.Errorf("expected job_status=cancelled, got %v", result.Details["job_status"])
	}
}

func TestSkipDeployedEvaluator_VariableChangeCreatesNewRelease(t *testing.T) {
	// Setup: Same version, different variables = different release
	st := setupStoreWithResource(t, "resource-1")
	ctx := context.Background()

	releaseTarget := &oapi.ReleaseTarget{
		DeploymentId:  "deployment-1",
		EnvironmentId: "env-1",
		ResourceId:    "resource-1",
	}

	replicas := oapi.LiteralValue{}
	if err := replicas.FromIntegerValue(3); err != nil {
		t.Fatalf("Failed to create replicas: %v", err)
	}

	release1 := &oapi.Release{
		ReleaseTarget: *releaseTarget,
		Version: oapi.DeploymentVersion{
			Id:  "version-1",
			Tag: "v1.0.0",
		},
		Variables: map[string]oapi.LiteralValue{
			"replicas": replicas,
		},
	}

	completedAt := time.Now()
	if err := st.Releases.Upsert(ctx, release1); err != nil {
		t.Fatalf("Failed to upsert release1: %v", err)
	}
	st.Jobs.Upsert(ctx, &oapi.Job{
		Id:          "job-1",
		ReleaseId:   release1.ID(),
		Status:      oapi.Successful,
		CreatedAt:   time.Now().Add(-1 * time.Hour),
		CompletedAt: &completedAt,
	})

	// Deploy same version with different variables: {replicas: 5}
	replicas2 := oapi.LiteralValue{}
	if err := replicas2.FromIntegerValue(5); err != nil {
		t.Fatalf("Failed to create replicas2: %v", err)
	}

	release2 := &oapi.Release{
		ReleaseTarget: *releaseTarget,
		Version: oapi.DeploymentVersion{
			Id:  "version-1", // Same version!
			Tag: "v1.0.0",
		},
		Variables: map[string]oapi.LiteralValue{
			"replicas": replicas2, // Different value!
		},
	}
	if err := st.Releases.Upsert(ctx, release2); err != nil {
		t.Fatalf("Failed to upsert release2: %v", err)
	}

	evaluator := NewSkipDeployedEvaluator(st)

	// Act: Try to deploy with different variables
	result, err := evaluator.Evaluate(ctx, release2)

	// Assert: Should allow (different release ID due to different variables)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if !result.Allowed {
		t.Errorf("expected allowed for different variables, got denied: %s", result.Message)
	}

	// Verify release IDs are different
	if release1.ID() == release2.ID() {
		t.Error("expected different release IDs for different variables")
	}
}

func TestSkipDeployedEvaluator_UsesCreatedAtNotCompletedAt(t *testing.T) {
	// Test that evaluator now uses CreatedAt for finding most recent job
	// Setup: Multiple jobs where some have nil completedAt (in progress/pending)
	st := setupStoreWithResource(t, "resource-1")
	ctx := context.Background()

	releaseTarget := &oapi.ReleaseTarget{
		DeploymentId:  "deployment-1",
		EnvironmentId: "env-1",
		ResourceId:    "resource-1",
	}

	// Release 1: Has a job that's in progress (nil completedAt) - created MORE recently
	release1 := &oapi.Release{
		ReleaseTarget: *releaseTarget,
		Version: oapi.DeploymentVersion{
			Id:  "version-1",
			Tag: "v1.0.0",
		},
	}

	// Release 2: Has a completed job - but created LESS recently
	release2 := &oapi.Release{
		ReleaseTarget: *releaseTarget,
		Version: oapi.DeploymentVersion{
			Id:  "version-2",
			Tag: "v2.0.0",
		},
	}

	// Release 3: New release to evaluate
	release3 := &oapi.Release{
		ReleaseTarget: *releaseTarget,
		Version: oapi.DeploymentVersion{
			Id:  "version-3",
			Tag: "v3.0.0",
		},
	}

	if err := st.Releases.Upsert(ctx, release1); err != nil {
		t.Fatalf("Failed to upsert release1: %v", err)
	}
	if err := st.Releases.Upsert(ctx, release2); err != nil {
		t.Fatalf("Failed to upsert release2: %v", err)
	}
	if err := st.Releases.Upsert(ctx, release3); err != nil {
		t.Fatalf("Failed to upsert release3: %v", err)
	}

	// Create job with nil completedAt (in progress) - CREATED MORE RECENTLY
	st.Jobs.Upsert(ctx, &oapi.Job{
		Id:          "job-1",
		ReleaseId:   release1.ID(),
		Status:      oapi.InProgress,
		CreatedAt:   time.Now().Add(-30 * time.Minute), // More recent
		CompletedAt: nil,                               // Explicitly nil
	})

	// Create completed job - CREATED LESS RECENTLY but COMPLETED more recently
	completedAt := time.Now().Add(-1 * time.Minute)
	st.Jobs.Upsert(ctx, &oapi.Job{
		Id:          "job-2",
		ReleaseId:   release2.ID(),
		Status:      oapi.Successful,
		CreatedAt:   time.Now().Add(-90 * time.Minute), // Less recent creation
		CompletedAt: &completedAt,                      // More recent completion
	})

	evaluator := NewSkipDeployedEvaluator(st)

	// Act: Evaluate new release - should not panic
	result, err := evaluator.Evaluate(ctx, release3)

	// Assert: Should not panic and should allow (different release)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if !result.Allowed {
		t.Errorf("expected allowed for new release, got denied: %s", result.Message)
	}

	// The most recently CREATED job should be job-1 (release1), even though job-2 completed more recently
	// Since we now use CreatedAt, the previous release should be release1, not release2
	if result.Details["previous_release_id"] != release1.ID() {
		t.Errorf("expected previous_release_id=%s (most recently created), got %v", release1.ID(), result.Details["previous_release_id"])
	}
}

func TestSkipDeployedEvaluator_OnlyJobsWithNilCompletedAt(t *testing.T) {
	// Test case where all jobs have nil completedAt
	// Jobs are now tracked using createdAt, so pending/in-progress jobs should still be found
	st := setupStoreWithResource(t, "resource-1")
	ctx := context.Background()

	releaseTarget := &oapi.ReleaseTarget{
		DeploymentId:  "deployment-1",
		EnvironmentId: "env-1",
		ResourceId:    "resource-1",
	}

	release := &oapi.Release{
		ReleaseTarget: *releaseTarget,
		Version: oapi.DeploymentVersion{
			Id:  "version-1",
			Tag: "v1.0.0",
		},
	}

	if err := st.Releases.Upsert(ctx, release); err != nil {
		t.Fatalf("Failed to upsert release: %v", err)
	}

	// Create multiple jobs, all with nil completedAt
	st.Jobs.Upsert(ctx, &oapi.Job{
		Id:          "job-1",
		ReleaseId:   release.ID(),
		Status:      oapi.Pending,
		CreatedAt:   time.Now().Add(-2 * time.Hour),
		CompletedAt: nil,
	})

	st.Jobs.Upsert(ctx, &oapi.Job{
		Id:          "job-2",
		ReleaseId:   release.ID(),
		Status:      oapi.InProgress,
		CreatedAt:   time.Now().Add(-1 * time.Hour), // More recent
		CompletedAt: nil,
	})

	evaluator := NewSkipDeployedEvaluator(st)

	// Act: Evaluate same release - should not panic
	result, err := evaluator.Evaluate(ctx, release)

	// Assert: Should not panic. Jobs are tracked by createdAt now,
	// so the most recently created job (job-2) should be found and deny the re-deployment
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if result.Allowed {
		t.Errorf("expected denied for same release with in-progress job, got allowed: %s", result.Message)
	}

	if result.Details["existing_job_id"] != "job-2" {
		t.Errorf("expected existing_job_id=job-2 (most recently created), got %v", result.Details["existing_job_id"])
	}

	if result.Details["job_status"] != string(oapi.InProgress) {
		t.Errorf("expected job_status=in_progress, got %v", result.Details["job_status"])
	}
}

func TestSkipDeployedEvaluator_PendingJobPreventsRedeploy(t *testing.T) {
	// Regression test for infinite loop bug
	// When a job is pending/in_progress, evaluator should DENY creating another job for the same release
	st := setupStoreWithResource(t, "resource-1")
	ctx := context.Background()

	releaseTarget := &oapi.ReleaseTarget{
		DeploymentId:  "deployment-1",
		EnvironmentId: "env-1",
		ResourceId:    "resource-1",
	}

	release := &oapi.Release{
		ReleaseTarget: *releaseTarget,
		Version: oapi.DeploymentVersion{
			Id:  "version-1",
			Tag: "v1.0.0",
		},
	}

	if err := st.Releases.Upsert(ctx, release); err != nil {
		t.Fatalf("Failed to upsert release: %v", err)
	}

	// Create pending job (not yet completed)
	st.Jobs.Upsert(ctx, &oapi.Job{
		Id:          "job-1",
		ReleaseId:   release.ID(),
		Status:      oapi.Pending,
		CreatedAt:   time.Now().Add(-5 * time.Minute),
		CompletedAt: nil,
	})

	evaluator := NewSkipDeployedEvaluator(st)

	// Act: Try to deploy same release again (simulating re-evaluation on job update)
	result, err := evaluator.Evaluate(ctx, release)

	// Assert: Should DENY - prevents infinite loop of creating duplicate jobs
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if result.Allowed {
		t.Errorf("expected denied when pending job exists for same release, got allowed: %s", result.Message)
	}

	if result.Details["existing_job_id"] != "job-1" {
		t.Errorf("expected existing_job_id=job-1, got %v", result.Details["existing_job_id"])
	}

	if result.Details["job_status"] != string(oapi.Pending) {
		t.Errorf("expected job_status=pending, got %v", result.Details["job_status"])
	}
}

func TestSkipDeployedEvaluator_ConsidersAllJobStatuses(t *testing.T) {
	// Test that jobs with all statuses (failed, cancelled, skipped, etc.) are now considered
	st := setupStoreWithResource(t, "resource-1")
	ctx := context.Background()

	releaseTarget := &oapi.ReleaseTarget{
		DeploymentId:  "deployment-1",
		EnvironmentId: "env-1",
		ResourceId:    "resource-1",
	}

	oldRelease := &oapi.Release{
		ReleaseTarget: *releaseTarget,
		Version: oapi.DeploymentVersion{
			Id:  "version-1",
			Tag: "v1.0.0",
		},
	}

	newRelease := &oapi.Release{
		ReleaseTarget: *releaseTarget,
		Version: oapi.DeploymentVersion{
			Id:  "version-2",
			Tag: "v2.0.0",
		},
	}

	if err := st.Releases.Upsert(ctx, oldRelease); err != nil {
		t.Fatalf("Failed to upsert old release: %v", err)
	}
	if err := st.Releases.Upsert(ctx, newRelease); err != nil {
		t.Fatalf("Failed to upsert new release: %v", err)
	}

	// Create jobs with various statuses - the most recent is skipped
	completedAt := time.Now()
	st.Jobs.Upsert(ctx, &oapi.Job{
		Id:          "job-failed",
		ReleaseId:   oldRelease.ID(),
		Status:      oapi.Failure,
		CreatedAt:   time.Now().Add(-3 * time.Hour),
		CompletedAt: &completedAt,
	})

	st.Jobs.Upsert(ctx, &oapi.Job{
		Id:          "job-cancelled",
		ReleaseId:   oldRelease.ID(),
		Status:      oapi.Cancelled,
		CreatedAt:   time.Now().Add(-2 * time.Hour),
		CompletedAt: &completedAt,
	})

	st.Jobs.Upsert(ctx, &oapi.Job{
		Id:          "job-skipped",
		ReleaseId:   oldRelease.ID(),
		Status:      oapi.Skipped,
		CreatedAt:   time.Now().Add(-1 * time.Hour), // Most recent
		CompletedAt: &completedAt,
	})

	evaluator := NewSkipDeployedEvaluator(st)

	// Act: Try to deploy new release
	result, err := evaluator.Evaluate(ctx, newRelease)

	// Assert: Should ALLOW because it's a different release, but should recognize the previous job
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if !result.Allowed {
		t.Errorf("expected allowed for different release, got denied: %s", result.Message)
	}

	// The most recent job should be recognized (job-skipped with oldRelease)
	if result.Details["previous_release_id"] != oldRelease.ID() {
		t.Errorf("expected previous_release_id=%s (from most recent job), got %v", oldRelease.ID(), result.Details["previous_release_id"])
	}
}

func TestSkipDeployedEvaluator_AllJobStatusesPreventRedeployOfSameRelease(t *testing.T) {
	// Test that ANY job status prevents re-deploying the same release
	ctx := context.Background()

	statuses := []oapi.JobStatus{
		oapi.Pending,
		oapi.InProgress,
		oapi.Successful,
		oapi.Failure,
		oapi.Cancelled,
		oapi.Skipped,
		oapi.ActionRequired,
		oapi.ExternalRunNotFound,
		oapi.InvalidIntegration,
		oapi.InvalidJobAgent,
	}

	for _, status := range statuses {
		t.Run(string(status), func(t *testing.T) {
			st := setupStoreWithResource(t, "resource-1")

			releaseTarget := &oapi.ReleaseTarget{
				DeploymentId:  "deployment-1",
				EnvironmentId: "env-1",
				ResourceId:    "resource-1",
			}

			release := &oapi.Release{
				ReleaseTarget: *releaseTarget,
				Version: oapi.DeploymentVersion{
					Id:  "version-1",
					Tag: "v1.0.0",
				},
			}

			if err := st.Releases.Upsert(ctx, release); err != nil {
				t.Fatalf("Failed to upsert release: %v", err)
			}

			// Create job with the given status
			completedAt := time.Now()
			st.Jobs.Upsert(ctx, &oapi.Job{
				Id:          "job-1",
				ReleaseId:   release.ID(),
				Status:      status,
				CreatedAt:   time.Now().Add(-1 * time.Hour),
				CompletedAt: &completedAt,
			})

			evaluator := NewSkipDeployedEvaluator(st)

			// Act: Try to deploy the same release again
			result, err := evaluator.Evaluate(ctx, release)

			// Assert: Should DENY regardless of job status
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			if result.Allowed {
				t.Errorf("expected denied for retry with status %s, got allowed: %s", status, result.Message)
			}

			if result.Details["existing_job_id"] != "job-1" {
				t.Errorf("expected existing_job_id=job-1, got %v", result.Details["existing_job_id"])
			}

			if result.Details["job_status"] != string(status) {
				t.Errorf("expected job_status=%s, got %v", status, result.Details["job_status"])
			}
		})
	}
}
