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

// TestEngine_PolicyBypass_ApprovalBypass tests bypassing approval requirements
func TestEngine_PolicyBypass_ApprovalBypass(t *testing.T) {
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
		// Policy requiring 2 approvals
		integration.WithPolicy(
			integration.PolicyID(policyID),
			integration.PolicyName("production-approvals"),
			integration.WithPolicySelector("true"),
			integration.WithPolicyRule(
				integration.PolicyRuleID(ruleID),
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

	// Verify no jobs yet (needs 2 approvals)
	allJobs := engine.Workspace().Jobs().Items()
	if len(allJobs) > 0 {
		t.Fatalf("expected 0 jobs before bypass, got %d", len(allJobs))
	}

	// Create a bypass to skip approval
	expiresAt := time.Now().Add(1 * time.Hour)
	reason := "Emergency fix for production incident #123"
	bypass := &oapi.PolicySkip{
		Id:            uuid.New().String(),
		WorkspaceId:   engine.Workspace().ID,
		VersionId:     version.Id,
		EnvironmentId: &environmentID,
		ResourceId:    &resourceID,
		RuleId:        ruleID,
		Reason:        reason,
		CreatedBy:     "incident-commander",
		CreatedAt:     time.Now(),
		ExpiresAt:     &expiresAt,
	}
	engine.PushEvent(ctx, handler.PolicySkipCreate, bypass)

	// Now job should be created without approvals
	allJobs = engine.Workspace().Jobs().Items()
	if len(allJobs) != 1 {
		t.Fatalf("expected 1 job after bypass, got %d", len(allJobs))
	}

	t.Logf("SUCCESS: Bypass allowed deployment without approvals")
}

// TestEngine_PolicyBypass_MultipleRuleTypes tests bypassing multiple rule types
func TestEngine_PolicyBypass_MultipleRuleTypes(t *testing.T) {
	jobAgentID := uuid.New().String()
	deploymentID := uuid.New().String()
	environmentID := uuid.New().String()
	resourceID := uuid.New().String()
	policyID := uuid.New().String()
	rule1ID := uuid.New().String()
	rule2ID := uuid.New().String()

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
		// Policy with both approval and gradual rollout
		integration.WithPolicy(
			integration.PolicyID(policyID),
			integration.PolicyName("multi-rule-policy"),
			integration.WithPolicySelector("true"),
			integration.WithPolicyRule(
				integration.PolicyRuleID(rule1ID),
				integration.WithRuleAnyApproval(1),
			),
			integration.WithPolicyRule(
				integration.PolicyRuleID(rule2ID),
				integration.WithRuleGradualRollout(300), // 5 minute intervals
			),
		),
	)

	ctx := context.Background()

	version := c.NewDeploymentVersion()
	version.DeploymentId = deploymentID
	version.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, version)

	// No jobs yet (blocked by approval)
	allJobs := engine.Workspace().Jobs().Items()
	if len(allJobs) > 0 {
		t.Fatalf("expected 0 jobs before bypass, got %d", len(allJobs))
	}

	// Create bypass for both approval and gradual rollout
	reason := "Critical security patch - immediate deployment required"
	bypass1 := &oapi.PolicySkip{
		Id:            uuid.New().String(),
		WorkspaceId:   engine.Workspace().ID,
		VersionId:     version.Id,
		EnvironmentId: &environmentID,
		ResourceId:    &resourceID,
		RuleId:        rule1ID,
		Reason:        reason,
		CreatedBy:     "security-team",
		CreatedAt:     time.Now(),
	}
	bypass2 := &oapi.PolicySkip{
		Id:            uuid.New().String(),
		WorkspaceId:   engine.Workspace().ID,
		VersionId:     version.Id,
		EnvironmentId: &environmentID,
		ResourceId:    &resourceID,
		RuleId:        rule2ID,
		Reason:        reason,
		CreatedBy:     "security-team",
		CreatedAt:     time.Now(),
	}
	engine.PushEvent(ctx, handler.PolicySkipCreate, bypass1)
	engine.PushEvent(ctx, handler.PolicySkipCreate, bypass2)

	// Job should be created immediately
	allJobs = engine.Workspace().Jobs().Items()
	if len(allJobs) != 1 {
		t.Fatalf("expected 1 job after bypass, got %d", len(allJobs))
	}

	t.Logf("SUCCESS: Bypass worked for multiple rule types")
}

// TestEngine_PolicyBypass_EnvironmentWildcard tests bypass applying to all resources in an environment
func TestEngine_PolicyBypass_EnvironmentWildcard(t *testing.T) {
	jobAgentID := uuid.New().String()
	deploymentID := uuid.New().String()
	environmentID := uuid.New().String()
	ruleID := uuid.New().String()

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
		integration.WithPolicy(
			integration.PolicyName("approval-policy"),
			integration.WithPolicySelector("true"),
			integration.WithPolicyRule(
				integration.PolicyRuleID(ruleID),
				integration.WithRuleAnyApproval(1),
			),
		),
	)

	ctx := context.Background()

	version := c.NewDeploymentVersion()
	version.DeploymentId = deploymentID
	version.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, version)

	// No jobs yet
	allJobs := engine.Workspace().Jobs().Items()
	if len(allJobs) > 0 {
		t.Fatalf("expected 0 jobs before bypass, got %d", len(allJobs))
	}

	// Create bypass for environment (all resources)
	reason := "Environment-wide emergency bypass"
	bypass := &oapi.PolicySkip{
		Id:            uuid.New().String(),
		WorkspaceId:   engine.Workspace().ID,
		VersionId:     version.Id,
		EnvironmentId: &environmentID,
		ResourceId:    nil, // Wildcard - all resources
		RuleId:        ruleID,
		Reason:        reason,
		CreatedBy:     "ops-team",
		CreatedAt:     time.Now(),
	}
	engine.PushEvent(ctx, handler.PolicySkipCreate, bypass)

	// All 3 resources should have jobs created
	allJobs = engine.Workspace().Jobs().Items()
	if len(allJobs) != 3 {
		t.Fatalf("expected 3 jobs (one per resource) after bypass, got %d", len(allJobs))
	}

	t.Logf("SUCCESS: Environment wildcard bypass applied to all resources")
}

// TestEngine_PolicyBypass_VersionWildcard tests bypass applying to all environments
func TestEngine_PolicyBypass_VersionWildcard(t *testing.T) {
	jobAgentID := uuid.New().String()
	deploymentID := uuid.New().String()
	envProdID := uuid.New().String()
	envStagingID := uuid.New().String()
	resourceID := uuid.New().String()
	ruleID := uuid.New().String()

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
				integration.EnvironmentID(envProdID),
				integration.EnvironmentName("production"),
				integration.EnvironmentCelResourceSelector("true"),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(envStagingID),
				integration.EnvironmentName("staging"),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceID(resourceID),
		),
		integration.WithPolicy(
			integration.PolicyName("approval-policy"),
			integration.WithPolicySelector("true"),
			integration.WithPolicyRule(
				integration.PolicyRuleID(ruleID),
				integration.WithRuleAnyApproval(1),
			),
		),
	)

	ctx := context.Background()

	version := c.NewDeploymentVersion()
	version.DeploymentId = deploymentID
	version.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, version)

	// No jobs yet
	allJobs := engine.Workspace().Jobs().Items()
	if len(allJobs) > 0 {
		t.Fatalf("expected 0 jobs before bypass, got %d", len(allJobs))
	}

	// Create bypass for version (all environments)
	reason := "Global bypass for critical version"
	bypass := &oapi.PolicySkip{
		Id:            uuid.New().String(),
		WorkspaceId:   engine.Workspace().ID,
		VersionId:     version.Id,
		EnvironmentId: nil, // Wildcard - all environments
		ResourceId:    nil, // Wildcard - all resources
		RuleId:        ruleID,
		Reason:        reason,
		CreatedBy:     "cto",
		CreatedAt:     time.Now(),
	}
	engine.PushEvent(ctx, handler.PolicySkipCreate, bypass)

	// Both environments should have jobs
	allJobs = engine.Workspace().Jobs().Items()
	if len(allJobs) != 2 {
		t.Fatalf("expected 2 jobs (one per environment) after bypass, got %d", len(allJobs))
	}

	t.Logf("SUCCESS: Version wildcard bypass applied to all environments")
}

// TestEngine_PolicyBypass_PolicySpecific tests bypass applying only to specific policies
func TestEngine_PolicyBypass_PolicySpecific(t *testing.T) {
	jobAgentID := uuid.New().String()
	deploymentID := uuid.New().String()
	environmentID := uuid.New().String()
	resourceID := uuid.New().String()
	policy1ID := uuid.New().String()
	policy2ID := uuid.New().String()
	rule1ID := uuid.New().String()
	rule2ID := uuid.New().String()

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
		// Policy 1: requires 2 approvals
		integration.WithPolicy(
			integration.PolicyID(policy1ID),
			integration.PolicyName("policy-1-approval"),
			integration.WithPolicySelector("true"),
			integration.WithPolicyRule(
				integration.PolicyRuleID(rule1ID),
				integration.WithRuleAnyApproval(2),
			),
		),
		// Policy 2: requires 1 approval
		integration.WithPolicy(
			integration.PolicyID(policy2ID),
			integration.PolicyName("policy-2-approval"),
			integration.WithPolicySelector("true"),
			integration.WithPolicyRule(
				integration.PolicyRuleID(rule2ID),
				integration.WithRuleAnyApproval(1),
			),
		),
	)

	ctx := context.Background()

	version := c.NewDeploymentVersion()
	version.DeploymentId = deploymentID
	version.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, version)

	// No jobs yet (both policies block)
	allJobs := engine.Workspace().Jobs().Items()
	if len(allJobs) > 0 {
		t.Fatalf("expected 0 jobs before bypass, got %d", len(allJobs))
	}

	// Create bypass for policy 1 only
	reason := "Bypass only policy-1, policy-2 still applies"
	bypass := &oapi.PolicySkip{
		Id:            uuid.New().String(),
		WorkspaceId:   engine.Workspace().ID,
		VersionId:     version.Id,
		EnvironmentId: &environmentID,
		ResourceId:    &resourceID,
		RuleId:        rule1ID,
		Reason:        reason,
		CreatedBy:     "admin",
		CreatedAt:     time.Now(),
	}
	engine.PushEvent(ctx, handler.PolicySkipCreate, bypass)

	// Still no jobs (policy 2 still blocks)
	allJobs = engine.Workspace().Jobs().Items()
	if len(allJobs) > 0 {
		t.Fatalf("expected 0 jobs (policy-2 still blocks), got %d", len(allJobs))
	}

	// Now add 1 approval to satisfy policy 2
	approval := &oapi.UserApprovalRecord{
		VersionId:     version.Id,
		EnvironmentId: environmentID,
		UserId:        "user-1",
		Status:        oapi.ApprovalStatusApproved,
		CreatedAt:     time.Now().Format(time.RFC3339),
	}
	engine.PushEvent(ctx, handler.UserApprovalRecordCreate, approval)

	// Now job should be created (policy 1 bypassed, policy 2 satisfied)
	allJobs = engine.Workspace().Jobs().Items()
	if len(allJobs) != 1 {
		t.Fatalf("expected 1 job after approval satisfies policy-2, got %d", len(allJobs))
	}

	t.Logf("SUCCESS: Policy-specific bypass worked correctly")
}

// TestEngine_PolicyBypass_Expiration tests that expired bypasses are ignored
func TestEngine_PolicyBypass_Expiration(t *testing.T) {
	jobAgentID := uuid.New().String()
	deploymentID := uuid.New().String()
	environmentID := uuid.New().String()
	resourceID := uuid.New().String()
	ruleID := uuid.New().String()

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
			integration.PolicyName("approval-policy"),
			integration.WithPolicySelector("true"),
			integration.WithPolicyRule(
				integration.PolicyRuleID(ruleID),
				integration.WithRuleAnyApproval(1),
			),
		),
	)

	ctx := context.Background()

	version := c.NewDeploymentVersion()
	version.DeploymentId = deploymentID
	version.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, version)

	// Create bypass that already expired
	pastTime := time.Now().Add(-1 * time.Hour)
	reason := "Expired bypass"
	bypass := &oapi.PolicySkip{
		Id:            uuid.New().String(),
		WorkspaceId:   engine.Workspace().ID,
		VersionId:     version.Id,
		EnvironmentId: &environmentID,
		ResourceId:    &resourceID,
		RuleId:        ruleID,
		Reason:        reason,
		CreatedBy:     "admin",
		CreatedAt:     time.Now(),
		ExpiresAt:     &pastTime,
	}
	engine.PushEvent(ctx, handler.PolicySkipCreate, bypass)

	// No jobs because bypass is expired
	allJobs := engine.Workspace().Jobs().Items()
	if len(allJobs) > 0 {
		t.Fatalf("expected 0 jobs (bypass expired), got %d", len(allJobs))
	}

	t.Logf("SUCCESS: Expired bypass was correctly ignored")
}

// TestEngine_PolicyBypass_DeleteBypass tests that deleting a bypass re-enables policies
func TestEngine_PolicyBypass_DeleteBypass(t *testing.T) {
	jobAgentID := uuid.New().String()
	deploymentID := uuid.New().String()
	environmentID := uuid.New().String()
	resourceID := uuid.New().String()
	ruleID := uuid.New().String()

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
			integration.PolicyName("approval-policy"),
			integration.WithPolicySelector("true"),
			integration.WithPolicyRule(
				integration.PolicyRuleID(ruleID),
				integration.WithRuleAnyApproval(1),
			),
		),
	)

	ctx := context.Background()

	version1 := c.NewDeploymentVersion()
	version1.DeploymentId = deploymentID
	version1.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, version1)

	// Create bypass
	reason := "Temporary bypass"
	bypass := &oapi.PolicySkip{
		Id:            uuid.New().String(),
		WorkspaceId:   engine.Workspace().ID,
		VersionId:     version1.Id,
		EnvironmentId: &environmentID,
		ResourceId:    &resourceID,
		RuleId:        ruleID,
		Reason:        reason,
		CreatedBy:     "admin",
		CreatedAt:     time.Now(),
	}
	engine.PushEvent(ctx, handler.PolicySkipCreate, bypass)

	// Job should be created
	allJobs := engine.Workspace().Jobs().Items()
	if len(allJobs) != 1 {
		t.Fatalf("expected 1 job after bypass, got %d", len(allJobs))
	}

	// Delete the bypass
	engine.PushEvent(ctx, handler.PolicySkipDelete, bypass)

	// Create new version
	version2 := c.NewDeploymentVersion()
	version2.DeploymentId = deploymentID
	version2.Tag = "v2.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, version2)

	// No new jobs (bypass deleted, policy now active)
	allJobs = engine.Workspace().Jobs().Items()
	if len(allJobs) != 1 { // Still only the first job
		t.Fatalf("expected still only 1 job (bypass deleted), got %d", len(allJobs))
	}

	t.Logf("SUCCESS: Deleted bypass correctly re-enabled policy")
}
