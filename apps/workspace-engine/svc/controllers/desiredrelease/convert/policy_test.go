package convert

import (
	"encoding/json"
	"testing"
	"time"

	"workspace-engine/pkg/db"
	"workspace-engine/pkg/oapi"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func ptr[T any](v T) *T { return &v }

func emptyRulesRow() db.ListPoliciesWithRulesByWorkspaceIDRow {
	return db.ListPoliciesWithRulesByWorkspaceIDRow{
		ID:          uuid.MustParse("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"),
		Name:        "test-policy",
		Description: pgtype.Text{Valid: false},
		Selector:    "true",
		Metadata:    map[string]string{"env": "prod"},
		Priority:    10,
		Enabled:     true,
		WorkspaceID: uuid.MustParse("11111111-2222-3333-4444-555555555555"),
		CreatedAt: pgtype.Timestamptz{
			Time:  time.Date(2025, 6, 15, 12, 0, 0, 0, time.UTC),
			Valid: true,
		},
		AnyApprovalRules:            []byte("[]"),
		DeploymentDependencyRules:   []byte("[]"),
		DeploymentWindowRules:       []byte("[]"),
		EnvironmentProgressionRules: []byte("[]"),
		GradualRolloutRules:         []byte("[]"),
		RetryRules:                  []byte("[]"),
		RollbackRules:               []byte("[]"),
		VerificationRules:           []byte("[]"),
		VersionCooldownRules:        []byte("[]"),
		VersionSelectorRules:        []byte("[]"),
	}
}

func mustJSON(t *testing.T, v any) []byte {
	t.Helper()
	b, err := json.Marshal(v)
	require.NoError(t, err)
	return b
}

func TestPolicyWithRules_NoRules(t *testing.T) {
	row := emptyRulesRow()
	p, err := PolicyWithRules(row)
	require.NoError(t, err)

	assert.Equal(t, "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", p.Id)
	assert.Equal(t, "test-policy", p.Name)
	assert.Nil(t, p.Description)
	assert.Equal(t, "true", p.Selector)
	assert.Equal(t, map[string]string{"env": "prod"}, p.Metadata)
	assert.Equal(t, 10, p.Priority)
	assert.True(t, p.Enabled)
	assert.Equal(t, "11111111-2222-3333-4444-555555555555", p.WorkspaceId)
	assert.Equal(t, "2025-06-15T12:00:00Z", p.CreatedAt)
	assert.Empty(t, p.Rules)
}

func TestPolicyWithRules_DescriptionPresent(t *testing.T) {
	row := emptyRulesRow()
	row.Description = pgtype.Text{String: "my description", Valid: true}

	p, err := PolicyWithRules(row)
	require.NoError(t, err)

	require.NotNil(t, p.Description)
	assert.Equal(t, "my description", *p.Description)
}

func TestPolicyWithRules_CreatedAtZero(t *testing.T) {
	row := emptyRulesRow()
	row.CreatedAt = pgtype.Timestamptz{Valid: false}

	p, err := PolicyWithRules(row)
	require.NoError(t, err)

	assert.Equal(t, "", p.CreatedAt)
}

func TestPolicyWithRules_OneRuleOfEachType(t *testing.T) {
	row := emptyRulesRow()

	row.AnyApprovalRules = mustJSON(t, []rawAnyApproval{{
		ID: "aa-1", PolicyID: "pol-1", MinApprovals: 3, CreatedAt: "2025-01-01T00:00:00Z",
	}})
	row.DeploymentDependencyRules = mustJSON(t, []rawDeploymentDependency{{
		ID: "dd-1", PolicyID: "pol-1", DependsOn: "deployment.name == \"api\"", CreatedAt: "2025-01-02T00:00:00Z",
	}})
	tz := "America/New_York"
	row.DeploymentWindowRules = mustJSON(t, []rawDeploymentWindow{{
		ID: "dw-1", PolicyID: "pol-1", AllowWindow: ptr(true),
		DurationMinutes: 60, Rrule: "FREQ=WEEKLY;BYDAY=MO", Timezone: &tz,
		CreatedAt: "2025-01-03T00:00:00Z",
	}})
	row.EnvironmentProgressionRules = mustJSON(t, []rawEnvironmentProgression{{
		ID: "ep-1", PolicyID: "pol-1", DependsOnEnvironmentSelector: "environment.name == \"staging\"",
		MaximumAgeHours: ptr(int32(48)), MinimumSoakTimeMinutes: ptr(int32(30)),
		MinimumSuccessPercentage: ptr(float32(95.5)),
		SuccessStatuses:          &[]string{"successful"},
		CreatedAt:                "2025-01-04T00:00:00Z",
	}})
	row.GradualRolloutRules = mustJSON(t, []rawGradualRollout{{
		ID: "gr-1", PolicyID: "pol-1", RolloutType: "linear", TimeScaleInterval: 300,
		CreatedAt: "2025-01-05T00:00:00Z",
	}})
	row.RetryRules = mustJSON(t, []rawRetry{{
		ID: "rt-1", PolicyID: "pol-1", MaxRetries: 5,
		BackoffSeconds: ptr(int32(10)), BackoffStrategy: ptr("exponential"),
		MaxBackoffSeconds: ptr(int32(600)),
		RetryOnStatuses:   &[]string{"failure", "invalidIntegration"},
		CreatedAt:         "2025-01-06T00:00:00Z",
	}})
	row.RollbackRules = mustJSON(t, []rawRollback{{
		ID: "rb-1", PolicyID: "pol-1",
		OnJobStatuses: &[]string{"failure"}, OnVerificationFailure: ptr(true),
		CreatedAt: "2025-01-07T00:00:00Z",
	}})
	triggerOn := "new_release"
	row.VerificationRules = mustJSON(t, []rawVerification{{
		ID: "vr-1", PolicyID: "pol-1", Metrics: json.RawMessage(`[]`),
		TriggerOn: &triggerOn, CreatedAt: "2025-01-08T00:00:00Z",
	}})
	row.VersionCooldownRules = mustJSON(t, []rawVersionCooldown{{
		ID: "vc-1", PolicyID: "pol-1", IntervalSeconds: 3600,
		CreatedAt: "2025-01-09T00:00:00Z",
	}})
	row.VersionSelectorRules = mustJSON(t, []rawVersionSelector{{
		ID: "vs-1", PolicyID: "pol-1", Description: ptr("only v2"),
		Selector: "version.tag.startsWith(\"v2\")", CreatedAt: "2025-01-10T00:00:00Z",
	}})

	p, err := PolicyWithRules(row)
	require.NoError(t, err)
	require.Len(t, p.Rules, 10)

	ruleByID := make(map[string]oapi.PolicyRule, len(p.Rules))
	for _, r := range p.Rules {
		ruleByID[r.Id] = r
	}

	// AnyApproval
	r := ruleByID["aa-1"]
	assert.Equal(t, "pol-1", r.PolicyId)
	assert.Equal(t, "2025-01-01T00:00:00Z", r.CreatedAt)
	require.NotNil(t, r.AnyApproval)
	assert.Equal(t, int32(3), r.AnyApproval.MinApprovals)
	assert.Nil(t, r.DeploymentDependency)
	assert.Nil(t, r.DeploymentWindow)
	assert.Nil(t, r.EnvironmentProgression)
	assert.Nil(t, r.GradualRollout)
	assert.Nil(t, r.Retry)
	assert.Nil(t, r.Rollback)
	assert.Nil(t, r.Verification)
	assert.Nil(t, r.VersionCooldown)
	assert.Nil(t, r.VersionSelector)

	// DeploymentDependency
	r = ruleByID["dd-1"]
	assert.Equal(t, "pol-1", r.PolicyId)
	assert.Equal(t, "2025-01-02T00:00:00Z", r.CreatedAt)
	require.NotNil(t, r.DeploymentDependency)
	assert.Equal(t, "deployment.name == \"api\"", r.DeploymentDependency.DependsOn)
	assert.Nil(t, r.AnyApproval)

	// DeploymentWindow
	r = ruleByID["dw-1"]
	assert.Equal(t, "2025-01-03T00:00:00Z", r.CreatedAt)
	require.NotNil(t, r.DeploymentWindow)
	require.NotNil(t, r.DeploymentWindow.AllowWindow)
	assert.True(t, *r.DeploymentWindow.AllowWindow)
	assert.Equal(t, int32(60), r.DeploymentWindow.DurationMinutes)
	assert.Equal(t, "FREQ=WEEKLY;BYDAY=MO", r.DeploymentWindow.Rrule)
	require.NotNil(t, r.DeploymentWindow.Timezone)
	assert.Equal(t, "America/New_York", *r.DeploymentWindow.Timezone)

	// EnvironmentProgression
	r = ruleByID["ep-1"]
	assert.Equal(t, "2025-01-04T00:00:00Z", r.CreatedAt)
	require.NotNil(t, r.EnvironmentProgression)
	cel, err := r.EnvironmentProgression.DependsOnEnvironmentSelector.AsCelSelector()
	require.NoError(t, err)
	assert.Equal(t, "environment.name == \"staging\"", cel.Cel)
	require.NotNil(t, r.EnvironmentProgression.MaximumAgeHours)
	assert.Equal(t, int32(48), *r.EnvironmentProgression.MaximumAgeHours)
	require.NotNil(t, r.EnvironmentProgression.MinimumSockTimeMinutes)
	assert.Equal(t, int32(30), *r.EnvironmentProgression.MinimumSockTimeMinutes)
	require.NotNil(t, r.EnvironmentProgression.MinimumSuccessPercentage)
	assert.InDelta(t, float32(95.5), *r.EnvironmentProgression.MinimumSuccessPercentage, 0.01)
	require.NotNil(t, r.EnvironmentProgression.SuccessStatuses)
	assert.Equal(t, []oapi.JobStatus{"successful"}, *r.EnvironmentProgression.SuccessStatuses)

	// GradualRollout
	r = ruleByID["gr-1"]
	assert.Equal(t, "2025-01-05T00:00:00Z", r.CreatedAt)
	require.NotNil(t, r.GradualRollout)
	assert.Equal(t, oapi.GradualRolloutRuleRolloutType("linear"), r.GradualRollout.RolloutType)
	assert.Equal(t, int32(300), r.GradualRollout.TimeScaleInterval)

	// Retry
	r = ruleByID["rt-1"]
	assert.Equal(t, "2025-01-06T00:00:00Z", r.CreatedAt)
	require.NotNil(t, r.Retry)
	assert.Equal(t, int32(5), r.Retry.MaxRetries)
	require.NotNil(t, r.Retry.BackoffSeconds)
	assert.Equal(t, int32(10), *r.Retry.BackoffSeconds)
	require.NotNil(t, r.Retry.BackoffStrategy)
	assert.Equal(t, oapi.RetryRuleBackoffStrategy("exponential"), *r.Retry.BackoffStrategy)
	require.NotNil(t, r.Retry.MaxBackoffSeconds)
	assert.Equal(t, int32(600), *r.Retry.MaxBackoffSeconds)
	require.NotNil(t, r.Retry.RetryOnStatuses)
	assert.Equal(t, []oapi.JobStatus{"failure", "invalidIntegration"}, *r.Retry.RetryOnStatuses)

	// Rollback
	r = ruleByID["rb-1"]
	assert.Equal(t, "2025-01-07T00:00:00Z", r.CreatedAt)
	require.NotNil(t, r.Rollback)
	require.NotNil(t, r.Rollback.OnJobStatuses)
	assert.Equal(t, []oapi.JobStatus{"failure"}, *r.Rollback.OnJobStatuses)
	require.NotNil(t, r.Rollback.OnVerificationFailure)
	assert.True(t, *r.Rollback.OnVerificationFailure)

	// Verification
	r = ruleByID["vr-1"]
	assert.Equal(t, "2025-01-08T00:00:00Z", r.CreatedAt)
	require.NotNil(t, r.Verification)
	assert.Empty(t, r.Verification.Metrics)
	require.NotNil(t, r.Verification.TriggerOn)
	assert.Equal(t, oapi.VerificationRuleTriggerOn("new_release"), *r.Verification.TriggerOn)

	// VersionCooldown
	r = ruleByID["vc-1"]
	assert.Equal(t, "2025-01-09T00:00:00Z", r.CreatedAt)
	require.NotNil(t, r.VersionCooldown)
	assert.Equal(t, int32(3600), r.VersionCooldown.IntervalSeconds)

	// VersionSelector
	r = ruleByID["vs-1"]
	assert.Equal(t, "2025-01-10T00:00:00Z", r.CreatedAt)
	require.NotNil(t, r.VersionSelector)
	require.NotNil(t, r.VersionSelector.Description)
	assert.Equal(t, "only v2", *r.VersionSelector.Description)
	vsCel, err := r.VersionSelector.Selector.AsCelSelector()
	require.NoError(t, err)
	assert.Equal(t, "version.tag.startsWith(\"v2\")", vsCel.Cel)
}

func TestPolicyWithRules_NullableFieldsNil(t *testing.T) {
	row := emptyRulesRow()

	row.DeploymentWindowRules = mustJSON(t, []rawDeploymentWindow{{
		ID: "dw-1", PolicyID: "pol-1", AllowWindow: nil,
		DurationMinutes: 120, Rrule: "FREQ=DAILY", Timezone: nil,
		CreatedAt: "2025-01-01T00:00:00Z",
	}})
	row.RetryRules = mustJSON(t, []rawRetry{{
		ID: "rt-1", PolicyID: "pol-1", MaxRetries: 2,
		BackoffSeconds: nil, BackoffStrategy: nil, MaxBackoffSeconds: nil,
		RetryOnStatuses: nil, CreatedAt: "2025-01-02T00:00:00Z",
	}})
	row.RollbackRules = mustJSON(t, []rawRollback{{
		ID: "rb-1", PolicyID: "pol-1",
		OnJobStatuses: nil, OnVerificationFailure: nil,
		CreatedAt: "2025-01-03T00:00:00Z",
	}})
	row.VerificationRules = mustJSON(t, []rawVerification{{
		ID: "vr-1", PolicyID: "pol-1", Metrics: json.RawMessage(`[]`),
		TriggerOn: nil, CreatedAt: "2025-01-04T00:00:00Z",
	}})
	row.EnvironmentProgressionRules = mustJSON(t, []rawEnvironmentProgression{{
		ID: "ep-1", PolicyID: "pol-1", DependsOnEnvironmentSelector: "true",
		MaximumAgeHours: nil, MinimumSoakTimeMinutes: nil,
		MinimumSuccessPercentage: nil, SuccessStatuses: nil,
		CreatedAt: "2025-01-05T00:00:00Z",
	}})
	row.VersionSelectorRules = mustJSON(t, []rawVersionSelector{{
		ID: "vs-1", PolicyID: "pol-1", Description: nil,
		Selector: "true", CreatedAt: "2025-01-06T00:00:00Z",
	}})

	p, err := PolicyWithRules(row)
	require.NoError(t, err)
	require.Len(t, p.Rules, 6)

	ruleByID := make(map[string]oapi.PolicyRule, len(p.Rules))
	for _, r := range p.Rules {
		ruleByID[r.Id] = r
	}

	dw := ruleByID["dw-1"].DeploymentWindow
	require.NotNil(t, dw)
	assert.Nil(t, dw.AllowWindow)
	assert.Nil(t, dw.Timezone)

	rt := ruleByID["rt-1"].Retry
	require.NotNil(t, rt)
	assert.Equal(t, int32(2), rt.MaxRetries)
	assert.Nil(t, rt.BackoffSeconds)
	assert.Nil(t, rt.BackoffStrategy)
	assert.Nil(t, rt.MaxBackoffSeconds)
	assert.Nil(t, rt.RetryOnStatuses)

	rb := ruleByID["rb-1"].Rollback
	require.NotNil(t, rb)
	assert.Nil(t, rb.OnJobStatuses)
	assert.Nil(t, rb.OnVerificationFailure)

	vr := ruleByID["vr-1"].Verification
	require.NotNil(t, vr)
	assert.Nil(t, vr.TriggerOn)

	ep := ruleByID["ep-1"].EnvironmentProgression
	require.NotNil(t, ep)
	assert.Nil(t, ep.MaximumAgeHours)
	assert.Nil(t, ep.MinimumSockTimeMinutes)
	assert.Nil(t, ep.MinimumSuccessPercentage)
	assert.Nil(t, ep.SuccessStatuses)

	vs := ruleByID["vs-1"].VersionSelector
	require.NotNil(t, vs)
	assert.Nil(t, vs.Description)
}

func TestPolicyWithRules_MultipleRulesSameType(t *testing.T) {
	row := emptyRulesRow()

	tz1 := "UTC"
	tz2 := "Europe/London"
	row.DeploymentWindowRules = mustJSON(t, []rawDeploymentWindow{
		{
			ID: "dw-1", PolicyID: "pol-1", AllowWindow: ptr(true),
			DurationMinutes: 60, Rrule: "FREQ=WEEKLY;BYDAY=MO", Timezone: &tz1,
			CreatedAt: "2025-01-01T00:00:00Z",
		},
		{
			ID: "dw-2", PolicyID: "pol-1", AllowWindow: ptr(false),
			DurationMinutes: 120, Rrule: "FREQ=DAILY", Timezone: &tz2,
			CreatedAt: "2025-01-02T00:00:00Z",
		},
	})

	p, err := PolicyWithRules(row)
	require.NoError(t, err)

	require.Len(t, p.Rules, 2)

	ruleByID := make(map[string]oapi.PolicyRule, len(p.Rules))
	for _, r := range p.Rules {
		ruleByID[r.Id] = r
	}

	dw1 := ruleByID["dw-1"].DeploymentWindow
	require.NotNil(t, dw1)
	assert.Equal(t, int32(60), dw1.DurationMinutes)
	assert.Equal(t, "FREQ=WEEKLY;BYDAY=MO", dw1.Rrule)

	dw2 := ruleByID["dw-2"].DeploymentWindow
	require.NotNil(t, dw2)
	assert.Equal(t, int32(120), dw2.DurationMinutes)
	assert.Equal(t, "FREQ=DAILY", dw2.Rrule)
	require.NotNil(t, dw2.AllowWindow)
	assert.False(t, *dw2.AllowWindow)
}

func TestPolicyWithRules_MalformedJSON(t *testing.T) {
	tests := []struct {
		name  string
		setup func(row *db.ListPoliciesWithRulesByWorkspaceIDRow)
	}{
		{"AnyApprovalRules", func(r *db.ListPoliciesWithRulesByWorkspaceIDRow) { r.AnyApprovalRules = []byte("{bad") }},
		{"DeploymentDependencyRules", func(r *db.ListPoliciesWithRulesByWorkspaceIDRow) { r.DeploymentDependencyRules = []byte("{bad") }},
		{"DeploymentWindowRules", func(r *db.ListPoliciesWithRulesByWorkspaceIDRow) { r.DeploymentWindowRules = []byte("{bad") }},
		{"EnvironmentProgressionRules", func(r *db.ListPoliciesWithRulesByWorkspaceIDRow) { r.EnvironmentProgressionRules = []byte("{bad") }},
		{"GradualRolloutRules", func(r *db.ListPoliciesWithRulesByWorkspaceIDRow) { r.GradualRolloutRules = []byte("{bad") }},
		{"RetryRules", func(r *db.ListPoliciesWithRulesByWorkspaceIDRow) { r.RetryRules = []byte("{bad") }},
		{"RollbackRules", func(r *db.ListPoliciesWithRulesByWorkspaceIDRow) { r.RollbackRules = []byte("{bad") }},
		{"VerificationRules", func(r *db.ListPoliciesWithRulesByWorkspaceIDRow) { r.VerificationRules = []byte("{bad") }},
		{"VersionCooldownRules", func(r *db.ListPoliciesWithRulesByWorkspaceIDRow) { r.VersionCooldownRules = []byte("{bad") }},
		{"VersionSelectorRules", func(r *db.ListPoliciesWithRulesByWorkspaceIDRow) { r.VersionSelectorRules = []byte("{bad") }},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			row := emptyRulesRow()
			tc.setup(&row)
			_, err := PolicyWithRules(row)
			require.Error(t, err)
		})
	}
}

func TestPolicyWithRules_SelectorConversion(t *testing.T) {
	row := emptyRulesRow()

	celExpr := "environment.name == \"production\""
	row.EnvironmentProgressionRules = mustJSON(t, []rawEnvironmentProgression{{
		ID: "ep-1", PolicyID: "pol-1", DependsOnEnvironmentSelector: celExpr,
		CreatedAt: "2025-01-01T00:00:00Z",
	}})

	vsCelExpr := "version.tag.matches(\"^v[0-9]+\")"
	row.VersionSelectorRules = mustJSON(t, []rawVersionSelector{{
		ID: "vs-1", PolicyID: "pol-1", Selector: vsCelExpr,
		CreatedAt: "2025-01-02T00:00:00Z",
	}})

	p, err := PolicyWithRules(row)
	require.NoError(t, err)
	require.Len(t, p.Rules, 2)

	ruleByID := make(map[string]oapi.PolicyRule, len(p.Rules))
	for _, r := range p.Rules {
		ruleByID[r.Id] = r
	}

	epRule := ruleByID["ep-1"]
	require.NotNil(t, epRule.EnvironmentProgression)
	epCel, err := epRule.EnvironmentProgression.DependsOnEnvironmentSelector.AsCelSelector()
	require.NoError(t, err)
	assert.Equal(t, celExpr, epCel.Cel)

	vsRule := ruleByID["vs-1"]
	require.NotNil(t, vsRule.VersionSelector)
	vsCel, err := vsRule.VersionSelector.Selector.AsCelSelector()
	require.NoError(t, err)
	assert.Equal(t, vsCelExpr, vsCel.Cel)
}

func TestPolicyWithRules_VerificationWithMetrics(t *testing.T) {
	row := emptyRulesRow()

	metricsJSON := json.RawMessage(`[
		{
			"name": "health-check",
			"count": 5,
			"intervalSeconds": 30,
			"successCondition": "result.statusCode == 200",
			"provider": {"type": "sleep", "durationSeconds": 10}
		}
	]`)

	triggerOn := "new_release"
	row.VerificationRules = mustJSON(t, []rawVerification{{
		ID: "vr-1", PolicyID: "pol-1", Metrics: metricsJSON,
		TriggerOn: &triggerOn, CreatedAt: "2025-01-01T00:00:00Z",
	}})

	p, err := PolicyWithRules(row)
	require.NoError(t, err)
	require.Len(t, p.Rules, 1)

	vr := p.Rules[0]
	require.NotNil(t, vr.Verification)
	require.Len(t, vr.Verification.Metrics, 1)

	m := vr.Verification.Metrics[0]
	assert.Equal(t, "health-check", m.Name)
	assert.Equal(t, 5, m.Count)
	assert.Equal(t, int32(30), m.IntervalSeconds)
	assert.Equal(t, "result.statusCode == 200", m.SuccessCondition)

	sleepProvider, err := m.Provider.AsSleepMetricProvider()
	require.NoError(t, err)
	assert.Equal(t, int32(10), sleepProvider.DurationSeconds)
}

func TestPolicyWithRules_MalformedVerificationMetrics(t *testing.T) {
	row := emptyRulesRow()

	row.VerificationRules = []byte(`[{"id":"vr-1","policy_id":"pol-1","metrics":[{"bad json}],"created_at":"2025-01-01T00:00:00Z"}]`)

	_, err := PolicyWithRules(row)
	require.Error(t, err)
}
