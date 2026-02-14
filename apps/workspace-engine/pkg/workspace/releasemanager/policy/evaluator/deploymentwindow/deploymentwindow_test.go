package deploymentwindow

import (
	"context"
	"fmt"
	"testing"
	"time"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/statechange"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator"
	"workspace-engine/pkg/workspace/store"

	"github.com/google/uuid"
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

func setupReleaseTarget(t *testing.T, st *store.Store) (context.Context, *oapi.ReleaseTarget) {
	t.Helper()

	ctx := context.Background()
	systemID := uuid.New().String()
	deployment := &oapi.Deployment{
		Id:       uuid.New().String(),
		Name:     "test-deployment",
		Slug:     "test-deployment",
		SystemId: systemID,
	}
	require.NoError(t, st.Deployments.Upsert(ctx, deployment))

	environment := &oapi.Environment{
		Id:       uuid.New().String(),
		Name:     "test-environment",
		SystemId: systemID,
	}
	require.NoError(t, st.Environments.Upsert(ctx, environment))

	resource := &oapi.Resource{
		Id:         uuid.New().String(),
		Identifier: "test-resource",
		Kind:       "service",
	}
	_, err := st.Resources.Upsert(ctx, resource)
	require.NoError(t, err)

	releaseTarget := &oapi.ReleaseTarget{
		DeploymentId:  deployment.Id,
		EnvironmentId: environment.Id,
		ResourceId:    resource.Id,
	}
	require.NoError(t, st.ReleaseTargets.Upsert(ctx, releaseTarget))

	return ctx, releaseTarget
}

func seedSuccessfulRelease(
	t *testing.T,
	ctx context.Context,
	st *store.Store,
	releaseTarget *oapi.ReleaseTarget,
) *oapi.DeploymentVersion {
	t.Helper()

	versionCreatedAt := time.Now().Add(-2 * time.Hour)
	version := &oapi.DeploymentVersion{
		Id:           uuid.New().String(),
		DeploymentId: releaseTarget.DeploymentId,
		Tag:          "v1.0.0",
		CreatedAt:    versionCreatedAt,
	}
	st.DeploymentVersions.Upsert(ctx, version.Id, version)

	release := &oapi.Release{
		ReleaseTarget: *releaseTarget,
		Version:       *version,
		CreatedAt:     versionCreatedAt.Add(30 * time.Minute).Format(time.RFC3339),
	}
	require.NoError(t, st.Releases.Upsert(ctx, release))

	completedAt := time.Now().Add(-1 * time.Hour)
	job := &oapi.Job{
		Id:          uuid.New().String(),
		ReleaseId:   release.ID(),
		Status:      oapi.JobStatusSuccessful,
		CompletedAt: &completedAt,
		CreatedAt:   completedAt,
	}
	st.Jobs.Upsert(ctx, job)

	return version
}

func createCandidateVersion(
	ctx context.Context,
	st *store.Store,
	deploymentId string,
	tag string,
) *oapi.DeploymentVersion {
	version := &oapi.DeploymentVersion{
		Id:           uuid.New().String(),
		DeploymentId: deploymentId,
		Tag:          tag,
		CreatedAt:    time.Now(),
	}
	st.DeploymentVersions.Upsert(ctx, version.Id, version)
	return version
}

func setupScopeWithDeployedTarget(t *testing.T, st *store.Store) (context.Context, evaluator.EvaluatorScope) {
	t.Helper()

	ctx, releaseTarget := setupReleaseTarget(t, st)
	seedSuccessfulRelease(t, ctx, st, releaseTarget)
	candidateVersion := createCandidateVersion(ctx, st, releaseTarget.DeploymentId, "v2.0.0")

	return ctx, evaluator.EvaluatorScope{
		Environment: &oapi.Environment{Id: releaseTarget.EnvironmentId},
		Version:     candidateVersion,
		Resource:    &oapi.Resource{Id: releaseTarget.ResourceId},
		Deployment:  &oapi.Deployment{Id: releaseTarget.DeploymentId},
	}
}

func setupScopeWithPreviouslyDeployedVersion(
	t *testing.T,
	st *store.Store,
) (context.Context, evaluator.EvaluatorScope) {
	t.Helper()

	ctx, releaseTarget := setupReleaseTarget(t, st)
	deployedVersion := seedSuccessfulRelease(t, ctx, st, releaseTarget)

	return ctx, evaluator.EvaluatorScope{
		Environment: &oapi.Environment{Id: releaseTarget.EnvironmentId},
		Version:     deployedVersion,
		Resource:    &oapi.Resource{Id: releaseTarget.ResourceId},
		Deployment:  &oapi.Deployment{Id: releaseTarget.DeploymentId},
	}
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

	// Deployment window needs release target + version to evaluate whether this
	// candidate version has already been deployed for the target.
	assert.Equal(t, evaluator.ScopeVersion|evaluator.ScopeReleaseTarget, eval.ScopeFields())
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

	ctx, scope := setupScopeWithDeployedTarget(t, st)
	result := eval.Evaluate(ctx, scope)

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

	ctx, scope := setupScopeWithDeployedTarget(t, st)
	result := eval.Evaluate(ctx, scope)

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

	ctx, scope := setupScopeWithDeployedTarget(t, st)
	result := eval.Evaluate(ctx, scope)

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

	ctx, scope := setupScopeWithDeployedTarget(t, st)
	result := eval.Evaluate(ctx, scope)

	assert.True(t, result.Allowed, "expected allowed when outside deny window")
	assert.Contains(t, result.Message, "outside deny window")
	assert.Equal(t, "deny", result.Details["window_type"])
	assert.NotNil(t, result.SatisfiedAt, "expected satisfiedAt to be set")
}

func TestDeploymentWindowEvaluator_IgnoresWindowWithoutDeployedVersion(t *testing.T) {
	st := setupStore()

	rule := &oapi.PolicyRule{
		Id: "rule-1",
		DeploymentWindow: &oapi.DeploymentWindowRule{
			Rrule:           "FREQ=MINUTELY;INTERVAL=1",
			DurationMinutes: 60,
			AllowWindow:     boolPtr(false),
		},
	}

	eval := NewEvaluator(st, rule)
	require.NotNil(t, eval, "expected non-nil evaluator")

	ctx, releaseTarget := setupReleaseTarget(t, st)
	candidateVersion := createCandidateVersion(ctx, st, releaseTarget.DeploymentId, "v1.0.0")
	scope := evaluator.EvaluatorScope{
		Environment: &oapi.Environment{Id: releaseTarget.EnvironmentId},
		Version:     candidateVersion,
		Resource:    &oapi.Resource{Id: releaseTarget.ResourceId},
		Deployment:  &oapi.Deployment{Id: releaseTarget.DeploymentId},
	}
	result := eval.Evaluate(ctx, scope)

	assert.True(t, result.Allowed, "expected allowed when no deployment exists")
	assert.Contains(t, result.Message, "deployment window ignored")
	assert.Equal(t, "first_deployment", result.Details["reason"])
}

func TestDeploymentWindowEvaluator_IgnoresWindowForPreviouslyDeployedVersion(t *testing.T) {
	st := setupStore()

	// Outside this allow window by default, so this would normally be blocked.
	rule := &oapi.PolicyRule{
		Id: "rule-1",
		DeploymentWindow: &oapi.DeploymentWindowRule{
			Rrule:           "FREQ=YEARLY;COUNT=1;DTSTART=20200101T000000Z",
			DurationMinutes: 1,
			AllowWindow:     boolPtr(true),
		},
	}

	eval := NewEvaluator(st, rule)
	require.NotNil(t, eval, "expected non-nil evaluator")

	ctx, scope := setupScopeWithPreviouslyDeployedVersion(t, st)
	result := eval.Evaluate(ctx, scope)

	assert.True(t, result.Allowed, "expected allowed when candidate version was previously deployed")
	assert.Contains(t, result.Message, "deployment window ignored")
	assert.Equal(t, "version_previously_deployed", result.Details["reason"])
	assert.Equal(t, scope.Version.Id, result.Details["version_id"])
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

	ctx, scope := setupScopeWithDeployedTarget(t, st)
	result := eval.Evaluate(ctx, scope)

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

	ctx, scope := setupScopeWithDeployedTarget(t, st)
	result := eval.Evaluate(ctx, scope)

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

			ctx, scope := setupScopeWithDeployedTarget(t, st)
			result := eval.Evaluate(ctx, scope)
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

	ctx, scope := setupScopeWithDeployedTarget(t, st)
	result := eval.Evaluate(ctx, scope)
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

	ctx, scope := setupScopeWithDeployedTarget(t, st)
	result := eval.Evaluate(ctx, scope)
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

			ctx, scope := setupScopeWithDeployedTarget(t, st)
			result := eval.Evaluate(ctx, scope)
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

			ctx, scope := setupScopeWithDeployedTarget(t, st)
			result := eval.Evaluate(ctx, scope)
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

			ctx, scope := setupScopeWithDeployedTarget(t, st)
			result := eval.Evaluate(ctx, scope)
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

			ctx, scope := setupScopeWithDeployedTarget(t, st)
			result := eval.Evaluate(ctx, scope)
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

			ctx, scope := setupScopeWithDeployedTarget(t, st)
			result := eval.Evaluate(ctx, scope)
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

			ctx, scope := setupScopeWithDeployedTarget(t, st)
			result := eval.Evaluate(ctx, scope)
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

			ctx, scope := setupScopeWithDeployedTarget(t, st)
			result := eval.Evaluate(ctx, scope)
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
	ctx, scope := setupScopeWithDeployedTarget(t, st)
	result := eval.Evaluate(ctx, scope)
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
	ctx, scope := setupScopeWithDeployedTarget(t, st)
	result := eval.Evaluate(ctx, scope)
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

	ctx, scope := setupScopeWithDeployedTarget(t, st)
	result := eval.Evaluate(ctx, scope)

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

	ctx, scope := setupScopeWithDeployedTarget(t, st)

	// Call multiple times - should work with memoization
	result1 := eval.Evaluate(ctx, scope)
	result2 := eval.Evaluate(ctx, scope)

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

	ctx, scope := setupScopeWithDeployedTarget(t, st)
	result := eval.Evaluate(ctx, scope)

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

	ctx, scope := setupScopeWithDeployedTarget(t, st)
	result := eval.Evaluate(ctx, scope)

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

	ctx, scope := setupScopeWithDeployedTarget(t, st)
	result := eval.Evaluate(ctx, scope)

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

func TestDeploymentWindowEvaluator_DailyBYHOUR_DetectsInsideWindow(t *testing.T) {
	st := setupStore()

	now := time.Now()
	windowStartHour := now.Add(-2 * time.Hour).UTC().Hour()

	rruleStr := fmt.Sprintf("FREQ=DAILY;BYHOUR=%d;BYMINUTE=0;BYSECOND=0", windowStartHour)

	rule := &oapi.PolicyRule{
		Id: "rule-byhour",
		DeploymentWindow: &oapi.DeploymentWindowRule{
			Rrule:           rruleStr,
			DurationMinutes: 240,
			AllowWindow:     boolPtr(true),
		},
	}

	eval := NewEvaluator(st, rule)
	require.NotNil(t, eval, "expected non-nil evaluator")

	ctx, scope := setupScopeWithDeployedTarget(t, st)
	result := eval.Evaluate(ctx, scope)

	assert.True(t, result.Allowed, "expected allowed: we are inside the allow window (BYHOUR started 2h ago, duration 4h)")
	assert.Contains(t, result.Message, "within allowed deployment window")
	assert.Equal(t, "allow", result.Details["window_type"])
}

func TestDeploymentWindowEvaluator_DailyBYHOUR_DenyWindow_DetectsInsideWindow(t *testing.T) {
	st := setupStore()

	now := time.Now()
	windowStartHour := now.Add(-1 * time.Hour).UTC().Hour()

	rruleStr := fmt.Sprintf("FREQ=DAILY;BYHOUR=%d;BYMINUTE=0;BYSECOND=0", windowStartHour)

	rule := &oapi.PolicyRule{
		Id: "rule-byhour-deny",
		DeploymentWindow: &oapi.DeploymentWindowRule{
			Rrule:           rruleStr,
			DurationMinutes: 180,
			AllowWindow:     boolPtr(false),
		},
	}

	eval := NewEvaluator(st, rule)
	require.NotNil(t, eval, "expected non-nil evaluator")

	ctx, scope := setupScopeWithDeployedTarget(t, st)
	result := eval.Evaluate(ctx, scope)

	assert.False(t, result.Allowed, "expected denied: we are inside the deny window (BYHOUR started 1h ago, duration 3h)")
	assert.Contains(t, result.Message, "within deny window")
	assert.Equal(t, "deny", result.Details["window_type"])
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

	ctx, scope := setupScopeWithDeployedTarget(t, st)
	result := eval.Evaluate(ctx, scope)

	// time_remaining should be a formatted string like "1h 30m" or "2h"
	timeRemaining, ok := result.Details["time_remaining"].(string)
	assert.True(t, ok, "time_remaining should be a string")
	assert.NotEmpty(t, timeRemaining, "time_remaining should not be empty")
}
