package e2e

import (
	"context"
	"testing"
	"workspace-engine/test/integration"
)

// TestUserApprovalRecords_NoApprovalBlocksJobCreation verifies that when an approval policy
// is configured, jobs are NOT created until the version is approved.
// Expected behavior:
// - Release targets exist (created by selector matching)
// - No jobs created (version not approved)
// - No releases exist
func TestUserApprovalRecords_NoApprovalBlocksJobCreation(t *testing.T) {
	jobAgentId := "job-agent-1"
	engine := integration.NewTestWorkspace(t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentId),
		),
		integration.WithPolicy(
			integration.WithPolicyTargetSelector(
				integration.PolicyTargetJsonResourceAllSelector(),
			),
			integration.WithPolicyRule(
				integration.PolicyRuleAnyApproval(1),
			),
		),
		integration.WithResource(
			integration.ResourceName("resource-1"),
		),
		integration.WithSystem(
			integration.WithDeployment(
				integration.WithDeploymentVersion(
					integration.DeploymentVersionTag("v1.0.0"),
				),
				integration.DeploymentJobAgent(jobAgentId),
			),
			integration.WithEnvironment(
				integration.EnvironmentName("production"),
				integration.EnvironmentJsonResourceAllSelector(),
			),
		),
	)

	ctx := context.Background()

	releaseTargets, err := engine.Workspace().ReleaseTargets().Items(ctx)
	if err != nil {
		t.Fatalf("failed to get release targets")
	}
	if len(releaseTargets) != 1 {
		t.Fatalf("expected 1 release target, got %d", len(releaseTargets))
	}

	pendingJobs := engine.Workspace().Jobs().GetPending()
	if len(pendingJobs) != 0 {
		t.Fatalf("expected 0 pending jobs, got %d", len(pendingJobs))
	}
}

// TestUserApprovalRecords_ApprovalCreatesJobs verifies that approving a version
// causes jobs to be created for all matching release targets.
// Expected behavior:
// - Release targets remain unchanged (3 targets)
// - 3 jobs created (1 per release target)
// - 3 releases exist (all pointing to approved version)
// - All jobs in Pending status
// func TestUserApprovalRecords_ApprovalCreatesJobs(t *testing.T) {
// 	engine := integration.NewTestWorkspace(t)
// 	workspaceID := engine.Workspace().ID
// 	ctx := context.Background()

// 	// Create job agent
// 	jobAgent := c.NewJobAgent(workspaceID)
// 	engine.PushEvent(ctx, handler.JobAgentCreate, jobAgent)

// 	// Create system
// 	sys := c.NewSystem(workspaceID)
// 	sys.Name = "test-system"
// 	engine.PushEvent(ctx, handler.SystemCreate, sys)

// 	// Create deployment
// 	d1 := c.NewDeployment(sys.Id)
// 	d1.Name = "deployment-1"
// 	d1.JobAgentId = &jobAgent.Id
// 	engine.PushEvent(ctx, handler.DeploymentCreate, d1)

// 	// Create environment
// 	e1 := c.NewEnvironment(sys.Id)
// 	e1.Name = "env-prod"
// 	engine.PushEvent(ctx, handler.EnvironmentCreate, e1)

// 	// Create policy requiring 1 approval
// 	policy := c.NewPolicy(workspaceID)
// 	policy.Name = "require-approval"
// 	policy.Selectors = []oapi.PolicyTargetSelector{
// 		{
// 			Id: "selector-1",
// 		},
// 	}
// 	policy.Rules = []oapi.PolicyRule{
// 		{
// 			Id: "rule-1",
// 			AnyApproval: &oapi.AnyApprovalRule{
// 				MinApprovals: 1,
// 			},
// 		},
// 	}
// 	engine.PushEvent(ctx, handler.PolicyCreate, policy)

// 	// Create 3 resources
// 	r1 := c.NewResource(workspaceID)
// 	r1.Name = "resource-1"
// 	engine.PushEvent(ctx, handler.ResourceCreate, r1)

// 	r2 := c.NewResource(workspaceID)
// 	r2.Name = "resource-2"
// 	engine.PushEvent(ctx, handler.ResourceCreate, r2)

// 	r3 := c.NewResource(workspaceID)
// 	r3.Name = "resource-3"
// 	engine.PushEvent(ctx, handler.ResourceCreate, r3)

// 	// Create deployment version v1.0
// 	dv1 := c.NewDeploymentVersion()
// 	dv1.DeploymentId = d1.Id
// 	dv1.Tag = "v1.0.0"
// 	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv1)

// 	// Verify no jobs yet
// 	pendingJobs := engine.Workspace().Jobs().GetPending()
// 	if len(pendingJobs) != 0 {
// 		t.Fatalf("expected 0 pending jobs before approval, got %d", len(pendingJobs))
// 	}

// 	// User approves v1.0 for environment
// 	user1ID := c.NewUserID()
// 	approval := c.NewUserApprovalRecord(dv1.Id, e1.Id, user1ID)
// 	approval.Status = oapi.ApprovalStatusApproved
// 	reason := "LGTM - ready for deployment"
// 	approval.Reason = &reason
// 	engine.PushEvent(ctx, handler.UserApprovalRecordCreate, approval)

// 	// EXPECTED: 3 jobs created (1 per release target)
// 	pendingJobs = engine.Workspace().Jobs().GetPending()
// 	if len(pendingJobs) != 3 {
// 		t.Fatalf("expected 3 pending jobs after approval, got %d", len(pendingJobs))
// 	}

// 	// EXPECTED: All jobs are in Pending status
// 	for _, job := range pendingJobs {
// 		if job.Status != oapi.Pending {
// 			t.Fatalf("expected job status Pending, got %v", job.Status)
// 		}
// 	}

// 	// EXPECTED: 3 releases exist (1 per job)
// 	releaseCount := 0
// 	for _, job := range pendingJobs {
// 		if release, ok := engine.Workspace().Releases().Get(job.ReleaseId); ok {
// 			releaseCount++
// 			// EXPECTED: All releases point to v1.0
// 			if release.Version.Id != dv1.Id {
// 				t.Fatalf("expected release version %s, got %s", dv1.Id, release.Version.Id)
// 			}
// 			if release.Version.Tag != "v1.0.0" {
// 				t.Fatalf("expected release version tag v1.0.0, got %s", release.Version.Tag)
// 			}
// 		}
// 	}
// 	if releaseCount != 3 {
// 		t.Fatalf("expected 3 releases after approval, got %d", releaseCount)
// 	}

// 	// EXPECTED: Release targets unchanged (still 3)
// 	releaseTargets, err := engine.Workspace().ReleaseTargets().Items(ctx)
// 	if err != nil {
// 		t.Fatalf("failed to get release targets: %v", err)
// 	}
// 	if len(releaseTargets) != 3 {
// 		t.Fatalf("expected 3 release targets after approval, got %d", len(releaseTargets))
// 	}
// }

// // TestUserApprovalRecords_InsufficientApprovalsNoJobs verifies that when a policy
// // requires multiple approvals, jobs are NOT created until the threshold is met.
// // Expected behavior:
// // - After 1 approval (need 3): 0 jobs
// // - After 2 approvals (need 3): 0 jobs
// // - Threshold not met = no releases
// func TestUserApprovalRecords_InsufficientApprovalsNoJobs(t *testing.T) {
// 	engine := integration.NewTestWorkspace(t)
// 	workspaceID := engine.Workspace().ID
// 	ctx := context.Background()

// 	// Create job agent
// 	jobAgent := c.NewJobAgent(workspaceID)
// 	engine.PushEvent(ctx, handler.JobAgentCreate, jobAgent)

// 	// Create system
// 	sys := c.NewSystem(workspaceID)
// 	sys.Name = "test-system"
// 	engine.PushEvent(ctx, handler.SystemCreate, sys)

// 	// Create deployment
// 	d1 := c.NewDeployment(sys.Id)
// 	d1.Name = "deployment-1"
// 	d1.JobAgentId = &jobAgent.Id
// 	engine.PushEvent(ctx, handler.DeploymentCreate, d1)

// 	// Create environment
// 	e1 := c.NewEnvironment(sys.Id)
// 	e1.Name = "env-prod"
// 	engine.PushEvent(ctx, handler.EnvironmentCreate, e1)

// 	// Create policy requiring 3 approvals
// 	policy := c.NewPolicy(workspaceID)
// 	policy.Name = "require-three-approvals"
// 	policy.Selectors = []oapi.PolicyTargetSelector{
// 		{
// 			Id: "selector-1",
// 		},
// 	}
// 	policy.Rules = []oapi.PolicyRule{
// 		{
// 			Id: "rule-1",
// 			AnyApproval: &oapi.AnyApprovalRule{
// 				MinApprovals: 3,
// 			},
// 		},
// 	}
// 	engine.PushEvent(ctx, handler.PolicyCreate, policy)

// 	// Create 4 resources
// 	for i := 1; i <= 4; i++ {
// 		r := c.NewResource(workspaceID)
// 		r.Name = "resource-" + string(rune('0'+i))
// 		engine.PushEvent(ctx, handler.ResourceCreate, r)
// 	}

// 	// Create deployment version v1.0
// 	dv1 := c.NewDeploymentVersion()
// 	dv1.DeploymentId = d1.Id
// 	dv1.Tag = "v1.0.0"
// 	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv1)

// 	// User1 approves
// 	user1ID := c.NewUserID()
// 	approval1 := c.NewUserApprovalRecord(dv1.Id, e1.Id, user1ID)
// 	engine.PushEvent(ctx, handler.UserApprovalRecordCreate, approval1)

// 	// EXPECTED: 0 jobs after 1 approval (need 3)
// 	pendingJobs := engine.Workspace().Jobs().GetPending()
// 	if len(pendingJobs) != 0 {
// 		t.Fatalf("expected 0 pending jobs after 1 approval (need 3), got %d", len(pendingJobs))
// 	}

// 	// User2 approves
// 	user2ID := c.NewUserID()
// 	approval2 := c.NewUserApprovalRecord(dv1.Id, e1.Id, user2ID)
// 	engine.PushEvent(ctx, handler.UserApprovalRecordCreate, approval2)

// 	// EXPECTED: 0 jobs after 2 approvals (still need 3)
// 	pendingJobs = engine.Workspace().Jobs().GetPending()
// 	if len(pendingJobs) != 0 {
// 		t.Fatalf("expected 0 pending jobs after 2 approvals (need 3), got %d", len(pendingJobs))
// 	}

// 	// EXPECTED: 0 releases
// 	// Since no jobs were created (insufficient approvals), there should be no releases
// }

// // TestUserApprovalRecords_MeetingThresholdCreatesJobs verifies that once the
// // required approval threshold is met, all jobs are created.
// // Expected behavior:
// // - After meeting threshold (3rd approval): 4 jobs created
// // - 4 releases exist (all pointing to approved version)
// func TestUserApprovalRecords_MeetingThresholdCreatesJobs(t *testing.T) {
// 	engine := integration.NewTestWorkspace(t)
// 	workspaceID := engine.Workspace().ID
// 	ctx := context.Background()

// 	// Create job agent
// 	jobAgent := c.NewJobAgent(workspaceID)
// 	engine.PushEvent(ctx, handler.JobAgentCreate, jobAgent)

// 	// Create system
// 	sys := c.NewSystem(workspaceID)
// 	sys.Name = "test-system"
// 	engine.PushEvent(ctx, handler.SystemCreate, sys)

// 	// Create deployment
// 	d1 := c.NewDeployment(sys.Id)
// 	d1.Name = "deployment-1"
// 	d1.JobAgentId = &jobAgent.Id
// 	engine.PushEvent(ctx, handler.DeploymentCreate, d1)

// 	// Create environment
// 	e1 := c.NewEnvironment(sys.Id)
// 	e1.Name = "env-prod"
// 	engine.PushEvent(ctx, handler.EnvironmentCreate, e1)

// 	// Create policy requiring 3 approvals
// 	policy := c.NewPolicy(workspaceID)
// 	policy.Name = "require-three-approvals"
// 	policy.Selectors = []oapi.PolicyTargetSelector{
// 		{
// 			Id: "selector-1",
// 		},
// 	}
// 	policy.Rules = []oapi.PolicyRule{
// 		{
// 			Id: "rule-1",
// 			AnyApproval: &oapi.AnyApprovalRule{
// 				MinApprovals: 3,
// 			},
// 		},
// 	}
// 	engine.PushEvent(ctx, handler.PolicyCreate, policy)

// 	// Create 4 resources
// 	for i := 1; i <= 4; i++ {
// 		r := c.NewResource(workspaceID)
// 		r.Name = "resource-" + string(rune('0'+i))
// 		engine.PushEvent(ctx, handler.ResourceCreate, r)
// 	}

// 	// Create deployment version v1.0
// 	dv1 := c.NewDeploymentVersion()
// 	dv1.DeploymentId = d1.Id
// 	dv1.Tag = "v1.0.0"
// 	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv1)

// 	// User1 approves
// 	user1ID := c.NewUserID()
// 	approval1 := c.NewUserApprovalRecord(dv1.Id, e1.Id, user1ID)
// 	engine.PushEvent(ctx, handler.UserApprovalRecordCreate, approval1)

// 	// User2 approves
// 	user2ID := c.NewUserID()
// 	approval2 := c.NewUserApprovalRecord(dv1.Id, e1.Id, user2ID)
// 	engine.PushEvent(ctx, handler.UserApprovalRecordCreate, approval2)

// 	// User3 approves (meets threshold)
// 	user3ID := c.NewUserID()
// 	approval3 := c.NewUserApprovalRecord(dv1.Id, e1.Id, user3ID)
// 	engine.PushEvent(ctx, handler.UserApprovalRecordCreate, approval3)

// 	// EXPECTED: 4 jobs created (threshold met)
// 	pendingJobs := engine.Workspace().Jobs().GetPending()
// 	if len(pendingJobs) != 4 {
// 		t.Fatalf("expected 4 pending jobs after meeting threshold, got %d", len(pendingJobs))
// 	}

// 	// EXPECTED: 4 releases exist (1 per job)
// 	releaseCount := 0
// 	for _, job := range pendingJobs {
// 		if release, ok := engine.Workspace().Releases().Get(job.ReleaseId); ok {
// 			releaseCount++
// 			// EXPECTED: All releases point to v1.0
// 			if release.Version.Id != dv1.Id {
// 				t.Fatalf("expected release version %s, got %s", dv1.Id, release.Version.Id)
// 			}
// 		}
// 	}
// 	if releaseCount != 4 {
// 		t.Fatalf("expected 4 releases after meeting threshold, got %d", releaseCount)
// 	}
// }
