package controllers_test

import (
	"encoding/json"
	"testing"
	"time"

	"workspace-engine/svc/controllers/verificationmetric"
	"workspace-engine/svc/controllers/verificationmetric/metrics"
	"workspace-engine/svc/controllers/verificationmetric/metrics/provider"
	. "workspace-engine/test/controllers/harness"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

func sleepProvider() json.RawMessage {
	return json.RawMessage(`{"type":"sleep","durationSeconds":0}`)
}

func newMetric(name string, count int32, successCondition string) *metrics.VerificationMetric {
	return &metrics.VerificationMetric{
		ID:               uuid.New().String(),
		Name:             name,
		Count:            count,
		IntervalSeconds:  1,
		SuccessCondition: successCondition,
		Provider:         sleepProvider(),
		Measurements:     []metrics.Measurement{},
	}
}

func oldMeasurement(status metrics.MeasurementStatus) metrics.Measurement {
	return metrics.Measurement{
		Status:     status,
		MeasuredAt: time.Now().Add(-time.Minute),
	}
}

func verificationGetter(m *metrics.VerificationMetric) *VerificationGetter {
	return &VerificationGetter{
		Metrics:     map[string]*metrics.VerificationMetric{m.ID: m},
		ProviderCtx: &provider.ProviderContext{},
	}
}

// ---------------------------------------------------------------------------
// Reconcile-level tests: metric measurement flow
// ---------------------------------------------------------------------------

func TestVerification_FirstMeasurement_Requeues(t *testing.T) {
	m := newMetric("health-check", 3, "true")
	getter := verificationGetter(m)
	setter := &VerificationSetter{Getter: getter}

	result, err := verificationmetric.Reconcile(t.Context(), getter, setter, m.ID)
	require.NoError(t, err)

	require.Len(t, setter.RecordedMeasurements, 1, "should record one measurement")
	assert.Equal(t, m.ID, setter.RecordedMeasurements[0].MetricID)

	require.NotNil(t, result.RequeueAfter, "should requeue for next measurement")
}

func TestVerification_AllMeasurementsPass_Completes(t *testing.T) {
	m := newMetric("health-check", 2, "true")
	m.Measurements = []metrics.Measurement{
		oldMeasurement(metrics.StatusPassed),
	}
	getter := verificationGetter(m)
	setter := &VerificationSetter{Getter: getter}

	result, err := verificationmetric.Reconcile(t.Context(), getter, setter, m.ID)
	require.NoError(t, err)

	require.Len(t, setter.RecordedMeasurements, 1)
	assert.Equal(t, metrics.StatusPassed, setter.RecordedMeasurements[0].Measurement.Status)

	assert.Nil(t, result.RequeueAfter, "should not requeue — metric is complete")
	assert.Equal(t, metrics.VerificationPassed, setter.Completed[m.ID])
}

func TestVerification_FailureLimitExceeded_Fails(t *testing.T) {
	m := newMetric("health-check", 5, "false")
	getter := verificationGetter(m)
	setter := &VerificationSetter{Getter: getter}

	result, err := verificationmetric.Reconcile(t.Context(), getter, setter, m.ID)
	require.NoError(t, err)

	require.Len(t, setter.RecordedMeasurements, 1)
	assert.Equal(t, metrics.StatusFailed, setter.RecordedMeasurements[0].Measurement.Status)

	assert.Nil(t, result.RequeueAfter, "should not requeue — failure stops metric")
	assert.Equal(t, metrics.VerificationFailed, setter.Completed[m.ID])
}

func TestVerification_NotFound_NoOp(t *testing.T) {
	getter := &VerificationGetter{
		Metrics: map[string]*metrics.VerificationMetric{},
	}
	setter := &VerificationSetter{}

	result, err := verificationmetric.Reconcile(t.Context(), getter, setter, "nonexistent")
	require.NoError(t, err)
	assert.Nil(t, result.RequeueAfter)
	assert.Empty(t, setter.RecordedMeasurements)
}

func TestVerification_AlreadyComplete_SkipsMeasurement(t *testing.T) {
	m := newMetric("health-check", 1, "true")
	m.Measurements = []metrics.Measurement{
		oldMeasurement(metrics.StatusPassed),
	}
	getter := verificationGetter(m)
	setter := &VerificationSetter{Getter: getter}

	result, err := verificationmetric.Reconcile(t.Context(), getter, setter, m.ID)
	require.NoError(t, err)

	assert.Empty(t, setter.RecordedMeasurements, "should not take another measurement")
	assert.Nil(t, result.RequeueAfter)
	assert.Equal(t, metrics.VerificationPassed, setter.Completed[m.ID])
}

// ---------------------------------------------------------------------------
// Success threshold
// ---------------------------------------------------------------------------

func TestVerification_SuccessThreshold_RequiresConsecutivePasses(t *testing.T) {
	threshold := int32(2)
	m := newMetric("check", 5, "true")
	m.SuccessThreshold = &threshold
	m.Measurements = []metrics.Measurement{
		oldMeasurement(metrics.StatusPassed),
	}
	getter := verificationGetter(m)
	setter := &VerificationSetter{Getter: getter}

	result, err := verificationmetric.Reconcile(t.Context(), getter, setter, m.ID)
	require.NoError(t, err)

	require.Len(t, setter.RecordedMeasurements, 1)
	assert.Equal(t, metrics.StatusPassed, setter.RecordedMeasurements[0].Measurement.Status)

	assert.Nil(t, result.RequeueAfter, "two consecutive passes met threshold — complete")
	assert.Equal(t, metrics.VerificationPassed, setter.Completed[m.ID])
}

// ---------------------------------------------------------------------------
// Failure threshold
// ---------------------------------------------------------------------------

func TestVerification_FailureThreshold_ContinuesBelowLimit(t *testing.T) {
	failureThreshold := int32(2)
	m := newMetric("check", 5, "false")
	m.FailureThreshold = &failureThreshold
	getter := verificationGetter(m)
	setter := &VerificationSetter{Getter: getter}

	result, err := verificationmetric.Reconcile(t.Context(), getter, setter, m.ID)
	require.NoError(t, err)

	require.Len(t, setter.RecordedMeasurements, 1)
	require.NotNil(t, result.RequeueAfter, "below failure threshold — should continue")
}

func TestVerification_FailureThreshold_ExceedsLimit_Stops(t *testing.T) {
	failureThreshold := int32(1)
	m := newMetric("check", 5, "false")
	m.FailureThreshold = &failureThreshold
	m.Measurements = []metrics.Measurement{
		oldMeasurement(metrics.StatusFailed),
	}
	getter := verificationGetter(m)
	setter := &VerificationSetter{Getter: getter}

	result, err := verificationmetric.Reconcile(t.Context(), getter, setter, m.ID)
	require.NoError(t, err)

	assert.Nil(t, result.RequeueAfter, "above failure threshold — should stop")
	assert.Equal(t, metrics.VerificationFailed, setter.Completed[m.ID])
}

// ---------------------------------------------------------------------------
// Interval guard
// ---------------------------------------------------------------------------

func TestVerification_IntervalNotElapsed_Defers(t *testing.T) {
	m := newMetric("check", 3, "true")
	m.Measurements = []metrics.Measurement{
		{Status: metrics.StatusPassed, MeasuredAt: time.Now()},
	}
	getter := verificationGetter(m)
	setter := &VerificationSetter{Getter: getter}

	result, err := verificationmetric.Reconcile(t.Context(), getter, setter, m.ID)
	require.NoError(t, err)

	assert.Empty(t, setter.RecordedMeasurements, "should not take a measurement — interval not elapsed")
	require.NotNil(t, result.RequeueAfter, "should requeue with remaining time")
	assert.Greater(t, *result.RequeueAfter, time.Duration(0))
}
