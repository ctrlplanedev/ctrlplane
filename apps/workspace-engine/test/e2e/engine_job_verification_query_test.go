package e2e

import (
	"context"
	"testing"
	"time"
	"workspace-engine/pkg/oapi"
	"workspace-engine/test/integration"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
)

func TestEngine_JobVerification_QueryByReleaseId(t *testing.T) {
	jobAgentID := uuid.New().String()
	deploymentID := uuid.New().String()
	environmentID := uuid.New().String()
	resourceID := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID),
			integration.JobAgentName("test-agent"),
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

	// Get the created release
	releases := engine.Workspace().Store().Releases.Items()
	assert.Len(t, releases, 1)

	var release *oapi.Release
	for _, r := range releases {
		release = r
		break
	}

	// Get the job
	agentJobs := engine.Workspace().Store().Jobs.GetJobsForAgent(jobAgentID)
	assert.NotEmpty(t, agentJobs)

	var job *oapi.Job
	for _, j := range agentJobs {
		job = j
		break
	}

	// Start a verification
	metricProvider := oapi.MetricProvider{}
	_ = metricProvider.FromSleepMetricProvider(oapi.SleepMetricProvider{
		Type:            oapi.Sleep,
		DurationSeconds: 0,
	})

	metric := oapi.VerificationMetricSpec{
		Name:             "health-check",
		IntervalSeconds:  1,
		Count:            1,
		SuccessCondition: "result.ok == true",
		Provider:         metricProvider,
	}

	err := engine.Workspace().ReleaseManager().VerificationManager().StartVerification(ctx, job, []oapi.VerificationMetricSpec{metric})
	assert.NoError(t, err)

	time.Sleep(500 * time.Millisecond)

	// Query by job ID
	byJob := engine.Workspace().Store().JobVerifications.GetByJobId(job.Id)
	assert.Len(t, byJob, 1)

	// Query by release ID
	byRelease := engine.Workspace().Store().JobVerifications.GetByReleaseId(release.ID())
	assert.Len(t, byRelease, 1)
	assert.Equal(t, job.Id, byRelease[0].JobId)
}

func TestEngine_JobVerification_StatusCheck(t *testing.T) {
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

	agentJobs := engine.Workspace().Store().Jobs.GetJobsForAgent(jobAgentID)
	var job *oapi.Job
	for _, j := range agentJobs {
		job = j
		break
	}

	metricProvider := oapi.MetricProvider{}
	_ = metricProvider.FromSleepMetricProvider(oapi.SleepMetricProvider{
		Type:            oapi.Sleep,
		DurationSeconds: 0,
	})

	metric := oapi.VerificationMetricSpec{
		Name:             "quick-check",
		IntervalSeconds:  1,
		Count:            1,
		SuccessCondition: "result.ok == true",
		Provider:         metricProvider,
	}

	err := engine.Workspace().ReleaseManager().VerificationManager().StartVerification(ctx, job, []oapi.VerificationMetricSpec{metric})
	assert.NoError(t, err)

	time.Sleep(500 * time.Millisecond)

	// Check verification status
	status := engine.Workspace().Store().JobVerifications.GetJobVerificationStatus(job.Id)
	assert.NotEmpty(t, string(status))

	// Verify Status() method on the verification itself
	verifications := engine.Workspace().Store().JobVerifications.GetByJobId(job.Id)
	assert.Len(t, verifications, 1)
	v := verifications[0]
	assert.NotEmpty(t, string(v.Status()))
}

func TestEngine_JobVerification_MultipleJobs(t *testing.T) {
	jobAgentID := uuid.New().String()
	deploymentID := uuid.New().String()
	environmentID := uuid.New().String()
	r1ID := uuid.New().String()
	r2ID := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
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
			integration.ResourceID(r1ID),
			integration.ResourceName("resource-1"),
		),
		integration.WithResource(
			integration.ResourceID(r2ID),
			integration.ResourceName("resource-2"),
		),
	)

	ctx := context.Background()

	// Both resources should have jobs
	agentJobs := engine.Workspace().Store().Jobs.GetJobsForAgent(jobAgentID)
	assert.Len(t, agentJobs, 2)

	metricProvider := oapi.MetricProvider{}
	_ = metricProvider.FromSleepMetricProvider(oapi.SleepMetricProvider{
		Type:            oapi.Sleep,
		DurationSeconds: 0,
	})
	metric := oapi.VerificationMetricSpec{
		Name:             "check",
		IntervalSeconds:  1,
		Count:            1,
		SuccessCondition: "result.ok == true",
		Provider:         metricProvider,
	}

	// Start verification for each job
	for _, job := range agentJobs {
		err := engine.Workspace().ReleaseManager().VerificationManager().StartVerification(ctx, job, []oapi.VerificationMetricSpec{metric})
		assert.NoError(t, err)
	}

	time.Sleep(500 * time.Millisecond)

	// Verify each job has its own verification
	allVerifications := engine.Workspace().Store().JobVerifications.Items()
	assert.Len(t, allVerifications, 2)
}
