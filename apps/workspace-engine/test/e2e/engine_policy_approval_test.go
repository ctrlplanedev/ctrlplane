package e2e

import (
	"context"
	"fmt"
	"testing"
	"time"
	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/oapi"
	"workspace-engine/test/integration"
	c "workspace-engine/test/integration/creators"
)

// TestEngine_ApprovalPolicy_BasicFlow tests that a deployment version requires
// the minimum number of approvals before a release is created
func TestEngine_ApprovalPolicy_BasicFlow(t *testing.T) {
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
		integration.WithPolicy(
			integration.PolicyID(policyID),
			integration.PolicyName("production-approval"),
			integration.WithPolicyTargetSelector(
				integration.PolicyTargetCelEnvironmentSelector("true"),
				integration.PolicyTargetCelDeploymentSelector("true"),
				integration.PolicyTargetCelResourceSelector("true"),
			),
		),
	)

	ctx := context.Background()

	// Add approval rule requiring 2 approvals
	policy, _ := engine.Workspace().Policies().Get(policyID)
	policy.Rules = []oapi.PolicyRule{
		{
			Id:          "rule-1",
			PolicyId:    policyID,
			CreatedAt:   "2024-01-01T00:00:00Z",
			AnyApproval: &oapi.AnyApprovalRule{MinApprovals: 2},
		},
	}
	engine.PushEvent(ctx, handler.PolicyUpdate, policy)

	// Create a deployment version
	version := c.NewDeploymentVersion()
	version.DeploymentId = deploymentID
	version.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, version)

	// Verify NO release is created yet (needs approvals)
	allJobs := engine.Workspace().Jobs().Items()
	if len(allJobs) > 0 {
		t.Fatalf("expected 0 jobs before approvals, got %d", len(allJobs))
	}

	// Add first approval
	approval1 := &oapi.UserApprovalRecord{
		VersionId:     version.Id,
		EnvironmentId: environmentID,
		UserId:        "user-1",
		Status:        oapi.ApprovalStatusApproved,
	}
	engine.PushEvent(ctx, handler.UserApprovalRecordCreate, approval1)

	// Still no release (need 2 approvals)
	allJobs = engine.Workspace().Jobs().Items()
	if len(allJobs) > 0 {
		t.Fatalf("expected 0 jobs with 1 approval (need 2), got %d", len(allJobs))
	}

	// Add second approval
	approval2 := &oapi.UserApprovalRecord{
		VersionId:     version.Id,
		EnvironmentId: environmentID,
		UserId:        "user-2",
		Status:        oapi.ApprovalStatusApproved,
	}
	engine.PushEvent(ctx, handler.UserApprovalRecordCreate, approval2)

	// NOW release should be created
	allJobs = engine.Workspace().Jobs().Items()
	if len(allJobs) != 1 {
		t.Fatalf("expected 1 job after 2 approvals, got %d", len(allJobs))
	}

	// Verify the job is for the correct version
	var job *oapi.Job
	for _, j := range allJobs {
		job = j
		break
	}
	release, ok := engine.Workspace().Releases().Get(job.ReleaseId)
	if !ok {
		t.Fatalf("release %s not found", job.ReleaseId)
	}
	if release.Version.Tag != "v1.0.0" {
		t.Fatalf("expected version v1.0.0, got %s", release.Version.Tag)
	}
	if job.Status != oapi.JobStatusPending {
		t.Fatalf("expected job status Pending, got %s", job.Status)
	}
}

// TestEngine_ApprovalPolicy_UnapprovalFlow tests that removing an approval
// prevents deployment of new versions
func TestEngine_ApprovalPolicy_UnapprovalFlow(t *testing.T) {
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
				integration.DeploymentName("api-service"),
				integration.DeploymentJobAgent(jobAgentID),
				integration.DeploymentCelResourceSelector("true"),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentID),
				integration.EnvironmentName("production"),
				integration.EnvironmentJsonResourceSelector(map[string]any{
					"type":     "name",
					"operator": "starts-with",
					"value":    "",
				}),
			),
		),
		integration.WithResource(
			integration.ResourceID(resourceID),
		),
		integration.WithPolicy(
			integration.PolicyID(policyID),
			integration.PolicyName("production-approval"),
			integration.WithPolicyTargetSelector(
				integration.PolicyTargetCelEnvironmentSelector("true"),
				integration.PolicyTargetCelDeploymentSelector("true"),
				integration.PolicyTargetCelResourceSelector("true"),
			),
		),
	)

	ctx := context.Background()

	// Add approval rule requiring 2 approvals
	policy, _ := engine.Workspace().Policies().Get(policyID)
	policy.Rules = []oapi.PolicyRule{
		{
			Id:          "rule-1",
			PolicyId:    policyID,
			CreatedAt:   "2024-01-01T00:00:00Z",
			AnyApproval: &oapi.AnyApprovalRule{MinApprovals: 2},
		},
	}
	engine.PushEvent(ctx, handler.PolicyUpdate, policy)

	// Create first version
	version1 := c.NewDeploymentVersion()
	version1.DeploymentId = deploymentID
	version1.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, version1)

	// Add 2 approvals for v1.0.0
	approval1 := &oapi.UserApprovalRecord{
		VersionId:     version1.Id,
		EnvironmentId: environmentID,
		UserId:        "user-1",
		Status:        oapi.ApprovalStatusApproved,
	}
	engine.PushEvent(ctx, handler.UserApprovalRecordCreate, approval1)

	approval2 := &oapi.UserApprovalRecord{
		VersionId:     version1.Id,
		EnvironmentId: environmentID,
		UserId:        "user-2",
		Status:        oapi.ApprovalStatusApproved,
	}
	engine.PushEvent(ctx, handler.UserApprovalRecordCreate, approval2)

	// v1.0.0 should be deployed
	allJobs := engine.Workspace().Jobs().Items()
	if len(allJobs) != 1 {
		t.Fatalf("expected 1 job for v1.0.0, got %d", len(allJobs))
	}

	for _, job := range allJobs {
		job.Status = oapi.JobStatusSuccessful
		completedAt := time.Now()
		job.CompletedAt = &completedAt

		jobUpdateEvent := &oapi.JobUpdateEvent{
			Id:  &job.Id,
			Job: *job,
		}

		engine.PushEvent(ctx, handler.JobUpdate, jobUpdateEvent)
	}

	// Create second version
	version2 := c.NewDeploymentVersion()
	version2.DeploymentId = deploymentID
	version2.Tag = "v2.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, version2)

	// Add 2 approvals for v2.0.0
	approval3 := &oapi.UserApprovalRecord{
		VersionId:     version2.Id,
		EnvironmentId: environmentID,
		UserId:        "user-1",
		Status:        oapi.ApprovalStatusApproved,
	}
	engine.PushEvent(ctx, handler.UserApprovalRecordCreate, approval3)

	approval4 := &oapi.UserApprovalRecord{
		VersionId:     version2.Id,
		EnvironmentId: environmentID,
		UserId:        "user-2",
		Status:        oapi.ApprovalStatusApproved,
	}
	engine.PushEvent(ctx, handler.UserApprovalRecordCreate, approval4)

	// v2.0.0 should be deployed (cancels v1.0.0 pending job)
	allJobs = engine.Workspace().Jobs().Items()
	v2Jobs := 0
	for _, job := range allJobs {
		release, ok := engine.Workspace().Releases().Get(job.ReleaseId)
		if !ok {
			continue
		}
		if release.Version.Tag == "v2.0.0" {
			v2Jobs++
		}
	}
	if v2Jobs != 1 {
		t.Fatalf("expected 1 job for v2.0.0, got %d", v2Jobs)
	}

	// Remove one approval from v2.0.0 (unapprove)
	approval4.Status = oapi.ApprovalStatusRejected
	engine.PushEvent(ctx, handler.UserApprovalRecordUpdate, approval4)

	// Create third version
	version3 := c.NewDeploymentVersion()
	version3.DeploymentId = deploymentID
	version3.Tag = "v3.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, version3)

	// Add only 1 approval for v3.0.0
	approval5 := &oapi.UserApprovalRecord{
		VersionId:     version3.Id,
		EnvironmentId: environmentID,
		UserId:        "user-1",
		Status:        oapi.ApprovalStatusApproved,
	}
	engine.PushEvent(ctx, handler.UserApprovalRecordCreate, approval5)

	// v3.0.0 should NOT be deployed (only 1 approval, need 2)
	allJobs = engine.Workspace().Jobs().Items()
	v3Jobs := 0
	for _, job := range allJobs {
		release, ok := engine.Workspace().Releases().Get(job.ReleaseId)
		if !ok {
			continue
		}
		if release.Version.Tag == "v3.0.0" {
			v3Jobs++
		}
	}
	if v3Jobs != 0 {
		t.Fatalf("expected 0 jobs for v3.0.0 (insufficient approvals), got %d", v3Jobs)
	}
}

// TestEngine_ApprovalPolicy_MultipleVersions tests that different versions
// can have different approval states and only approved ones deploy
func TestEngine_ApprovalPolicy_MultipleVersions(t *testing.T) {
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
				integration.DeploymentName("api-service"),
				integration.DeploymentJobAgent(jobAgentID),
				integration.DeploymentCelResourceSelector("true"),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentID),
				integration.EnvironmentName("production"),
				integration.EnvironmentJsonResourceSelector(map[string]any{
					"type":     "name",
					"operator": "starts-with",
					"value":    "",
				}),
			),
		),
		integration.WithResource(
			integration.ResourceID(resourceID),
		),
		integration.WithPolicy(
			integration.PolicyID(policyID),
			integration.PolicyName("production-approval"),
			integration.WithPolicyTargetSelector(
				integration.PolicyTargetCelEnvironmentSelector("true"),
				integration.PolicyTargetCelDeploymentSelector("true"),
				integration.PolicyTargetCelResourceSelector("true"),
			),
		),
	)

	ctx := context.Background()

	// Add approval rule requiring 2 approvals
	policy, _ := engine.Workspace().Policies().Get(policyID)
	policy.Rules = []oapi.PolicyRule{
		{
			Id:          "rule-1",
			PolicyId:    policyID,
			CreatedAt:   "2024-01-01T00:00:00Z",
			AnyApproval: &oapi.AnyApprovalRule{MinApprovals: 2},
		},
	}
	engine.PushEvent(ctx, handler.PolicyUpdate, policy)

	// Create version 1.0.0 (will have 0 approvals)
	version1 := c.NewDeploymentVersion()
	version1.DeploymentId = deploymentID
	version1.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, version1)

	// Create version 2.0.0 (will have 1 approval - not enough)
	version2 := c.NewDeploymentVersion()
	version2.DeploymentId = deploymentID
	version2.Tag = "v2.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, version2)

	approval1 := &oapi.UserApprovalRecord{
		VersionId:     version2.Id,
		EnvironmentId: environmentID,
		UserId:        "user-1",
		Status:        oapi.ApprovalStatusApproved,
	}
	engine.PushEvent(ctx, handler.UserApprovalRecordCreate, approval1)

	// Create version 3.0.0 (will have 2 approvals - enough)
	version3 := c.NewDeploymentVersion()
	version3.DeploymentId = deploymentID
	version3.Tag = "v3.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, version3)

	approval2 := &oapi.UserApprovalRecord{
		VersionId:     version3.Id,
		EnvironmentId: environmentID,
		UserId:        "user-1",
		Status:        oapi.ApprovalStatusApproved,
	}
	engine.PushEvent(ctx, handler.UserApprovalRecordCreate, approval2)

	approval3 := &oapi.UserApprovalRecord{
		VersionId:     version3.Id,
		EnvironmentId: environmentID,
		UserId:        "user-2",
		Status:        oapi.ApprovalStatusApproved,
	}
	engine.PushEvent(ctx, handler.UserApprovalRecordCreate, approval3)

	for _, job := range engine.Workspace().Jobs().Items() {
		if job.Status == oapi.JobStatusPending {
			job.Status = oapi.JobStatusSuccessful
			completedAt := time.Now()
			job.CompletedAt = &completedAt

			jobUpdateEvent := &oapi.JobUpdateEvent{
				Id:  &job.Id,
				Job: *job,
				FieldsToUpdate: &[]oapi.JobUpdateEventFieldsToUpdate{
					oapi.JobUpdateEventFieldsToUpdate("status"),
					oapi.JobUpdateEventFieldsToUpdate("completedAt"),
				},
			}

			engine.PushEvent(ctx, handler.JobUpdate, jobUpdateEvent)
		}
	}

	// Create version 4.0.0 (will have 3 approvals - more than enough)
	version4 := c.NewDeploymentVersion()
	version4.DeploymentId = deploymentID
	version4.Tag = "v4.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, version4)

	approval4 := &oapi.UserApprovalRecord{
		VersionId:     version4.Id,
		EnvironmentId: environmentID,
		UserId:        "user-1",
		Status:        oapi.ApprovalStatusApproved,
	}
	engine.PushEvent(ctx, handler.UserApprovalRecordCreate, approval4)

	approval5 := &oapi.UserApprovalRecord{
		VersionId:     version4.Id,
		EnvironmentId: environmentID,
		UserId:        "user-2",
		Status:        oapi.ApprovalStatusApproved,
	}
	engine.PushEvent(ctx, handler.UserApprovalRecordCreate, approval5)

	approval6 := &oapi.UserApprovalRecord{
		VersionId:     version4.Id,
		EnvironmentId: environmentID,
		UserId:        "user-3",
		Status:        oapi.ApprovalStatusApproved,
	}
	engine.PushEvent(ctx, handler.UserApprovalRecordCreate, approval6)

	// Check which versions got deployed (only count non-cancelled jobs)
	allJobs := engine.Workspace().Jobs().Items()
	versionActiveJobCounts := make(map[string]int)

	for _, job := range allJobs {
		// Only count non-cancelled jobs
		if job.Status == oapi.JobStatusCancelled {
			continue
		}
		release, ok := engine.Workspace().Releases().Get(job.ReleaseId)
		if !ok {
			continue
		}
		versionActiveJobCounts[release.Version.Tag]++
	}

	// v1.0.0: 0 approvals - should NOT deploy
	if versionActiveJobCounts["v1.0.0"] != 0 {
		t.Errorf("expected 0 active jobs for v1.0.0 (0 approvals), got %d", versionActiveJobCounts["v1.0.0"])
	}

	// v2.0.0: 1 approval - should NOT deploy
	if versionActiveJobCounts["v2.0.0"] != 0 {
		t.Errorf("expected 0 active jobs for v2.0.0 (1 approval), got %d", versionActiveJobCounts["v2.0.0"])
	}

	// v4.0.0: 3 approvals - should deploy (newest with enough approvals)
	if versionActiveJobCounts["v4.0.0"] != 1 {
		t.Errorf("expected 1 active job for v4.0.0 (3 approvals, newest), got %d", versionActiveJobCounts["v4.0.0"])
	}
}

// TestEngine_ApprovalPolicy_ExactMinimum tests that exactly meeting the minimum
// approval count allows deployment
func TestEngine_ApprovalPolicy_ExactMinimum(t *testing.T) {
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
				integration.DeploymentName("api-service"),
				integration.DeploymentJobAgent(jobAgentID),
				integration.DeploymentCelResourceSelector("true"),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentID),
				integration.EnvironmentName("production"),
				integration.EnvironmentJsonResourceSelector(map[string]any{
					"type":     "name",
					"operator": "starts-with",
					"value":    "",
				}),
			),
		),
		integration.WithResource(
			integration.ResourceID(resourceID),
		),
		integration.WithPolicy(
			integration.PolicyID(policyID),
			integration.PolicyName("production-approval"),
			integration.WithPolicyTargetSelector(
				integration.PolicyTargetCelEnvironmentSelector("true"),
				integration.PolicyTargetCelDeploymentSelector("true"),
				integration.PolicyTargetCelResourceSelector("true"),
			),
		),
	)

	ctx := context.Background()

	// Add approval rule requiring 3 approvals
	policy, _ := engine.Workspace().Policies().Get(policyID)
	policy.Rules = []oapi.PolicyRule{
		{
			Id:          "rule-1",
			PolicyId:    policyID,
			CreatedAt:   "2024-01-01T00:00:00Z",
			AnyApproval: &oapi.AnyApprovalRule{MinApprovals: 3},
		},
	}
	engine.PushEvent(ctx, handler.PolicyUpdate, policy)

	// Create a deployment version
	version := c.NewDeploymentVersion()
	version.DeploymentId = deploymentID
	version.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, version)

	// Add exactly 3 approvals (the minimum)
	for i := 1; i <= 3; i++ {
		approval := &oapi.UserApprovalRecord{
			VersionId:     version.Id,
			EnvironmentId: environmentID,
			UserId:        fmt.Sprintf("user-%d", i),
			Status:        oapi.ApprovalStatusApproved,
		}
		engine.PushEvent(ctx, handler.UserApprovalRecordCreate, approval)
	}

	// Should be deployed with exactly 3 approvals
	allJobs := engine.Workspace().Jobs().Items()
	if len(allJobs) != 1 {
		t.Fatalf("expected 1 job with exactly 3 approvals, got %d", len(allJobs))
	}

	var job *oapi.Job
	for _, j := range allJobs {
		job = j
		break
	}
	release, ok := engine.Workspace().Releases().Get(job.ReleaseId)
	if !ok {
		t.Fatalf("release %s not found", job.ReleaseId)
	}
	if release.Version.Tag != "v1.0.0" {
		t.Fatalf("expected version v1.0.0, got %s", release.Version.Tag)
	}
}

// TestEngine_ApprovalPolicy_ZeroApprovalsRequired tests that setting minimum
// approvals to 0 effectively disables the approval requirement
func TestEngine_ApprovalPolicy_ZeroApprovalsRequired(t *testing.T) {
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
				integration.DeploymentName("api-service"),
				integration.DeploymentJobAgent(jobAgentID),
				integration.DeploymentCelResourceSelector("true"),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentID),
				integration.EnvironmentName("production"),
				integration.EnvironmentJsonResourceSelector(map[string]any{
					"type":     "name",
					"operator": "starts-with",
					"value":    "",
				}),
			),
		),
		integration.WithResource(
			integration.ResourceID(resourceID),
		),
		integration.WithPolicy(
			integration.PolicyID(policyID),
			integration.PolicyName("production-approval"),
			integration.WithPolicyTargetSelector(
				integration.PolicyTargetCelEnvironmentSelector("true"),
				integration.PolicyTargetCelDeploymentSelector("true"),
				integration.PolicyTargetCelResourceSelector("true"),
			),
		),
	)

	ctx := context.Background()

	// Add approval rule requiring 0 approvals (effectively disabled)
	policy, _ := engine.Workspace().Policies().Get(policyID)
	policy.Rules = []oapi.PolicyRule{
		{
			Id:          "rule-1",
			PolicyId:    policyID,
			CreatedAt:   "2024-01-01T00:00:00Z",
			AnyApproval: &oapi.AnyApprovalRule{MinApprovals: 0},
		},
	}
	engine.PushEvent(ctx, handler.PolicyUpdate, policy)

	// Create a deployment version
	version := c.NewDeploymentVersion()
	version.DeploymentId = deploymentID
	version.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, version)

	// Should be deployed immediately without any approvals
	allJobs := engine.Workspace().Jobs().Items()
	if len(allJobs) != 1 {
		t.Fatalf("expected 1 job with 0 approvals required, got %d", len(allJobs))
	}

	var job *oapi.Job
	for _, j := range allJobs {
		job = j
		break
	}
	release, ok := engine.Workspace().Releases().Get(job.ReleaseId)
	if !ok {
		t.Fatalf("release %s not found", job.ReleaseId)
	}
	if release.Version.Tag != "v1.0.0" {
		t.Fatalf("expected version v1.0.0, got %s", release.Version.Tag)
	}
}

// TestEngine_ApprovalPolicy_PartialApprovalBlocks tests that having some but
// not enough approvals still blocks deployment
func TestEngine_ApprovalPolicy_PartialApprovalBlocks(t *testing.T) {
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
				integration.DeploymentName("api-service"),
				integration.DeploymentJobAgent(jobAgentID),
				integration.DeploymentCelResourceSelector("true"),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentID),
				integration.EnvironmentName("production"),
				integration.EnvironmentJsonResourceSelector(map[string]any{
					"type":     "name",
					"operator": "starts-with",
					"value":    "",
				}),
			),
		),
		integration.WithResource(
			integration.ResourceID(resourceID),
		),
		integration.WithPolicy(
			integration.PolicyID(policyID),
			integration.PolicyName("production-approval"),
			integration.WithPolicyTargetSelector(
				integration.PolicyTargetCelEnvironmentSelector("true"),
				integration.PolicyTargetCelDeploymentSelector("true"),
				integration.PolicyTargetCelResourceSelector("true"),
			),
		),
	)

	ctx := context.Background()

	// Add approval rule requiring 5 approvals
	policy, _ := engine.Workspace().Policies().Get(policyID)
	policy.Rules = []oapi.PolicyRule{
		{
			Id:          "rule-1",
			PolicyId:    policyID,
			CreatedAt:   "2024-01-01T00:00:00Z",
			AnyApproval: &oapi.AnyApprovalRule{MinApprovals: 5},
		},
	}
	engine.PushEvent(ctx, handler.PolicyUpdate, policy)

	// Create a deployment version
	version := c.NewDeploymentVersion()
	version.DeploymentId = deploymentID
	version.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, version)

	// Add 4 approvals (1 short of requirement)
	for i := 1; i <= 4; i++ {
		approval := &oapi.UserApprovalRecord{
			VersionId:     version.Id,
			EnvironmentId: environmentID,
			UserId:        fmt.Sprintf("user-%d", i),
			Status:        oapi.ApprovalStatusApproved,
		}
		engine.PushEvent(ctx, handler.UserApprovalRecordCreate, approval)
	}

	// Should NOT be deployed (4 < 5)
	allJobs := engine.Workspace().Jobs().Items()
	if len(allJobs) != 0 {
		t.Fatalf("expected 0 jobs with 4 approvals (need 5), got %d", len(allJobs))
	}

	// Add 5th approval
	approval5 := &oapi.UserApprovalRecord{
		VersionId:     version.Id,
		EnvironmentId: environmentID,
		UserId:        "user-5",
		Status:        oapi.ApprovalStatusApproved,
	}
	engine.PushEvent(ctx, handler.UserApprovalRecordCreate, approval5)

	// NOW should be deployed
	allJobs = engine.Workspace().Jobs().Items()
	if len(allJobs) != 1 {
		t.Fatalf("expected 1 job after 5th approval, got %d", len(allJobs))
	}
}

// TestEngine_ApprovalPolicy_ApprovalDeletion tests that deleting an approval
// record prevents deployment if it drops below minimum
func TestEngine_ApprovalPolicy_ApprovalDeletion(t *testing.T) {
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
				integration.DeploymentName("api-service"),
				integration.DeploymentJobAgent(jobAgentID),
				integration.DeploymentCelResourceSelector("true"),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentID),
				integration.EnvironmentName("production"),
				integration.EnvironmentJsonResourceSelector(map[string]any{
					"type":     "name",
					"operator": "starts-with",
					"value":    "",
				}),
			),
		),
		integration.WithResource(
			integration.ResourceID(resourceID),
		),
		integration.WithPolicy(
			integration.PolicyID(policyID),
			integration.PolicyName("production-approval"),
			integration.WithPolicyTargetSelector(
				integration.PolicyTargetCelEnvironmentSelector("true"),
				integration.PolicyTargetCelDeploymentSelector("true"),
				integration.PolicyTargetCelResourceSelector("true"),
			),
		),
	)

	ctx := context.Background()

	// Add approval rule requiring 2 approvals
	policy, _ := engine.Workspace().Policies().Get(policyID)
	policy.Rules = []oapi.PolicyRule{
		{
			Id:          "rule-1",
			PolicyId:    policyID,
			CreatedAt:   "2024-01-01T00:00:00Z",
			AnyApproval: &oapi.AnyApprovalRule{MinApprovals: 2},
		},
	}
	engine.PushEvent(ctx, handler.PolicyUpdate, policy)

	// Create version 1.0.0 with 2 approvals
	version1 := c.NewDeploymentVersion()
	version1.DeploymentId = deploymentID
	version1.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, version1)

	approval1 := &oapi.UserApprovalRecord{
		VersionId:     version1.Id,
		EnvironmentId: environmentID,
		UserId:        "user-1",
		Status:        oapi.ApprovalStatusApproved,
	}
	engine.PushEvent(ctx, handler.UserApprovalRecordCreate, approval1)

	approval2 := &oapi.UserApprovalRecord{
		VersionId:     version1.Id,
		EnvironmentId: environmentID,
		UserId:        "user-2",
		Status:        oapi.ApprovalStatusApproved,
	}
	engine.PushEvent(ctx, handler.UserApprovalRecordCreate, approval2)

	// v1.0.0 should be deployed
	allJobs := engine.Workspace().Jobs().Items()
	if len(allJobs) != 1 {
		t.Fatalf("expected 1 job for v1.0.0, got %d", len(allJobs))
	}

	for _, job := range allJobs {
		job.Status = oapi.JobStatusSuccessful
		completedAt := time.Now()
		job.CompletedAt = &completedAt

		jobUpdateEvent := &oapi.JobUpdateEvent{
			Id:  &job.Id,
			Job: *job,
		}

		engine.PushEvent(ctx, handler.JobUpdate, jobUpdateEvent)
	}

	// Create version 2.0.0 with 2 approvals
	version2 := c.NewDeploymentVersion()
	version2.DeploymentId = deploymentID
	version2.Tag = "v2.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, version2)

	approval3 := &oapi.UserApprovalRecord{
		VersionId:     version2.Id,
		EnvironmentId: environmentID,
		UserId:        "user-1",
		Status:        oapi.ApprovalStatusApproved,
	}
	engine.PushEvent(ctx, handler.UserApprovalRecordCreate, approval3)

	approval4 := &oapi.UserApprovalRecord{
		VersionId:     version2.Id,
		EnvironmentId: environmentID,
		UserId:        "user-2",
		Status:        oapi.ApprovalStatusApproved,
	}
	engine.PushEvent(ctx, handler.UserApprovalRecordCreate, approval4)

	// v2.0.0 should be deployed
	allJobs = engine.Workspace().Jobs().Items()
	v2Jobs := 0
	for _, job := range allJobs {
		release, ok := engine.Workspace().Releases().Get(job.ReleaseId)
		if !ok {
			continue
		}
		if release.Version.Tag == "v2.0.0" {
			v2Jobs++
		}
	}
	if v2Jobs != 1 {
		t.Fatalf("expected 1 job for v2.0.0, got %d", v2Jobs)
	}

	// Delete one approval from v2.0.0
	engine.PushEvent(ctx, handler.UserApprovalRecordDelete, approval4)

	// Create version 3.0.0
	version3 := c.NewDeploymentVersion()
	version3.DeploymentId = deploymentID
	version3.Tag = "v3.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, version3)

	// v3.0.0 should NOT deploy (no approvals)
	// But v2.0.0 still has 1 approval, which is not enough
	// System should NOT create new jobs for v3.0.0 or try to redeploy v2.0.0
	allJobs = engine.Workspace().Jobs().Items()
	v3Jobs := 0
	for _, job := range allJobs {
		release, ok := engine.Workspace().Releases().Get(job.ReleaseId)
		if !ok {
			continue
		}
		if release.Version.Tag == "v3.0.0" {
			v3Jobs++
		}
	}
	if v3Jobs != 0 {
		t.Fatalf("expected 0 jobs for v3.0.0, got %d", v3Jobs)
	}
}
