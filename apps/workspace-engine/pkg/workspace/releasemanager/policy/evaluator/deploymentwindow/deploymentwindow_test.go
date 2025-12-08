package deploymentwindow

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

func setupStore() *store.Store {
	sc := statechange.NewChangeSet[any]()
	return store.New("test-workspace", sc)
}

func boolPtr(b bool) *bool {
	return &b
}

func stringPtr(s string) *string {
	return &s
}

func TestDeploymentWindowEvaluator_NewEvaluator_NilRule(t *testing.T) {
	st := setupStore()

	// Nil policy rule
	eval := NewEvaluator(st, nil)
	assert.Nil(t, eval, "expected nil evaluator for nil policy rule")

	// Nil deployment window in rule
	rule := &oapi.PolicyRule{Id: "rule-1"}
	eval = NewEvaluator(st, rule)
	assert.Nil(t, eval, "expected nil evaluator for rule without deployment window")

	// Nil store
	eval = NewEvaluator(nil, &oapi.PolicyRule{
		Id: "rule-1",
		DeploymentWindow: &oapi.DeploymentWindowRule{
			Rrule:           "FREQ=DAILY",
			DurationMinutes: 60,
		},
	})
	assert.Nil(t, eval, "expected nil evaluator for nil store")
}

func TestDeploymentWindowEvaluator_NewEvaluator_InvalidRRule(t *testing.T) {
	st := setupStore()

	rule := &oapi.PolicyRule{
		Id: "rule-1",
		DeploymentWindow: &oapi.DeploymentWindowRule{
			Rrule:           "INVALID_RRULE",
			DurationMinutes: 60,
		},
	}

	eval := NewEvaluator(st, rule)
	assert.Nil(t, eval, "expected nil evaluator for invalid rrule")
}

func TestDeploymentWindowEvaluator_ScopeFields(t *testing.T) {
	st := setupStore()

	rule := &oapi.PolicyRule{
		Id: "rule-1",
		DeploymentWindow: &oapi.DeploymentWindowRule{
			Rrule:           "FREQ=DAILY",
			DurationMinutes: 60,
		},
	}

	eval := NewEvaluator(st, rule)
	require.NotNil(t, eval, "expected non-nil evaluator")

	// Deployment window doesn't depend on any scope fields
	assert.Equal(t, evaluator.ScopeFields(0), eval.ScopeFields())
}

func TestDeploymentWindowEvaluator_RuleType(t *testing.T) {
	st := setupStore()

	rule := &oapi.PolicyRule{
		Id: "rule-1",
		DeploymentWindow: &oapi.DeploymentWindowRule{
			Rrule:           "FREQ=DAILY",
			DurationMinutes: 60,
		},
	}

	eval := NewEvaluator(st, rule)
	require.NotNil(t, eval, "expected non-nil evaluator")

	assert.Equal(t, evaluator.RuleTypeDeploymentWindow, eval.RuleType())
}

func TestDeploymentWindowEvaluator_RuleId(t *testing.T) {
	st := setupStore()

	rule := &oapi.PolicyRule{
		Id: "test-rule-123",
		DeploymentWindow: &oapi.DeploymentWindowRule{
			Rrule:           "FREQ=DAILY",
			DurationMinutes: 60,
		},
	}

	eval := NewEvaluator(st, rule)
	require.NotNil(t, eval, "expected non-nil evaluator")

	assert.Equal(t, "test-rule-123", eval.RuleId())
}

func TestDeploymentWindowEvaluator_AllowWindow_InsideWindow(t *testing.T) {
	st := setupStore()

	// Create a rule that runs every minute with a 60-minute duration
	// This ensures we're always inside the window
	rule := &oapi.PolicyRule{
		Id: "rule-1",
		DeploymentWindow: &oapi.DeploymentWindowRule{
			Rrule:           "FREQ=MINUTELY;INTERVAL=1",
			DurationMinutes: 60,
			AllowWindow:     boolPtr(true),
		},
	}

	eval := NewEvaluator(st, rule)
	require.NotNil(t, eval, "expected non-nil evaluator")

	scope := evaluator.EvaluatorScope{}
	result := eval.Evaluate(context.Background(), scope)

	assert.True(t, result.Allowed, "expected allowed when inside allow window")
	assert.Contains(t, result.Message, "within allowed deployment window")
	assert.Equal(t, "allow", result.Details["window_type"])
	assert.NotNil(t, result.SatisfiedAt, "expected satisfiedAt to be set")
}

func TestDeploymentWindowEvaluator_AllowWindow_DefaultTrue(t *testing.T) {
	st := setupStore()

	// AllowWindow should default to true when not specified
	rule := &oapi.PolicyRule{
		Id: "rule-1",
		DeploymentWindow: &oapi.DeploymentWindowRule{
			Rrule:           "FREQ=MINUTELY;INTERVAL=1",
			DurationMinutes: 60,
			// AllowWindow not specified, should default to true
		},
	}

	eval := NewEvaluator(st, rule)
	require.NotNil(t, eval, "expected non-nil evaluator")

	scope := evaluator.EvaluatorScope{}
	result := eval.Evaluate(context.Background(), scope)

	assert.True(t, result.Allowed, "expected allowed when inside allow window (default)")
	assert.Equal(t, "allow", result.Details["window_type"])
}

func TestDeploymentWindowEvaluator_DenyWindow_InsideWindow(t *testing.T) {
	st := setupStore()

	// Create a deny window that we're inside
	rule := &oapi.PolicyRule{
		Id: "rule-1",
		DeploymentWindow: &oapi.DeploymentWindowRule{
			Rrule:           "FREQ=MINUTELY;INTERVAL=1",
			DurationMinutes: 60,
			AllowWindow:     boolPtr(false), // Deny window
		},
	}

	eval := NewEvaluator(st, rule)
	require.NotNil(t, eval, "expected non-nil evaluator")

	scope := evaluator.EvaluatorScope{}
	result := eval.Evaluate(context.Background(), scope)

	assert.False(t, result.Allowed, "expected denied when inside deny window")
	assert.True(t, result.ActionRequired, "expected action required")
	assert.Contains(t, result.Message, "within deny window")
	assert.Equal(t, "deny", result.Details["window_type"])
	assert.Nil(t, result.SatisfiedAt, "expected no satisfiedAt when denied")
}

func TestDeploymentWindowEvaluator_DenyWindow_OutsideWindow(t *testing.T) {
	st := setupStore()

	// Create a deny window in the past that we're outside of
	// Using a specific start time in the distant past with short duration
	rule := &oapi.PolicyRule{
		Id: "rule-1",
		DeploymentWindow: &oapi.DeploymentWindowRule{
			// This creates a window that started at a specific time and only lasts 1 minute
			// Using UNTIL to limit it to a single occurrence in the past
			Rrule:           "FREQ=YEARLY;COUNT=1;DTSTART=20200101T000000Z",
			DurationMinutes: 1,
			AllowWindow:     boolPtr(false), // Deny window
		},
	}

	eval := NewEvaluator(st, rule)
	require.NotNil(t, eval, "expected non-nil evaluator")

	scope := evaluator.EvaluatorScope{}
	result := eval.Evaluate(context.Background(), scope)

	assert.True(t, result.Allowed, "expected allowed when outside deny window")
	assert.Contains(t, result.Message, "outside deny window")
	assert.Equal(t, "deny", result.Details["window_type"])
	assert.NotNil(t, result.SatisfiedAt, "expected satisfiedAt to be set")
}

func TestDeploymentWindowEvaluator_NextEvaluationTime(t *testing.T) {
	st := setupStore()

	// Create a rule where we're inside the window
	rule := &oapi.PolicyRule{
		Id: "rule-1",
		DeploymentWindow: &oapi.DeploymentWindowRule{
			Rrule:           "FREQ=MINUTELY;INTERVAL=1",
			DurationMinutes: 60,
			AllowWindow:     boolPtr(true),
		},
	}

	eval := NewEvaluator(st, rule)
	require.NotNil(t, eval, "expected non-nil evaluator")

	scope := evaluator.EvaluatorScope{}
	result := eval.Evaluate(context.Background(), scope)

	// When inside window, nextEvaluationTime should be when window closes
	assert.NotNil(t, result.NextEvaluationTime, "expected nextEvaluationTime to be set")
}

func TestDeploymentWindowEvaluator_ResultDetails(t *testing.T) {
	st := setupStore()

	rruleStr := "FREQ=MINUTELY;INTERVAL=1"
	rule := &oapi.PolicyRule{
		Id: "rule-1",
		DeploymentWindow: &oapi.DeploymentWindowRule{
			Rrule:           rruleStr,
			DurationMinutes: 60,
			AllowWindow:     boolPtr(true),
		},
	}

	eval := NewEvaluator(st, rule)
	require.NotNil(t, eval, "expected non-nil evaluator")

	scope := evaluator.EvaluatorScope{}
	result := eval.Evaluate(context.Background(), scope)

	// Check that all expected details are present
	assert.Contains(t, result.Details, "current_time")
	assert.Contains(t, result.Details, "window_type")
	assert.Contains(t, result.Details, "rrule")
	assert.Equal(t, rruleStr, result.Details["rrule"])
}

func TestDeploymentWindowEvaluator_Timezone(t *testing.T) {
	st := setupStore()

	// Test with explicit timezone
	rule := &oapi.PolicyRule{
		Id: "rule-1",
		DeploymentWindow: &oapi.DeploymentWindowRule{
			Rrule:           "FREQ=MINUTELY;INTERVAL=1",
			DurationMinutes: 60,
			Timezone:        stringPtr("America/New_York"),
			AllowWindow:     boolPtr(true),
		},
	}

	eval := NewEvaluator(st, rule)
	require.NotNil(t, eval, "expected non-nil evaluator with valid timezone")

	// Test with invalid timezone (should fall back to UTC)
	rule2 := &oapi.PolicyRule{
		Id: "rule-2",
		DeploymentWindow: &oapi.DeploymentWindowRule{
			Rrule:           "FREQ=MINUTELY;INTERVAL=1",
			DurationMinutes: 60,
			Timezone:        stringPtr("Invalid/Timezone"),
			AllowWindow:     boolPtr(true),
		},
	}

	eval2 := NewEvaluator(st, rule2)
	require.NotNil(t, eval2, "expected non-nil evaluator with invalid timezone (falls back to UTC)")
}

func TestDeploymentWindowEvaluator_Timezone_VariousTimezones(t *testing.T) {
	st := setupStore()

	// Test various valid IANA timezones
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
					Timezone:        stringPtr(tz),
					AllowWindow:     boolPtr(true),
				},
			}

			eval := NewEvaluator(st, rule)
			require.NotNil(t, eval, "expected non-nil evaluator for timezone: %s", tz)

			scope := evaluator.EvaluatorScope{}
			result := eval.Evaluate(context.Background(), scope)
			assert.NotNil(t, result, "expected non-nil result for timezone: %s", tz)
		})
	}
}

func TestDeploymentWindowEvaluator_Timezone_NilTimezone(t *testing.T) {
	st := setupStore()

	// Test with nil timezone (should default to UTC)
	rule := &oapi.PolicyRule{
		Id: "rule-1",
		DeploymentWindow: &oapi.DeploymentWindowRule{
			Rrule:           "FREQ=MINUTELY;INTERVAL=1",
			DurationMinutes: 60,
			Timezone:        nil, // Explicitly nil
			AllowWindow:     boolPtr(true),
		},
	}

	eval := NewEvaluator(st, rule)
	require.NotNil(t, eval, "expected non-nil evaluator with nil timezone")

	scope := evaluator.EvaluatorScope{}
	result := eval.Evaluate(context.Background(), scope)
	assert.NotNil(t, result, "expected non-nil result")
	assert.True(t, result.Allowed, "expected allowed")
}

func TestDeploymentWindowEvaluator_Timezone_EmptyString(t *testing.T) {
	st := setupStore()

	// Test with empty string timezone (should default to UTC)
	rule := &oapi.PolicyRule{
		Id: "rule-1",
		DeploymentWindow: &oapi.DeploymentWindowRule{
			Rrule:           "FREQ=MINUTELY;INTERVAL=1",
			DurationMinutes: 60,
			Timezone:        stringPtr(""), // Empty string
			AllowWindow:     boolPtr(true),
		},
	}

	eval := NewEvaluator(st, rule)
	require.NotNil(t, eval, "expected non-nil evaluator with empty timezone string")

	scope := evaluator.EvaluatorScope{}
	result := eval.Evaluate(context.Background(), scope)
	assert.NotNil(t, result, "expected non-nil result")
	assert.True(t, result.Allowed, "expected allowed")
}

func TestDeploymentWindowEvaluator_Timezone_InvalidTimezones(t *testing.T) {
	st := setupStore()

	// Test various invalid timezones (should fall back to UTC)
	invalidTimezones := []string{
		"Invalid/Timezone",
		"NotATimezone",
		"America/Fake_City",
		"EST", // Abbreviations are not valid IANA names
		"PST",
		"GMT+5", // Offset formats are not IANA
		"12345",
	}

	for _, tz := range invalidTimezones {
		t.Run(tz, func(t *testing.T) {
			rule := &oapi.PolicyRule{
				Id: "rule-invalid",
				DeploymentWindow: &oapi.DeploymentWindowRule{
					Rrule:           "FREQ=MINUTELY;INTERVAL=1",
					DurationMinutes: 60,
					Timezone:        stringPtr(tz),
					AllowWindow:     boolPtr(true),
				},
			}

			// Should still create evaluator (falls back to UTC)
			eval := NewEvaluator(st, rule)
			require.NotNil(t, eval, "expected non-nil evaluator even with invalid timezone: %s", tz)

			scope := evaluator.EvaluatorScope{}
			result := eval.Evaluate(context.Background(), scope)
			assert.NotNil(t, result, "expected non-nil result for invalid timezone: %s", tz)
		})
	}
}

func TestDeploymentWindowEvaluator_Timezone_USBusinessHours(t *testing.T) {
	st := setupStore()

	// Test US timezones with business hours pattern
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
					// Business hours: 9am-5pm on weekdays
					Rrule:           "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR;BYHOUR=9;BYMINUTE=0;BYSECOND=0",
					DurationMinutes: 480, // 8 hours
					Timezone:        stringPtr(tc.timezone),
					AllowWindow:     boolPtr(true),
				},
			}

			eval := NewEvaluator(st, rule)
			require.NotNil(t, eval, "expected non-nil evaluator for %s timezone", tc.name)

			scope := evaluator.EvaluatorScope{}
			result := eval.Evaluate(context.Background(), scope)
			assert.NotNil(t, result, "expected non-nil result for %s timezone", tc.name)
			assert.Equal(t, "allow", result.Details["window_type"])
		})
	}
}

func TestDeploymentWindowEvaluator_Timezone_EuropeanBusinessHours(t *testing.T) {
	st := setupStore()

	// Test European timezones
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
					// Business hours: 9am-6pm on weekdays (European style)
					Rrule:           "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR;BYHOUR=9;BYMINUTE=0;BYSECOND=0",
					DurationMinutes: 540, // 9 hours
					Timezone:        stringPtr(tc.timezone),
					AllowWindow:     boolPtr(true),
				},
			}

			eval := NewEvaluator(st, rule)
			require.NotNil(t, eval, "expected non-nil evaluator for %s timezone", tc.name)

			scope := evaluator.EvaluatorScope{}
			result := eval.Evaluate(context.Background(), scope)
			assert.NotNil(t, result, "expected non-nil result for %s timezone", tc.name)
		})
	}
}

func TestDeploymentWindowEvaluator_Timezone_AsiaPacificBusinessHours(t *testing.T) {
	st := setupStore()

	// Test Asia-Pacific timezones
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
					// Business hours pattern
					Rrule:           "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR;BYHOUR=9;BYMINUTE=0;BYSECOND=0",
					DurationMinutes: 480, // 8 hours
					Timezone:        stringPtr(tc.timezone),
					AllowWindow:     boolPtr(true),
				},
			}

			eval := NewEvaluator(st, rule)
			require.NotNil(t, eval, "expected non-nil evaluator for %s timezone", tc.name)

			scope := evaluator.EvaluatorScope{}
			result := eval.Evaluate(context.Background(), scope)
			assert.NotNil(t, result, "expected non-nil result for %s timezone", tc.name)
		})
	}
}

func TestDeploymentWindowEvaluator_Timezone_MaintenanceWindowWithTimezone(t *testing.T) {
	st := setupStore()

	// Test maintenance windows in different timezones
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
					// Maintenance window: Sunday 2am-6am
					Rrule:           "FREQ=WEEKLY;BYDAY=SU;BYHOUR=2;BYMINUTE=0;BYSECOND=0",
					DurationMinutes: 240, // 4 hours
					Timezone:        stringPtr(tc.timezone),
					AllowWindow:     boolPtr(false), // Deny during maintenance
				},
			}

			eval := NewEvaluator(st, rule)
			require.NotNil(t, eval, "expected non-nil evaluator for %s", tc.description)

			scope := evaluator.EvaluatorScope{}
			result := eval.Evaluate(context.Background(), scope)
			assert.NotNil(t, result, "expected non-nil result for %s", tc.description)
			assert.Equal(t, "deny", result.Details["window_type"])
		})
	}
}

func TestDeploymentWindowEvaluator_Timezone_DSTAwareTimezones(t *testing.T) {
	st := setupStore()

	// Test timezones that observe DST
	// These should handle DST transitions gracefully
	dstTimezones := []string{
		"America/New_York",    // US Eastern (observes DST)
		"America/Los_Angeles", // US Pacific (observes DST)
		"Europe/London",       // UK (observes BST)
		"Europe/Paris",        // France (observes CEST)
		"Australia/Sydney",    // Australia (observes AEDT)
	}

	for _, tz := range dstTimezones {
		t.Run(tz, func(t *testing.T) {
			rule := &oapi.PolicyRule{
				Id: "rule-dst",
				DeploymentWindow: &oapi.DeploymentWindowRule{
					Rrule:           "FREQ=DAILY;BYHOUR=12;BYMINUTE=0;BYSECOND=0",
					DurationMinutes: 60,
					Timezone:        stringPtr(tz),
					AllowWindow:     boolPtr(true),
				},
			}

			eval := NewEvaluator(st, rule)
			require.NotNil(t, eval, "expected non-nil evaluator for DST-aware timezone: %s", tz)

			scope := evaluator.EvaluatorScope{}
			result := eval.Evaluate(context.Background(), scope)
			assert.NotNil(t, result, "expected non-nil result for DST-aware timezone: %s", tz)
		})
	}
}

func TestDeploymentWindowEvaluator_Timezone_NonDSTTimezones(t *testing.T) {
	st := setupStore()

	// Test timezones that do NOT observe DST
	nonDstTimezones := []string{
		"UTC",
		"Asia/Tokyo",       // Japan doesn't observe DST
		"Asia/Singapore",   // Singapore doesn't observe DST
		"Asia/Shanghai",    // China doesn't observe DST
		"America/Phoenix",  // Arizona (mostly) doesn't observe DST
		"Pacific/Honolulu", // Hawaii doesn't observe DST
	}

	for _, tz := range nonDstTimezones {
		t.Run(tz, func(t *testing.T) {
			rule := &oapi.PolicyRule{
				Id: "rule-non-dst",
				DeploymentWindow: &oapi.DeploymentWindowRule{
					Rrule:           "FREQ=DAILY;BYHOUR=12;BYMINUTE=0;BYSECOND=0",
					DurationMinutes: 60,
					Timezone:        stringPtr(tz),
					AllowWindow:     boolPtr(true),
				},
			}

			eval := NewEvaluator(st, rule)
			require.NotNil(t, eval, "expected non-nil evaluator for non-DST timezone: %s", tz)

			scope := evaluator.EvaluatorScope{}
			result := eval.Evaluate(context.Background(), scope)
			assert.NotNil(t, result, "expected non-nil result for non-DST timezone: %s", tz)
		})
	}
}

func TestDeploymentWindowEvaluator_Complexity(t *testing.T) {
	st := setupStore()

	rule := &oapi.PolicyRule{
		Id: "rule-1",
		DeploymentWindow: &oapi.DeploymentWindowRule{
			Rrule:           "FREQ=DAILY",
			DurationMinutes: 60,
		},
	}

	eval := NewEvaluator(st, rule)
	require.NotNil(t, eval, "expected non-nil evaluator")

	assert.Equal(t, 1, eval.Complexity())
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
		assert.NoError(t, err, "expected no error for valid rrule: %s", rruleStr)
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
		assert.Error(t, err, "expected error for invalid rrule: %s", rruleStr)
	}
}

func TestDeploymentWindowEvaluator_WeeklyBusinessHours(t *testing.T) {
	st := setupStore()

	// Simulate business hours: Monday-Friday 9am-5pm (8 hours = 480 minutes)
	// This test verifies the rule can be created and evaluated
	rule := &oapi.PolicyRule{
		Id: "rule-1",
		DeploymentWindow: &oapi.DeploymentWindowRule{
			Rrule:           "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR;BYHOUR=9;BYMINUTE=0;BYSECOND=0",
			DurationMinutes: 480, // 8 hours
			Timezone:        stringPtr("America/New_York"),
			AllowWindow:     boolPtr(true),
		},
	}

	eval := NewEvaluator(st, rule)
	require.NotNil(t, eval, "expected non-nil evaluator for business hours rule")

	// Just verify it can evaluate without error
	scope := evaluator.EvaluatorScope{}
	result := eval.Evaluate(context.Background(), scope)
	assert.NotNil(t, result, "expected non-nil result")
	assert.NotEmpty(t, result.Message, "expected message to be set")
}

func TestDeploymentWindowEvaluator_MaintenanceWindow(t *testing.T) {
	st := setupStore()

	// Simulate maintenance window: Every Sunday 2am-6am (4 hours = 240 minutes)
	rule := &oapi.PolicyRule{
		Id: "rule-1",
		DeploymentWindow: &oapi.DeploymentWindowRule{
			Rrule:           "FREQ=WEEKLY;BYDAY=SU;BYHOUR=2;BYMINUTE=0;BYSECOND=0",
			DurationMinutes: 240, // 4 hours
			Timezone:        stringPtr("UTC"),
			AllowWindow:     boolPtr(false), // Deny deployments during maintenance
		},
	}

	eval := NewEvaluator(st, rule)
	require.NotNil(t, eval, "expected non-nil evaluator for maintenance window rule")

	// Just verify it can evaluate without error
	scope := evaluator.EvaluatorScope{}
	result := eval.Evaluate(context.Background(), scope)
	assert.NotNil(t, result, "expected non-nil result")
	assert.Equal(t, "deny", result.Details["window_type"])
}

func TestDeploymentWindowEvaluator_ActionRequired(t *testing.T) {
	st := setupStore()

	// Create a deny window that we're inside
	rule := &oapi.PolicyRule{
		Id: "rule-1",
		DeploymentWindow: &oapi.DeploymentWindowRule{
			Rrule:           "FREQ=MINUTELY;INTERVAL=1",
			DurationMinutes: 60,
			AllowWindow:     boolPtr(false), // Deny window
		},
	}

	eval := NewEvaluator(st, rule)
	require.NotNil(t, eval)

	scope := evaluator.EvaluatorScope{}
	result := eval.Evaluate(context.Background(), scope)

	// When inside deny window, should require action (wait)
	assert.True(t, result.ActionRequired, "expected action required when inside deny window")
	assert.Equal(t, oapi.RuleEvaluationActionType("wait"), *result.ActionType)
}

func TestDeploymentWindowEvaluator_MemoizationWorks(t *testing.T) {
	st := setupStore()

	rule := &oapi.PolicyRule{
		Id: "rule-1",
		DeploymentWindow: &oapi.DeploymentWindowRule{
			Rrule:           "FREQ=MINUTELY;INTERVAL=1",
			DurationMinutes: 60,
			AllowWindow:     boolPtr(true),
		},
	}

	eval := NewEvaluator(st, rule)
	require.NotNil(t, eval)

	scope := evaluator.EvaluatorScope{}

	// Call multiple times - should work with memoization
	result1 := eval.Evaluate(context.Background(), scope)
	result2 := eval.Evaluate(context.Background(), scope)

	assert.Equal(t, result1.Allowed, result2.Allowed, "memoized results should be consistent")
}

func TestDeploymentWindowEvaluator_EnhancedMetadata_AllowWindowInside(t *testing.T) {
	st := setupStore()

	// Create rule that we're always inside
	rule := &oapi.PolicyRule{
		Id: "rule-1",
		DeploymentWindow: &oapi.DeploymentWindowRule{
			Rrule:           "FREQ=MINUTELY;INTERVAL=1",
			DurationMinutes: 60,
			Timezone:        stringPtr("America/New_York"),
			AllowWindow:     boolPtr(true),
		},
	}

	eval := NewEvaluator(st, rule)
	require.NotNil(t, eval)

	scope := evaluator.EvaluatorScope{}
	result := eval.Evaluate(context.Background(), scope)

	// Verify enhanced metadata fields
	assert.True(t, result.Allowed)
	assert.Contains(t, result.Details, "current_time")
	assert.Contains(t, result.Details, "window_start")
	assert.Contains(t, result.Details, "window_end")
	assert.Contains(t, result.Details, "time_remaining")
	assert.Contains(t, result.Details, "duration_minutes")
	assert.Contains(t, result.Details, "timezone")
	assert.Contains(t, result.Details, "window_type")
	assert.Contains(t, result.Details, "rrule")

	// Check values
	assert.Equal(t, "allow", result.Details["window_type"])
	assert.Equal(t, int32(60), result.Details["duration_minutes"])
	assert.Equal(t, "America/New_York", result.Details["timezone"])
}

func TestDeploymentWindowEvaluator_EnhancedMetadata_DenyWindowInside(t *testing.T) {
	st := setupStore()

	// Create deny window that we're always inside
	rule := &oapi.PolicyRule{
		Id: "rule-1",
		DeploymentWindow: &oapi.DeploymentWindowRule{
			Rrule:           "FREQ=MINUTELY;INTERVAL=1",
			DurationMinutes: 60,
			Timezone:        stringPtr("UTC"),
			AllowWindow:     boolPtr(false),
		},
	}

	eval := NewEvaluator(st, rule)
	require.NotNil(t, eval)

	scope := evaluator.EvaluatorScope{}
	result := eval.Evaluate(context.Background(), scope)

	// Verify enhanced metadata fields for deny window
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

	// Check values
	assert.Equal(t, "deny", result.Details["window_type"])
	assert.Equal(t, int32(60), result.Details["duration_minutes"])
	assert.Equal(t, "UTC", result.Details["timezone"])
}

func TestDeploymentWindowEvaluator_EnhancedMetadata_DenyWindowOutside(t *testing.T) {
	st := setupStore()

	// Create deny window in the past that we're outside of
	rule := &oapi.PolicyRule{
		Id: "rule-1",
		DeploymentWindow: &oapi.DeploymentWindowRule{
			Rrule:           "FREQ=YEARLY;COUNT=1;DTSTART=20200101T000000Z",
			DurationMinutes: 1,
			Timezone:        stringPtr("Europe/London"),
			AllowWindow:     boolPtr(false),
		},
	}

	eval := NewEvaluator(st, rule)
	require.NotNil(t, eval)

	scope := evaluator.EvaluatorScope{}
	result := eval.Evaluate(context.Background(), scope)

	// Verify enhanced metadata fields
	assert.True(t, result.Allowed)
	assert.Contains(t, result.Details, "current_time")
	assert.Contains(t, result.Details, "duration_minutes")
	assert.Contains(t, result.Details, "timezone")
	assert.Contains(t, result.Details, "window_type")
	assert.Contains(t, result.Details, "rrule")

	// Check values
	assert.Equal(t, "deny", result.Details["window_type"])
	assert.Equal(t, int32(1), result.Details["duration_minutes"])
	assert.Equal(t, "Europe/London", result.Details["timezone"])
}

func TestDeploymentWindowEvaluator_TimeRemainingFormat(t *testing.T) {
	st := setupStore()

	// Create rule with specific duration to test time formatting
	rule := &oapi.PolicyRule{
		Id: "rule-1",
		DeploymentWindow: &oapi.DeploymentWindowRule{
			Rrule:           "FREQ=MINUTELY;INTERVAL=1",
			DurationMinutes: 120, // 2 hours
			AllowWindow:     boolPtr(true),
		},
	}

	eval := NewEvaluator(st, rule)
	require.NotNil(t, eval)

	scope := evaluator.EvaluatorScope{}
	result := eval.Evaluate(context.Background(), scope)

	// time_remaining should be a formatted string like "1h 30m" or "2h"
	timeRemaining, ok := result.Details["time_remaining"].(string)
	assert.True(t, ok, "time_remaining should be a string")
	assert.NotEmpty(t, timeRemaining, "time_remaining should not be empty")
}
