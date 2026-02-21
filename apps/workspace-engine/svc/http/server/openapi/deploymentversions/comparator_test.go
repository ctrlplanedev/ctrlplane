package deploymentversions

import (
	"testing"
	"time"
	"workspace-engine/pkg/oapi"
)

// Helper function to create a job with specific status and createdAt
func createJob(status oapi.JobStatus, createdAt time.Time) *oapi.Job {
	return &oapi.Job{
		Status:    status,
		CreatedAt: createdAt,
	}
}

// Helper function to create a fullReleaseTarget
func createFullReleaseTarget(jobs []*oapi.Job, resourceName string) *fullReleaseTarget {
	return &fullReleaseTarget{
		Jobs: jobs,
		Resource: &oapi.Resource{
			Name: resourceName,
		},
	}
}

func TestCompareReleaseTargets_NilJobs(t *testing.T) {
	t.Run("both have no jobs", func(t *testing.T) {
		a := createFullReleaseTarget([]*oapi.Job{}, "resource-a")
		b := createFullReleaseTarget([]*oapi.Job{}, "resource-b")

		result := compareReleaseTargets(a, b)
		if result >= 0 {
			t.Errorf("expected resource-a < resource-b, got %d", result)
		}
	})

	t.Run("a has no jobs, b has jobs", func(t *testing.T) {
		a := createFullReleaseTarget([]*oapi.Job{}, "resource-a")
		b := createFullReleaseTarget([]*oapi.Job{
			createJob(oapi.JobStatusPending, time.Now()),
		}, "resource-b")

		result := compareReleaseTargets(a, b)
		if result <= 0 {
			t.Errorf("expected a > b (a with no jobs should come after), got %d", result)
		}
	})

	t.Run("a has jobs, b has no jobs", func(t *testing.T) {
		a := createFullReleaseTarget([]*oapi.Job{
			createJob(oapi.JobStatusPending, time.Now()),
		}, "resource-a")
		b := createFullReleaseTarget([]*oapi.Job{}, "resource-b")

		result := compareReleaseTargets(a, b)
		if result >= 0 {
			t.Errorf("expected a < b (a with jobs should come first), got %d", result)
		}
	})
}

func TestCompareReleaseTargets_FailureStatus(t *testing.T) {
	now := time.Now()

	t.Run("a is failure, b is not", func(t *testing.T) {
		a := createFullReleaseTarget([]*oapi.Job{
			createJob(oapi.JobStatusFailure, now),
		}, "resource-a")
		b := createFullReleaseTarget([]*oapi.Job{
			createJob(oapi.JobStatusSuccessful, now),
		}, "resource-b")

		result := compareReleaseTargets(a, b)
		if result >= 0 {
			t.Errorf("expected failure to come first (negative), got %d", result)
		}
	})

	t.Run("a is not failure, b is failure", func(t *testing.T) {
		a := createFullReleaseTarget([]*oapi.Job{
			createJob(oapi.JobStatusSuccessful, now),
		}, "resource-a")
		b := createFullReleaseTarget([]*oapi.Job{
			createJob(oapi.JobStatusFailure, now),
		}, "resource-b")

		result := compareReleaseTargets(a, b)
		if result <= 0 {
			t.Errorf("expected failure (b) to come first (positive), got %d", result)
		}
	})

	t.Run("both are failures", func(t *testing.T) {
		olderTime := time.Now().Add(-1 * time.Hour)
		newerTime := time.Now()

		a := createFullReleaseTarget([]*oapi.Job{
			createJob(oapi.JobStatusFailure, newerTime),
		}, "resource-a")
		b := createFullReleaseTarget([]*oapi.Job{
			createJob(oapi.JobStatusFailure, olderTime),
		}, "resource-b")

		result := compareReleaseTargets(a, b)
		// Newer should come first (a should be less than b)
		if result >= 0 {
			t.Errorf("expected newer failure to come first (negative), got %d", result)
		}
	})
}

func TestCompareReleaseTargets_StatusComparison(t *testing.T) {
	now := time.Now()

	t.Run("different statuses lexicographic comparison", func(t *testing.T) {
		a := createFullReleaseTarget([]*oapi.Job{
			createJob(oapi.JobStatusInProgress, now),
		}, "resource-a")
		b := createFullReleaseTarget([]*oapi.Job{
			createJob(oapi.JobStatusPending, now),
		}, "resource-b")

		result := compareReleaseTargets(a, b)
		// "inProgress" < "pending" lexicographically
		if result >= 0 {
			t.Errorf("expected inProgress < pending lexicographically, got %d", result)
		}
	})

	t.Run("same status different createdAt", func(t *testing.T) {
		olderTime := time.Now().Add(-1 * time.Hour)
		newerTime := time.Now()

		a := createFullReleaseTarget([]*oapi.Job{
			createJob(oapi.JobStatusPending, newerTime),
		}, "resource-a")
		b := createFullReleaseTarget([]*oapi.Job{
			createJob(oapi.JobStatusPending, olderTime),
		}, "resource-b")

		result := compareReleaseTargets(a, b)
		// Newer should come first (a should be less than b)
		if result >= 0 {
			t.Errorf("expected newer job to come first (negative), got %d", result)
		}
	})
}

func TestCompareReleaseTargets_CreatedAtComparison(t *testing.T) {
	t.Run("newer createdAt comes first", func(t *testing.T) {
		olderTime := time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC)
		newerTime := time.Date(2024, 1, 2, 0, 0, 0, 0, time.UTC)

		a := createFullReleaseTarget([]*oapi.Job{
			createJob(oapi.JobStatusSuccessful, newerTime),
		}, "resource-a")
		b := createFullReleaseTarget([]*oapi.Job{
			createJob(oapi.JobStatusSuccessful, olderTime),
		}, "resource-b")

		result := compareReleaseTargets(a, b)
		// Newer should come first (negative result)
		if result >= 0 {
			t.Errorf("expected newer job to come first, got %d", result)
		}
	})

	t.Run("older createdAt comes after", func(t *testing.T) {
		olderTime := time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC)
		newerTime := time.Date(2024, 1, 2, 0, 0, 0, 0, time.UTC)

		a := createFullReleaseTarget([]*oapi.Job{
			createJob(oapi.JobStatusSuccessful, olderTime),
		}, "resource-a")
		b := createFullReleaseTarget([]*oapi.Job{
			createJob(oapi.JobStatusSuccessful, newerTime),
		}, "resource-b")

		result := compareReleaseTargets(a, b)
		// Older should come after (positive result)
		if result <= 0 {
			t.Errorf("expected older job to come after, got %d", result)
		}
	})
}

func TestCompareReleaseTargets_ResourceNameTiebreaker(t *testing.T) {
	now := time.Now()

	t.Run("same status and createdAt, different resource names", func(t *testing.T) {
		a := createFullReleaseTarget([]*oapi.Job{
			createJob(oapi.JobStatusSuccessful, now),
		}, "resource-a")
		b := createFullReleaseTarget([]*oapi.Job{
			createJob(oapi.JobStatusSuccessful, now),
		}, "resource-b")

		result := compareReleaseTargets(a, b)
		// "resource-a" < "resource-b" lexicographically
		if result >= 0 {
			t.Errorf("expected resource-a < resource-b, got %d", result)
		}
	})

	t.Run("same status and createdAt, reverse resource names", func(t *testing.T) {
		a := createFullReleaseTarget([]*oapi.Job{
			createJob(oapi.JobStatusSuccessful, now),
		}, "resource-z")
		b := createFullReleaseTarget([]*oapi.Job{
			createJob(oapi.JobStatusSuccessful, now),
		}, "resource-a")

		result := compareReleaseTargets(a, b)
		// "resource-z" > "resource-a" lexicographically
		if result <= 0 {
			t.Errorf("expected resource-z > resource-a, got %d", result)
		}
	})

	t.Run("no jobs, different resource names", func(t *testing.T) {
		a := createFullReleaseTarget([]*oapi.Job{}, "alpha")
		b := createFullReleaseTarget([]*oapi.Job{}, "beta")

		result := compareReleaseTargets(a, b)
		// "alpha" < "beta"
		if result >= 0 {
			t.Errorf("expected alpha < beta, got %d", result)
		}
	})
}

func TestCompareReleaseTargets_ComplexScenarios(t *testing.T) {
	now := time.Now()
	oneHourAgo := now.Add(-1 * time.Hour)
	twoDaysAgo := now.Add(-48 * time.Hour)

	t.Run("multiple jobs, only first is considered", func(t *testing.T) {
		a := createFullReleaseTarget([]*oapi.Job{
			createJob(oapi.JobStatusFailure, now),
			createJob(oapi.JobStatusSuccessful, twoDaysAgo),
		}, "resource-a")
		b := createFullReleaseTarget([]*oapi.Job{
			createJob(oapi.JobStatusSuccessful, now),
			createJob(oapi.JobStatusFailure, twoDaysAgo),
		}, "resource-b")

		result := compareReleaseTargets(a, b)
		// a has failure (first job), b has success (first job)
		// Failure should come first
		if result >= 0 {
			t.Errorf("expected failure to prioritize, got %d", result)
		}
	})

	t.Run("realistic sorting scenario", func(t *testing.T) {
		targets := []*fullReleaseTarget{
			createFullReleaseTarget([]*oapi.Job{
				createJob(oapi.JobStatusSuccessful, oneHourAgo),
			}, "server-1"),
			createFullReleaseTarget([]*oapi.Job{
				createJob(oapi.JobStatusFailure, now),
			}, "server-2"),
			createFullReleaseTarget([]*oapi.Job{
				createJob(oapi.JobStatusInProgress, now),
			}, "server-3"),
			createFullReleaseTarget([]*oapi.Job{}, "server-4"),
			createFullReleaseTarget([]*oapi.Job{
				createJob(oapi.JobStatusSuccessful, now),
			}, "server-5"),
		}

		// Expected order after sorting:
		// 1. server-2 (failure, most recent)
		// 2. server-3 (inProgress, now)
		// 3. server-5 (successful, now)
		// 4. server-1 (successful, one hour ago)
		// 5. server-4 (no jobs)

		// Test that failure comes first
		if compareReleaseTargets(targets[1], targets[0]) >= 0 {
			t.Error("failure should come before success")
		}
		if compareReleaseTargets(targets[1], targets[2]) >= 0 {
			t.Error("failure should come before inProgress")
		}

		// Test that no jobs comes last
		if compareReleaseTargets(targets[3], targets[0]) <= 0 {
			t.Error("no jobs should come after jobs")
		}

		// Test that newer comes before older
		if compareReleaseTargets(targets[4], targets[0]) >= 0 {
			t.Error("newer job should come before older job")
		}
	})
}

func TestCompareReleaseTargets_AllJobStatuses(t *testing.T) {
	now := time.Now()
	statuses := []oapi.JobStatus{
		oapi.JobStatusActionRequired,
		oapi.JobStatusCancelled,
		oapi.JobStatusExternalRunNotFound,
		oapi.JobStatusFailure,
		oapi.JobStatusInProgress,
		oapi.JobStatusInvalidIntegration,
		oapi.JobStatusInvalidJobAgent,
		oapi.JobStatusPending,
		oapi.JobStatusSkipped,
		oapi.JobStatusSuccessful,
	}

	t.Run("failure always prioritized", func(t *testing.T) {
		failureTarget := createFullReleaseTarget([]*oapi.Job{
			createJob(oapi.JobStatusFailure, now),
		}, "failure")

		for _, status := range statuses {
			if status == oapi.JobStatusFailure {
				continue
			}

			otherTarget := createFullReleaseTarget([]*oapi.Job{
				createJob(status, now),
			}, "other")

			result := compareReleaseTargets(failureTarget, otherTarget)
			if result >= 0 {
				t.Errorf("failure should come before %s, got %d", status, result)
			}
		}
	})
}
