package e2e

import (
	"context"
	"testing"
	"workspace-engine/pkg/events/handler"
	"workspace-engine/test/integration"
	c "workspace-engine/test/integration/creators"

	"github.com/google/uuid"
)

// TestEngine_PolicyPriority_HigherPriorityAnyApprovalIsAuthoritative tests that
// when two policies both have anyApproval rules targeting the same deployment,
// only the higher priority policy's rule should be authoritative.
//
// Scenario:
//   - Policy A (priority 1): anyApproval with minApprovals=0 (no approval needed)
//   - Policy B (priority 0): anyApproval with minApprovals=1 (needs 1 approval)
//   - Both target the same deployment via selector "true"
//
// Expected: The higher priority policy (priority 1, minApprovals=0) should win,
// so the deployment should proceed without any approvals.
//
// Current bug: Both policies are applied independently, so the lower priority
// policy's requirement of 1 approval blocks the deployment.
func TestEngine_PolicyPriority_HigherPriorityAnyApprovalIsAuthoritative(t *testing.T) {
	jobAgentID := uuid.New().String()
	deploymentID := uuid.New().String()
	environmentID := uuid.New().String()
	resourceID := uuid.New().String()
	highPriorityPolicyID := uuid.New().String()
	lowPriorityPolicyID := uuid.New().String()

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
		// High priority policy (priority=1): no approval needed
		integration.WithPolicy(
			integration.PolicyID(highPriorityPolicyID),
			integration.PolicyName("no-approval-override"),
			integration.PolicyPriority(1),
			integration.WithPolicySelector("true"),
			integration.WithPolicyRule(
				integration.WithRuleAnyApproval(0),
			),
		),
		// Low priority policy (priority=0): requires 1 approval
		integration.WithPolicy(
			integration.PolicyID(lowPriorityPolicyID),
			integration.PolicyName("requires-approval"),
			integration.PolicyPriority(0),
			integration.WithPolicySelector("true"),
			integration.WithPolicyRule(
				integration.WithRuleAnyApproval(1),
			),
		),
	)

	ctx := context.Background()

	// Create a deployment version
	version := c.NewDeploymentVersion()
	version.DeploymentId = deploymentID
	version.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, version)

	// The higher priority policy says minApprovals=0, so no approval should be
	// needed. The deployment should proceed immediately.
	allJobs := engine.Workspace().Jobs().Items()
	if len(allJobs) != 1 {
		t.Fatalf("expected 1 job (higher priority policy requires 0 approvals), got %d — "+
			"the lower priority policy's anyApproval rule should not block deployment", len(allJobs))
	}
}
