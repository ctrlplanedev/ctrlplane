package environmentprogression

import (
	"context"
	"fmt"
	"time"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator"
	"workspace-engine/pkg/workspace/releasemanager/policy/results"
	"workspace-engine/pkg/workspace/store"
)

var _ evaluator.Evaluator = &SoakTimeEvaluator{}

type SoakTimeEvaluator struct {
	store           *store.Store
	soakMinutes     int32
	successStatuses map[oapi.JobStatus]bool
	timeGetter      func() time.Time
}

func NewSoakTimeEvaluator(
	store *store.Store,
	soakMinutes int32,
	successStatuses map[oapi.JobStatus]bool,
) evaluator.Evaluator {
	if soakMinutes <= 0 {
		return nil
	}
	if successStatuses == nil {
		successStatuses = map[oapi.JobStatus]bool{
			oapi.JobStatusSuccessful: true,
		}
	}
	return evaluator.WithMemoization(&SoakTimeEvaluator{
		store:           store,
		soakMinutes:     soakMinutes,
		successStatuses: successStatuses,
		timeGetter: func() time.Time {
			return time.Now()
		},
	})
}

// ScopeFields declares that this evaluator cares about Environment and Version.
func (e *SoakTimeEvaluator) ScopeFields() evaluator.ScopeFields {
	return evaluator.ScopeEnvironment | evaluator.ScopeVersion
}

// RuleType returns the rule type identifier for bypass matching.
func (e *SoakTimeEvaluator) RuleType() string {
	return evaluator.RuleTypeEnvironmentProgression
}

func (e *SoakTimeEvaluator) RuleId() string {
	return "soakTime"
}

func (e *SoakTimeEvaluator) Complexity() int {
	return 3
}

// Evaluate checks if the soak time requirement is satisfied.
func (e *SoakTimeEvaluator) Evaluate(
	ctx context.Context,
	scope evaluator.EvaluatorScope,
) *oapi.RuleEvaluation {
	environment := scope.Environment
	version := scope.Version

	tracker := NewReleaseTargetJobTracker(ctx, e.store, environment, version, e.successStatuses)
	return e.EvaluateWithTracker(tracker)
}

// EvaluateWithTracker evaluates soak time using a pre-built tracker to avoid duplicate data fetching.
func (e *SoakTimeEvaluator) EvaluateWithTracker(tracker *ReleaseTargetJobTracker) *oapi.RuleEvaluation {
	// Check if there are successful jobs
	mostRecentSuccess := tracker.GetMostRecentSuccess()
	if mostRecentSuccess.IsZero() {
		return results.NewDeniedResult("No successful jobs for soak time check")
	}

	soakDuration := time.Duration(e.soakMinutes) * time.Minute
	soakTimeRemaining := tracker.GetSoakTimeRemaining(soakDuration)

	if soakTimeRemaining > 0 {
		// Calculate when soak time will be complete
		nextEvalTime := mostRecentSuccess.Add(soakDuration)

		message := fmt.Sprintf("Soak time required: %d minutes. Time remaining: %s", e.soakMinutes, soakTimeRemaining.Round(time.Minute))
		return results.NewPendingResult(results.ActionTypeWait, message).
			WithDetail("soak_time_remaining_minutes", int(soakTimeRemaining.Minutes())).
			WithDetail("soak_minutes", e.soakMinutes).
			WithDetail("most_recent_success", mostRecentSuccess.Format(time.RFC3339)).
			WithNextEvaluationTime(nextEvalTime)
	}

	// Soak time is satisfied - calculate when it was satisfied
	// Soak time is satisfied when: now - mostRecentSuccess >= soakDuration
	// So it was satisfied at: mostRecentSuccess + soakDuration
	satisfiedAt := mostRecentSuccess.Add(soakDuration)

	return results.NewAllowedResult(fmt.Sprintf("Soak time requirement met (%d minutes)", e.soakMinutes)).
		WithDetail("soak_minutes", e.soakMinutes).
		WithDetail("most_recent_success", mostRecentSuccess.Format(time.RFC3339)).
		WithSatisfiedAt(satisfiedAt)
}
