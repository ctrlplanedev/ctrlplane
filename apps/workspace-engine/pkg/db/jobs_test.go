package db

import (
	"context"
	"fmt"
	"testing"
	"time"
	"workspace-engine/pkg/oapi"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Helper function to validate retrieved jobs
func validateRetrievedJobs(t *testing.T, actualJobs []*oapi.Job, expectedJobs []*oapi.Job) {
	t.Helper()
	if len(actualJobs) != len(expectedJobs) {
		t.Fatalf("expected %d jobs, got %d", len(expectedJobs), len(actualJobs))
	}

	for _, expected := range expectedJobs {
		var actual *oapi.Job
		for _, aj := range actualJobs {
			if aj.Id == expected.Id {
				actual = aj
				break
			}
		}

		if actual == nil {
			t.Fatalf("expected job with id %s not found", expected.Id)
		}
		if actual.Id != expected.Id {
			t.Fatalf("expected job id %s, got %s", expected.Id, actual.Id)
		}
		if actual.ReleaseId != expected.ReleaseId {
			t.Fatalf("expected release_id %s, got %s", expected.ReleaseId, actual.ReleaseId)
		}
		if actual.JobAgentId != expected.JobAgentId {
			t.Fatalf("expected job_agent_id %s, got %s", expected.JobAgentId, actual.JobAgentId)
		}
		if actual.Status != expected.Status {
			t.Fatalf("expected status %s, got %s", expected.Status, actual.Status)
		}

		// Compare external_id
		if (actual.ExternalId == nil) != (expected.ExternalId == nil) {
			t.Fatalf("expected external_id %v, got %v", expected.ExternalId, actual.ExternalId)
		}
		if actual.ExternalId != nil && expected.ExternalId != nil && *actual.ExternalId != *expected.ExternalId {
			t.Fatalf("expected external_id %s, got %s", *expected.ExternalId, *actual.ExternalId)
		}

		// Validate timestamps
		if actual.CreatedAt.IsZero() {
			t.Fatalf("expected job created_at to be set")
		}
		if actual.UpdatedAt.IsZero() {
			t.Fatalf("expected job updated_at to be set")
		}

		// Compare started_at
		if (actual.StartedAt == nil) != (expected.StartedAt == nil) {
			t.Fatalf("expected started_at %v, got %v", expected.StartedAt, actual.StartedAt)
		}

		// Compare completed_at
		if (actual.CompletedAt == nil) != (expected.CompletedAt == nil) {
			t.Fatalf("expected completed_at %v, got %v", expected.CompletedAt, actual.CompletedAt)
		}

		// Validate job_agent_config
		if len(actual.JobAgentConfig) != len(expected.JobAgentConfig) {
			t.Fatalf("expected %d config entries, got %d", len(expected.JobAgentConfig), len(actual.JobAgentConfig))
		}
		for key, expectedValue := range expected.JobAgentConfig {
			actualValue, ok := actual.JobAgentConfig[key]
			if !ok {
				t.Fatalf("expected config key %s not found", key)
			}
			if fmt.Sprintf("%v", actualValue) != fmt.Sprintf("%v", expectedValue) {
				t.Fatalf("expected config[%s] = %v, got %v", key, expectedValue, actualValue)
			}
		}
	}
}

// Helper to create prerequisites for a job
func createJobPrerequisites(t *testing.T, workspaceID string, conn *pgxpool.Conn) (releaseID, jobAgentID string) {
	t.Helper()

	ctx := t.Context()

	// Create all prerequisites for a release
	systemID, deploymentID, versionID, resourceID, environmentID := createReleasePrerequisites(
		t, workspaceID, conn)

	// Create a job agent
	tx, err := conn.Begin(ctx)
	if err != nil {
		t.Fatalf("failed to begin tx: %v", err)
	}
	defer tx.Rollback(ctx)

	jobAgentID = uuid.New().String()
	jobAgent := &oapi.JobAgent{
		Id:          jobAgentID,
		WorkspaceId: workspaceID,
		Name:        fmt.Sprintf("test-agent-%s", jobAgentID[:8]),
		Type:        "kubernetes",
		Config:      map[string]interface{}{},
	}
	if err := writeJobAgent(ctx, jobAgent, tx); err != nil {
		t.Fatalf("failed to create job agent: %v", err)
	}

	if err := tx.Commit(ctx); err != nil {
		t.Fatalf("failed to commit: %v", err)
	}

	// Create a release
	tx, err = conn.Begin(ctx)
	if err != nil {
		t.Fatalf("failed to begin tx: %v", err)
	}
	defer tx.Rollback(ctx)

	release := &oapi.Release{
		ReleaseTarget: oapi.ReleaseTarget{
			ResourceId:    resourceID,
			EnvironmentId: environmentID,
			DeploymentId:  deploymentID,
		},
		Version: oapi.DeploymentVersion{
			Id:           versionID,
			Name:         fmt.Sprintf("version-%s", versionID[:8]),
			Tag:          "v1.0.0",
			DeploymentId: deploymentID,
			Status:       oapi.DeploymentVersionStatusReady,
		},
		Variables: map[string]oapi.LiteralValue{},
	}

	if err := writeRelease(ctx, release, workspaceID, tx); err != nil {
		t.Fatalf("failed to create release: %v", err)
	}

	if err := tx.Commit(ctx); err != nil {
		t.Fatalf("failed to commit: %v", err)
	}

	// Get the release ID that was created
	var createdReleaseID string
	err = conn.QueryRow(ctx,
		`SELECT r.id FROM release r
		INNER JOIN version_release vr ON vr.id = r.version_release_id
		INNER JOIN release_target rt ON rt.id = vr.release_target_id
		WHERE rt.resource_id = $1 AND rt.environment_id = $2 AND rt.deployment_id = $3 AND vr.version_id = $4
		LIMIT 1`,
		resourceID, environmentID, deploymentID, versionID).Scan(&createdReleaseID)
	if err != nil {
		t.Fatalf("failed to get release id: %v", err)
	}

	// Keep systemID to avoid "declared but not used" error
	_ = systemID

	return createdReleaseID, jobAgentID
}

// Helper to cleanup jobs after tests
func cleanupJobs(t *testing.T, conn *pgxpool.Conn, jobIDs ...string) {
	t.Helper()
	if len(jobIDs) == 0 {
		return
	}

	// Use context.Background() instead of t.Context() because cleanup runs after test context is canceled
	ctx := context.Background()
	tx, err := conn.Begin(ctx)
	if err != nil {
		t.Logf("Cleanup: Failed to begin tx: %v", err)
		return
	}
	defer tx.Rollback(ctx)

	for _, jobID := range jobIDs {
		if err := deleteJob(ctx, jobID, tx); err != nil {
			t.Logf("Cleanup: Failed to delete job %s: %v", jobID, err)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		t.Logf("Cleanup: Failed to commit: %v", err)
	}
}

func TestDBJobs_BasicWrite(t *testing.T) {
	workspaceID, conn := setupTestWithWorkspace(t)

	releaseID, jobAgentID := createJobPrerequisites(t, workspaceID, conn)

	tx, err := conn.Begin(t.Context())
	if err != nil {
		t.Fatalf("failed to begin tx: %v", err)
	}
	defer tx.Rollback(t.Context())

	jobID := uuid.New().String()
	externalID := "github-run-123"
	now := time.Now()

	job := &oapi.Job{
		Id:             jobID,
		ReleaseId:      releaseID,
		JobAgentId:     jobAgentID,
		ExternalId:     &externalID,
		Status:         oapi.Pending,
		JobAgentConfig: map[string]interface{}{"key": "value"},
		CreatedAt:      now,
		UpdatedAt:      now,
		StartedAt:      nil,
		CompletedAt:    nil,
	}

	err = writeJob(t.Context(), job, tx)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	err = tx.Commit(t.Context())
	if err != nil {
		t.Fatalf("failed to commit: %v", err)
	}

	// Register cleanup
	t.Cleanup(func() {
		cleanupJobs(t, conn, jobID)
	})

	// Verify job was created and release_job association was automatically created
	actualJobs, err := getJobs(t.Context(), workspaceID)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	validateRetrievedJobs(t, actualJobs, []*oapi.Job{job})

	// Verify release_job association exists
	var count int
	err = conn.QueryRow(t.Context(),
		"SELECT COUNT(*) FROM release_job WHERE release_id = $1 AND job_id = $2",
		releaseID, jobID).Scan(&count)
	if err != nil {
		t.Fatalf("failed to check release_job: %v", err)
	}
	if count != 1 {
		t.Fatalf("expected 1 release_job association, got %d", count)
	}
}

func TestDBJobs_BasicWriteAndUpdate(t *testing.T) {
	workspaceID, conn := setupTestWithWorkspace(t)

	releaseID, jobAgentID := createJobPrerequisites(t, workspaceID, conn)

	// Create job
	tx, err := conn.Begin(t.Context())
	if err != nil {
		t.Fatalf("failed to begin tx: %v", err)
	}
	defer tx.Rollback(t.Context())

	jobID := uuid.New().String()
	now := time.Now()

	job := &oapi.Job{
		Id:             jobID,
		ReleaseId:      releaseID,
		JobAgentId:     jobAgentID,
		ExternalId:     nil,
		Status:         oapi.Pending,
		JobAgentConfig: map[string]interface{}{},
		CreatedAt:      now,
		UpdatedAt:      now,
		StartedAt:      nil,
		CompletedAt:    nil,
	}

	err = writeJob(t.Context(), job, tx)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	err = tx.Commit(t.Context())
	if err != nil {
		t.Fatalf("failed to commit: %v", err)
	}

	// Register cleanup
	t.Cleanup(func() {
		cleanupJobs(t, conn, jobID)
	})

	// Update job
	tx, err = conn.Begin(t.Context())
	if err != nil {
		t.Fatalf("failed to begin tx: %v", err)
	}
	defer tx.Rollback(t.Context())

	startedAt := time.Now()
	externalID := "github-run-456"
	job.Status = oapi.InProgress
	job.StartedAt = &startedAt
	job.ExternalId = &externalID
	job.JobAgentConfig = map[string]interface{}{"updated": "config"}
	job.UpdatedAt = time.Now()

	err = writeJob(t.Context(), job, tx)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	err = tx.Commit(t.Context())
	if err != nil {
		t.Fatalf("failed to commit: %v", err)
	}

	// Verify update
	actualJobs, err := getJobs(t.Context(), workspaceID)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	validateRetrievedJobs(t, actualJobs, []*oapi.Job{job})
}

func TestDBJobs_CompleteJobLifecycle(t *testing.T) {
	workspaceID, conn := setupTestWithWorkspace(t)

	releaseID, jobAgentID := createJobPrerequisites(t, workspaceID, conn)

	// Create job in pending state
	tx, err := conn.Begin(t.Context())
	if err != nil {
		t.Fatalf("failed to begin tx: %v", err)
	}
	defer tx.Rollback(t.Context())

	jobID := uuid.New().String()
	now := time.Now()

	job := &oapi.Job{
		Id:             jobID,
		ReleaseId:      releaseID,
		JobAgentId:     jobAgentID,
		ExternalId:     nil,
		Status:         oapi.Pending,
		JobAgentConfig: map[string]interface{}{"env": "test"},
		CreatedAt:      now,
		UpdatedAt:      now,
		StartedAt:      nil,
		CompletedAt:    nil,
	}

	err = writeJob(t.Context(), job, tx)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	err = tx.Commit(t.Context())
	if err != nil {
		t.Fatalf("failed to commit: %v", err)
	}

	// Register cleanup
	t.Cleanup(func() {
		cleanupJobs(t, conn, jobID)
	})

	// Update to in-progress
	tx, err = conn.Begin(t.Context())
	if err != nil {
		t.Fatalf("failed to begin tx: %v", err)
	}
	defer tx.Rollback(t.Context())

	startedAt := time.Now()
	job.Status = oapi.InProgress
	job.StartedAt = &startedAt
	job.UpdatedAt = time.Now()

	err = writeJob(t.Context(), job, tx)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	err = tx.Commit(t.Context())
	if err != nil {
		t.Fatalf("failed to commit: %v", err)
	}

	// Update to successful
	tx, err = conn.Begin(t.Context())
	if err != nil {
		t.Fatalf("failed to begin tx: %v", err)
	}
	defer tx.Rollback(t.Context())

	completedAt := time.Now()
	job.Status = oapi.Successful
	job.CompletedAt = &completedAt
	job.UpdatedAt = time.Now()

	err = writeJob(t.Context(), job, tx)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	err = tx.Commit(t.Context())
	if err != nil {
		t.Fatalf("failed to commit: %v", err)
	}

	// Verify final state
	actualJobs, err := getJobs(t.Context(), workspaceID)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	validateRetrievedJobs(t, actualJobs, []*oapi.Job{job})
}

func TestDBJobs_BasicWriteAndDelete(t *testing.T) {
	workspaceID, conn := setupTestWithWorkspace(t)

	releaseID, jobAgentID := createJobPrerequisites(t, workspaceID, conn)

	// Create job
	tx, err := conn.Begin(t.Context())
	if err != nil {
		t.Fatalf("failed to begin tx: %v", err)
	}
	defer tx.Rollback(t.Context())

	jobID := uuid.New().String()
	now := time.Now()

	job := &oapi.Job{
		Id:             jobID,
		ReleaseId:      releaseID,
		JobAgentId:     jobAgentID,
		ExternalId:     nil,
		Status:         oapi.Pending,
		JobAgentConfig: map[string]interface{}{},
		CreatedAt:      now,
		UpdatedAt:      now,
		StartedAt:      nil,
		CompletedAt:    nil,
	}

	err = writeJob(t.Context(), job, tx)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	err = tx.Commit(t.Context())
	if err != nil {
		t.Fatalf("failed to commit: %v", err)
	}

	// Register cleanup (will be no-op if test deletes the job)
	t.Cleanup(func() {
		cleanupJobs(t, conn, jobID)
	})

	// Verify job exists
	actualJobs, err := getJobs(t.Context(), workspaceID)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}
	validateRetrievedJobs(t, actualJobs, []*oapi.Job{job})

	// Delete job
	tx, err = conn.Begin(t.Context())
	if err != nil {
		t.Fatalf("failed to begin tx: %v", err)
	}
	defer tx.Rollback(t.Context())

	err = deleteJob(t.Context(), jobID, tx)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	err = tx.Commit(t.Context())
	if err != nil {
		t.Fatalf("failed to commit: %v", err)
	}

	// Verify job is deleted
	actualJobs, err = getJobs(t.Context(), workspaceID)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}
	validateRetrievedJobs(t, actualJobs, []*oapi.Job{})
}

func TestDBJobs_MultipleJobsForSameRelease(t *testing.T) {
	workspaceID, conn := setupTestWithWorkspace(t)

	releaseID, jobAgentID := createJobPrerequisites(t, workspaceID, conn)

	tx, err := conn.Begin(t.Context())
	if err != nil {
		t.Fatalf("failed to begin tx: %v", err)
	}
	defer tx.Rollback(t.Context())

	now := time.Now()

	// Create multiple jobs for the same release
	job1ID := uuid.New().String()
	job1 := &oapi.Job{
		Id:             job1ID,
		ReleaseId:      releaseID,
		JobAgentId:     jobAgentID,
		ExternalId:     nil,
		Status:         oapi.Successful,
		JobAgentConfig: map[string]interface{}{"attempt": 1.0},
		CreatedAt:      now,
		UpdatedAt:      now,
		StartedAt:      nil,
		CompletedAt:    nil,
	}

	job2ID := uuid.New().String()
	externalID2 := "run-456"
	job2 := &oapi.Job{
		Id:             job2ID,
		ReleaseId:      releaseID,
		JobAgentId:     jobAgentID,
		ExternalId:     &externalID2,
		Status:         oapi.InProgress,
		JobAgentConfig: map[string]interface{}{"attempt": 2.0},
		CreatedAt:      now,
		UpdatedAt:      now,
		StartedAt:      nil,
		CompletedAt:    nil,
	}

	err = writeJob(t.Context(), job1, tx)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	err = writeJob(t.Context(), job2, tx)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	err = tx.Commit(t.Context())
	if err != nil {
		t.Fatalf("failed to commit: %v", err)
	}

	// Register cleanup
	t.Cleanup(func() {
		cleanupJobs(t, conn, job1ID, job2ID)
	})

	// Verify both jobs exist
	actualJobs, err := getJobs(t.Context(), workspaceID)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	validateRetrievedJobs(t, actualJobs, []*oapi.Job{job1, job2})
}

func TestDBJobs_ComplexJobAgentConfig(t *testing.T) {
	workspaceID, conn := setupTestWithWorkspace(t)

	releaseID, jobAgentID := createJobPrerequisites(t, workspaceID, conn)

	tx, err := conn.Begin(t.Context())
	if err != nil {
		t.Fatalf("failed to begin tx: %v", err)
	}
	defer tx.Rollback(t.Context())

	jobID := uuid.New().String()
	now := time.Now()

	job := &oapi.Job{
		Id:         jobID,
		ReleaseId:  releaseID,
		JobAgentId: jobAgentID,
		ExternalId: nil,
		Status:     oapi.Pending,
		JobAgentConfig: map[string]interface{}{
			"string":  "value",
			"number":  42.0,
			"boolean": true,
			"nested": map[string]interface{}{
				"key": "value",
			},
			"array": []interface{}{"item1", "item2"},
		},
		CreatedAt:   now,
		UpdatedAt:   now,
		StartedAt:   nil,
		CompletedAt: nil,
	}

	err = writeJob(t.Context(), job, tx)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	err = tx.Commit(t.Context())
	if err != nil {
		t.Fatalf("failed to commit: %v", err)
	}

	// Register cleanup
	t.Cleanup(func() {
		cleanupJobs(t, conn, jobID)
	})

	// Verify job with complex config
	actualJobs, err := getJobs(t.Context(), workspaceID)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	validateRetrievedJobs(t, actualJobs, []*oapi.Job{job})
}

func TestDBJobs_AllJobStatuses(t *testing.T) {
	workspaceID, conn := setupTestWithWorkspace(t)

	releaseID, jobAgentID := createJobPrerequisites(t, workspaceID, conn)

	statuses := []oapi.JobStatus{
		oapi.Pending,
		oapi.InProgress,
		oapi.Successful,
		oapi.Failure,
		oapi.Cancelled,
		oapi.Skipped,
		oapi.ActionRequired,
		oapi.InvalidJobAgent,
		oapi.InvalidIntegration,
		oapi.ExternalRunNotFound,
	}

	jobs := make([]*oapi.Job, 0, len(statuses))

	tx, err := conn.Begin(t.Context())
	if err != nil {
		t.Fatalf("failed to begin tx: %v", err)
	}
	defer tx.Rollback(t.Context())

	now := time.Now()

	for _, status := range statuses {
		jobID := uuid.New().String()
		job := &oapi.Job{
			Id:             jobID,
			ReleaseId:      releaseID,
			JobAgentId:     jobAgentID,
			ExternalId:     nil,
			Status:         status,
			JobAgentConfig: map[string]interface{}{},
			CreatedAt:      now,
			UpdatedAt:      now,
			StartedAt:      nil,
			CompletedAt:    nil,
		}

		err = writeJob(t.Context(), job, tx)
		if err != nil {
			t.Fatalf("expected no errors for status %s, got %v", status, err)
		}

		jobs = append(jobs, job)
	}

	err = tx.Commit(t.Context())
	if err != nil {
		t.Fatalf("failed to commit: %v", err)
	}

	// Collect job IDs for cleanup
	jobIDs := make([]string, 0, len(jobs))
	for _, job := range jobs {
		jobIDs = append(jobIDs, job.Id)
	}

	// Register cleanup
	t.Cleanup(func() {
		cleanupJobs(t, conn, jobIDs...)
	})

	// Verify all jobs with different statuses
	actualJobs, err := getJobs(t.Context(), workspaceID)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	validateRetrievedJobs(t, actualJobs, jobs)
}

func TestDBJobs_WorkspaceIsolation(t *testing.T) {
	workspaceID1, conn1 := setupTestWithWorkspace(t)
	workspaceID2, conn2 := setupTestWithWorkspace(t)

	// Create prerequisites in workspace 1
	releaseID1, jobAgentID1 := createJobPrerequisites(t, workspaceID1, conn1)

	// Create prerequisites in workspace 2
	releaseID2, jobAgentID2 := createJobPrerequisites(t, workspaceID2, conn2)

	// Create job in workspace 1
	tx1, err := conn1.Begin(t.Context())
	if err != nil {
		t.Fatalf("failed to begin tx1: %v", err)
	}
	defer tx1.Rollback(t.Context())

	job1ID := uuid.New().String()
	now := time.Now()
	job1 := &oapi.Job{
		Id:             job1ID,
		ReleaseId:      releaseID1,
		JobAgentId:     jobAgentID1,
		ExternalId:     nil,
		Status:         oapi.Pending,
		JobAgentConfig: map[string]interface{}{"workspace": "1"},
		CreatedAt:      now,
		UpdatedAt:      now,
		StartedAt:      nil,
		CompletedAt:    nil,
	}

	err = writeJob(t.Context(), job1, tx1)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	err = tx1.Commit(t.Context())
	if err != nil {
		t.Fatalf("failed to commit tx1: %v", err)
	}

	// Register cleanup for workspace 1
	t.Cleanup(func() {
		cleanupJobs(t, conn1, job1ID)
	})

	// Create job in workspace 2
	tx2, err := conn2.Begin(t.Context())
	if err != nil {
		t.Fatalf("failed to begin tx2: %v", err)
	}
	defer tx2.Rollback(t.Context())

	job2ID := uuid.New().String()
	job2 := &oapi.Job{
		Id:             job2ID,
		ReleaseId:      releaseID2,
		JobAgentId:     jobAgentID2,
		ExternalId:     nil,
		Status:         oapi.Successful,
		JobAgentConfig: map[string]interface{}{"workspace": "2"},
		CreatedAt:      now,
		UpdatedAt:      now,
		StartedAt:      nil,
		CompletedAt:    nil,
	}

	err = writeJob(t.Context(), job2, tx2)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	err = tx2.Commit(t.Context())
	if err != nil {
		t.Fatalf("failed to commit tx2: %v", err)
	}

	// Register cleanup for workspace 2
	t.Cleanup(func() {
		cleanupJobs(t, conn2, job2ID)
	})

	// Verify workspace 1 only sees its own job
	jobs1, err := getJobs(t.Context(), workspaceID1)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}
	if len(jobs1) != 1 {
		t.Fatalf("expected 1 job in workspace 1, got %d", len(jobs1))
	}
	if jobs1[0].Id != job1ID {
		t.Fatalf("expected job %s in workspace 1, got %s", job1ID, jobs1[0].Id)
	}

	// Verify workspace 2 only sees its own job
	jobs2, err := getJobs(t.Context(), workspaceID2)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}
	if len(jobs2) != 1 {
		t.Fatalf("expected 1 job in workspace 2, got %d", len(jobs2))
	}
	if jobs2[0].Id != job2ID {
		t.Fatalf("expected job %s in workspace 2, got %s", job2ID, jobs2[0].Id)
	}
}

func TestDBJobs_EmptyWorkspace(t *testing.T) {
	workspaceID, _ := setupTestWithWorkspace(t)

	// Query jobs in empty workspace
	actualJobs, err := getJobs(t.Context(), workspaceID)
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	if len(actualJobs) != 0 {
		t.Fatalf("expected 0 jobs, got %d", len(actualJobs))
	}
}

// TestDBJobs_WriteAndRetrieveWithReleaseJob tests the complete flow of writing jobs
// and retrieving them, ensuring release_job associations are automatically created
func TestDBJobs_WriteAndRetrieveWithReleaseJob(t *testing.T) {
	workspaceID, conn := setupTestWithWorkspace(t)

	releaseID, jobAgentID := createJobPrerequisites(t, workspaceID, conn)

	// Create multiple jobs with different statuses
	tx, err := conn.Begin(t.Context())
	if err != nil {
		t.Fatalf("failed to begin tx: %v", err)
	}
	defer tx.Rollback(t.Context())

	now := time.Now()

	// Job 1: Pending
	job1ID := uuid.New().String()
	job1 := &oapi.Job{
		Id:             job1ID,
		ReleaseId:      releaseID,
		JobAgentId:     jobAgentID,
		ExternalId:     nil,
		Status:         oapi.Pending,
		JobAgentConfig: map[string]interface{}{"attempt": 1.0},
		CreatedAt:      now,
		UpdatedAt:      now,
		StartedAt:      nil,
		CompletedAt:    nil,
	}

	// Job 2: In Progress with started time
	job2ID := uuid.New().String()
	startedAt := now.Add(1 * time.Minute)
	externalID2 := "github-run-123"
	job2 := &oapi.Job{
		Id:             job2ID,
		ReleaseId:      releaseID,
		JobAgentId:     jobAgentID,
		ExternalId:     &externalID2,
		Status:         oapi.InProgress,
		JobAgentConfig: map[string]interface{}{"attempt": 2.0},
		CreatedAt:      now,
		UpdatedAt:      now.Add(1 * time.Minute),
		StartedAt:      &startedAt,
		CompletedAt:    nil,
	}

	// Job 3: Successful with completed time
	job3ID := uuid.New().String()
	startedAt3 := now.Add(2 * time.Minute)
	completedAt3 := now.Add(5 * time.Minute)
	externalID3 := "github-run-456"
	job3 := &oapi.Job{
		Id:             job3ID,
		ReleaseId:      releaseID,
		JobAgentId:     jobAgentID,
		ExternalId:     &externalID3,
		Status:         oapi.Successful,
		JobAgentConfig: map[string]interface{}{"attempt": 3.0, "retry": false},
		CreatedAt:      now,
		UpdatedAt:      now.Add(5 * time.Minute),
		StartedAt:      &startedAt3,
		CompletedAt:    &completedAt3,
	}

	// Write all jobs - should automatically create release_job associations
	if err := writeJob(t.Context(), job1, tx); err != nil {
		t.Fatalf("failed to write job1: %v", err)
	}
	if err := writeJob(t.Context(), job2, tx); err != nil {
		t.Fatalf("failed to write job2: %v", err)
	}
	if err := writeJob(t.Context(), job3, tx); err != nil {
		t.Fatalf("failed to write job3: %v", err)
	}

	if err := tx.Commit(t.Context()); err != nil {
		t.Fatalf("failed to commit: %v", err)
	}

	// Register cleanup
	t.Cleanup(func() {
		cleanupJobs(t, conn, job1ID, job2ID, job3ID)
	})

	// Verify all release_job associations were automatically created
	for idx, jobID := range []string{job1ID, job2ID, job3ID} {
		var count int
		err := conn.QueryRow(t.Context(),
			"SELECT COUNT(*) FROM release_job WHERE release_id = $1 AND job_id = $2",
			releaseID, jobID).Scan(&count)
		if err != nil {
			t.Fatalf("failed to check release_job for job %d: %v", idx+1, err)
		}
		if count != 1 {
			t.Fatalf("expected 1 release_job association for job %d, got %d", idx+1, count)
		}
	}

	// Retrieve all jobs and verify they match what we wrote
	actualJobs, err := getJobs(t.Context(), workspaceID)
	if err != nil {
		t.Fatalf("failed to get jobs: %v", err)
	}

	expectedJobs := []*oapi.Job{job1, job2, job3}
	validateRetrievedJobs(t, actualJobs, expectedJobs)

	// Verify that jobs are correctly linked to the release
	var jobCount int
	err = conn.QueryRow(t.Context(),
		`SELECT COUNT(DISTINCT j.id) FROM job j
		INNER JOIN release_job rj ON rj.job_id = j.id
		WHERE rj.release_id = $1`,
		releaseID).Scan(&jobCount)
	if err != nil {
		t.Fatalf("failed to count jobs for release: %v", err)
	}
	if jobCount != 3 {
		t.Fatalf("expected 3 jobs linked to release, got %d", jobCount)
	}

	// Test updating a job and verify the release_job association persists
	tx, err = conn.Begin(t.Context())
	if err != nil {
		t.Fatalf("failed to begin tx for update: %v", err)
	}
	defer tx.Rollback(t.Context())

	// Update job1 to in-progress
	updateStartedAt := time.Now()
	job1.Status = oapi.InProgress
	job1.StartedAt = &updateStartedAt
	job1.UpdatedAt = time.Now()

	if err := writeJob(t.Context(), job1, tx); err != nil {
		t.Fatalf("failed to update job1: %v", err)
	}

	if err := tx.Commit(t.Context()); err != nil {
		t.Fatalf("failed to commit update: %v", err)
	}

	// Verify release_job association still exists after update
	var countAfterUpdate int
	err = conn.QueryRow(t.Context(),
		"SELECT COUNT(*) FROM release_job WHERE release_id = $1 AND job_id = $2",
		releaseID, job1ID).Scan(&countAfterUpdate)
	if err != nil {
		t.Fatalf("failed to check release_job after update: %v", err)
	}
	if countAfterUpdate != 1 {
		t.Fatalf("expected 1 release_job association after update, got %d", countAfterUpdate)
	}

	// Verify the job was actually updated
	updatedJobs, err := getJobs(t.Context(), workspaceID)
	if err != nil {
		t.Fatalf("failed to get jobs after update: %v", err)
	}

	var foundUpdatedJob *oapi.Job
	for _, job := range updatedJobs {
		if job.Id == job1ID {
			foundUpdatedJob = job
			break
		}
	}

	if foundUpdatedJob == nil {
		t.Fatalf("updated job not found")
	}

	if foundUpdatedJob.Status != oapi.InProgress {
		t.Errorf("expected status %s, got %s", oapi.InProgress, foundUpdatedJob.Status)
	}

	if foundUpdatedJob.StartedAt == nil {
		t.Error("expected StartedAt to be set after update")
	}
}
