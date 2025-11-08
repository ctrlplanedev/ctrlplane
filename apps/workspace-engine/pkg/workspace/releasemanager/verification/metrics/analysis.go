package metrics

import (
	"workspace-engine/pkg/oapi"
)

// Result represents a single measurement with evaluation
type Result struct {
	Message     string
	Passed      bool
	Measurement *Measurement
}

func (r *Result) ToOAPI() *oapi.VerificationResult {
	return &oapi.VerificationResult{
		Message:    &r.Message,
		Passed:     r.Passed,
		Data:       &r.Measurement.Data,
		MeasuredAt: r.Measurement.MeasuredAt,
	}
}

// Status tracks all measurements
type Analysis struct {
	Measurements []*Result
}

func NewAnalysis() *Analysis {
	return &Analysis{
		Measurements: make([]*Result, 0),
	}
}

// PassedCount returns the number of passed measurements
func (s *Analysis) PassedCount() int {
	count := 0
	for _, m := range s.Measurements {
		if m.Passed {
			count++
		}
	}
	return count
}

// FailedCount returns the number of failed measurements
func (s *Analysis) FailedCount() int {
	count := 0
	for _, m := range s.Measurements {
		if !m.Passed {
			count++
		}
	}
	return count
}

// Phase computes the current phase based on measurements
func (s *Analysis) Phase(metric *Metric) oapi.VerificationAnalysisStatus {
	if len(s.Measurements) == 0 {
		return oapi.VerificationAnalysisStatusRunning
	}

	failedCount := s.FailedCount()

	// Check failure limit
	if metric.FailureLimit > 0 && failedCount >= metric.FailureLimit {
		return oapi.VerificationAnalysisStatusFailed
	}

	// Check if all measurements completed
	if len(s.Measurements) >= metric.Count {
		if failedCount > 0 && metric.FailureLimit > 0 && failedCount < metric.FailureLimit {
			return oapi.VerificationAnalysisStatusRunning // Below failure threshold
		}
		if failedCount == 0 {
			return oapi.VerificationAnalysisStatusPassed // All passed
		}
		return oapi.VerificationAnalysisStatusFailed
	}

	return oapi.VerificationAnalysisStatusRunning
}

// ShouldContinue checks if more measurements are needed
func (s *Analysis) ShouldContinue(metric *Metric) bool {
	// Stop if hit failure limit
	if metric.FailureLimit > 0 && s.FailedCount() >= metric.FailureLimit {
		return false
	}

	// Stop if completed all measurements
	if len(s.Measurements) >= metric.Count {
		return false
	}

	return true
}
