package deploymentwindow

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator"
)

type mockGetters struct {
	hasRelease bool
	err        error
}

func (m *mockGetters) HasCurrentRelease(_ context.Context, _ *oapi.ReleaseTarget) (bool, error) {
	return m.hasRelease, m.err
}

//go:fix inline
func boolPtr(b bool) *bool {
	return new(b)
}

//go:fix inline
func stringPtr(s string) *string {
	return new(s)
}

func newTestScope() (context.Context, evaluator.EvaluatorScope) {
	return context.Background(), evaluator.EvaluatorScope{
		Environment: &oapi.Environment{Id: "env-1"},
		Resource:    &oapi.Resource{Id: "res-1"},
		Deployment:  &oapi.Deployment{Id: "dep-1"},
	}
}

func TestDeploymentWindowEvaluator_NewEvaluator_NilRule(t *testing.T) {
	g := &mockGetters{hasRelease: true}

	// Nil policy rule
	eval := NewEvaluator(g, nil)
	assert.Nil(t, eval, "expected nil evaluator for nil policy rule")

	// Nil deployment window in rule
	rule := &oapi.PolicyRule{Id: "rule-1"}
	eval = NewEvaluator(g, rule)
	assert.Nil(t, eval, "expected nil evaluator for rule without deployment window")

	// Nil getters
	eval = NewEvaluator(nil, &oapi.PolicyRule{
		Id: "rule-1",
		DeploymentWindow: &oapi.DeploymentWindowRule{
			Rrule:           "FREQ=DAILY",
			DurationMinutes: 60,
		},
	})
	assert.Nil(t, eval, "expected nil evaluator for nil getters")
}

func TestDeploymentWindowEvaluator_NewEvaluator_InvalidRRule(t *testing.T) {
	g := &mockGetters{hasRelease: true}

	rule := &oapi.PolicyRule{
		Id: "rule-1",
		DeploymentWindow: &oapi.DeploymentWindowRule{
			Rrule:           "INVALID_RRULE",
			DurationMinutes: 60,
		},
	}

	eval := NewEvaluator(g, rule)
	assert.Nil(t, eval, "expected nil evaluator for invalid rrule")
}

func TestDeploymentWindowEvaluator_ScopeFields(t *testing.T) {
	g := &mockGetters{hasRelease: true}

	rule := &oapi.PolicyRule{
		Id: "rule-1",
		DeploymentWindow: &oapi.DeploymentWindowRule{
			Rrule:           "FREQ=DAILY",
			DurationMinutes: 60,
		},
	}

	eval := NewEvaluator(g, rule)
	require.NotNil(t, eval, "expected non-nil evaluator")

	assert.Equal(t, evaluator.ScopeReleaseTarget, eval.ScopeFields())
}

func TestDeploymentWindowEvaluator_RuleType(t *testing.T) {
	g := &mockGetters{hasRelease: true}

	rule := &oapi.PolicyRule{
		Id: "rule-1",
		DeploymentWindow: &oapi.DeploymentWindowRule{
			Rrule:           "FREQ=DAILY",
			DurationMinutes: 60,
		},
	}

	eval := NewEvaluator(g, rule)
	require.NotNil(t, eval, "expected non-nil evaluator")

	assert.Equal(t, evaluator.RuleTypeDeploymentWindow, eval.RuleType())
}

func TestDeploymentWindowEvaluator_RuleId(t *testing.T) {
	g := &mockGetters{hasRelease: true}

	rule := &oapi.PolicyRule{
		Id: "test-rule-123",
		DeploymentWindow: &oapi.DeploymentWindowRule{
			Rrule:           "FREQ=DAILY",
			DurationMinutes: 60,
		},
	}

	eval := NewEvaluator(g, rule)
	require.NotNil(t, eval, "expected non-nil evaluator")

	assert.Equal(t, "test-rule-123", eval.RuleId())
}

func TestDeploymentWindowEvaluator_AllowWindow_InsideWindow(t *testing.T) {
	g := &mockGetters{hasRelease: true}

	rule := &oapi.PolicyRule{
		Id: "rule-1",
		DeploymentWindow: &oapi.DeploymentWindowRule{
			Rrule:           "FREQ=MINUTELY;INTERVAL=1",
			DurationMinutes: 60,
			AllowWindow:     new(true),
		},
	}

	eval := NewEvaluator(g, rule)
	require.NotNil(t, eval, "expected non-nil evaluator")

	ctx, scope := newTestScope()
	result := eval.Evaluate(ctx, scope)

	assert.True(t, result.Allowed, "expected allowed when inside allow window")
	assert.Contains(t, result.Message, "within allowed deployment window")
	assert.Equal(t, "allow", result.Details["window_type"])
	assert.NotNil(t, result.SatisfiedAt, "expected satisfiedAt to be set")
}

func TestDeploymentWindowEvaluator_AllowWindow_DefaultTrue(t *testing.T) {
	g := &mockGetters{hasRelease: true}

	rule := &oapi.PolicyRule{
		Id: "rule-1",
		DeploymentWindow: &oapi.DeploymentWindowRule{
			Rrule:           "FREQ=MINUTELY;INTERVAL=1",
			DurationMinutes: 60,
		},
	}

	eval := NewEvaluator(g, rule)
	require.NotNil(t, eval, "expected non-nil evaluator")

	ctx, scope := newTestScope()
	result := eval.Evaluate(ctx, scope)

	assert.True(t, result.Allowed, "expected allowed when inside allow window (default)")
	assert.Equal(t, "allow", result.Details["window_type"])
}

func TestDeploymentWindowEvaluator_DenyWindow_InsideWindow(t *testing.T) {
	g := &mockGetters{hasRelease: true}

	rule := &oapi.PolicyRule{
		Id: "rule-1",
		DeploymentWindow: &oapi.DeploymentWindowRule{
			Rrule:           "FREQ=MINUTELY;INTERVAL=1",
			DurationMinutes: 60,
			AllowWindow:     new(false),
		},
	}

	eval := NewEvaluator(g, rule)
	require.NotNil(t, eval, "expected non-nil evaluator")

	ctx, scope := newTestScope()
	result := eval.Evaluate(ctx, scope)

	assert.False(t, result.Allowed, "expected denied when inside deny window")
	assert.True(t, result.ActionRequired, "expected action required")
	assert.Contains(t, result.Message, "within deny window")
	assert.Equal(t, "deny", result.Details["window_type"])
	assert.Nil(t, result.SatisfiedAt, "expected no satisfiedAt when denied")
}

func TestDeploymentWindowEvaluator_DenyWindow_OutsideWindow(t *testing.T) {
	g := &mockGetters{hasRelease: true}

	rule := &oapi.PolicyRule{
		Id: "rule-1",
		DeploymentWindow: &oapi.DeploymentWindowRule{
			Rrule:           "FREQ=YEARLY;COUNT=1;DTSTART=20200101T000000Z",
			DurationMinutes: 1,
			AllowWindow:     new(false),
		},
	}

	eval := NewEvaluator(g, rule)
	require.NotNil(t, eval, "expected non-nil evaluator")

	ctx, scope := newTestScope()
	result := eval.Evaluate(ctx, scope)

	assert.True(t, result.Allowed, "expected allowed when outside deny window")
	assert.Contains(t, result.Message, "outside deny window")
	assert.Equal(t, "deny", result.Details["window_type"])
	assert.NotNil(t, result.SatisfiedAt, "expected satisfiedAt to be set")
}

func TestDeploymentWindowEvaluator_IgnoresWindowWithoutDeployedVersion(t *testing.T) {
	g := &mockGetters{hasRelease: false}

	rule := &oapi.PolicyRule{
		Id: "rule-1",
		DeploymentWindow: &oapi.DeploymentWindowRule{
			Rrule:           "FREQ=MINUTELY;INTERVAL=1",
			DurationMinutes: 60,
			AllowWindow:     new(false),
		},
	}

	eval := NewEvaluator(g, rule)
	require.NotNil(t, eval, "expected non-nil evaluator")

	ctx, scope := newTestScope()
	result := eval.Evaluate(ctx, scope)

	assert.True(t, result.Allowed, "expected allowed when no deployment exists")
	assert.Contains(t, result.Message, "deployment window ignored")
	assert.Equal(t, "first_deployment", result.Details["reason"])
}

func TestDeploymentWindowEvaluator_NextEvaluationTime(t *testing.T) {
	g := &mockGetters{hasRelease: true}

	rule := &oapi.PolicyRule{
		Id: "rule-1",
		DeploymentWindow: &oapi.DeploymentWindowRule{
			Rrule:           "FREQ=MINUTELY;INTERVAL=1",
			DurationMinutes: 60,
			AllowWindow:     new(true),
		},
	}

	eval := NewEvaluator(g, rule)
	require.NotNil(t, eval, "expected non-nil evaluator")

	ctx, scope := newTestScope()
	result := eval.Evaluate(ctx, scope)

	assert.NotNil(t, result.NextEvaluationTime, "expected nextEvaluationTime to be set")
}

func TestDeploymentWindowEvaluator_ResultDetails(t *testing.T) {
	g := &mockGetters{hasRelease: true}

	rruleStr := "FREQ=MINUTELY;INTERVAL=1"
	rule := &oapi.PolicyRule{
		Id: "rule-1",
		DeploymentWindow: &oapi.DeploymentWindowRule{
			Rrule:           rruleStr,
			DurationMinutes: 60,
			AllowWindow:     new(true),
		},
	}

	eval := NewEvaluator(g, rule)
	require.NotNil(t, eval, "expected non-nil evaluator")

	ctx, scope := newTestScope()
	result := eval.Evaluate(ctx, scope)

	assert.Contains(t, result.Details, "current_time")
	assert.Contains(t, result.Details, "window_type")
	assert.Contains(t, result.Details, "rrule")
	assert.Equal(t, rruleStr, result.Details["rrule"])
}

func TestDeploymentWindowEvaluator_Timezone(t *testing.T) {
	g := &mockGetters{hasRelease: true}

	rule := &oapi.PolicyRule{
		Id: "rule-1",
		DeploymentWindow: &oapi.DeploymentWindowRule{
			Rrule:           "FREQ=MINUTELY;INTERVAL=1",
			DurationMinutes: 60,
			Timezone:        new("America/New_York"),
			AllowWindow:     new(true),
		},
	}

	eval := NewEvaluator(g, rule)
	require.NotNil(t, eval, "expected non-nil evaluator with valid timezone")

	rule2 := &oapi.PolicyRule{
		Id: "rule-2",
		DeploymentWindow: &oapi.DeploymentWindowRule{
			Rrule:           "FREQ=MINUTELY;INTERVAL=1",
			DurationMinutes: 60,
			Timezone:        new("Invalid/Timezone"),
			AllowWindow:     new(true),
		},
	}

	eval2 := NewEvaluator(g, rule2)
	require.NotNil(t, eval2, "expected non-nil evaluator with invalid timezone (falls back to UTC)")
}

func TestDeploymentWindowEvaluator_Timezone_VariousTimezones(t *testing.T) {
	g := &mockGetters{hasRelease: true}

	validTimezones := []string{
		"UTC",
		"America/New_York",
		"America/Los_Angeles",
		"America/Chicago",
		"Europe/London",
		"Europe/Paris",
		"Europe/Berlin",
		"Asia/Tokyo",
		"Asia/Shanghai",
		"Asia/Singapore",
		"Australia/Sydney",
		"Pacific/Auckland",
	}

	for _, tz := range validTimezones {
		t.Run(tz, func(t *testing.T) {
			rule := &oapi.PolicyRule{
				Id: "rule-" + tz,
				DeploymentWindow: &oapi.DeploymentWindowRule{
					Rrule:           "FREQ=MINUTELY;INTERVAL=1",
					DurationMinutes: 60,
					Timezone:        new(tz),
					AllowWindow:     new(true),
				},
			}

			eval := NewEvaluator(g, rule)
			require.NotNil(t, eval, "expected non-nil evaluator for timezone: %s", tz)

			ctx, scope := newTestScope()
			result := eval.Evaluate(ctx, scope)
			assert.NotNil(t, result, "expected non-nil result for timezone: %s", tz)
		})
	}
}

func TestDeploymentWindowEvaluator_Timezone_NilTimezone(t *testing.T) {
	g := &mockGetters{hasRelease: true}

	rule := &oapi.PolicyRule{
		Id: "rule-1",
		DeploymentWindow: &oapi.DeploymentWindowRule{
			Rrule:           "FREQ=MINUTELY;INTERVAL=1",
			DurationMinutes: 60,
			Timezone:        nil,
			AllowWindow:     new(true),
		},
	}

	eval := NewEvaluator(g, rule)
	require.NotNil(t, eval, "expected non-nil evaluator with nil timezone")

	ctx, scope := newTestScope()
	result := eval.Evaluate(ctx, scope)
	assert.NotNil(t, result, "expected non-nil result")
	assert.True(t, result.Allowed, "expected allowed")
}

func TestDeploymentWindowEvaluator_Timezone_EmptyString(t *testing.T) {
	g := &mockGetters{hasRelease: true}

	rule := &oapi.PolicyRule{
		Id: "rule-1",
		DeploymentWindow: &oapi.DeploymentWindowRule{
			Rrule:           "FREQ=MINUTELY;INTERVAL=1",
			DurationMinutes: 60,
			Timezone:        new(""),
			AllowWindow:     new(true),
		},
	}

	eval := NewEvaluator(g, rule)
	require.NotNil(t, eval, "expected non-nil evaluator with empty timezone string")

	ctx, scope := newTestScope()
	result := eval.Evaluate(ctx, scope)
	assert.NotNil(t, result, "expected non-nil result")
	assert.True(t, result.Allowed, "expected allowed")
}

func TestDeploymentWindowEvaluator_Timezone_InvalidTimezones(t *testing.T) {
	g := &mockGetters{hasRelease: true}

	invalidTimezones := []string{
		"Invalid/Timezone",
		"NotATimezone",
		"America/Fake_City",
		"EST",
		"PST",
		"GMT+5",
		"12345",
	}

	for _, tz := range invalidTimezones {
		t.Run(tz, func(t *testing.T) {
			rule := &oapi.PolicyRule{
				Id: "rule-invalid",
				DeploymentWindow: &oapi.DeploymentWindowRule{
					Rrule:           "FREQ=MINUTELY;INTERVAL=1",
					DurationMinutes: 60,
					Timezone:        new(tz),
					AllowWindow:     new(true),
				},
			}

			eval := NewEvaluator(g, rule)
			require.NotNil(t, eval, "expected non-nil evaluator even with invalid timezone: %s", tz)

			ctx, scope := newTestScope()
			result := eval.Evaluate(ctx, scope)
			assert.NotNil(t, result, "expected non-nil result for invalid timezone: %s", tz)
		})
	}
}

func TestDeploymentWindowEvaluator_Timezone_USBusinessHours(t *testing.T) {
	g := &mockGetters{hasRelease: true}

	usTimezones := []struct {
		name     string
		timezone string
	}{
		{"Eastern", "America/New_York"},
		{"Central", "America/Chicago"},
		{"Mountain", "America/Denver"},
		{"Pacific", "America/Los_Angeles"},
	}

	for _, tc := range usTimezones {
		t.Run(tc.name, func(t *testing.T) {
			rule := &oapi.PolicyRule{
				Id: "rule-" + tc.name,
				DeploymentWindow: &oapi.DeploymentWindowRule{
					Rrule:           "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR;BYHOUR=9;BYMINUTE=0;BYSECOND=0",
					DurationMinutes: 480,
					Timezone:        new(tc.timezone),
					AllowWindow:     new(true),
				},
			}

			eval := NewEvaluator(g, rule)
			require.NotNil(t, eval, "expected non-nil evaluator for %s timezone", tc.name)

			ctx, scope := newTestScope()
			result := eval.Evaluate(ctx, scope)
			assert.NotNil(t, result, "expected non-nil result for %s timezone", tc.name)
			assert.Equal(t, "allow", result.Details["window_type"])
		})
	}
}

func TestDeploymentWindowEvaluator_Timezone_EuropeanBusinessHours(t *testing.T) {
	g := &mockGetters{hasRelease: true}

	euTimezones := []struct {
		name     string
		timezone string
	}{
		{"London", "Europe/London"},
		{"Paris", "Europe/Paris"},
		{"Berlin", "Europe/Berlin"},
		{"Amsterdam", "Europe/Amsterdam"},
	}

	for _, tc := range euTimezones {
		t.Run(tc.name, func(t *testing.T) {
			rule := &oapi.PolicyRule{
				Id: "rule-" + tc.name,
				DeploymentWindow: &oapi.DeploymentWindowRule{
					Rrule:           "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR;BYHOUR=9;BYMINUTE=0;BYSECOND=0",
					DurationMinutes: 540,
					Timezone:        new(tc.timezone),
					AllowWindow:     new(true),
				},
			}

			eval := NewEvaluator(g, rule)
			require.NotNil(t, eval, "expected non-nil evaluator for %s timezone", tc.name)

			ctx, scope := newTestScope()
			result := eval.Evaluate(ctx, scope)
			assert.NotNil(t, result, "expected non-nil result for %s timezone", tc.name)
		})
	}
}

func TestDeploymentWindowEvaluator_Timezone_AsiaPacificBusinessHours(t *testing.T) {
	g := &mockGetters{hasRelease: true}

	apacTimezones := []struct {
		name     string
		timezone string
	}{
		{"Tokyo", "Asia/Tokyo"},
		{"Singapore", "Asia/Singapore"},
		{"Sydney", "Australia/Sydney"},
		{"Auckland", "Pacific/Auckland"},
	}

	for _, tc := range apacTimezones {
		t.Run(tc.name, func(t *testing.T) {
			rule := &oapi.PolicyRule{
				Id: "rule-" + tc.name,
				DeploymentWindow: &oapi.DeploymentWindowRule{
					Rrule:           "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR;BYHOUR=9;BYMINUTE=0;BYSECOND=0",
					DurationMinutes: 480,
					Timezone:        new(tc.timezone),
					AllowWindow:     new(true),
				},
			}

			eval := NewEvaluator(g, rule)
			require.NotNil(t, eval, "expected non-nil evaluator for %s timezone", tc.name)

			ctx, scope := newTestScope()
			result := eval.Evaluate(ctx, scope)
			assert.NotNil(t, result, "expected non-nil result for %s timezone", tc.name)
		})
	}
}

func TestDeploymentWindowEvaluator_Timezone_MaintenanceWindowWithTimezone(t *testing.T) {
	g := &mockGetters{hasRelease: true}

	testCases := []struct {
		name        string
		timezone    string
		description string
	}{
		{"US_East_Sunday_Night", "America/New_York", "Sunday 2am-6am ET"},
		{"US_West_Sunday_Night", "America/Los_Angeles", "Sunday 2am-6am PT"},
		{"EU_Sunday_Night", "Europe/London", "Sunday 2am-6am GMT"},
		{"Asia_Sunday_Night", "Asia/Tokyo", "Sunday 2am-6am JST"},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			rule := &oapi.PolicyRule{
				Id: "rule-" + tc.name,
				DeploymentWindow: &oapi.DeploymentWindowRule{
					Rrule:           "FREQ=WEEKLY;BYDAY=SU;BYHOUR=2;BYMINUTE=0;BYSECOND=0",
					DurationMinutes: 240,
					Timezone:        new(tc.timezone),
					AllowWindow:     new(false),
				},
			}

			eval := NewEvaluator(g, rule)
			require.NotNil(t, eval, "expected non-nil evaluator for %s", tc.description)

			ctx, scope := newTestScope()
			result := eval.Evaluate(ctx, scope)
			assert.NotNil(t, result, "expected non-nil result for %s", tc.description)
			assert.Equal(t, "deny", result.Details["window_type"])
		})
	}
}

func TestDeploymentWindowEvaluator_Timezone_DSTAwareTimezones(t *testing.T) {
	g := &mockGetters{hasRelease: true}

	dstTimezones := []string{
		"America/New_York",
		"America/Los_Angeles",
		"Europe/London",
		"Europe/Paris",
		"Australia/Sydney",
	}

	for _, tz := range dstTimezones {
		t.Run(tz, func(t *testing.T) {
			rule := &oapi.PolicyRule{
				Id: "rule-dst",
				DeploymentWindow: &oapi.DeploymentWindowRule{
					Rrule:           "FREQ=DAILY;BYHOUR=12;BYMINUTE=0;BYSECOND=0",
					DurationMinutes: 60,
					Timezone:        new(tz),
					AllowWindow:     new(true),
				},
			}

			eval := NewEvaluator(g, rule)
			require.NotNil(t, eval, "expected non-nil evaluator for DST-aware timezone: %s", tz)

			ctx, scope := newTestScope()
			result := eval.Evaluate(ctx, scope)
			assert.NotNil(t, result, "expected non-nil result for DST-aware timezone: %s", tz)
		})
	}
}

func TestDeploymentWindowEvaluator_Timezone_NonDSTTimezones(t *testing.T) {
	g := &mockGetters{hasRelease: true}

	nonDstTimezones := []string{
		"UTC",
		"Asia/Tokyo",
		"Asia/Singapore",
		"Asia/Shanghai",
		"America/Phoenix",
		"Pacific/Honolulu",
	}

	for _, tz := range nonDstTimezones {
		t.Run(tz, func(t *testing.T) {
			rule := &oapi.PolicyRule{
				Id: "rule-non-dst",
				DeploymentWindow: &oapi.DeploymentWindowRule{
					Rrule:           "FREQ=DAILY;BYHOUR=12;BYMINUTE=0;BYSECOND=0",
					DurationMinutes: 60,
					Timezone:        new(tz),
					AllowWindow:     new(true),
				},
			}

			eval := NewEvaluator(g, rule)
			require.NotNil(t, eval, "expected non-nil evaluator for non-DST timezone: %s", tz)

			ctx, scope := newTestScope()
			result := eval.Evaluate(ctx, scope)
			assert.NotNil(t, result, "expected non-nil result for non-DST timezone: %s", tz)
		})
	}
}

func TestDeploymentWindowEvaluator_Complexity(t *testing.T) {
	g := &mockGetters{hasRelease: true}

	rule := &oapi.PolicyRule{
		Id: "rule-1",
		DeploymentWindow: &oapi.DeploymentWindowRule{
			Rrule:           "FREQ=DAILY",
			DurationMinutes: 60,
		},
	}

	eval := NewEvaluator(g, rule)
	require.NotNil(t, eval, "expected non-nil evaluator")

	assert.Equal(t, 2, eval.Complexity())
}

func TestValidateRRule_Valid(t *testing.T) {
	validRRules := []string{
		"FREQ=DAILY",
		"FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR",
		"FREQ=MONTHLY;BYMONTHDAY=1",
		"FREQ=YEARLY;BYMONTH=1;BYMONTHDAY=1",
		"FREQ=HOURLY;INTERVAL=2",
		"FREQ=MINUTELY;INTERVAL=30",
	}

	for _, rruleStr := range validRRules {
		err := ValidateRRule(rruleStr)
		require.NoError(t, err, "expected no error for valid rrule: %s", rruleStr)
	}
}

func TestValidateRRule_Invalid(t *testing.T) {
	invalidRRules := []string{
		"INVALID",
		"FREQ=INVALID",
		"",
		"FREQ=DAILY;BYDAY=INVALID",
	}

	for _, rruleStr := range invalidRRules {
		err := ValidateRRule(rruleStr)
		require.Error(t, err, "expected error for invalid rrule: %s", rruleStr)
	}
}

func TestDeploymentWindowEvaluator_WeeklyBusinessHours(t *testing.T) {
	g := &mockGetters{hasRelease: true}

	rule := &oapi.PolicyRule{
		Id: "rule-1",
		DeploymentWindow: &oapi.DeploymentWindowRule{
			Rrule:           "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR;BYHOUR=9;BYMINUTE=0;BYSECOND=0",
			DurationMinutes: 480,
			Timezone:        new("America/New_York"),
			AllowWindow:     new(true),
		},
	}

	eval := NewEvaluator(g, rule)
	require.NotNil(t, eval, "expected non-nil evaluator for business hours rule")

	ctx, scope := newTestScope()
	result := eval.Evaluate(ctx, scope)
	assert.NotNil(t, result, "expected non-nil result")
	assert.NotEmpty(t, result.Message, "expected message to be set")
}

func TestDeploymentWindowEvaluator_MaintenanceWindow(t *testing.T) {
	g := &mockGetters{hasRelease: true}

	rule := &oapi.PolicyRule{
		Id: "rule-1",
		DeploymentWindow: &oapi.DeploymentWindowRule{
			Rrule:           "FREQ=WEEKLY;BYDAY=SU;BYHOUR=2;BYMINUTE=0;BYSECOND=0",
			DurationMinutes: 240,
			Timezone:        new("UTC"),
			AllowWindow:     new(false),
		},
	}

	eval := NewEvaluator(g, rule)
	require.NotNil(t, eval, "expected non-nil evaluator for maintenance window rule")

	ctx, scope := newTestScope()
	result := eval.Evaluate(ctx, scope)
	assert.NotNil(t, result, "expected non-nil result")
	assert.Equal(t, "deny", result.Details["window_type"])
}

func TestDeploymentWindowEvaluator_ActionRequired(t *testing.T) {
	g := &mockGetters{hasRelease: true}

	rule := &oapi.PolicyRule{
		Id: "rule-1",
		DeploymentWindow: &oapi.DeploymentWindowRule{
			Rrule:           "FREQ=MINUTELY;INTERVAL=1",
			DurationMinutes: 60,
			AllowWindow:     new(false),
		},
	}

	eval := NewEvaluator(g, rule)
	require.NotNil(t, eval)

	ctx, scope := newTestScope()
	result := eval.Evaluate(ctx, scope)

	assert.True(t, result.ActionRequired, "expected action required when inside deny window")
	assert.Equal(t, oapi.RuleEvaluationActionType("wait"), *result.ActionType)
}

func TestDeploymentWindowEvaluator_MemoizationWorks(t *testing.T) {
	g := &mockGetters{hasRelease: true}

	rule := &oapi.PolicyRule{
		Id: "rule-1",
		DeploymentWindow: &oapi.DeploymentWindowRule{
			Rrule:           "FREQ=MINUTELY;INTERVAL=1",
			DurationMinutes: 60,
			AllowWindow:     new(true),
		},
	}

	eval := NewEvaluator(g, rule)
	require.NotNil(t, eval)

	ctx, scope := newTestScope()

	result1 := eval.Evaluate(ctx, scope)
	result2 := eval.Evaluate(ctx, scope)

	assert.Equal(t, result1.Allowed, result2.Allowed, "memoized results should be consistent")
}

func TestDeploymentWindowEvaluator_EnhancedMetadata_AllowWindowInside(t *testing.T) {
	g := &mockGetters{hasRelease: true}

	rule := &oapi.PolicyRule{
		Id: "rule-1",
		DeploymentWindow: &oapi.DeploymentWindowRule{
			Rrule:           "FREQ=MINUTELY;INTERVAL=1",
			DurationMinutes: 60,
			Timezone:        new("America/New_York"),
			AllowWindow:     new(true),
		},
	}

	eval := NewEvaluator(g, rule)
	require.NotNil(t, eval)

	ctx, scope := newTestScope()
	result := eval.Evaluate(ctx, scope)

	assert.True(t, result.Allowed)
	assert.Contains(t, result.Details, "current_time")
	assert.Contains(t, result.Details, "window_start")
	assert.Contains(t, result.Details, "window_end")
	assert.Contains(t, result.Details, "time_remaining")
	assert.Contains(t, result.Details, "duration_minutes")
	assert.Contains(t, result.Details, "timezone")
	assert.Contains(t, result.Details, "window_type")
	assert.Contains(t, result.Details, "rrule")

	assert.Equal(t, "allow", result.Details["window_type"])
	assert.Equal(t, int32(60), result.Details["duration_minutes"])
	assert.Equal(t, "America/New_York", result.Details["timezone"])
}

func TestDeploymentWindowEvaluator_EnhancedMetadata_DenyWindowInside(t *testing.T) {
	g := &mockGetters{hasRelease: true}

	rule := &oapi.PolicyRule{
		Id: "rule-1",
		DeploymentWindow: &oapi.DeploymentWindowRule{
			Rrule:           "FREQ=MINUTELY;INTERVAL=1",
			DurationMinutes: 60,
			Timezone:        new("UTC"),
			AllowWindow:     new(false),
		},
	}

	eval := NewEvaluator(g, rule)
	require.NotNil(t, eval)

	ctx, scope := newTestScope()
	result := eval.Evaluate(ctx, scope)

	assert.False(t, result.Allowed)
	assert.True(t, result.ActionRequired)
	assert.Contains(t, result.Details, "current_time")
	assert.Contains(t, result.Details, "window_start")
	assert.Contains(t, result.Details, "window_end")
	assert.Contains(t, result.Details, "time_until_clear")
	assert.Contains(t, result.Details, "duration_minutes")
	assert.Contains(t, result.Details, "timezone")
	assert.Contains(t, result.Details, "window_type")
	assert.Contains(t, result.Details, "rrule")

	assert.Equal(t, "deny", result.Details["window_type"])
	assert.Equal(t, int32(60), result.Details["duration_minutes"])
	assert.Equal(t, "UTC", result.Details["timezone"])
}

func TestDeploymentWindowEvaluator_EnhancedMetadata_DenyWindowOutside(t *testing.T) {
	g := &mockGetters{hasRelease: true}

	rule := &oapi.PolicyRule{
		Id: "rule-1",
		DeploymentWindow: &oapi.DeploymentWindowRule{
			Rrule:           "FREQ=YEARLY;COUNT=1;DTSTART=20200101T000000Z",
			DurationMinutes: 1,
			Timezone:        new("Europe/London"),
			AllowWindow:     new(false),
		},
	}

	eval := NewEvaluator(g, rule)
	require.NotNil(t, eval)

	ctx, scope := newTestScope()
	result := eval.Evaluate(ctx, scope)

	assert.True(t, result.Allowed)
	assert.Contains(t, result.Details, "current_time")
	assert.Contains(t, result.Details, "duration_minutes")
	assert.Contains(t, result.Details, "timezone")
	assert.Contains(t, result.Details, "window_type")
	assert.Contains(t, result.Details, "rrule")

	assert.Equal(t, "deny", result.Details["window_type"])
	assert.Equal(t, int32(1), result.Details["duration_minutes"])
	assert.Equal(t, "Europe/London", result.Details["timezone"])
}

func TestDeploymentWindowEvaluator_DailyBYHOUR_DetectsInsideWindow(t *testing.T) {
	g := &mockGetters{hasRelease: true}

	now := time.Now()
	windowStartHour := now.Add(-2 * time.Hour).UTC().Hour()

	rruleStr := fmt.Sprintf("FREQ=DAILY;BYHOUR=%d;BYMINUTE=0;BYSECOND=0", windowStartHour)

	rule := &oapi.PolicyRule{
		Id: "rule-byhour",
		DeploymentWindow: &oapi.DeploymentWindowRule{
			Rrule:           rruleStr,
			DurationMinutes: 240,
			AllowWindow:     new(true),
		},
	}

	eval := NewEvaluator(g, rule)
	require.NotNil(t, eval, "expected non-nil evaluator")

	ctx, scope := newTestScope()
	result := eval.Evaluate(ctx, scope)

	assert.True(
		t,
		result.Allowed,
		"expected allowed: we are inside the allow window (BYHOUR started 2h ago, duration 4h)",
	)
	assert.Contains(t, result.Message, "within allowed deployment window")
	assert.Equal(t, "allow", result.Details["window_type"])
}

func TestDeploymentWindowEvaluator_DailyBYHOUR_DenyWindow_DetectsInsideWindow(t *testing.T) {
	g := &mockGetters{hasRelease: true}

	now := time.Now()
	windowStartHour := now.Add(-1 * time.Hour).UTC().Hour()

	rruleStr := fmt.Sprintf("FREQ=DAILY;BYHOUR=%d;BYMINUTE=0;BYSECOND=0", windowStartHour)

	rule := &oapi.PolicyRule{
		Id: "rule-byhour-deny",
		DeploymentWindow: &oapi.DeploymentWindowRule{
			Rrule:           rruleStr,
			DurationMinutes: 180,
			AllowWindow:     new(false),
		},
	}

	eval := NewEvaluator(g, rule)
	require.NotNil(t, eval, "expected non-nil evaluator")

	ctx, scope := newTestScope()
	result := eval.Evaluate(ctx, scope)

	assert.False(
		t,
		result.Allowed,
		"expected denied: we are inside the deny window (BYHOUR started 1h ago, duration 3h)",
	)
	assert.Contains(t, result.Message, "within deny window")
	assert.Equal(t, "deny", result.Details["window_type"])
}

func TestDeploymentWindowEvaluator_TimeRemainingFormat(t *testing.T) {
	g := &mockGetters{hasRelease: true}

	rule := &oapi.PolicyRule{
		Id: "rule-1",
		DeploymentWindow: &oapi.DeploymentWindowRule{
			Rrule:           "FREQ=MINUTELY;INTERVAL=1",
			DurationMinutes: 120,
			AllowWindow:     new(true),
		},
	}

	eval := NewEvaluator(g, rule)
	require.NotNil(t, eval)

	ctx, scope := newTestScope()
	result := eval.Evaluate(ctx, scope)

	timeRemaining, ok := result.Details["time_remaining"].(string)
	assert.True(t, ok, "time_remaining should be a string")
	assert.NotEmpty(t, timeRemaining, "time_remaining should not be empty")
}
