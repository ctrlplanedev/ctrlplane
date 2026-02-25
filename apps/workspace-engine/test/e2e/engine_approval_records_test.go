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

	user1ID := uuid.New().String()
	user2ID := uuid.New().String()

	// Add approvals
	engine.PushEvent(ctx, handler.UserApprovalRecordCreate, &oapi.UserApprovalRecord{
		VersionId:     version.Id,
		EnvironmentId: environmentID,
		UserId:        user1ID,
		Status:        oapi.ApprovalStatusApproved,
	})
	engine.PushEvent(ctx, handler.UserApprovalRecordCreate, &oapi.UserApprovalRecord{
		VersionId:     version.Id,
		EnvironmentId: environmentID,
		UserId:        user2ID,
		Status:        oapi.ApprovalStatusApproved,
	})

	// Verify GetApprovers()
	approvers := engine.Workspace().UserApprovalRecords().GetApprovers(version.Id, environmentID)
	assert.Len(t, approvers, 2)
	assert.Contains(t, approvers, user1ID)
	assert.Contains(t, approvers, user2ID)
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

	user1ID := uuid.New().String()
	user2ID := uuid.New().String()

	// Approve for staging
	engine.PushEvent(ctx, handler.UserApprovalRecordCreate, &oapi.UserApprovalRecord{
		VersionId:     version.Id,
		EnvironmentId: env1ID,
		UserId:        user1ID,
		Status:        oapi.ApprovalStatusApproved,
	})

	// Approve for prod by a different user
	engine.PushEvent(ctx, handler.UserApprovalRecordCreate, &oapi.UserApprovalRecord{
		VersionId:     version.Id,
		EnvironmentId: env2ID,
		UserId:        user2ID,
		Status:        oapi.ApprovalStatusApproved,
	})

	// Verify environment-scoped GetApprovers
	stagingApprovers := engine.Workspace().UserApprovalRecords().GetApprovers(version.Id, env1ID)
	assert.Len(t, stagingApprovers, 1)
	assert.Contains(t, stagingApprovers, user1ID)

	prodApprovers := engine.Workspace().UserApprovalRecords().GetApprovers(version.Id, env2ID)
	assert.Len(t, prodApprovers, 1)
	assert.Contains(t, prodApprovers, user2ID)
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

	userID := uuid.New().String()

	engine.PushEvent(ctx, handler.UserApprovalRecordCreate, &oapi.UserApprovalRecord{
		VersionId:     version.Id,
		EnvironmentId: environmentID,
		UserId:        userID,
		Status:        oapi.ApprovalStatusApproved,
	})

	// user-dave should be an approver
	approvers := engine.Workspace().UserApprovalRecords().GetApprovers(version.Id, environmentID)
	assert.Contains(t, approvers, userID)

	// Update to rejected — should no longer be an approver
	engine.PushEvent(ctx, handler.UserApprovalRecordUpdate, &oapi.UserApprovalRecord{
		VersionId:     version.Id,
		EnvironmentId: environmentID,
		UserId:        userID,
		Status:        oapi.ApprovalStatusRejected,
	})

	approvers = engine.Workspace().UserApprovalRecords().GetApprovers(version.Id, environmentID)
	assert.NotContains(t, approvers, userID)
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

	userID := uuid.New().String()

	engine.PushEvent(ctx, handler.UserApprovalRecordCreate, &oapi.UserApprovalRecord{
		VersionId:     version.Id,
		EnvironmentId: environmentID,
		UserId:        userID,
		Status:        oapi.ApprovalStatusApproved,
	})

	approvers := engine.Workspace().UserApprovalRecords().GetApprovers(version.Id, environmentID)
	assert.Contains(t, approvers, userID)

	engine.PushEvent(ctx, handler.UserApprovalRecordDelete, &oapi.UserApprovalRecord{
		VersionId:     version.Id,
		EnvironmentId: environmentID,
		UserId:        userID,
		Status:        oapi.ApprovalStatusApproved,
	})

	approvers = engine.Workspace().UserApprovalRecords().GetApprovers(version.Id, environmentID)
	assert.NotContains(t, approvers, userID)
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

	user1ID := uuid.New().String()
	user2ID := uuid.New().String()

	engine.PushEvent(ctx, handler.UserApprovalRecordCreate, &oapi.UserApprovalRecord{
		VersionId:     version.Id,
		EnvironmentId: environmentID,
		UserId:        user1ID,
		Status:        oapi.ApprovalStatusApproved,
	})
	engine.PushEvent(ctx, handler.UserApprovalRecordCreate, &oapi.UserApprovalRecord{
		VersionId:     version.Id,
		EnvironmentId: environmentID,
		UserId:        user2ID,
		Status:        oapi.ApprovalStatusApproved,
	})

	records := engine.Workspace().UserApprovalRecords().GetApprovalRecords(version.Id, environmentID)
	assert.Len(t, records, 2)
}
