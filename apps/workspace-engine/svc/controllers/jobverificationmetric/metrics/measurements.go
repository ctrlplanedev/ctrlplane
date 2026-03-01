package metrics

import "time"

type Measurements []Measurement

func NewMeasurements(measurements []Measurement) Measurements {
	return measurements
}

func (m Measurements) FailedCount() int {
	count := 0
	for _, measurement := range m {
		if measurement.Status == StatusFailed {
			count++
		}
	}
	return count
}

func (m Measurements) ConsecutiveSuccessCount() int {
	count := 0
	for i := 0; i < len(m); i++ {
		switch m[i].Status {
		case StatusPassed:
			count++
		case StatusFailed, StatusInconclusive:
			count = 0
		}
	}
	return count
}

func (m Measurements) Phase(metric *VerificationMetric) VerificationStatus {
	if len(m) == 0 {
		return VerificationRunning
	}

	failedCount := m.FailedCount()
	failureLimit := metric.FailureLimit()

	isFailureLimitZero := failureLimit == 0
	hasAnyFailures := failedCount > 0
	isFailureLimitExceeded := failureLimit > 0 && failedCount > failureLimit
	if (isFailureLimitZero && hasAnyFailures) || isFailureLimitExceeded {
		return VerificationFailed
	}

	if metric.SuccessThreshold != nil && m.ConsecutiveSuccessCount() >= int(*metric.SuccessThreshold) {
		return VerificationPassed
	}

	if len(m) >= int(metric.Count) {
		if failedCount == 0 || (failureLimit > 0 && failedCount <= failureLimit) {
			return VerificationPassed
		}
		return VerificationFailed
	}

	return VerificationRunning
}

// TimeUntilNextMeasurement returns the remaining duration before the next
// measurement should be taken. Returns 0 (or negative) when a measurement
// can be taken immediately.
func (m Measurements) TimeUntilNextMeasurement(metric *VerificationMetric) time.Duration {
	if len(m) == 0 {
		return 0
	}
	last := m[len(m)-1]
	elapsed := time.Since(last.MeasuredAt)
	return metric.Interval() - elapsed
}

func (m Measurements) ShouldContinue(metric *VerificationMetric) bool {
	failureLimit := metric.FailureLimit()
	failedCount := m.FailedCount()

	isFailureLimitZero := failureLimit == 0
	hasAnyFailures := failedCount > 0
	isFailureLimitExceeded := failureLimit > 0 && failedCount > failureLimit
	if (isFailureLimitZero && hasAnyFailures) || isFailureLimitExceeded {
		return false
	}

	if metric.SuccessThreshold != nil && m.ConsecutiveSuccessCount() >= int(*metric.SuccessThreshold) {
		return false
	}

	if len(m) >= int(metric.Count) {
		return false
	}

	return true
}
