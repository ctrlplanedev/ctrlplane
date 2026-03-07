package summaryeval

import (
	"context"
	"testing"

	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator"

	"github.com/google/uuid"
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
func (m *mockGetter) GetAllReleaseTargets(_ context.Context, _ string) ([]*oapi.ReleaseTarget, error) {
	return nil, nil
}
func (m *mockGetter) GetJobVerificationStatus(_ string) oapi.JobVerificationStatus {
	return oapi.JobVerificationStatusCancelled
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
// RuleEvaluators tests
// ---------------------------------------------------------------------------

func TestRuleEvaluators(t *testing.T) {
	getter := &mockGetter{}
	wsId := uuid.New().String()

	t.Run("returns empty for nil rule", func(t *testing.T) {
		evals := RuleEvaluators(getter, wsId, nil)
		assert.Empty(t, evals)
	})

	t.Run("returns empty for nil getter with non-nil rule", func(t *testing.T) {
		evals := RuleEvaluators(nil, wsId, ruleWithApproval("r-1"))
		// deployment window doesn't need a getter, so it may still return
		// but approval/envprogression/cooldown need a getter and return nil
		for _, e := range evals {
			assert.NotEqual(t, evaluator.RuleTypeApproval, e.RuleType())
			assert.NotEqual(t, evaluator.RuleTypeEnvironmentProgression, e.RuleType())
			assert.NotEqual(t, evaluator.RuleTypeVersionCooldown, e.RuleType())
		}
	})

	t.Run("returns empty for rule without relevant fields", func(t *testing.T) {
		evals := RuleEvaluators(getter, wsId, emptyRule("r-1"))
		assert.Empty(t, evals)
	})

	t.Run("returns deployment window evaluator", func(t *testing.T) {
		evals := RuleEvaluators(getter, wsId, ruleWithDeploymentWindow("r-1"))
		require.Len(t, evals, 1)
		assert.Equal(t, evaluator.RuleTypeDeploymentWindow, evals[0].RuleType())
	})

	t.Run("returns approval evaluator", func(t *testing.T) {
		evals := RuleEvaluators(getter, wsId, ruleWithApproval("r-1"))
		require.Len(t, evals, 1)
		assert.Equal(t, evaluator.RuleTypeApproval, evals[0].RuleType())
	})

	t.Run("returns environment progression evaluator", func(t *testing.T) {
		evals := RuleEvaluators(getter, wsId, ruleWithEnvironmentProgression("r-1"))
		require.Len(t, evals, 1)
		assert.Equal(t, evaluator.RuleTypeEnvironmentProgression, evals[0].RuleType())
	})

	t.Run("returns version cooldown evaluator", func(t *testing.T) {
		evals := RuleEvaluators(getter, wsId, ruleWithVersionCooldown("r-1"))
		require.Len(t, evals, 1)
		assert.Equal(t, evaluator.RuleTypeVersionCooldown, evals[0].RuleType())
	})

	t.Run("returns all evaluators for rule with all fields", func(t *testing.T) {
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
		evals := RuleEvaluators(getter, wsId, rule)
		types := evalTypes(evals)
		assert.Contains(t, types, evaluator.RuleTypeDeploymentWindow)
		assert.Contains(t, types, evaluator.RuleTypeApproval)
		assert.Contains(t, types, evaluator.RuleTypeEnvironmentProgression)
		assert.Contains(t, types, evaluator.RuleTypeVersionCooldown)
		assert.Len(t, types, 4)
	})
}
