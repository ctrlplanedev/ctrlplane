package approval

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator"
)

type mockGetters struct {
	records []*oapi.UserApprovalRecord
	err     error
}

func (m *mockGetters) GetApprovalRecords(
	_ context.Context, _, _ string,
) ([]*oapi.UserApprovalRecord, error) {
	return m.records, m.err
}

func newScope(versionCreatedAt time.Time) evaluator.EvaluatorScope {
	return evaluator.EvaluatorScope{
		Environment: &oapi.Environment{
			Id:   uuid.New().String(),
			Name: "test-env",
		},
		Version: &oapi.DeploymentVersion{
			Id:        uuid.New().String(),
			Name:      "v1",
			CreatedAt: versionCreatedAt,
		},
	}
}

func newPolicyRule(minApprovals int32, ruleCreatedAt string) *oapi.PolicyRule {
	return &oapi.PolicyRule{
		Id:        uuid.New().String(),
		CreatedAt: ruleCreatedAt,
		AnyApproval: &oapi.AnyApprovalRule{
			MinApprovals: minApprovals,
		},
	}
}

func record(userId string, createdAt time.Time) *oapi.UserApprovalRecord {
	return &oapi.UserApprovalRecord{
		UserId:    userId,
		CreatedAt: createdAt.Format(time.RFC3339),
		Status:    "approved",
	}
}

// ---------- parseTimestamp ----------

func TestParseTimestamp_Empty(t *testing.T) {
	ts, err := parseTimestamp("")
	require.NoError(t, err)
	assert.True(t, ts.IsZero())
}

func TestParseTimestamp_RFC3339(t *testing.T) {
	input := "2024-06-15T10:30:00Z"
	ts, err := parseTimestamp(input)
	require.NoError(t, err)
	assert.Equal(t, 2024, ts.Year())
	assert.Equal(t, time.Month(6), ts.Month())
	assert.Equal(t, 15, ts.Day())
}

func TestParseTimestamp_RFC3339Nano(t *testing.T) {
	input := "2024-06-15T10:30:00.123456789Z"
	ts, err := parseTimestamp(input)
	require.NoError(t, err)
	assert.Equal(t, 123456789, ts.Nanosecond())
}

func TestParseTimestamp_NoTimezone(t *testing.T) {
	input := "2024-06-15T10:30:00"
	ts, err := parseTimestamp(input)
	require.NoError(t, err)
	assert.Equal(t, 10, ts.Hour())
}

func TestParseTimestamp_MicrosecondNoTZ(t *testing.T) {
	input := "2024-06-15T10:30:00.123456"
	ts, err := parseTimestamp(input)
	require.NoError(t, err)
	assert.Equal(t, 123456000, ts.Nanosecond())
}

func TestParseTimestamp_Invalid(t *testing.T) {
	_, err := parseTimestamp("not-a-timestamp")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "failed to parse timestamp")
}

// ---------- NewEvaluator ----------

func TestNewEvaluator_NilPolicyRule(t *testing.T) {
	assert.Nil(t, NewEvaluator(&mockGetters{}, nil))
}

func TestNewEvaluator_NilAnyApproval(t *testing.T) {
	rule := &oapi.PolicyRule{Id: "r1"}
	assert.Nil(t, NewEvaluator(&mockGetters{}, rule))
}

func TestNewEvaluator_NilGetters(t *testing.T) {
	rule := newPolicyRule(1, time.Now().Format(time.RFC3339))
	assert.Nil(t, NewEvaluator(nil, rule))
}

func TestNewEvaluator_Valid(t *testing.T) {
	rule := newPolicyRule(1, time.Now().Format(time.RFC3339))
	eval := NewEvaluator(&mockGetters{}, rule)
	require.NotNil(t, eval)
}

// ---------- ScopeFields / RuleType / RuleId / Complexity ----------

func TestScopeFields(t *testing.T) {
	e := &AnyApprovalEvaluator{}
	assert.Equal(t, evaluator.ScopeEnvironment|evaluator.ScopeVersion, e.ScopeFields())
}

func TestRuleType(t *testing.T) {
	e := &AnyApprovalEvaluator{}
	assert.Equal(t, evaluator.RuleTypeApproval, e.RuleType())
}

func TestRuleId(t *testing.T) {
	e := &AnyApprovalEvaluator{ruleId: "rule-123"}
	assert.Equal(t, "rule-123", e.RuleId())
}

func TestComplexity(t *testing.T) {
	e := &AnyApprovalEvaluator{}
	assert.Equal(t, 1, e.Complexity())
}

// ---------- Evaluate: MinApprovals <= 0 ----------

func TestEvaluate_ZeroMinApprovals_Allowed(t *testing.T) {
	scope := newScope(time.Now())
	e := &AnyApprovalEvaluator{
		getters:       &mockGetters{},
		rule:          &oapi.AnyApprovalRule{MinApprovals: 0},
		ruleCreatedAt: time.Now().Format(time.RFC3339),
	}

	result := e.Evaluate(context.Background(), scope)
	assert.True(t, result.Allowed)
	assert.Contains(t, result.Message, "No approvals required")
	assert.NotNil(t, result.SatisfiedAt)
	assert.Equal(t, scope.Version.Id, result.Details["version_id"])
	assert.Equal(t, scope.Environment.Id, result.Details["environment_id"])
	assert.Equal(t, int32(0), result.Details["min_approvals"])
}

func TestEvaluate_NegativeMinApprovals_Allowed(t *testing.T) {
	scope := newScope(time.Now())
	e := &AnyApprovalEvaluator{
		getters:       &mockGetters{},
		rule:          &oapi.AnyApprovalRule{MinApprovals: -5},
		ruleCreatedAt: time.Now().Format(time.RFC3339),
	}

	result := e.Evaluate(context.Background(), scope)
	assert.True(t, result.Allowed)
	assert.Contains(t, result.Message, "No approvals required")
}

// ---------- Evaluate: getter error ----------

func TestEvaluate_GetterError_Pending(t *testing.T) {
	scope := newScope(time.Now())
	e := &AnyApprovalEvaluator{
		getters:       &mockGetters{err: fmt.Errorf("db connection lost")},
		rule:          &oapi.AnyApprovalRule{MinApprovals: 1},
		ruleCreatedAt: time.Now().Format(time.RFC3339),
	}

	result := e.Evaluate(context.Background(), scope)
	assert.False(t, result.Allowed)
	assert.True(t, result.ActionRequired)
	assert.Contains(t, result.Message, "Failed to get approval records")
	assert.Contains(t, result.Message, "db connection lost")
	assert.Equal(t, scope.Version.Id, result.Details["version_id"])
	assert.Equal(t, scope.Environment.Id, result.Details["environment_id"])
}

// ---------- Evaluate: enough approvals ----------

func TestEvaluate_ExactlyEnoughApprovals(t *testing.T) {
	now := time.Now()
	approvalTime := now.Add(-1 * time.Hour)
	scope := newScope(now)

	e := &AnyApprovalEvaluator{
		getters: &mockGetters{
			records: []*oapi.UserApprovalRecord{
				record("user-1", approvalTime),
			},
		},
		rule:          &oapi.AnyApprovalRule{MinApprovals: 1},
		ruleCreatedAt: now.Add(-2 * time.Hour).Format(time.RFC3339),
	}

	result := e.Evaluate(context.Background(), scope)
	assert.True(t, result.Allowed)
	assert.Contains(t, result.Message, "All approvals met (1/1)")
	require.NotNil(t, result.SatisfiedAt)
	assert.WithinDuration(t, approvalTime, *result.SatisfiedAt, time.Second)
}

func TestEvaluate_MoreThanEnoughApprovals(t *testing.T) {
	now := time.Now()
	scope := newScope(now)

	e := &AnyApprovalEvaluator{
		getters: &mockGetters{
			records: []*oapi.UserApprovalRecord{
				record("user-1", now.Add(-3*time.Hour)),
				record("user-2", now.Add(-2*time.Hour)),
				record("user-3", now.Add(-1*time.Hour)),
			},
		},
		rule:          &oapi.AnyApprovalRule{MinApprovals: 2},
		ruleCreatedAt: now.Add(-4 * time.Hour).Format(time.RFC3339),
	}

	result := e.Evaluate(context.Background(), scope)
	assert.True(t, result.Allowed)
	assert.Contains(t, result.Message, "All approvals met (3/2)")
}

func TestEvaluate_SatisfiedAtUsesNthApproval(t *testing.T) {
	now := time.Now()
	second := now.Add(-1 * time.Hour)
	scope := newScope(now)

	e := &AnyApprovalEvaluator{
		getters: &mockGetters{
			records: []*oapi.UserApprovalRecord{
				record("user-1", now.Add(-2*time.Hour)),
				record("user-2", second),
			},
		},
		rule:          &oapi.AnyApprovalRule{MinApprovals: 2},
		ruleCreatedAt: now.Add(-3 * time.Hour).Format(time.RFC3339),
	}

	result := e.Evaluate(context.Background(), scope)
	require.NotNil(t, result.SatisfiedAt)
	assert.WithinDuration(t, second, *result.SatisfiedAt, time.Second)
}

func TestEvaluate_ApproversDetail(t *testing.T) {
	now := time.Now()
	scope := newScope(now)

	e := &AnyApprovalEvaluator{
		getters: &mockGetters{
			records: []*oapi.UserApprovalRecord{
				record("alice", now.Add(-1*time.Hour)),
				record("bob", now.Add(-30*time.Minute)),
			},
		},
		rule:          &oapi.AnyApprovalRule{MinApprovals: 1},
		ruleCreatedAt: now.Add(-2 * time.Hour).Format(time.RFC3339),
	}

	result := e.Evaluate(context.Background(), scope)
	assert.True(t, result.Allowed)
	approvers, ok := result.Details["approvers"]
	require.True(t, ok)
	assert.Contains(t, approvers, "alice")
	assert.Contains(t, approvers, "bob")
}

// ---------- Evaluate: approval timestamp parse error ----------

func TestEvaluate_ApprovalTimestampParseError_AllowedWithoutSatisfiedAt(t *testing.T) {
	now := time.Now()
	scope := newScope(now)

	badRecord := &oapi.UserApprovalRecord{
		UserId:    "user-1",
		CreatedAt: "not-a-timestamp",
		Status:    "approved",
	}

	e := &AnyApprovalEvaluator{
		getters: &mockGetters{
			records: []*oapi.UserApprovalRecord{badRecord},
		},
		rule:          &oapi.AnyApprovalRule{MinApprovals: 1},
		ruleCreatedAt: now.Add(-1 * time.Hour).Format(time.RFC3339),
	}

	result := e.Evaluate(context.Background(), scope)
	assert.True(t, result.Allowed)
	assert.Contains(t, result.Message, "All approvals met (1/1)")
	assert.Nil(t, result.SatisfiedAt)
}

// ---------- Evaluate: not enough approvals, version before rule ----------

func TestEvaluate_VersionBeforeRule_Allowed(t *testing.T) {
	ruleCreated := time.Date(2024, 6, 15, 12, 0, 0, 0, time.UTC)
	versionCreated := ruleCreated.Add(-24 * time.Hour)
	scope := newScope(versionCreated)

	e := &AnyApprovalEvaluator{
		getters:       &mockGetters{records: []*oapi.UserApprovalRecord{}},
		rule:          &oapi.AnyApprovalRule{MinApprovals: 1},
		ruleCreatedAt: ruleCreated.Format(time.RFC3339),
	}

	result := e.Evaluate(context.Background(), scope)
	assert.True(t, result.Allowed)
	assert.Contains(t, result.Message, "Version was created before the policy was created")
	require.NotNil(t, result.SatisfiedAt)
	assert.Equal(t, versionCreated, *result.SatisfiedAt)
}

// ---------- Evaluate: not enough approvals, version after rule ----------

func TestEvaluate_NotEnoughApprovals_Pending(t *testing.T) {
	now := time.Now()
	scope := newScope(now)

	e := &AnyApprovalEvaluator{
		getters:       &mockGetters{records: []*oapi.UserApprovalRecord{}},
		rule:          &oapi.AnyApprovalRule{MinApprovals: 2},
		ruleCreatedAt: now.Add(-1 * time.Hour).Format(time.RFC3339),
	}

	result := e.Evaluate(context.Background(), scope)
	assert.False(t, result.Allowed)
	assert.True(t, result.ActionRequired)
	assert.Contains(t, result.Message, "Not enough approvals (0/2)")
	assert.Equal(t, 2, result.Details["min_approvals"])
}

func TestEvaluate_PartialApprovals_Pending(t *testing.T) {
	now := time.Now()
	scope := newScope(now)

	e := &AnyApprovalEvaluator{
		getters: &mockGetters{
			records: []*oapi.UserApprovalRecord{
				record("user-1", now.Add(-30*time.Minute)),
			},
		},
		rule:          &oapi.AnyApprovalRule{MinApprovals: 3},
		ruleCreatedAt: now.Add(-1 * time.Hour).Format(time.RFC3339),
	}

	result := e.Evaluate(context.Background(), scope)
	assert.False(t, result.Allowed)
	assert.True(t, result.ActionRequired)
	assert.Contains(t, result.Message, "Not enough approvals (1/3)")
	approvers := result.Details["approvers"].([]string)
	assert.Equal(t, []string{"user-1"}, approvers)
}

// ---------- Evaluate: ruleCreatedAt parse error ----------

func TestEvaluate_RuleCreatedAtParseError_Pending(t *testing.T) {
	now := time.Now()
	scope := newScope(now)

	e := &AnyApprovalEvaluator{
		getters:       &mockGetters{records: []*oapi.UserApprovalRecord{}},
		rule:          &oapi.AnyApprovalRule{MinApprovals: 1},
		ruleCreatedAt: "garbage-timestamp",
	}

	result := e.Evaluate(context.Background(), scope)
	assert.False(t, result.Allowed)
	assert.True(t, result.ActionRequired)
	assert.Contains(t, result.Message, "Failed to parse rule created_at")
}

// ---------- Evaluate: ruleCreatedAt empty string ----------

func TestEvaluate_RuleCreatedAtEmpty_VersionAlwaysBefore(t *testing.T) {
	scope := newScope(time.Now())

	e := &AnyApprovalEvaluator{
		getters:       &mockGetters{records: []*oapi.UserApprovalRecord{}},
		rule:          &oapi.AnyApprovalRule{MinApprovals: 1},
		ruleCreatedAt: "",
	}

	// parseTimestamp("") returns zero time; version.CreatedAt (now) is not before zero time
	result := e.Evaluate(context.Background(), scope)
	assert.False(t, result.Allowed)
	assert.True(t, result.ActionRequired)
	assert.Contains(t, result.Message, "Not enough approvals (0/1)")
}

// ---------- Integration: NewEvaluator through Evaluate ----------

func TestNewEvaluator_FullRoundTrip_Allowed(t *testing.T) {
	now := time.Now()
	approvalTime := now.Add(-30 * time.Minute)

	getter := &mockGetters{
		records: []*oapi.UserApprovalRecord{
			record("user-1", approvalTime),
		},
	}
	rule := newPolicyRule(1, now.Add(-1*time.Hour).Format(time.RFC3339))

	eval := NewEvaluator(getter, rule)
	require.NotNil(t, eval)

	scope := newScope(now)
	result := eval.Evaluate(context.Background(), scope)
	assert.True(t, result.Allowed)
	assert.Contains(t, result.Message, "All approvals met (1/1)")
}

func TestNewEvaluator_FullRoundTrip_Pending(t *testing.T) {
	now := time.Now()

	getter := &mockGetters{records: []*oapi.UserApprovalRecord{}}
	rule := newPolicyRule(2, now.Add(-1*time.Hour).Format(time.RFC3339))

	eval := NewEvaluator(getter, rule)
	require.NotNil(t, eval)

	scope := newScope(now)
	result := eval.Evaluate(context.Background(), scope)
	assert.False(t, result.Allowed)
	assert.True(t, result.ActionRequired)
	assert.Contains(t, result.Message, "Not enough approvals (0/2)")
}

func TestNewEvaluator_FullRoundTrip_MemoizationCaches(t *testing.T) {
	now := time.Now()
	getter := &mockGetters{
		records: []*oapi.UserApprovalRecord{
			record("user-1", now.Add(-30*time.Minute)),
		},
	}
	rule := newPolicyRule(1, now.Add(-1*time.Hour).Format(time.RFC3339))

	eval := NewEvaluator(getter, rule)
	require.NotNil(t, eval)

	scope := newScope(now)

	result1 := eval.Evaluate(context.Background(), scope)
	// Change the getter to return an error — second call should still
	// return the cached result since scope fields haven't changed.
	getter.err = fmt.Errorf("should not be called")
	result2 := eval.Evaluate(context.Background(), scope)

	assert.Equal(t, result1.Allowed, result2.Allowed)
	assert.Equal(t, result1.Message, result2.Message)
}
