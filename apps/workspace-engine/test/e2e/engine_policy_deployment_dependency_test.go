package e2e

import (
	"context"
	"sort"
	"testing"
	"time"
	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/oapi"
	"workspace-engine/test/integration"
	c "workspace-engine/test/integration/creators"

	"github.com/stretchr/testify/assert"
)

func getAgentJobsSortedByNewest(engine *integration.TestWorkspace, agentID string) []*oapi.Job {
	jobs := engine.Workspace().Jobs().GetJobsForAgent(agentID)
	jobsList := make([]*oapi.Job, 0)
	for _, job := range jobs {
		jobsList = append(jobsList, job)
	}
	sort.Slice(jobsList, func(i, j int) bool {
		return jobsList[i].CreatedAt.After(jobsList[j].CreatedAt)
	})
	return jobsList
}

func TestEngine_PolicyDeploymentDependency(t *testing.T) {
	jobAgentVpcID := "job-agent-vpc"
	jobAgentClusterID := "job-agent-cluster"

	deploymentVpcID := "deployment-vpc"
	deploymentClusterID := "deployment-cluster"

	environmentID := "environment-1"
	resourceID := "resource-1"

	policyID := "policy-1"

	engine := integration.NewTestWorkspace(t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentVpcID),
		),
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentClusterID),
		),
		integration.WithSystem(
			integration.WithDeployment(
				integration.DeploymentID(deploymentVpcID),
				integration.DeploymentName("vpc"),
				integration.DeploymentJobAgent(jobAgentVpcID),
				integration.DeploymentCelResourceSelector("true"),
			),
			integration.WithDeployment(
				integration.DeploymentID(deploymentClusterID),
				integration.DeploymentName("cluster"),
				integration.DeploymentJobAgent(jobAgentClusterID),
				integration.DeploymentCelResourceSelector("true"),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentID),
				integration.EnvironmentName("environment-1"),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceID(resourceID),
		),
		integration.WithPolicy(
			integration.PolicyID(policyID),
			integration.PolicyName("policy-1"),
			integration.WithPolicyTargetSelector(
				integration.PolicyTargetCelEnvironmentSelector("true"),
				integration.PolicyTargetCelDeploymentSelector("deployment.id == 'deployment-cluster'"),
				integration.PolicyTargetCelResourceSelector("true"),
			),
			integration.WithPolicyRule(
				integration.WithRuleDeploymentDependency(
					integration.DeploymentDependencyRuleDependsOnDeploymentSelector("deployment.id == 'deployment-vpc'"),
				),
			),
		),
	)

	ctx := context.Background()

	clusterVersion := c.NewDeploymentVersion()
	clusterVersion.DeploymentId = deploymentClusterID
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, clusterVersion)

	clusterJobs := getAgentJobsSortedByNewest(engine, jobAgentClusterID)
	assert.Equal(t, 0, len(clusterJobs), "expected 0 cluster jobs")

	vpcVersion := c.NewDeploymentVersion()
	vpcVersion.DeploymentId = deploymentVpcID
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, vpcVersion)

	vpcJobs := getAgentJobsSortedByNewest(engine, jobAgentVpcID)
	assert.Equal(t, 1, len(vpcJobs), "expected 1 vpc job")

	vpcJob := vpcJobs[0]
	vpcJobCopy := *vpcJob
	vpcJobCopy.Status = oapi.JobStatusSuccessful
	completedAt := time.Now()
	vpcJobCopy.CompletedAt = &completedAt
	jobUpdateEvent := &oapi.JobUpdateEvent{
		Id:  &vpcJobCopy.Id,
		Job: vpcJobCopy,
		FieldsToUpdate: &[]oapi.JobUpdateEventFieldsToUpdate{
			oapi.JobUpdateEventFieldsToUpdateStatus,
			oapi.JobUpdateEventFieldsToUpdateCompletedAt,
		},
	}
	engine.PushEvent(ctx, handler.JobUpdate, jobUpdateEvent)

	clusterJobs = getAgentJobsSortedByNewest(engine, jobAgentClusterID)
	assert.Equal(t, 1, len(clusterJobs), "expected 1 cluster job")
}
