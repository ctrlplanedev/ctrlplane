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

func TestEngine_PolicyUpdateBlocksNewDeployments(t *testing.T) {
	jobAgentID := uuid.New().String()
	d1ID := uuid.New().String()
	d2ID := uuid.New().String()
	e1ID := uuid.New().String()
	r1ID := uuid.New().String()
	policyID := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID),
		),
		integration.WithSystem(
			integration.WithDeployment(
				integration.DeploymentID(d1ID),
				integration.DeploymentName("deployment-prod"),
				integration.DeploymentJobAgent(jobAgentID),
				integration.DeploymentCelResourceSelector("true"),
				integration.WithDeploymentVersion(
					integration.DeploymentVersionTag("v1.0.0"),
				),
			),
			integration.WithDeployment(
				integration.DeploymentID(d2ID),
				integration.DeploymentName("deployment-dev"),
				integration.DeploymentJobAgent(jobAgentID),
				integration.DeploymentCelResourceSelector("true"),
				integration.WithDeploymentVersion(
					integration.DeploymentVersionTag("v1.0.0"),
				),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(e1ID),
				integration.EnvironmentJsonResourceSelector(map[string]any{
					"type":     "name",
					"operator": "starts-with",
					"value":    "",
				}),
			),
		),
		integration.WithResource(
			integration.ResourceID(r1ID),
		),
		// Create initial policy with no rules (doesn't block anything)
		integration.WithPolicy(
			integration.PolicyID(policyID),
			integration.PolicyName("policy-initial"),
			integration.WithPolicySelector("true"),
		),
	)

	ctx := context.Background()

	// Verify 2 jobs were created (v1.0.0 for both deployments)
	pendingJobs := engine.Workspace().Jobs().GetPending()
	if len(pendingJobs) != 2 {
		t.Fatalf("expected 2 pending jobs initially, got %d", len(pendingJobs))
	}

	for _, job := range pendingJobs {
		job.Status = oapi.JobStatusSuccessful
		completedAt := time.Now()
		job.CompletedAt = &completedAt

		jobUpdateEvent := &oapi.JobUpdateEvent{
			Id:  &job.Id,
			Job: *job,
		}

		engine.PushEvent(ctx, handler.JobUpdate, jobUpdateEvent)
	}

	// Update the policy to add an approval rule and target prod deployments
	policy, _ := engine.Workspace().Policies().Get(policyID)

	// Add approval rule requiring 2 approvals
	rule := oapi.PolicyRule{
		Id:          "rule-1",
		PolicyId:    policyID,
		CreatedAt:   "2024-01-01T00:00:00Z",
		AnyApproval: &oapi.AnyApprovalRule{MinApprovals: 2},
	}
	policy.Rules = []oapi.PolicyRule{rule}

	// Update selector to match only prod deployment
	policy.Selector = `deployment.name.contains("prod")`

	// Update the policy
	engine.PushEvent(ctx, handler.PolicyUpdate, policy)

	// Now create new versions (v2.0.0) for both deployments
	dv1 := c.NewDeploymentVersion()
	dv1.DeploymentId = d1ID
	dv1.Tag = "v2.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv1)

	dv2 := c.NewDeploymentVersion()
	dv2.DeploymentId = d2ID
	dv2.Tag = "v2.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv2)

	// Check all jobs to see which versions have releases/jobs created
	allJobs := engine.Workspace().Jobs().Items()

	// Look for jobs by deployment and version
	prodV2ReleaseExists := false
	devV2ReleaseExists := false

	for _, job := range allJobs {
		release, ok := engine.Workspace().Releases().Get(job.ReleaseId)
		if !ok {
			continue
		}
		if release.ReleaseTarget.DeploymentId == d1ID && release.Version.Tag == "v2.0.0" {
			prodV2ReleaseExists = true
		}
		if release.ReleaseTarget.DeploymentId == d2ID && release.Version.Tag == "v2.0.0" {
			devV2ReleaseExists = true
		}
	}

	// Verify: prod v2.0.0 release should NOT be created (blocked by policy requiring approval)
	if prodV2ReleaseExists {
		t.Fatalf("expected NO release for prod v2.0.0 (blocked by policy), but found one")
	}

	// Verify: dev v2.0.0 release SHOULD be created (policy doesn't target dev)
	if !devV2ReleaseExists {
		t.Fatalf("expected release for dev v2.0.0 to be created")
	}
}
