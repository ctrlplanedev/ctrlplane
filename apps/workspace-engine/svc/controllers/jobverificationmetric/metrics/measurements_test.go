package metrics

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestMeasurementsPhase_FailureLimitZero_FailsOnAnyFailure(t *testing.T) {
	failureThreshold := int32(0)
	metric := verificationMetric(5, &failureThreshold)
	metric.Measurements = verificationMeasurements(StatusPassed, StatusFailed)

	phase := NewMeasurements(metric.Measurements).Phase(metric)
	assert.Equal(t, VerificationFailed, phase)
}

func TestMeasurementsPhase_FailureLimitExceeded_Fails(t *testing.T) {
	failureThreshold := int32(2)
	metric := verificationMetric(5, &failureThreshold)
	metric.Measurements = verificationMeasurements(StatusFailed, StatusFailed, StatusFailed)

	phase := NewMeasurements(metric.Measurements).Phase(metric)
	assert.Equal(t, VerificationFailed, phase)
}

func TestMeasurementsPhase_FailureLimitReached_CountComplete_Passes(t *testing.T) {
	failureThreshold := int32(2)
	metric := verificationMetric(3, &failureThreshold)
	metric.Measurements = verificationMeasurements(StatusFailed, StatusFailed, StatusPassed)

	phase := NewMeasurements(metric.Measurements).Phase(metric)
	assert.Equal(t, VerificationPassed, phase)
}

func TestMeasurementsShouldContinue_FailureLimitReached_Continues(t *testing.T) {
	failureThreshold := int32(2)
	metric := verificationMetric(5, &failureThreshold)
	metric.Measurements = verificationMeasurements(StatusFailed, StatusFailed)

	shouldContinue := NewMeasurements(metric.Measurements).ShouldContinue(metric)
	assert.True(t, shouldContinue)
}

func TestMeasurementsShouldContinue_FailureLimitExceeded_Stops(t *testing.T) {
	failureThreshold := int32(2)
	metric := verificationMetric(5, &failureThreshold)
	metric.Measurements = verificationMeasurements(StatusFailed, StatusFailed, StatusFailed)

	shouldContinue := NewMeasurements(metric.Measurements).ShouldContinue(metric)
	assert.False(t, shouldContinue)
}

func TestTimeUntilNextMeasurement_NoMeasurements_ReturnsZero(t *testing.T) {
	metric := verificationMetric(5, nil)
	m := NewMeasurements(nil)
	assert.LessOrEqual(t, m.TimeUntilNextMeasurement(metric), time.Duration(0))
}

func TestTimeUntilNextMeasurement_RecentMeasurement_ReturnsPositive(t *testing.T) {
	metric := verificationMetric(5, nil)
	m := NewMeasurements([]Measurement{
		{Status: StatusPassed, MeasuredAt: time.Now()},
	})
	remaining := m.TimeUntilNextMeasurement(metric)
	assert.Greater(t, remaining, time.Duration(0), "should have time remaining")
	assert.LessOrEqual(t, remaining, 30*time.Second)
}

func TestTimeUntilNextMeasurement_OldMeasurement_ReturnsZeroOrNegative(t *testing.T) {
	metric := verificationMetric(5, nil)
	m := NewMeasurements([]Measurement{
		{Status: StatusPassed, MeasuredAt: time.Now().Add(-60 * time.Second)},
	})
	assert.LessOrEqual(t, m.TimeUntilNextMeasurement(metric), time.Duration(0))
}

func verificationMetric(count int32, failureThreshold *int32) *VerificationMetric {
	return &VerificationMetric{
		Name:             "metric",
		Count:            count,
		IntervalSeconds:  30,
		SuccessCondition: "true",
		FailureThreshold: failureThreshold,
	}
}

func verificationMeasurements(statuses ...MeasurementStatus) []Measurement {
	now := time.Now()
	measurements := make([]Measurement, 0, len(statuses))
	for i, status := range statuses {
		measurements = append(measurements, Measurement{
			Status:     status,
			MeasuredAt: now.Add(time.Duration(i) * time.Second),
		})
	}
	return measurements
}
