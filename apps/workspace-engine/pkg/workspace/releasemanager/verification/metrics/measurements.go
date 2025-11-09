package metrics

import (
	"workspace-engine/pkg/oapi"
)

// Measurements is a collection of verification measurements with analysis methods
type Measurements []oapi.VerificationMeasurement

// NewMeasurements creates a new measurements collection
func NewMeasurements(measurements []oapi.VerificationMeasurement) Measurements {
	return measurements
}

// PassedCount returns the number of passed measurements
func (m Measurements) PassedCount() int {
	count := 0
	for _, m := range m {
		if m.Passed {
			count++
		}
	}
	return count
}

// FailedCount returns the number of failed measurements
func (m Measurements) FailedCount() int {
	count := 0
	for _, m := range m {
		if !m.Passed {
			count++
		}
	}
	return count
}

// Phase computes the current phase based on measurements
func (m Measurements) Phase(metric *oapi.VerificationMetricStatus) oapi.ReleaseVerificationStatus {
	if len(m) == 0 {
		return oapi.ReleaseVerificationStatusRunning
	}

	failedCount := m.FailedCount()
	failureLimit := metric.GetFailureLimit()

	// Check failure limit
	if failureLimit > 0 && failedCount >= failureLimit {
		return oapi.ReleaseVerificationStatusFailed
	}

	// Check if all measurements completed
	if len(m) >= metric.Count {
		if failedCount > 0 && failureLimit > 0 && failedCount < failureLimit {
			return oapi.ReleaseVerificationStatusRunning // Below failure threshold
		}
		if failedCount == 0 {
			return oapi.ReleaseVerificationStatusPassed // All passed
		}
		return oapi.ReleaseVerificationStatusFailed
	}

	return oapi.ReleaseVerificationStatusRunning
}

// ShouldContinue checks if more measurements are needed
func (m Measurements) ShouldContinue(metric *oapi.VerificationMetricStatus) bool {
	failureLimit := metric.GetFailureLimit()

	// Stop if hit failure limit
	if failureLimit > 0 && m.FailedCount() >= failureLimit {
		return false
	}

	// Stop if completed all measurements
	if len(m) >= metric.Count {
		return false
	}

	return true
}
