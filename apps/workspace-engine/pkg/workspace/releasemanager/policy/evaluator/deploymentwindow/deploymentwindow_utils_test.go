package deploymentwindow

import (
	"testing"
	"time"
	"workspace-engine/pkg/oapi"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestFormatDuration(t *testing.T) {
	tests := []struct {
		name     string
		duration time.Duration
		expected string
	}{
		{"seconds only", 30 * time.Second, "30s"},
		{"minutes only", 5 * time.Minute, "5m"},
		{"exact hours", 2 * time.Hour, "2h"},
		{"hours and minutes", 2*time.Hour + 30*time.Minute, "2h 30m"},
		{"less than a minute", 45 * time.Second, "45s"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := formatDuration(tt.duration)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestGetNextWindowStart(t *testing.T) {
	// Daily allow window at 10:00 UTC, 2 hours long
	rruleStr := "FREQ=DAILY;BYHOUR=10;BYMINUTE=0;BYSECOND=0"

	t.Run("nil rule returns nil", func(t *testing.T) {
		result, err := GetNextWindowStart(nil, time.Now())
		require.NoError(t, err)
		assert.Nil(t, result)
	})

	t.Run("deny window returns nil", func(t *testing.T) {
		rule := &oapi.DeploymentWindowRule{
			Rrule:           rruleStr,
			DurationMinutes: 120,
			AllowWindow:     boolPtr(false),
		}
		result, err := GetNextWindowStart(rule, time.Now())
		require.NoError(t, err)
		assert.Nil(t, result)
	})

	t.Run("inside allow window returns nil", func(t *testing.T) {
		rule := &oapi.DeploymentWindowRule{
			Rrule:           rruleStr,
			DurationMinutes: 120,
			AllowWindow:     boolPtr(true),
		}
		// Set time to 11:00 UTC (inside the 10:00-12:00 window)
		at := time.Date(2025, 1, 15, 11, 0, 0, 0, time.UTC)
		result, err := GetNextWindowStart(rule, at)
		require.NoError(t, err)
		assert.Nil(t, result, "should return nil when inside window")
	})

	t.Run("outside allow window returns next start", func(t *testing.T) {
		rule := &oapi.DeploymentWindowRule{
			Rrule:           rruleStr,
			DurationMinutes: 120,
			AllowWindow:     boolPtr(true),
		}
		// Set time to 15:00 UTC (outside the window)
		at := time.Date(2025, 1, 15, 15, 0, 0, 0, time.UTC)
		result, err := GetNextWindowStart(rule, at)
		require.NoError(t, err)
		require.NotNil(t, result)
		assert.Equal(t, 10, result.Hour())
	})

	t.Run("invalid rrule returns error", func(t *testing.T) {
		rule := &oapi.DeploymentWindowRule{
			Rrule:           "INVALID",
			DurationMinutes: 120,
			AllowWindow:     boolPtr(true),
		}
		_, err := GetNextWindowStart(rule, time.Now())
		require.Error(t, err)
	})

	t.Run("with timezone", func(t *testing.T) {
		tz := "America/New_York"
		rule := &oapi.DeploymentWindowRule{
			Rrule:           rruleStr,
			DurationMinutes: 120,
			AllowWindow:     boolPtr(true),
			Timezone:        &tz,
		}
		// 3:00 AM New York time - outside the window
		loc, _ := time.LoadLocation("America/New_York")
		at := time.Date(2025, 1, 15, 3, 0, 0, 0, loc)
		result, err := GetNextWindowStart(rule, at)
		require.NoError(t, err)
		require.NotNil(t, result)
	})
}

func TestIsInsideWindow(t *testing.T) {
	rruleStr := "FREQ=DAILY;BYHOUR=10;BYMINUTE=0;BYSECOND=0"

	t.Run("nil rule returns false", func(t *testing.T) {
		result, err := IsInsideWindow(nil, time.Now())
		require.NoError(t, err)
		assert.False(t, result)
	})

	t.Run("inside window returns true", func(t *testing.T) {
		rule := &oapi.DeploymentWindowRule{
			Rrule:           rruleStr,
			DurationMinutes: 120,
		}
		at := time.Date(2025, 1, 15, 11, 0, 0, 0, time.UTC)
		result, err := IsInsideWindow(rule, at)
		require.NoError(t, err)
		assert.True(t, result)
	})

	t.Run("outside window returns false", func(t *testing.T) {
		rule := &oapi.DeploymentWindowRule{
			Rrule:           rruleStr,
			DurationMinutes: 120,
		}
		at := time.Date(2025, 1, 15, 15, 0, 0, 0, time.UTC)
		result, err := IsInsideWindow(rule, at)
		require.NoError(t, err)
		assert.False(t, result)
	})

	t.Run("invalid rrule returns error", func(t *testing.T) {
		rule := &oapi.DeploymentWindowRule{
			Rrule:           "INVALID",
			DurationMinutes: 120,
		}
		_, err := IsInsideWindow(rule, time.Now())
		require.Error(t, err)
	})

	t.Run("with timezone", func(t *testing.T) {
		tz := "America/New_York"
		rule := &oapi.DeploymentWindowRule{
			Rrule:           rruleStr,
			DurationMinutes: 120,
			Timezone:        &tz,
		}
		loc, _ := time.LoadLocation("America/New_York")
		at := time.Date(2025, 1, 15, 11, 0, 0, 0, loc)
		result, err := IsInsideWindow(rule, at)
		require.NoError(t, err)
		assert.True(t, result)
	})
}

func TestGetDenyWindowEnd(t *testing.T) {
	rruleStr := "FREQ=DAILY;BYHOUR=10;BYMINUTE=0;BYSECOND=0"

	t.Run("nil rule returns nil", func(t *testing.T) {
		result, err := GetDenyWindowEnd(nil, time.Now())
		require.NoError(t, err)
		assert.Nil(t, result)
	})

	t.Run("allow window returns nil", func(t *testing.T) {
		rule := &oapi.DeploymentWindowRule{
			Rrule:           rruleStr,
			DurationMinutes: 120,
			AllowWindow:     boolPtr(true),
		}
		at := time.Date(2025, 1, 15, 11, 0, 0, 0, time.UTC)
		result, err := GetDenyWindowEnd(rule, at)
		require.NoError(t, err)
		assert.Nil(t, result)
	})

	t.Run("inside deny window returns end time", func(t *testing.T) {
		rule := &oapi.DeploymentWindowRule{
			Rrule:           rruleStr,
			DurationMinutes: 120,
			AllowWindow:     boolPtr(false),
		}
		at := time.Date(2025, 1, 15, 11, 0, 0, 0, time.UTC)
		result, err := GetDenyWindowEnd(rule, at)
		require.NoError(t, err)
		require.NotNil(t, result)
		assert.Equal(t, 12, result.Hour())
	})

	t.Run("outside deny window returns nil", func(t *testing.T) {
		rule := &oapi.DeploymentWindowRule{
			Rrule:           rruleStr,
			DurationMinutes: 120,
			AllowWindow:     boolPtr(false),
		}
		at := time.Date(2025, 1, 15, 15, 0, 0, 0, time.UTC)
		result, err := GetDenyWindowEnd(rule, at)
		require.NoError(t, err)
		assert.Nil(t, result)
	})

	t.Run("invalid rrule returns error", func(t *testing.T) {
		rule := &oapi.DeploymentWindowRule{
			Rrule:           "INVALID",
			DurationMinutes: 120,
			AllowWindow:     boolPtr(false),
		}
		_, err := GetDenyWindowEnd(rule, time.Now())
		require.Error(t, err)
	})

	t.Run("with timezone", func(t *testing.T) {
		tz := "America/New_York"
		rule := &oapi.DeploymentWindowRule{
			Rrule:           rruleStr,
			DurationMinutes: 120,
			AllowWindow:     boolPtr(false),
			Timezone:        &tz,
		}
		loc, _ := time.LoadLocation("America/New_York")
		at := time.Date(2025, 1, 15, 11, 0, 0, 0, loc)
		result, err := GetDenyWindowEnd(rule, at)
		require.NoError(t, err)
		require.NotNil(t, result)
	})
}

func TestValidateRRule(t *testing.T) {
	t.Run("valid rrule", func(t *testing.T) {
		err := ValidateRRule("FREQ=DAILY;BYHOUR=10;BYMINUTE=0;BYSECOND=0")
		require.NoError(t, err)
	})

	t.Run("invalid rrule", func(t *testing.T) {
		err := ValidateRRule("INVALID")
		require.Error(t, err)
	})
}
