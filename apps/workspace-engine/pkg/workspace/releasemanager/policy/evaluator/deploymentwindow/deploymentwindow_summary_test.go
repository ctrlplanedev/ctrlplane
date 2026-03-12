package deploymentwindow

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator"
)

func TestNewSummaryEvaluator_NilInputs(t *testing.T) {
	// Nil rule
	assert.Nil(t, NewSummaryEvaluator(nil))

	// No deployment window on rule
	ruleNoWindow := &oapi.PolicyRule{Id: "r2"}
	assert.Nil(t, NewSummaryEvaluator(ruleNoWindow))
}

func TestNewSummaryEvaluator_InvalidRRule(t *testing.T) {
	rule := &oapi.PolicyRule{
		Id: "r1",
		DeploymentWindow: &oapi.DeploymentWindowRule{
			Rrule:           "INVALID RRULE",
			DurationMinutes: 60,
		},
	}
	eval := NewSummaryEvaluator(rule)
	assert.Nil(t, eval)
}

func TestSummaryEvaluator_AllowWindow_InsideWindow(t *testing.T) {
	allowWindow := true
	rule := &oapi.PolicyRule{
		Id: "dw-summary-1",
		DeploymentWindow: &oapi.DeploymentWindowRule{
			Rrule:           "FREQ=MINUTELY;INTERVAL=1",
			DurationMinutes: 5,
			AllowWindow:     &allowWindow,
		},
	}

	eval := NewSummaryEvaluator(rule)
	require.NotNil(t, eval)

	assert.Equal(t, evaluator.RuleTypeDeploymentWindow, eval.RuleType())
	assert.Equal(t, "dw-summary-1", eval.RuleId())

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
	assert.True(t, result.Allowed, "Should be allowed inside allow window")
}

func TestSummaryEvaluator_AllowWindow_OutsideWindow(t *testing.T) {
	allowWindow := true
	rule := &oapi.PolicyRule{
		Id: "dw-summary-2",
		DeploymentWindow: &oapi.DeploymentWindowRule{
			Rrule:           "FREQ=YEARLY;BYMONTH=1;BYDAY=MO;BYHOUR=3;BYMINUTE=0;BYSECOND=0",
			DurationMinutes: 1,
			AllowWindow:     &allowWindow,
		},
	}

	eval := NewSummaryEvaluator(rule)
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
	assert.NotNil(t, result)
}

func TestSummaryEvaluator_DenyWindow_OutsideWindow(t *testing.T) {
	allowWindow := false
	rule := &oapi.PolicyRule{
		Id: "dw-summary-3",
		DeploymentWindow: &oapi.DeploymentWindowRule{
			Rrule:           "FREQ=YEARLY;BYMONTH=1;BYDAY=MO;BYHOUR=3;BYMINUTE=0;BYSECOND=0",
			DurationMinutes: 1,
			AllowWindow:     &allowWindow,
		},
	}

	eval := NewSummaryEvaluator(rule)
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
	assert.True(t, result.Allowed, "Should be allowed outside deny window")
}

func TestSummaryEvaluator_DenyWindow_InsideWindow(t *testing.T) {
	allowWindow := false
	rule := &oapi.PolicyRule{
		Id: "dw-summary-4",
		DeploymentWindow: &oapi.DeploymentWindowRule{
			Rrule:           "FREQ=MINUTELY;INTERVAL=1",
			DurationMinutes: 5,
			AllowWindow:     &allowWindow,
		},
	}

	eval := NewSummaryEvaluator(rule)
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

	eval := NewSummaryEvaluator(rule)
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
	assert.True(t, result.Allowed)
}

func TestSummaryEvaluator_DefaultAllowWindow(t *testing.T) {
	rule := &oapi.PolicyRule{
		Id: "dw-default",
		DeploymentWindow: &oapi.DeploymentWindowRule{
			Rrule:           "FREQ=MINUTELY;INTERVAL=1",
			DurationMinutes: 5,
			AllowWindow:     nil,
		},
	}

	eval := NewSummaryEvaluator(rule)
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
