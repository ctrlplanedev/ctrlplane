package summaryeval

import (
	"context"
	"testing"

	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ---------------------------------------------------------------------------
// Mock getter satisfying the composite summaryeval.Getter interface
// ---------------------------------------------------------------------------

var _ Getter = (*mockGetter)(nil)

type mockGetter struct{}

func (m *mockGetter) GetApprovalRecords(_ context.Context, _, _ string) ([]*oapi.UserApprovalRecord, error) {
	return nil, nil
}
func (m *mockGetter) GetEnvironment(_ context.Context, _ string) (*oapi.Environment, error) {
	return nil, nil
}
func (m *mockGetter) GetAllEnvironments(_ context.Context, _ string) (map[string]*oapi.Environment, error) {
	return nil, nil
}
func (m *mockGetter) GetDeployment(_ context.Context, _ string) (*oapi.Deployment, error) {
	return nil, nil
}
func (m *mockGetter) GetAllDeployments(_ context.Context, _ string) (map[string]*oapi.Deployment, error) {
	return nil, nil
}
func (m *mockGetter) GetResource(_ context.Context, _ string) (*oapi.Resource, error) {
	return nil, nil
}
func (m *mockGetter) GetRelease(_ context.Context, _ string) (*oapi.Release, error) {
	return nil, nil
}
func (m *mockGetter) GetSystemIDsForEnvironment(_ string) []string { return nil }
func (m *mockGetter) GetReleaseTargetsForEnvironment(_ context.Context, _ string) ([]*oapi.ReleaseTarget, error) {
	return nil, nil
}
func (m *mockGetter) GetReleaseTargetsForDeployment(_ context.Context, _ string) ([]*oapi.ReleaseTarget, error) {
	return nil, nil
}
func (m *mockGetter) GetJobsForReleaseTarget(_ *oapi.ReleaseTarget) map[string]*oapi.Job {
	return nil
}
func (m *mockGetter) GetAllPolicies(_ context.Context, _ string) (map[string]*oapi.Policy, error) {
	return nil, nil
}
func (m *mockGetter) GetPoliciesForReleaseTarget(_ context.Context, _ *oapi.ReleaseTarget) ([]*oapi.Policy, error) {
	return nil, nil
}
func (m *mockGetter) GetPolicySkips(_ context.Context, _, _, _ string) ([]*oapi.PolicySkip, error) {
	return nil, nil
}
func (m *mockGetter) HasCurrentRelease(_ context.Context, _ *oapi.ReleaseTarget) (bool, error) {
	return false, nil
}
func (m *mockGetter) GetReleaseTargets() ([]*oapi.ReleaseTarget, error) { return nil, nil }
func (m *mockGetter) GetJobVerificationStatus(_ string) oapi.JobVerificationStatus {
	return oapi.JobVerificationStatusCancelled
}
func (m *mockGetter) NewVersionCooldownEvaluator(rule *oapi.PolicyRule) evaluator.Evaluator {
	return nil
}

// ---------------------------------------------------------------------------
// Rule builder helpers
// ---------------------------------------------------------------------------

func ruleWithDeploymentWindow(id string) *oapi.PolicyRule {
	return &oapi.PolicyRule{
		Id: id,
		DeploymentWindow: &oapi.DeploymentWindowRule{
			Rrule:           "FREQ=WEEKLY;BYDAY=MO;BYHOUR=9",
			DurationMinutes: 60,
		},
	}
}

func ruleWithApproval(id string) *oapi.PolicyRule {
	return &oapi.PolicyRule{
		Id:          id,
		AnyApproval: &oapi.AnyApprovalRule{MinApprovals: 1},
	}
}

func ruleWithEnvironmentProgression(id string) *oapi.PolicyRule {
	return &oapi.PolicyRule{
		Id:                     id,
		EnvironmentProgression: &oapi.EnvironmentProgressionRule{},
	}
}

func ruleWithVersionCooldown(id string) *oapi.PolicyRule {
	return &oapi.PolicyRule{
		Id:              id,
		VersionCooldown: &oapi.VersionCooldownRule{IntervalSeconds: 300},
	}
}

func emptyRule(id string) *oapi.PolicyRule {
	return &oapi.PolicyRule{Id: id}
}

func evalTypes(evals []evaluator.Evaluator) []string {
	types := make([]string, len(evals))
	for i, e := range evals {
		types[i] = e.RuleType()
	}
	return types
}

// ---------------------------------------------------------------------------
// EnvironmentRuleEvaluators tests
// ---------------------------------------------------------------------------

func TestEnvironmentRuleEvaluators(t *testing.T) {
	t.Run("returns empty for nil rule", func(t *testing.T) {
		evals := EnvironmentRuleEvaluators(nil)
		assert.Empty(t, evals)
	})

	t.Run("returns empty for rule without deployment window", func(t *testing.T) {
		evals := EnvironmentRuleEvaluators(emptyRule("r-1"))
		assert.Empty(t, evals)
	})

	t.Run("returns empty for rule with only approval", func(t *testing.T) {
		evals := EnvironmentRuleEvaluators(ruleWithApproval("r-1"))
		assert.Empty(t, evals)
	})

	t.Run("returns empty for rule with only version cooldown", func(t *testing.T) {
		evals := EnvironmentRuleEvaluators(ruleWithVersionCooldown("r-1"))
		assert.Empty(t, evals)
	})

	t.Run("returns empty for rule with only environment progression", func(t *testing.T) {
		evals := EnvironmentRuleEvaluators(ruleWithEnvironmentProgression("r-1"))
		assert.Empty(t, evals)
	})

	t.Run("returns deployment window evaluator", func(t *testing.T) {
		evals := EnvironmentRuleEvaluators(ruleWithDeploymentWindow("r-1"))
		require.Len(t, evals, 1)
		assert.Equal(t, evaluator.RuleTypeDeploymentWindow, evals[0].RuleType())
	})

	t.Run("deployment window evaluator has correct scope fields", func(t *testing.T) {
		evals := EnvironmentRuleEvaluators(ruleWithDeploymentWindow("r-1"))
		require.Len(t, evals, 1)
		assert.NotZero(t, evals[0].ScopeFields()&evaluator.ScopeEnvironment)
	})

	t.Run("returns deployment window even when other rule types present", func(t *testing.T) {
		rule := &oapi.PolicyRule{
			Id:          "r-1",
			AnyApproval: &oapi.AnyApprovalRule{MinApprovals: 2},
			DeploymentWindow: &oapi.DeploymentWindowRule{
				Rrule:           "FREQ=DAILY;BYHOUR=10",
				DurationMinutes: 120,
			},
			VersionCooldown: &oapi.VersionCooldownRule{IntervalSeconds: 60},
		}
		evals := EnvironmentRuleEvaluators(rule)
		require.Len(t, evals, 1)
		assert.Equal(t, evaluator.RuleTypeDeploymentWindow, evals[0].RuleType())
	})

	t.Run("returns empty for deployment window with invalid rrule", func(t *testing.T) {
		rule := &oapi.PolicyRule{
			Id: "r-1",
			DeploymentWindow: &oapi.DeploymentWindowRule{
				Rrule:           "INVALID-RRULE-STRING",
				DurationMinutes: 60,
			},
		}
		evals := EnvironmentRuleEvaluators(rule)
		assert.Empty(t, evals)
	})
}

// ---------------------------------------------------------------------------
// EnvironmentVersionRuleEvaluators tests
// ---------------------------------------------------------------------------

func TestEnvironmentVersionRuleEvaluators(t *testing.T) {
	getter := &mockGetter{}

	t.Run("returns empty for nil rule", func(t *testing.T) {
		evals := EnvironmentVersionRuleEvaluators(getter, nil)
		assert.Empty(t, evals)
	})

	t.Run("returns empty for nil getter", func(t *testing.T) {
		evals := EnvironmentVersionRuleEvaluators(nil, ruleWithApproval("r-1"))
		assert.Empty(t, evals)
	})

	t.Run("returns empty for nil getter and nil rule", func(t *testing.T) {
		evals := EnvironmentVersionRuleEvaluators(nil, nil)
		assert.Empty(t, evals)
	})

	t.Run("returns empty for rule without relevant fields", func(t *testing.T) {
		evals := EnvironmentVersionRuleEvaluators(getter, emptyRule("r-1"))
		assert.Empty(t, evals)
	})

	t.Run("returns empty for rule with only deployment window", func(t *testing.T) {
		evals := EnvironmentVersionRuleEvaluators(getter, ruleWithDeploymentWindow("r-1"))
		assert.Empty(t, evals)
	})

	t.Run("returns empty for rule with only version cooldown", func(t *testing.T) {
		evals := EnvironmentVersionRuleEvaluators(getter, ruleWithVersionCooldown("r-1"))
		assert.Empty(t, evals)
	})

	t.Run("returns approval evaluator", func(t *testing.T) {
		evals := EnvironmentVersionRuleEvaluators(getter, ruleWithApproval("r-1"))
		require.Len(t, evals, 1)
		assert.Equal(t, evaluator.RuleTypeApproval, evals[0].RuleType())
	})

	t.Run("returns environment progression evaluator", func(t *testing.T) {
		evals := EnvironmentVersionRuleEvaluators(getter, ruleWithEnvironmentProgression("r-1"))
		require.Len(t, evals, 1)
		assert.Equal(t, evaluator.RuleTypeEnvironmentProgression, evals[0].RuleType())
	})

	t.Run("returns both approval and environment progression when both present", func(t *testing.T) {
		rule := &oapi.PolicyRule{
			Id:                     "r-1",
			AnyApproval:            &oapi.AnyApprovalRule{MinApprovals: 1},
			EnvironmentProgression: &oapi.EnvironmentProgressionRule{},
		}
		evals := EnvironmentVersionRuleEvaluators(getter, rule)
		require.Len(t, evals, 2)
		types := evalTypes(evals)
		assert.Contains(t, types, evaluator.RuleTypeApproval)
		assert.Contains(t, types, evaluator.RuleTypeEnvironmentProgression)
	})

	t.Run("ignores deployment window and version cooldown in same rule", func(t *testing.T) {
		rule := &oapi.PolicyRule{
			Id:          "r-1",
			AnyApproval: &oapi.AnyApprovalRule{MinApprovals: 1},
			DeploymentWindow: &oapi.DeploymentWindowRule{
				Rrule:           "FREQ=WEEKLY;BYDAY=MO",
				DurationMinutes: 30,
			},
			VersionCooldown: &oapi.VersionCooldownRule{IntervalSeconds: 60},
		}
		evals := EnvironmentVersionRuleEvaluators(getter, rule)
		types := evalTypes(evals)
		assert.NotContains(t, types, evaluator.RuleTypeDeploymentWindow)
		assert.NotContains(t, types, evaluator.RuleTypeVersionCooldown)
		assert.Contains(t, types, evaluator.RuleTypeApproval)
	})

	t.Run("approval evaluator scope includes environment and version", func(t *testing.T) {
		evals := EnvironmentVersionRuleEvaluators(getter, ruleWithApproval("r-1"))
		require.Len(t, evals, 1)
		sf := evals[0].ScopeFields()
		assert.NotZero(t, sf&evaluator.ScopeEnvironment)
		assert.NotZero(t, sf&evaluator.ScopeVersion)
	})
}

// ---------------------------------------------------------------------------
// DeploymentVersionRuleEvaluators tests
// ---------------------------------------------------------------------------

func TestDeploymentVersionRuleEvaluators(t *testing.T) {
	getter := &mockGetter{}

	t.Run("returns empty for nil rule", func(t *testing.T) {
		evals := DeploymentVersionRuleEvaluators(getter, nil)
		assert.Empty(t, evals)
	})

	t.Run("returns empty for nil getter", func(t *testing.T) {
		evals := DeploymentVersionRuleEvaluators(nil, ruleWithVersionCooldown("r-1"))
		assert.Empty(t, evals)
	})

	t.Run("returns empty for nil getter and nil rule", func(t *testing.T) {
		evals := DeploymentVersionRuleEvaluators(nil, nil)
		assert.Empty(t, evals)
	})

	t.Run("returns empty for rule without relevant fields", func(t *testing.T) {
		evals := DeploymentVersionRuleEvaluators(getter, emptyRule("r-1"))
		assert.Empty(t, evals)
	})

	t.Run("returns empty for rule with only deployment window", func(t *testing.T) {
		evals := DeploymentVersionRuleEvaluators(getter, ruleWithDeploymentWindow("r-1"))
		assert.Empty(t, evals)
	})

	t.Run("returns empty for rule with only approval", func(t *testing.T) {
		evals := DeploymentVersionRuleEvaluators(getter, ruleWithApproval("r-1"))
		assert.Empty(t, evals)
	})

	t.Run("returns empty for rule with only environment progression", func(t *testing.T) {
		evals := DeploymentVersionRuleEvaluators(getter, ruleWithEnvironmentProgression("r-1"))
		assert.Empty(t, evals)
	})

	t.Run("returns version cooldown evaluator", func(t *testing.T) {
		evals := DeploymentVersionRuleEvaluators(getter, ruleWithVersionCooldown("r-1"))
		require.Len(t, evals, 1)
		assert.Equal(t, evaluator.RuleTypeVersionCooldown, evals[0].RuleType())
	})

	t.Run("version cooldown evaluator scope includes version", func(t *testing.T) {
		evals := DeploymentVersionRuleEvaluators(getter, ruleWithVersionCooldown("r-1"))
		require.Len(t, evals, 1)
		assert.NotZero(t, evals[0].ScopeFields()&evaluator.ScopeVersion)
	})

	t.Run("ignores deployment window and approval in same rule", func(t *testing.T) {
		rule := &oapi.PolicyRule{
			Id:          "r-1",
			AnyApproval: &oapi.AnyApprovalRule{MinApprovals: 1},
			DeploymentWindow: &oapi.DeploymentWindowRule{
				Rrule:           "FREQ=WEEKLY;BYDAY=MO",
				DurationMinutes: 30,
			},
			VersionCooldown: &oapi.VersionCooldownRule{IntervalSeconds: 300},
		}
		evals := DeploymentVersionRuleEvaluators(getter, rule)
		types := evalTypes(evals)
		assert.NotContains(t, types, evaluator.RuleTypeDeploymentWindow)
		assert.NotContains(t, types, evaluator.RuleTypeApproval)
		assert.Contains(t, types, evaluator.RuleTypeVersionCooldown)
	})
}

// ---------------------------------------------------------------------------
// Cross-function isolation: each scope function only returns its own evaluators
// ---------------------------------------------------------------------------

func TestScopeIsolation(t *testing.T) {
	getter := &mockGetter{}

	rule := &oapi.PolicyRule{
		Id:          "r-all",
		AnyApproval: &oapi.AnyApprovalRule{MinApprovals: 1},
		DeploymentWindow: &oapi.DeploymentWindowRule{
			Rrule:           "FREQ=DAILY;BYHOUR=9",
			DurationMinutes: 60,
		},
		EnvironmentProgression: &oapi.EnvironmentProgressionRule{},
		VersionCooldown:        &oapi.VersionCooldownRule{IntervalSeconds: 300},
	}

	t.Run("environment scope only returns deployment window", func(t *testing.T) {
		evals := EnvironmentRuleEvaluators(rule)
		types := evalTypes(evals)
		assert.Equal(t, []string{evaluator.RuleTypeDeploymentWindow}, types)
	})

	t.Run("environment-version scope only returns approval and env progression", func(t *testing.T) {
		evals := EnvironmentVersionRuleEvaluators(getter, rule)
		types := evalTypes(evals)
		assert.Len(t, types, 2)
		assert.Contains(t, types, evaluator.RuleTypeApproval)
		assert.Contains(t, types, evaluator.RuleTypeEnvironmentProgression)
		assert.NotContains(t, types, evaluator.RuleTypeDeploymentWindow)
		assert.NotContains(t, types, evaluator.RuleTypeVersionCooldown)
	})

	t.Run("deployment-version scope only returns version cooldown", func(t *testing.T) {
		evals := DeploymentVersionRuleEvaluators(getter, rule)
		types := evalTypes(evals)
		assert.Equal(t, []string{evaluator.RuleTypeVersionCooldown}, types)
	})

	t.Run("union of all scopes covers all four evaluator types", func(t *testing.T) {
		envEvals := EnvironmentRuleEvaluators(rule)
		envVerEvals := EnvironmentVersionRuleEvaluators(getter, rule)
		depVerEvals := DeploymentVersionRuleEvaluators(getter, rule)

		all := append(append(envEvals, envVerEvals...), depVerEvals...)
		types := evalTypes(all)
		assert.Contains(t, types, evaluator.RuleTypeDeploymentWindow)
		assert.Contains(t, types, evaluator.RuleTypeApproval)
		assert.Contains(t, types, evaluator.RuleTypeEnvironmentProgression)
		assert.Contains(t, types, evaluator.RuleTypeVersionCooldown)
		assert.Len(t, types, 4)
	})
}
