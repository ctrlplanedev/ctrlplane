package releasetargetconcurrency

import (
	"context"
	"testing"
	"time"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/statechange"
	"workspace-engine/pkg/workspace/store"
)

// setupStoreWithReleaseAndJobs creates a test store with a release target and associated jobs
func setupStoreWithReleaseAndJobs(t *testing.T, releaseTarget *oapi.ReleaseTarget, jobs []*oapi.Job) *store.Store {
	sc := statechange.NewChangeSet[any]()
	st := store.New(sc)
	ctx := context.Background()

	// Create resource
	resource := &oapi.Resource{
		Id:         releaseTarget.ResourceId,
		Name:       "test-resource",
		Kind:       "server",
		Identifier: releaseTarget.ResourceId,
		Config:     map[string]any{},
		Metadata:   map[string]string{},
		Version:    "v1",
		CreatedAt:  time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC),
	}

	if _, err := st.Resources.Upsert(ctx, resource); err != nil {
		t.Fatalf("Failed to upsert resource: %v", err)
	}

	// Create release
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

	// Add jobs
	for _, job := range jobs {
		job.ReleaseId = release.ID()
		st.Jobs.Upsert(ctx, job)
	}

	return st
}

func TestReleaseTargetConcurrencyEvaluator_NoJobs(t *testing.T) {
	// Setup: Release target with no jobs
	releaseTarget := &oapi.ReleaseTarget{
		DeploymentId:  "deployment-1",
		EnvironmentId: "env-1",
		ResourceId:    "resource-1",
	}

	st := setupStoreWithReleaseAndJobs(t, releaseTarget, []*oapi.Job{})
	evaluator := NewReleaseTargetConcurrencyEvaluator(st)

	// Act
	result, err := evaluator.Evaluate(context.Background(), releaseTarget)

	// Assert
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if !result.Allowed {
		t.Errorf("expected allowed when no jobs exist, got denied: %s", result.Message)
	}

	if result.Message != "Release target is not processing jobs" {
		t.Errorf("expected 'Release target is not processing jobs', got '%s'", result.Message)
	}
}

func TestReleaseTargetConcurrencyEvaluator_JobInProgress(t *testing.T) {
	// Setup: Release target with a job in progress
	releaseTarget := &oapi.ReleaseTarget{
		DeploymentId:  "deployment-1",
		EnvironmentId: "env-1",
		ResourceId:    "resource-1",
	}

	jobs := []*oapi.Job{
		{
			Id:        "job-1",
			Status:    oapi.InProgress,
			CreatedAt: time.Now(),
		},
	}

	st := setupStoreWithReleaseAndJobs(t, releaseTarget, jobs)
	evaluator := NewReleaseTargetConcurrencyEvaluator(st)

	// Act
	result, err := evaluator.Evaluate(context.Background(), releaseTarget)

	// Assert
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if result.Allowed {
		t.Errorf("expected denied when job is in progress, got allowed: %s", result.Message)
	}

	if result.Message != "Release target is already processing jobs" {
		t.Errorf("expected 'Release target is already processing jobs', got '%s'", result.Message)
	}

	if result.Details["release_target_key"] != releaseTarget.Key() {
		t.Errorf("expected release_target_key=%s, got %v", releaseTarget.Key(), result.Details["release_target_key"])
	}

	jobsMap, ok := result.Details["jobs"].(map[string]*oapi.Job)
	if !ok {
		t.Fatal("expected jobs to be map[string]*oapi.Job")
	}

	if len(jobsMap) != 1 {
		t.Errorf("expected 1 job in details, got %d", len(jobsMap))
	}

	if _, exists := jobsMap["job-1"]; !exists {
		t.Error("expected job-1 in details")
	}
}

func TestReleaseTargetConcurrencyEvaluator_JobPending(t *testing.T) {
	// Setup: Release target with a pending job
	releaseTarget := &oapi.ReleaseTarget{
		DeploymentId:  "deployment-1",
		EnvironmentId: "env-1",
		ResourceId:    "resource-1",
	}

	jobs := []*oapi.Job{
		{
			Id:        "job-pending",
			Status:    oapi.Pending,
			CreatedAt: time.Now(),
		},
	}

	st := setupStoreWithReleaseAndJobs(t, releaseTarget, jobs)
	evaluator := NewReleaseTargetConcurrencyEvaluator(st)

	// Act
	result, err := evaluator.Evaluate(context.Background(), releaseTarget)

	// Assert
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if result.Allowed {
		t.Errorf("expected denied when job is pending, got allowed: %s", result.Message)
	}

	jobsMap, _ := result.Details["jobs"].(map[string]*oapi.Job)
	if len(jobsMap) != 1 {
		t.Errorf("expected 1 job in details, got %d", len(jobsMap))
	}
}

func TestReleaseTargetConcurrencyEvaluator_JobActionRequired(t *testing.T) {
	// Setup: Release target with a job requiring action
	releaseTarget := &oapi.ReleaseTarget{
		DeploymentId:  "deployment-1",
		EnvironmentId: "env-1",
		ResourceId:    "resource-1",
	}

	jobs := []*oapi.Job{
		{
			Id:        "job-action-required",
			Status:    oapi.ActionRequired,
			CreatedAt: time.Now(),
		},
	}

	st := setupStoreWithReleaseAndJobs(t, releaseTarget, jobs)
	evaluator := NewReleaseTargetConcurrencyEvaluator(st)

	// Act
	result, err := evaluator.Evaluate(context.Background(), releaseTarget)

	// Assert
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if result.Allowed {
		t.Errorf("expected denied when job requires action, got allowed: %s", result.Message)
	}

	jobsMap2, _ := result.Details["jobs"].(map[string]*oapi.Job)
	if len(jobsMap2) != 1 {
		t.Errorf("expected 1 job in details, got %d", len(jobsMap2))
	}
}

func TestReleaseTargetConcurrencyEvaluator_MultipleProcessingJobs(t *testing.T) {
	// Setup: Release target with multiple jobs in processing state
	releaseTarget := &oapi.ReleaseTarget{
		DeploymentId:  "deployment-1",
		EnvironmentId: "env-1",
		ResourceId:    "resource-1",
	}

	jobs := []*oapi.Job{
		{
			Id:        "job-1",
			Status:    oapi.InProgress,
			CreatedAt: time.Now().Add(-1 * time.Hour),
		},
		{
			Id:        "job-2",
			Status:    oapi.Pending,
			CreatedAt: time.Now().Add(-30 * time.Minute),
		},
		{
			Id:        "job-3",
			Status:    oapi.ActionRequired,
			CreatedAt: time.Now(),
		},
	}

	st := setupStoreWithReleaseAndJobs(t, releaseTarget, jobs)
	evaluator := NewReleaseTargetConcurrencyEvaluator(st)

	// Act
	result, err := evaluator.Evaluate(context.Background(), releaseTarget)

	// Assert
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if result.Allowed {
		t.Errorf("expected denied when multiple jobs are processing, got allowed: %s", result.Message)
	}

	jobsInDetails, _ := result.Details["jobs"].(map[string]*oapi.Job)
	if len(jobsInDetails) != 3 {
		t.Errorf("expected 3 jobs in details, got %d", len(jobsInDetails))
	}
}

func TestReleaseTargetConcurrencyEvaluator_OnlyCompletedJobs(t *testing.T) {
	// Setup: Release target with only completed jobs
	releaseTarget := &oapi.ReleaseTarget{
		DeploymentId:  "deployment-1",
		EnvironmentId: "env-1",
		ResourceId:    "resource-1",
	}

	completedAt := time.Now()
	jobs := []*oapi.Job{
		{
			Id:          "job-successful",
			Status:      oapi.Successful,
			CreatedAt:   time.Now().Add(-2 * time.Hour),
			CompletedAt: &completedAt,
		},
		{
			Id:          "job-failed",
			Status:      oapi.Failure,
			CreatedAt:   time.Now().Add(-1 * time.Hour),
			CompletedAt: &completedAt,
		},
	}

	st := setupStoreWithReleaseAndJobs(t, releaseTarget, jobs)
	evaluator := NewReleaseTargetConcurrencyEvaluator(st)

	// Act
	result, err := evaluator.Evaluate(context.Background(), releaseTarget)

	// Assert
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if !result.Allowed {
		t.Errorf("expected allowed when only completed jobs exist, got denied: %s", result.Message)
	}
}

func TestReleaseTargetConcurrencyEvaluator_MixedJobStatuses(t *testing.T) {
	// Setup: Release target with both completed and processing jobs
	releaseTarget := &oapi.ReleaseTarget{
		DeploymentId:  "deployment-1",
		EnvironmentId: "env-1",
		ResourceId:    "resource-1",
	}

	completedAt := time.Now()
	jobs := []*oapi.Job{
		{
			Id:          "job-completed",
			Status:      oapi.Successful,
			CreatedAt:   time.Now().Add(-2 * time.Hour),
			CompletedAt: &completedAt,
		},
		{
			Id:        "job-in-progress",
			Status:    oapi.InProgress,
			CreatedAt: time.Now(),
		},
	}

	st := setupStoreWithReleaseAndJobs(t, releaseTarget, jobs)
	evaluator := NewReleaseTargetConcurrencyEvaluator(st)

	// Act
	result, err := evaluator.Evaluate(context.Background(), releaseTarget)

	// Assert
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if result.Allowed {
		t.Errorf("expected denied when at least one job is processing, got allowed: %s", result.Message)
	}

	jobsInDetails, _ := result.Details["jobs"].(map[string]*oapi.Job)
	if len(jobsInDetails) != 1 {
		t.Errorf("expected 1 processing job in details, got %d", len(jobsInDetails))
	}

	if _, exists := jobsInDetails["job-in-progress"]; !exists {
		t.Error("expected job-in-progress in details")
	}

	if _, exists := jobsInDetails["job-completed"]; exists {
		t.Error("expected job-completed NOT to be in details")
	}
}

func TestReleaseTargetConcurrencyEvaluator_CancelledJobsIgnored(t *testing.T) {
	// Setup: Release target with cancelled and skipped jobs (terminal states)
	releaseTarget := &oapi.ReleaseTarget{
		DeploymentId:  "deployment-1",
		EnvironmentId: "env-1",
		ResourceId:    "resource-1",
	}

	completedAt := time.Now()
	jobs := []*oapi.Job{
		{
			Id:          "job-cancelled",
			Status:      oapi.Cancelled,
			CreatedAt:   time.Now().Add(-1 * time.Hour),
			CompletedAt: &completedAt,
		},
		{
			Id:          "job-skipped",
			Status:      oapi.Skipped,
			CreatedAt:   time.Now(),
			CompletedAt: &completedAt,
		},
	}

	st := setupStoreWithReleaseAndJobs(t, releaseTarget, jobs)
	evaluator := NewReleaseTargetConcurrencyEvaluator(st)

	// Act
	result, err := evaluator.Evaluate(context.Background(), releaseTarget)

	// Assert
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if !result.Allowed {
		t.Errorf("expected allowed when only terminal state jobs exist, got denied: %s", result.Message)
	}
}

func TestReleaseTargetConcurrencyEvaluator_DifferentReleaseTarget(t *testing.T) {
	// Setup: Jobs exist but for a different release target
	releaseTarget1 := &oapi.ReleaseTarget{
		DeploymentId:  "deployment-1",
		EnvironmentId: "env-1",
		ResourceId:    "resource-1",
	}

	releaseTarget2 := &oapi.ReleaseTarget{
		DeploymentId:  "deployment-1",
		EnvironmentId: "env-1",
		ResourceId:    "resource-2", // Different resource
	}

	jobs := []*oapi.Job{
		{
			Id:        "job-1",
			Status:    oapi.InProgress,
			CreatedAt: time.Now(),
		},
	}

	// Create jobs for releaseTarget1
	st := setupStoreWithReleaseAndJobs(t, releaseTarget1, jobs)

	// Create resource for releaseTarget2
	resource2 := &oapi.Resource{
		Id:         releaseTarget2.ResourceId,
		Name:       "test-resource-2",
		Kind:       "server",
		Identifier: releaseTarget2.ResourceId,
		Config:     map[string]any{},
		Metadata:   map[string]string{},
		Version:    "v1",
		CreatedAt:  time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC),
	}
	st.Resources.Upsert(context.Background(), resource2)

	evaluator := NewReleaseTargetConcurrencyEvaluator(st)

	// Act: Evaluate releaseTarget2 (different from the one with jobs)
	result, err := evaluator.Evaluate(context.Background(), releaseTarget2)

	// Assert
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if !result.Allowed {
		t.Errorf("expected allowed for different release target, got denied: %s", result.Message)
	}
}

func TestReleaseTargetConcurrencyEvaluator_AllProcessingStates(t *testing.T) {
	// Test each processing state individually
	processingStates := []oapi.JobStatus{
		oapi.Pending,
		oapi.InProgress,
		oapi.ActionRequired,
	}

	for _, status := range processingStates {
		t.Run(string(status), func(t *testing.T) {
			releaseTarget := &oapi.ReleaseTarget{
				DeploymentId:  "deployment-1",
				EnvironmentId: "env-1",
				ResourceId:    "resource-1",
			}

			jobs := []*oapi.Job{
				{
					Id:        "job-1",
					Status:    status,
					CreatedAt: time.Now(),
				},
			}

			st := setupStoreWithReleaseAndJobs(t, releaseTarget, jobs)
			evaluator := NewReleaseTargetConcurrencyEvaluator(st)

			// Act
			result, err := evaluator.Evaluate(context.Background(), releaseTarget)

			// Assert
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			if result.Allowed {
				t.Errorf("expected denied for status %s, got allowed: %s", status, result.Message)
			}

			jobsInDetails, _ := result.Details["jobs"].(map[string]*oapi.Job)
			if len(jobsInDetails) != 1 {
				t.Errorf("expected 1 job in details for status %s, got %d", status, len(jobsInDetails))
			}
		})
	}
}

func TestReleaseTargetConcurrencyEvaluator_AllTerminalStates(t *testing.T) {
	// Test that all terminal states are ignored
	terminalStates := []oapi.JobStatus{
		oapi.Successful,
		oapi.Failure,
		oapi.Cancelled,
		oapi.Skipped,
		oapi.InvalidJobAgent,
		oapi.InvalidIntegration,
		oapi.ExternalRunNotFound,
	}

	for _, status := range terminalStates {
		t.Run(string(status), func(t *testing.T) {
			releaseTarget := &oapi.ReleaseTarget{
				DeploymentId:  "deployment-1",
				EnvironmentId: "env-1",
				ResourceId:    "resource-1",
			}

			completedAt := time.Now()
			jobs := []*oapi.Job{
				{
					Id:          "job-1",
					Status:      status,
					CreatedAt:   time.Now().Add(-1 * time.Hour),
					CompletedAt: &completedAt,
				},
			}

			st := setupStoreWithReleaseAndJobs(t, releaseTarget, jobs)
			evaluator := NewReleaseTargetConcurrencyEvaluator(st)

			// Act
			result, err := evaluator.Evaluate(context.Background(), releaseTarget)

			// Assert
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			if !result.Allowed {
				t.Errorf("expected allowed for terminal status %s, got denied: %s", status, result.Message)
			}
		})
	}
}

func TestReleaseTargetConcurrencyEvaluator_NilReleaseTarget(t *testing.T) {
	// Setup: Nil release target
	sc := statechange.NewChangeSet[any]()
	st := store.New(sc)
	evaluator := NewReleaseTargetConcurrencyEvaluator(st)

	// Act
	result, err := evaluator.Evaluate(context.Background(), nil)

	// Assert
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// When nil release target, GetJobsInProcessingStateForReleaseTarget returns empty map
	if !result.Allowed {
		t.Errorf("expected allowed for nil release target, got denied: %s", result.Message)
	}
}

func TestReleaseTargetConcurrencyEvaluator_ResultStructure(t *testing.T) {
	// Verify result has all expected fields and proper types
	releaseTarget := &oapi.ReleaseTarget{
		DeploymentId:  "deployment-1",
		EnvironmentId: "env-1",
		ResourceId:    "resource-1",
	}

	jobs := []*oapi.Job{
		{
			Id:        "job-1",
			Status:    oapi.InProgress,
			CreatedAt: time.Now(),
		},
	}

	st := setupStoreWithReleaseAndJobs(t, releaseTarget, jobs)
	evaluator := NewReleaseTargetConcurrencyEvaluator(st)

	// Act
	result, err := evaluator.Evaluate(context.Background(), releaseTarget)

	// Assert
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if result.Details == nil {
		t.Fatal("expected Details to be initialized")
	}

	if _, ok := result.Details["release_target_key"]; !ok {
		t.Error("expected Details to contain 'release_target_key'")
	}

	if _, ok := result.Details["jobs"]; !ok {
		t.Error("expected Details to contain 'jobs'")
	}

	if result.Message == "" {
		t.Error("expected Message to be set")
	}

	// Verify jobs is correct type
	jobsMap, ok := result.Details["jobs"].(map[string]*oapi.Job)
	if !ok {
		t.Error("expected jobs to be map[string]*oapi.Job")
	}

	if len(jobsMap) != 1 {
		t.Errorf("expected 1 job, got %d", len(jobsMap))
	}
}
