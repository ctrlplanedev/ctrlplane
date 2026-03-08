package policyeval

import (
	"context"
	"errors"
	"testing"
	"time"

	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ---------------------------------------------------------------------------
// Mock evaluator
// ---------------------------------------------------------------------------

type mockEvaluator struct {
	result      *oapi.RuleEvaluation
	scopeFields evaluator.ScopeFields
	complexity  int
	ruleType    string
	ruleID      string
	calls       int
}

func (m *mockEvaluator) Evaluate(_ context.Context, _ evaluator.EvaluatorScope) *oapi.RuleEvaluation {
	m.calls++
	return m.result
}

func (m *mockEvaluator) ScopeFields() evaluator.ScopeFields { return m.scopeFields }
func (m *mockEvaluator) RuleType() string                   { return m.ruleType }
func (m *mockEvaluator) RuleId() string                     { return m.ruleID }
func (m *mockEvaluator) Complexity() int                    { return m.complexity }

func allowResult() *oapi.RuleEvaluation {
	return oapi.NewRuleEvaluation().Allow().WithMessage("allowed")
}

func denyResult() *oapi.RuleEvaluation {
	return oapi.NewRuleEvaluation().WithMessage("denied")
}

func denyWithNextTime(t time.Time) *oapi.RuleEvaluation {
	return oapi.NewRuleEvaluation().WithMessage("denied").WithNextEvaluationTime(t)
}

func version(id string) *oapi.DeploymentVersion {
	return &oapi.DeploymentVersion{Id: id}
}

func fullScope() evaluator.EvaluatorScope {
	return evaluator.EvaluatorScope{
		Environment: &oapi.Environment{Id: "env-1"},
		Version:     &oapi.DeploymentVersion{Id: "v-1"},
		Resource:    &oapi.Resource{Id: "r-1"},
		Deployment:  &oapi.Deployment{Id: "d-1"},
	}
}

// ---------------------------------------------------------------------------
// Mock getter (for CollectEvaluators / FindDeployableVersion tests)
// ---------------------------------------------------------------------------

type mockGetter struct {
	policySkips    []*oapi.PolicySkip
	policySkipsErr error
}

func (m *mockGetter) GetApprovalRecords(_ context.Context, _, _ string) ([]*oapi.UserApprovalRecord, error) {
	return nil, nil
}
func (m *mockGetter) HasCurrentRelease(_ context.Context, _ *oapi.ReleaseTarget) (bool, error) {
	return false, nil
}
func (m *mockGetter) GetPolicySkips(_ context.Context, _, _, _ string) ([]*oapi.PolicySkip, error) {
	return m.policySkips, m.policySkipsErr
}
func (m *mockGetter) GetEnvironment(_ context.Context, _ string) (*oapi.Environment, error) {
	return nil, nil
}
func (m *mockGetter) GetAllEnvironments(_ context.Context, _ string) (map[string]*oapi.Environment, error) {
	return nil, nil
}
func (m *mockGetter) GetAllDeployments(_ context.Context, _ string) (map[string]*oapi.Deployment, error) {
	return nil, nil
}
func (m *mockGetter) GetDeployment(_ context.Context, _ string) (*oapi.Deployment, error) {
	return nil, nil
}
func (m *mockGetter) GetResource(_ context.Context, _ string) (*oapi.Resource, error) {
	return nil, nil
}
func (m *mockGetter) GetRelease(_ context.Context, _ string) (*oapi.Release, error) {
	return nil, nil
}
func (m *mockGetter) GetSystemIDsForEnvironment(_ string) []string {
	return nil
}
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
func (m *mockGetter) GetJobVerificationStatus(_ string) oapi.JobVerificationStatus {
	return ""
}
func (m *mockGetter) GetAllReleaseTargets(_ context.Context, _ string) ([]*oapi.ReleaseTarget, error) {
	return nil, nil
}
func (m *mockGetter) GetReleaseTargetsForResource(_ context.Context, _ string) []*oapi.ReleaseTarget {
	return nil
}
func (m *mockGetter) GetLatestCompletedJobForReleaseTarget(_ *oapi.ReleaseTarget) *oapi.Job {
	return nil
}

// compile-time check
var _ Getter = (*mockGetter)(nil)

// ---------------------------------------------------------------------------
// evaluateVersion tests
// ---------------------------------------------------------------------------

func TestEvaluateVersion(t *testing.T) {
	ctx := context.Background()

	t.Run("passes with no evaluators", func(t *testing.T) {
		result, err := evaluateVersion(ctx, nil, fullScope(), nil)
		require.NoError(t, err)
		assert.True(t, result.Allowed())
		assert.Nil(t, result.NextEvaluationTime())
	})

	t.Run("passes when all evaluators allow", func(t *testing.T) {
		evals := []evaluator.Evaluator{
			&mockEvaluator{result: allowResult(), scopeFields: evaluator.ScopeVersion},
			&mockEvaluator{result: allowResult(), scopeFields: evaluator.ScopeVersion},
		}
		result, err := evaluateVersion(ctx, evals, fullScope(), nil)
		require.NoError(t, err)
		assert.True(t, result.Allowed())
		assert.Nil(t, result.NextEvaluationTime())
	})

	t.Run("returns all evaluations including denials", func(t *testing.T) {
		second := &mockEvaluator{result: allowResult(), scopeFields: evaluator.ScopeVersion}
		evals := []evaluator.Evaluator{
			&mockEvaluator{result: denyResult(), scopeFields: evaluator.ScopeVersion},
			second,
		}
		result, err := evaluateVersion(ctx, evals, fullScope(), nil)
		require.NoError(t, err)
		assert.False(t, result.Allowed())
	})

	t.Run("returns NextEvaluationTime from denial", func(t *testing.T) {
		nextEval := time.Date(2026, 3, 1, 12, 0, 0, 0, time.UTC)
		evals := []evaluator.Evaluator{
			&mockEvaluator{result: denyWithNextTime(nextEval), scopeFields: evaluator.ScopeVersion},
		}
		result, err := evaluateVersion(ctx, evals, fullScope(), nil)
		require.NoError(t, err)
		assert.False(t, result.Allowed())
		require.NotNil(t, result.NextEvaluationTime())
		assert.Equal(t, nextEval, *result.NextEvaluationTime())
	})

	t.Run("nil evaluator result produces empty evaluations", func(t *testing.T) {
		evals := []evaluator.Evaluator{
			&mockEvaluator{result: nil, scopeFields: evaluator.ScopeVersion},
		}
		result, err := evaluateVersion(ctx, evals, fullScope(), nil)
		require.NoError(t, err)
		assert.Empty(t, result)
	})

	t.Run("skips evaluator when scope lacks required fields", func(t *testing.T) {
		e := &mockEvaluator{result: denyResult(), scopeFields: evaluator.ScopeVersion}
		scope := evaluator.EvaluatorScope{
			Environment: &oapi.Environment{Id: "env-1"},
		}
		result, err := evaluateVersion(ctx, []evaluator.Evaluator{e}, scope, nil)
		require.NoError(t, err)
		assert.True(t, result.Allowed(), "evaluator needing Version should be skipped when Version is nil")
		assert.Equal(t, 0, e.calls)
	})

	t.Run("runs evaluator with zero scope fields regardless of scope", func(t *testing.T) {
		e := &mockEvaluator{result: allowResult(), scopeFields: 0}
		result, err := evaluateVersion(ctx, []evaluator.Evaluator{e}, evaluator.EvaluatorScope{}, nil)
		require.NoError(t, err)
		assert.True(t, result.Allowed())
		assert.Equal(t, 1, e.calls)
	})

	t.Run("collects evaluations from all evaluators", func(t *testing.T) {
		evals := []evaluator.Evaluator{
			&mockEvaluator{result: allowResult(), scopeFields: evaluator.ScopeVersion},
			&mockEvaluator{result: denyResult(), scopeFields: evaluator.ScopeVersion},
		}
		result, err := evaluateVersion(ctx, evals, fullScope(), nil)
		require.NoError(t, err)
		assert.False(t, result.Allowed())
		assert.Len(t, result, 2)
	})
}

// ---------------------------------------------------------------------------
// FindDeployableVersion tests
// ---------------------------------------------------------------------------

func TestFindDeployableVersion(t *testing.T) {
	ctx := context.Background()
	getter := &mockGetter{}
	rt := &oapi.ReleaseTarget{EnvironmentId: "env-1", ResourceId: "r-1", DeploymentId: "d-1"}

	t.Run("returns nil for empty versions", func(t *testing.T) {
		evals := []evaluator.Evaluator{
			&mockEvaluator{result: allowResult(), scopeFields: evaluator.ScopeVersion},
		}
		result, err := FindDeployableVersion(ctx, getter, rt, nil, evals, fullScope())
		require.NoError(t, err)
		assert.Nil(t, result.Version)
		assert.Nil(t, result.NextTime)
	})

	t.Run("returns first version when all evaluators allow", func(t *testing.T) {
		versions := []*oapi.DeploymentVersion{version("v1"), version("v2")}
		evals := []evaluator.Evaluator{
			&mockEvaluator{result: allowResult(), scopeFields: evaluator.ScopeVersion},
		}
		result, err := FindDeployableVersion(ctx, getter, rt, versions, evals, fullScope())
		require.NoError(t, err)
		require.NotNil(t, result.Version)
		assert.Equal(t, "v1", result.Version.Id)
		assert.Nil(t, result.NextTime)
	})

	t.Run("skips denied version and returns second", func(t *testing.T) {
		versions := []*oapi.DeploymentVersion{version("v1"), version("v2")}
		denyFirst := &conditionalEvaluator{
			scopeFields: evaluator.ScopeVersion,
			fn: func(_ context.Context, scope evaluator.EvaluatorScope) *oapi.RuleEvaluation {
				if scope.Version.Id == "v1" {
					return denyResult()
				}
				return allowResult()
			},
		}
		result, err := FindDeployableVersion(ctx, getter, rt, versions, []evaluator.Evaluator{denyFirst}, fullScope())
		require.NoError(t, err)
		require.NotNil(t, result.Version)
		assert.Equal(t, "v2", result.Version.Id)
	})

	t.Run("returns nil with earliest NextEvaluationTime when no version qualifies", func(t *testing.T) {
		early := time.Date(2026, 3, 1, 10, 0, 0, 0, time.UTC)
		late := time.Date(2026, 3, 1, 14, 0, 0, 0, time.UTC)

		e := &conditionalEvaluator{
			scopeFields: evaluator.ScopeVersion,
			fn: func(_ context.Context, scope evaluator.EvaluatorScope) *oapi.RuleEvaluation {
				if scope.Version.Id == "v1" {
					return denyWithNextTime(late)
				}
				return denyWithNextTime(early)
			},
		}
		versions := []*oapi.DeploymentVersion{version("v1"), version("v2")}
		result, err := FindDeployableVersion(ctx, getter, rt, versions, []evaluator.Evaluator{e}, fullScope())
		require.NoError(t, err)
		assert.Nil(t, result.Version)
		require.NotNil(t, result.NextTime)
		assert.Equal(t, early, *result.NextTime)
	})

	t.Run("handles mix of nil and non-nil NextEvaluationTime", func(t *testing.T) {
		theTime := time.Date(2026, 6, 15, 8, 0, 0, 0, time.UTC)

		e := &conditionalEvaluator{
			scopeFields: evaluator.ScopeVersion,
			fn: func(_ context.Context, scope evaluator.EvaluatorScope) *oapi.RuleEvaluation {
				if scope.Version.Id == "v1" {
					return denyResult()
				}
				return denyWithNextTime(theTime)
			},
		}
		versions := []*oapi.DeploymentVersion{version("v1"), version("v2")}
		result, err := FindDeployableVersion(ctx, getter, rt, versions, []evaluator.Evaluator{e}, fullScope())
		require.NoError(t, err)
		assert.Nil(t, result.Version)
		require.NotNil(t, result.NextTime)
		assert.Equal(t, theTime, *result.NextTime)
	})

	t.Run("returns nil when all denials have nil NextEvaluationTime", func(t *testing.T) {
		e := &mockEvaluator{result: denyResult(), scopeFields: evaluator.ScopeVersion}
		versions := []*oapi.DeploymentVersion{version("v1"), version("v2")}
		result, err := FindDeployableVersion(ctx, getter, rt, versions, []evaluator.Evaluator{e}, fullScope())
		require.NoError(t, err)
		assert.Nil(t, result.Version)
		assert.Nil(t, result.NextTime)
	})

	t.Run("no evaluators means every version is eligible", func(t *testing.T) {
		versions := []*oapi.DeploymentVersion{version("v1"), version("v2")}
		result, err := FindDeployableVersion(ctx, getter, rt, versions, nil, fullScope())
		require.NoError(t, err)
		require.NotNil(t, result.Version)
		assert.Equal(t, "v1", result.Version.Id)
		assert.Nil(t, result.NextTime)
	})

	t.Run("sets scope.Version for each candidate", func(t *testing.T) {
		var seen []string
		e := &conditionalEvaluator{
			scopeFields: evaluator.ScopeVersion,
			fn: func(_ context.Context, scope evaluator.EvaluatorScope) *oapi.RuleEvaluation {
				seen = append(seen, scope.Version.Id)
				return denyResult()
			},
		}
		versions := []*oapi.DeploymentVersion{version("v1"), version("v2"), version("v3")}
		_, _ = FindDeployableVersion(ctx, getter, rt, versions, []evaluator.Evaluator{e}, fullScope())
		assert.Equal(t, []string{"v1", "v2", "v3"}, seen)
	})

	t.Run("stops iterating after first eligible version", func(t *testing.T) {
		var seen []string
		e := &conditionalEvaluator{
			scopeFields: evaluator.ScopeVersion,
			fn: func(_ context.Context, scope evaluator.EvaluatorScope) *oapi.RuleEvaluation {
				seen = append(seen, scope.Version.Id)
				return allowResult()
			},
		}
		versions := []*oapi.DeploymentVersion{version("v1"), version("v2"), version("v3")}
		result, err := FindDeployableVersion(ctx, getter, rt, versions, []evaluator.Evaluator{e}, fullScope())
		require.NoError(t, err)
		require.NotNil(t, result.Version)
		assert.Equal(t, "v1", result.Version.Id)
		assert.Equal(t, []string{"v1"}, seen, "should stop after first eligible version")
	})

	t.Run("returns error when GetPolicySkips fails", func(t *testing.T) {
		errGetter := &mockGetter{policySkipsErr: errors.New("db connection failed")}
		versions := []*oapi.DeploymentVersion{version("v1")}
		evals := []evaluator.Evaluator{
			&mockEvaluator{result: allowResult(), scopeFields: evaluator.ScopeVersion},
		}
		result, err := FindDeployableVersion(ctx, errGetter, rt, versions, evals, fullScope())
		require.Error(t, err)
		assert.Nil(t, result)
		assert.Contains(t, err.Error(), "get policy skips")
	})

	t.Run("collects versioned evaluations across versions", func(t *testing.T) {
		e := &conditionalEvaluator{
			scopeFields: evaluator.ScopeVersion,
			fn: func(_ context.Context, scope evaluator.EvaluatorScope) *oapi.RuleEvaluation {
				if scope.Version.Id == "v1" {
					return denyResult()
				}
				return allowResult()
			},
		}
		versions := []*oapi.DeploymentVersion{version("v1"), version("v2")}
		result, err := FindDeployableVersion(ctx, getter, rt, versions, []evaluator.Evaluator{e}, fullScope())
		require.NoError(t, err)
		require.NotNil(t, result.Version)
		assert.Len(t, result.Evaluations, 2)
		assert.Equal(t, "v1", result.Evaluations[0].VersionID)
		assert.Equal(t, "v2", result.Evaluations[1].VersionID)
	})
}

// ---------------------------------------------------------------------------
// CollectEvaluators tests
// ---------------------------------------------------------------------------

func TestCollectEvaluators(t *testing.T) {
	ctx := context.Background()
	getter := &mockGetter{}
	rt := &oapi.ReleaseTarget{EnvironmentId: "env-1", ResourceId: "r-1", DeploymentId: "d-1"}

	t.Run("returns empty for nil policies", func(t *testing.T) {
		evals := CollectEvaluators(ctx, getter, rt, nil)
		assert.Empty(t, evals)
	})

	t.Run("skips nil policies", func(t *testing.T) {
		policies := []*oapi.Policy{nil, nil}
		evals := CollectEvaluators(ctx, getter, rt, policies)
		assert.Empty(t, evals, "should still be empty with only nil policies")
	})

	ruleWithApproval := func(id string) oapi.PolicyRule {
		return oapi.PolicyRule{
			Id:          id,
			AnyApproval: &oapi.AnyApprovalRule{MinApprovals: 1},
		}
	}

	t.Run("skips disabled policies", func(t *testing.T) {
		policies := []*oapi.Policy{
			{Id: "p1", Enabled: false, Rules: []oapi.PolicyRule{ruleWithApproval("r1")}},
		}
		evals := CollectEvaluators(ctx, getter, rt, policies)
		baseCount := len(CollectEvaluators(ctx, getter, rt, nil))
		assert.Equal(t, baseCount, len(evals), "disabled policy should add no evaluators")
	})

	t.Run("includes evaluators from enabled policies", func(t *testing.T) {
		policies := []*oapi.Policy{
			{Id: "p1", Enabled: true, Rules: []oapi.PolicyRule{ruleWithApproval("r1")}},
		}
		evals := CollectEvaluators(ctx, getter, rt, policies)
		baseCount := len(CollectEvaluators(ctx, getter, rt, nil))
		assert.Greater(t, len(evals), baseCount, "enabled policy should add evaluators")
	})

	t.Run("processes multiple enabled policies", func(t *testing.T) {
		single := []*oapi.Policy{
			{Id: "p1", Enabled: true, Rules: []oapi.PolicyRule{ruleWithApproval("r1")}},
		}
		double := []*oapi.Policy{
			{Id: "p1", Enabled: true, Rules: []oapi.PolicyRule{ruleWithApproval("r1")}},
			{Id: "p2", Enabled: true, Rules: []oapi.PolicyRule{ruleWithApproval("r2")}},
		}
		singleEvals := CollectEvaluators(ctx, getter, rt, single)
		doubleEvals := CollectEvaluators(ctx, getter, rt, double)
		assert.Greater(t, len(doubleEvals), len(singleEvals))
	})

	t.Run("sorts evaluators by ascending complexity", func(t *testing.T) {
		policies := []*oapi.Policy{
			{Id: "p1", Enabled: true, Rules: []oapi.PolicyRule{ruleWithApproval("r1")}},
		}
		evals := CollectEvaluators(ctx, getter, rt, policies)

		for i := 1; i < len(evals); i++ {
			assert.LessOrEqual(t,
				evals[i-1].Complexity(), evals[i].Complexity(),
				"evaluators should be sorted by complexity (index %d vs %d)", i-1, i,
			)
		}
	})

	t.Run("handles policy with no rules", func(t *testing.T) {
		policies := []*oapi.Policy{
			{Id: "p1", Enabled: true, Rules: []oapi.PolicyRule{}},
		}
		evals := CollectEvaluators(ctx, getter, rt, policies)
		baseCount := len(CollectEvaluators(ctx, getter, rt, nil))
		assert.Equal(t, baseCount, len(evals))
	})

	t.Run("handles empty rule (no rule-type fields) as no-op", func(t *testing.T) {
		policies := []*oapi.Policy{
			{Id: "p1", Enabled: true, Rules: []oapi.PolicyRule{{Id: "r-empty"}}},
		}
		evals := CollectEvaluators(ctx, getter, rt, policies)
		baseCount := len(CollectEvaluators(ctx, getter, rt, nil))
		assert.Equal(t, baseCount, len(evals))
	})

	t.Run("handles mix of nil, disabled, and enabled policies", func(t *testing.T) {
		policies := []*oapi.Policy{
			nil,
			{Id: "p-disabled", Enabled: false, Rules: []oapi.PolicyRule{ruleWithApproval("r1")}},
			{Id: "p-enabled", Enabled: true, Rules: []oapi.PolicyRule{ruleWithApproval("r2")}},
			nil,
		}
		enabledOnly := []*oapi.Policy{
			{Id: "p-enabled", Enabled: true, Rules: []oapi.PolicyRule{ruleWithApproval("r2")}},
		}
		mixed := CollectEvaluators(ctx, getter, rt, policies)
		clean := CollectEvaluators(ctx, getter, rt, enabledOnly)
		assert.Equal(t, len(clean), len(mixed))
	})
}

// ---------------------------------------------------------------------------
// evaluateVersion policy skip tests
// ---------------------------------------------------------------------------

func TestEvaluateVersion_PolicySkips(t *testing.T) {
	ctx := context.Background()

	t.Run("bypasses evaluator when matching skip exists", func(t *testing.T) {
		e := &mockEvaluator{result: denyResult(), scopeFields: evaluator.ScopeVersion, ruleID: "rule-1"}
		skips := []*oapi.PolicySkip{
			{Id: "skip-1", RuleId: "rule-1", VersionId: "v-1", CreatedAt: time.Now()},
		}
		result, err := evaluateVersion(ctx, []evaluator.Evaluator{e}, fullScope(), skips)
		require.NoError(t, err)
		assert.True(t, result.Allowed())
		assert.Nil(t, result.NextEvaluationTime())
		assert.Equal(t, 0, e.calls, "evaluator should not be called when skip matches")
	})

	t.Run("does not bypass evaluator when no matching skip", func(t *testing.T) {
		e := &mockEvaluator{result: denyResult(), scopeFields: evaluator.ScopeVersion, ruleID: "rule-1"}
		skips := []*oapi.PolicySkip{
			{Id: "skip-1", RuleId: "rule-other", VersionId: "v-1", CreatedAt: time.Now()},
		}
		result, err := evaluateVersion(ctx, []evaluator.Evaluator{e}, fullScope(), skips)
		require.NoError(t, err)
		assert.False(t, result.Allowed())
		assert.Equal(t, 1, e.calls)
	})

	t.Run("ignores expired skips", func(t *testing.T) {
		e := &mockEvaluator{result: denyResult(), scopeFields: evaluator.ScopeVersion, ruleID: "rule-1"}
		expiredAt := time.Now().Add(-1 * time.Hour)
		skips := []*oapi.PolicySkip{
			{Id: "skip-1", RuleId: "rule-1", VersionId: "v-1", CreatedAt: time.Now(), ExpiresAt: &expiredAt},
		}
		result, err := evaluateVersion(ctx, []evaluator.Evaluator{e}, fullScope(), skips)
		require.NoError(t, err)
		assert.False(t, result.Allowed())
		assert.Equal(t, 1, e.calls, "expired skip should not bypass evaluator")
	})

	t.Run("only matching rule is skipped, others still evaluate", func(t *testing.T) {
		skippedEval := &mockEvaluator{result: denyResult(), scopeFields: evaluator.ScopeVersion, ruleID: "rule-1"}
		normalEval := &mockEvaluator{result: allowResult(), scopeFields: evaluator.ScopeVersion, ruleID: "rule-2"}
		skips := []*oapi.PolicySkip{
			{Id: "skip-1", RuleId: "rule-1", VersionId: "v-1", CreatedAt: time.Now()},
		}
		result, err := evaluateVersion(ctx, []evaluator.Evaluator{skippedEval, normalEval}, fullScope(), skips)
		require.NoError(t, err)
		assert.True(t, result.Allowed())
		assert.Equal(t, 0, skippedEval.calls, "skipped evaluator should not be called")
		assert.Equal(t, 1, normalEval.calls, "non-skipped evaluator should still be called")
	})

	t.Run("nil skips behaves like no skips", func(t *testing.T) {
		e := &mockEvaluator{result: denyResult(), scopeFields: evaluator.ScopeVersion, ruleID: "rule-1"}
		result, err := evaluateVersion(ctx, []evaluator.Evaluator{e}, fullScope(), nil)
		require.NoError(t, err)
		assert.False(t, result.Allowed())
		assert.Equal(t, 1, e.calls)
	})

	t.Run("skip with ExpiresAt sets NextEvaluationTime on evaluation", func(t *testing.T) {
		e := &mockEvaluator{result: denyResult(), scopeFields: evaluator.ScopeVersion, ruleID: "rule-1"}
		expiresAt := time.Now().Add(2 * time.Hour)
		skips := []*oapi.PolicySkip{
			{Id: "skip-1", RuleId: "rule-1", VersionId: "v-1", CreatedAt: time.Now(), ExpiresAt: &expiresAt},
		}
		result, err := evaluateVersion(ctx, []evaluator.Evaluator{e}, fullScope(), skips)
		require.NoError(t, err)
		assert.True(t, result.Allowed())
		require.Len(t, result, 1)
		require.NotNil(t, result[0].NextEvaluationTime)
		assert.Equal(t, expiresAt, *result[0].NextEvaluationTime)
		assert.Equal(t, 0, e.calls, "evaluator should not be called when skip matches")
	})

	t.Run("skip without ExpiresAt does not set NextEvaluationTime", func(t *testing.T) {
		e := &mockEvaluator{result: denyResult(), scopeFields: evaluator.ScopeVersion, ruleID: "rule-1"}
		skips := []*oapi.PolicySkip{
			{Id: "skip-1", RuleId: "rule-1", VersionId: "v-1", CreatedAt: time.Now()},
		}
		result, err := evaluateVersion(ctx, []evaluator.Evaluator{e}, fullScope(), skips)
		require.NoError(t, err)
		assert.True(t, result.Allowed())
		require.Len(t, result, 1)
		assert.Nil(t, result[0].NextEvaluationTime)
	})
}

// ---------------------------------------------------------------------------
// FindDeployableVersion policy skip tests
// ---------------------------------------------------------------------------

func TestFindDeployableVersion_PolicySkips(t *testing.T) {
	ctx := context.Background()
	rt := &oapi.ReleaseTarget{EnvironmentId: "env-1", ResourceId: "r-1", DeploymentId: "d-1"}

	t.Run("skip allows denied version to pass", func(t *testing.T) {
		skipGetter := &mockGetter{
			policySkips: []*oapi.PolicySkip{
				{Id: "skip-1", RuleId: "rule-1", VersionId: "v1", CreatedAt: time.Now()},
			},
		}
		e := &mockEvaluator{result: denyResult(), scopeFields: evaluator.ScopeVersion, ruleID: "rule-1"}
		versions := []*oapi.DeploymentVersion{version("v1")}
		result, err := FindDeployableVersion(ctx, skipGetter, rt, versions, []evaluator.Evaluator{e}, fullScope())
		require.NoError(t, err)
		require.NotNil(t, result.Version)
		assert.Equal(t, "v1", result.Version.Id)
	})

	t.Run("no skips means denied version is blocked", func(t *testing.T) {
		noSkipGetter := &mockGetter{}
		e := &mockEvaluator{result: denyResult(), scopeFields: evaluator.ScopeVersion, ruleID: "rule-1"}
		versions := []*oapi.DeploymentVersion{version("v1")}
		result, err := FindDeployableVersion(ctx, noSkipGetter, rt, versions, []evaluator.Evaluator{e}, fullScope())
		require.NoError(t, err)
		assert.Nil(t, result.Version)
	})
}

// ---------------------------------------------------------------------------
// buildSkipSet tests
// ---------------------------------------------------------------------------

func TestBuildSkipSet(t *testing.T) {
	t.Run("returns empty set for nil skips", func(t *testing.T) {
		set := buildSkipSet(nil)
		assert.Empty(t, set)
	})

	t.Run("includes non-expired skips", func(t *testing.T) {
		skips := []*oapi.PolicySkip{
			{Id: "s1", RuleId: "rule-a", CreatedAt: time.Now()},
			{Id: "s2", RuleId: "rule-b", CreatedAt: time.Now()},
		}
		set := buildSkipSet(skips)
		_, hasA := set["rule-a"]
		_, hasB := set["rule-b"]
		assert.True(t, hasA)
		assert.True(t, hasB)
	})

	t.Run("excludes expired skips", func(t *testing.T) {
		expired := time.Now().Add(-1 * time.Hour)
		skips := []*oapi.PolicySkip{
			{Id: "s1", RuleId: "rule-a", CreatedAt: time.Now()},
			{Id: "s2", RuleId: "rule-b", CreatedAt: time.Now(), ExpiresAt: &expired},
		}
		set := buildSkipSet(skips)
		_, hasA := set["rule-a"]
		_, hasB := set["rule-b"]
		assert.True(t, hasA)
		assert.False(t, hasB)
	})
}

// ---------------------------------------------------------------------------
// Conditional evaluator (version-dependent mock)
// ---------------------------------------------------------------------------

type conditionalEvaluator struct {
	scopeFields evaluator.ScopeFields
	complexity  int
	fn          func(context.Context, evaluator.EvaluatorScope) *oapi.RuleEvaluation
}

func (c *conditionalEvaluator) Evaluate(ctx context.Context, scope evaluator.EvaluatorScope) *oapi.RuleEvaluation {
	return c.fn(ctx, scope)
}
func (c *conditionalEvaluator) ScopeFields() evaluator.ScopeFields { return c.scopeFields }
func (c *conditionalEvaluator) RuleType() string                   { return "mock" }
func (c *conditionalEvaluator) RuleId() string                     { return "mock" }
func (c *conditionalEvaluator) Complexity() int                    { return c.complexity }
