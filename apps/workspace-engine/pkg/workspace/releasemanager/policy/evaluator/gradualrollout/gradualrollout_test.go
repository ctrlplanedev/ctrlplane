package gradualrollout

import (
	"context"
	"fmt"
	"strconv"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator"
)

// mockGetters implements the full Getters interface for testing.
type mockGetters struct {
	resources       map[string]*oapi.Resource
	releaseTargets  []*oapi.ReleaseTarget
	policies        []*oapi.Policy
	policySkips     []*oapi.PolicySkip
	hasRelease      bool
	approvalRecords []*oapi.UserApprovalRecord

	environments   map[string]*oapi.Environment
	deployments    map[string]*oapi.Deployment
	releases       map[string]*oapi.Release
	systemIDs      map[string][]string
	rtByDepAndEnv  map[string][]oapi.ReleaseTarget
	jobsByRT       map[string]map[string]*oapi.Job
	allPolicies    map[string]*oapi.Policy
	releaseByJobID map[string]*oapi.Release
}

func newMockGetters() *mockGetters {
	return &mockGetters{
		resources:      make(map[string]*oapi.Resource),
		environments:   make(map[string]*oapi.Environment),
		deployments:    make(map[string]*oapi.Deployment),
		releases:       make(map[string]*oapi.Release),
		systemIDs:      make(map[string][]string),
		rtByDepAndEnv:  make(map[string][]oapi.ReleaseTarget),
		jobsByRT:       make(map[string]map[string]*oapi.Job),
		allPolicies:    make(map[string]*oapi.Policy),
		releaseByJobID: make(map[string]*oapi.Release),
	}
}

func (m *mockGetters) GetApprovalRecords(_ context.Context, _, _ string) ([]*oapi.UserApprovalRecord, error) {
	return m.approvalRecords, nil
}

func (m *mockGetters) GetEnvironment(_ context.Context, envID string) (*oapi.Environment, error) {
	if env, ok := m.environments[envID]; ok {
		return env, nil
	}
	return nil, fmt.Errorf("environment not found: %s", envID)
}

func (m *mockGetters) GetAllEnvironments(_ context.Context, _ string) (map[string]*oapi.Environment, error) {
	return m.environments, nil
}

func (m *mockGetters) GetAllDeployments(_ context.Context, _ string) (map[string]*oapi.Deployment, error) {
	return m.deployments, nil
}

func (m *mockGetters) GetDeployment(_ context.Context, depID string) (*oapi.Deployment, error) {
	if dep, ok := m.deployments[depID]; ok {
		return dep, nil
	}
	return nil, fmt.Errorf("deployment not found: %s", depID)
}

func (m *mockGetters) GetResource(_ context.Context, resID string) (*oapi.Resource, error) {
	if res, ok := m.resources[resID]; ok {
		return res, nil
	}
	return nil, fmt.Errorf("resource not found: %s", resID)
}

func (m *mockGetters) GetRelease(_ context.Context, relID string) (*oapi.Release, error) {
	if rel, ok := m.releases[relID]; ok {
		return rel, nil
	}
	return nil, fmt.Errorf("release not found: %s", relID)
}

func (m *mockGetters) GetReleaseTargetsForDeploymentAndEnvironment(_ context.Context, depID, envID string) ([]oapi.ReleaseTarget, error) {
	key := depID + "/" + envID
	return m.rtByDepAndEnv[key], nil
}

func (m *mockGetters) GetSystemIDsForEnvironment(envID string) []string {
	return m.systemIDs[envID]
}

func (m *mockGetters) GetReleaseTargetsForDeployment(_ context.Context, _ string) ([]*oapi.ReleaseTarget, error) {
	return m.releaseTargets, nil
}

func (m *mockGetters) GetJobsForReleaseTarget(_ context.Context, rt *oapi.ReleaseTarget) map[string]*oapi.Job {
	key := rt.DeploymentId + "/" + rt.EnvironmentId + "/" + rt.ResourceId
	return m.jobsByRT[key]
}

func (m *mockGetters) GetAllPolicies(_ context.Context, _ string) (map[string]*oapi.Policy, error) {
	return m.allPolicies, nil
}

func (m *mockGetters) GetReleaseByJobID(_ context.Context, jobID string) (*oapi.Release, error) {
	if rel, ok := m.releaseByJobID[jobID]; ok {
		return rel, nil
	}
	return nil, fmt.Errorf("release not found for job: %s", jobID)
}

func (m *mockGetters) GetPoliciesForReleaseTarget(_ context.Context, _ *oapi.ReleaseTarget) ([]*oapi.Policy, error) {
	return m.policies, nil
}

func (m *mockGetters) GetPolicySkips(_ context.Context, _, _, _ string) ([]*oapi.PolicySkip, error) {
	return m.policySkips, nil
}

func (m *mockGetters) HasCurrentRelease(_ context.Context, _ *oapi.ReleaseTarget) (bool, error) {
	return m.hasRelease, nil
}

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

func boolPtr(b bool) *bool       { return &b }
func stringPtr(s string) *string { return &s }

func makeResources(n int) ([]*oapi.Resource, map[string]*oapi.Resource) {
	resources := make([]*oapi.Resource, n)
	resourceMap := make(map[string]*oapi.Resource, n)
	for i := range n {
		r := &oapi.Resource{
			Id:         uuid.New().String(),
			Identifier: fmt.Sprintf("test-resource-%d", i),
			Kind:       "service",
		}
		resources[i] = r
		resourceMap[r.Id] = r
	}
	return resources, resourceMap
}

func makeReleaseTargets(envID, depID string, resources []*oapi.Resource) []*oapi.ReleaseTarget {
	rts := make([]*oapi.ReleaseTarget, len(resources))
	for i, r := range resources {
		rts[i] = &oapi.ReleaseTarget{
			EnvironmentId: envID,
			DeploymentId:  depID,
			ResourceId:    r.Id,
		}
	}
	return rts
}

// deterministicHashingFn returns a hashing function that uses the resource
// identifier's numeric suffix as the hash, giving a deterministic ordering.
func deterministicHashingFn(resourceMap map[string]*oapi.Resource) func(*oapi.ReleaseTarget, string) (uint64, error) {
	return func(rt *oapi.ReleaseTarget, _ string) (uint64, error) {
		res, ok := resourceMap[rt.ResourceId]
		if !ok {
			return 0, fmt.Errorf("resource not found: %s", rt.ResourceId)
		}
		numStr := res.Identifier[len("test-resource-"):]
		num, err := strconv.Atoi(numStr)
		if err != nil {
			return 0, err
		}
		return uint64(num), nil
	}
}

func createGradualRolloutRule(
	rolloutType oapi.GradualRolloutRuleRolloutType,
	timeScaleInterval int32,
) *oapi.PolicyRule {
	return &oapi.PolicyRule{
		Id: "gradualRollout",
		GradualRollout: &oapi.GradualRolloutRule{
			RolloutType:       rolloutType,
			TimeScaleInterval: timeScaleInterval,
		},
	}
}

type testSetup struct {
	ctx            context.Context
	mock           *mockGetters
	environment    *oapi.Environment
	deployment     *oapi.Deployment
	version        *oapi.DeploymentVersion
	resources      []*oapi.Resource
	releaseTargets []*oapi.ReleaseTarget
	hashingFn      func(*oapi.ReleaseTarget, string) (uint64, error)
}

func newTestSetup(numResources int, baseTime time.Time) *testSetup {
	resources, resourceMap := makeResources(numResources)
	env := &oapi.Environment{Id: uuid.New().String(), Name: "test-env"}
	dep := &oapi.Deployment{Id: uuid.New().String(), Name: "test-deployment"}
	version := &oapi.DeploymentVersion{
		Id:           uuid.New().String(),
		DeploymentId: dep.Id,
		Tag:          "v1",
		CreatedAt:    baseTime,
	}
	rts := makeReleaseTargets(env.Id, dep.Id, resources)

	mock := newMockGetters()
	mock.resources = resourceMap
	mock.releaseTargets = rts

	return &testSetup{
		ctx:            context.Background(),
		mock:           mock,
		environment:    env,
		deployment:     dep,
		version:        version,
		resources:      resources,
		releaseTargets: rts,
		hashingFn:      deterministicHashingFn(resourceMap),
	}
}

func (ts *testSetup) scope(i int) evaluator.EvaluatorScope {
	return evaluator.EvaluatorScope{
		Environment: ts.environment,
		Version:     ts.version,
		Resource:    &oapi.Resource{Id: ts.releaseTargets[i].ResourceId},
		Deployment:  &oapi.Deployment{Id: ts.releaseTargets[i].DeploymentId},
	}
}

func (ts *testSetup) eval(rule *oapi.PolicyRule, timeGetter func() time.Time) GradualRolloutEvaluator {
	return GradualRolloutEvaluator{
		getters:    ts.mock,
		ruleId:     rule.Id,
		rule:       rule.GradualRollout,
		hashingFn:  ts.hashingFn,
		timeGetter: timeGetter,
	}
}

func countAllowedTargets(
	ctx context.Context,
	t *testing.T,
	eval GradualRolloutEvaluator,
	environment *oapi.Environment,
	version *oapi.DeploymentVersion,
	releaseTargets []*oapi.ReleaseTarget,
) int {
	t.Helper()
	count := 0
	for _, rt := range releaseTargets {
		scope := evaluator.EvaluatorScope{
			Environment: environment,
			Version:     version,
			Resource:    &oapi.Resource{Id: rt.ResourceId},
			Deployment:  &oapi.Deployment{Id: rt.DeploymentId},
		}
		if eval.Evaluate(ctx, scope).Allowed {
			count++
		}
	}
	return count
}

// ---------------------------------------------------------------------------
// Tests: Linear rollout
// ---------------------------------------------------------------------------

func TestGradualRolloutEvaluator_LinearRollout(t *testing.T) {
	baseTime := time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC)
	ts := newTestSetup(3, baseTime)

	threeMinLater := baseTime.Add(3 * time.Minute)
	rule := createGradualRolloutRule(oapi.GradualRolloutRuleRolloutTypeLinear, 60)
	eval := ts.eval(rule, func() time.Time { return threeMinLater })

	result0 := eval.Evaluate(ts.ctx, ts.scope(0))
	assert.True(t, result0.Allowed, "position 0 should deploy immediately")
	assert.Equal(t, int32(0), result0.Details["target_rollout_position"])
	assert.Equal(t, baseTime.Format(time.RFC3339), result0.Details["target_rollout_time"])

	result1 := eval.Evaluate(ts.ctx, ts.scope(1))
	assert.True(t, result1.Allowed, "position 1 should deploy after 60 seconds")
	assert.Equal(t, int32(1), result1.Details["target_rollout_position"])
	assert.Equal(t, baseTime.Add(60*time.Second).Format(time.RFC3339), result1.Details["target_rollout_time"])

	result2 := eval.Evaluate(ts.ctx, ts.scope(2))
	assert.True(t, result2.Allowed, "position 2 should deploy after 120 seconds")
	assert.Equal(t, int32(2), result2.Details["target_rollout_position"])
	assert.Equal(t, baseTime.Add(120*time.Second).Format(time.RFC3339), result2.Details["target_rollout_time"])
}

func TestGradualRolloutEvaluator_LinearRollout_Pending(t *testing.T) {
	baseTime := time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC)
	ts := newTestSetup(3, baseTime)

	thirtySecLater := baseTime.Add(30 * time.Second)
	rule := createGradualRolloutRule(oapi.GradualRolloutRuleRolloutTypeLinear, 60)
	eval := ts.eval(rule, func() time.Time { return thirtySecLater })

	result0 := eval.Evaluate(ts.ctx, ts.scope(0))
	assert.True(t, result0.Allowed)

	result1 := eval.Evaluate(ts.ctx, ts.scope(1))
	assert.False(t, result1.Allowed)
	assert.True(t, result1.ActionRequired)
	require.NotNil(t, result1.ActionType)
	assert.Equal(t, oapi.Wait, *result1.ActionType)
	assert.Equal(t, int32(1), result1.Details["target_rollout_position"])

	result2 := eval.Evaluate(ts.ctx, ts.scope(2))
	assert.False(t, result2.Allowed)
	assert.True(t, result2.ActionRequired)
	require.NotNil(t, result2.ActionType)
	assert.Equal(t, oapi.Wait, *result2.ActionType)
	assert.Equal(t, int32(2), result2.Details["target_rollout_position"])
}

func TestGradualRolloutEvaluator_LinearNormalizedRollout(t *testing.T) {
	baseTime := time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC)
	ts := newTestSetup(3, baseTime)

	twoMinLater := baseTime.Add(2 * time.Minute)
	rule := createGradualRolloutRule(oapi.GradualRolloutRuleRolloutTypeLinearNormalized, 60)
	eval := ts.eval(rule, func() time.Time { return twoMinLater })

	result0 := eval.Evaluate(ts.ctx, ts.scope(0))
	assert.True(t, result0.Allowed)
	assert.Equal(t, int32(0), result0.Details["target_rollout_position"])
	assert.Equal(t, baseTime.Format(time.RFC3339), result0.Details["target_rollout_time"])

	result1 := eval.Evaluate(ts.ctx, ts.scope(1))
	assert.True(t, result1.Allowed)
	assert.Equal(t, int32(1), result1.Details["target_rollout_position"])
	assert.Equal(t, baseTime.Add(20*time.Second).Format(time.RFC3339), result1.Details["target_rollout_time"])

	result2 := eval.Evaluate(ts.ctx, ts.scope(2))
	assert.True(t, result2.Allowed)
	assert.Equal(t, int32(2), result2.Details["target_rollout_position"])
	assert.Equal(t, baseTime.Add(40*time.Second).Format(time.RFC3339), result2.Details["target_rollout_time"])
}

func TestGradualRolloutEvaluator_ZeroTimeScaleIntervalStartsImmediately(t *testing.T) {
	baseTime := time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC)
	ts := newTestSetup(3, baseTime)

	oneHourLater := baseTime.Add(1 * time.Hour)
	rule := createGradualRolloutRule(oapi.GradualRolloutRuleRolloutTypeLinear, 0)
	eval := ts.eval(rule, func() time.Time { return oneHourLater })

	for i, rt := range ts.releaseTargets {
		scope := evaluator.EvaluatorScope{
			Environment: ts.environment,
			Version:     ts.version,
			Resource:    &oapi.Resource{Id: rt.ResourceId},
			Deployment:  &oapi.Deployment{Id: rt.DeploymentId},
		}
		result := eval.Evaluate(ts.ctx, scope)
		assert.True(t, result.Allowed, "position %d should deploy immediately", i)
		assert.Equal(t, int32(i), result.Details["target_rollout_position"])
		assert.Equal(t, baseTime.Format(time.RFC3339), result.Details["target_rollout_time"])
	}
}

// ---------------------------------------------------------------------------
// Tests: Approval rules
// ---------------------------------------------------------------------------

func TestGradualRolloutEvaluator_UnsatisfiedApprovalRequirement(t *testing.T) {
	baseTime := time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC)
	ts := newTestSetup(3, baseTime)

	ts.mock.policies = []*oapi.Policy{{
		Enabled:   true,
		Selector:  "true",
		CreatedAt: baseTime.Add(-1 * time.Hour).Format(time.RFC3339),
		Rules: []oapi.PolicyRule{{
			AnyApproval: &oapi.AnyApprovalRule{MinApprovals: 2},
		}},
	}}
	ts.mock.approvalRecords = []*oapi.UserApprovalRecord{{
		UserId:    "user-1",
		CreatedAt: baseTime.Format(time.RFC3339),
		Status:    oapi.ApprovalStatusApproved,
	}}

	twoHoursLater := baseTime.Add(2 * time.Hour)
	rule := createGradualRolloutRule(oapi.GradualRolloutRuleRolloutTypeLinear, 60)
	eval := ts.eval(rule, func() time.Time { return twoHoursLater })

	for _, rt := range ts.releaseTargets {
		scope := evaluator.EvaluatorScope{
			Environment: ts.environment,
			Version:     ts.version,
			Resource:    &oapi.Resource{Id: rt.ResourceId},
			Deployment:  &oapi.Deployment{Id: rt.DeploymentId},
		}
		result := eval.Evaluate(ts.ctx, scope)
		assert.False(t, result.Allowed)
		assert.True(t, result.ActionRequired)
		require.NotNil(t, result.ActionType)
		assert.Equal(t, oapi.Wait, *result.ActionType)
		assert.Equal(t, "Rollout has not started yet", result.Message)
		assert.Nil(t, result.Details["rollout_start_time"])
		assert.Nil(t, result.Details["target_rollout_time"])
	}
}

func TestGradualRolloutEvaluator_SatisfiedApprovalRequirement(t *testing.T) {
	baseTime := time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC)
	oneHourLater := baseTime.Add(1 * time.Hour)
	twoHoursLater := baseTime.Add(2 * time.Hour)
	ts := newTestSetup(3, baseTime)

	ts.mock.policies = []*oapi.Policy{{
		Enabled:  true,
		Selector: "true",
		Rules: []oapi.PolicyRule{{
			AnyApproval: &oapi.AnyApprovalRule{MinApprovals: 2},
		}},
	}}
	ts.mock.approvalRecords = []*oapi.UserApprovalRecord{
		{UserId: "user-1", CreatedAt: baseTime.Format(time.RFC3339), Status: oapi.ApprovalStatusApproved},
		{UserId: "user-2", CreatedAt: oneHourLater.Format(time.RFC3339), Status: oapi.ApprovalStatusApproved},
		{UserId: "user-3", CreatedAt: twoHoursLater.Format(time.RFC3339), Status: oapi.ApprovalStatusApproved},
	}

	rule := createGradualRolloutRule(oapi.GradualRolloutRuleRolloutTypeLinear, 60)
	eval := ts.eval(rule, func() time.Time { return twoHoursLater })

	result0 := eval.Evaluate(ts.ctx, ts.scope(0))
	assert.True(t, result0.Allowed)
	assert.Equal(t, int32(0), result0.Details["target_rollout_position"])
	assert.Equal(t, oneHourLater.Format(time.RFC3339), result0.Details["rollout_start_time"])
	assert.Equal(t, oneHourLater.Format(time.RFC3339), result0.Details["target_rollout_time"])

	result1 := eval.Evaluate(ts.ctx, ts.scope(1))
	assert.True(t, result1.Allowed)
	assert.Equal(t, int32(1), result1.Details["target_rollout_position"])
	assert.Equal(t, oneHourLater.Format(time.RFC3339), result1.Details["rollout_start_time"])
	assert.Equal(t, oneHourLater.Add(60*time.Second).Format(time.RFC3339), result1.Details["target_rollout_time"])

	result2 := eval.Evaluate(ts.ctx, ts.scope(2))
	assert.True(t, result2.Allowed)
	assert.Equal(t, int32(2), result2.Details["target_rollout_position"])
	assert.Equal(t, oneHourLater.Format(time.RFC3339), result2.Details["rollout_start_time"])
	assert.Equal(t, oneHourLater.Add(120*time.Second).Format(time.RFC3339), result2.Details["target_rollout_time"])
}

func TestGradualRolloutEvaluator_IfApprovalPolicySkipped_RolloutStartsImmediately(t *testing.T) {
	baseTime := time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC)
	twoHoursLater := baseTime.Add(2 * time.Hour)
	ts := newTestSetup(3, baseTime)

	ts.mock.policies = []*oapi.Policy{{
		Enabled:  true,
		Selector: "true",
		Rules: []oapi.PolicyRule{{
			Id:          "approval-rule",
			AnyApproval: &oapi.AnyApprovalRule{MinApprovals: 2},
		}},
	}}
	ts.mock.policySkips = []*oapi.PolicySkip{{
		RuleId:        "approval-rule",
		VersionId:     ts.version.Id,
		EnvironmentId: &ts.environment.Id,
		CreatedBy:     "test-user",
		CreatedAt:     baseTime,
	}}

	rule := createGradualRolloutRule(oapi.GradualRolloutRuleRolloutTypeLinear, 60)
	eval := ts.eval(rule, func() time.Time { return twoHoursLater })

	result0 := eval.Evaluate(ts.ctx, ts.scope(0))
	assert.True(t, result0.Allowed)
	assert.Equal(t, int32(0), result0.Details["target_rollout_position"])
	assert.Equal(t, baseTime.Format(time.RFC3339), result0.Details["rollout_start_time"])
	assert.Equal(t, baseTime.Format(time.RFC3339), result0.Details["target_rollout_time"])

	result1 := eval.Evaluate(ts.ctx, ts.scope(1))
	assert.True(t, result1.Allowed)
	assert.Equal(t, int32(1), result1.Details["target_rollout_position"])
	assert.Equal(t, baseTime.Add(60*time.Second).Format(time.RFC3339), result1.Details["target_rollout_time"])

	result2 := eval.Evaluate(ts.ctx, ts.scope(2))
	assert.True(t, result2.Allowed)
	assert.Equal(t, int32(2), result2.Details["target_rollout_position"])
	assert.Equal(t, baseTime.Add(120*time.Second).Format(time.RFC3339), result2.Details["target_rollout_time"])
}

func TestGradualRolloutEvaluator_IfEnvironmentProgressionPolicySkipped_RolloutStartsImmediately(t *testing.T) {
	baseTime := time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC)
	twoHoursLater := baseTime.Add(2 * time.Hour)
	ts := newTestSetup(3, baseTime)

	selector := oapi.Selector{}
	require.NoError(t, selector.FromCelSelector(oapi.CelSelector{Cel: "environment.name == 'staging'"}))

	minSuccess := float32(100.0)
	ts.mock.policies = []*oapi.Policy{{
		Enabled:  true,
		Selector: "true",
		Rules: []oapi.PolicyRule{{
			Id: "env-prog-rule",
			EnvironmentProgression: &oapi.EnvironmentProgressionRule{
				DependsOnEnvironmentSelector: selector,
				MinimumSuccessPercentage:     &minSuccess,
			},
		}},
	}}
	ts.mock.policySkips = []*oapi.PolicySkip{{
		RuleId:        "env-prog-rule",
		VersionId:     ts.version.Id,
		EnvironmentId: &ts.environment.Id,
		CreatedBy:     "test-user",
		CreatedAt:     baseTime,
	}}

	rule := createGradualRolloutRule(oapi.GradualRolloutRuleRolloutTypeLinear, 60)
	eval := ts.eval(rule, func() time.Time { return twoHoursLater })

	result0 := eval.Evaluate(ts.ctx, ts.scope(0))
	assert.True(t, result0.Allowed)
	assert.Equal(t, int32(0), result0.Details["target_rollout_position"])
	assert.Equal(t, baseTime.Format(time.RFC3339), result0.Details["rollout_start_time"])

	result1 := eval.Evaluate(ts.ctx, ts.scope(1))
	assert.True(t, result1.Allowed)
	assert.Equal(t, baseTime.Add(60*time.Second).Format(time.RFC3339), result1.Details["target_rollout_time"])

	result2 := eval.Evaluate(ts.ctx, ts.scope(2))
	assert.True(t, result2.Allowed)
	assert.Equal(t, baseTime.Add(120*time.Second).Format(time.RFC3339), result2.Details["target_rollout_time"])
}

// ---------------------------------------------------------------------------
// Tests: Environment progression (via skip mechanism for controlled start times)
// ---------------------------------------------------------------------------

func TestGradualRolloutEvaluator_EnvironmentProgressionSkip_SatisfiedAt(t *testing.T) {
	baseTime := time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC)
	skipTime := baseTime.Add(1 * time.Hour)
	ts := newTestSetup(3, baseTime)

	selector := oapi.Selector{}
	require.NoError(t, selector.FromCelSelector(oapi.CelSelector{Cel: "environment.name == 'staging'"}))

	minSuccess := float32(100.0)
	ts.mock.policies = []*oapi.Policy{{
		Enabled:  true,
		Selector: "true",
		Rules: []oapi.PolicyRule{{
			Id: "env-prog-rule",
			EnvironmentProgression: &oapi.EnvironmentProgressionRule{
				DependsOnEnvironmentSelector: selector,
				MinimumSuccessPercentage:     &minSuccess,
			},
		}},
	}}
	ts.mock.policySkips = []*oapi.PolicySkip{{
		RuleId:        "env-prog-rule",
		VersionId:     ts.version.Id,
		EnvironmentId: &ts.environment.Id,
		CreatedBy:     "test-user",
		CreatedAt:     skipTime,
	}}

	twoHoursLater := baseTime.Add(2 * time.Hour)
	rule := createGradualRolloutRule(oapi.GradualRolloutRuleRolloutTypeLinear, 60)
	eval := ts.eval(rule, func() time.Time { return twoHoursLater })

	result0 := eval.Evaluate(ts.ctx, ts.scope(0))
	assert.True(t, result0.Allowed)
	assert.Equal(t, skipTime.Format(time.RFC3339), result0.Details["rollout_start_time"])
	assert.Equal(t, skipTime.Format(time.RFC3339), result0.Details["target_rollout_time"])
}

func TestGradualRolloutEvaluator_EnvironmentProgressionOnly_Unsatisfied(t *testing.T) {
	baseTime := time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC)
	ts := newTestSetup(3, baseTime)

	selector := oapi.Selector{}
	require.NoError(t, selector.FromCelSelector(oapi.CelSelector{Cel: "environment.name == 'staging'"}))

	minSuccess := float32(100.0)
	ts.mock.policies = []*oapi.Policy{{
		Enabled:  true,
		Selector: "true",
		Rules: []oapi.PolicyRule{{
			EnvironmentProgression: &oapi.EnvironmentProgressionRule{
				DependsOnEnvironmentSelector: selector,
				MinimumSuccessPercentage:     &minSuccess,
			},
		}},
	}}
	// No skips and no env progression getter data -> unsatisfied

	twoHoursLater := baseTime.Add(2 * time.Hour)
	rule := createGradualRolloutRule(oapi.GradualRolloutRuleRolloutTypeLinear, 60)
	eval := ts.eval(rule, func() time.Time { return twoHoursLater })

	result := eval.Evaluate(ts.ctx, ts.scope(0))
	assert.False(t, result.Allowed)
	assert.True(t, result.ActionRequired)
	require.NotNil(t, result.ActionType)
	assert.Equal(t, oapi.Wait, *result.ActionType)
	assert.Equal(t, "Rollout has not started yet", result.Message)
}

// ---------------------------------------------------------------------------
// Tests: Combined approval + environment progression
// ---------------------------------------------------------------------------

func TestGradualRolloutEvaluator_BothPolicies_BothSatisfied(t *testing.T) {
	baseTime := time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC)
	approvalTime := baseTime.Add(30 * time.Minute)
	envProgTime := baseTime.Add(1 * time.Hour)
	ts := newTestSetup(1, baseTime)

	selector := oapi.Selector{}
	require.NoError(t, selector.FromCelSelector(oapi.CelSelector{Cel: "environment.name == 'staging'"}))

	minSuccess := float32(100.0)
	ts.mock.policies = []*oapi.Policy{{
		Enabled:  true,
		Selector: "true",
		Rules: []oapi.PolicyRule{
			{Id: "approval-rule", AnyApproval: &oapi.AnyApprovalRule{MinApprovals: 2}},
			{Id: "env-prog-rule", EnvironmentProgression: &oapi.EnvironmentProgressionRule{
				DependsOnEnvironmentSelector: selector,
				MinimumSuccessPercentage:     &minSuccess,
			}},
		},
	}}
	ts.mock.approvalRecords = []*oapi.UserApprovalRecord{
		{UserId: "user-1", CreatedAt: approvalTime.Format(time.RFC3339), Status: oapi.ApprovalStatusApproved},
		{UserId: "user-2", CreatedAt: approvalTime.Format(time.RFC3339), Status: oapi.ApprovalStatusApproved},
	}
	ts.mock.policySkips = []*oapi.PolicySkip{{
		RuleId:    "env-prog-rule",
		VersionId: ts.version.Id,
		CreatedAt: envProgTime,
	}}

	twoHoursLater := baseTime.Add(2 * time.Hour)
	rule := createGradualRolloutRule(oapi.GradualRolloutRuleRolloutTypeLinear, 60)
	eval := ts.eval(rule, func() time.Time { return twoHoursLater })

	result := eval.Evaluate(ts.ctx, ts.scope(0))
	assert.True(t, result.Allowed)
	// Should use the later of the two (envProgTime > approvalTime)
	assert.Equal(t, envProgTime.Format(time.RFC3339), result.Details["rollout_start_time"])
}

func TestGradualRolloutEvaluator_BothPolicies_ApprovalLater(t *testing.T) {
	baseTime := time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC)
	envProgTime := baseTime.Add(30 * time.Minute)
	approvalTime := baseTime.Add(1 * time.Hour)
	ts := newTestSetup(1, baseTime)

	selector := oapi.Selector{}
	require.NoError(t, selector.FromCelSelector(oapi.CelSelector{Cel: "environment.name == 'staging'"}))

	minSuccess := float32(100.0)
	ts.mock.policies = []*oapi.Policy{{
		Enabled:  true,
		Selector: "true",
		Rules: []oapi.PolicyRule{
			{Id: "approval-rule", AnyApproval: &oapi.AnyApprovalRule{MinApprovals: 2}},
			{Id: "env-prog-rule", EnvironmentProgression: &oapi.EnvironmentProgressionRule{
				DependsOnEnvironmentSelector: selector,
				MinimumSuccessPercentage:     &minSuccess,
			}},
		},
	}}
	ts.mock.approvalRecords = []*oapi.UserApprovalRecord{
		{UserId: "user-1", CreatedAt: approvalTime.Format(time.RFC3339), Status: oapi.ApprovalStatusApproved},
		{UserId: "user-2", CreatedAt: approvalTime.Format(time.RFC3339), Status: oapi.ApprovalStatusApproved},
	}
	ts.mock.policySkips = []*oapi.PolicySkip{{
		RuleId:    "env-prog-rule",
		VersionId: ts.version.Id,
		CreatedAt: envProgTime,
	}}

	twoHoursLater := baseTime.Add(2 * time.Hour)
	rule := createGradualRolloutRule(oapi.GradualRolloutRuleRolloutTypeLinear, 60)
	eval := ts.eval(rule, func() time.Time { return twoHoursLater })

	result := eval.Evaluate(ts.ctx, ts.scope(0))
	assert.True(t, result.Allowed)
	assert.Equal(t, approvalTime.Format(time.RFC3339), result.Details["rollout_start_time"])
}

func TestGradualRolloutEvaluator_BothPolicies_ApprovalUnsatisfied(t *testing.T) {
	baseTime := time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC)
	ts := newTestSetup(1, baseTime)

	selector := oapi.Selector{}
	require.NoError(t, selector.FromCelSelector(oapi.CelSelector{Cel: "environment.name == 'staging'"}))

	minSuccess := float32(100.0)
	ts.mock.policies = []*oapi.Policy{{
		Enabled:   true,
		Selector:  "true",
		CreatedAt: baseTime.Add(-1 * time.Hour).Format(time.RFC3339),
		Rules: []oapi.PolicyRule{
			{AnyApproval: &oapi.AnyApprovalRule{MinApprovals: 2}},
			{Id: "env-prog-rule", EnvironmentProgression: &oapi.EnvironmentProgressionRule{
				DependsOnEnvironmentSelector: selector,
				MinimumSuccessPercentage:     &minSuccess,
			}},
		},
	}}
	// Only 1 approval (need 2)
	ts.mock.approvalRecords = []*oapi.UserApprovalRecord{
		{UserId: "user-1", CreatedAt: baseTime.Format(time.RFC3339), Status: oapi.ApprovalStatusApproved},
	}
	ts.mock.policySkips = []*oapi.PolicySkip{{
		RuleId:    "env-prog-rule",
		VersionId: ts.version.Id,
		CreatedAt: baseTime.Add(30 * time.Minute),
	}}

	twoHoursLater := baseTime.Add(2 * time.Hour)
	rule := createGradualRolloutRule(oapi.GradualRolloutRuleRolloutTypeLinear, 60)
	eval := ts.eval(rule, func() time.Time { return twoHoursLater })

	result := eval.Evaluate(ts.ctx, ts.scope(0))
	assert.False(t, result.Allowed)
	assert.True(t, result.ActionRequired)
	assert.Equal(t, "Rollout has not started yet", result.Message)
}

func TestGradualRolloutEvaluator_BothPolicies_EnvProgUnsatisfied(t *testing.T) {
	baseTime := time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC)
	ts := newTestSetup(1, baseTime)

	selector := oapi.Selector{}
	require.NoError(t, selector.FromCelSelector(oapi.CelSelector{Cel: "environment.name == 'staging'"}))

	minSuccess := float32(100.0)
	approvalTime := baseTime.Add(30 * time.Minute)
	ts.mock.policies = []*oapi.Policy{{
		Enabled:  true,
		Selector: "true",
		Rules: []oapi.PolicyRule{
			{AnyApproval: &oapi.AnyApprovalRule{MinApprovals: 2}},
			{EnvironmentProgression: &oapi.EnvironmentProgressionRule{
				DependsOnEnvironmentSelector: selector,
				MinimumSuccessPercentage:     &minSuccess,
			}},
		},
	}}
	ts.mock.approvalRecords = []*oapi.UserApprovalRecord{
		{UserId: "user-1", CreatedAt: approvalTime.Format(time.RFC3339), Status: oapi.ApprovalStatusApproved},
		{UserId: "user-2", CreatedAt: approvalTime.Format(time.RFC3339), Status: oapi.ApprovalStatusApproved},
	}
	// No env prog skip and no data -> unsatisfied

	twoHoursLater := baseTime.Add(2 * time.Hour)
	rule := createGradualRolloutRule(oapi.GradualRolloutRuleRolloutTypeLinear, 60)
	eval := ts.eval(rule, func() time.Time { return twoHoursLater })

	result := eval.Evaluate(ts.ctx, ts.scope(0))
	assert.False(t, result.Allowed)
	assert.True(t, result.ActionRequired)
	assert.Equal(t, "Rollout has not started yet", result.Message)
}

// ---------------------------------------------------------------------------
// Tests: Timing and progression
// ---------------------------------------------------------------------------

func TestGradualRolloutEvaluator_ApprovalJustSatisfied_OnlyPosition0Allowed(t *testing.T) {
	baseTime := time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC)
	approvalTime := baseTime.Add(1 * time.Hour)
	ts := newTestSetup(5, baseTime)

	ts.mock.policies = []*oapi.Policy{{
		Enabled:  true,
		Selector: "true",
		Rules: []oapi.PolicyRule{{
			AnyApproval: &oapi.AnyApprovalRule{MinApprovals: 2},
		}},
	}}
	ts.mock.approvalRecords = []*oapi.UserApprovalRecord{
		{UserId: "user-1", CreatedAt: approvalTime.Format(time.RFC3339), Status: oapi.ApprovalStatusApproved},
		{UserId: "user-2", CreatedAt: approvalTime.Format(time.RFC3339), Status: oapi.ApprovalStatusApproved},
	}

	rule := createGradualRolloutRule(oapi.GradualRolloutRuleRolloutTypeLinear, 60)
	eval := ts.eval(rule, func() time.Time { return approvalTime })

	allowedCount := 0
	pendingCount := 0
	for _, rt := range ts.releaseTargets {
		scope := evaluator.EvaluatorScope{
			Environment: ts.environment,
			Version:     ts.version,
			Resource:    &oapi.Resource{Id: rt.ResourceId},
			Deployment:  &oapi.Deployment{Id: rt.DeploymentId},
		}
		result := eval.Evaluate(ts.ctx, scope)
		if result.Allowed {
			allowedCount++
		} else if result.ActionRequired && result.ActionType != nil && *result.ActionType == oapi.Wait {
			pendingCount++
		}
	}
	assert.Equal(t, 1, allowedCount, "Only position 0 should be allowed immediately after approval")
	assert.Equal(t, 4, pendingCount, "Positions 1-4 should be pending")
}

func TestGradualRolloutEvaluator_GradualProgressionOverTime(t *testing.T) {
	baseTime := time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC)
	approvalTime := baseTime.Add(1 * time.Hour)
	ts := newTestSetup(5, baseTime)

	ts.mock.policies = []*oapi.Policy{{
		Enabled:  true,
		Selector: "true",
		Rules: []oapi.PolicyRule{{
			AnyApproval: &oapi.AnyApprovalRule{MinApprovals: 1},
		}},
	}}
	ts.mock.approvalRecords = []*oapi.UserApprovalRecord{
		{UserId: "user-1", CreatedAt: approvalTime.Format(time.RFC3339), Status: oapi.ApprovalStatusApproved},
	}

	currentTime := approvalTime
	rule := createGradualRolloutRule(oapi.GradualRolloutRuleRolloutTypeLinear, 60)
	eval := ts.eval(rule, func() time.Time { return currentTime })

	currentTime = approvalTime
	assert.Equal(t, 1, countAllowedTargets(ts.ctx, t, eval, ts.environment, ts.version, ts.releaseTargets))

	currentTime = approvalTime.Add(30 * time.Second)
	assert.Equal(t, 1, countAllowedTargets(ts.ctx, t, eval, ts.environment, ts.version, ts.releaseTargets))

	currentTime = approvalTime.Add(60 * time.Second)
	assert.Equal(t, 2, countAllowedTargets(ts.ctx, t, eval, ts.environment, ts.version, ts.releaseTargets))

	currentTime = approvalTime.Add(120 * time.Second)
	assert.Equal(t, 3, countAllowedTargets(ts.ctx, t, eval, ts.environment, ts.version, ts.releaseTargets))

	currentTime = approvalTime.Add(180 * time.Second)
	assert.Equal(t, 4, countAllowedTargets(ts.ctx, t, eval, ts.environment, ts.version, ts.releaseTargets))

	currentTime = approvalTime.Add(240 * time.Second)
	assert.Equal(t, 5, countAllowedTargets(ts.ctx, t, eval, ts.environment, ts.version, ts.releaseTargets))
}

func TestGradualRolloutEvaluator_EnvProgressionJustSatisfied_OnlyPosition0Allowed(t *testing.T) {
	baseTime := time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC)
	skipTime := baseTime.Add(1 * time.Hour)
	ts := newTestSetup(5, baseTime)

	selector := oapi.Selector{}
	require.NoError(t, selector.FromCelSelector(oapi.CelSelector{Cel: "environment.name == 'staging'"}))

	minSuccess := float32(100.0)
	ts.mock.policies = []*oapi.Policy{{
		Enabled:  true,
		Selector: "true",
		Rules: []oapi.PolicyRule{{
			Id: "env-prog-rule",
			EnvironmentProgression: &oapi.EnvironmentProgressionRule{
				DependsOnEnvironmentSelector: selector,
				MinimumSuccessPercentage:     &minSuccess,
			},
		}},
	}}
	ts.mock.policySkips = []*oapi.PolicySkip{{
		RuleId:    "env-prog-rule",
		VersionId: ts.version.Id,
		CreatedAt: skipTime,
	}}

	rule := createGradualRolloutRule(oapi.GradualRolloutRuleRolloutTypeLinear, 60)
	eval := ts.eval(rule, func() time.Time { return skipTime })

	allowedCount := 0
	pendingCount := 0
	for _, rt := range ts.releaseTargets {
		scope := evaluator.EvaluatorScope{
			Environment: ts.environment,
			Version:     ts.version,
			Resource:    &oapi.Resource{Id: rt.ResourceId},
			Deployment:  &oapi.Deployment{Id: rt.DeploymentId},
		}
		result := eval.Evaluate(ts.ctx, scope)
		if result.Allowed {
			allowedCount++
		} else if result.ActionRequired {
			pendingCount++
		}
	}
	assert.Equal(t, 1, allowedCount)
	assert.Equal(t, 4, pendingCount)
}

// ---------------------------------------------------------------------------
// Tests: NextEvaluationTime
// ---------------------------------------------------------------------------

func TestGradualRolloutEvaluator_NextEvaluationTime_WhenPending(t *testing.T) {
	baseTime := time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC)
	ts := newTestSetup(3, baseTime)

	currentTime := baseTime.Add(30 * time.Second)
	rule := createGradualRolloutRule(oapi.GradualRolloutRuleRolloutTypeLinear, 60)
	eval := ts.eval(rule, func() time.Time { return currentTime })

	result := eval.Evaluate(ts.ctx, ts.scope(1))
	assert.False(t, result.Allowed)
	assert.True(t, result.ActionRequired)
	require.NotNil(t, result.ActionType)
	assert.Equal(t, oapi.Wait, *result.ActionType)

	require.NotNil(t, result.NextEvaluationTime)
	expectedRolloutTime := baseTime.Add(60 * time.Second)
	assert.WithinDuration(t, expectedRolloutTime, *result.NextEvaluationTime, 1*time.Second)
}

func TestGradualRolloutEvaluator_NextEvaluationTime_WhenAllowed(t *testing.T) {
	baseTime := time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC)
	ts := newTestSetup(3, baseTime)

	currentTime := baseTime.Add(10 * time.Minute)
	rule := createGradualRolloutRule(oapi.GradualRolloutRuleRolloutTypeLinear, 60)
	eval := ts.eval(rule, func() time.Time { return currentTime })

	for i, rt := range ts.releaseTargets {
		scope := evaluator.EvaluatorScope{
			Environment: ts.environment,
			Version:     ts.version,
			Resource:    &oapi.Resource{Id: rt.ResourceId},
			Deployment:  &oapi.Deployment{Id: rt.DeploymentId},
		}
		result := eval.Evaluate(ts.ctx, scope)
		assert.True(t, result.Allowed, "position %d should be allowed", i)
		assert.Nil(t, result.NextEvaluationTime)
	}
}

func TestGradualRolloutEvaluator_NextEvaluationTime_WaitingForDependencies(t *testing.T) {
	baseTime := time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC)
	ts := newTestSetup(2, baseTime)

	ts.mock.policies = []*oapi.Policy{{
		Enabled:   true,
		Selector:  "true",
		CreatedAt: baseTime.Add(-1 * time.Hour).Format(time.RFC3339),
		Rules: []oapi.PolicyRule{{
			AnyApproval: &oapi.AnyApprovalRule{MinApprovals: 2},
		}},
	}}
	ts.mock.approvalRecords = []*oapi.UserApprovalRecord{
		{UserId: "user-1", CreatedAt: baseTime.Format(time.RFC3339), Status: oapi.ApprovalStatusApproved},
	}

	twoHoursLater := baseTime.Add(2 * time.Hour)
	rule := createGradualRolloutRule(oapi.GradualRolloutRuleRolloutTypeLinear, 60)
	eval := ts.eval(rule, func() time.Time { return twoHoursLater })

	result := eval.Evaluate(ts.ctx, ts.scope(0))
	assert.False(t, result.Allowed)
	assert.True(t, result.ActionRequired)
	assert.Equal(t, "Rollout has not started yet", result.Message)
	assert.Nil(t, result.NextEvaluationTime)
}

func TestGradualRolloutEvaluator_NextEvaluationTime_LinearNormalized(t *testing.T) {
	baseTime := time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC)
	ts := newTestSetup(3, baseTime)

	currentTime := baseTime.Add(10 * time.Second)
	rule := createGradualRolloutRule(oapi.GradualRolloutRuleRolloutTypeLinearNormalized, 120)
	eval := ts.eval(rule, func() time.Time { return currentTime })

	// Position 0: offset = 0 -> allowed
	result0 := eval.Evaluate(ts.ctx, ts.scope(0))
	assert.True(t, result0.Allowed)

	// Position 1: offset = (1/3)*120 = 40s -> pending at 10s
	result1 := eval.Evaluate(ts.ctx, ts.scope(1))
	assert.False(t, result1.Allowed)
	require.NotNil(t, result1.NextEvaluationTime)
	assert.WithinDuration(t, baseTime.Add(40*time.Second), *result1.NextEvaluationTime, 1*time.Second)

	// Position 2: offset = (2/3)*120 = 80s -> pending at 10s
	result2 := eval.Evaluate(ts.ctx, ts.scope(2))
	assert.False(t, result2.Allowed)
	require.NotNil(t, result2.NextEvaluationTime)
	assert.WithinDuration(t, baseTime.Add(80*time.Second), *result2.NextEvaluationTime, 1*time.Second)
}

// ---------------------------------------------------------------------------
// Tests: Deployment window
// ---------------------------------------------------------------------------

func TestGradualRolloutEvaluator_DeploymentWindow_InsideAllowWindow(t *testing.T) {
	// Version created at 10am (inside 9am-5pm window)
	versionCreatedAt := time.Date(2025, 1, 6, 10, 0, 0, 0, time.UTC)
	ts := newTestSetup(3, versionCreatedAt)
	ts.mock.hasRelease = true

	ts.mock.policies = []*oapi.Policy{{
		Id:       uuid.New().String(),
		Enabled:  true,
		Selector: "true",
		Rules: []oapi.PolicyRule{{
			Id: "deployment-window-rule",
			DeploymentWindow: &oapi.DeploymentWindowRule{
				Rrule:           "FREQ=DAILY;BYHOUR=9;BYMINUTE=0;BYSECOND=0",
				DurationMinutes: 480,
				Timezone:        stringPtr("UTC"),
				AllowWindow:     boolPtr(true),
			},
		}},
	}}

	currentTime := time.Date(2025, 1, 6, 10, 5, 0, 0, time.UTC)
	rule := createGradualRolloutRule(oapi.GradualRolloutRuleRolloutTypeLinear, 60)
	eval := ts.eval(rule, func() time.Time { return currentTime })

	// Inside the window, rollout start time should be version creation time
	result0 := eval.Evaluate(ts.ctx, ts.scope(0))
	assert.True(t, result0.Allowed)
	assert.Equal(t, versionCreatedAt.Format(time.RFC3339), result0.Details["rollout_start_time"])
}

func TestGradualRolloutEvaluator_DeploymentWindow_OutsideAllowWindow(t *testing.T) {
	// Version created at midnight (outside 9am-5pm window)
	versionCreatedAt := time.Date(2025, 1, 6, 0, 0, 0, 0, time.UTC)
	windowOpenTime := time.Date(2025, 1, 6, 9, 0, 0, 0, time.UTC)
	ts := newTestSetup(3, versionCreatedAt)
	ts.mock.hasRelease = true

	ts.mock.policies = []*oapi.Policy{{
		Id:       uuid.New().String(),
		Enabled:  true,
		Selector: "true",
		Rules: []oapi.PolicyRule{{
			Id: "deployment-window-rule",
			DeploymentWindow: &oapi.DeploymentWindowRule{
				Rrule:           "FREQ=DAILY;BYHOUR=9;BYMINUTE=0;BYSECOND=0",
				DurationMinutes: 480,
				Timezone:        stringPtr("UTC"),
				AllowWindow:     boolPtr(true),
			},
		}},
	}}

	currentTime := time.Date(2025, 1, 6, 10, 0, 0, 0, time.UTC)
	rule := createGradualRolloutRule(oapi.GradualRolloutRuleRolloutTypeLinear, 60)
	eval := ts.eval(rule, func() time.Time { return currentTime })

	result0 := eval.Evaluate(ts.ctx, ts.scope(0))
	assert.True(t, result0.Allowed)
	assert.Equal(t, windowOpenTime.Format(time.RFC3339), result0.Details["rollout_start_time"])
}

func TestGradualRolloutEvaluator_DeploymentWindow_IgnoresWindowWithoutDeployedVersion(t *testing.T) {
	versionCreatedAt := time.Date(2025, 1, 6, 0, 0, 0, 0, time.UTC)
	ts := newTestSetup(3, versionCreatedAt)
	ts.mock.hasRelease = false

	ts.mock.policies = []*oapi.Policy{{
		Id:       uuid.New().String(),
		Enabled:  true,
		Selector: "true",
		Rules: []oapi.PolicyRule{{
			Id: "deployment-window-rule",
			DeploymentWindow: &oapi.DeploymentWindowRule{
				Rrule:           "FREQ=DAILY;BYHOUR=9;BYMINUTE=0;BYSECOND=0",
				DurationMinutes: 480,
				Timezone:        stringPtr("UTC"),
				AllowWindow:     boolPtr(true),
			},
		}},
	}}

	currentTime := time.Date(2025, 1, 6, 10, 0, 0, 0, time.UTC)
	rule := createGradualRolloutRule(oapi.GradualRolloutRuleRolloutTypeLinear, 60)
	eval := ts.eval(rule, func() time.Time { return currentTime })

	// Without an existing release, window is ignored -> start time = version creation
	result0 := eval.Evaluate(ts.ctx, ts.scope(0))
	assert.True(t, result0.Allowed)
	assert.Equal(t, versionCreatedAt.Format(time.RFC3339), result0.Details["rollout_start_time"])
}

func TestGradualRolloutEvaluator_DeploymentWindow_DenyWindowAdjustsRolloutStart(t *testing.T) {
	versionCreatedAt := time.Date(2025, 1, 6, 10, 0, 0, 0, time.UTC)
	ts := newTestSetup(3, versionCreatedAt)
	ts.mock.hasRelease = true

	// Deny window: 10am-12pm
	ts.mock.policies = []*oapi.Policy{{
		Id:       uuid.New().String(),
		Enabled:  true,
		Selector: "true",
		Rules: []oapi.PolicyRule{{
			Id: "deny-window-rule",
			DeploymentWindow: &oapi.DeploymentWindowRule{
				Rrule:           "FREQ=DAILY;BYHOUR=10;BYMINUTE=0;BYSECOND=0",
				DurationMinutes: 120,
				Timezone:        stringPtr("UTC"),
				AllowWindow:     boolPtr(false),
			},
		}},
	}}

	currentTime := time.Date(2025, 1, 6, 13, 0, 0, 0, time.UTC)
	rule := createGradualRolloutRule(oapi.GradualRolloutRuleRolloutTypeLinear, 60)
	eval := ts.eval(rule, func() time.Time { return currentTime })

	result0 := eval.Evaluate(ts.ctx, ts.scope(0))
	assert.True(t, result0.Allowed)
	// Deny window ends at 12pm, so rollout starts at 12pm
	denyEnd := time.Date(2025, 1, 6, 12, 0, 0, 0, time.UTC)
	assert.Equal(t, denyEnd.Format(time.RFC3339), result0.Details["rollout_start_time"])
}

func TestGradualRolloutEvaluator_DeploymentWindow_DenyWindowOutsideNoChange(t *testing.T) {
	// Version created at 1pm (OUTSIDE deny window 10am-12pm)
	versionCreatedAt := time.Date(2025, 1, 6, 13, 0, 0, 0, time.UTC)
	ts := newTestSetup(3, versionCreatedAt)
	ts.mock.hasRelease = true

	ts.mock.policies = []*oapi.Policy{{
		Id:       uuid.New().String(),
		Enabled:  true,
		Selector: "true",
		Rules: []oapi.PolicyRule{{
			Id: "deny-window-rule",
			DeploymentWindow: &oapi.DeploymentWindowRule{
				Rrule:           "FREQ=DAILY;BYHOUR=10;BYMINUTE=0;BYSECOND=0",
				DurationMinutes: 120,
				Timezone:        stringPtr("UTC"),
				AllowWindow:     boolPtr(false),
			},
		}},
	}}

	currentTime := time.Date(2025, 1, 6, 14, 0, 0, 0, time.UTC)
	rule := createGradualRolloutRule(oapi.GradualRolloutRuleRolloutTypeLinear, 60)
	eval := ts.eval(rule, func() time.Time { return currentTime })

	result0 := eval.Evaluate(ts.ctx, ts.scope(0))
	assert.True(t, result0.Allowed)
	assert.Equal(t, versionCreatedAt.Format(time.RFC3339), result0.Details["rollout_start_time"])
}

func TestGradualRolloutEvaluator_DeploymentWindow_NoWindowsExistingBehavior(t *testing.T) {
	baseTime := time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC)
	ts := newTestSetup(3, baseTime)

	currentTime := baseTime.Add(10 * time.Minute)
	rule := createGradualRolloutRule(oapi.GradualRolloutRuleRolloutTypeLinear, 60)
	eval := ts.eval(rule, func() time.Time { return currentTime })

	result0 := eval.Evaluate(ts.ctx, ts.scope(0))
	assert.True(t, result0.Allowed)
	assert.Equal(t, baseTime.Format(time.RFC3339), result0.Details["rollout_start_time"])
}

func TestGradualRolloutEvaluator_DeploymentWindow_PreventsFrontloading(t *testing.T) {
	// Version created at midnight (OUTSIDE 9am-5pm window)
	versionCreatedAt := time.Date(2025, 1, 6, 0, 0, 0, 0, time.UTC)
	windowOpenTime := time.Date(2025, 1, 6, 9, 0, 0, 0, time.UTC)
	ts := newTestSetup(5, versionCreatedAt)
	ts.mock.hasRelease = true

	ts.mock.policies = []*oapi.Policy{{
		Id:       uuid.New().String(),
		Enabled:  true,
		Selector: "true",
		Rules: []oapi.PolicyRule{{
			Id: "deployment-window-rule",
			DeploymentWindow: &oapi.DeploymentWindowRule{
				Rrule:           "FREQ=DAILY;BYHOUR=9;BYMINUTE=0;BYSECOND=0",
				DurationMinutes: 480,
				Timezone:        stringPtr("UTC"),
				AllowWindow:     boolPtr(true),
			},
		}},
	}}

	currentTime := time.Date(2025, 1, 6, 9, 5, 0, 0, time.UTC)
	rule := createGradualRolloutRule(oapi.GradualRolloutRuleRolloutTypeLinear, 60)
	eval := ts.eval(rule, func() time.Time { return currentTime })

	for i, rt := range ts.releaseTargets {
		scope := evaluator.EvaluatorScope{
			Environment: ts.environment,
			Version:     ts.version,
			Resource:    &oapi.Resource{Id: rt.ResourceId},
			Deployment:  &oapi.Deployment{Id: rt.DeploymentId},
		}
		result := eval.Evaluate(ts.ctx, scope)

		expectedRolloutTime := windowOpenTime.Add(time.Duration(i) * 60 * time.Second)

		if i <= 4 {
			assert.True(t, result.Allowed, "position %d should be allowed at 9:05am", i)
		}

		assert.Equal(t, windowOpenTime.Format(time.RFC3339), result.Details["rollout_start_time"],
			"rollout should start from window open time for position %d", i)
		assert.Equal(t, expectedRolloutTime.Format(time.RFC3339), result.Details["target_rollout_time"],
			"position %d should have correct rollout time", i)
	}
}

func TestGradualRolloutEvaluator_DeploymentWindow_DenyWindowPreventsFrontloading(t *testing.T) {
	// Version created at 10am (INSIDE deny window 10am-12pm)
	versionCreatedAt := time.Date(2025, 1, 6, 10, 0, 0, 0, time.UTC)
	denyEnd := time.Date(2025, 1, 6, 12, 0, 0, 0, time.UTC)
	ts := newTestSetup(5, versionCreatedAt)
	ts.mock.hasRelease = true

	ts.mock.policies = []*oapi.Policy{{
		Id:       uuid.New().String(),
		Enabled:  true,
		Selector: "true",
		Rules: []oapi.PolicyRule{{
			Id: "deny-window-rule",
			DeploymentWindow: &oapi.DeploymentWindowRule{
				Rrule:           "FREQ=DAILY;BYHOUR=10;BYMINUTE=0;BYSECOND=0",
				DurationMinutes: 120,
				Timezone:        stringPtr("UTC"),
				AllowWindow:     boolPtr(false),
			},
		}},
	}}

	currentTime := time.Date(2025, 1, 6, 12, 10, 0, 0, time.UTC)
	rule := createGradualRolloutRule(oapi.GradualRolloutRuleRolloutTypeLinear, 60)
	eval := ts.eval(rule, func() time.Time { return currentTime })

	for i, rt := range ts.releaseTargets {
		scope := evaluator.EvaluatorScope{
			Environment: ts.environment,
			Version:     ts.version,
			Resource:    &oapi.Resource{Id: rt.ResourceId},
			Deployment:  &oapi.Deployment{Id: rt.DeploymentId},
		}
		result := eval.Evaluate(ts.ctx, scope)

		expectedRolloutTime := denyEnd.Add(time.Duration(i) * 60 * time.Second)

		assert.Equal(t, denyEnd.Format(time.RFC3339), result.Details["rollout_start_time"],
			"rollout should start after deny window ends for position %d", i)
		assert.Equal(t, expectedRolloutTime.Format(time.RFC3339), result.Details["target_rollout_time"],
			"position %d should have correct rollout time", i)
	}
}

// ---------------------------------------------------------------------------
// Tests: NewEvaluator constructor
// ---------------------------------------------------------------------------

func TestNewEvaluator_NilRule(t *testing.T) {
	assert.Nil(t, NewEvaluator(newMockGetters(), nil))
}

func TestNewEvaluator_NilGradualRollout(t *testing.T) {
	rule := &oapi.PolicyRule{Id: "r1"}
	assert.Nil(t, NewEvaluator(newMockGetters(), rule))
}

func TestNewEvaluator_NilGetters(t *testing.T) {
	rule := createGradualRolloutRule(oapi.GradualRolloutRuleRolloutTypeLinear, 60)
	assert.Nil(t, NewEvaluator(nil, rule))
}

func TestNewEvaluator_Valid(t *testing.T) {
	rule := createGradualRolloutRule(oapi.GradualRolloutRuleRolloutTypeLinear, 60)
	eval := NewEvaluator(newMockGetters(), rule)
	require.NotNil(t, eval)
}

func TestScopeFields(t *testing.T) {
	e := &GradualRolloutEvaluator{}
	assert.Equal(t, evaluator.ScopeEnvironment|evaluator.ScopeVersion|evaluator.ScopeReleaseTarget, e.ScopeFields())
}

func TestRuleType(t *testing.T) {
	e := &GradualRolloutEvaluator{}
	assert.Equal(t, evaluator.RuleTypeGradualRollout, e.RuleType())
}

func TestRuleId(t *testing.T) {
	e := &GradualRolloutEvaluator{ruleId: "rule-abc"}
	assert.Equal(t, "rule-abc", e.RuleId())
}

func TestComplexity(t *testing.T) {
	e := &GradualRolloutEvaluator{}
	assert.Equal(t, 2, e.Complexity())
}
