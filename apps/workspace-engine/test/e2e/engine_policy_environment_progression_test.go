package e2e

import (
	"context"
	"testing"
	"time"
	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/oapi"
	"workspace-engine/test/integration"
	c "workspace-engine/test/integration/creators"

	"github.com/stretchr/testify/assert"
)

func TestEngine_PolicyEnvironmentProgression_TriggersGradualRollout(t *testing.T) {
	jobAgentID := "job-agent-1"
	deploymentID := "deployment-1"
	qaEnvironmentID := "qa-environment"
	prodEnvironmentID := "prod-environment"
	resourceID := "resource-1"
	policyID := "policy-1"

	minSuccessPercentage := float32(100)

	engine := integration.NewTestWorkspace(t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID),
		),
		integration.WithSystem(
			integration.WithDeployment(
				integration.DeploymentID(deploymentID),
				integration.DeploymentName("app"),
				integration.DeploymentJobAgent(jobAgentID),
				integration.DeploymentCelResourceSelector("true"),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(qaEnvironmentID),
				integration.EnvironmentName("qa"),
				integration.EnvironmentCelResourceSelector("true"),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(prodEnvironmentID),
				integration.EnvironmentName("prod"),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceID(resourceID),
		),
		integration.WithPolicy(
			integration.PolicyID(policyID),
			integration.PolicyName("prod-depends-on-qa"),
			integration.WithPolicyTargetSelector(
				integration.PolicyTargetCelEnvironmentSelector("environment.name == 'prod'"),
				integration.PolicyTargetCelDeploymentSelector("true"),
				integration.PolicyTargetCelResourceSelector("true"),
			),
			integration.WithPolicyRule(
				integration.WithRuleEnvironmentProgression(
					integration.EnvironmentProgressionDependsOnEnvironmentSelector("environment.name == 'qa'"),
					integration.EnvironmentProgressionMinimumSuccessPercentage(minSuccessPercentage),
				),
			),
		),
	)

	ctx := context.Background()

	qaReleaseTarget := &oapi.ReleaseTarget{
		ResourceId:    resourceID,
		EnvironmentId: qaEnvironmentID,
		DeploymentId:  deploymentID,
	}
	prodReleaseTarget := &oapi.ReleaseTarget{
		ResourceId:    resourceID,
		EnvironmentId: prodEnvironmentID,
		DeploymentId:  deploymentID,
	}

	version := c.NewDeploymentVersion()
	version.DeploymentId = deploymentID
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, version)

	qaJobs := engine.Workspace().Jobs().GetJobsForReleaseTarget(qaReleaseTarget)
	prodJobs := engine.Workspace().Jobs().GetJobsForReleaseTarget(prodReleaseTarget)

	assert.Equal(t, 1, len(qaJobs), "expected 1 qa job after version creation")
	assert.Equal(t, 0, len(prodJobs), "expected 0 prod jobs before qa succeeds")

	var qaJob *oapi.Job
	for _, j := range qaJobs {
		qaJob = j
		break
	}

	qaJobCopy := *qaJob
	qaJobCopy.Status = oapi.JobStatusSuccessful
	completedAt := time.Now()
	qaJobCopy.CompletedAt = &completedAt
	jobUpdateEvent := &oapi.JobUpdateEvent{
		Id:  &qaJobCopy.Id,
		Job: qaJobCopy,
		FieldsToUpdate: &[]oapi.JobUpdateEventFieldsToUpdate{
			oapi.JobUpdateEventFieldsToUpdateStatus,
			oapi.JobUpdateEventFieldsToUpdateCompletedAt,
		},
	}
	engine.PushEvent(ctx, handler.JobUpdate, jobUpdateEvent)

	prodJobs = engine.Workspace().Jobs().GetJobsForReleaseTarget(prodReleaseTarget)

	assert.Equal(t, 1, len(prodJobs), "expected 1 prod job after qa succeeds (environment progression should trigger reconciliation)")
}

func TestEngine_PolicyEnvironmentProgression_OnlyTriggersWhenThresholdCrossed(t *testing.T) {
	jobAgentID := "job-agent-1"
	deploymentID := "deployment-1"
	qaEnvironmentID := "qa-environment"
	prodEnvironmentID := "prod-environment"
	resource1ID := "resource-1"
	resource2ID := "resource-2"
	resource3ID := "resource-3"
	policyID := "policy-1"

	minSuccessPercentage := float32(100)

	engine := integration.NewTestWorkspace(t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID),
		),
		integration.WithSystem(
			integration.WithDeployment(
				integration.DeploymentID(deploymentID),
				integration.DeploymentName("app"),
				integration.DeploymentJobAgent(jobAgentID),
				integration.DeploymentCelResourceSelector("true"),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(qaEnvironmentID),
				integration.EnvironmentName("qa"),
				integration.EnvironmentCelResourceSelector("true"),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(prodEnvironmentID),
				integration.EnvironmentName("prod"),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceID(resource1ID),
		),
		integration.WithResource(
			integration.ResourceID(resource2ID),
		),
		integration.WithResource(
			integration.ResourceID(resource3ID),
		),
		integration.WithPolicy(
			integration.PolicyID(policyID),
			integration.PolicyName("prod-depends-on-qa"),
			integration.WithPolicyTargetSelector(
				integration.PolicyTargetCelEnvironmentSelector("environment.name == 'prod'"),
				integration.PolicyTargetCelDeploymentSelector("true"),
				integration.PolicyTargetCelResourceSelector("true"),
			),
			integration.WithPolicyRule(
				integration.WithRuleEnvironmentProgression(
					integration.EnvironmentProgressionDependsOnEnvironmentSelector("environment.name == 'qa'"),
					integration.EnvironmentProgressionMinimumSuccessPercentage(minSuccessPercentage),
				),
			),
		),
	)

	ctx := context.Background()

	qaReleaseTarget1 := &oapi.ReleaseTarget{
		ResourceId:    resource1ID,
		EnvironmentId: qaEnvironmentID,
		DeploymentId:  deploymentID,
	}
	qaReleaseTarget2 := &oapi.ReleaseTarget{
		ResourceId:    resource2ID,
		EnvironmentId: qaEnvironmentID,
		DeploymentId:  deploymentID,
	}
	qaReleaseTarget3 := &oapi.ReleaseTarget{
		ResourceId:    resource3ID,
		EnvironmentId: qaEnvironmentID,
		DeploymentId:  deploymentID,
	}
	prodReleaseTarget1 := &oapi.ReleaseTarget{
		ResourceId:    resource1ID,
		EnvironmentId: prodEnvironmentID,
		DeploymentId:  deploymentID,
	}

	version := c.NewDeploymentVersion()
	version.DeploymentId = deploymentID
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, version)

	qaJobs1 := engine.Workspace().Jobs().GetJobsForReleaseTarget(qaReleaseTarget1)
	qaJobs2 := engine.Workspace().Jobs().GetJobsForReleaseTarget(qaReleaseTarget2)
	qaJobs3 := engine.Workspace().Jobs().GetJobsForReleaseTarget(qaReleaseTarget3)
	prodJobs := engine.Workspace().Jobs().GetJobsForReleaseTarget(prodReleaseTarget1)

	assert.Equal(t, 1, len(qaJobs1), "expected 1 qa job for resource 1")
	assert.Equal(t, 1, len(qaJobs2), "expected 1 qa job for resource 2")
	assert.Equal(t, 1, len(qaJobs3), "expected 1 qa job for resource 3")
	assert.Equal(t, 0, len(prodJobs), "expected 0 prod jobs before qa succeeds")

	markJobSuccessful := func(jobs map[string]*oapi.Job, completedAt time.Time) {
		for _, job := range jobs {
			jobCopy := *job
			jobCopy.Status = oapi.JobStatusSuccessful
			jobCopy.CompletedAt = &completedAt
			jobUpdateEvent := &oapi.JobUpdateEvent{
				Id:  &jobCopy.Id,
				Job: jobCopy,
				FieldsToUpdate: &[]oapi.JobUpdateEventFieldsToUpdate{
					oapi.JobUpdateEventFieldsToUpdateStatus,
					oapi.JobUpdateEventFieldsToUpdateCompletedAt,
				},
			}
			engine.PushEvent(ctx, handler.JobUpdate, jobUpdateEvent)
			break
		}
	}

	markJobSuccessful(qaJobs1, time.Now())
	prodJobs = engine.Workspace().Jobs().GetJobsForReleaseTarget(prodReleaseTarget1)
	assert.Equal(t, 0, len(prodJobs), "expected 0 prod jobs after 1/3 qa jobs succeed (33%% < 100%%)")

	markJobSuccessful(qaJobs2, time.Now().Add(time.Second))
	prodJobs = engine.Workspace().Jobs().GetJobsForReleaseTarget(prodReleaseTarget1)
	assert.Equal(t, 0, len(prodJobs), "expected 0 prod jobs after 2/3 qa jobs succeed (66%% < 100%%)")

	markJobSuccessful(qaJobs3, time.Now().Add(2*time.Second))
	prodJobs = engine.Workspace().Jobs().GetJobsForReleaseTarget(prodReleaseTarget1)
	assert.Equal(t, 1, len(prodJobs), "expected 1 prod job after 3/3 qa jobs succeed (100%% threshold crossed)")
}

func TestEngine_PolicyEnvironmentProgression_TriggersAtPartialThreshold(t *testing.T) {
	jobAgentID := "job-agent-1"
	deploymentID := "deployment-1"
	qaEnvironmentID := "qa-environment"
	prodEnvironmentID := "prod-environment"
	resource1ID := "resource-1"
	resource2ID := "resource-2"
	policyID := "policy-1"

	minSuccessPercentage := float32(50)

	engine := integration.NewTestWorkspace(t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID),
		),
		integration.WithSystem(
			integration.WithDeployment(
				integration.DeploymentID(deploymentID),
				integration.DeploymentName("app"),
				integration.DeploymentJobAgent(jobAgentID),
				integration.DeploymentCelResourceSelector("true"),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(qaEnvironmentID),
				integration.EnvironmentName("qa"),
				integration.EnvironmentCelResourceSelector("true"),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(prodEnvironmentID),
				integration.EnvironmentName("prod"),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceID(resource1ID),
		),
		integration.WithResource(
			integration.ResourceID(resource2ID),
		),
		integration.WithPolicy(
			integration.PolicyID(policyID),
			integration.PolicyName("prod-depends-on-qa"),
			integration.WithPolicyTargetSelector(
				integration.PolicyTargetCelEnvironmentSelector("environment.name == 'prod'"),
				integration.PolicyTargetCelDeploymentSelector("true"),
				integration.PolicyTargetCelResourceSelector("true"),
			),
			integration.WithPolicyRule(
				integration.WithRuleEnvironmentProgression(
					integration.EnvironmentProgressionDependsOnEnvironmentSelector("environment.name == 'qa'"),
					integration.EnvironmentProgressionMinimumSuccessPercentage(minSuccessPercentage),
				),
			),
		),
	)

	ctx := context.Background()

	qaReleaseTarget1 := &oapi.ReleaseTarget{
		ResourceId:    resource1ID,
		EnvironmentId: qaEnvironmentID,
		DeploymentId:  deploymentID,
	}
	qaReleaseTarget2 := &oapi.ReleaseTarget{
		ResourceId:    resource2ID,
		EnvironmentId: qaEnvironmentID,
		DeploymentId:  deploymentID,
	}
	prodReleaseTarget1 := &oapi.ReleaseTarget{
		ResourceId:    resource1ID,
		EnvironmentId: prodEnvironmentID,
		DeploymentId:  deploymentID,
	}

	version := c.NewDeploymentVersion()
	version.DeploymentId = deploymentID
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, version)

	qaJobs1 := engine.Workspace().Jobs().GetJobsForReleaseTarget(qaReleaseTarget1)
	qaJobs2 := engine.Workspace().Jobs().GetJobsForReleaseTarget(qaReleaseTarget2)
	prodJobs := engine.Workspace().Jobs().GetJobsForReleaseTarget(prodReleaseTarget1)

	assert.Equal(t, 1, len(qaJobs1), "expected 1 qa job for resource 1")
	assert.Equal(t, 1, len(qaJobs2), "expected 1 qa job for resource 2")
	assert.Equal(t, 0, len(prodJobs), "expected 0 prod jobs before qa succeeds")

	markJobSuccessful := func(jobs map[string]*oapi.Job, completedAt time.Time) {
		for _, job := range jobs {
			jobCopy := *job
			jobCopy.Status = oapi.JobStatusSuccessful
			jobCopy.CompletedAt = &completedAt
			jobUpdateEvent := &oapi.JobUpdateEvent{
				Id:  &jobCopy.Id,
				Job: jobCopy,
				FieldsToUpdate: &[]oapi.JobUpdateEventFieldsToUpdate{
					oapi.JobUpdateEventFieldsToUpdateStatus,
					oapi.JobUpdateEventFieldsToUpdateCompletedAt,
				},
			}
			engine.PushEvent(ctx, handler.JobUpdate, jobUpdateEvent)
			break
		}
	}

	markJobSuccessful(qaJobs1, time.Now())
	prodJobs = engine.Workspace().Jobs().GetJobsForReleaseTarget(prodReleaseTarget1)
	assert.Equal(t, 1, len(prodJobs), "expected 1 prod job after 1/2 qa jobs succeed (50%% threshold crossed)")

	prodJobCountBefore := len(prodJobs)

	markJobSuccessful(qaJobs2, time.Now().Add(time.Second))
	prodJobs = engine.Workspace().Jobs().GetJobsForReleaseTarget(prodReleaseTarget1)

	assert.Equal(t, prodJobCountBefore, len(prodJobs), "expected no additional prod jobs after threshold was already crossed")
}

func TestEngine_PolicyEnvironmentProgression_TriggersGradualRolloutStart(t *testing.T) {
	jobAgentID := "job-agent-1"
	deploymentID := "deployment-1"
	qaEnvironmentID := "qa-environment"
	prodEnvironmentID := "prod-environment"
	resourceID := "resource-1"
	envProgressionPolicyID := "env-progression-policy"
	gradualRolloutPolicyID := "gradual-rollout-policy"

	minSuccessPercentage := float32(100)
	timeScaleInterval := int32(60)

	engine := integration.NewTestWorkspace(t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID),
		),
		integration.WithSystem(
			integration.WithDeployment(
				integration.DeploymentID(deploymentID),
				integration.DeploymentName("app"),
				integration.DeploymentJobAgent(jobAgentID),
				integration.DeploymentCelResourceSelector("true"),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(qaEnvironmentID),
				integration.EnvironmentName("qa"),
				integration.EnvironmentCelResourceSelector("true"),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(prodEnvironmentID),
				integration.EnvironmentName("prod"),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceID(resourceID),
		),
		integration.WithPolicy(
			integration.PolicyID(envProgressionPolicyID),
			integration.PolicyName("prod-depends-on-qa"),
			integration.WithPolicyTargetSelector(
				integration.PolicyTargetCelEnvironmentSelector("environment.name == 'prod'"),
				integration.PolicyTargetCelDeploymentSelector("true"),
				integration.PolicyTargetCelResourceSelector("true"),
			),
			integration.WithPolicyRule(
				integration.WithRuleEnvironmentProgression(
					integration.EnvironmentProgressionDependsOnEnvironmentSelector("environment.name == 'qa'"),
					integration.EnvironmentProgressionMinimumSuccessPercentage(minSuccessPercentage),
				),
			),
		),
		integration.WithPolicy(
			integration.PolicyID(gradualRolloutPolicyID),
			integration.PolicyName("prod-gradual-rollout"),
			integration.WithPolicyTargetSelector(
				integration.PolicyTargetCelEnvironmentSelector("environment.name == 'prod'"),
				integration.PolicyTargetCelDeploymentSelector("true"),
				integration.PolicyTargetCelResourceSelector("true"),
			),
			integration.WithPolicyRule(
				integration.WithRuleGradualRollout(timeScaleInterval),
			),
		),
	)

	ctx := context.Background()

	qaReleaseTarget := &oapi.ReleaseTarget{
		ResourceId:    resourceID,
		EnvironmentId: qaEnvironmentID,
		DeploymentId:  deploymentID,
	}
	prodReleaseTarget := &oapi.ReleaseTarget{
		ResourceId:    resourceID,
		EnvironmentId: prodEnvironmentID,
		DeploymentId:  deploymentID,
	}

	version := c.NewDeploymentVersion()
	version.DeploymentId = deploymentID
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, version)

	qaJobs := engine.Workspace().Jobs().GetJobsForReleaseTarget(qaReleaseTarget)
	prodJobs := engine.Workspace().Jobs().GetJobsForReleaseTarget(prodReleaseTarget)

	assert.Equal(t, 1, len(qaJobs), "expected 1 qa job after version creation")
	assert.Equal(t, 0, len(prodJobs), "expected 0 prod jobs before qa succeeds (env progression blocking)")

	var qaJob *oapi.Job
	for _, j := range qaJobs {
		qaJob = j
		break
	}

	qaJobCopy := *qaJob
	qaJobCopy.Status = oapi.JobStatusSuccessful
	completedAt := time.Now()
	qaJobCopy.CompletedAt = &completedAt
	jobUpdateEvent := &oapi.JobUpdateEvent{
		Id:  &qaJobCopy.Id,
		Job: qaJobCopy,
		FieldsToUpdate: &[]oapi.JobUpdateEventFieldsToUpdate{
			oapi.JobUpdateEventFieldsToUpdateStatus,
			oapi.JobUpdateEventFieldsToUpdateCompletedAt,
		},
	}
	engine.PushEvent(ctx, handler.JobUpdate, jobUpdateEvent)

	prodJobs = engine.Workspace().Jobs().GetJobsForReleaseTarget(prodReleaseTarget)

	assert.Equal(t, 1, len(prodJobs), "expected 1 prod job after qa succeeds (threshold crossed, gradual rollout should start)")
}
