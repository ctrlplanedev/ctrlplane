package releasetargetconcurrency

import (
	"context"
	"testing"

	"workspace-engine/pkg/oapi"
)

type mockGetters struct {
	processingJobs map[string]map[string]*oapi.Job // keyed by releaseTarget.Key()
}

func (m *mockGetters) GetJobsInProcessingStateForReleaseTarget(_ context.Context, rt *oapi.ReleaseTarget) map[string]*oapi.Job {
	if m.processingJobs == nil {
		return nil
	}
	return m.processingJobs[rt.Key()]
}

func TestReleaseTargetConcurrencyEvaluator_NoActiveJobs(t *testing.T) {
	mock := &mockGetters{}
	eval := NewEvaluator(mock)

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

	result := eval.Evaluate(context.Background(), release)

	if !result.Allowed {
		t.Errorf("expected allowed when no active jobs, got denied: %s", result.Message)
	}

	if result.Message != "Release target has no active jobs" {
		t.Errorf("expected 'Release target has no active jobs', got '%s'", result.Message)
	}
}

func TestReleaseTargetConcurrencyEvaluator_JobInPendingState(t *testing.T) {
	releaseTarget := &oapi.ReleaseTarget{
		DeploymentId:  "deployment-1",
		EnvironmentId: "env-1",
		ResourceId:    "resource-1",
	}

	mock := &mockGetters{
		processingJobs: map[string]map[string]*oapi.Job{
			releaseTarget.Key(): {
				"job-1": {Id: "job-1", Status: oapi.JobStatusPending},
			},
		},
	}
	eval := NewEvaluator(mock)

	newRelease := &oapi.Release{
		ReleaseTarget: *releaseTarget,
		Version: oapi.DeploymentVersion{
			Id:  "version-2",
			Tag: "v2.0.0",
		},
	}

	result := eval.Evaluate(context.Background(), newRelease)

	if result.Allowed {
		t.Errorf("expected denied when job is pending, got allowed: %s", result.Message)
	}

	if result.Message != "Release target has an active job" {
		t.Errorf("expected 'Release target has an active job', got '%s'", result.Message)
	}

	if result.Details["release_target_key"] != releaseTarget.Key() {
		t.Errorf(
			"expected release_target_key=%s, got %v",
			releaseTarget.Key(),
			result.Details["release_target_key"],
		)
	}

	if result.Details["job_job-1"] != oapi.JobStatusPending {
		t.Errorf(
			"expected job_job-1=%s, got %v",
			oapi.JobStatusPending,
			result.Details["job_job-1"],
		)
	}
}

func TestReleaseTargetConcurrencyEvaluator_JobInProgressState(t *testing.T) {
	releaseTarget := &oapi.ReleaseTarget{
		DeploymentId:  "deployment-1",
		EnvironmentId: "env-1",
		ResourceId:    "resource-1",
	}

	mock := &mockGetters{
		processingJobs: map[string]map[string]*oapi.Job{
			releaseTarget.Key(): {
				"job-1": {Id: "job-1", Status: oapi.JobStatusInProgress},
			},
		},
	}
	eval := NewEvaluator(mock)

	newRelease := &oapi.Release{
		ReleaseTarget: *releaseTarget,
		Version: oapi.DeploymentVersion{
			Id:  "version-2",
			Tag: "v2.0.0",
		},
	}

	result := eval.Evaluate(context.Background(), newRelease)

	if result.Allowed {
		t.Errorf("expected denied when job is in progress, got allowed: %s", result.Message)
	}

	if result.Details["job_job-1"] != oapi.JobStatusInProgress {
		t.Errorf(
			"expected job_job-1=%s, got %v",
			oapi.JobStatusInProgress,
			result.Details["job_job-1"],
		)
	}
}

func TestReleaseTargetConcurrencyEvaluator_JobInActionRequiredState(t *testing.T) {
	releaseTarget := &oapi.ReleaseTarget{
		DeploymentId:  "deployment-1",
		EnvironmentId: "env-1",
		ResourceId:    "resource-1",
	}

	mock := &mockGetters{
		processingJobs: map[string]map[string]*oapi.Job{
			releaseTarget.Key(): {
				"job-1": {Id: "job-1", Status: oapi.JobStatusActionRequired},
			},
		},
	}
	eval := NewEvaluator(mock)

	newRelease := &oapi.Release{
		ReleaseTarget: *releaseTarget,
		Version: oapi.DeploymentVersion{
			Id:  "version-2",
			Tag: "v2.0.0",
		},
	}

	result := eval.Evaluate(context.Background(), newRelease)

	if result.Allowed {
		t.Errorf("expected denied when job requires action, got allowed: %s", result.Message)
	}

	if result.Details["job_job-1"] != oapi.JobStatusActionRequired {
		t.Errorf(
			"expected job_job-1=%s, got %v",
			oapi.JobStatusActionRequired,
			result.Details["job_job-1"],
		)
	}
}

func TestReleaseTargetConcurrencyEvaluator_MultipleActiveJobs(t *testing.T) {
	releaseTarget := &oapi.ReleaseTarget{
		DeploymentId:  "deployment-1",
		EnvironmentId: "env-1",
		ResourceId:    "resource-1",
	}

	mock := &mockGetters{
		processingJobs: map[string]map[string]*oapi.Job{
			releaseTarget.Key(): {
				"job-1": {Id: "job-1", Status: oapi.JobStatusPending},
				"job-2": {Id: "job-2", Status: oapi.JobStatusInProgress},
			},
		},
	}
	eval := NewEvaluator(mock)

	newRelease := &oapi.Release{
		ReleaseTarget: *releaseTarget,
		Version: oapi.DeploymentVersion{
			Id:  "version-3",
			Tag: "v3.0.0",
		},
	}

	result := eval.Evaluate(context.Background(), newRelease)

	if result.Allowed {
		t.Errorf("expected denied when multiple jobs are active, got allowed: %s", result.Message)
	}

	if result.Details["job_job-1"] != oapi.JobStatusPending {
		t.Errorf(
			"expected job_job-1=%s, got %v",
			oapi.JobStatusPending,
			result.Details["job_job-1"],
		)
	}

	if result.Details["job_job-2"] != oapi.JobStatusInProgress {
		t.Errorf(
			"expected job_job-2=%s, got %v",
			oapi.JobStatusInProgress,
			result.Details["job_job-2"],
		)
	}
}

func TestReleaseTargetConcurrencyEvaluator_TerminalStateJobsDoNotBlock(t *testing.T) {
	// Terminal-state jobs are NOT in processing state, so mock returns nil/empty.
	releaseTarget := &oapi.ReleaseTarget{
		DeploymentId:  "deployment-1",
		EnvironmentId: "env-1",
		ResourceId:    "resource-1",
	}

	mock := &mockGetters{
		processingJobs: map[string]map[string]*oapi.Job{
			releaseTarget.Key(): {},
		},
	}
	eval := NewEvaluator(mock)

	newRelease := &oapi.Release{
		ReleaseTarget: *releaseTarget,
		Version: oapi.DeploymentVersion{
			Id:  "version-4",
			Tag: "v4.0.0",
		},
	}

	result := eval.Evaluate(context.Background(), newRelease)

	if !result.Allowed {
		t.Errorf("expected allowed when only terminal jobs exist, got denied: %s", result.Message)
	}

	if result.Message != "Release target has no active jobs" {
		t.Errorf("expected 'Release target has no active jobs', got '%s'", result.Message)
	}
}

func TestReleaseTargetConcurrencyEvaluator_DifferentReleaseTargetsDoNotInterfere(t *testing.T) {
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

	// Only target 1 has active jobs; target 2 has none.
	mock := &mockGetters{
		processingJobs: map[string]map[string]*oapi.Job{
			releaseTarget1.Key(): {
				"job-1": {Id: "job-1", Status: oapi.JobStatusInProgress},
			},
		},
	}
	eval := NewEvaluator(mock)

	release2 := &oapi.Release{
		ReleaseTarget: *releaseTarget2,
		Version: oapi.DeploymentVersion{
			Id:  "version-1",
			Tag: "v1.0.0",
		},
	}

	result := eval.Evaluate(context.Background(), release2)

	if !result.Allowed {
		t.Errorf("expected allowed for different release target, got denied: %s", result.Message)
	}
}

func TestReleaseTargetConcurrencyEvaluator_AllProcessingStatesBlock(t *testing.T) {
	processingStates := []oapi.JobStatus{
		oapi.JobStatusPending,
		oapi.JobStatusInProgress,
		oapi.JobStatusActionRequired,
	}

	for _, status := range processingStates {
		t.Run(string(status), func(t *testing.T) {
			releaseTarget := &oapi.ReleaseTarget{
				DeploymentId:  "deployment-1",
				EnvironmentId: "env-1",
				ResourceId:    "resource-1",
			}

			mock := &mockGetters{
				processingJobs: map[string]map[string]*oapi.Job{
					releaseTarget.Key(): {
						"job-1": {Id: "job-1", Status: status},
					},
				},
			}
			eval := NewEvaluator(mock)

			newRelease := &oapi.Release{
				ReleaseTarget: *releaseTarget,
				Version: oapi.DeploymentVersion{
					Id:  "version-2",
					Tag: "v2.0.0",
				},
			}

			result := eval.Evaluate(context.Background(), newRelease)

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
			releaseTarget := &oapi.ReleaseTarget{
				DeploymentId:  "deployment-1",
				EnvironmentId: "env-1",
				ResourceId:    "resource-1",
			}

			// Terminal-state jobs are not in processing state, so mock returns empty.
			mock := &mockGetters{
				processingJobs: map[string]map[string]*oapi.Job{
					releaseTarget.Key(): {},
				},
			}
			eval := NewEvaluator(mock)

			newRelease := &oapi.Release{
				ReleaseTarget: *releaseTarget,
				Version: oapi.DeploymentVersion{
					Id:  "version-2",
					Tag: "v2.0.0",
				},
			}

			result := eval.Evaluate(context.Background(), newRelease)

			if !result.Allowed {
				t.Errorf(
					"expected allowed for terminal status %s, got denied: %s",
					status,
					result.Message,
				)
			}

			if result.Message != "Release target has no active jobs" {
				t.Errorf("expected 'Release target has no active jobs', got '%s'", result.Message)
			}
		})
	}
}
