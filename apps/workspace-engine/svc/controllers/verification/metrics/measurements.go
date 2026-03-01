package metrics

import (
	"time"

	"workspace-engine/pkg/oapi"
)

// Measurements is a collection of verification measurements with analysis methods
type Measurements []oapi.VerificationMeasurement

// NewMeasurements creates a new measurements collection
func NewMeasurements(measurements []oapi.VerificationMeasurement) Measurements {
	return measurements
}

// FailedCount returns the number of failed measurements (excludes inconclusive)
func (m Measurements) FailedCount() int {
	count := 0
	for _, measurement := range m {
		if measurement.Status == oapi.Failed {
			count++
		}
	}
	return count
}

func (m Measurements) ConsecutiveSuccessCount() int {
	count := 0
	for i := 0; i < len(m); i++ {
		switch m[i].Status {
		case oapi.Passed:
			count++
		case oapi.Failed, oapi.Inconclusive:
			// Any non-pass breaks the consecutive chain
			count = 0
		}
	}
	return count
}

// Phase computes the current phase based on measurements
func (m Measurements) Phase(metric *oapi.VerificationMetricStatus) oapi.JobVerificationStatus {
	if len(m) == 0 {
		return oapi.JobVerificationStatusRunning
	}

	failedCount := m.FailedCount()
	failureLimit := metric.GetFailureLimit()

	isFailureLimitZero := failureLimit == 0
	hasAnyFailures := failedCount > 0
	isFailureLimitExceeded := failureLimit > 0 && failedCount > failureLimit
	if (isFailureLimitZero && hasAnyFailures) || isFailureLimitExceeded {
		return oapi.JobVerificationStatusFailed
	}

	// Check if all measurements completed
	if len(m) >= metric.Count {
		if failedCount == 0 || (failureLimit > 0 && failedCount <= failureLimit) {
			return oapi.JobVerificationStatusPassed
		}
		return oapi.JobVerificationStatusFailed
	}

	return oapi.JobVerificationStatusRunning
}

// TimeUntilNextMeasurement returns the remaining duration before the next
// measurement should be taken based on the metric's interval and the most
// recent measurement's timestamp. Returns 0 (or negative) when enough time
// has elapsed and a measurement can be taken immediately.
func (m Measurements) TimeUntilNextMeasurement(metric *oapi.VerificationMetricStatus) time.Duration {
	if len(m) == 0 {
		return 0
	}
	last := m[len(m)-1]
	elapsed := time.Since(last.MeasuredAt)
	return metric.GetInterval() - elapsed
}

// ShouldContinue checks if more measurements are needed
func (m Measurements) ShouldContinue(metric *oapi.VerificationMetricStatus) bool {
	failureLimit := metric.GetFailureLimit()
	failedCount := m.FailedCount()
	successThreshold := metric.SuccessThreshold

	isFailureLimitZero := failureLimit == 0
	hasAnyFailures := failedCount > 0
	isFailureLimitExceeded := failureLimit > 0 && failedCount > failureLimit
	if (isFailureLimitZero && hasAnyFailures) || isFailureLimitExceeded {
		return false
	}

	isSuccessThresholdMet := successThreshold != nil && m.ConsecutiveSuccessCount() >= *successThreshold
	if isSuccessThresholdMet {
		return false
	}

	// Stop if completed all measurements
	if len(m) >= metric.Count {
		return false
	}

	return true
}
