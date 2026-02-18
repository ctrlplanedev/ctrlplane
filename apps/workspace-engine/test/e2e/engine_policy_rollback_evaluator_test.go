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
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestEngine_RollbackEvaluator_MultipleFailureStatuses tests rollback with multiple
// configured failure statuses.
func TestEngine_RollbackEvaluator_MultipleFailureStatuses(t *testing.T) {
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
		integration.WithPolicy(
			integration.WithPolicySelector("true"),
			integration.WithPolicyRule(
				integration.WithRuleRollback(
					[]oapi.JobStatus{oapi.JobStatusFailure, oapi.JobStatusCancelled},
					false,
				),
			),
		),
	)

	ctx := context.Background()

	// Deploy v1.0.0 and mark successful
	dv1 := c.NewDeploymentVersion()
	dv1.DeploymentId = deploymentID
	dv1.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv1)

	pendingJobs := engine.Workspace().Jobs().GetPending()
	require.Len(t, pendingJobs, 1)
	job1 := getFirstJob(pendingJobs)
	engine.PushEvent(ctx, handler.JobUpdate, createJobUpdateEvent(job1, jobAgentID, oapi.JobStatusSuccessful))

	// Deploy v2.0.0
	dv2 := c.NewDeploymentVersion()
	dv2.DeploymentId = deploymentID
	dv2.Tag = "v2.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv2)

	pendingJobs = engine.Workspace().Jobs().GetPending()
	require.Len(t, pendingJobs, 1)
	job2 := getFirstJob(pendingJobs)

	// Cancel v2.0.0 — should trigger rollback since Cancelled is in the list
	engine.PushEvent(ctx, handler.JobUpdate, createJobUpdateEvent(job2, jobAgentID, oapi.JobStatusCancelled))

	pendingJobs = engine.Workspace().Jobs().GetPending()
	require.Len(t, pendingJobs, 1, "expected rollback job after cancellation")

	rollbackJob := getFirstJob(pendingJobs)
	rollbackRelease, _ := engine.Workspace().Releases().Get(rollbackJob.ReleaseId)
	assert.Equal(t, "v1.0.0", rollbackRelease.Version.Tag)
}

// TestEngine_RollbackEvaluator_CombinedJobAndVerificationFailure tests rollback
// with both job status and verification failure configured.
func TestEngine_RollbackEvaluator_CombinedJobAndVerificationFailure(t *testing.T) {
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
		integration.WithPolicy(
			integration.WithPolicySelector("true"),
			integration.WithPolicyRule(
				integration.WithRuleRollback(
					[]oapi.JobStatus{oapi.JobStatusFailure},
					true,
				),
			),
		),
	)

	ctx := context.Background()

	// Deploy v1.0.0 and succeed
	dv1 := c.NewDeploymentVersion()
	dv1.DeploymentId = deploymentID
	dv1.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv1)

	pendingJobs := engine.Workspace().Jobs().GetPending()
	require.Len(t, pendingJobs, 1)
	job1 := getFirstJob(pendingJobs)
	engine.PushEvent(ctx, handler.JobUpdate, createJobUpdateEvent(job1, jobAgentID, oapi.JobStatusSuccessful))

	// Deploy v2.0.0 and succeed (but fail verification)
	dv2 := c.NewDeploymentVersion()
	dv2.DeploymentId = deploymentID
	dv2.Tag = "v2.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv2)

	pendingJobs = engine.Workspace().Jobs().GetPending()
	require.Len(t, pendingJobs, 1)
	job2 := getFirstJob(pendingJobs)
	engine.PushEvent(ctx, handler.JobUpdate, createJobUpdateEvent(job2, jobAgentID, oapi.JobStatusSuccessful))

	// Start and fail verification
	metricProvider := oapi.MetricProvider{}
	_ = metricProvider.FromSleepMetricProvider(oapi.SleepMetricProvider{
		Type:            oapi.Sleep,
		DurationSeconds: 0,
	})
	failureCondition := "result.ok == true"
	metric := oapi.VerificationMetricSpec{
		Name:             "combined-check",
		IntervalSeconds:  1,
		Count:            1,
		FailureCondition: &failureCondition,
		Provider:         metricProvider,
	}

	err := engine.Workspace().ReleaseManager().VerificationManager().StartVerification(ctx, job2, []oapi.VerificationMetricSpec{metric})
	require.NoError(t, err)

	time.Sleep(3 * time.Second)

	pendingJobs = engine.Workspace().Jobs().GetPending()
	require.Len(t, pendingJobs, 1, "expected rollback from combined rule on verification failure")

	rollbackJob := getFirstJob(pendingJobs)
	rollbackRelease, _ := engine.Workspace().Releases().Get(rollbackJob.ReleaseId)
	assert.Equal(t, "v1.0.0", rollbackRelease.Version.Tag)
}
