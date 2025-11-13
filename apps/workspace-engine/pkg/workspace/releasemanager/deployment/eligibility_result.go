package deployment

import (
	"time"
)

// EligibilityDecision represents whether a job should be created.
type EligibilityDecision string

const (
	// EligibilityAllowed indicates the job should be created immediately
	EligibilityAllowed EligibilityDecision = "allowed"

	// EligibilityDenied indicates the job should not be created (retry limit exceeded, etc.)
	EligibilityDenied EligibilityDecision = "denied"

	// EligibilityPending indicates the job creation is delayed (e.g., waiting for backoff)
	// The system should schedule re-evaluation at NextEvaluationTime
	EligibilityPending EligibilityDecision = "pending"
)

// EligibilityResult contains the result of a job eligibility check.
type EligibilityResult struct {
	// Decision indicates whether the job should be created
	Decision EligibilityDecision

	// Reason provides a human-readable explanation for the decision
	Reason string

	// NextEvaluationTime is when the eligibility should be re-evaluated (for pending decisions)
	// This is used to schedule future reconciliation
	NextEvaluationTime *time.Time

	// Details contains additional structured information about the decision
	Details map[string]interface{}
}

// IsAllowed returns true if the job can be created immediately.
func (r *EligibilityResult) IsAllowed() bool {
	return r.Decision == EligibilityAllowed
}

// IsDenied returns true if the job should not be created.
func (r *EligibilityResult) IsDenied() bool {
	return r.Decision == EligibilityDenied
}

// IsPending returns true if the job creation is delayed pending some condition.
func (r *EligibilityResult) IsPending() bool {
	return r.Decision == EligibilityPending
}

// ShouldScheduleRetry returns true if there's a future time when this should be re-evaluated.
func (r *EligibilityResult) ShouldScheduleRetry() bool {
	return r.IsPending() && r.NextEvaluationTime != nil
}
