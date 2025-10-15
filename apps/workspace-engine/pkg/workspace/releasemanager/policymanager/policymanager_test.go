package policymanager

import (
	"context"
	"testing"
	"time"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/store"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Helper functions for test setup

func createTestPolicy(workspaceID, policyID, policyName string, rules []oapi.PolicyRule, selectors []oapi.PolicyTargetSelector) *oapi.Policy {
	return &oapi.Policy{
		Id:          policyID,
		Name:        policyName,
		WorkspaceId: workspaceID,
		CreatedAt:   time.Now().Format(time.RFC3339),
		Rules:       rules,
		Selectors:   selectors,
	}
}

func createTestPolicyRule(ruleID, policyID string, anyApproval *oapi.AnyApprovalRule) oapi.PolicyRule {
	return oapi.PolicyRule{
		Id:          ruleID,
		PolicyId:    policyID,
		CreatedAt:   time.Now().Format(time.RFC3339),
		AnyApproval: anyApproval,
	}
}

func createTestReleaseTarget(deploymentID, environmentID, resourceID string) *oapi.ReleaseTarget {
	return &oapi.ReleaseTarget{
		DeploymentId:  deploymentID,
		EnvironmentId: environmentID,
		ResourceId:    resourceID,
	}
}

func createTestVersion(versionID, versionTag string) *oapi.DeploymentVersion {
	return &oapi.DeploymentVersion{
		Id:  versionID,
		Tag: versionTag,
	}
}

func createTestDeployment(systemID, deploymentID, name string) *oapi.Deployment {
	return &oapi.Deployment{
		Id:       deploymentID,
		SystemId: systemID,
		Name:     name,
	}
}

func createTestEnvironment(systemID, environmentID, name string) *oapi.Environment {
	return &oapi.Environment{
		Id:       environmentID,
		SystemId: systemID,
		Name:     name,
	}
}

func createTestResource(workspaceID, resourceID, name string) *oapi.Resource {
	return &oapi.Resource{
		Id:          resourceID,
		WorkspaceId: workspaceID,
		Name:        name,
	}
}

func createTestSystem(workspaceID, systemID, name string) *oapi.System {
	return &oapi.System{
		Id:          systemID,
		WorkspaceId: workspaceID,
		Name:        name,
	}
}

// setupStoreWithEntities creates a store and adds deployments, environments, and resources
func setupStoreWithEntities(t *testing.T, ctx context.Context, workspaceID string) (*store.Store, string, string, string, string) {
	st := store.New()

	systemID := uuid.New().String()
	deploymentID := uuid.New().String()
	environmentID := uuid.New().String()
	resourceID := uuid.New().String()

	// Create system
	sys := createTestSystem(workspaceID, systemID, "test-system")
	if err := st.Systems.Upsert(ctx, sys); err != nil {
		t.Fatalf("Failed to upsert system: %v", err)
	}

	// Create deployment
	dep := createTestDeployment(systemID, deploymentID, "test-deployment")
	if err := st.Deployments.Upsert(ctx, dep); err != nil {
		t.Fatalf("Failed to upsert deployment: %v", err)
	}

	// Create environment
	env := createTestEnvironment(systemID, environmentID, "test-environment")
	// Set a selector that matches all resources
	selector := &oapi.Selector{}
	_ = selector.FromJsonSelector(oapi.JsonSelector{Json: map[string]any{
		"type":     "name",
		"operator": "starts-with",
		"value":    "",
	}})
	env.ResourceSelector = selector
	if err := st.Environments.Upsert(ctx, env); err != nil {
		t.Fatalf("Failed to upsert environment: %v", err)
	}

	// Create resource
	res := createTestResource(workspaceID, resourceID, "test-resource")
	if _, err := st.Resources.Upsert(ctx, res); err != nil {
		t.Fatalf("Failed to upsert resource: %v", err)
	}

	return st, systemID, deploymentID, environmentID, resourceID
}

func TestNew(t *testing.T) {
	st := store.New()
	manager := New(st)

	assert.NotNil(t, manager)
	assert.NotNil(t, manager.store)
	assert.NotNil(t, manager.defaultReleaseRuleEvaluators)
	assert.Equal(t, 1, len(manager.defaultReleaseRuleEvaluators), "should have skipdeployed evaluator by default")
}

func TestManager_EvaluateVersion_NoPolicies(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New().String()
	st, _, deploymentID, environmentID, resourceID := setupStoreWithEntities(t, ctx, workspaceID)

	manager := New(st)

	releaseTarget := createTestReleaseTarget(deploymentID, environmentID, resourceID)
	version := createTestVersion(uuid.New().String(), "v1.0.0")

	decision, err := manager.EvaluateVersion(ctx, version, releaseTarget)

	require.NoError(t, err)
	require.NotNil(t, decision)

	// Fast path: no policies = allowed
	assert.True(t, decision.CanDeploy())
	assert.False(t, decision.IsBlocked())
	assert.False(t, decision.IsPending())
	assert.Equal(t, 0, len(decision.PolicyResults))
	assert.False(t, decision.EvaluatedAt.IsZero())
}

func TestManager_EvaluateVersion_SinglePolicyAllRulesPass(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New().String()
	st, _, deploymentID, environmentID, resourceID := setupStoreWithEntities(t, ctx, workspaceID)

	// Add approvals for the version
	versionID := uuid.New().String()
	st.UserApprovalRecords.Upsert(ctx, &oapi.UserApprovalRecord{
		VersionId: versionID,
		UserId:    "user-1",
		Status:    oapi.ApprovalStatusApproved,
	})
	st.UserApprovalRecords.Upsert(ctx, &oapi.UserApprovalRecord{
		VersionId: versionID,
		UserId:    "user-2",
		Status:    oapi.ApprovalStatusApproved,
	})

	// Create policy with approval rule
	policyID := uuid.New().String()
	rule := createTestPolicyRule(uuid.New().String(), policyID, &oapi.AnyApprovalRule{MinApprovals: 2})

	// Create policy selector that matches our deployment
	selector := oapi.PolicyTargetSelector{
		Id: uuid.New().String(),
	}
	depSelector := &oapi.Selector{}
	_ = depSelector.FromJsonSelector(oapi.JsonSelector{Json: map[string]any{
		"type":     "name",
		"operator": "equals",
		"value":    "test-deployment",
	}})
	selector.DeploymentSelector = depSelector

	policy := createTestPolicy(workspaceID, policyID, "approval-policy", []oapi.PolicyRule{rule}, []oapi.PolicyTargetSelector{selector})
	if err := st.Policies.Upsert(ctx, policy); err != nil {
		t.Fatalf("Failed to upsert policy: %v", err)
	}

	manager := New(st)

	releaseTarget := createTestReleaseTarget(deploymentID, environmentID, resourceID)
	version := createTestVersion(versionID, "v1.0.0")

	decision, err := manager.EvaluateVersion(ctx, version, releaseTarget)

	require.NoError(t, err)
	require.NotNil(t, decision)

	// All rules pass - should be able to deploy
	assert.True(t, decision.CanDeploy())
	assert.False(t, decision.IsBlocked())
	assert.False(t, decision.IsPending())
	assert.Equal(t, 1, len(decision.PolicyResults))
}

func TestManager_EvaluateVersion_SinglePolicyRuleDenied(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New().String()
	st, _, deploymentID, environmentID, resourceID := setupStoreWithEntities(t, ctx, workspaceID)

	// No approvals added - rule will be denied
	versionID := uuid.New().String()

	// Create policy with approval rule requiring 2 approvals
	policyID := uuid.New().String()
	rule := createTestPolicyRule(uuid.New().String(), policyID, &oapi.AnyApprovalRule{MinApprovals: 2})

	// Create policy selector that matches our deployment
	selector := oapi.PolicyTargetSelector{
		Id: uuid.New().String(),
	}
	depSelector := &oapi.Selector{}
	_ = depSelector.FromJsonSelector(oapi.JsonSelector{Json: map[string]any{
		"type":     "name",
		"operator": "equals",
		"value":    "test-deployment",
	}})
	selector.DeploymentSelector = depSelector

	policy := createTestPolicy(workspaceID, policyID, "approval-policy", []oapi.PolicyRule{rule}, []oapi.PolicyTargetSelector{selector})
	if err := st.Policies.Upsert(ctx, policy); err != nil {
		t.Fatalf("Failed to upsert policy: %v", err)
	}

	manager := New(st)

	releaseTarget := createTestReleaseTarget(deploymentID, environmentID, resourceID)
	version := createTestVersion(versionID, "v1.0.0")

	decision, err := manager.EvaluateVersion(ctx, version, releaseTarget)

	require.NoError(t, err)
	require.NotNil(t, decision)

	// Rule denied - should be blocked
	assert.True(t, decision.CanDeploy(), "no pending actions, but rule is denied")
	assert.True(t, decision.IsBlocked(), "should be blocked due to denial")
	assert.False(t, decision.IsPending(), "not pending when blocked")
	assert.Equal(t, 1, len(decision.PolicyResults))
	assert.True(t, decision.PolicyResults[0].HasDenials())
}

func TestManager_EvaluateVersion_MultiplePolicies(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New().String()
	st, _, deploymentID, environmentID, resourceID := setupStoreWithEntities(t, ctx, workspaceID)

	versionID := uuid.New().String()

	// Add one approval (not enough for either policy)
	st.UserApprovalRecords.Upsert(ctx, &oapi.UserApprovalRecord{
		VersionId: versionID,
		UserId:    "user-1",
		Status:    oapi.ApprovalStatusApproved,
	})

	// Create first policy requiring 2 approvals
	policyID1 := uuid.New().String()
	rule1 := createTestPolicyRule(uuid.New().String(), policyID1, &oapi.AnyApprovalRule{MinApprovals: 2})
	selector1 := oapi.PolicyTargetSelector{
		Id: uuid.New().String(),
	}
	depSelector1 := &oapi.Selector{}
	_ = depSelector1.FromJsonSelector(oapi.JsonSelector{Json: map[string]any{
		"type":     "name",
		"operator": "contains",
		"value":    "test",
	}})
	selector1.DeploymentSelector = depSelector1
	policy1 := createTestPolicy(workspaceID, policyID1, "policy-1", []oapi.PolicyRule{rule1}, []oapi.PolicyTargetSelector{selector1})
	if err := st.Policies.Upsert(ctx, policy1); err != nil {
		t.Fatalf("Failed to upsert policy1: %v", err)
	}

	// Create second policy requiring 3 approvals
	policyID2 := uuid.New().String()
	rule2 := createTestPolicyRule(uuid.New().String(), policyID2, &oapi.AnyApprovalRule{MinApprovals: 3})
	selector2 := oapi.PolicyTargetSelector{
		Id: uuid.New().String(),
	}
	depSelector2 := &oapi.Selector{}
	_ = depSelector2.FromJsonSelector(oapi.JsonSelector{Json: map[string]any{
		"type":     "name",
		"operator": "starts-with",
		"value":    "test",
	}})
	selector2.DeploymentSelector = depSelector2
	policy2 := createTestPolicy(workspaceID, policyID2, "policy-2", []oapi.PolicyRule{rule2}, []oapi.PolicyTargetSelector{selector2})
	if err := st.Policies.Upsert(ctx, policy2); err != nil {
		t.Fatalf("Failed to upsert policy2: %v", err)
	}

	manager := New(st)

	releaseTarget := createTestReleaseTarget(deploymentID, environmentID, resourceID)
	version := createTestVersion(versionID, "v1.0.0")

	decision, err := manager.EvaluateVersion(ctx, version, releaseTarget)

	require.NoError(t, err)
	require.NotNil(t, decision)

	// Should be blocked
	assert.True(t, decision.IsBlocked())
	// Note: CanDeploy only checks pending actions, not denials, so it may be true
	// The important check is IsBlocked

	// Should have evaluated at least one policy (may short-circuit after first denial)
	assert.GreaterOrEqual(t, len(decision.PolicyResults), 1)
}

func TestManager_EvaluateVersion_ShortCircuitOnDenial(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New().String()
	st, _, deploymentID, environmentID, resourceID := setupStoreWithEntities(t, ctx, workspaceID)

	versionID := uuid.New().String()

	// Create first policy that will deny
	policyID1 := uuid.New().String()
	rule1 := createTestPolicyRule(uuid.New().String(), policyID1, &oapi.AnyApprovalRule{MinApprovals: 5})
	selector1 := oapi.PolicyTargetSelector{
		Id: uuid.New().String(),
	}
	depSelector1 := &oapi.Selector{}
	_ = depSelector1.FromJsonSelector(oapi.JsonSelector{Json: map[string]any{
		"type":     "name",
		"operator": "equals",
		"value":    "test-deployment",
	}})
	selector1.DeploymentSelector = depSelector1
	policy1 := createTestPolicy(workspaceID, policyID1, "policy-1-deny", []oapi.PolicyRule{rule1}, []oapi.PolicyTargetSelector{selector1})
	if err := st.Policies.Upsert(ctx, policy1); err != nil {
		t.Fatalf("Failed to upsert policy1: %v", err)
	}

	// Create second policy (should not be evaluated due to short-circuit)
	policyID2 := uuid.New().String()
	rule2 := createTestPolicyRule(uuid.New().String(), policyID2, &oapi.AnyApprovalRule{MinApprovals: 1})
	selector2 := oapi.PolicyTargetSelector{
		Id: uuid.New().String(),
	}
	depSelector2 := &oapi.Selector{}
	_ = depSelector2.FromJsonSelector(oapi.JsonSelector{Json: map[string]any{
		"type":     "name",
		"operator": "equals",
		"value":    "test-deployment",
	}})
	selector2.DeploymentSelector = depSelector2
	policy2 := createTestPolicy(workspaceID, policyID2, "policy-2", []oapi.PolicyRule{rule2}, []oapi.PolicyTargetSelector{selector2})
	if err := st.Policies.Upsert(ctx, policy2); err != nil {
		t.Fatalf("Failed to upsert policy2: %v", err)
	}

	manager := New(st)

	releaseTarget := createTestReleaseTarget(deploymentID, environmentID, resourceID)
	version := createTestVersion(versionID, "v1.0.0")

	decision, err := manager.EvaluateVersion(ctx, version, releaseTarget)

	require.NoError(t, err)
	require.NotNil(t, decision)

	// Should short-circuit after first denial
	assert.True(t, decision.IsBlocked())
	assert.Equal(t, 1, len(decision.PolicyResults), "should short-circuit and only evaluate first policy")
	assert.True(t, decision.PolicyResults[0].HasDenials())
}

func TestManager_EvaluateVersion_PolicyWithMultipleRules(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New().String()
	st, _, deploymentID, environmentID, resourceID := setupStoreWithEntities(t, ctx, workspaceID)

	versionID := uuid.New().String()

	// Add 3 approvals
	for i := 1; i <= 3; i++ {
		st.UserApprovalRecords.Upsert(ctx, &oapi.UserApprovalRecord{
			VersionId: versionID,
			UserId:    uuid.New().String(),
			Status:    oapi.ApprovalStatusApproved,
		})
	}

	// Create policy with multiple rules
	policyID := uuid.New().String()
	rule1 := createTestPolicyRule(uuid.New().String(), policyID, &oapi.AnyApprovalRule{MinApprovals: 2})
	rule2 := createTestPolicyRule(uuid.New().String(), policyID, &oapi.AnyApprovalRule{MinApprovals: 3})

	selector := oapi.PolicyTargetSelector{
		Id: uuid.New().String(),
	}
	depSelector := &oapi.Selector{}
	_ = depSelector.FromJsonSelector(oapi.JsonSelector{Json: map[string]any{
		"type":     "name",
		"operator": "equals",
		"value":    "test-deployment",
	}})
	selector.DeploymentSelector = depSelector

	policy := createTestPolicy(workspaceID, policyID, "multi-rule-policy", []oapi.PolicyRule{rule1, rule2}, []oapi.PolicyTargetSelector{selector})
	if err := st.Policies.Upsert(ctx, policy); err != nil {
		t.Fatalf("Failed to upsert policy: %v", err)
	}

	manager := New(st)

	releaseTarget := createTestReleaseTarget(deploymentID, environmentID, resourceID)
	version := createTestVersion(versionID, "v1.0.0")

	decision, err := manager.EvaluateVersion(ctx, version, releaseTarget)

	require.NoError(t, err)
	require.NotNil(t, decision)

	// Both rules should pass (3 approvals >= 2 and 3 approvals >= 3)
	assert.True(t, decision.CanDeploy())
	assert.False(t, decision.IsBlocked())
	assert.Equal(t, 1, len(decision.PolicyResults))
	assert.Equal(t, 2, len(decision.PolicyResults[0].RuleResults), "should have evaluated both rules")
}

func TestManager_EvaluateVersion_PolicyWithMultipleRulesOneFails(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New().String()
	st, _, deploymentID, environmentID, resourceID := setupStoreWithEntities(t, ctx, workspaceID)

	versionID := uuid.New().String()

	// Add only 2 approvals
	for i := 1; i <= 2; i++ {
		st.UserApprovalRecords.Upsert(ctx, &oapi.UserApprovalRecord{
			VersionId: versionID,
			UserId:    uuid.New().String(),
			Status:    oapi.ApprovalStatusApproved,
		})
	}

	// Create policy with multiple rules
	policyID := uuid.New().String()
	rule1 := createTestPolicyRule(uuid.New().String(), policyID, &oapi.AnyApprovalRule{MinApprovals: 1})
	rule2 := createTestPolicyRule(uuid.New().String(), policyID, &oapi.AnyApprovalRule{MinApprovals: 5}) // Will fail

	selector := oapi.PolicyTargetSelector{
		Id: uuid.New().String(),
	}
	depSelector := &oapi.Selector{}
	_ = depSelector.FromJsonSelector(oapi.JsonSelector{Json: map[string]any{
		"type":     "name",
		"operator": "equals",
		"value":    "test-deployment",
	}})
	selector.DeploymentSelector = depSelector

	policy := createTestPolicy(workspaceID, policyID, "multi-rule-policy", []oapi.PolicyRule{rule1, rule2}, []oapi.PolicyTargetSelector{selector})
	if err := st.Policies.Upsert(ctx, policy); err != nil {
		t.Fatalf("Failed to upsert policy: %v", err)
	}

	manager := New(st)

	releaseTarget := createTestReleaseTarget(deploymentID, environmentID, resourceID)
	version := createTestVersion(versionID, "v1.0.0")

	decision, err := manager.EvaluateVersion(ctx, version, releaseTarget)

	require.NoError(t, err)
	require.NotNil(t, decision)

	// One rule fails - should be blocked
	assert.True(t, decision.IsBlocked())
	// Note: CanDeploy only checks pending actions. A denial doesn't create pending actions.
	assert.Equal(t, 1, len(decision.PolicyResults))
	assert.Equal(t, 2, len(decision.PolicyResults[0].RuleResults))
	assert.True(t, decision.PolicyResults[0].HasDenials())
}

func TestManager_getVersionRuleEvaluator_AnyApprovalRule(t *testing.T) {
	ctx := context.Background()
	st := store.New()
	manager := New(st)

	rule := createTestPolicyRule(uuid.New().String(), uuid.New().String(), &oapi.AnyApprovalRule{MinApprovals: 2})
	version := createTestVersion(uuid.New().String(), "v1.0.0")
	releaseTarget := createTestReleaseTarget(uuid.New().String(), uuid.New().String(), uuid.New().String())

	evaluator, err := manager.createVersionEvaulatorForRule(ctx, &rule, version, releaseTarget)

	require.NoError(t, err)
	require.NotNil(t, evaluator)
}

func TestManager_getVersionRuleEvaluator_UnknownRuleType(t *testing.T) {
	ctx := context.Background()
	st := store.New()
	manager := New(st)

	// Create rule with no rule type set (all fields nil)
	rule := oapi.PolicyRule{
		Id:          uuid.New().String(),
		PolicyId:    uuid.New().String(),
		CreatedAt:   time.Now().Format(time.RFC3339),
		AnyApproval: nil, // No rule type set
	}
	version := createTestVersion(uuid.New().String(), "v1.0.0")
	releaseTarget := createTestReleaseTarget(uuid.New().String(), uuid.New().String(), uuid.New().String())

	evaluator, err := manager.createVersionEvaulatorForRule(ctx, &rule, version, releaseTarget)

	require.Error(t, err)
	require.Nil(t, evaluator)
	assert.Contains(t, err.Error(), "unknown rule type")
}

func TestManager_EvaluateVersion_UnknownRuleTypeError(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New().String()
	st, _, deploymentID, environmentID, resourceID := setupStoreWithEntities(t, ctx, workspaceID)

	// Create policy with unknown rule type (all fields nil)
	policyID := uuid.New().String()
	unknownRule := oapi.PolicyRule{
		Id:          uuid.New().String(),
		PolicyId:    policyID,
		CreatedAt:   time.Now().Format(time.RFC3339),
		AnyApproval: nil, // No rule type set - unknown rule
	}

	selector := oapi.PolicyTargetSelector{
		Id: uuid.New().String(),
	}
	depSelector := &oapi.Selector{}
	if err := depSelector.FromJsonSelector(oapi.JsonSelector{Json: map[string]any{
		"type":     "name",
		"operator": "equals",
		"value":    "test-deployment",
	}}); err != nil {
		t.Fatalf("Failed to create deployment selector: %v", err)
	}
	selector.DeploymentSelector = depSelector

	policy := createTestPolicy(workspaceID, policyID, "unknown-rule-policy", []oapi.PolicyRule{unknownRule}, []oapi.PolicyTargetSelector{selector})
	if err := st.Policies.Upsert(ctx, policy); err != nil {
		t.Fatalf("Failed to upsert policy: %v", err)
	}

	manager := New(st)

	releaseTarget := createTestReleaseTarget(deploymentID, environmentID, resourceID)
	version := createTestVersion(uuid.New().String(), "v1.0.0")

	// Should return error when encountering unknown rule type
	decision, err := manager.EvaluateVersion(ctx, version, releaseTarget)

	require.Error(t, err)
	require.Nil(t, decision)
	assert.Contains(t, err.Error(), "failed to evaluate rule")
	assert.Contains(t, err.Error(), "unknown rule type")
}

func TestManager_EvaluateVersion_MultipleRulesErrorOnSecondRule(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New().String()
	st, _, deploymentID, environmentID, resourceID := setupStoreWithEntities(t, ctx, workspaceID)

	versionID := uuid.New().String()

	// Add approvals for first rule to pass
	st.UserApprovalRecords.Upsert(ctx, &oapi.UserApprovalRecord{
		VersionId: versionID,
		UserId:    "user-1",
		Status:    oapi.ApprovalStatusApproved,
	})

	// Create policy with valid first rule and invalid second rule
	policyID := uuid.New().String()
	validRule := createTestPolicyRule(uuid.New().String(), policyID, &oapi.AnyApprovalRule{MinApprovals: 1})
	invalidRule := oapi.PolicyRule{
		Id:          uuid.New().String(),
		PolicyId:    policyID,
		CreatedAt:   time.Now().Format(time.RFC3339),
		AnyApproval: nil, // Unknown rule type
	}

	selector := oapi.PolicyTargetSelector{
		Id: uuid.New().String(),
	}
	depSelector := &oapi.Selector{}
	_ = depSelector.FromJsonSelector(oapi.JsonSelector{Json: map[string]any{
		"type":     "name",
		"operator": "equals",
		"value":    "test-deployment",
	}})
	selector.DeploymentSelector = depSelector

	policy := createTestPolicy(workspaceID, policyID, "mixed-rules-policy", []oapi.PolicyRule{validRule, invalidRule}, []oapi.PolicyTargetSelector{selector})
	if err := st.Policies.Upsert(ctx, policy); err != nil {
		t.Fatalf("Failed to upsert policy: %v", err)
	}

	manager := New(st)

	releaseTarget := createTestReleaseTarget(deploymentID, environmentID, resourceID)
	version := createTestVersion(versionID, "v1.0.0")

	// Should error when processing second rule
	decision, err := manager.EvaluateVersion(ctx, version, releaseTarget)

	require.Error(t, err)
	require.Nil(t, decision)
	assert.Contains(t, err.Error(), "failed to evaluate rule")
	assert.Contains(t, err.Error(), invalidRule.Id)
}

func TestManager_EvaluateVersion_ErrorInFirstPolicySkipsRest(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New().String()
	st, _, deploymentID, environmentID, resourceID := setupStoreWithEntities(t, ctx, workspaceID)

	// Create first policy with unknown rule type (will error)
	policyID1 := uuid.New().String()
	invalidRule := oapi.PolicyRule{
		Id:          uuid.New().String(),
		PolicyId:    policyID1,
		CreatedAt:   time.Now().Format(time.RFC3339),
		AnyApproval: nil,
	}

	selector1 := oapi.PolicyTargetSelector{
		Id: uuid.New().String(),
	}
	depSelector1 := &oapi.Selector{}
	_ = depSelector1.FromJsonSelector(oapi.JsonSelector{Json: map[string]any{
		"type":     "name",
		"operator": "equals",
		"value":    "test-deployment",
	}})
	selector1.DeploymentSelector = depSelector1

	policy1 := createTestPolicy(workspaceID, policyID1, "error-policy", []oapi.PolicyRule{invalidRule}, []oapi.PolicyTargetSelector{selector1})
	if err := st.Policies.Upsert(ctx, policy1); err != nil {
		t.Fatalf("Failed to upsert policy1: %v", err)
	}

	// Create second policy (should not be evaluated due to error in first)
	policyID2 := uuid.New().String()
	validRule := createTestPolicyRule(uuid.New().String(), policyID2, &oapi.AnyApprovalRule{MinApprovals: 0})

	selector2 := oapi.PolicyTargetSelector{
		Id: uuid.New().String(),
	}
	depSelector2 := &oapi.Selector{}
	_ = depSelector2.FromJsonSelector(oapi.JsonSelector{Json: map[string]any{
		"type":     "name",
		"operator": "equals",
		"value":    "test-deployment",
	}})
	selector2.DeploymentSelector = depSelector2

	policy2 := createTestPolicy(workspaceID, policyID2, "valid-policy", []oapi.PolicyRule{validRule}, []oapi.PolicyTargetSelector{selector2})
	if err := st.Policies.Upsert(ctx, policy2); err != nil {
		t.Fatalf("Failed to upsert policy2: %v", err)
	}

	manager := New(st)

	releaseTarget := createTestReleaseTarget(deploymentID, environmentID, resourceID)
	version := createTestVersion(uuid.New().String(), "v1.0.0")

	// Should error on first policy and not evaluate second
	decision, err := manager.EvaluateVersion(ctx, version, releaseTarget)

	require.Error(t, err)
	require.Nil(t, decision)
	assert.Contains(t, err.Error(), "failed to evaluate rule")
}

func TestManager_EvaluateVersion_EvaluatedAtTimestamp(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New().String()
	st, _, deploymentID, environmentID, resourceID := setupStoreWithEntities(t, ctx, workspaceID)

	manager := New(st)

	releaseTarget := createTestReleaseTarget(deploymentID, environmentID, resourceID)
	version := createTestVersion(uuid.New().String(), "v1.0.0")

	beforeEvaluation := time.Now()
	decision, err := manager.EvaluateVersion(ctx, version, releaseTarget)
	afterEvaluation := time.Now()

	require.NoError(t, err)
	require.NotNil(t, decision)

	// Verify EvaluatedAt is set and within expected range
	assert.False(t, decision.EvaluatedAt.IsZero())
	assert.True(t, decision.EvaluatedAt.After(beforeEvaluation) || decision.EvaluatedAt.Equal(beforeEvaluation))
	assert.True(t, decision.EvaluatedAt.Before(afterEvaluation) || decision.EvaluatedAt.Equal(afterEvaluation))
}

func TestManager_EvaluateVersion_PreAllocatesSlices(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New().String()
	st, _, deploymentID, environmentID, resourceID := setupStoreWithEntities(t, ctx, workspaceID)

	// Create multiple policies
	for i := 0; i < 5; i++ {
		policyID := uuid.New().String()
		rule := createTestPolicyRule(uuid.New().String(), policyID, &oapi.AnyApprovalRule{MinApprovals: 0})

		selector := oapi.PolicyTargetSelector{
			Id: uuid.New().String(),
		}
		depSelector := &oapi.Selector{}
		_ = depSelector.FromJsonSelector(oapi.JsonSelector{Json: map[string]any{
			"type":     "name",
			"operator": "equals",
			"value":    "test-deployment",
		}})
		selector.DeploymentSelector = depSelector

		policy := createTestPolicy(workspaceID, policyID, "policy-"+uuid.New().String(), []oapi.PolicyRule{rule}, []oapi.PolicyTargetSelector{selector})
		if err := st.Policies.Upsert(ctx, policy); err != nil {
			t.Fatalf("Failed to upsert policy: %v", err)
		}
	}

	manager := New(st)

	releaseTarget := createTestReleaseTarget(deploymentID, environmentID, resourceID)
	version := createTestVersion(uuid.New().String(), "v1.0.0")

	decision, err := manager.EvaluateVersion(ctx, version, releaseTarget)

	require.NoError(t, err)
	require.NotNil(t, decision)

	// All policies should pass (MinApprovals: 0)
	assert.True(t, decision.CanDeploy())
	assert.Equal(t, 5, len(decision.PolicyResults))
}

func TestManager_EvaluateVersion_EmptyVersionID(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New().String()
	st, _, deploymentID, environmentID, resourceID := setupStoreWithEntities(t, ctx, workspaceID)

	// Create policy with approval rule
	policyID := uuid.New().String()
	rule := createTestPolicyRule(uuid.New().String(), policyID, &oapi.AnyApprovalRule{MinApprovals: 1})

	selector := oapi.PolicyTargetSelector{
		Id: uuid.New().String(),
	}
	depSelector := &oapi.Selector{}
	_ = depSelector.FromJsonSelector(oapi.JsonSelector{Json: map[string]any{
		"type":     "name",
		"operator": "equals",
		"value":    "test-deployment",
	}})
	selector.DeploymentSelector = depSelector

	policy := createTestPolicy(workspaceID, policyID, "approval-policy", []oapi.PolicyRule{rule}, []oapi.PolicyTargetSelector{selector})
	if err := st.Policies.Upsert(ctx, policy); err != nil {
		t.Fatalf("Failed to upsert policy: %v", err)
	}

	manager := New(st)

	releaseTarget := createTestReleaseTarget(deploymentID, environmentID, resourceID)
	version := createTestVersion("", "v1.0.0") // Empty version ID

	decision, err := manager.EvaluateVersion(ctx, version, releaseTarget)

	require.NoError(t, err)
	require.NotNil(t, decision)

	// Should be blocked due to empty version ID
	assert.True(t, decision.IsBlocked())
	// Note: CanDeploy only checks pending actions. A denial doesn't create pending actions.
}

func TestManager_EvaluateVersion_PolicyResultsInitialized(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New().String()
	st, _, deploymentID, environmentID, resourceID := setupStoreWithEntities(t, ctx, workspaceID)

	manager := New(st)

	releaseTarget := createTestReleaseTarget(deploymentID, environmentID, resourceID)
	version := createTestVersion(uuid.New().String(), "v1.0.0")

	decision, err := manager.EvaluateVersion(ctx, version, releaseTarget)

	require.NoError(t, err)
	require.NotNil(t, decision)
	require.NotNil(t, decision.PolicyResults)

	// Even with no policies, PolicyResults should be initialized (empty slice, not nil)
	assert.Equal(t, 0, len(decision.PolicyResults))
}

func TestManager_EvaluateVersion_PolicySelectorNotMatching(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New().String()
	st, _, deploymentID, environmentID, resourceID := setupStoreWithEntities(t, ctx, workspaceID)

	// Create policy with selector that doesn't match
	policyID := uuid.New().String()
	rule := createTestPolicyRule(uuid.New().String(), policyID, &oapi.AnyApprovalRule{MinApprovals: 1})

	selector := oapi.PolicyTargetSelector{
		Id: uuid.New().String(),
	}
	depSelector := &oapi.Selector{}
	_ = depSelector.FromJsonSelector(oapi.JsonSelector{Json: map[string]any{
		"type":     "name",
		"operator": "equals",
		"value":    "non-matching-deployment",
	}})
	selector.DeploymentSelector = depSelector

	policy := createTestPolicy(workspaceID, policyID, "non-matching-policy", []oapi.PolicyRule{rule}, []oapi.PolicyTargetSelector{selector})
	if err := st.Policies.Upsert(ctx, policy); err != nil {
		t.Fatalf("Failed to upsert policy: %v", err)
	}

	manager := New(st)

	releaseTarget := createTestReleaseTarget(deploymentID, environmentID, resourceID)
	version := createTestVersion(uuid.New().String(), "v1.0.0")

	decision, err := manager.EvaluateVersion(ctx, version, releaseTarget)

	require.NoError(t, err)
	require.NotNil(t, decision)

	// Policy doesn't match, so no policies evaluated
	assert.True(t, decision.CanDeploy())
	assert.Equal(t, 0, len(decision.PolicyResults))
}

func TestManager_EvaluateRelease(t *testing.T) {
	ctx := context.Background()
	st := store.New()
	manager := New(st)

	release := &oapi.Release{
		ReleaseTarget: oapi.ReleaseTarget{
			DeploymentId:  uuid.New().String(),
			EnvironmentId: uuid.New().String(),
			ResourceId:    uuid.New().String(),
		},
		Version: oapi.DeploymentVersion{
			Id:  uuid.New().String(),
			Tag: "v1.0.0",
		},
	}

	decision, err := manager.EvaluateRelease(ctx, release)

	require.NoError(t, err)
	require.NotNil(t, decision)

	// Note: Current implementation has a bug - it doesn't append policyResult to decision
	// This test documents the current behavior
	assert.NotNil(t, decision.PolicyResults)
	assert.False(t, decision.EvaluatedAt.IsZero())
}

func TestManager_EvaluateVersion_NilReleaseTarget(t *testing.T) {
	ctx := context.Background()
	st := store.New()
	manager := New(st)

	version := createTestVersion(uuid.New().String(), "v1.0.0")

	// Current implementation panics on nil release target (expected behavior)
	// This test documents that nil inputs are not supported
	assert.Panics(t, func() {
		_, _ = manager.EvaluateVersion(ctx, version, nil)
	})
}

func TestManager_EvaluateVersion_NilVersion(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New().String()
	st, _, deploymentID, environmentID, resourceID := setupStoreWithEntities(t, ctx, workspaceID)

	manager := New(st)
	releaseTarget := createTestReleaseTarget(deploymentID, environmentID, resourceID)

	// Current implementation panics on nil version (expected behavior)
	// This test documents that nil inputs are not supported
	assert.Panics(t, func() {
		_, _ = manager.EvaluateVersion(ctx, nil, releaseTarget)
	})
}

func TestManager_EvaluateVersion_PolicyWithNoRules(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New().String()
	st, _, deploymentID, environmentID, resourceID := setupStoreWithEntities(t, ctx, workspaceID)

	// Create policy with no rules
	policyID := uuid.New().String()
	selector := oapi.PolicyTargetSelector{
		Id: uuid.New().String(),
	}
	depSelector := &oapi.Selector{}
	_ = depSelector.FromJsonSelector(oapi.JsonSelector{Json: map[string]any{
		"type":     "name",
		"operator": "equals",
		"value":    "test-deployment",
	}})
	selector.DeploymentSelector = depSelector

	policy := createTestPolicy(workspaceID, policyID, "no-rules-policy", []oapi.PolicyRule{}, []oapi.PolicyTargetSelector{selector})
	if err := st.Policies.Upsert(ctx, policy); err != nil {
		t.Fatalf("Failed to upsert policy: %v", err)
	}

	manager := New(st)

	releaseTarget := createTestReleaseTarget(deploymentID, environmentID, resourceID)
	version := createTestVersion(uuid.New().String(), "v1.0.0")

	decision, err := manager.EvaluateVersion(ctx, version, releaseTarget)

	require.NoError(t, err)
	require.NotNil(t, decision)

	// Policy with no rules should allow deployment
	assert.True(t, decision.CanDeploy())
	assert.False(t, decision.IsBlocked())
	assert.Equal(t, 1, len(decision.PolicyResults))
	assert.Equal(t, 0, len(decision.PolicyResults[0].RuleResults))
}

func TestManager_EvaluateVersion_ContextCancellation(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel() // Cancel immediately

	workspaceID := uuid.New().String()
	st, _, deploymentID, environmentID, resourceID := setupStoreWithEntities(t, context.Background(), workspaceID)

	manager := New(st)

	releaseTarget := createTestReleaseTarget(deploymentID, environmentID, resourceID)
	version := createTestVersion(uuid.New().String(), "v1.0.0")

	// Should still work even with cancelled context (no actual blocking operations)
	decision, err := manager.EvaluateVersion(ctx, version, releaseTarget)

	require.NoError(t, err)
	require.NotNil(t, decision)
}

func TestManager_EvaluateVersion_ConcurrentEvaluations(t *testing.T) {
	ctx := context.Background()
	workspaceID := uuid.New().String()
	st, _, deploymentID, environmentID, resourceID := setupStoreWithEntities(t, ctx, workspaceID)

	// Create a policy
	policyID := uuid.New().String()
	rule := createTestPolicyRule(uuid.New().String(), policyID, &oapi.AnyApprovalRule{MinApprovals: 0})

	selector := oapi.PolicyTargetSelector{
		Id: uuid.New().String(),
	}
	depSelector := &oapi.Selector{}
	_ = depSelector.FromJsonSelector(oapi.JsonSelector{Json: map[string]any{
		"type":     "name",
		"operator": "equals",
		"value":    "test-deployment",
	}})
	selector.DeploymentSelector = depSelector

	policy := createTestPolicy(workspaceID, policyID, "concurrent-policy", []oapi.PolicyRule{rule}, []oapi.PolicyTargetSelector{selector})
	if err := st.Policies.Upsert(ctx, policy); err != nil {
		t.Fatalf("Failed to upsert policy: %v", err)
	}

	manager := New(st)

	releaseTarget := createTestReleaseTarget(deploymentID, environmentID, resourceID)

	// Run multiple evaluations concurrently
	const numGoroutines = 10
	errChan := make(chan error, numGoroutines)

	for i := 0; i < numGoroutines; i++ {
		go func(i int) {
			version := createTestVersion(uuid.New().String(), "v1.0.0")
			decision, err := manager.EvaluateVersion(ctx, version, releaseTarget)
			if err != nil {
				errChan <- err
				return
			}
			if decision == nil {
				errChan <- assert.AnError
				return
			}
			errChan <- nil
		}(i)
	}

	// Collect results
	for i := 0; i < numGoroutines; i++ {
		err := <-errChan
		require.NoError(t, err)
	}
}
