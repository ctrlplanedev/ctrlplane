package e2e

import (
	"context"
	"testing"
	"time"
	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/oapi"
	"workspace-engine/test/integration"
	c "workspace-engine/test/integration/creators"

	"github.com/google/uuid"
)

// TestEngine_JobStateTransition_PendingToInProgress tests the normal flow
// from pending to in-progress when a job starts execution.
func TestEngine_JobStateTransition_PendingToInProgress(t *testing.T) {
	jobAgentID := uuid.New().String()
	deploymentID := uuid.New().String()
	environmentID := uuid.New().String()
	resourceID := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID),
		),
		integration.WithSystem(
			integration.WithDeployment(
				integration.DeploymentID(deploymentID),
				integration.DeploymentJobAgent(jobAgentID),
				integration.DeploymentCelResourceSelector("true"),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentID),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceID(resourceID),
		),
	)

	ctx := context.Background()

	// Create deployment version to trigger job creation
	version := c.NewDeploymentVersion()
	version.DeploymentId = deploymentID
	version.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, version)

	// Verify job is created in pending state
	jobs := engine.Workspace().Jobs().Items()
	if len(jobs) != 1 {
		t.Fatalf("expected 1 job, got %d", len(jobs))
	}

	var job *oapi.Job
	for _, j := range jobs {
		job = j
		break
	}

	if job.Status != oapi.JobStatusPending {
		t.Fatalf("expected job status to be pending, got %s", job.Status)
	}
	if job.StartedAt != nil {
		t.Fatalf("expected startedAt to be nil for pending job")
	}

	// Transition to inProgress
	jobID := job.Id
	startedAt := time.Now()
	updateEvent := &oapi.JobUpdateEvent{
		Id: &jobID,
		Job: oapi.Job{
			Id:        jobID,
			Status:    oapi.JobStatusInProgress,
			StartedAt: &startedAt,
		},
		FieldsToUpdate: &[]oapi.JobUpdateEventFieldsToUpdate{
			oapi.JobUpdateEventFieldsToUpdateStatus,
			oapi.JobUpdateEventFieldsToUpdateStartedAt,
		},
	}
	engine.PushEvent(ctx, handler.JobUpdate, updateEvent)

	// Verify job transitioned to inProgress
	updatedJob, exists := engine.Workspace().Jobs().Get(jobID)
	if !exists {
		t.Fatal("job not found after update")
	}

	if updatedJob.Status != oapi.JobStatusInProgress {
		t.Fatalf("expected job status to be inProgress, got %s", updatedJob.Status)
	}
	if updatedJob.StartedAt == nil {
		t.Fatal("expected startedAt to be set")
	}

	t.Logf("Job successfully transitioned from pending to inProgress")
}

// TestEngine_JobStateTransition_InProgressToSuccessful tests completing
// a job successfully.
func TestEngine_JobStateTransition_InProgressToSuccessful(t *testing.T) {
	jobAgentID := uuid.New().String()
	deploymentID := uuid.New().String()
	environmentID := uuid.New().String()
	resourceID := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID),
		),
		integration.WithSystem(
			integration.WithDeployment(
				integration.DeploymentID(deploymentID),
				integration.DeploymentJobAgent(jobAgentID),
				integration.DeploymentCelResourceSelector("true"),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentID),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceID(resourceID),
		),
	)

	ctx := context.Background()

	// Create and start a job
	version := c.NewDeploymentVersion()
	version.DeploymentId = deploymentID
	version.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, version)

	var jobID string
	for _, j := range engine.Workspace().Jobs().Items() {
		jobID = j.Id
		break
	}

	// Move to inProgress
	startedAt := time.Now()
	updateEvent := &oapi.JobUpdateEvent{
		Id: &jobID,
		Job: oapi.Job{
			Id:        jobID,
			Status:    oapi.JobStatusInProgress,
			StartedAt: &startedAt,
		},
		FieldsToUpdate: &[]oapi.JobUpdateEventFieldsToUpdate{
			oapi.JobUpdateEventFieldsToUpdateStatus,
			oapi.JobUpdateEventFieldsToUpdateStartedAt,
		},
	}
	engine.PushEvent(ctx, handler.JobUpdate, updateEvent)

	// Complete successfully
	completedAt := time.Now()
	completeEvent := &oapi.JobUpdateEvent{
		Id: &jobID,
		Job: oapi.Job{
			Id:          jobID,
			Status:      oapi.JobStatusSuccessful,
			CompletedAt: &completedAt,
		},
		FieldsToUpdate: &[]oapi.JobUpdateEventFieldsToUpdate{
			oapi.JobUpdateEventFieldsToUpdateStatus,
			oapi.JobUpdateEventFieldsToUpdateCompletedAt,
		},
	}
	engine.PushEvent(ctx, handler.JobUpdate, completeEvent)

	// Verify final state
	finalJob, _ := engine.Workspace().Jobs().Get(jobID)
	if finalJob.Status != oapi.JobStatusSuccessful {
		t.Fatalf("expected job status to be successful, got %s", finalJob.Status)
	}
	if finalJob.CompletedAt == nil {
		t.Fatal("expected completedAt to be set")
	}
	if !finalJob.IsInTerminalState() {
		t.Fatal("expected job to be in terminal state")
	}

	t.Logf("Job successfully completed: %s", finalJob.Status)
}

// TestEngine_JobStateTransition_InProgressToFailure tests a job failing
// during execution.
func TestEngine_JobStateTransition_InProgressToFailure(t *testing.T) {
	jobAgentID := uuid.New().String()
	deploymentID := uuid.New().String()
	environmentID := uuid.New().String()
	resourceID := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID),
		),
		integration.WithSystem(
			integration.WithDeployment(
				integration.DeploymentID(deploymentID),
				integration.DeploymentJobAgent(jobAgentID),
				integration.DeploymentCelResourceSelector("true"),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentID),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceID(resourceID),
		),
	)

	ctx := context.Background()

	// Create and start a job
	version := c.NewDeploymentVersion()
	version.DeploymentId = deploymentID
	version.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, version)

	var jobID string
	for _, j := range engine.Workspace().Jobs().Items() {
		jobID = j.Id
		break
	}

	// Move to inProgress
	startedAt := time.Now()
	updateEvent := &oapi.JobUpdateEvent{
		Id: &jobID,
		Job: oapi.Job{
			Id:        jobID,
			Status:    oapi.JobStatusInProgress,
			StartedAt: &startedAt,
		},
		FieldsToUpdate: &[]oapi.JobUpdateEventFieldsToUpdate{
			oapi.JobUpdateEventFieldsToUpdateStatus,
			oapi.JobUpdateEventFieldsToUpdateStartedAt,
		},
	}
	engine.PushEvent(ctx, handler.JobUpdate, updateEvent)

	// Fail the job
	completedAt := time.Now()
	failEvent := &oapi.JobUpdateEvent{
		Id: &jobID,
		Job: oapi.Job{
			Id:          jobID,
			Status:      oapi.JobStatusFailure,
			CompletedAt: &completedAt,
		},
		FieldsToUpdate: &[]oapi.JobUpdateEventFieldsToUpdate{
			oapi.JobUpdateEventFieldsToUpdateStatus,
			oapi.JobUpdateEventFieldsToUpdateCompletedAt,
		},
	}
	engine.PushEvent(ctx, handler.JobUpdate, failEvent)

	// Verify final state
	finalJob, _ := engine.Workspace().Jobs().Get(jobID)
	if finalJob.Status != oapi.JobStatusFailure {
		t.Fatalf("expected job status to be failure, got %s", finalJob.Status)
	}
	if finalJob.CompletedAt == nil {
		t.Fatal("expected completedAt to be set")
	}
	if !finalJob.IsInTerminalState() {
		t.Fatal("expected job to be in terminal state")
	}

	t.Logf("Job failed as expected: %s", finalJob.Status)
}

// TestEngine_JobStateTransition_PendingToCancelled tests cancelling a
// pending job before it starts.
func TestEngine_JobStateTransition_PendingToCancelled(t *testing.T) {
	jobAgentID := uuid.New().String()
	deploymentID := uuid.New().String()
	environmentID := uuid.New().String()
	resourceID := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID),
		),
		integration.WithSystem(
			integration.WithDeployment(
				integration.DeploymentID(deploymentID),
				integration.DeploymentJobAgent(jobAgentID),
				integration.DeploymentCelResourceSelector("true"),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentID),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceID(resourceID),
		),
	)

	ctx := context.Background()

	// Create job
	version := c.NewDeploymentVersion()
	version.DeploymentId = deploymentID
	version.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, version)

	var jobID string
	for _, j := range engine.Workspace().Jobs().Items() {
		jobID = j.Id
		break
	}

	// Cancel the pending job
	cancelEvent := &oapi.JobUpdateEvent{
		Id: &jobID,
		Job: oapi.Job{
			Id:     jobID,
			Status: oapi.JobStatusCancelled,
		},
		FieldsToUpdate: &[]oapi.JobUpdateEventFieldsToUpdate{
			oapi.JobUpdateEventFieldsToUpdateStatus,
		},
	}
	engine.PushEvent(ctx, handler.JobUpdate, cancelEvent)

	// Verify cancelled state
	cancelledJob, _ := engine.Workspace().Jobs().Get(jobID)
	if cancelledJob.Status != oapi.JobStatusCancelled {
		t.Fatalf("expected job status to be cancelled, got %s", cancelledJob.Status)
	}
	if !cancelledJob.IsInTerminalState() {
		t.Fatal("expected cancelled job to be in terminal state")
	}

	t.Logf("Job successfully cancelled while pending")
}

// TestEngine_JobStateTransition_InProgressToCancelled tests cancelling
// a job that's already running.
func TestEngine_JobStateTransition_InProgressToCancelled(t *testing.T) {
	jobAgentID := uuid.New().String()
	deploymentID := uuid.New().String()
	environmentID := uuid.New().String()
	resourceID := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID),
		),
		integration.WithSystem(
			integration.WithDeployment(
				integration.DeploymentID(deploymentID),
				integration.DeploymentJobAgent(jobAgentID),
				integration.DeploymentCelResourceSelector("true"),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentID),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceID(resourceID),
		),
	)

	ctx := context.Background()

	// Create and start job
	version := c.NewDeploymentVersion()
	version.DeploymentId = deploymentID
	version.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, version)

	var jobID string
	for _, j := range engine.Workspace().Jobs().Items() {
		jobID = j.Id
		break
	}

	// Move to inProgress
	startedAt := time.Now()
	startEvent := &oapi.JobUpdateEvent{
		Id: &jobID,
		Job: oapi.Job{
			Id:        jobID,
			Status:    oapi.JobStatusInProgress,
			StartedAt: &startedAt,
		},
		FieldsToUpdate: &[]oapi.JobUpdateEventFieldsToUpdate{
			oapi.JobUpdateEventFieldsToUpdateStatus,
			oapi.JobUpdateEventFieldsToUpdateStartedAt,
		},
	}
	engine.PushEvent(ctx, handler.JobUpdate, startEvent)

	// Verify inProgress
	inProgressJob, _ := engine.Workspace().Jobs().Get(jobID)
	if inProgressJob.Status != oapi.JobStatusInProgress {
		t.Fatalf("expected job status to be inProgress, got %s", inProgressJob.Status)
	}

	// Cancel while running
	completedAt := time.Now()
	cancelEvent := &oapi.JobUpdateEvent{
		Id: &jobID,
		Job: oapi.Job{
			Id:          jobID,
			Status:      oapi.JobStatusCancelled,
			CompletedAt: &completedAt,
		},
		FieldsToUpdate: &[]oapi.JobUpdateEventFieldsToUpdate{
			oapi.JobUpdateEventFieldsToUpdateStatus,
			oapi.JobUpdateEventFieldsToUpdateCompletedAt,
		},
	}
	engine.PushEvent(ctx, handler.JobUpdate, cancelEvent)

	// Verify cancelled
	cancelledJob, _ := engine.Workspace().Jobs().Get(jobID)
	if cancelledJob.Status != oapi.JobStatusCancelled {
		t.Fatalf("expected job status to be cancelled, got %s", cancelledJob.Status)
	}
	if !cancelledJob.IsInTerminalState() {
		t.Fatal("expected cancelled job to be in terminal state")
	}

	t.Logf("Running job successfully cancelled")
}

// TestEngine_JobStateTransition_SkippedJob tests creating a job in skipped
// state (e.g., due to conditions not being met).
func TestEngine_JobStateTransition_SkippedJob(t *testing.T) {
	jobAgentID := uuid.New().String()
	deploymentID := uuid.New().String()
	environmentID := uuid.New().String()
	resourceID := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID),
		),
		integration.WithSystem(
			integration.WithDeployment(
				integration.DeploymentID(deploymentID),
				integration.DeploymentJobAgent(jobAgentID),
				integration.DeploymentCelResourceSelector("true"),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentID),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceID(resourceID),
		),
	)

	ctx := context.Background()

	// Create job
	version := c.NewDeploymentVersion()
	version.DeploymentId = deploymentID
	version.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, version)

	var jobID string
	for _, j := range engine.Workspace().Jobs().Items() {
		jobID = j.Id
		break
	}

	// Mark as skipped
	skipEvent := &oapi.JobUpdateEvent{
		Id: &jobID,
		Job: oapi.Job{
			Id:     jobID,
			Status: oapi.JobStatusSkipped,
		},
		FieldsToUpdate: &[]oapi.JobUpdateEventFieldsToUpdate{
			oapi.JobUpdateEventFieldsToUpdateStatus,
		},
	}
	engine.PushEvent(ctx, handler.JobUpdate, skipEvent)

	// Verify skipped
	skippedJob, _ := engine.Workspace().Jobs().Get(jobID)
	if skippedJob.Status != oapi.JobStatusSkipped {
		t.Fatalf("expected job status to be skipped, got %s", skippedJob.Status)
	}
	if !skippedJob.IsInTerminalState() {
		t.Fatal("expected skipped job to be in terminal state")
	}

	t.Logf("Job successfully marked as skipped")
}

// TestEngine_JobStateTransition_ActionRequired tests a job requiring manual
// intervention.
func TestEngine_JobStateTransition_ActionRequired(t *testing.T) {
	jobAgentID := uuid.New().String()
	deploymentID := uuid.New().String()
	environmentID := uuid.New().String()
	resourceID := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID),
		),
		integration.WithSystem(
			integration.WithDeployment(
				integration.DeploymentID(deploymentID),
				integration.DeploymentJobAgent(jobAgentID),
				integration.DeploymentCelResourceSelector("true"),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentID),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceID(resourceID),
		),
	)

	ctx := context.Background()

	// Create and start job
	version := c.NewDeploymentVersion()
	version.DeploymentId = deploymentID
	version.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, version)

	var jobID string
	for _, j := range engine.Workspace().Jobs().Items() {
		jobID = j.Id
		break
	}

	// Move to inProgress
	startedAt := time.Now()
	startEvent := &oapi.JobUpdateEvent{
		Id: &jobID,
		Job: oapi.Job{
			Id:        jobID,
			Status:    oapi.JobStatusInProgress,
			StartedAt: &startedAt,
		},
		FieldsToUpdate: &[]oapi.JobUpdateEventFieldsToUpdate{
			oapi.JobUpdateEventFieldsToUpdateStatus,
			oapi.JobUpdateEventFieldsToUpdateStartedAt,
		},
	}
	engine.PushEvent(ctx, handler.JobUpdate, startEvent)

	// Require action
	actionEvent := &oapi.JobUpdateEvent{
		Id: &jobID,
		Job: oapi.Job{
			Id:     jobID,
			Status: oapi.JobStatusActionRequired,
		},
		FieldsToUpdate: &[]oapi.JobUpdateEventFieldsToUpdate{
			oapi.JobUpdateEventFieldsToUpdateStatus,
		},
	}
	engine.PushEvent(ctx, handler.JobUpdate, actionEvent)

	// Verify action required
	actionJob, _ := engine.Workspace().Jobs().Get(jobID)
	if actionJob.Status != oapi.JobStatusActionRequired {
		t.Fatalf("expected job status to be actionRequired, got %s", actionJob.Status)
	}
	if actionJob.IsInTerminalState() {
		t.Fatal("expected actionRequired job NOT to be in terminal state")
	}
	if !actionJob.IsInProcessingState() {
		t.Fatal("expected actionRequired job to be in processing state")
	}

	// Resume from action required back to inProgress
	resumeEvent := &oapi.JobUpdateEvent{
		Id: &jobID,
		Job: oapi.Job{
			Id:     jobID,
			Status: oapi.JobStatusInProgress,
		},
		FieldsToUpdate: &[]oapi.JobUpdateEventFieldsToUpdate{
			oapi.JobUpdateEventFieldsToUpdateStatus,
		},
	}
	engine.PushEvent(ctx, handler.JobUpdate, resumeEvent)

	resumedJob, _ := engine.Workspace().Jobs().Get(jobID)
	if resumedJob.Status != oapi.JobStatusInProgress {
		t.Fatalf("expected job to resume to inProgress, got %s", resumedJob.Status)
	}

	t.Logf("Job successfully handled actionRequired state and resumed")
}

// TestEngine_JobStateTransition_InvalidStates tests attempting to transition
// to invalid job agent states.
func TestEngine_JobStateTransition_InvalidStates(t *testing.T) {
	jobAgentID := uuid.New().String()
	deploymentID := uuid.New().String()
	environmentID := uuid.New().String()
	resourceID := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID),
		),
		integration.WithSystem(
			integration.WithDeployment(
				integration.DeploymentID(deploymentID),
				integration.DeploymentJobAgent(jobAgentID),
				integration.DeploymentCelResourceSelector("true"),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentID),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceID(resourceID),
		),
	)

	ctx := context.Background()

	// Create job
	version := c.NewDeploymentVersion()
	version.DeploymentId = deploymentID
	version.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, version)

	var jobID string
	for _, j := range engine.Workspace().Jobs().Items() {
		jobID = j.Id
		break
	}

	// Test InvalidJobAgent status
	invalidAgentEvent := &oapi.JobUpdateEvent{
		Id: &jobID,
		Job: oapi.Job{
			Id:     jobID,
			Status: oapi.JobStatusInvalidJobAgent,
		},
		FieldsToUpdate: &[]oapi.JobUpdateEventFieldsToUpdate{
			oapi.JobUpdateEventFieldsToUpdateStatus,
		},
	}
	engine.PushEvent(ctx, handler.JobUpdate, invalidAgentEvent)

	invalidAgentJob, _ := engine.Workspace().Jobs().Get(jobID)
	if invalidAgentJob.Status != oapi.JobStatusInvalidJobAgent {
		t.Fatalf("expected job status to be invalidJobAgent, got %s", invalidAgentJob.Status)
	}
	if !invalidAgentJob.IsInTerminalState() {
		t.Fatal("expected invalidJobAgent to be terminal state")
	}

	t.Logf("Job correctly marked with invalid states")
}

// TestEngine_JobStateTransition_MultipleJobsIndependentStates tests that
// multiple jobs maintain independent states.
func TestEngine_JobStateTransition_MultipleJobsIndependentStates(t *testing.T) {
	jobAgentID := uuid.New().String()
	deploymentID := uuid.New().String()
	environmentID := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID),
		),
		integration.WithSystem(
			integration.WithDeployment(
				integration.DeploymentID(deploymentID),
				integration.DeploymentJobAgent(jobAgentID),
				integration.DeploymentCelResourceSelector("true"),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentID),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceName("resource-1"),
		),
		integration.WithResource(
			integration.ResourceName("resource-2"),
		),
		integration.WithResource(
			integration.ResourceName("resource-3"),
		),
	)

	ctx := context.Background()

	// Create deployment to trigger 3 jobs
	version := c.NewDeploymentVersion()
	version.DeploymentId = deploymentID
	version.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, version)

	jobs := engine.Workspace().Jobs().Items()
	if len(jobs) != 3 {
		t.Fatalf("expected 3 jobs, got %d", len(jobs))
	}

	// Get job IDs
	jobIDs := make([]string, 0, 3)
	for _, j := range jobs {
		jobIDs = append(jobIDs, j.Id)
	}

	// Job 1: Move to inProgress
	startedAt1 := time.Now()
	engine.PushEvent(ctx, handler.JobUpdate, &oapi.JobUpdateEvent{
		Id: &jobIDs[0],
		Job: oapi.Job{
			Id:        jobIDs[0],
			Status:    oapi.JobStatusInProgress,
			StartedAt: &startedAt1,
		},
		FieldsToUpdate: &[]oapi.JobUpdateEventFieldsToUpdate{oapi.JobUpdateEventFieldsToUpdateStatus, oapi.JobUpdateEventFieldsToUpdateStartedAt},
	})

	// Job 2: Complete successfully
	completedAt2 := time.Now()
	engine.PushEvent(ctx, handler.JobUpdate, &oapi.JobUpdateEvent{
		Id: &jobIDs[1],
		Job: oapi.Job{
			Id:          jobIDs[1],
			Status:      oapi.JobStatusSuccessful,
			CompletedAt: &completedAt2,
		},
		FieldsToUpdate: &[]oapi.JobUpdateEventFieldsToUpdate{oapi.JobUpdateEventFieldsToUpdateStatus, oapi.JobUpdateEventFieldsToUpdateCompletedAt},
	})

	// Job 3: Cancel
	engine.PushEvent(ctx, handler.JobUpdate, &oapi.JobUpdateEvent{
		Id: &jobIDs[2],
		Job: oapi.Job{
			Id:     jobIDs[2],
			Status: oapi.JobStatusCancelled,
		},
		FieldsToUpdate: &[]oapi.JobUpdateEventFieldsToUpdate{oapi.JobUpdateEventFieldsToUpdateStatus},
	})

	// Verify all jobs have different states
	job1, _ := engine.Workspace().Jobs().Get(jobIDs[0])
	job2, _ := engine.Workspace().Jobs().Get(jobIDs[1])
	job3, _ := engine.Workspace().Jobs().Get(jobIDs[2])

	if job1.Status != oapi.JobStatusInProgress {
		t.Fatalf("job1 should be inProgress, got %s", job1.Status)
	}
	if job2.Status != oapi.JobStatusSuccessful {
		t.Fatalf("job2 should be successful, got %s", job2.Status)
	}
	if job3.Status != oapi.JobStatusCancelled {
		t.Fatalf("job3 should be cancelled, got %s", job3.Status)
	}

	// Verify active vs terminal states
	if !job1.IsInProcessingState() {
		t.Fatal("job1 should be in processing state")
	}
	if !job2.IsInTerminalState() {
		t.Fatal("job2 should be in terminal state")
	}
	if !job3.IsInTerminalState() {
		t.Fatal("job3 should be in terminal state")
	}

	t.Logf("Multiple jobs maintained independent states correctly")
}

// TestEngine_JobStateTransition_FieldUpdateValidation tests that only
// specified fields are updated when FieldsToUpdate is provided.
func TestEngine_JobStateTransition_FieldUpdateValidation(t *testing.T) {
	jobAgentID := uuid.New().String()
	deploymentID := uuid.New().String()
	environmentID := uuid.New().String()
	resourceID := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID),
		),
		integration.WithSystem(
			integration.WithDeployment(
				integration.DeploymentID(deploymentID),
				integration.DeploymentJobAgent(jobAgentID),
				integration.DeploymentCelResourceSelector("true"),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentID),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceID(resourceID),
		),
	)

	ctx := context.Background()

	// Create job
	version := c.NewDeploymentVersion()
	version.DeploymentId = deploymentID
	version.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, version)

	var jobID string
	var originalJob *oapi.Job
	for _, j := range engine.Workspace().Jobs().Items() {
		jobID = j.Id
		originalJob = j
		break
	}

	originalMetadata := originalJob.Metadata
	originalUpdatedAt := originalJob.UpdatedAt

	// Add small delay to ensure updatedAt will be different
	time.Sleep(10 * time.Millisecond)

	// Update only status field, but provide metadata in the event
	// Only status should be updated
	updateEvent := &oapi.JobUpdateEvent{
		Id: &jobID,
		Job: oapi.Job{
			Id:     jobID,
			Status: oapi.JobStatusInProgress,
			Metadata: map[string]string{
				"should-not": "be-updated",
			},
		},
		FieldsToUpdate: &[]oapi.JobUpdateEventFieldsToUpdate{
			oapi.JobUpdateEventFieldsToUpdateStatus, // Only update status
		},
	}
	engine.PushEvent(ctx, handler.JobUpdate, updateEvent)

	// Verify only status changed
	updatedJob, _ := engine.Workspace().Jobs().Get(jobID)
	if updatedJob.Status != oapi.JobStatusInProgress {
		t.Fatalf("expected status to be updated to inProgress, got %s", updatedJob.Status)
	}

	// Metadata should NOT have changed (not in FieldsToUpdate)
	if len(updatedJob.Metadata) != len(originalMetadata) {
		t.Fatalf("metadata should not have changed, original had %d keys, now has %d",
			len(originalMetadata), len(updatedJob.Metadata))
	}

	// UpdatedAt should be equal or after original (always updated on job upsert)
	if updatedJob.UpdatedAt.Before(originalUpdatedAt) {
		t.Fatal("updatedAt should not go backwards")
	}

	t.Logf("Field-selective update worked correctly")
}

// TestEngine_JobStateTransition_TimestampProgression tests that job timestamps
// progress correctly through state transitions.
func TestEngine_JobStateTransition_TimestampProgression(t *testing.T) {
	jobAgentID := uuid.New().String()
	deploymentID := uuid.New().String()
	environmentID := uuid.New().String()
	resourceID := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID),
		),
		integration.WithSystem(
			integration.WithDeployment(
				integration.DeploymentID(deploymentID),
				integration.DeploymentJobAgent(jobAgentID),
				integration.DeploymentCelResourceSelector("true"),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentID),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceID(resourceID),
		),
	)

	ctx := context.Background()

	// Create job
	version := c.NewDeploymentVersion()
	version.DeploymentId = deploymentID
	version.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, version)

	var jobID string
	var createdAt time.Time
	for _, j := range engine.Workspace().Jobs().Items() {
		jobID = j.Id
		createdAt = j.CreatedAt
		break
	}

	// Start the job (set startedAt)
	time.Sleep(10 * time.Millisecond) // Ensure different timestamp
	startedAt := time.Now()
	engine.PushEvent(ctx, handler.JobUpdate, &oapi.JobUpdateEvent{
		Id: &jobID,
		Job: oapi.Job{
			Id:        jobID,
			Status:    oapi.JobStatusInProgress,
			StartedAt: &startedAt,
		},
		FieldsToUpdate: &[]oapi.JobUpdateEventFieldsToUpdate{oapi.JobUpdateEventFieldsToUpdateStatus, oapi.JobUpdateEventFieldsToUpdateStartedAt},
	})

	// Complete the job (set completedAt)
	time.Sleep(10 * time.Millisecond) // Ensure different timestamp
	completedAt := time.Now()
	engine.PushEvent(ctx, handler.JobUpdate, &oapi.JobUpdateEvent{
		Id: &jobID,
		Job: oapi.Job{
			Id:          jobID,
			Status:      oapi.JobStatusSuccessful,
			CompletedAt: &completedAt,
		},
		FieldsToUpdate: &[]oapi.JobUpdateEventFieldsToUpdate{oapi.JobUpdateEventFieldsToUpdateStatus, oapi.JobUpdateEventFieldsToUpdateCompletedAt},
	})

	// Verify timestamp progression
	finalJob, _ := engine.Workspace().Jobs().Get(jobID)

	if finalJob.StartedAt == nil {
		t.Fatal("startedAt should be set")
	}
	if finalJob.CompletedAt == nil {
		t.Fatal("completedAt should be set")
	}

	// Verify: createdAt < startedAt < completedAt
	if !finalJob.StartedAt.After(createdAt) {
		t.Fatal("startedAt should be after createdAt")
	}
	if !finalJob.CompletedAt.After(*finalJob.StartedAt) {
		t.Fatal("completedAt should be after startedAt")
	}

	t.Logf("Timestamp progression validated: created=%s, started=%s, completed=%s",
		createdAt.Format(time.RFC3339),
		finalJob.StartedAt.Format(time.RFC3339),
		finalJob.CompletedAt.Format(time.RFC3339))
}
