package e2e

import (
	"context"
	"testing"
	"time"
	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/oapi"
	"workspace-engine/test/integration"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestEngine_VerificationLifecycle_StartAndComplete tests a full verification lifecycle:
// start verification, wait for metric completion, verify the hooks fired.
func TestEngine_VerificationLifecycle_StartAndComplete(t *testing.T) {
	jobAgentID := uuid.New().String()
	deploymentID := uuid.New().String()
	environmentID := uuid.New().String()
	resourceID := uuid.New().String()

	ws := integration.NewTestWorkspace(t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID),
		),
		integration.WithSystem(
			integration.WithDeployment(
				integration.DeploymentID(deploymentID),
				integration.DeploymentJobAgent(jobAgentID),
				integration.DeploymentCelResourceSelector("true"),
				integration.WithDeploymentVersion(
					integration.DeploymentVersionTag("v1.0.0"),
				),
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

	// Get the job
	agentJobs := ws.Workspace().Store().Jobs.GetJobsForAgent(jobAgentID)
	require.Len(t, agentJobs, 1)
	var job *oapi.Job
	for _, j := range agentJobs {
		job = j
	}

	// Start a verification with a sleep metric
	metricProvider := oapi.MetricProvider{}
	_ = metricProvider.FromSleepMetricProvider(oapi.SleepMetricProvider{
		Type:            oapi.Sleep,
		DurationSeconds: 0,
	})

	metric := oapi.VerificationMetricSpec{
		Name:             "health",
		IntervalSeconds:  1,
		Count:            2,
		SuccessCondition: "result.ok == true",
		Provider:         metricProvider,
	}

	err := ws.Workspace().ReleaseManager().VerificationManager().StartVerification(ctx, job, []oapi.VerificationMetricSpec{metric})
	require.NoError(t, err)

	// Mark job successful
	completedAt := time.Now()
	ws.PushEvent(ctx, handler.JobUpdate, oapi.JobUpdateEvent{
		Id:      &job.Id,
		AgentId: &jobAgentID,
		Job: oapi.Job{
			Id:          job.Id,
			Status:      oapi.JobStatusSuccessful,
			CompletedAt: &completedAt,
		},
		FieldsToUpdate: &[]oapi.JobUpdateEventFieldsToUpdate{
			oapi.JobUpdateEventFieldsToUpdateStatus,
			oapi.JobUpdateEventFieldsToUpdateCompletedAt,
		},
	})

	// Wait for verification to complete (2 measurements at 1s intervals)
	time.Sleep(4 * time.Second)

	// Verify verification exists and has measurements
	verifications := ws.Workspace().Store().JobVerifications.GetByJobId(job.Id)
	require.Len(t, verifications, 1)

	v := verifications[0]
	assert.Equal(t, job.Id, v.JobId)
	assert.NotEmpty(t, v.Metrics)
	assert.NotEmpty(t, v.Metrics[0].Measurements)

	// Verify the verification status
	status := v.Status()
	assert.NotEmpty(t, string(status))
}

// TestEngine_VerificationLifecycle_StopForJob tests that stopping verifications
// for a job properly cancels the running verification.
func TestEngine_VerificationLifecycle_StopForJob(t *testing.T) {
	jobAgentID := uuid.New().String()
	deploymentID := uuid.New().String()
	environmentID := uuid.New().String()
	resourceID := uuid.New().String()

	ws := integration.NewTestWorkspace(t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID),
		),
		integration.WithSystem(
			integration.WithDeployment(
				integration.DeploymentID(deploymentID),
				integration.DeploymentJobAgent(jobAgentID),
				integration.DeploymentCelResourceSelector("true"),
				integration.WithDeploymentVersion(
					integration.DeploymentVersionTag("v1.0.0"),
				),
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

	// Get the job
	agentJobs := ws.Workspace().Store().Jobs.GetJobsForAgent(jobAgentID)
	require.Len(t, agentJobs, 1)
	var job *oapi.Job
	for _, j := range agentJobs {
		job = j
	}

	// Start verification with many measurements (long-running)
	metricProvider := oapi.MetricProvider{}
	_ = metricProvider.FromSleepMetricProvider(oapi.SleepMetricProvider{
		Type:            oapi.Sleep,
		DurationSeconds: 0,
	})

	metric := oapi.VerificationMetricSpec{
		Name:             "long-check",
		IntervalSeconds:  1,
		Count:            100, // very long
		SuccessCondition: "result.ok == true",
		Provider:         metricProvider,
	}

	err := ws.Workspace().ReleaseManager().VerificationManager().StartVerification(ctx, job, []oapi.VerificationMetricSpec{metric})
	require.NoError(t, err)

	time.Sleep(500 * time.Millisecond)

	// Verify verification was started
	verifications := ws.Workspace().Store().JobVerifications.GetByJobId(job.Id)
	assert.Len(t, verifications, 1)

	// Stop verifications for this job
	ws.Workspace().ReleaseManager().VerificationManager().StopVerificationsForJob(ctx, job.Id)

	// Allow cleanup
	time.Sleep(500 * time.Millisecond)

	// Verification should still exist in the store (just stopped, not removed)
	verifications = ws.Workspace().Store().JobVerifications.GetByJobId(job.Id)
	assert.Len(t, verifications, 1)
}

// TestEngine_VerificationLifecycle_MultipleMetrics tests starting a verification with
// multiple metrics at once.
func TestEngine_VerificationLifecycle_MultipleMetrics(t *testing.T) {
	jobAgentID := uuid.New().String()
	deploymentID := uuid.New().String()
	environmentID := uuid.New().String()
	resourceID := uuid.New().String()

	ws := integration.NewTestWorkspace(t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID),
		),
		integration.WithSystem(
			integration.WithDeployment(
				integration.DeploymentID(deploymentID),
				integration.DeploymentJobAgent(jobAgentID),
				integration.DeploymentCelResourceSelector("true"),
				integration.WithDeploymentVersion(
					integration.DeploymentVersionTag("v1.0.0"),
				),
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

	agentJobs := ws.Workspace().Store().Jobs.GetJobsForAgent(jobAgentID)
	require.Len(t, agentJobs, 1)
	var job *oapi.Job
	for _, j := range agentJobs {
		job = j
	}

	metricProvider := oapi.MetricProvider{}
	_ = metricProvider.FromSleepMetricProvider(oapi.SleepMetricProvider{
		Type:            oapi.Sleep,
		DurationSeconds: 0,
	})

	metrics := []oapi.VerificationMetricSpec{
		{
			Name:             "health-check",
			IntervalSeconds:  1,
			Count:            1,
			SuccessCondition: "result.ok == true",
			Provider:         metricProvider,
		},
		{
			Name:             "latency-check",
			IntervalSeconds:  1,
			Count:            1,
			SuccessCondition: "result.ok == true",
			Provider:         metricProvider,
		},
	}

	err := ws.Workspace().ReleaseManager().VerificationManager().StartVerification(ctx, job, metrics)
	require.NoError(t, err)

	time.Sleep(3 * time.Second)

	verifications := ws.Workspace().Store().JobVerifications.GetByJobId(job.Id)
	require.Len(t, verifications, 1)

	v := verifications[0]
	// Should have 2 metrics
	assert.Len(t, v.Metrics, 2)
}
