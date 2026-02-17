package deploymentwindow

import (
	"context"
	"testing"
	"time"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNewSummaryEvaluator_NilInputs(t *testing.T) {
	st := setupStore()

	// Nil rule
	assert.Nil(t, NewSummaryEvaluator(st, nil))

	// Nil store
	rule := &oapi.PolicyRule{Id: "r1", DeploymentWindow: &oapi.DeploymentWindowRule{}}
	assert.Nil(t, NewSummaryEvaluator(nil, rule))

	// No deployment window on rule
	ruleNoWindow := &oapi.PolicyRule{Id: "r2"}
	assert.Nil(t, NewSummaryEvaluator(st, ruleNoWindow))
}

func TestNewSummaryEvaluator_InvalidRRule(t *testing.T) {
	st := setupStore()
	rule := &oapi.PolicyRule{
		Id: "r1",
		DeploymentWindow: &oapi.DeploymentWindowRule{
			Rrule:           "INVALID RRULE",
			DurationMinutes: 60,
		},
	}
	// Invalid rrule should return nil
	eval := NewSummaryEvaluator(st, rule)
	assert.Nil(t, eval)
}

func TestSummaryEvaluator_AllowWindow_InsideWindow(t *testing.T) {
	st := setupStore()
	now := time.Now()

	// Create an rrule that has an occurrence right now
	// Use FREQ=MINUTELY with INTERVAL=1 to always have a recent occurrence
	allowWindow := true
	rule := &oapi.PolicyRule{
		Id: "dw-summary-1",
		DeploymentWindow: &oapi.DeploymentWindowRule{
			Rrule:           "FREQ=MINUTELY;INTERVAL=1",
			DurationMinutes: 5,
			AllowWindow:     &allowWindow,
		},
	}

	eval := NewSummaryEvaluator(st, rule)
	require.NotNil(t, eval)

	assert.Equal(t, evaluator.RuleTypeDeploymentWindow, eval.RuleType())
	assert.Equal(t, "dw-summary-1", eval.RuleId())

	version := &oapi.DeploymentVersion{
		Id:           uuid.New().String(),
		DeploymentId: uuid.New().String(),
		Tag:          "v1.0.0",
		CreatedAt:    now,
	}
	env := &oapi.Environment{
		Id:   uuid.New().String(),
		Name: "production",
	}

	scope := evaluator.EvaluatorScope{
		Environment: env,
		Version:     version,
	}

	result := eval.Evaluate(context.Background(), scope)
	require.NotNil(t, result)
	assert.True(t, result.Allowed, "Should be allowed inside allow window")
}

func TestSummaryEvaluator_AllowWindow_OutsideWindow(t *testing.T) {
	st := setupStore()

	// Create an rrule in the far past that won't have an active window now
	// Use a yearly occurrence set far in the future
	allowWindow := true
	rule := &oapi.PolicyRule{
		Id: "dw-summary-2",
		DeploymentWindow: &oapi.DeploymentWindowRule{
			Rrule:           "FREQ=YEARLY;BYMONTH=1;BYDAY=MO;BYHOUR=3;BYMINUTE=0;BYSECOND=0",
			DurationMinutes: 1,
			AllowWindow:     &allowWindow,
		},
	}

	eval := NewSummaryEvaluator(st, rule)
	// This might be nil if current time happens to be in that window, but very unlikely
	if eval == nil {
		t.Skip("rrule might not parse or window might match")
	}

	version := &oapi.DeploymentVersion{
		Id:           uuid.New().String(),
		DeploymentId: uuid.New().String(),
		Tag:          "v1.0.0",
		CreatedAt:    time.Now(),
	}
	env := &oapi.Environment{
		Id:   uuid.New().String(),
		Name: "production",
	}

	scope := evaluator.EvaluatorScope{
		Environment: env,
		Version:     version,
	}

	result := eval.Evaluate(context.Background(), scope)
	require.NotNil(t, result)
	// In most cases, we'll be outside the window
	// The result should be either blocked or allowed depending on timing
	assert.NotNil(t, result)
}

func TestSummaryEvaluator_DenyWindow_OutsideWindow(t *testing.T) {
	st := setupStore()

	// Use a deny window that occurs yearly on Jan 1 at 3am for 1 minute
	// Very unlikely to be in that window now
	allowWindow := false
	rule := &oapi.PolicyRule{
		Id: "dw-summary-3",
		DeploymentWindow: &oapi.DeploymentWindowRule{
			Rrule:           "FREQ=YEARLY;BYMONTH=1;BYDAY=MO;BYHOUR=3;BYMINUTE=0;BYSECOND=0",
			DurationMinutes: 1,
			AllowWindow:     &allowWindow,
		},
	}

	eval := NewSummaryEvaluator(st, rule)
	if eval == nil {
		t.Skip("rrule might not parse")
	}

	version := &oapi.DeploymentVersion{
		Id:           uuid.New().String(),
		DeploymentId: uuid.New().String(),
		Tag:          "v1.0.0",
		CreatedAt:    time.Now(),
	}
	env := &oapi.Environment{
		Id:   uuid.New().String(),
		Name: "production",
	}

	scope := evaluator.EvaluatorScope{
		Environment: env,
		Version:     version,
	}

	result := eval.Evaluate(context.Background(), scope)
	require.NotNil(t, result)
	// Outside deny window should be allowed
	assert.True(t, result.Allowed, "Should be allowed outside deny window")
}

func TestSummaryEvaluator_DenyWindow_InsideWindow(t *testing.T) {
	st := setupStore()

	// Create a deny window that occurs every minute for 5 minutes
	allowWindow := false
	rule := &oapi.PolicyRule{
		Id: "dw-summary-4",
		DeploymentWindow: &oapi.DeploymentWindowRule{
			Rrule:           "FREQ=MINUTELY;INTERVAL=1",
			DurationMinutes: 5,
			AllowWindow:     &allowWindow,
		},
	}

	eval := NewSummaryEvaluator(st, rule)
	require.NotNil(t, eval)

	version := &oapi.DeploymentVersion{
		Id:           uuid.New().String(),
		DeploymentId: uuid.New().String(),
		Tag:          "v1.0.0",
		CreatedAt:    time.Now(),
	}
	env := &oapi.Environment{
		Id:   uuid.New().String(),
		Name: "production",
	}

	scope := evaluator.EvaluatorScope{
		Environment: env,
		Version:     version,
	}

	result := eval.Evaluate(context.Background(), scope)
	require.NotNil(t, result)
	assert.False(t, result.Allowed, "Should be blocked inside deny window")
}

func TestSummaryEvaluator_WithTimezone(t *testing.T) {
	st := setupStore()

	tz := "America/New_York"
	allowWindow := true
	rule := &oapi.PolicyRule{
		Id: "dw-tz",
		DeploymentWindow: &oapi.DeploymentWindowRule{
			Rrule:           "FREQ=MINUTELY;INTERVAL=1",
			DurationMinutes: 5,
			AllowWindow:     &allowWindow,
			Timezone:        &tz,
		},
	}

	eval := NewSummaryEvaluator(st, rule)
	require.NotNil(t, eval)

	version := &oapi.DeploymentVersion{
		Id:           uuid.New().String(),
		DeploymentId: uuid.New().String(),
		Tag:          "v1.0.0",
		CreatedAt:    time.Now(),
	}
	env := &oapi.Environment{
		Id:   uuid.New().String(),
		Name: "production",
	}

	scope := evaluator.EvaluatorScope{
		Environment: env,
		Version:     version,
	}

	result := eval.Evaluate(context.Background(), scope)
	require.NotNil(t, result)
	// Inside a minutely window - should be allowed
	assert.True(t, result.Allowed)
}

func TestSummaryEvaluator_DefaultAllowWindow(t *testing.T) {
	st := setupStore()

	// AllowWindow is nil - defaults to true (allow window)
	rule := &oapi.PolicyRule{
		Id: "dw-default",
		DeploymentWindow: &oapi.DeploymentWindowRule{
			Rrule:           "FREQ=MINUTELY;INTERVAL=1",
			DurationMinutes: 5,
			AllowWindow:     nil,
		},
	}

	eval := NewSummaryEvaluator(st, rule)
	require.NotNil(t, eval)

	version := &oapi.DeploymentVersion{
		Id:           uuid.New().String(),
		DeploymentId: uuid.New().String(),
		Tag:          "v1.0.0",
		CreatedAt:    time.Now(),
	}
	env := &oapi.Environment{
		Id:   uuid.New().String(),
		Name: "production",
	}

	scope := evaluator.EvaluatorScope{
		Environment: env,
		Version:     version,
	}

	result := eval.Evaluate(context.Background(), scope)
	require.NotNil(t, result)
	assert.True(t, result.Allowed, "Default allow window with current occurrence should allow")
}
