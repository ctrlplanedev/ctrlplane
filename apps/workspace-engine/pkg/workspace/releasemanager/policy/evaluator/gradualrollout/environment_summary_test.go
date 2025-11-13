package gradualrollout

import (
	"testing"
	"time"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/statechange"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator"
	"workspace-engine/pkg/workspace/store"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
)

// TestFormatDuration tests the formatDuration helper function
func TestFormatDuration(t *testing.T) {
	tests := []struct {
		name     string
		duration time.Duration
		expected string
	}{
		{"30 seconds", 30 * time.Second, "30 seconds"},
		{"45 seconds", 45 * time.Second, "45 seconds"},
		{"1 minute", 1 * time.Minute, "1 minute"},
		{"2 minutes", 2 * time.Minute, "2 minutes"},
		{"30 minutes", 30 * time.Minute, "30 minutes"},
		{"1 hour", 1 * time.Hour, "1 hour"},
		{"2 hours", 2 * time.Hour, "2 hours"},
		{"12 hours", 12 * time.Hour, "12 hours"},
		{"1 day", 24 * time.Hour, "1 day"},
		{"2 days", 48 * time.Hour, "2 days"},
		{"7 days", 7 * 24 * time.Hour, "7 days"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := formatDuration(tt.duration)
			assert.Equal(t, tt.expected, result)
		})
	}
}

// TestPluralize tests the pluralize helper function
func TestPluralize(t *testing.T) {
	tests := []struct {
		name     string
		count    int
		expected string
	}{
		{"zero", 0, "s"},
		{"one", 1, ""},
		{"two", 2, "s"},
		{"many", 10, "s"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := pluralize(tt.count)
			assert.Equal(t, tt.expected, result)
		})
	}
}

// TestGradualRolloutEnvironmentSummaryEvaluator_NoReleaseTargets tests the summary
// evaluator when there are no release targets
func TestGradualRolloutEnvironmentSummaryEvaluator_NoReleaseTargets(t *testing.T) {
	ctx := t.Context()
	sc := statechange.NewChangeSet[any]()
	st := store.New("test-workspace", sc)

	systemID := uuid.New().String()
	environment := generateEnvironment(ctx, systemID, st)
	deployment := generateDeployment(ctx, systemID, st)

	baseTime := time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC)
	version := generateDeploymentVersion(ctx, deployment.Id, baseTime, st)

	rule := createGradualRolloutRule(oapi.GradualRolloutRuleRolloutTypeLinear, 60)
	eval := NewSummaryEvaluator(st, rule)

	scope := evaluator.EvaluatorScope{
		Environment: environment,
		Version:     version,
	}

	result := eval.Evaluate(ctx, scope)
	assert.False(t, result.Allowed)
	assert.Equal(t, "No release targets configured for this environment", result.Message)
	assert.Equal(t, 0, result.Details["total_targets"])
}

// TestGradualRolloutEnvironmentSummaryEvaluator_AllDeployed tests the summary
// when all targets are successfully deployed
func TestGradualRolloutEnvironmentSummaryEvaluator_AllDeployed(t *testing.T) {
	ctx := t.Context()
	sc := statechange.NewChangeSet[any]()
	st := store.New("test-workspace", sc)

	systemID := uuid.New().String()
	environment := generateEnvironment(ctx, systemID, st)
	deployment := generateDeployment(ctx, systemID, st)
	resources := generateResources(ctx, 3, st)

	baseTime := time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC)
	version := generateDeploymentVersion(ctx, deployment.Id, baseTime, st)

	// Create release targets for each resource
	for _, resource := range resources {
		releaseTarget := &oapi.ReleaseTarget{
			EnvironmentId: environment.Id,
			DeploymentId:  deployment.Id,
			ResourceId:    resource.Id,
		}
		st.ReleaseTargets.Upsert(ctx, releaseTarget)
	}

	// Set time far enough in the future that all rollouts are complete
	timeGetter := func() time.Time {
		return baseTime.Add(10 * time.Minute)
	}
	SetTestTimeGetterFactory(timeGetter)
	defer ClearTestTimeGetterFactory()

	rule := createGradualRolloutRule(oapi.GradualRolloutRuleRolloutTypeLinear, 60)
	eval := NewSummaryEvaluator(st, rule)

	scope := evaluator.EvaluatorScope{
		Environment: environment,
		Version:     version,
	}

	result := eval.Evaluate(ctx, scope)

	// All targets should be allowed (deployed)
	assert.True(t, result.Allowed)
	assert.Equal(t, "Rollout complete — All 3 targets successfully deployed", result.Message)
	assert.Equal(t, 3, result.Details["total_targets"])
	assert.Equal(t, 3, result.Details["deployed_targets"])
	assert.Equal(t, 0, result.Details["pending_targets"])
	assert.Equal(t, 0, result.Details["denied_targets"])

	_ = resources // suppress unused warning
}

// TestGradualRolloutEnvironmentSummaryEvaluator_AllDenied tests the summary
// when all targets are denied
func TestGradualRolloutEnvironmentSummaryEvaluator_AllDenied(t *testing.T) {
	ctx := t.Context()
	sc := statechange.NewChangeSet[any]()
	st := store.New("test-workspace", sc)

	systemID := uuid.New().String()
	environment := generateEnvironment(ctx, systemID, st)
	deployment := generateDeployment(ctx, systemID, st)
	resources := generateResources(ctx, 3, st)

	baseTime := time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC)
	version := generateDeploymentVersion(ctx, deployment.Id, baseTime, st)

	// Create release targets for each resource
	for _, resource := range resources {
		releaseTarget := &oapi.ReleaseTarget{
			EnvironmentId: environment.Id,
			DeploymentId:  deployment.Id,
			ResourceId:    resource.Id,
		}
		st.ReleaseTargets.Upsert(ctx, releaseTarget)
	}

	// Set current time
	timeGetter := func() time.Time {
		return baseTime.Add(10 * time.Minute)
	}
	SetTestTimeGetterFactory(timeGetter)
	defer ClearTestTimeGetterFactory()

	// Create approval policy that is not satisfied
	approvalPolicy := &oapi.Policy{
		Enabled: true,
		Selectors: []oapi.PolicyTargetSelector{
			{
				ResourceSelector:    generateResourceSelector(),
				DeploymentSelector:  generateMatchAllSelector(),
				EnvironmentSelector: generateMatchAllSelector(),
			},
		},
		Rules: []oapi.PolicyRule{
			{
				AnyApproval: &oapi.AnyApprovalRule{
					MinApprovals: 2,
				},
			},
		},
	}
	st.Policies.Upsert(ctx, approvalPolicy)

	// Don't create any approvals - all targets should be denied/pending

	rule := createGradualRolloutRule(oapi.GradualRolloutRuleRolloutTypeLinear, 60)
	eval := NewSummaryEvaluator(st, rule)

	scope := evaluator.EvaluatorScope{
		Environment: environment,
		Version:     version,
	}

	result := eval.Evaluate(ctx, scope)

	// All targets should be pending (waiting for approval)
	assert.False(t, result.Allowed)
	assert.True(t, result.ActionRequired)
	assert.Equal(t, "Waiting for rollout to start", result.Message)
	assert.Equal(t, 3, result.Details["total_targets"])
	assert.Equal(t, 0, result.Details["deployed_targets"])
	assert.Equal(t, 3, result.Details["pending_targets"])

	_ = resources // suppress unused warning
}

// TestGradualRolloutEnvironmentSummaryEvaluator_PartialRollout tests the summary
// when rollout is in progress
func TestGradualRolloutEnvironmentSummaryEvaluator_PartialRollout(t *testing.T) {
	ctx := t.Context()
	sc := statechange.NewChangeSet[any]()
	st := store.New("test-workspace", sc)

	systemID := uuid.New().String()
	environment := generateEnvironment(ctx, systemID, st)
	deployment := generateDeployment(ctx, systemID, st)
	resources := generateResources(ctx, 5, st)

	baseTime := time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC)
	version := generateDeploymentVersion(ctx, deployment.Id, baseTime, st)

	// Create release targets for each resource
	for _, resource := range resources {
		releaseTarget := &oapi.ReleaseTarget{
			EnvironmentId: environment.Id,
			DeploymentId:  deployment.Id,
			ResourceId:    resource.Id,
		}
		st.ReleaseTargets.Upsert(ctx, releaseTarget)
	}

	// Set time to 90 seconds after start
	// This should allow positions 0 (0s) and 1 (60s) but not 2 (120s), 3 (180s), 4 (240s)
	timeGetter := func() time.Time {
		return baseTime.Add(90 * time.Second)
	}
	SetTestTimeGetterFactory(timeGetter)
	defer ClearTestTimeGetterFactory()

	rule := createGradualRolloutRule(oapi.GradualRolloutRuleRolloutTypeLinear, 60)
	eval := NewSummaryEvaluator(st, rule)

	scope := evaluator.EvaluatorScope{
		Environment: environment,
		Version:     version,
	}

	result := eval.Evaluate(ctx, scope)

	// Should have 2 deployed, 3 pending
	assert.False(t, result.Allowed)
	assert.True(t, result.ActionRequired)
	assert.Equal(t, 5, result.Details["total_targets"])
	assert.Equal(t, 2, result.Details["deployed_targets"])
	assert.Equal(t, 3, result.Details["pending_targets"])
	assert.Equal(t, 0, result.Details["denied_targets"])

	// Check that the message contains progress information
	assert.Contains(t, result.Message, "Rollout in progress")
	assert.Contains(t, result.Message, "2/5 deployed")
	assert.Contains(t, result.Message, "3 pending")
	// Should say "Next deployment ready now" since we're past the deployment time
	// or "Next deployment in X" if we're before it

	_ = resources // suppress unused warning
}

// TestGradualRolloutEnvironmentSummaryEvaluator_NextDeploymentReady tests the summary
// when the next deployment is ready now
func TestGradualRolloutEnvironmentSummaryEvaluator_NextDeploymentReady(t *testing.T) {
	ctx := t.Context()
	sc := statechange.NewChangeSet[any]()
	st := store.New("test-workspace", sc)

	systemID := uuid.New().String()
	environment := generateEnvironment(ctx, systemID, st)
	deployment := generateDeployment(ctx, systemID, st)
	resources := generateResources(ctx, 5, st)

	baseTime := time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC)
	version := generateDeploymentVersion(ctx, deployment.Id, baseTime, st)

	// Create release targets for each resource
	for _, resource := range resources {
		releaseTarget := &oapi.ReleaseTarget{
			EnvironmentId: environment.Id,
			DeploymentId:  deployment.Id,
			ResourceId:    resource.Id,
		}
		st.ReleaseTargets.Upsert(ctx, releaseTarget)
	}

	// Set time to exactly 120 seconds (when position 2 becomes ready)
	timeGetter := func() time.Time {
		return baseTime.Add(120 * time.Second)
	}
	SetTestTimeGetterFactory(timeGetter)
	defer ClearTestTimeGetterFactory()

	rule := createGradualRolloutRule(oapi.GradualRolloutRuleRolloutTypeLinear, 60)
	eval := NewSummaryEvaluator(st, rule)

	scope := evaluator.EvaluatorScope{
		Environment: environment,
		Version:     version,
	}

	result := eval.Evaluate(ctx, scope)

	// Should have 3 deployed, 2 pending
	assert.False(t, result.Allowed)
	assert.True(t, result.ActionRequired)
	assert.Equal(t, 5, result.Details["total_targets"])
	assert.Equal(t, 3, result.Details["deployed_targets"])
	assert.Equal(t, 2, result.Details["pending_targets"])

	// The message should say "Next deployment ready now" because we're past position 2's time
	assert.Contains(t, result.Message, "Rollout in progress")

	_ = resources // suppress unused warning
}

// TestGradualRolloutEnvironmentSummaryEvaluator_WithTimingDetails tests that timing
// details are properly calculated and included
func TestGradualRolloutEnvironmentSummaryEvaluator_WithTimingDetails(t *testing.T) {
	ctx := t.Context()
	sc := statechange.NewChangeSet[any]()
	st := store.New("test-workspace", sc)

	systemID := uuid.New().String()
	environment := generateEnvironment(ctx, systemID, st)
	deployment := generateDeployment(ctx, systemID, st)
	resources := generateResources(ctx, 3, st)

	baseTime := time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC)
	version := generateDeploymentVersion(ctx, deployment.Id, baseTime, st)

	// Create release targets for each resource
	for _, resource := range resources {
		releaseTarget := &oapi.ReleaseTarget{
			EnvironmentId: environment.Id,
			DeploymentId:  deployment.Id,
			ResourceId:    resource.Id,
		}
		st.ReleaseTargets.Upsert(ctx, releaseTarget)
	}

	// Set time to 30 seconds after start
	// Position 0 (0s) should be deployed, positions 1 (60s) and 2 (120s) should be pending
	timeGetter := func() time.Time {
		return baseTime.Add(30 * time.Second)
	}
	SetTestTimeGetterFactory(timeGetter)
	defer ClearTestTimeGetterFactory()

	rule := createGradualRolloutRule(oapi.GradualRolloutRuleRolloutTypeLinear, 60)
	eval := NewSummaryEvaluator(st, rule)

	scope := evaluator.EvaluatorScope{
		Environment: environment,
		Version:     version,
	}

	result := eval.Evaluate(ctx, scope)

	// Check timing details
	assert.Equal(t, baseTime.Format(time.RFC3339), result.Details["rollout_start_time"])
	assert.Equal(t, baseTime.Add(60*time.Second).Format(time.RFC3339), result.Details["next_deployment_time"])
	assert.Equal(t, baseTime.Add(120*time.Second).Format(time.RFC3339), result.Details["estimated_completion_time"])

	_ = resources // suppress unused warning
}

// TestGradualRolloutEnvironmentSummaryEvaluator_PartiallyBlocked tests when some
// targets are deployed and rollout is complete
func TestGradualRolloutEnvironmentSummaryEvaluator_PartiallyBlocked(t *testing.T) {
	ctx := t.Context()
	sc := statechange.NewChangeSet[any]()
	st := store.New("test-workspace", sc)

	systemID := uuid.New().String()
	environment := generateEnvironment(ctx, systemID, st)
	deployment := generateDeployment(ctx, systemID, st)
	resources := generateResources(ctx, 3, st)

	baseTime := time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC)
	version := generateDeploymentVersion(ctx, deployment.Id, baseTime, st)

	// Create release targets for each resource
	releaseTargets := make([]*oapi.ReleaseTarget, len(resources))
	for i, resource := range resources {
		releaseTarget := &oapi.ReleaseTarget{
			EnvironmentId: environment.Id,
			DeploymentId:  deployment.Id,
			ResourceId:    resource.Id,
		}
		st.ReleaseTargets.Upsert(ctx, releaseTarget)
		releaseTargets[i] = releaseTarget
	}

	// Create releases for all targets (all deployed)

	for _, rt := range releaseTargets {
		release := &oapi.Release{
			ReleaseTarget: *rt,
			Version:       *version,
		}
		st.Releases.Upsert(ctx, release)
	}

	// Set time far in the future
	timeGetter := func() time.Time {
		return baseTime.Add(10 * time.Minute)
	}
	SetTestTimeGetterFactory(timeGetter)
	defer ClearTestTimeGetterFactory()

	rule := createGradualRolloutRule(oapi.GradualRolloutRuleRolloutTypeLinear, 60)
	eval := NewSummaryEvaluator(st, rule)

	scope := evaluator.EvaluatorScope{
		Environment: environment,
		Version:     version,
	}

	result := eval.Evaluate(ctx, scope)

	// All targets deployed
	assert.True(t, result.Allowed)
	assert.Equal(t, 3, result.Details["total_targets"])
	assert.Equal(t, 3, result.Details["deployed_targets"])
	assert.Equal(t, 0, result.Details["pending_targets"])
}

// TestGradualRolloutEnvironmentSummaryEvaluator_Messages tests that the messages
// array contains all individual target evaluations
func TestGradualRolloutEnvironmentSummaryEvaluator_Messages(t *testing.T) {
	ctx := t.Context()
	sc := statechange.NewChangeSet[any]()
	st := store.New("test-workspace", sc)

	systemID := uuid.New().String()
	environment := generateEnvironment(ctx, systemID, st)
	deployment := generateDeployment(ctx, systemID, st)
	resources := generateResources(ctx, 3, st)

	baseTime := time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC)
	version := generateDeploymentVersion(ctx, deployment.Id, baseTime, st)

	// Create release targets for each resource
	for _, resource := range resources {
		releaseTarget := &oapi.ReleaseTarget{
			EnvironmentId: environment.Id,
			DeploymentId:  deployment.Id,
			ResourceId:    resource.Id,
		}
		st.ReleaseTargets.Upsert(ctx, releaseTarget)
	}

	timeGetter := func() time.Time {
		return baseTime.Add(90 * time.Second)
	}
	SetTestTimeGetterFactory(timeGetter)
	defer ClearTestTimeGetterFactory()

	rule := createGradualRolloutRule(oapi.GradualRolloutRuleRolloutTypeLinear, 60)
	eval := NewSummaryEvaluator(st, rule)

	scope := evaluator.EvaluatorScope{
		Environment: environment,
		Version:     version,
	}

	result := eval.Evaluate(ctx, scope)

	// Check that messages array exists and has correct length
	messages, ok := result.Details["messages"].([]*oapi.RuleEvaluation)
	assert.True(t, ok, "messages should be an array of RuleEvaluations")
	assert.Equal(t, 3, len(messages), "should have one message per release target")

	// Verify the messages correspond to individual evaluations
	for i, msg := range messages {
		assert.NotNil(t, msg, "message %d should not be nil", i)
		// Each message should have details about the specific target
		assert.NotNil(t, msg.Details, "message %d should have details", i)
	}

	_ = resources // suppress unused warning
}

// TestGradualRolloutEnvironmentSummaryEvaluator_ScopeFields tests that the evaluator
// declares the correct scope fields
func TestGradualRolloutEnvironmentSummaryEvaluator_ScopeFields(t *testing.T) {
	sc := statechange.NewChangeSet[any]()
	st := store.New("test-workspace", sc)

	rule := createGradualRolloutRule(oapi.GradualRolloutRuleRolloutTypeLinear, 60)
	eval := NewSummaryEvaluator(st, rule)

	summaryEval, ok := eval.(*GradualRolloutEnvironmentSummaryEvaluator)
	assert.True(t, ok, "should be able to cast to GradualRolloutEnvironmentSummaryEvaluator")

	scopeFields := summaryEval.ScopeFields()
	assert.Equal(t, evaluator.ScopeEnvironment|evaluator.ScopeVersion, scopeFields)
}

// TestGradualRolloutEnvironmentSummaryEvaluator_NilInputs tests that the evaluator
// handles nil inputs gracefully
func TestGradualRolloutEnvironmentSummaryEvaluator_NilInputs(t *testing.T) {
	sc := statechange.NewChangeSet[any]()
	st := store.New("test-workspace", sc)

	// Nil rule
	eval := NewSummaryEvaluator(st, nil)
	assert.Nil(t, eval)

	// Nil store
	rule := createGradualRolloutRule(oapi.GradualRolloutRuleRolloutTypeLinear, 60)
	eval = NewSummaryEvaluator(nil, rule)
	assert.Nil(t, eval)
}

// TestGradualRolloutEnvironmentSummaryEvaluator_LinearNormalized tests the summary
// evaluator with linear-normalized rollout type
func TestGradualRolloutEnvironmentSummaryEvaluator_LinearNormalized(t *testing.T) {
	ctx := t.Context()
	sc := statechange.NewChangeSet[any]()
	st := store.New("test-workspace", sc)

	systemID := uuid.New().String()
	environment := generateEnvironment(ctx, systemID, st)
	deployment := generateDeployment(ctx, systemID, st)
	resources := generateResources(ctx, 3, st)

	baseTime := time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC)
	version := generateDeploymentVersion(ctx, deployment.Id, baseTime, st)

	// Create release targets for each resource
	for _, resource := range resources {
		releaseTarget := &oapi.ReleaseTarget{
			EnvironmentId: environment.Id,
			DeploymentId:  deployment.Id,
			ResourceId:    resource.Id,
		}
		st.ReleaseTargets.Upsert(ctx, releaseTarget)
	}

	// With 3 targets and timeScaleInterval=60:
	// Position 0: 0s
	// Position 1: (1/3)*60 = 20s
	// Position 2: (2/3)*60 = 40s
	// Set time to 30 seconds - positions 0 and 1 should be deployed, position 2 pending
	timeGetter := func() time.Time {
		return baseTime.Add(30 * time.Second)
	}
	SetTestTimeGetterFactory(timeGetter)
	defer ClearTestTimeGetterFactory()

	rule := createGradualRolloutRule(oapi.GradualRolloutRuleRolloutTypeLinearNormalized, 60)
	eval := NewSummaryEvaluator(st, rule)

	scope := evaluator.EvaluatorScope{
		Environment: environment,
		Version:     version,
	}

	result := eval.Evaluate(ctx, scope)

	assert.False(t, result.Allowed)
	assert.True(t, result.ActionRequired)
	assert.Equal(t, 3, result.Details["total_targets"])
	assert.Equal(t, 2, result.Details["deployed_targets"])
	assert.Equal(t, 1, result.Details["pending_targets"])
	assert.Equal(t, 0, result.Details["denied_targets"])

	_ = resources // suppress unused warning
}

// TestGradualRolloutEnvironmentSummaryEvaluator_WithApprovalPolicy tests the summary
// when an approval policy affects the rollout start time
func TestGradualRolloutEnvironmentSummaryEvaluator_WithApprovalPolicy(t *testing.T) {
	ctx := t.Context()
	sc := statechange.NewChangeSet[any]()
	st := store.New("test-workspace", sc)

	systemID := uuid.New().String()
	environment := generateEnvironment(ctx, systemID, st)
	deployment := generateDeployment(ctx, systemID, st)
	resources := generateResources(ctx, 3, st)

	baseTime := time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC)
	version := generateDeploymentVersion(ctx, deployment.Id, baseTime, st)

	// Create release targets for each resource
	for _, resource := range resources {
		releaseTarget := &oapi.ReleaseTarget{
			EnvironmentId: environment.Id,
			DeploymentId:  deployment.Id,
			ResourceId:    resource.Id,
		}
		st.ReleaseTargets.Upsert(ctx, releaseTarget)
	}

	// Approval happens 1 hour after version creation
	approvalTime := baseTime.Add(1 * time.Hour)

	// Create approval policy
	approvalPolicy := &oapi.Policy{
		Enabled: true,
		Selectors: []oapi.PolicyTargetSelector{
			{
				ResourceSelector:    generateResourceSelector(),
				DeploymentSelector:  generateMatchAllSelector(),
				EnvironmentSelector: generateMatchAllSelector(),
			},
		},
		Rules: []oapi.PolicyRule{
			{
				AnyApproval: &oapi.AnyApprovalRule{
					MinApprovals: 1,
				},
			},
		},
	}
	st.Policies.Upsert(ctx, approvalPolicy)

	// Add approval
	st.UserApprovalRecords.Upsert(ctx, &oapi.UserApprovalRecord{
		VersionId:     version.Id,
		EnvironmentId: environment.Id,
		UserId:        "user-1",
		Status:        oapi.ApprovalStatusApproved,
		CreatedAt:     approvalTime.Format(time.RFC3339),
	})

	// Set time to 30 seconds after approval
	timeGetter := func() time.Time {
		return approvalTime.Add(30 * time.Second)
	}
	SetTestTimeGetterFactory(timeGetter)
	defer ClearTestTimeGetterFactory()

	rule := createGradualRolloutRule(oapi.GradualRolloutRuleRolloutTypeLinear, 60)
	eval := NewSummaryEvaluator(st, rule)

	scope := evaluator.EvaluatorScope{
		Environment: environment,
		Version:     version,
	}

	result := eval.Evaluate(ctx, scope)

	// Position 0 should be deployed, positions 1 and 2 pending
	assert.False(t, result.Allowed)
	assert.Equal(t, 3, result.Details["total_targets"])
	assert.Equal(t, 1, result.Details["deployed_targets"])
	assert.Equal(t, 2, result.Details["pending_targets"])

	// Rollout start time should be approval time, not version creation time
	assert.Equal(t, approvalTime.Format(time.RFC3339), result.Details["rollout_start_time"])

	_ = resources // suppress unused warning
}

// TestGradualRolloutEnvironmentSummaryEvaluator_SingleTarget tests with a single target
func TestGradualRolloutEnvironmentSummaryEvaluator_SingleTarget(t *testing.T) {
	ctx := t.Context()
	sc := statechange.NewChangeSet[any]()
	st := store.New("test-workspace", sc)

	systemID := uuid.New().String()
	environment := generateEnvironment(ctx, systemID, st)
	deployment := generateDeployment(ctx, systemID, st)
	resources := generateResources(ctx, 1, st)

	baseTime := time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC)
	version := generateDeploymentVersion(ctx, deployment.Id, baseTime, st)

	// Create release targets for each resource
	for _, resource := range resources {
		releaseTarget := &oapi.ReleaseTarget{
			EnvironmentId: environment.Id,
			DeploymentId:  deployment.Id,
			ResourceId:    resource.Id,
		}
		st.ReleaseTargets.Upsert(ctx, releaseTarget)
	}

	timeGetter := func() time.Time {
		return baseTime.Add(1 * time.Minute)
	}
	SetTestTimeGetterFactory(timeGetter)
	defer ClearTestTimeGetterFactory()

	rule := createGradualRolloutRule(oapi.GradualRolloutRuleRolloutTypeLinear, 60)
	eval := NewSummaryEvaluator(st, rule)

	scope := evaluator.EvaluatorScope{
		Environment: environment,
		Version:     version,
	}

	result := eval.Evaluate(ctx, scope)

	// Single target should be deployed immediately
	assert.True(t, result.Allowed)
	assert.Equal(t, "Rollout complete — All 1 target successfully deployed", result.Message)
	assert.Equal(t, 1, result.Details["total_targets"])
	assert.Equal(t, 1, result.Details["deployed_targets"])
	assert.Equal(t, 0, result.Details["pending_targets"])

	_ = resources // suppress unused warning
}

// TestGradualRolloutEnvironmentSummaryEvaluator_ZeroTimeScaleInterval tests that
// when timeScaleInterval is 0, all targets deploy immediately
func TestGradualRolloutEnvironmentSummaryEvaluator_ZeroTimeScaleInterval(t *testing.T) {
	ctx := t.Context()
	sc := statechange.NewChangeSet[any]()
	st := store.New("test-workspace", sc)

	systemID := uuid.New().String()
	environment := generateEnvironment(ctx, systemID, st)
	deployment := generateDeployment(ctx, systemID, st)
	resources := generateResources(ctx, 5, st)

	baseTime := time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC)
	version := generateDeploymentVersion(ctx, deployment.Id, baseTime, st)

	// Create release targets for each resource
	for _, resource := range resources {
		releaseTarget := &oapi.ReleaseTarget{
			EnvironmentId: environment.Id,
			DeploymentId:  deployment.Id,
			ResourceId:    resource.Id,
		}
		st.ReleaseTargets.Upsert(ctx, releaseTarget)
	}

	timeGetter := func() time.Time {
		return baseTime.Add(1 * time.Second)
	}
	SetTestTimeGetterFactory(timeGetter)
	defer ClearTestTimeGetterFactory()

	rule := createGradualRolloutRule(oapi.GradualRolloutRuleRolloutTypeLinear, 0) // Zero interval
	eval := NewSummaryEvaluator(st, rule)

	scope := evaluator.EvaluatorScope{
		Environment: environment,
		Version:     version,
	}

	result := eval.Evaluate(ctx, scope)

	// All targets should be deployed immediately
	assert.True(t, result.Allowed)
	assert.Equal(t, "Rollout complete — All 5 targets successfully deployed", result.Message)
	assert.Equal(t, 5, result.Details["total_targets"])
	assert.Equal(t, 5, result.Details["deployed_targets"])
	assert.Equal(t, 0, result.Details["pending_targets"])

	_ = resources // suppress unused warning
}
