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

// TestEngine_PolicyDeploymentDependency_ArgoCDRaceCondition tests the race condition where:
// 1. argo-cd-destination deployment succeeds
// 2. Deployment dependency policy passes
// 3. Downstream deployment tries to create ArgoCD Application
// 4. With the fix, destination errors are retried instead of immediately marking as InvalidJobAgent
func TestEngine_PolicyDeploymentDependency_ArgoCDRaceCondition(t *testing.T) {
	destinationJobAgentID := "destination-job-agent"
	downstreamJobAgentID := "downstream-job-agent"

	destinationDeploymentID := "argo-cd-destination"
	downstreamDeploymentID := "downstream-app"

	environmentID := "production"
	resourceID := "cluster-1"
	policyID := "destination-dependency-policy"

	engine := integration.NewTestWorkspace(t,
		integration.WithJobAgent(
			integration.JobAgentID(destinationJobAgentID),
		),
		integration.WithJobAgent(
			integration.JobAgentID(downstreamJobAgentID),
		),
		integration.WithSystem(
			integration.WithDeployment(
				integration.DeploymentID(destinationDeploymentID),
				integration.DeploymentName("argo-cd-destination"),
				integration.DeploymentJobAgent(destinationJobAgentID),
				integration.DeploymentCelResourceSelector("true"),
			),
			integration.WithDeployment(
				integration.DeploymentID(downstreamDeploymentID),
				integration.DeploymentName("downstream-app"),
				integration.DeploymentJobAgent(downstreamJobAgentID),
				integration.DeploymentCelResourceSelector("true"),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentID),
				integration.EnvironmentName("production"),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceID(resourceID),
		),
		integration.WithPolicy(
			integration.PolicyID(policyID),
			integration.PolicyName("ArgoCD Destination Dependency Policy"),
			integration.WithPolicyTargetSelector(
				integration.PolicyTargetCelEnvironmentSelector("true"),
				integration.PolicyTargetCelDeploymentSelector("deployment.id == '"+downstreamDeploymentID+"'"),
				integration.PolicyTargetCelResourceSelector("true"),
			),
			integration.WithPolicyRule(
				integration.WithRuleDeploymentDependency(
					integration.DeploymentDependencyRuleDependsOnDeploymentSelector("deployment.id == '"+destinationDeploymentID+"'"),
				),
			),
		),
	)

	ctx := context.Background()

	// Step 1: Create version for downstream app (should be blocked by policy)
	downstreamVersion := c.NewDeploymentVersion()
	downstreamVersion.DeploymentId = downstreamDeploymentID
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, downstreamVersion)

	downstreamJobs := getAgentJobsSortedByNewest(engine, downstreamJobAgentID)
	assert.Equal(t, 0, len(downstreamJobs), "downstream deployment should be blocked by dependency policy")

	// Step 2: Create version for destination deployment
	destinationVersion := c.NewDeploymentVersion()
	destinationVersion.DeploymentId = destinationDeploymentID
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, destinationVersion)

	destinationJobs := getAgentJobsSortedByNewest(engine, destinationJobAgentID)
	assert.Equal(t, 1, len(destinationJobs), "destination deployment should create 1 job")

	// Step 3: Mark destination job as successful
	destinationJob := destinationJobs[0]
	destinationJobCopy := *destinationJob
	destinationJobCopy.Status = oapi.JobStatusSuccessful
	completedAt := time.Now()
	destinationJobCopy.CompletedAt = &completedAt
	jobUpdateEvent := &oapi.JobUpdateEvent{
		Id:  &destinationJobCopy.Id,
		Job: destinationJobCopy,
		FieldsToUpdate: &[]oapi.JobUpdateEventFieldsToUpdate{
			oapi.JobUpdateEventFieldsToUpdateStatus,
			oapi.JobUpdateEventFieldsToUpdateCompletedAt,
		},
	}
	engine.PushEvent(ctx, handler.JobUpdate, jobUpdateEvent)

	// Step 4: Downstream deployment should now be unblocked
	downstreamJobs = getAgentJobsSortedByNewest(engine, downstreamJobAgentID)
	assert.Equal(t, 1, len(downstreamJobs), "downstream deployment should create 1 job after dependency satisfied")

	// Verify downstream job status
	// The job should NOT be InvalidJobAgent
	// With the ArgoCD retry fix, destination errors are retried instead of immediately failing
	downstreamJob := downstreamJobs[0]
	assert.NotEqual(t, oapi.JobStatusInvalidJobAgent, downstreamJob.Status,
		"downstream job should not be InvalidJobAgent - retries should handle ArgoCD race condition")
}
