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

	assert.Equal(t, 1, len(prodJobs), "expected 1 prod job after qa succeeds (gradual rollout should start)")
}
