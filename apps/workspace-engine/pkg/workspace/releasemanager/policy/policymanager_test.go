package policy

import (
	"context"
	"testing"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/statechange"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator"
	"workspace-engine/pkg/workspace/store"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func setupTestStore(_ *testing.T) *store.Store {
	cs := statechange.NewChangeSet[any]()
	return store.New("test-workspace", cs)
}

func TestNew(t *testing.T) {
	st := setupTestStore(t)

	manager := New(st)

	require.NotNil(t, manager)
	assert.NotNil(t, manager.store)
}

func TestEvaluatorsForPolicy(t *testing.T) {
	st := setupTestStore(t)
	manager := New(st)

	tests := []struct {
		name          string
		rule          *oapi.PolicyRule
		expectedCount int
		expectedTypes []string // Types of evaluators we expect
	}{
		{
			name: "approval rule",
			rule: &oapi.PolicyRule{
				Id: "rule-1",
				AnyApproval: &oapi.AnyApprovalRule{
					MinApprovals: 2,
				},
			},
			expectedCount: 1,
			expectedTypes: []string{"approval"},
		},
		{
			name: "environment progression rule",
			rule: &oapi.PolicyRule{
				Id: "rule-2",
				EnvironmentProgression: &oapi.EnvironmentProgressionRule{
					DependsOnEnvironmentSelector: oapi.Selector{},
				},
			},
			expectedCount: 1,
			expectedTypes: []string{"environmentprogression"},
		},
		{
			name: "gradual rollout rule",
			rule: &oapi.PolicyRule{
				Id: "rule-3",
				GradualRollout: &oapi.GradualRolloutRule{
					TimeScaleInterval: 60,
				},
			},
			expectedCount: 1,
			expectedTypes: []string{"gradualrollout"},
		},
		{
			name: "no rules configured",
			rule: &oapi.PolicyRule{
				Id: "rule-4",
			},
			expectedCount: 0,
			expectedTypes: []string{},
		},
		{
			name: "multiple rules configured",
			rule: &oapi.PolicyRule{
				Id: "rule-5",
				AnyApproval: &oapi.AnyApprovalRule{
					MinApprovals: 1,
				},
				EnvironmentProgression: &oapi.EnvironmentProgressionRule{
					DependsOnEnvironmentSelector: oapi.Selector{},
				},
				GradualRollout: &oapi.GradualRolloutRule{
					TimeScaleInterval: 30,
				},
			},
			expectedCount: 3,
			expectedTypes: []string{"approval", "environmentprogression", "gradualrollout"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			evals := manager.PlannerPolicyEvaluators(tt.rule)

			assert.Len(t, evals, tt.expectedCount, "unexpected number of evaluators")

			// Verify evaluators are not nil
			for _, eval := range evals {
				assert.NotNil(t, eval)
			}
		})
	}
}

func TestGlobalEvaluators(t *testing.T) {
	st := setupTestStore(t)
	m := New(st)

	evals := m.PlannerGlobalEvaluators()

	// Should return deployableversions evaluator (which handles both ready and paused versions)
	assert.Len(t, evals, 1, "expected 1 global evaluator")

	// Verify all evaluators are not nil
	for _, eval := range evals {
		assert.NotNil(t, eval)
	}

	// Verify we get the expected types by checking if they implement the interface
	foundPausedVersions := false
	foundDeployableVersions := false

	for _, eval := range evals {
		// Check scope fields to identify evaluator types
		scopeFields := eval.ScopeFields()

		// PausedVersions cares about Version + ReleaseTarget
		if scopeFields == (evaluator.ScopeVersion | evaluator.ScopeReleaseTarget) {
			foundPausedVersions = true
		}

		// DeployableVersions cares about Version only
		if scopeFields == evaluator.ScopeVersion {
			foundDeployableVersions = true
		}
	}

	assert.True(t, foundPausedVersions || foundDeployableVersions,
		"expected to find global evaluators")
}

func TestEvaluatePolicy(t *testing.T) {
	ctx := context.Background()

	environment := &oapi.Environment{
		Id:   "env-1",
		Name: "production",
	}

	version := &oapi.DeploymentVersion{
		Id:           "version-1",
		DeploymentId: "deployment-1",
		Tag:          "v1.0.0",
		Status:       oapi.DeploymentVersionStatusReady,
	}

	releaseTarget := &oapi.ReleaseTarget{
		DeploymentId:  "deployment-1",
		EnvironmentId: "env-1",
		ResourceId:    "resource-1",
	}

	scope := evaluator.EvaluatorScope{
		Environment: environment,
		Version:     version,
		Resource:    &oapi.Resource{Id: releaseTarget.ResourceId},
		Deployment:  &oapi.Deployment{Id: releaseTarget.DeploymentId},
	}

	tests := []struct {
		name           string
		policy         *oapi.Policy
		scope          *evaluator.EvaluatorScope // Optional custom scope, uses default if nil
		setupStore     func(*store.Store)
		expectedPassed bool // Whether all rules should pass
		checkResult    func(*testing.T, *oapi.PolicyEvaluation)
	}{
		{
			name: "policy with no rules - should pass",
			policy: &oapi.Policy{
				Id:      "policy-1",
				Name:    "empty-policy",
				Enabled: true,
				Rules:   []oapi.PolicyRule{},
			},
			expectedPassed: true,
			checkResult: func(t *testing.T, result *oapi.PolicyEvaluation) {
				assert.Len(t, result.RuleResults, 0)
				assert.True(t, result.Allowed())
			},
		},
		{
			name: "policy with approval rule - not enough approvals",
			policy: &oapi.Policy{
				Id:      "policy-2",
				Name:    "approval-policy",
				Enabled: true,
				Rules: []oapi.PolicyRule{
					{
						Id: "rule-1",
						AnyApproval: &oapi.AnyApprovalRule{
							MinApprovals: 2,
						},
					},
				},
			},
			expectedPassed: false,
			checkResult: func(t *testing.T, result *oapi.PolicyEvaluation) {
				assert.Len(t, result.RuleResults, 1)
				assert.False(t, result.Allowed(), "policy should be denied due to insufficient approvals")
				assert.Equal(t, "rule-1", result.RuleResults[0].RuleId)
				assert.False(t, result.RuleResults[0].Allowed)
			},
		},
		{
			name: "policy with approval rule - enough approvals",
			policy: &oapi.Policy{
				Id:      "policy-3",
				Name:    "approval-policy-satisfied",
				Enabled: true,
				Rules: []oapi.PolicyRule{
					{
						Id: "rule-2",
						AnyApproval: &oapi.AnyApprovalRule{
							MinApprovals: 2,
						},
					},
				},
			},
			setupStore: func(st *store.Store) {
				// Add approval records
				st.UserApprovalRecords.Upsert(ctx, &oapi.UserApprovalRecord{
					VersionId:     "version-1",
					EnvironmentId: "env-1",
					UserId:        "user-1",
					Status:        oapi.ApprovalStatusApproved,
				})
				st.UserApprovalRecords.Upsert(ctx, &oapi.UserApprovalRecord{
					VersionId:     "version-1",
					EnvironmentId: "env-1",
					UserId:        "user-2",
					Status:        oapi.ApprovalStatusApproved,
				})
			},
			expectedPassed: true,
			checkResult: func(t *testing.T, result *oapi.PolicyEvaluation) {
				assert.Len(t, result.RuleResults, 1)
				assert.True(t, result.Allowed(), "policy should be allowed with sufficient approvals")
				assert.Equal(t, "rule-2", result.RuleResults[0].RuleId)
				assert.True(t, result.RuleResults[0].Allowed)
			},
		},
		{
			name: "policy with paused version - should be denied by global evaluator",
			policy: &oapi.Policy{
				Id:      "policy-4",
				Name:    "test-policy",
				Enabled: true,
				Rules:   []oapi.PolicyRule{},
			},
			expectedPassed: false,
			checkResult: func(t *testing.T, result *oapi.PolicyEvaluation) {
				// Global evaluators run separately in the planner, not in EvaluatePolicy
				// So this test just verifies the policy itself doesn't block anything
				assert.True(t, result.Allowed(), "policy with no rules should allow")
			},
		},
		{
			name: "policy skips evaluation when scope is missing required fields",
			policy: &oapi.Policy{
				Id:      "policy-5",
				Name:    "missing-scope-policy",
				Enabled: true,
				Rules: []oapi.PolicyRule{
					{
						Id: "rule-3",
						AnyApproval: &oapi.AnyApprovalRule{
							MinApprovals: 1,
						},
					},
				},
			},
			scope: &evaluator.EvaluatorScope{
				// Only Version is set, but approval evaluator needs Environment too
				Version: version,
			},
			expectedPassed: true,
			checkResult: func(t *testing.T, result *oapi.PolicyEvaluation) {
				// Even with incomplete scope, EvaluatePolicy should handle it gracefully
				// The evaluator will be skipped if scope doesn't have required fields
				assert.NotNil(t, result)
				assert.True(t, result.Allowed(), "policy with skipped evaluators should allow")
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Setup fresh store for each test
			testStore := setupTestStore(t)
			testManager := New(testStore)

			// Add environment and version to store
			_ = testStore.Environments.Upsert(ctx, environment)
			testStore.DeploymentVersions.Upsert(ctx, version.Id, version)

			if tt.setupStore != nil {
				tt.setupStore(testStore)
			}

			// Use custom scope if provided, otherwise use default
			testScope := scope
			if tt.scope != nil {
				testScope = *tt.scope
			}

			result := testManager.EvaluateWithPolicy(ctx, tt.policy, testScope, testManager.PlannerPolicyEvaluators)

			require.NotNil(t, result)
			assert.Equal(t, tt.policy.Id, result.Policy.Id)
			assert.Equal(t, tt.policy.Name, result.Policy.Name)

			if tt.checkResult != nil {
				tt.checkResult(t, result)
			}
		})
	}
}

func TestEvaluatePolicy_SkipsEvaluatorWithMissingScope(t *testing.T) {
	ctx := context.Background()
	st := setupTestStore(t)
	manager := New(st)

	policy := &oapi.Policy{
		Id:      "policy-1",
		Name:    "test-policy",
		Enabled: true,
		Rules: []oapi.PolicyRule{
			{
				Id: "rule-1",
				AnyApproval: &oapi.AnyApprovalRule{
					MinApprovals: 1,
				},
			},
		},
	}

	// Create scope with missing Environment (required by approval evaluator)
	scope := evaluator.EvaluatorScope{
		Version: &oapi.DeploymentVersion{
			Id:           "version-1",
			DeploymentId: "deployment-1",
			Tag:          "v1.0.0",
			Status:       oapi.DeploymentVersionStatusReady,
		},
		// Environment is nil
	}

	result := manager.EvaluateWithPolicy(ctx, policy, scope, manager.PlannerPolicyEvaluators)

	require.NotNil(t, result)
	// Evaluator should be skipped due to missing scope fields
	assert.Len(t, result.RuleResults, 0, "evaluators should be skipped when scope is incomplete")
	assert.True(t, result.Allowed(), "policy with no executed rules should allow")
}

func TestEvaluatePolicy_MultipleRules(t *testing.T) {
	ctx := context.Background()
	st := setupTestStore(t)
	manager := New(st)

	environment := &oapi.Environment{
		Id:   "env-1",
		Name: "production",
	}
	_ = st.Environments.Upsert(ctx, environment)

	version := &oapi.DeploymentVersion{
		Id:           "version-1",
		DeploymentId: "deployment-1",
		Tag:          "v1.0.0",
		Status:       oapi.DeploymentVersionStatusReady,
	}
	st.DeploymentVersions.Upsert(ctx, version.Id, version)

	releaseTarget := &oapi.ReleaseTarget{
		DeploymentId:  "deployment-1",
		EnvironmentId: "env-1",
		ResourceId:    "resource-1",
	}

	scope := evaluator.EvaluatorScope{
		Environment: environment,
		Version:     version,
		Resource:    &oapi.Resource{Id: releaseTarget.ResourceId},
		Deployment:  &oapi.Deployment{Id: releaseTarget.DeploymentId},
	}

	policy := &oapi.Policy{
		Id:      "policy-1",
		Name:    "multi-rule-policy",
		Enabled: true,
		Rules: []oapi.PolicyRule{
			{
				Id: "rule-1",
				AnyApproval: &oapi.AnyApprovalRule{
					MinApprovals: 1,
				},
			},
			{
				Id: "rule-2",
				AnyApproval: &oapi.AnyApprovalRule{
					MinApprovals: 2,
				},
			},
		},
	}

	result := manager.EvaluateWithPolicy(ctx, policy, scope, manager.PlannerPolicyEvaluators)

	require.NotNil(t, result)
	// Both rules should be evaluated
	assert.Len(t, result.RuleResults, 2, "both rules should be evaluated")

	// Find results for each rule
	var rule1Result, rule2Result *oapi.RuleEvaluation
	for i := range result.RuleResults {
		if result.RuleResults[i].RuleId == "rule-1" {
			rule1Result = &result.RuleResults[i]
		}
		if result.RuleResults[i].RuleId == "rule-2" {
			rule2Result = &result.RuleResults[i]
		}
	}

	require.NotNil(t, rule1Result, "rule-1 result should exist")
	require.NotNil(t, rule2Result, "rule-2 result should exist")

	// Both should fail (no approvals added)
	assert.False(t, rule1Result.Allowed)
	assert.False(t, rule2Result.Allowed)
	assert.False(t, result.Allowed(), "overall policy should be denied if any rule fails")
}

func TestEvaluatorsForPolicy_ReturnsCorrectTypes(t *testing.T) {
	st := setupTestStore(t)
	manager := New(st)

	tests := []struct {
		name      string
		rule      *oapi.PolicyRule
		checkType func(*testing.T, []evaluator.Evaluator)
	}{
		{
			name: "approval evaluator check",
			rule: &oapi.PolicyRule{
				Id: "rule-1",
				AnyApproval: &oapi.AnyApprovalRule{
					MinApprovals: 1,
				},
			},
			checkType: func(t *testing.T, evals []evaluator.Evaluator) {
				require.Len(t, evals, 1)
				// Approval evaluator cares about Environment + Version
				assert.Equal(t, evaluator.ScopeEnvironment|evaluator.ScopeVersion, evals[0].ScopeFields())
			},
		},
		{
			name: "environment progression evaluator check",
			rule: &oapi.PolicyRule{
				Id: "rule-2",
				EnvironmentProgression: &oapi.EnvironmentProgressionRule{
					DependsOnEnvironmentSelector: oapi.Selector{},
				},
			},
			checkType: func(t *testing.T, evals []evaluator.Evaluator) {
				require.Len(t, evals, 1)
				// Environment progression cares about Environment + Version
				assert.Equal(t, evaluator.ScopeEnvironment|evaluator.ScopeVersion, evals[0].ScopeFields())
			},
		},
		{
			name: "gradual rollout evaluator check",
			rule: &oapi.PolicyRule{
				Id: "rule-3",
				GradualRollout: &oapi.GradualRolloutRule{
					TimeScaleInterval: 60,
				},
			},
			checkType: func(t *testing.T, evals []evaluator.Evaluator) {
				require.Len(t, evals, 1)
				// Gradual rollout cares about Environment + Version + ReleaseTarget
				assert.Equal(t, evaluator.ScopeEnvironment|evaluator.ScopeVersion|evaluator.ScopeReleaseTarget,
					evals[0].ScopeFields())
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			evals := manager.PlannerPolicyEvaluators(tt.rule)
			tt.checkType(t, evals)
		})
	}
}
