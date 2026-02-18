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

func TestEngine_ApprovalRecords_GetApprovers(t *testing.T) {
	jobAgentID := uuid.New().String()
	deploymentID := uuid.New().String()
	environmentID := uuid.New().String()
	resourceID := uuid.New().String()

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

	// Add approvals
	engine.PushEvent(ctx, handler.UserApprovalRecordCreate, &oapi.UserApprovalRecord{
		VersionId:     version.Id,
		EnvironmentId: environmentID,
		UserId:        "user-alice",
		Status:        oapi.ApprovalStatusApproved,
	})
	engine.PushEvent(ctx, handler.UserApprovalRecordCreate, &oapi.UserApprovalRecord{
		VersionId:     version.Id,
		EnvironmentId: environmentID,
		UserId:        "user-bob",
		Status:        oapi.ApprovalStatusApproved,
	})

	// Verify GetApprovers()
	approvers := engine.Workspace().UserApprovalRecords().GetApprovers(version.Id, environmentID)
	assert.Len(t, approvers, 2)
	assert.Contains(t, approvers, "user-alice")
	assert.Contains(t, approvers, "user-bob")
}

func TestEngine_ApprovalRecords_GetApproversMultipleEnvironments(t *testing.T) {
	deploymentID := uuid.New().String()
	env1ID := uuid.New().String()
	env2ID := uuid.New().String()
	jobAgentID := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
		integration.WithJobAgent(integration.JobAgentID(jobAgentID)),
		integration.WithSystem(
			integration.WithDeployment(
				integration.DeploymentID(deploymentID),
				integration.DeploymentJobAgent(jobAgentID),
				integration.DeploymentCelResourceSelector("true"),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(env1ID),
				integration.EnvironmentName("staging"),
				integration.EnvironmentCelResourceSelector("true"),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(env2ID),
				integration.EnvironmentName("prod"),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(),
		integration.WithPolicy(
			integration.WithPolicySelector("true"),
			integration.WithPolicyRule(integration.WithRuleAnyApproval(1)),
		),
	)
	ctx := context.Background()

	version := c.NewDeploymentVersion()
	version.DeploymentId = deploymentID
	version.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, version)

	// Approve for staging
	engine.PushEvent(ctx, handler.UserApprovalRecordCreate, &oapi.UserApprovalRecord{
		VersionId:     version.Id,
		EnvironmentId: env1ID,
		UserId:        "user-charlie",
		Status:        oapi.ApprovalStatusApproved,
	})

	// Approve for prod by a different user
	engine.PushEvent(ctx, handler.UserApprovalRecordCreate, &oapi.UserApprovalRecord{
		VersionId:     version.Id,
		EnvironmentId: env2ID,
		UserId:        "user-delta",
		Status:        oapi.ApprovalStatusApproved,
	})

	// Verify environment-scoped GetApprovers
	stagingApprovers := engine.Workspace().UserApprovalRecords().GetApprovers(version.Id, env1ID)
	assert.Len(t, stagingApprovers, 1)
	assert.Contains(t, stagingApprovers, "user-charlie")

	prodApprovers := engine.Workspace().UserApprovalRecords().GetApprovers(version.Id, env2ID)
	assert.Len(t, prodApprovers, 1)
	assert.Contains(t, prodApprovers, "user-delta")
}

func TestEngine_ApprovalRecords_UpdateStatus(t *testing.T) {
	deploymentID := uuid.New().String()
	environmentID := uuid.New().String()
	jobAgentID := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
		integration.WithJobAgent(integration.JobAgentID(jobAgentID)),
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
		integration.WithResource(),
		integration.WithPolicy(
			integration.WithPolicySelector("true"),
			integration.WithPolicyRule(integration.WithRuleAnyApproval(2)),
		),
	)
	ctx := context.Background()

	version := c.NewDeploymentVersion()
	version.DeploymentId = deploymentID
	version.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, version)

	engine.PushEvent(ctx, handler.UserApprovalRecordCreate, &oapi.UserApprovalRecord{
		VersionId:     version.Id,
		EnvironmentId: environmentID,
		UserId:        "user-dave",
		Status:        oapi.ApprovalStatusApproved,
	})

	// user-dave should be an approver
	approvers := engine.Workspace().UserApprovalRecords().GetApprovers(version.Id, environmentID)
	assert.Contains(t, approvers, "user-dave")

	// Update to rejected — should no longer be an approver
	engine.PushEvent(ctx, handler.UserApprovalRecordUpdate, &oapi.UserApprovalRecord{
		VersionId:     version.Id,
		EnvironmentId: environmentID,
		UserId:        "user-dave",
		Status:        oapi.ApprovalStatusRejected,
	})

	approvers = engine.Workspace().UserApprovalRecords().GetApprovers(version.Id, environmentID)
	assert.NotContains(t, approvers, "user-dave")
}

func TestEngine_ApprovalRecords_Delete(t *testing.T) {
	deploymentID := uuid.New().String()
	environmentID := uuid.New().String()
	jobAgentID := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
		integration.WithJobAgent(integration.JobAgentID(jobAgentID)),
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
		integration.WithResource(),
		integration.WithPolicy(
			integration.WithPolicySelector("true"),
			integration.WithPolicyRule(integration.WithRuleAnyApproval(2)),
		),
	)
	ctx := context.Background()

	version := c.NewDeploymentVersion()
	version.DeploymentId = deploymentID
	version.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, version)

	engine.PushEvent(ctx, handler.UserApprovalRecordCreate, &oapi.UserApprovalRecord{
		VersionId:     version.Id,
		EnvironmentId: environmentID,
		UserId:        "user-eve",
		Status:        oapi.ApprovalStatusApproved,
	})

	approvers := engine.Workspace().UserApprovalRecords().GetApprovers(version.Id, environmentID)
	assert.Contains(t, approvers, "user-eve")

	engine.PushEvent(ctx, handler.UserApprovalRecordDelete, &oapi.UserApprovalRecord{
		VersionId:     version.Id,
		EnvironmentId: environmentID,
		UserId:        "user-eve",
		Status:        oapi.ApprovalStatusApproved,
	})

	approvers = engine.Workspace().UserApprovalRecords().GetApprovers(version.Id, environmentID)
	assert.NotContains(t, approvers, "user-eve")
}

func TestEngine_ApprovalRecords_GetApprovalRecords(t *testing.T) {
	deploymentID := uuid.New().String()
	environmentID := uuid.New().String()
	jobAgentID := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
		integration.WithJobAgent(integration.JobAgentID(jobAgentID)),
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
		integration.WithResource(),
		integration.WithPolicy(
			integration.WithPolicySelector("true"),
			integration.WithPolicyRule(integration.WithRuleAnyApproval(2)),
		),
	)
	ctx := context.Background()

	version := c.NewDeploymentVersion()
	version.DeploymentId = deploymentID
	version.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, version)

	engine.PushEvent(ctx, handler.UserApprovalRecordCreate, &oapi.UserApprovalRecord{
		VersionId:     version.Id,
		EnvironmentId: environmentID,
		UserId:        "user-a",
		Status:        oapi.ApprovalStatusApproved,
	})
	engine.PushEvent(ctx, handler.UserApprovalRecordCreate, &oapi.UserApprovalRecord{
		VersionId:     version.Id,
		EnvironmentId: environmentID,
		UserId:        "user-b",
		Status:        oapi.ApprovalStatusApproved,
	})

	records := engine.Workspace().UserApprovalRecords().GetApprovalRecords(version.Id, environmentID)
	assert.Len(t, records, 2)
}
