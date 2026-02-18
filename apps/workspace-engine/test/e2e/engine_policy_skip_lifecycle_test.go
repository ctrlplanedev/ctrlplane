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
	"github.com/stretchr/testify/assert"
)

func TestEngine_PolicySkipLifecycle_GetForTarget(t *testing.T) {
	jobAgentID := uuid.New().String()
	deploymentID := uuid.New().String()
	environmentID := uuid.New().String()
	resourceID := uuid.New().String()
	policyID := uuid.New().String()
	skipID := uuid.New().String()

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
			integration.WithPolicySelector("true"),
			integration.WithPolicyRule(
				integration.PolicyRuleID("rule-1"),
				integration.WithRuleAnyApproval(2),
			),
		),
	)

	ctx := context.Background()

	// Create a deployment version
	version := c.NewDeploymentVersion()
	version.DeploymentId = deploymentID
	version.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, version)

	// Create a policy skip
	expiresAt := time.Now().Add(1 * time.Hour)
	skip := &oapi.PolicySkip{
		Id:            skipID,
		WorkspaceId:   engine.Workspace().ID,
		VersionId:     version.Id,
		EnvironmentId: &environmentID,
		ResourceId:    &resourceID,
		RuleId:        "rule-1",
		Reason:        "hotfix",
		CreatedBy:     "admin",
		CreatedAt:     time.Now(),
		ExpiresAt:     &expiresAt,
	}
	engine.PushEvent(ctx, handler.PolicySkipCreate, skip)

	// Verify Get()
	got, ok := engine.Workspace().Store().PolicySkips.Get(skipID)
	assert.True(t, ok)
	assert.Equal(t, "hotfix", got.Reason)
	assert.Equal(t, version.Id, got.VersionId)

	// Verify GetForTarget()
	target := engine.Workspace().Store().PolicySkips.GetForTarget(version.Id, environmentID, resourceID)
	assert.NotNil(t, target)
	assert.Equal(t, skipID, target.Id)

	// Verify non-matching target returns nil
	noMatch := engine.Workspace().Store().PolicySkips.GetForTarget(version.Id, "other-env", resourceID)
	assert.Nil(t, noMatch)
}

func TestEngine_PolicySkipLifecycle_Delete(t *testing.T) {
	skipID := uuid.New().String()
	deploymentID := uuid.New().String()
	environmentID := uuid.New().String()
	resourceID := uuid.New().String()
	jobAgentID := uuid.New().String()

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
				integration.PolicyRuleID("rule-1"),
				integration.WithRuleAnyApproval(2),
			),
		),
	)

	ctx := context.Background()

	version := c.NewDeploymentVersion()
	version.DeploymentId = deploymentID
	version.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, version)

	expiresAt := time.Now().Add(1 * time.Hour)
	skip := &oapi.PolicySkip{
		Id:            skipID,
		WorkspaceId:   engine.Workspace().ID,
		VersionId:     version.Id,
		EnvironmentId: &environmentID,
		ResourceId:    &resourceID,
		RuleId:        "rule-1",
		Reason:        "temporary",
		CreatedBy:     "admin",
		CreatedAt:     time.Now(),
		ExpiresAt:     &expiresAt,
	}
	engine.PushEvent(ctx, handler.PolicySkipCreate, skip)

	// Verify exists
	_, ok := engine.Workspace().Store().PolicySkips.Get(skipID)
	assert.True(t, ok)

	// Delete
	engine.PushEvent(ctx, handler.PolicySkipDelete, skip)

	// Verify removed
	_, ok = engine.Workspace().Store().PolicySkips.Get(skipID)
	assert.False(t, ok)

	target := engine.Workspace().Store().PolicySkips.GetForTarget(version.Id, environmentID, resourceID)
	assert.Nil(t, target)
}

func TestEngine_PolicySkipLifecycle_IsExpired(t *testing.T) {
	skipID := uuid.New().String()
	skip2ID := uuid.New().String()
	deploymentID := uuid.New().String()
	environmentID := uuid.New().String()
	resourceID := uuid.New().String()
	jobAgentID := uuid.New().String()

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
				integration.PolicyRuleID("rule-1"),
				integration.WithRuleAnyApproval(2),
			),
		),
	)

	ctx := context.Background()

	version := c.NewDeploymentVersion()
	version.DeploymentId = deploymentID
	version.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, version)

	version2 := c.NewDeploymentVersion()
	version2.DeploymentId = deploymentID
	version2.Tag = "v2.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, version2)

	// Create a skip that's already expired
	expiredAt := time.Now().Add(-1 * time.Hour)
	skip := &oapi.PolicySkip{
		Id:            skipID,
		WorkspaceId:   engine.Workspace().ID,
		VersionId:     version.Id,
		EnvironmentId: &environmentID,
		ResourceId:    &resourceID,
		RuleId:        "rule-1",
		Reason:        "expired skip",
		CreatedBy:     "admin",
		CreatedAt:     time.Now().Add(-2 * time.Hour),
		ExpiresAt:     &expiredAt,
	}
	engine.PushEvent(ctx, handler.PolicySkipCreate, skip)

	got, ok := engine.Workspace().Store().PolicySkips.Get(skipID)
	assert.True(t, ok)
	assert.True(t, got.IsExpired())

	// Create a non-expired skip
	futureExpiry := time.Now().Add(1 * time.Hour)
	skip2 := &oapi.PolicySkip{
		Id:            skip2ID,
		WorkspaceId:   engine.Workspace().ID,
		VersionId:     version2.Id,
		EnvironmentId: &environmentID,
		ResourceId:    &resourceID,
		RuleId:        "rule-1",
		Reason:        "active skip",
		CreatedBy:     "admin",
		CreatedAt:     time.Now(),
		ExpiresAt:     &futureExpiry,
	}
	engine.PushEvent(ctx, handler.PolicySkipCreate, skip2)

	got2, ok := engine.Workspace().Store().PolicySkips.Get(skip2ID)
	assert.True(t, ok)
	assert.False(t, got2.IsExpired())
}

func TestEngine_PolicySkipLifecycle_WildcardEnvironment(t *testing.T) {
	skipID := uuid.New().String()
	resourceID := uuid.New().String()
	deploymentID := uuid.New().String()
	environmentID := uuid.New().String()
	jobAgentID := uuid.New().String()

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
				integration.PolicyRuleID("rule-1"),
				integration.WithRuleAnyApproval(2),
			),
		),
	)

	ctx := context.Background()

	version := c.NewDeploymentVersion()
	version.DeploymentId = deploymentID
	version.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, version)

	// Create skip with nil environment (wildcard)
	skip := &oapi.PolicySkip{
		Id:            skipID,
		WorkspaceId:   engine.Workspace().ID,
		VersionId:     version.Id,
		EnvironmentId: nil,
		ResourceId:    &resourceID,
		RuleId:        "rule-1",
		Reason:        "skip for all environments",
		CreatedBy:     "admin",
		CreatedAt:     time.Now(),
	}
	engine.PushEvent(ctx, handler.PolicySkipCreate, skip)

	got, ok := engine.Workspace().Store().PolicySkips.Get(skipID)
	assert.True(t, ok)
	assert.Nil(t, got.EnvironmentId)

	// Key() should work on wildcard skips
	assert.NotEmpty(t, got.Key())
}
