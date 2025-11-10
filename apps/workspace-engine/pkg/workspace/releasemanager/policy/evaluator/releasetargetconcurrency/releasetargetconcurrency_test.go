package releasetargetconcurrency

import (
	"context"
	"testing"
	"time"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/statechange"
	"workspace-engine/pkg/workspace/store"
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

func TestReleaseTargetConcurrencyEvaluator_NoActiveJobs(t *testing.T) {
	// Setup: No jobs exist for this release target
	st := setupStoreWithResource(t, "resource-1")
	eval := NewReleaseTargetConcurrencyEvaluator(st)

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
	result := eval.Evaluate(context.Background(), release)

	// Assert
	if !result.Allowed {
		t.Errorf("expected allowed when no active jobs, got denied: %s", result.Message)
	}

	if result.Message != "Release target has no active jobs" {
		t.Errorf("expected 'Release target has no active jobs', got '%s'", result.Message)
	}
}

func TestReleaseTargetConcurrencyEvaluator_JobInPendingState(t *testing.T) {
	// Setup: One job in Pending state
	st := setupStoreWithResource(t, "resource-1")
	ctx := context.Background()

	releaseTarget := &oapi.ReleaseTarget{
		DeploymentId:  "deployment-1",
		EnvironmentId: "env-1",
		ResourceId:    "resource-1",
	}

	existingRelease := &oapi.Release{
		ReleaseTarget: *releaseTarget,
		Version: oapi.DeploymentVersion{
			Id:  "version-1",
			Tag: "v1.0.0",
		},
	}

	if err := st.Releases.Upsert(ctx, existingRelease); err != nil {
		t.Fatalf("Failed to upsert existing release: %v", err)
	}

	st.Jobs.Upsert(ctx, &oapi.Job{
		Id:        "job-1",
		ReleaseId: existingRelease.ID(),
		Status:    oapi.JobStatusPending,
		CreatedAt: time.Now(),
	})

	eval := NewReleaseTargetConcurrencyEvaluator(st)

	// Try to deploy a new release to the same target
	newRelease := &oapi.Release{
		ReleaseTarget: *releaseTarget,
		Version: oapi.DeploymentVersion{
			Id:  "version-2",
			Tag: "v2.0.0",
		},
	}

	// Act
	result := eval.Evaluate(ctx, newRelease)

	// Assert
	if result.Allowed {
		t.Errorf("expected denied when job is pending, got allowed: %s", result.Message)
	}

	if result.Message != "Release target has an active job" {
		t.Errorf("expected 'Release target has an active job', got '%s'", result.Message)
	}

	if result.Details["release_target_key"] != releaseTarget.Key() {
		t.Errorf("expected release_target_key=%s, got %v", releaseTarget.Key(), result.Details["release_target_key"])
	}

	if result.Details["job_job-1"] != oapi.JobStatusPending {
		t.Errorf("expected job_job-1=%s, got %v", oapi.JobStatusPending, result.Details["job_job-1"])
	}
}

func TestReleaseTargetConcurrencyEvaluator_JobInProgressState(t *testing.T) {
	// Setup: One job in InProgress state
	st := setupStoreWithResource(t, "resource-1")
	ctx := context.Background()

	releaseTarget := &oapi.ReleaseTarget{
		DeploymentId:  "deployment-1",
		EnvironmentId: "env-1",
		ResourceId:    "resource-1",
	}

	existingRelease := &oapi.Release{
		ReleaseTarget: *releaseTarget,
		Version: oapi.DeploymentVersion{
			Id:  "version-1",
			Tag: "v1.0.0",
		},
	}

	if err := st.Releases.Upsert(ctx, existingRelease); err != nil {
		t.Fatalf("Failed to upsert existing release: %v", err)
	}

	st.Jobs.Upsert(ctx, &oapi.Job{
		Id:        "job-1",
		ReleaseId: existingRelease.ID(),
		Status:    oapi.JobStatusInProgress,
		CreatedAt: time.Now(),
	})

	eval := NewReleaseTargetConcurrencyEvaluator(st)

	// Try to deploy a new release to the same target
	newRelease := &oapi.Release{
		ReleaseTarget: *releaseTarget,
		Version: oapi.DeploymentVersion{
			Id:  "version-2",
			Tag: "v2.0.0",
		},
	}

	// Act
	result := eval.Evaluate(ctx, newRelease)

	// Assert
	if result.Allowed {
		t.Errorf("expected denied when job is in progress, got allowed: %s", result.Message)
	}

	if result.Details["job_job-1"] != oapi.JobStatusInProgress {
		t.Errorf("expected job_job-1=%s, got %v", oapi.JobStatusInProgress, result.Details["job_job-1"])
	}
}

func TestReleaseTargetConcurrencyEvaluator_JobInActionRequiredState(t *testing.T) {
	// Setup: One job in ActionRequired state
	st := setupStoreWithResource(t, "resource-1")
	ctx := context.Background()

	releaseTarget := &oapi.ReleaseTarget{
		DeploymentId:  "deployment-1",
		EnvironmentId: "env-1",
		ResourceId:    "resource-1",
	}

	existingRelease := &oapi.Release{
		ReleaseTarget: *releaseTarget,
		Version: oapi.DeploymentVersion{
			Id:  "version-1",
			Tag: "v1.0.0",
		},
	}

	if err := st.Releases.Upsert(ctx, existingRelease); err != nil {
		t.Fatalf("Failed to upsert existing release: %v", err)
	}

	st.Jobs.Upsert(ctx, &oapi.Job{
		Id:        "job-1",
		ReleaseId: existingRelease.ID(),
		Status:    oapi.JobStatusActionRequired,
		CreatedAt: time.Now(),
	})

	eval := NewReleaseTargetConcurrencyEvaluator(st)

	// Try to deploy a new release to the same target
	newRelease := &oapi.Release{
		ReleaseTarget: *releaseTarget,
		Version: oapi.DeploymentVersion{
			Id:  "version-2",
			Tag: "v2.0.0",
		},
	}

	// Act
	result := eval.Evaluate(ctx, newRelease)

	// Assert
	if result.Allowed {
		t.Errorf("expected denied when job requires action, got allowed: %s", result.Message)
	}

	if result.Details["job_job-1"] != oapi.JobStatusActionRequired {
		t.Errorf("expected job_job-1=%s, got %v", oapi.JobStatusActionRequired, result.Details["job_job-1"])
	}
}

func TestReleaseTargetConcurrencyEvaluator_MultipleActiveJobs(t *testing.T) {
	// Setup: Multiple jobs in processing state
	st := setupStoreWithResource(t, "resource-1")
	ctx := context.Background()

	releaseTarget := &oapi.ReleaseTarget{
		DeploymentId:  "deployment-1",
		EnvironmentId: "env-1",
		ResourceId:    "resource-1",
	}

	// Create multiple releases with active jobs
	release1 := &oapi.Release{
		ReleaseTarget: *releaseTarget,
		Version: oapi.DeploymentVersion{
			Id:  "version-1",
			Tag: "v1.0.0",
		},
	}

	release2 := &oapi.Release{
		ReleaseTarget: *releaseTarget,
		Version: oapi.DeploymentVersion{
			Id:  "version-2",
			Tag: "v2.0.0",
		},
	}

	if err := st.Releases.Upsert(ctx, release1); err != nil {
		t.Fatalf("Failed to upsert release1: %v", err)
	}
	if err := st.Releases.Upsert(ctx, release2); err != nil {
		t.Fatalf("Failed to upsert release2: %v", err)
	}

	st.Jobs.Upsert(ctx, &oapi.Job{
		Id:        "job-1",
		ReleaseId: release1.ID(),
		Status:    oapi.JobStatusPending,
		CreatedAt: time.Now().Add(-1 * time.Hour),
	})

	st.Jobs.Upsert(ctx, &oapi.Job{
		Id:        "job-2",
		ReleaseId: release2.ID(),
		Status:    oapi.JobStatusInProgress,
		CreatedAt: time.Now(),
	})

	eval := NewReleaseTargetConcurrencyEvaluator(st)

	// Try to deploy a new release
	newRelease := &oapi.Release{
		ReleaseTarget: *releaseTarget,
		Version: oapi.DeploymentVersion{
			Id:  "version-3",
			Tag: "v3.0.0",
		},
	}

	// Act
	result := eval.Evaluate(ctx, newRelease)

	// Assert
	if result.Allowed {
		t.Errorf("expected denied when multiple jobs are active, got allowed: %s", result.Message)
	}

	// Both jobs should be in details
	if result.Details["job_job-1"] != oapi.JobStatusPending {
		t.Errorf("expected job_job-1=%s, got %v", oapi.JobStatusPending, result.Details["job_job-1"])
	}

	if result.Details["job_job-2"] != oapi.JobStatusInProgress {
		t.Errorf("expected job_job-2=%s, got %v", oapi.JobStatusInProgress, result.Details["job_job-2"])
	}
}

func TestReleaseTargetConcurrencyEvaluator_TerminalStateJobsDoNotBlock(t *testing.T) {
	// Setup: Jobs in terminal states (completed, failed, cancelled) should not block
	st := setupStoreWithResource(t, "resource-1")
	ctx := context.Background()

	releaseTarget := &oapi.ReleaseTarget{
		DeploymentId:  "deployment-1",
		EnvironmentId: "env-1",
		ResourceId:    "resource-1",
	}

	// Create releases with terminal jobs
	release1 := &oapi.Release{
		ReleaseTarget: *releaseTarget,
		Version: oapi.DeploymentVersion{
			Id:  "version-1",
			Tag: "v1.0.0",
		},
	}

	release2 := &oapi.Release{
		ReleaseTarget: *releaseTarget,
		Version: oapi.DeploymentVersion{
			Id:  "version-2",
			Tag: "v2.0.0",
		},
	}

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

	completedAt := time.Now()

	st.Jobs.Upsert(ctx, &oapi.Job{
		Id:          "job-1",
		ReleaseId:   release1.ID(),
		Status:      oapi.JobStatusSuccessful,
		CreatedAt:   time.Now().Add(-3 * time.Hour),
		CompletedAt: &completedAt,
	})

	st.Jobs.Upsert(ctx, &oapi.Job{
		Id:          "job-2",
		ReleaseId:   release2.ID(),
		Status:      oapi.JobStatusFailure,
		CreatedAt:   time.Now().Add(-2 * time.Hour),
		CompletedAt: &completedAt,
	})

	st.Jobs.Upsert(ctx, &oapi.Job{
		Id:          "job-3",
		ReleaseId:   release3.ID(),
		Status:      oapi.JobStatusCancelled,
		CreatedAt:   time.Now().Add(-1 * time.Hour),
		CompletedAt: &completedAt,
	})

	eval := NewReleaseTargetConcurrencyEvaluator(st)

	// Try to deploy a new release
	newRelease := &oapi.Release{
		ReleaseTarget: *releaseTarget,
		Version: oapi.DeploymentVersion{
			Id:  "version-4",
			Tag: "v4.0.0",
		},
	}

	// Act
	result := eval.Evaluate(ctx, newRelease)

	// Assert: Should ALLOW because terminal jobs don't block
	if !result.Allowed {
		t.Errorf("expected allowed when only terminal jobs exist, got denied: %s", result.Message)
	}

	if result.Message != "Release target has no active jobs" {
		t.Errorf("expected 'Release target has no active jobs', got '%s'", result.Message)
	}
}

func TestReleaseTargetConcurrencyEvaluator_DifferentReleaseTargetsDoNotInterfere(t *testing.T) {
	// Setup: Two different release targets with jobs
	st := setupStoreWithResource(t, "resource-1")
	ctx := context.Background()

	// Also need resource-2
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

	releaseTarget1 := &oapi.ReleaseTarget{
		DeploymentId:  "deployment-1",
		EnvironmentId: "env-1",
		ResourceId:    "resource-1",
	}

	releaseTarget2 := &oapi.ReleaseTarget{
		DeploymentId:  "deployment-1",
		EnvironmentId: "env-1",
		ResourceId:    "resource-2",
	}

	// Create a release with active job for target 1
	release1 := &oapi.Release{
		ReleaseTarget: *releaseTarget1,
		Version: oapi.DeploymentVersion{
			Id:  "version-1",
			Tag: "v1.0.0",
		},
	}

	if err := st.Releases.Upsert(ctx, release1); err != nil {
		t.Fatalf("Failed to upsert release1: %v", err)
	}

	st.Jobs.Upsert(ctx, &oapi.Job{
		Id:        "job-1",
		ReleaseId: release1.ID(),
		Status:    oapi.JobStatusInProgress,
		CreatedAt: time.Now(),
	})

	eval := NewReleaseTargetConcurrencyEvaluator(st)

	// Try to deploy to target 2 (different resource)
	release2 := &oapi.Release{
		ReleaseTarget: *releaseTarget2,
		Version: oapi.DeploymentVersion{
			Id:  "version-1",
			Tag: "v1.0.0",
		},
	}

	// Act
	result := eval.Evaluate(ctx, release2)

	// Assert: Should ALLOW because it's a different release target
	if !result.Allowed {
		t.Errorf("expected allowed for different release target, got denied: %s", result.Message)
	}
}

func TestReleaseTargetConcurrencyEvaluator_AllProcessingStatesBlock(t *testing.T) {
	// Test that all processing states (Pending, InProgress, ActionRequired) block new jobs
	ctx := context.Background()

	processingStates := []oapi.JobStatus{
		oapi.JobStatusPending,
		oapi.JobStatusInProgress,
		oapi.JobStatusActionRequired,
	}

	for _, status := range processingStates {
		t.Run(string(status), func(t *testing.T) {
			st := setupStoreWithResource(t, "resource-1")

			releaseTarget := &oapi.ReleaseTarget{
				DeploymentId:  "deployment-1",
				EnvironmentId: "env-1",
				ResourceId:    "resource-1",
			}

			existingRelease := &oapi.Release{
				ReleaseTarget: *releaseTarget,
				Version: oapi.DeploymentVersion{
					Id:  "version-1",
					Tag: "v1.0.0",
				},
			}

			if err := st.Releases.Upsert(ctx, existingRelease); err != nil {
				t.Fatalf("Failed to upsert existing release: %v", err)
			}

			st.Jobs.Upsert(ctx, &oapi.Job{
				Id:        "job-1",
				ReleaseId: existingRelease.ID(),
				Status:    status,
				CreatedAt: time.Now(),
			})

			eval := NewReleaseTargetConcurrencyEvaluator(st)

			// Try to deploy a new release
			newRelease := &oapi.Release{
				ReleaseTarget: *releaseTarget,
				Version: oapi.DeploymentVersion{
					Id:  "version-2",
					Tag: "v2.0.0",
				},
			}

			// Act
			result := eval.Evaluate(ctx, newRelease)

			// Assert: Should DENY
			if result.Allowed {
				t.Errorf("expected denied for status %s, got allowed: %s", status, result.Message)
			}

			if result.Message != "Release target has an active job" {
				t.Errorf("expected 'Release target has an active job', got '%s'", result.Message)
			}

			if result.Details["job_job-1"] != status {
				t.Errorf("expected job_job-1=%s, got %v", status, result.Details["job_job-1"])
			}
		})
	}
}

func TestReleaseTargetConcurrencyEvaluator_AllTerminalStatesAllow(t *testing.T) {
	// Test that all terminal states allow new jobs
	ctx := context.Background()

	terminalStates := []oapi.JobStatus{
		oapi.JobStatusSuccessful,
		oapi.JobStatusFailure,
		oapi.JobStatusCancelled,
		oapi.JobStatusSkipped,
		oapi.JobStatusInvalidJobAgent,
		oapi.JobStatusInvalidIntegration,
		oapi.JobStatusExternalRunNotFound,
	}

	for _, status := range terminalStates {
		t.Run(string(status), func(t *testing.T) {
			st := setupStoreWithResource(t, "resource-1")

			releaseTarget := &oapi.ReleaseTarget{
				DeploymentId:  "deployment-1",
				EnvironmentId: "env-1",
				ResourceId:    "resource-1",
			}

			existingRelease := &oapi.Release{
				ReleaseTarget: *releaseTarget,
				Version: oapi.DeploymentVersion{
					Id:  "version-1",
					Tag: "v1.0.0",
				},
			}

			if err := st.Releases.Upsert(ctx, existingRelease); err != nil {
				t.Fatalf("Failed to upsert existing release: %v", err)
			}

			completedAt := time.Now()
			st.Jobs.Upsert(ctx, &oapi.Job{
				Id:          "job-1",
				ReleaseId:   existingRelease.ID(),
				Status:      status,
				CreatedAt:   time.Now(),
				CompletedAt: &completedAt,
			})

			eval := NewReleaseTargetConcurrencyEvaluator(st)

			// Try to deploy a new release
			newRelease := &oapi.Release{
				ReleaseTarget: *releaseTarget,
				Version: oapi.DeploymentVersion{
					Id:  "version-2",
					Tag: "v2.0.0",
				},
			}

			// Act
			result := eval.Evaluate(ctx, newRelease)

			// Assert: Should ALLOW
			if !result.Allowed {
				t.Errorf("expected allowed for terminal status %s, got denied: %s", status, result.Message)
			}

			if result.Message != "Release target has no active jobs" {
				t.Errorf("expected 'Release target has no active jobs', got '%s'", result.Message)
			}
		})
	}
}
