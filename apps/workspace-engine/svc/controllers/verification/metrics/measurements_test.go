package metrics

import (
	"testing"
	"time"
	"workspace-engine/pkg/oapi"

	"github.com/stretchr/testify/assert"
)

func TestMeasurementsPhase_FailureLimitZero_FailsOnAnyFailure(t *testing.T) {
	failureThreshold := 0
	metric := verificationMetricStatus(5, &failureThreshold)

	metric.Measurements = verificationMeasurements(
		oapi.Passed,
		oapi.Failed,
	)

	phase := NewMeasurements(metric.Measurements).Phase(metric)
	assert.Equal(t, oapi.JobVerificationStatusFailed, phase)
}

func TestMeasurementsPhase_FailureLimitExceeded_Fails(t *testing.T) {
	failureThreshold := 2
	metric := verificationMetricStatus(5, &failureThreshold)

	metric.Measurements = verificationMeasurements(
		oapi.Failed,
		oapi.Failed,
		oapi.Failed,
	)

	phase := NewMeasurements(metric.Measurements).Phase(metric)
	assert.Equal(t, oapi.JobVerificationStatusFailed, phase)
}

func TestMeasurementsPhase_FailureLimitReached_CountComplete_Passes(t *testing.T) {
	failureThreshold := 2
	metric := verificationMetricStatus(3, &failureThreshold)

	metric.Measurements = verificationMeasurements(
		oapi.Failed,
		oapi.Failed,
		oapi.Passed,
	)

	phase := NewMeasurements(metric.Measurements).Phase(metric)
	assert.Equal(t, oapi.JobVerificationStatusPassed, phase)
}

func TestMeasurementsShouldContinue_FailureLimitReached_Continues(t *testing.T) {
	failureThreshold := 2
	metric := verificationMetricStatus(5, &failureThreshold)

	metric.Measurements = verificationMeasurements(
		oapi.Failed,
		oapi.Failed,
	)

	shouldContinue := NewMeasurements(metric.Measurements).ShouldContinue(metric)
	assert.True(t, shouldContinue)
}

func TestMeasurementsShouldContinue_FailureLimitExceeded_Stops(t *testing.T) {
	failureThreshold := 2
	metric := verificationMetricStatus(5, &failureThreshold)

	metric.Measurements = verificationMeasurements(
		oapi.Failed,
		oapi.Failed,
		oapi.Failed,
	)

	shouldContinue := NewMeasurements(metric.Measurements).ShouldContinue(metric)
	assert.False(t, shouldContinue)
}

func TestTimeUntilNextMeasurement_NoMeasurements_ReturnsZero(t *testing.T) {
	metric := verificationMetricStatus(5, nil)
	m := NewMeasurements(nil)
	assert.LessOrEqual(t, m.TimeUntilNextMeasurement(metric), time.Duration(0))
}

func TestTimeUntilNextMeasurement_RecentMeasurement_ReturnsPositive(t *testing.T) {
	metric := verificationMetricStatus(5, nil)
	m := NewMeasurements([]oapi.VerificationMeasurement{
		{Status: oapi.Passed, MeasuredAt: time.Now()},
	})
	remaining := m.TimeUntilNextMeasurement(metric)
	assert.Greater(t, remaining, time.Duration(0), "should have time remaining")
	assert.LessOrEqual(t, remaining, 30*time.Second)
}

func TestTimeUntilNextMeasurement_OldMeasurement_ReturnsZeroOrNegative(t *testing.T) {
	metric := verificationMetricStatus(5, nil)
	m := NewMeasurements([]oapi.VerificationMeasurement{
		{Status: oapi.Passed, MeasuredAt: time.Now().Add(-60 * time.Second)},
	})
	assert.LessOrEqual(t, m.TimeUntilNextMeasurement(metric), time.Duration(0))
}

func verificationMetricStatus(count int, failureThreshold *int) *oapi.VerificationMetricStatus {
	return &oapi.VerificationMetricStatus{
		Name:             "metric",
		Count:            count,
		IntervalSeconds:  30,
		SuccessCondition: "true",
		FailureThreshold: failureThreshold,
	}
}

func verificationMeasurements(statuses ...oapi.VerificationMeasurementStatus) []oapi.VerificationMeasurement {
	now := time.Now()
	measurements := make([]oapi.VerificationMeasurement, 0, len(statuses))
	for i, status := range statuses {
		measurements = append(measurements, oapi.VerificationMeasurement{
			Status:     status,
			MeasuredAt: now.Add(time.Duration(i) * time.Second),
		})
	}

	return measurements
}
