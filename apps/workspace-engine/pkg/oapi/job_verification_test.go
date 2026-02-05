package oapi

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestJobVerificationStatus_FailsWhenFailureThresholdExceeded(t *testing.T) {
	now := time.Now()
	failureThreshold := 2

	verification := JobVerification{
		Id:        "verification-1",
		JobId:     "job-1",
		CreatedAt: now,
		Metrics: []VerificationMetricStatus{
			{
				Name:             "metric-1",
				Count:            10,
				IntervalSeconds:  30,
				SuccessCondition: "true",
				FailureThreshold: &failureThreshold,
				Measurements: []VerificationMeasurement{
					{Status: Failed, MeasuredAt: now},
					{Status: Inconclusive, MeasuredAt: now.Add(1 * time.Second)},
					{Status: Failed, MeasuredAt: now.Add(2 * time.Second)},
					{Status: Inconclusive, MeasuredAt: now.Add(3 * time.Second)},
					{Status: Failed, MeasuredAt: now.Add(4 * time.Second)},
				},
			},
		},
	}

	assert.Equal(t, JobVerificationStatusFailed, verification.Status())
}

func TestJobVerificationStatus_FailureLimitZero_FailsOnFirstFailure(t *testing.T) {
	now := time.Now()
	failureThreshold := 0

	verification := JobVerification{
		Id:        "verification-2",
		JobId:     "job-2",
		CreatedAt: now,
		Metrics: []VerificationMetricStatus{
			{
				Name:             "metric-1",
				Count:            5,
				IntervalSeconds:  30,
				SuccessCondition: "true",
				FailureThreshold: &failureThreshold,
				Measurements: []VerificationMeasurement{
					{Status: Failed, MeasuredAt: now},
				},
			},
		},
	}

	assert.Equal(t, JobVerificationStatusFailed, verification.Status())
}

func TestJobVerificationStatus_FailureLimitReached_NotFailedBeforeExceeded(t *testing.T) {
	now := time.Now()
	failureThreshold := 2

	verification := JobVerification{
		Id:        "verification-3",
		JobId:     "job-3",
		CreatedAt: now,
		Metrics: []VerificationMetricStatus{
			{
				Name:             "metric-1",
				Count:            5,
				IntervalSeconds:  30,
				SuccessCondition: "true",
				FailureThreshold: &failureThreshold,
				Measurements: []VerificationMeasurement{
					{Status: Failed, MeasuredAt: now},
					{Status: Failed, MeasuredAt: now.Add(1 * time.Second)},
				},
			},
		},
	}

	assert.Equal(t, JobVerificationStatusRunning, verification.Status())
}

func TestJobVerificationStatus_FailureLimitReached_WithCountComplete_Passes(t *testing.T) {
	now := time.Now()
	failureThreshold := 2

	verification := JobVerification{
		Id:        "verification-4",
		JobId:     "job-4",
		CreatedAt: now,
		Metrics: []VerificationMetricStatus{
			{
				Name:             "metric-1",
				Count:            3,
				IntervalSeconds:  30,
				SuccessCondition: "true",
				FailureThreshold: &failureThreshold,
				Measurements: []VerificationMeasurement{
					{Status: Failed, MeasuredAt: now},
					{Status: Failed, MeasuredAt: now.Add(1 * time.Second)},
					{Status: Passed, MeasuredAt: now.Add(2 * time.Second)},
				},
			},
		},
	}

	assert.Equal(t, JobVerificationStatusPassed, verification.Status())
}
