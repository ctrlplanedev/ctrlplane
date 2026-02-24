package environmentprogression

import (
	"context"
	"fmt"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator"
	"workspace-engine/pkg/workspace/releasemanager/policy/results"
)

type PassRateEvaluator struct {
	getters                  Getters
	minimumSuccessPercentage float32
	successStatuses          map[oapi.JobStatus]bool
}

func NewPassRateEvaluator(
	getters Getters,
	minimumSuccessPercentage float32,
	successStatuses map[oapi.JobStatus]bool,
) evaluator.Evaluator {
	if successStatuses == nil {
		successStatuses = map[oapi.JobStatus]bool{oapi.JobStatusSuccessful: true}
	}
	return evaluator.WithMemoization(&PassRateEvaluator{
		getters:                  getters,
		minimumSuccessPercentage: minimumSuccessPercentage,
		successStatuses:          successStatuses,
	})
}

func (e *PassRateEvaluator) ScopeFields() evaluator.ScopeFields {
	return evaluator.ScopeEnvironment | evaluator.ScopeVersion
}

// RuleType returns the rule type identifier for bypass matching.
func (e *PassRateEvaluator) RuleType() string {
	return evaluator.RuleTypeEnvironmentProgression
}

func (e *PassRateEvaluator) RuleId() string {
	return "passRate"
}

func (e *PassRateEvaluator) Complexity() int {
	return 1
}

func (e *PassRateEvaluator) Evaluate(ctx context.Context, scope evaluator.EvaluatorScope) *oapi.RuleEvaluation {
	tracker := NewReleaseTargetJobTracker(ctx, e.getters, scope.Environment, scope.Version, e.successStatuses)
	return e.EvaluateWithTracker(tracker)
}

// EvaluateWithTracker evaluates pass rate using a pre-built tracker to avoid duplicate data fetching.
func (e *PassRateEvaluator) EvaluateWithTracker(tracker *ReleaseTargetJobTracker) *oapi.RuleEvaluation {
	successPercentage := tracker.GetSuccessPercentage()

	// Handle default case: when minimumSuccessPercentage is 0, require at least one successful job (> 0%)
	if e.minimumSuccessPercentage == 0 {
		if successPercentage == 0 {
			return results.NewDeniedResult("No successful jobs").
				WithDetail("success_percentage", successPercentage).
				WithDetail("minimum_success_percentage", 0.0)
		}
		// Find the earliest success time (first successful job)
		satisfiedAt := tracker.GetEarliestSuccess()
		return results.NewAllowedResult(fmt.Sprintf("Success rate %.1f%% meets requirement (at least one successful job)", successPercentage)).
			WithDetail("success_percentage", successPercentage).
			WithDetail("minimum_success_percentage", 0.0).
			WithSatisfiedAt(satisfiedAt)
	}

	if successPercentage < e.minimumSuccessPercentage {
		return results.NewDeniedResult(fmt.Sprintf("Success rate %.1f%% below required %.1f%%", successPercentage, e.minimumSuccessPercentage)).
			WithDetail("success_percentage", successPercentage).
			WithDetail("minimum_success_percentage", e.minimumSuccessPercentage)
	}

	return results.NewAllowedResult(fmt.Sprintf("Success rate %.1f%% meets required %.1f%%", successPercentage, e.minimumSuccessPercentage)).
		WithDetail("success_percentage", successPercentage).
		WithDetail("minimum_success_percentage", e.minimumSuccessPercentage).
		WithSatisfiedAt(tracker.GetSuccessPercentageSatisfiedAt(e.minimumSuccessPercentage))
}
