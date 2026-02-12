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
)

func TestEngineVerificationHooks(t *testing.T) {
	jobAgentID := uuid.New().String()
	deploymentID := uuid.New().String()
	environmentID := uuid.New().String()
	resourceID := uuid.New().String()

	ws := integration.NewTestWorkspace(t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID),
			integration.JobAgentName("test-job-agent"),
		),
		integration.WithSystem(
			integration.SystemName("test-system"),
			integration.WithDeployment(
				integration.DeploymentID(deploymentID),
				integration.DeploymentName("test-deployment"),
				integration.DeploymentJobAgent(jobAgentID),
				integration.DeploymentCelResourceSelector("true"),
				integration.WithDeploymentVersion(
					integration.DeploymentVersionTag("v1.0.0"),
				),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentID),
				integration.EnvironmentName("test-environment"),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceID(resourceID),
			integration.ResourceName("test-resource"),
			integration.ResourceKind("test-resource"),
		),
	)

	ctx := context.Background()

	// start verification for release
	releases := ws.Workspace().Store().Releases.Items()
	releasesSlice := make([]*oapi.Release, 0, len(releases))
	for _, release := range releases {
		releasesSlice = append(releasesSlice, release)
	}
	assert.Len(t, releasesSlice, 1)
	release := releasesSlice[0]

	metricProvider := oapi.MetricProvider{}
	_ = metricProvider.FromSleepMetricProvider(oapi.SleepMetricProvider{
		Type:            oapi.Sleep,
		DurationSeconds: 3,
	})

	successCondition := "result.ok == true"
	metric := oapi.VerificationMetricSpec{
		Name:             "test-metric",
		IntervalSeconds:  3,
		Count:            1,
		SuccessCondition: successCondition,
		Provider:         metricProvider,
	}

	// Get the job that was created for the release
	agentJobs := ws.Workspace().Store().Jobs.GetJobsForAgent(jobAgentID)
	agentJobsSlice := make([]*oapi.Job, 0, len(agentJobs))
	for _, job := range agentJobs {
		agentJobsSlice = append(agentJobsSlice, job)
	}
	assert.Len(t, agentJobsSlice, 1)
	agentJob := agentJobsSlice[0]

	err := ws.Workspace().ReleaseManager().VerificationManager().StartVerification(ctx, agentJob, []oapi.VerificationMetricSpec{metric})
	assert.NoError(t, err)

	time.Sleep(500 * time.Millisecond)

	verifications := ws.Workspace().Store().JobVerifications.GetByJobId(agentJob.Id)
	assert.Len(t, verifications, 1)
	verification := verifications[0]
	assert.Equal(t, agentJob.Id, verification.JobId)

	// mark job as successful
	completedAt := time.Now()
	jobUpdateEvent := oapi.JobUpdateEvent{
		Id:      &agentJob.Id,
		AgentId: &jobAgentID,
		Job: oapi.Job{
			Id:          agentJob.Id,
			Status:      oapi.JobStatusSuccessful,
			CompletedAt: &completedAt,
		},
		FieldsToUpdate: &[]oapi.JobUpdateEventFieldsToUpdate{
			oapi.JobUpdateEventFieldsToUpdateStatus,
			oapi.JobUpdateEventFieldsToUpdateCompletedAt,
		},
	}

	ws.PushEvent(ctx, handler.JobUpdate, jobUpdateEvent)

	// verify current release is nil since verification is not yet completed
	rm := ws.Workspace().ReleaseManager()
	releaseTarget := release.ReleaseTarget
	releaseTargetState, err := rm.GetReleaseTargetState(ctx, &releaseTarget)
	assert.NoError(t, err)

	assert.Nil(t, releaseTargetState.CurrentRelease)

	time.Sleep(5 * time.Second)

	// verify current release is set since verification is completed
	releaseTargetState, err = rm.GetReleaseTargetState(ctx, &releaseTarget)
	assert.NoError(t, err)

	if releaseTargetState.CurrentRelease == nil {
		t.Fatalf("expected current release, got nil")
	}
	assert.Equal(t, release.ID(), releaseTargetState.CurrentRelease.ID())
}

func TestEngineVerificationHooks_SuccessThreshold(t *testing.T) {
	jobAgentID := uuid.New().String()
	deploymentID := uuid.New().String()
	environmentID := uuid.New().String()
	resourceID := uuid.New().String()

	ws := integration.NewTestWorkspace(t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID),
			integration.JobAgentName("test-job-agent"),
		),
		integration.WithSystem(
			integration.SystemName("test-system"),
			integration.WithDeployment(
				integration.DeploymentID(deploymentID),
				integration.DeploymentName("test-deployment"),
				integration.DeploymentJobAgent(jobAgentID),
				integration.DeploymentCelResourceSelector("true"),
				integration.WithDeploymentVersion(
					integration.DeploymentVersionTag("v1.0.0"),
				),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentID),
				integration.EnvironmentName("test-environment"),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceID(resourceID),
			integration.ResourceName("test-resource"),
			integration.ResourceKind("test-resource"),
		),
	)

	ctx := context.Background()

	// start verification for release
	releases := ws.Workspace().Store().Releases.Items()
	releasesSlice := make([]*oapi.Release, 0, len(releases))
	for _, release := range releases {
		releasesSlice = append(releasesSlice, release)
	}
	assert.Len(t, releasesSlice, 1)
	release := releasesSlice[0]

	metricProvider := oapi.MetricProvider{}
	_ = metricProvider.FromSleepMetricProvider(oapi.SleepMetricProvider{
		Type:            oapi.Sleep,
		DurationSeconds: 0, // instant measurements for fast test
	})

	successCondition := "result.ok == true"
	metric := oapi.VerificationMetricSpec{
		Name:             "test-metric",
		IntervalSeconds:  1, // short interval for quick measurements
		Count:            5,
		SuccessCondition: successCondition,
		SuccessThreshold: &[]int{2}[0],
		Provider:         metricProvider,
	}

	// Get the job for the release
	agentJobs := ws.Workspace().Store().Jobs.GetJobsForAgent(jobAgentID)
	agentJobsSlice := make([]*oapi.Job, 0, len(agentJobs))
	for _, job := range agentJobs {
		agentJobsSlice = append(agentJobsSlice, job)
	}
	assert.Len(t, agentJobsSlice, 1)
	agentJob := agentJobsSlice[0]

	err := ws.Workspace().ReleaseManager().VerificationManager().StartVerification(ctx, agentJob, []oapi.VerificationMetricSpec{metric})
	assert.NoError(t, err)

	// mark job as successful
	completedAt := time.Now()
	jobUpdateEvent := oapi.JobUpdateEvent{
		Id:      &agentJob.Id,
		AgentId: &jobAgentID,
		Job: oapi.Job{
			Id:          agentJob.Id,
			Status:      oapi.JobStatusSuccessful,
			CompletedAt: &completedAt,
		},
		FieldsToUpdate: &[]oapi.JobUpdateEventFieldsToUpdate{
			oapi.JobUpdateEventFieldsToUpdateStatus,
			oapi.JobUpdateEventFieldsToUpdateCompletedAt,
		},
	}

	ws.PushEvent(ctx, handler.JobUpdate, jobUpdateEvent)

	// wait for verification to complete (with successThreshold=2, should exit early after 2 measurements)
	// Need to wait at least 1 second for the second measurement (IntervalSeconds: 1), plus buffer
	time.Sleep(2 * time.Second)

	// verify verification exists and completed with early exit
	verifications := ws.Workspace().Store().JobVerifications.GetByJobId(agentJob.Id)
	assert.Len(t, verifications, 1)
	verification := verifications[0]
	assert.Equal(t, agentJob.Id, verification.JobId)
	// verify early exit: should have only 2 measurements (successThreshold), not all 5 (count)
	assert.Len(t, verification.Metrics[0].Measurements, 2, "expected early exit after 2 consecutive successes")

	// verify current release is set since verification completed successfully
	rm := ws.Workspace().ReleaseManager()
	releaseTarget := release.ReleaseTarget
	releaseTargetState, err := rm.GetReleaseTargetState(ctx, &releaseTarget)
	assert.NoError(t, err)

	if releaseTargetState.CurrentRelease == nil {
		t.Fatalf("expected current release, got nil")
	}
	assert.Equal(t, release.ID(), releaseTargetState.CurrentRelease.ID())
}
