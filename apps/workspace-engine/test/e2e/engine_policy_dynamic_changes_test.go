package e2e

import (
	"context"
	"testing"
	"time"
	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/oapi"
	"workspace-engine/test/integration"
	c "workspace-engine/test/integration/creators"
)

// TestEngine_PolicyPriorityChange_MidDeployment tests that changing policy
// priority during an active deployment affects subsequent evaluations.
func TestEngine_PolicyPriorityChange_MidDeployment(t *testing.T) {
	jobAgentID := "job-agent-1"
	deploymentID := "deployment-1"
	environmentID := "env-1"
	resourceID := "resource-1"
	policyID := "policy-1"

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
			integration.PolicyID(policyID),
			integration.PolicyName("approval-policy"),
			integration.WithPolicySelector("true"),
			integration.WithPolicyRule(
				integration.WithRuleAnyApproval(1),
			),
		),
	)

	ctx := context.Background()

	version1 := c.NewDeploymentVersion()
	version1.DeploymentId = deploymentID
	version1.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, version1)

	// No jobs yet (needs approval)
	allJobs := engine.Workspace().Jobs().Items()
	if len(allJobs) > 0 {
		t.Fatalf("expected 0 jobs before approval, got %d", len(allJobs))
	}

	// Update policy priority
	policy, _ := engine.Workspace().Policies().Get(policyID)
	policy.Priority = 100
	engine.PushEvent(ctx, handler.PolicyUpdate, policy)

	// Policy should still be blocking (priority change doesn't affect blocking behavior)
	allJobs = engine.Workspace().Jobs().Items()
	if len(allJobs) > 0 {
		t.Fatalf("expected 0 jobs after priority change (still needs approval), got %d", len(allJobs))
	}

	// Add approval
	approval := &oapi.UserApprovalRecord{
		VersionId:     version1.Id,
		EnvironmentId: environmentID,
		UserId:        "user-1",
		Status:        oapi.ApprovalStatusApproved,
	}
	engine.PushEvent(ctx, handler.UserApprovalRecordCreate, approval)

	// Job should now be created
	allJobs = engine.Workspace().Jobs().Items()
	if len(allJobs) != 1 {
		t.Fatalf("expected 1 job after approval, got %d", len(allJobs))
	}

	t.Logf("Policy priority change verified - priority updated from 10 to 100")
}

// TestEngine_PolicyEnabledToggle_ActiveDeployments tests that disabling a policy
// during active deployments allows blocked deployments to proceed.
func TestEngine_PolicyEnabledToggle_ActiveDeployments(t *testing.T) {
	jobAgentID := "job-agent-1"
	deploymentID := "deployment-1"
	environmentID := "env-1"
	resourceID := "resource-1"
	policyID := "policy-1"

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
			integration.PolicyID(policyID),
			integration.PolicyName("approval-policy"),
			integration.WithPolicySelector("true"),
			integration.WithPolicyRule(
				integration.WithRuleAnyApproval(2),
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

	// Disable the policy
	policy, _ := engine.Workspace().Policies().Get(policyID)
	policy.Enabled = false
	engine.PushEvent(ctx, handler.PolicyUpdate, policy)

	time.Sleep(100 * time.Millisecond)

	// Job should now be created (policy disabled, reconciliation triggered automatically)
	allJobs = engine.Workspace().Jobs().Items()
	if len(allJobs) != 1 {
		t.Fatalf("expected 1 job after disabling policy, got %d", len(allJobs))
	}

	t.Logf("Policy disabled - deployment proceeded without approval")
}

// TestEngine_PolicyRulesUpdate_ExistingApprovals tests that changing approval
// requirements mid-process affects whether existing approvals are sufficient.
func TestEngine_PolicyRulesUpdate_ExistingApprovals(t *testing.T) {
	jobAgentID := "job-agent-1"
	deploymentID := "deployment-1"
	environmentID := "env-1"
	resourceID := "resource-1"
	policyID := "policy-1"

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
			integration.PolicyID(policyID),
			integration.PolicyName("approval-policy"),
			integration.WithPolicySelector("true"),
			integration.WithPolicyRule(
				integration.WithRuleAnyApproval(2),
			),
		),
	)

	ctx := context.Background()

	version := c.NewDeploymentVersion()
	version.DeploymentId = deploymentID
	version.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, version)

	// Add 2 approvals
	approval1 := &oapi.UserApprovalRecord{
		VersionId:     version.Id,
		EnvironmentId: environmentID,
		UserId:        "user-1",
		Status:        oapi.ApprovalStatusApproved,
	}
	engine.PushEvent(ctx, handler.UserApprovalRecordCreate, approval1)

	approval2 := &oapi.UserApprovalRecord{
		VersionId:     version.Id,
		EnvironmentId: environmentID,
		UserId:        "user-2",
		Status:        oapi.ApprovalStatusApproved,
	}
	engine.PushEvent(ctx, handler.UserApprovalRecordCreate, approval2)

	// Job should be created with 2 approvals
	allJobs := engine.Workspace().Jobs().Items()
	if len(allJobs) != 1 {
		t.Fatalf("expected 1 job after 2 approvals, got %d", len(allJobs))
	}

	// Mark job as successful
	job := getFirstJob(allJobs)
	job.Status = oapi.JobStatusSuccessful
	completedAt := time.Now()
	job.CompletedAt = &completedAt
	engine.PushEvent(ctx, handler.JobUpdate, job)

	// Update policy to require 3 approvals
	policy, _ := engine.Workspace().Policies().Get(policyID)
	policy.Rules[0].AnyApproval.MinApprovals = 3
	engine.PushEvent(ctx, handler.PolicyUpdate, policy)

	// Create new version
	version2 := c.NewDeploymentVersion()
	version2.DeploymentId = deploymentID
	version2.Tag = "v2.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, version2)

	// No new job yet (need 3 approvals now, only have 0 for v2)
	allJobs = engine.Workspace().Jobs().Items()
	jobCountForV2 := 0
	for _, j := range allJobs {
		release, ok := engine.Workspace().Releases().Get(j.ReleaseId)
		if ok && release.Version.Tag == "v2.0.0" {
			jobCountForV2++
		}
	}

	if jobCountForV2 > 0 {
		t.Fatalf("expected 0 jobs for v2.0.0 (policy now requires 3 approvals), got %d", jobCountForV2)
	}

	t.Logf("Policy updated from 2 to 3 approvals - new deployment blocked until sufficient approvals")
}

// TestEngine_PolicySelectorUpdate_ReleaseTargetScope tests that updating
// policy selectors changes which release targets are affected.
func TestEngine_PolicySelectorUpdate_ReleaseTargetScope(t *testing.T) {
	jobAgentID := "job-agent-1"
	deploymentID := "deployment-1"
	environment1ID := "env-prod"
	environment2ID := "env-dev"
	resourceID := "resource-1"
	policyID := "policy-1"

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
				integration.EnvironmentID(environment1ID),
				integration.EnvironmentName("production"),
				integration.EnvironmentCelResourceSelector("true"),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environment2ID),
				integration.EnvironmentName("development"),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceID(resourceID),
		),
		// Policy initially targets production only
		integration.WithPolicy(
			integration.PolicyID(policyID),
			integration.PolicyName("prod-approval"),
			integration.WithPolicySelector("environment.name == 'production'"),
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

	// Should have 1 job for dev (not blocked), 0 for prod (blocked by policy)
	allJobs := engine.Workspace().Jobs().Items()
	devJobs := 0
	prodJobs := 0
	for _, job := range allJobs {
		release, ok := engine.Workspace().Releases().Get(job.ReleaseId)
		if !ok {
			continue
		}
		switch release.ReleaseTarget.EnvironmentId {
		case environment1ID:
			prodJobs++
		case environment2ID:
			devJobs++
		}
	}

	if prodJobs > 0 {
		t.Fatalf("expected 0 prod jobs (blocked by policy), got %d", prodJobs)
	}
	if devJobs != 1 {
		t.Fatalf("expected 1 dev job (not blocked), got %d", devJobs)
	}

	// Update policy selector to target ALL environments
	policy, _ := engine.Workspace().Policies().Get(policyID)
	policy.Selector = "true"
	engine.PushEvent(ctx, handler.PolicyUpdate, policy)

	// Create new version
	version2 := c.NewDeploymentVersion()
	version2.DeploymentId = deploymentID
	version2.Tag = "v2.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, version2)

	// Now BOTH environments should be blocked
	allJobs = engine.Workspace().Jobs().Items()
	v2Jobs := 0
	for _, job := range allJobs {
		release, ok := engine.Workspace().Releases().Get(job.ReleaseId)
		if ok && release.Version.Tag == "v2.0.0" {
			v2Jobs++
		}
	}

	if v2Jobs > 0 {
		t.Fatalf("expected 0 jobs for v2.0.0 (policy now blocks both environments), got %d", v2Jobs)
	}

	t.Logf("Policy selector updated - now blocks both prod and dev environments")
}

// TestEngine_PolicyDelete_WithPendingApprovals tests that deleting a policy
// allows previously blocked deployments to proceed.
func TestEngine_PolicyDelete_WithPendingApprovals(t *testing.T) {
	jobAgentID := "job-agent-1"
	deploymentID := "deployment-1"
	environmentID := "env-1"
	resourceID := "resource-1"
	policyID := "policy-1"

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
			integration.PolicyID(policyID),
			integration.PolicyName("approval-policy"),
			integration.WithPolicySelector("true"),
			integration.WithPolicyRule(
				integration.WithRuleAnyApproval(2),
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
		t.Fatalf("expected 0 jobs before approvals, got %d", len(allJobs))
	}

	// Add 1 approval (not enough)
	approval := &oapi.UserApprovalRecord{
		VersionId:     version.Id,
		EnvironmentId: environmentID,
		UserId:        "user-1",
		Status:        oapi.ApprovalStatusApproved,
	}
	engine.PushEvent(ctx, handler.UserApprovalRecordCreate, approval)

	// Still no jobs (need 2 approvals)
	allJobs = engine.Workspace().Jobs().Items()
	if len(allJobs) > 0 {
		t.Fatalf("expected 0 jobs with 1 approval (need 2), got %d", len(allJobs))
	}

	// Delete the policy
	policy, _ := engine.Workspace().Policies().Get(policyID)
	engine.PushEvent(ctx, handler.PolicyDelete, policy)

	time.Sleep(100 * time.Millisecond)

	// Job should now be created (policy no longer blocks, reconciliation triggered automatically)
	allJobs = engine.Workspace().Jobs().Items()
	if len(allJobs) != 1 {
		t.Fatalf("expected 1 job after policy deletion, got %d", len(allJobs))
	}

	t.Logf("Policy deleted - deployment proceeded without additional approvals")
}

// TestEngine_PolicyAdded_RetroactiveBlocking tests that adding a new policy
// can block new deployments but doesn't affect already running jobs.
func TestEngine_PolicyAdded_RetroactiveBlocking(t *testing.T) {
	jobAgentID := "job-agent-1"
	deploymentID := "deployment-1"
	environmentID := "env-1"
	resourceID := "resource-1"
	policyID := "policy-new"

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
	)

	ctx := context.Background()

	// Create first version (no policy exists yet)
	version1 := c.NewDeploymentVersion()
	version1.DeploymentId = deploymentID
	version1.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, version1)

	// Job should be created (no blocking policy)
	allJobs := engine.Workspace().Jobs().Items()
	if len(allJobs) != 1 {
		t.Fatalf("expected 1 job for v1.0.0 (no policy), got %d", len(allJobs))
	}

	v1Job := getFirstJob(allJobs)
	if v1Job.Status == oapi.JobStatusCancelled {
		t.Fatalf("v1.0.0 job should not be cancelled")
	}

	// Now add a policy requiring approval
	policy := c.NewPolicy(engine.Workspace().ID)
	policy.Id = policyID
	policy.Name = "new-approval-policy"
	policy.Enabled = true
	policy.Selector = "true"

	policy.Rules = []oapi.PolicyRule{
		{
			Id:          "rule-1",
			PolicyId:    policyID,
			AnyApproval: &oapi.AnyApprovalRule{MinApprovals: 1},
		},
	}

	engine.PushEvent(ctx, handler.PolicyCreate, policy)

	// Existing v1.0.0 job should NOT be affected
	allJobs = engine.Workspace().Jobs().Items()
	v1JobUpdated := allJobs[v1Job.Id]
	if v1JobUpdated.Status == oapi.JobStatusCancelled {
		t.Fatalf("existing v1.0.0 job should not be cancelled by new policy")
	}

	// Create second version (policy now exists)
	version2 := c.NewDeploymentVersion()
	version2.DeploymentId = deploymentID
	version2.Tag = "v2.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, version2)

	// v2.0.0 should be blocked by new policy
	allJobs = engine.Workspace().Jobs().Items()
	v2Jobs := 0
	for _, job := range allJobs {
		release, ok := engine.Workspace().Releases().Get(job.ReleaseId)
		if ok && release.Version.Tag == "v2.0.0" {
			v2Jobs++
		}
	}

	if v2Jobs > 0 {
		t.Fatalf("expected 0 jobs for v2.0.0 (blocked by new policy), got %d", v2Jobs)
	}

	t.Logf("New policy added - blocks new deployments but doesn't affect existing jobs")
}
