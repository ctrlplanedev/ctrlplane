package e2e

import (
	"context"
	"testing"
	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/oapi"
	"workspace-engine/test/integration"
	c "workspace-engine/test/integration/creators"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
)

// TestEngine_VersionSelectorPolicy_CEL_BasicMatching tests that a version selector
// policy using CEL expressions correctly filters deployment versions
func TestEngine_VersionSelectorPolicy_CEL_BasicMatching(t *testing.T) {
	jobAgentID := uuid.New().String()
	deploymentID := uuid.New().String()
	stagingEnvID := uuid.New().String()
	prodEnvID := uuid.New().String()
	resourceID := uuid.New().String()
	policyID := uuid.New().String()
	ruleID := uuid.New().String()

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
				integration.EnvironmentID(stagingEnvID),
				integration.EnvironmentName("staging"),
				integration.EnvironmentCelResourceSelector("true"),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(prodEnvID),
				integration.EnvironmentName("production"),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceID(resourceID),
		),
		integration.WithPolicy(
			integration.PolicyID(policyID),
			integration.PolicyName("version-selector-policy"),
			integration.WithPolicySelector("true"),
		),
	)

	ctx := context.Background()

	// Add version selector rule: only allow v2.x versions to production
	policy, _ := engine.Workspace().Policies().Get(policyID)
	selector := &oapi.Selector{}
	_ = selector.FromCelSelector(oapi.CelSelector{
		Cel: `version.tag.startsWith("v2.") && environment.name == "production" || environment.name == "staging"`,
	})
	description := "Only deploy v2.x versions to production, all versions to staging"

	policy.Rules = []oapi.PolicyRule{
		{
			Id:        ruleID,
			PolicyId:  policyID,
			CreatedAt: "2024-01-01T00:00:00Z",
			VersionSelector: &oapi.VersionSelectorRule{
				Selector:    *selector,
				Description: &description,
			},
		},
	}
	engine.PushEvent(ctx, handler.PolicyUpdate, policy)

	// Create v1.0.0 version - should be allowed only in staging
	version1 := c.NewDeploymentVersion()
	version1.DeploymentId = deploymentID
	version1.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, version1)

	// Check that only staging job is created for v1.0.0
	jobs := engine.Workspace().Jobs().GetPending()
	assert.Equal(t, 1, len(jobs), "Expected 1 job for v1.0.0 (staging only)")
	for _, job := range jobs {
		release, _ := engine.Workspace().Releases().Get(job.ReleaseId)
		assert.Equal(t, stagingEnvID, release.ReleaseTarget.EnvironmentId, "v1.0.0 should only deploy to staging")
	}

	// Create v2.1.0 version - should be allowed in both staging and production
	version2 := c.NewDeploymentVersion()
	version2.DeploymentId = deploymentID
	version2.Tag = "v2.1.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, version2)

	// Check that jobs are created for both environments for v2.1.0
	// We should see 3 total jobs: 1 for v1.0.0 staging + 2 for v2.1.0 (staging and production)
	jobs = engine.Workspace().Jobs().GetPending()
	v2Jobs := 0
	prodV2 := false
	for _, job := range jobs {
		release, _ := engine.Workspace().Releases().Get(job.ReleaseId)
		if release.Version.Tag == "v2.1.0" {
			v2Jobs++
			if release.ReleaseTarget.EnvironmentId == prodEnvID {
				prodV2 = true
			}
		}
	}
	assert.GreaterOrEqual(t, v2Jobs, 1, "Expected at least 1 job for v2.1.0")
	assert.True(t, prodV2, "v2.1.0 should deploy to production")
}

// TestEngine_VersionSelectorPolicy_BlockingVersion tests that a version selector
// policy correctly blocks versions that don't match the selector
func TestEngine_VersionSelectorPolicy_BlockingVersion(t *testing.T) {
	jobAgentID := uuid.New().String()
	deploymentID := uuid.New().String()
	environmentID := uuid.New().String()
	resourceID := uuid.New().String()
	policyID := uuid.New().String()
	ruleID := uuid.New().String()

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
			integration.PolicyName("version-selector-prod"),
			integration.WithPolicySelector("true"),
		),
	)

	ctx := context.Background()

	// Add version selector rule: only allow v2.x and v3.x versions
	policy, _ := engine.Workspace().Policies().Get(policyID)
	selector := &oapi.Selector{}
	_ = selector.FromCelSelector(oapi.CelSelector{
		Cel: `version.tag.startsWith("v2.") || version.tag.startsWith("v3.")`,
	})
	description := "Only deploy v2.x or v3.x versions"

	policy.Rules = []oapi.PolicyRule{
		{
			Id:        ruleID,
			PolicyId:  policyID,
			CreatedAt: "2024-01-01T00:00:00Z",
			VersionSelector: &oapi.VersionSelectorRule{
				Selector:    *selector,
				Description: &description,
			},
		},
	}
	engine.PushEvent(ctx, handler.PolicyUpdate, policy)

	// Create v1.0.0 version - should be blocked
	version1 := c.NewDeploymentVersion()
	version1.DeploymentId = deploymentID
	version1.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, version1)

	// Check that no jobs are created for v1.0.0
	jobs := engine.Workspace().Jobs().GetPending()
	assert.Equal(t, 0, len(jobs), "Expected no jobs for v1.0.0 (blocked by version selector)")

	// Create v2.0.0 version - should be allowed
	version2 := c.NewDeploymentVersion()
	version2.DeploymentId = deploymentID
	version2.Tag = "v2.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, version2)

	// Check that job is created for v2.0.0
	jobs = engine.Workspace().Jobs().GetPending()
	assert.Equal(t, 1, len(jobs), "Expected 1 job for v2.0.0")
}

// TestEngine_VersionSelectorPolicy_CombinedWithOtherPolicies tests that version selector
// policies work correctly when combined with other policy types
func TestEngine_VersionSelectorPolicy_CombinedWithOtherPolicies(t *testing.T) {
	jobAgentID := uuid.New().String()
	deploymentID := uuid.New().String()
	environmentID := uuid.New().String()
	resourceID := uuid.New().String()
	versionSelectorPolicyID := uuid.New().String()
	approvalPolicyID := uuid.New().String()
	ruleVersionID := uuid.New().String()
	ruleApprovalID := uuid.New().String()
	user1ID := uuid.New().String()

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
		// Version selector policy
		integration.WithPolicy(
			integration.PolicyID(versionSelectorPolicyID),
			integration.PolicyName("version-selector"),
			integration.WithPolicySelector("true"),
		),
		// Approval policy
		integration.WithPolicy(
			integration.PolicyID(approvalPolicyID),
			integration.PolicyName("approval-required"),
			integration.WithPolicySelector("true"),
		),
	)

	ctx := context.Background()

	// Configure version selector policy: only v2.x versions
	versionPolicy, _ := engine.Workspace().Policies().Get(versionSelectorPolicyID)
	versionSelector := &oapi.Selector{}
	_ = versionSelector.FromCelSelector(oapi.CelSelector{
		Cel: `version.tag.startsWith("v2.")`,
	})

	versionPolicy.Rules = []oapi.PolicyRule{
		{
			Id:        ruleVersionID,
			PolicyId:  versionSelectorPolicyID,
			CreatedAt: "2024-01-01T00:00:00Z",
			VersionSelector: &oapi.VersionSelectorRule{
				Selector: *versionSelector,
			},
		},
	}
	engine.PushEvent(ctx, handler.PolicyUpdate, versionPolicy)

	// Configure approval policy: require 1 approval
	approvalPolicy, _ := engine.Workspace().Policies().Get(approvalPolicyID)
	approvalPolicy.Rules = []oapi.PolicyRule{
		{
			Id:          ruleApprovalID,
			PolicyId:    approvalPolicyID,
			CreatedAt:   "2024-01-01T00:00:00Z",
			AnyApproval: &oapi.AnyApprovalRule{MinApprovals: 1},
		},
	}
	engine.PushEvent(ctx, handler.PolicyUpdate, approvalPolicy)

	// Create v1.0.0 version - should be blocked by version selector
	version1 := c.NewDeploymentVersion()
	version1.DeploymentId = deploymentID
	version1.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, version1)

	// Check that no jobs are created (blocked by version selector)
	jobs := engine.Workspace().Jobs().GetPending()
	assert.Equal(t, 0, len(jobs), "Expected no jobs for v1.0.0 (blocked by version selector)")

	// Create v2.0.0 version - should pass version selector but wait for approval
	version2 := c.NewDeploymentVersion()
	version2.DeploymentId = deploymentID
	version2.Tag = "v2.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, version2)

	// Check that no jobs are created yet (waiting for approval)
	jobs = engine.Workspace().Jobs().GetPending()
	assert.Equal(t, 0, len(jobs), "Expected no jobs for v2.0.0 (waiting for approval)")

	// Add approval
	approval := &oapi.UserApprovalRecord{
		VersionId:     version2.Id,
		EnvironmentId: environmentID,
		UserId:        user1ID,
		Status:        oapi.ApprovalStatusApproved,
	}
	engine.PushEvent(ctx, handler.UserApprovalRecordCreate, approval)

	// Now job should be created for v2.0.0 (passed version selector and has approval)
	jobs = engine.Workspace().Jobs().GetPending()
	assert.GreaterOrEqual(t, len(jobs), 1, "Expected at least 1 job after approval")

	// Verify at least one job is for v2.0.0
	hasV2Job := false
	for _, job := range jobs {
		release, _ := engine.Workspace().Releases().Get(job.ReleaseId)
		if release.Version.Tag == "v2.0.0" {
			hasV2Job = true
			break
		}
	}
	assert.True(t, hasV2Job, "Expected at least one job for v2.0.0 after approval")
}
