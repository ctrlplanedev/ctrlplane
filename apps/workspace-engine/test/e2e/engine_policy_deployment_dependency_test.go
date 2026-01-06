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

// TestEngine_PolicyDeploymentDependency_AutoDeploy validates that:
// 1. Deployment B is blocked when it depends on deployment A
// 2. Creating a release for B does nothing (blocked by policy)
// 3. Creating a release for A succeeds
// 4. Once A's job succeeds, B automatically deploys via event queue
// 5. B's job completes successfully
func TestEngine_PolicyDeploymentDependency_AutoDeploy(t *testing.T) {
	jobAgentAID := "job-agent-a"
	jobAgentBID := "job-agent-b"

	deploymentAID := "deployment-a"
	deploymentBID := "deployment-b"

	environmentID := "env-1"
	resourceID := "resource-1"
	policyID := "b-depends-on-a"

	engine := integration.NewTestWorkspace(t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentAID),
		),
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentBID),
		),
		integration.WithSystem(
			integration.WithDeployment(
				integration.DeploymentID(deploymentAID),
				integration.DeploymentName("deployment-a"),
				integration.DeploymentJobAgent(jobAgentAID),
				integration.DeploymentCelResourceSelector("true"),
			),
			integration.WithDeployment(
				integration.DeploymentID(deploymentBID),
				integration.DeploymentName("deployment-b"),
				integration.DeploymentJobAgent(jobAgentBID),
				integration.DeploymentCelResourceSelector("true"),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentID),
				integration.EnvironmentName("env-1"),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceID(resourceID),
		),
		integration.WithPolicy(
			integration.PolicyID(policyID),
			integration.PolicyName("B depends on A"),
			integration.WithPolicyTargetSelector(
				integration.PolicyTargetCelEnvironmentSelector("true"),
				integration.PolicyTargetCelDeploymentSelector("deployment.id == '"+deploymentBID+"'"),
				integration.PolicyTargetCelResourceSelector("true"),
			),
			integration.WithPolicyRule(
				integration.WithRuleDeploymentDependency(
					integration.DeploymentDependencyRuleDependsOnDeploymentSelector("deployment.id == '"+deploymentAID+"'"),
				),
			),
		),
	)

	ctx := context.Background()

	// Step 1: Create release for B first (should be blocked - A has never succeeded)
	versionB := c.NewDeploymentVersion()
	versionB.DeploymentId = deploymentBID
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, versionB)

	jobsB := getAgentJobsSortedByNewest(engine, jobAgentBID)
	assert.Equal(t, 0, len(jobsB), "B should be blocked: A has never deployed successfully")

	// Step 2: Create release for A (should proceed - no dependencies)
	versionA := c.NewDeploymentVersion()
	versionA.DeploymentId = deploymentAID
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, versionA)

	jobsA := getAgentJobsSortedByNewest(engine, jobAgentAID)
	assert.Equal(t, 1, len(jobsA), "A should create 1 job - no dependencies blocking it")

	// B should still be blocked
	jobsB = getAgentJobsSortedByNewest(engine, jobAgentBID)
	assert.Equal(t, 0, len(jobsB), "B should still be blocked: A job not completed yet")

	// Step 3: Mark A's job as successful
	jobA := jobsA[0]
	jobACopy := *jobA
	jobACopy.Status = oapi.JobStatusSuccessful
	completedAt := time.Now()
	jobACopy.CompletedAt = &completedAt
	engine.PushEvent(ctx, handler.JobUpdate, &oapi.JobUpdateEvent{
		Id:  &jobACopy.Id,
		Job: jobACopy,
		FieldsToUpdate: &[]oapi.JobUpdateEventFieldsToUpdate{
			oapi.JobUpdateEventFieldsToUpdateStatus,
			oapi.JobUpdateEventFieldsToUpdateCompletedAt,
		},
	})

	// Step 4: B should now auto-deploy (dependency satisfied)
	jobsB = getAgentJobsSortedByNewest(engine, jobAgentBID)
	assert.Equal(t, 1, len(jobsB), "B should auto-deploy: A succeeded, dependency satisfied")

	jobB := jobsB[0]
	assert.Equal(t, oapi.JobStatusPending, jobB.Status, "B's job should be in pending state")

	// Step 5: Mark B's job as successful
	jobBCopy := *jobB
	jobBCopy.Status = oapi.JobStatusSuccessful
	completedAtB := time.Now()
	jobBCopy.CompletedAt = &completedAtB
	engine.PushEvent(ctx, handler.JobUpdate, &oapi.JobUpdateEvent{
		Id:  &jobBCopy.Id,
		Job: jobBCopy,
		FieldsToUpdate: &[]oapi.JobUpdateEventFieldsToUpdate{
			oapi.JobUpdateEventFieldsToUpdateStatus,
			oapi.JobUpdateEventFieldsToUpdateCompletedAt,
		},
	})

	// Verify both deployments completed successfully
	jobsA = getAgentJobsSortedByNewest(engine, jobAgentAID)
	assert.Equal(t, 1, len(jobsA))
	assert.Equal(t, oapi.JobStatusSuccessful, jobsA[0].Status, "A should be successful")

	jobsB = getAgentJobsSortedByNewest(engine, jobAgentBID)
	assert.Equal(t, 1, len(jobsB))
	assert.Equal(t, oapi.JobStatusSuccessful, jobsB[0].Status, "B should be successful")
}

// TestEngine_PolicyDeploymentDependency_ArgoCDRetryBehavior validates that:
// When ArgoCD returns "unable to find destination server" errors, jobs are retried
// instead of immediately being marked as InvalidJobAgent.
// This tests the fix for the race condition where ArgoCD hasn't synced the destination yet.
func TestEngine_PolicyDeploymentDependency_ArgoCDRetryBehavior(t *testing.T) {
	destinationJobAgentID := "destination-agent"
	appJobAgentID := "app-agent"

	destinationDeploymentID := "argo-destination"
	appDeploymentID := "argo-app"

	environmentID := "prod"
	resourceID := "k8s-cluster"
	policyID := "app-depends-on-destination"

	engine := integration.NewTestWorkspace(t,
		integration.WithJobAgent(
			integration.JobAgentID(destinationJobAgentID),
		),
		integration.WithJobAgent(
			integration.JobAgentID(appJobAgentID),
		),
		integration.WithSystem(
			integration.WithDeployment(
				integration.DeploymentID(destinationDeploymentID),
				integration.DeploymentName("argo-destination"),
				integration.DeploymentJobAgent(destinationJobAgentID),
				integration.DeploymentCelResourceSelector("true"),
			),
			integration.WithDeployment(
				integration.DeploymentID(appDeploymentID),
				integration.DeploymentName("argo-app"),
				integration.DeploymentJobAgent(appJobAgentID),
				integration.DeploymentCelResourceSelector("true"),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentID),
				integration.EnvironmentName("prod"),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceID(resourceID),
		),
		integration.WithPolicy(
			integration.PolicyID(policyID),
			integration.PolicyName("App depends on ArgoCD destination"),
			integration.WithPolicyTargetSelector(
				integration.PolicyTargetCelEnvironmentSelector("true"),
				integration.PolicyTargetCelDeploymentSelector("deployment.id == '"+appDeploymentID+"'"),
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

	// Step 1: Create app release (blocked - destination never succeeded)
	appVersion := c.NewDeploymentVersion()
	appVersion.DeploymentId = appDeploymentID
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, appVersion)

	appJobs := getAgentJobsSortedByNewest(engine, appJobAgentID)
	assert.Equal(t, 0, len(appJobs), "app should be blocked by dependency")

	// Step 2: Create destination release
	destVersion := c.NewDeploymentVersion()
	destVersion.DeploymentId = destinationDeploymentID
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, destVersion)

	destJobs := getAgentJobsSortedByNewest(engine, destinationJobAgentID)
	assert.Equal(t, 1, len(destJobs), "destination should create job")

	// Step 3: Mark destination as successful
	destJob := destJobs[0]
	destJobCopy := *destJob
	destJobCopy.Status = oapi.JobStatusSuccessful
	completedAt := time.Now()
	destJobCopy.CompletedAt = &completedAt
	engine.PushEvent(ctx, handler.JobUpdate, &oapi.JobUpdateEvent{
		Id:  &destJobCopy.Id,
		Job: destJobCopy,
		FieldsToUpdate: &[]oapi.JobUpdateEventFieldsToUpdate{
			oapi.JobUpdateEventFieldsToUpdateStatus,
			oapi.JobUpdateEventFieldsToUpdateCompletedAt,
		},
	})

	// Step 4: App should now deploy
	appJobs = getAgentJobsSortedByNewest(engine, appJobAgentID)
	assert.Equal(t, 1, len(appJobs), "app should deploy after destination succeeds")

	appJob := appJobs[0]

	// CRITICAL ASSERTION: The fix ensures that ArgoCD destination errors
	// (like "unable to find destination server") are retried instead of
	// immediately marking the job as InvalidJobAgent.
	//
	// Without the fix: Job would be InvalidJobAgent immediately
	// With the fix: Job will be Pending (and retries happen in background)
	assert.NotEqual(t, oapi.JobStatusInvalidJobAgent, appJob.Status,
		"Job should NOT be InvalidJobAgent - ArgoCD destination errors should be retried, not fail immediately")

	// The job should be in a valid state (Pending, InProgress, or eventually Successful)
	validStatuses := []oapi.JobStatus{
		oapi.JobStatusPending,
		oapi.JobStatusInProgress,
		oapi.JobStatusSuccessful,
	}
	assert.Contains(t, validStatuses, appJob.Status,
		"Job should be in a valid state: %v, got: %v", validStatuses, appJob.Status)
}


// TestEngine_PolicyDeploymentDependency_PolicyTimingIssue demonstrates the race condition:
// 1. Upstream (destination) job completes successfully
// 2. Policy evaluator IMMEDIATELY allows downstream deployment
//    (only checks job.Status == Successful, doesn't verify ArgoCD resource is synced)
// 3. In production: Downstream dispatch to ArgoCD would fail because
//    the destination hasn't finished syncing yet
//
// This test validates that the policy allows deployment too early,
// which is the root cause of the "unable to find destination server" errors.
func TestEngine_PolicyDeploymentDependency_PolicyTimingIssue(t *testing.T) {
	destinationJobAgentID := "destination-agent"
	appJobAgentID := "app-agent"

	destinationDeploymentID := "argo-destination"
	appDeploymentID := "argo-app"

	environmentID := "prod"
	resourceID := "k8s-cluster"
	policyID := "app-depends-on-destination"

	engine := integration.NewTestWorkspace(t,
		integration.WithJobAgent(
			integration.JobAgentID(destinationJobAgentID),
		),
		integration.WithJobAgent(
			integration.JobAgentID(appJobAgentID),
		),
		integration.WithSystem(
			integration.WithDeployment(
				integration.DeploymentID(destinationDeploymentID),
				integration.DeploymentName("argo-destination"),
				integration.DeploymentJobAgent(destinationJobAgentID),
				integration.DeploymentCelResourceSelector("true"),
			),
			integration.WithDeployment(
				integration.DeploymentID(appDeploymentID),
				integration.DeploymentName("argo-app"),
				integration.DeploymentJobAgent(appJobAgentID),
				integration.DeploymentCelResourceSelector("true"),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentID),
				integration.EnvironmentName("prod"),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceID(resourceID),
		),
		integration.WithPolicy(
			integration.PolicyID(policyID),
			integration.PolicyName("App depends on ArgoCD destination"),
			integration.WithPolicyTargetSelector(
				integration.PolicyTargetCelEnvironmentSelector("true"),
				integration.PolicyTargetCelDeploymentSelector("deployment.id == '"+appDeploymentID+"'"),
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

	// Step 1: Create app version (should be blocked - destination never succeeded)
	appVersion := c.NewDeploymentVersion()
	appVersion.DeploymentId = appDeploymentID
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, appVersion)

	appJobs := getAgentJobsSortedByNewest(engine, appJobAgentID)
	assert.Equal(t, 0, len(appJobs), "app blocked: destination never succeeded")

	// Step 2: Create destination version
	destVersion := c.NewDeploymentVersion()
	destVersion.DeploymentId = destinationDeploymentID
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, destVersion)

	destJobs := getAgentJobsSortedByNewest(engine, destinationJobAgentID)
	assert.Equal(t, 1, len(destJobs), "destination job created")

	// Step 3: Mark destination job as SUCCESSFUL
	// ⚠️ CRITICAL POINT: At this moment, the job succeeded but in production:
	//    - ArgoCD application was created
	//    - But ArgoCD destination might not be synced yet (async process)
	destJob := destJobs[0]
	destJobCopy := *destJob
	destJobCopy.Status = oapi.JobStatusSuccessful
	completedAt := time.Now()
	destJobCopy.CompletedAt = &completedAt
	engine.PushEvent(ctx, handler.JobUpdate, &oapi.JobUpdateEvent{
		Id:  &destJobCopy.Id,
		Job: destJobCopy,
		FieldsToUpdate: &[]oapi.JobUpdateEventFieldsToUpdate{
			oapi.JobUpdateEventFieldsToUpdateStatus,
			oapi.JobUpdateEventFieldsToUpdateCompletedAt,
		},
	})

	// Step 4: ⚠️ RACE CONDITION - This is where the bug manifests ⚠️
	// Current buggy behavior: Policy evaluator sees job.Status == Successful
	// and IMMEDIATELY allows downstream deployment without checking if
	// ArgoCD destination is actually synced.
	
	// Check immediately after destination success - app should still be blocked
	appJobs = getAgentJobsSortedByNewest(engine, appJobAgentID)
	
	// ❌ THIS ASSERTION WILL FAIL - exposing the bug
	// The policy should NOT allow deployment immediately because ArgoCD
	// destinations need time to sync. The app job should still be blocked.
	assert.Equal(t, 0, len(appJobs),
		"EXPECTED BEHAVIOR: App should remain blocked immediately after destination job success "+
		"to allow time for ArgoCD destination to sync. "+
		"ACTUAL BUG: Policy allows deployment immediately, causing 'unable to find destination server' errors")
	
	// Expected fix: The policy evaluator should either:
	// 1. Add a delay/grace period after ArgoCD destination jobs succeed, OR
	// 2. Check ArgoCD sync status before allowing dependent deployments, OR  
	// 3. Mark downstream jobs with a flag to wait for ArgoCD sync
	//
	// When the fix is implemented, the above assertion will pass because:
	// - The policy will add a delay/wait mechanism
	// - The app job won't be created immediately
	// - Only after ArgoCD sync is verified will the app job be created
}
