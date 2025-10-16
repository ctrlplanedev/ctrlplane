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
	st := store.New()
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

	// Assert: Should DENY retry of same release, even if it failed
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if result.Allowed {
		t.Errorf("expected denied for retry of same release, got allowed: %s", result.Message)
	}

	if result.Details["job_status"] != string(oapi.Failure) {
		t.Errorf("expected job_status to be FAILURE, got %v", result.Details["job_status"])
	}

	if result.Details["existing_job_id"] != "job-1" {
		t.Errorf("expected existing_job_id=job-1, got %v", result.Details["existing_job_id"])
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

func TestSkipDeployedEvaluator_CancelledJobDeniesRedeploy(t *testing.T) {
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

	// Assert: Should DENY retry of same release, even if cancelled
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if result.Allowed {
		t.Errorf("expected denied for retry of same release, got allowed: %s", result.Message)
	}

	if result.Details["job_status"] != string(oapi.Cancelled) {
		t.Errorf("expected job_status to be CANCELLED, got %v", result.Details["job_status"])
	}

	if result.Details["existing_job_id"] != "job-1" {
		t.Errorf("expected existing_job_id=job-1, got %v", result.Details["existing_job_id"])
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
