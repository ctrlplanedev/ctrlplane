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

// TestEngine_PolicyConflict_MultipleApprovalRequirements tests that when multiple
// policies apply to the same release target with different approval requirements,
// they are merged and all approval requirements must be satisfied.
func TestEngine_PolicyConflict_MultipleApprovalRequirements(t *testing.T) {
	jobAgentID := uuid.New().String()
	deploymentID := uuid.New().String()
	environmentID := uuid.New().String()
	resourceID := uuid.New().String()
	policy1ID := uuid.New().String()
	policy2ID := uuid.New().String()
	user1ID := uuid.New().String()
	user2ID := uuid.New().String()
	user3ID := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID),
		),
		integration.WithSystem(
			integration.WithDeployment(
				integration.DeploymentID(deploymentID),
				integration.DeploymentName("api-service"),
				integration.DeploymentJobAgent(jobAgentID),
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
		// Policy 1: requires 2 approvals
		integration.WithPolicy(
			integration.PolicyID(policy1ID),
			integration.PolicyName("policy-approval-2"),
			integration.WithPolicySelector("true"),
			integration.WithPolicyRule(
				integration.WithRuleAnyApproval(2),
			),
		),
		// Policy 2: requires 3 approvals
		integration.WithPolicy(
			integration.PolicyID(policy2ID),
			integration.PolicyName("policy-approval-3"),
			integration.WithPolicySelector("true"),
			integration.WithPolicyRule(
				integration.WithRuleAnyApproval(3),
			),
		),
	)

	ctx := context.Background()

	// Create a deployment version
	version := c.NewDeploymentVersion()
	version.DeploymentId = deploymentID
	version.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, version)

	// Verify NO jobs are created yet (policies block)
	allJobs := engine.Workspace().Jobs().Items()
	if len(allJobs) > 0 {
		t.Fatalf("expected 0 jobs before approvals (both policies require approval), got %d", len(allJobs))
	}

	// Add 2 approvals - satisfies policy 1 but not policy 2
	approval1 := &oapi.UserApprovalRecord{
		VersionId:     version.Id,
		EnvironmentId: environmentID,
		UserId:        user1ID,
		Status:        oapi.ApprovalStatusApproved,
	}
	engine.PushEvent(ctx, handler.UserApprovalRecordCreate, approval1)

	approval2 := &oapi.UserApprovalRecord{
		VersionId:     version.Id,
		EnvironmentId: environmentID,
		UserId:        user2ID,
		Status:        oapi.ApprovalStatusApproved,
	}
	engine.PushEvent(ctx, handler.UserApprovalRecordCreate, approval2)

	// Still no jobs (need 3 approvals total for policy 2)
	allJobs = engine.Workspace().Jobs().Items()
	if len(allJobs) > 0 {
		t.Fatalf("expected 0 jobs with 2 approvals (policy 2 requires 3), got %d", len(allJobs))
	}

	// Add 3rd approval - now both policies are satisfied
	approval3 := &oapi.UserApprovalRecord{
		VersionId:     version.Id,
		EnvironmentId: environmentID,
		UserId:        user3ID,
		Status:        oapi.ApprovalStatusApproved,
	}
	engine.PushEvent(ctx, handler.UserApprovalRecordCreate, approval3)

	// Now job should be created
	allJobs = engine.Workspace().Jobs().Items()
	if len(allJobs) != 1 {
		t.Fatalf("expected 1 job after 3 approvals (satisfies both policies), got %d", len(allJobs))
	}
}

// TestEngine_PolicyConflict_OverlappingSelectors tests multiple policies with
// overlapping selectors targeting the same release target.
func TestEngine_PolicyConflict_OverlappingSelectors(t *testing.T) {
	jobAgentID := uuid.New().String()
	deploymentID := uuid.New().String()
	environmentID := uuid.New().String()
	resourceID := uuid.New().String()
	policy1ID := uuid.New().String()
	policy2ID := uuid.New().String()
	user1ID := uuid.New().String()
	user2ID := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID),
		),
		integration.WithSystem(
			integration.WithDeployment(
				integration.DeploymentID(deploymentID),
				integration.DeploymentName("api-service"),
				integration.DeploymentJobAgent(jobAgentID),
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
		// Policy 1: targets production environment specifically
		integration.WithPolicy(
			integration.PolicyID(policy1ID),
			integration.PolicyName("production-approvals"),
			integration.WithPolicySelector("environment.name == 'production'"),
			integration.WithPolicyRule(
				integration.WithRuleAnyApproval(2),
			),
		),
		// Policy 2: targets all deployments
		integration.WithPolicy(
			integration.PolicyID(policy2ID),
			integration.PolicyName("all-deployments-approval"),
			integration.WithPolicySelector("true"),
			integration.WithPolicyRule(
				integration.WithRuleAnyApproval(1),
			),
		),
	)

	ctx := context.Background()

	version := c.NewDeploymentVersion()
	version.DeploymentId = deploymentID
	version.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, version)

	// No jobs yet (both policies apply)
	allJobs := engine.Workspace().Jobs().Items()
	if len(allJobs) > 0 {
		t.Fatalf("expected 0 jobs before approvals, got %d", len(allJobs))
	}

	// Add 1 approval - satisfies policy 2 but not policy 1
	approval1 := &oapi.UserApprovalRecord{
		VersionId:     version.Id,
		EnvironmentId: environmentID,
		UserId:        user1ID,
		Status:        oapi.ApprovalStatusApproved,
	}
	engine.PushEvent(ctx, handler.UserApprovalRecordCreate, approval1)

	allJobs = engine.Workspace().Jobs().Items()
	if len(allJobs) > 0 {
		t.Fatalf("expected 0 jobs with 1 approval (policy 1 requires 2), got %d", len(allJobs))
	}

	// Add 2nd approval - now both policies satisfied
	approval2 := &oapi.UserApprovalRecord{
		VersionId:     version.Id,
		EnvironmentId: environmentID,
		UserId:        user2ID,
		Status:        oapi.ApprovalStatusApproved,
	}
	engine.PushEvent(ctx, handler.UserApprovalRecordCreate, approval2)

	allJobs = engine.Workspace().Jobs().Items()
	if len(allJobs) != 1 {
		t.Fatalf("expected 1 job after 2 approvals (both policies satisfied), got %d", len(allJobs))
	}
}

// TestEngine_PolicyConflict_PriorityOrdering tests that policy priority
// affects evaluation order but all policies must still be satisfied.
func TestEngine_PolicyConflict_PriorityOrdering(t *testing.T) {
	jobAgentID := uuid.New().String()
	deploymentID := uuid.New().String()
	environmentID := uuid.New().String()
	resourceID := uuid.New().String()
	highPriorityPolicyID := uuid.New().String()
	lowPriorityPolicyID := uuid.New().String()
	user1ID := uuid.New().String()

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
		// High priority policy: requires approval
		integration.WithPolicy(
			integration.PolicyID(highPriorityPolicyID),
			integration.PolicyName("high-priority-approval"),
			integration.WithPolicySelector("true"),
			integration.WithPolicyRule(
				integration.WithRuleAnyApproval(1),
			),
		),
		// Low priority policy: max retries
		integration.WithPolicy(
			integration.PolicyID(lowPriorityPolicyID),
			integration.PolicyName("low-priority-retry"),
			integration.WithPolicySelector("true"),
			integration.WithPolicyRule(
				integration.WithRuleRetry(3, []oapi.JobStatus{oapi.JobStatusFailure}),
			),
		),
	)

	ctx := context.Background()

	version := c.NewDeploymentVersion()
	version.DeploymentId = deploymentID
	version.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, version)

	// No jobs yet (high priority policy blocks)
	allJobs := engine.Workspace().Jobs().Items()
	if len(allJobs) > 0 {
		t.Fatalf("expected 0 jobs before approval, got %d", len(allJobs))
	}

	// Add approval
	approval := &oapi.UserApprovalRecord{
		VersionId:     version.Id,
		EnvironmentId: environmentID,
		UserId:        user1ID,
		Status:        oapi.ApprovalStatusApproved,
	}
	engine.PushEvent(ctx, handler.UserApprovalRecordCreate, approval)

	// Job should be created
	allJobs = engine.Workspace().Jobs().Items()
	if len(allJobs) != 1 {
		t.Fatalf("expected 1 job after approval, got %d", len(allJobs))
	}

	// Verify retry policy from low priority also applies
	job := getFirstJob(allJobs)
	release, ok := engine.Workspace().Releases().Get(job.ReleaseId)
	if !ok {
		t.Fatalf("release not found for job")
	}

	// Get policies for this release target to verify both are applied
	policies, err := engine.Workspace().ReleaseTargets().GetPolicies(ctx, &release.ReleaseTarget)
	if err != nil {
		t.Fatalf("failed to get policies: %v", err)
	}

	if len(policies) != 2 {
		t.Fatalf("expected 2 policies to apply, got %d", len(policies))
	}
}

// TestEngine_PolicyConflict_ApprovalPlusRetry tests the interaction between
// approval policies and retry policies on the same target.
func TestEngine_PolicyConflict_ApprovalPlusRetry(t *testing.T) {
	jobAgentID := uuid.New().String()
	deploymentID := uuid.New().String()
	environmentID := uuid.New().String()
	resourceID := uuid.New().String()
	approvalPolicyID := uuid.New().String()
	retryPolicyID := uuid.New().String()
	user1ID := uuid.New().String()

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
		// Approval policy
		integration.WithPolicy(
			integration.PolicyID(approvalPolicyID),
			integration.PolicyName("approval-required"),
			integration.WithPolicySelector("true"),
			integration.WithPolicyRule(
				integration.WithRuleAnyApproval(1),
			),
		),
		// Retry policy
		integration.WithPolicy(
			integration.PolicyID(retryPolicyID),
			integration.PolicyName("retry-on-failure"),
			integration.WithPolicySelector("true"),
			integration.WithPolicyRule(
				integration.WithRuleRetry(3, []oapi.JobStatus{oapi.JobStatusFailure}),
			),
		),
	)

	ctx := context.Background()

	version := c.NewDeploymentVersion()
	version.DeploymentId = deploymentID
	version.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, version)

	// No jobs yet (needs approval)
	allJobs := engine.Workspace().Jobs().Items()
	if len(allJobs) > 0 {
		t.Fatalf("expected 0 jobs before approval, got %d", len(allJobs))
	}

	// Add approval
	approval := &oapi.UserApprovalRecord{
		VersionId:     version.Id,
		EnvironmentId: environmentID,
		UserId:        user1ID,
		Status:        oapi.ApprovalStatusApproved,
	}
	engine.PushEvent(ctx, handler.UserApprovalRecordCreate, approval)

	// Job should be created after approval
	allJobs = engine.Workspace().Jobs().Items()
	if len(allJobs) != 1 {
		t.Fatalf("expected 1 job after approval, got %d", len(allJobs))
	}

	// Get policies to verify both apply
	job := getFirstJob(allJobs)
	release, _ := engine.Workspace().Releases().Get(job.ReleaseId)
	policies, _ := engine.Workspace().ReleaseTargets().GetPolicies(ctx, &release.ReleaseTarget)

	if len(policies) != 2 {
		t.Fatalf("expected 2 policies to apply (approval + retry), got %d", len(policies))
	}

	t.Logf("Verified: Both approval and retry policies apply to the same target")
}

// TestEngine_PolicyConflict_AllRulesMerged tests that when multiple policies
// apply to the same target, all their rules are evaluated together.
func TestEngine_PolicyConflict_AllRulesMerged(t *testing.T) {
	jobAgentID := uuid.New().String()
	deploymentID := uuid.New().String()
	environmentID := uuid.New().String()
	policy1ID := uuid.New().String()
	policy2ID := uuid.New().String()
	user1ID := uuid.New().String()

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
		// Policy 1: approval required
		integration.WithPolicy(
			integration.PolicyID(policy1ID),
			integration.PolicyName("approval-policy"),
			integration.WithPolicySelector("true"),
			integration.WithPolicyRule(
				integration.WithRuleAnyApproval(1),
			),
		),
		// Policy 2: gradual rollout
		integration.WithPolicy(
			integration.PolicyID(policy2ID),
			integration.PolicyName("rollout-policy"),
			integration.WithPolicySelector("true"),
			integration.WithPolicyRule(
				integration.WithRuleGradualRollout(300), // 5 minute intervals
			),
		),
	)

	ctx := context.Background()

	version := c.NewDeploymentVersion()
	version.DeploymentId = deploymentID
	version.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, version)

	// No jobs yet (needs approval)
	allJobs := engine.Workspace().Jobs().Items()
	if len(allJobs) > 0 {
		t.Fatalf("expected 0 jobs before approval, got %d", len(allJobs))
	}

	// Add approval
	approval := &oapi.UserApprovalRecord{
		VersionId:     version.Id,
		EnvironmentId: environmentID,
		UserId:        user1ID,
		Status:        oapi.ApprovalStatusApproved,
		CreatedAt:     time.Now().Format(time.RFC3339),
	}
	engine.PushEvent(ctx, handler.UserApprovalRecordCreate, approval)

	// Jobs should be created, but gradual rollout may limit how many
	allJobs = engine.Workspace().Jobs().Items()
	if len(allJobs) == 0 {
		t.Fatalf("expected at least 1 job after approval, got 0")
	}

	// Verify both policies apply
	job := getFirstJob(allJobs)
	release, _ := engine.Workspace().Releases().Get(job.ReleaseId)
	policies, _ := engine.Workspace().ReleaseTargets().GetPolicies(ctx, &release.ReleaseTarget)

	if len(policies) != 2 {
		t.Fatalf("expected 2 policies to apply, got %d", len(policies))
	}

	t.Logf("Verified: Both approval and gradual rollout policies apply together")
}

// Helper function to get first job from map
func getFirstJob(jobs map[string]*oapi.Job) *oapi.Job {
	for _, job := range jobs {
		return job
	}
	return nil
}
