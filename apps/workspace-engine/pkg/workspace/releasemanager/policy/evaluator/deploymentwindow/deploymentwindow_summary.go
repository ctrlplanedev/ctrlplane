package deploymentwindow

import (
	"context"
	"time"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator"
	"workspace-engine/pkg/workspace/releasemanager/policy/results"
	"workspace-engine/pkg/workspace/store"

	"github.com/teambition/rrule-go"
	"go.opentelemetry.io/otel"
)

var summaryTracer = otel.Tracer("workspace/releasemanager/policy/evaluator/deploymentwindow/summary")

var _ evaluator.Evaluator = &DeploymentWindowSummaryEvaluator{}

// DeploymentWindowSummaryEvaluator evaluates whether the current time is within a deployment window
// defined by an rrule pattern.
type DeploymentWindowSummaryEvaluator struct {
	ruleId   string
	rule     *oapi.DeploymentWindowRule
	rrule    *rrule.RRule
	location *time.Location
}

// NewSummaryEvaluator creates a new DeploymentWindowSummaryEvaluator from a policy rule.
// Returns nil if the rule doesn't contain a deployment window configuration.
func NewSummaryEvaluator(store *store.Store, policyRule *oapi.PolicyRule) evaluator.Evaluator {
	if policyRule == nil || policyRule.DeploymentWindow == nil || store == nil {
		return nil
	}

	rule := policyRule.DeploymentWindow

	// Parse timezone, default to UTC
	loc := time.UTC
	if rule.Timezone != nil && *rule.Timezone != "" {
		parsedLoc, err := time.LoadLocation(*rule.Timezone)
		if err == nil {
			loc = parsedLoc
		}
	}

	// Parse the rrule string
	r, err := rrule.StrToRRule(rule.Rrule)
	if err != nil {
		// Return nil if rrule is invalid - this will be filtered out by CollectEvaluators
		return nil
	}

	// Set DTSTART far enough in the past to find previous occurrences
	// that might still have open windows (matching the utility functions).
	duration := time.Duration(rule.DurationMinutes) * time.Minute
	lookbackStart := time.Now().In(loc).Add(-duration).Add(-24 * time.Hour * 7)
	if r.OrigOptions.Dtstart.IsZero() || r.OrigOptions.Dtstart.After(lookbackStart) {
		r.DTStart(lookbackStart)
	}

	return evaluator.WithMemoization(&DeploymentWindowSummaryEvaluator{
		ruleId:   policyRule.Id,
		rule:     rule,
		rrule:    r,
		location: loc,
	})
}

// ScopeFields returns ReleaseTarget since deployment window evaluation needs to
// know if the target has a deployed version already.
func (e *DeploymentWindowSummaryEvaluator) ScopeFields() evaluator.ScopeFields {
	return evaluator.ScopeEnvironment | evaluator.ScopeVersion
}

// RuleType returns the rule type identifier for bypass matching.
func (e *DeploymentWindowSummaryEvaluator) RuleType() string {
	return evaluator.RuleTypeDeploymentWindow
}

// RuleId returns the rule ID.
func (e *DeploymentWindowSummaryEvaluator) RuleId() string {
	return e.ruleId
}

// Complexity returns the computational complexity of this evaluator.
func (e *DeploymentWindowSummaryEvaluator) Complexity() int {
	return 2
}

// Evaluate checks if the current time is within a deployment window.
func (e *DeploymentWindowSummaryEvaluator) Evaluate(
	ctx context.Context,
	scope evaluator.EvaluatorScope,
) *oapi.RuleEvaluation {
	_, span := summaryTracer.Start(ctx, "DeploymentWindowEvaluator.Evaluate")
	defer span.End()

	now := time.Now().In(e.location)
	duration := time.Duration(e.rule.DurationMinutes) * time.Minute

	// Default to allow window if not specified
	isAllowWindow := e.rule.AllowWindow == nil || *e.rule.AllowWindow

	// Get timezone name for metadata
	timezoneName := e.location.String()

	// Find the most recent occurrence before or at current time
	// We need to look back far enough to catch windows that might still be open
	searchStart := now.Add(-duration)
	before := e.rrule.Before(now.Add(time.Second), true) // Add 1 second to include exact matches

	// Check if we're inside a window
	isInsideWindow := false
	var windowStart time.Time
	var windowEnd time.Time

	if !before.IsZero() && before.After(searchStart) {
		windowStart = before
		windowEnd = before.Add(duration)
		if now.Before(windowEnd) {
			isInsideWindow = true
		}
	}

	// Calculate next occurrence for additional metadata
	nextOccurrence := e.rrule.After(now, false)
	var nextWindowStart, nextWindowEnd time.Time
	if !nextOccurrence.IsZero() {
		nextWindowStart = nextOccurrence
		nextWindowEnd = nextOccurrence.Add(duration)
	}

	// Calculate the next relevant time for re-evaluation
	var nextEvalTime time.Time
	if isInsideWindow {
		// If inside window, next eval is when window closes
		nextEvalTime = windowEnd
	} else {
		// If outside window, next eval is when next window opens
		if !nextOccurrence.IsZero() {
			nextEvalTime = nextOccurrence
		}
	}

	// Build the result based on window type
	if isAllowWindow {
		// Allow window: inside = allowed, outside = denied
		if isInsideWindow {
			timeRemaining := windowEnd.Sub(now)
			result := results.NewAllowedResult("Current time is within allowed deployment window").
				WithDetail("current_time", now.Format(time.RFC3339)).
				WithDetail("window_start", windowStart.Format(time.RFC3339)).
				WithDetail("window_end", windowEnd.Format(time.RFC3339)).
				WithDetail("time_remaining", formatDuration(timeRemaining)).
				WithDetail("duration_minutes", e.rule.DurationMinutes).
				WithDetail("window_type", "allow").
				WithDetail("timezone", timezoneName).
				WithDetail("rrule", e.rule.Rrule).
				WithSatisfiedAt(windowStart)

			// Add info about the next window after this one
			if !nextWindowStart.IsZero() {
				result = result.
					WithDetail("next_window_start", nextWindowStart.Format(time.RFC3339)).
					WithDetail("next_window_end", nextWindowEnd.Format(time.RFC3339))
			}

			if !nextEvalTime.IsZero() {
				result = result.WithNextEvaluationTime(nextEvalTime)
			}
			return result
		}

		// Outside allow window - deployment blocked
		result := results.NewPendingResult(results.ActionTypeWait,
			"Current time is outside allowed deployment window").
			WithDetail("current_time", now.Format(time.RFC3339)).
			WithDetail("duration_minutes", e.rule.DurationMinutes).
			WithDetail("window_type", "allow").
			WithDetail("timezone", timezoneName).
			WithDetail("rrule", e.rule.Rrule)

		if !nextWindowStart.IsZero() {
			timeUntilWindow := nextWindowStart.Sub(now)
			result = result.
				WithDetail("next_window_start", nextWindowStart.Format(time.RFC3339)).
				WithDetail("next_window_end", nextWindowEnd.Format(time.RFC3339)).
				WithDetail("time_until_window", formatDuration(timeUntilWindow)).
				WithNextEvaluationTime(nextEvalTime)
		}
		return result
	}

	// Deny window: inside = denied, outside = allowed
	if isInsideWindow {
		timeUntilClear := windowEnd.Sub(now)
		result := results.NewPendingResult(results.ActionTypeWait,
			"Current time is within deny window").
			WithDetail("current_time", now.Format(time.RFC3339)).
			WithDetail("window_start", windowStart.Format(time.RFC3339)).
			WithDetail("window_end", windowEnd.Format(time.RFC3339)).
			WithDetail("time_until_clear", formatDuration(timeUntilClear)).
			WithDetail("duration_minutes", e.rule.DurationMinutes).
			WithDetail("window_type", "deny").
			WithDetail("timezone", timezoneName).
			WithDetail("rrule", e.rule.Rrule)

		// Add info about the next deny window after this one
		if !nextWindowStart.IsZero() {
			result = result.
				WithDetail("next_deny_window_start", nextWindowStart.Format(time.RFC3339)).
				WithDetail("next_deny_window_end", nextWindowEnd.Format(time.RFC3339))
		}

		if !nextEvalTime.IsZero() {
			result = result.WithNextEvaluationTime(nextEvalTime)
		}
		return result
	}

	// Outside deny window - deployment allowed
	result := results.NewAllowedResult("Current time is outside deny window").
		WithDetail("current_time", now.Format(time.RFC3339)).
		WithDetail("duration_minutes", e.rule.DurationMinutes).
		WithDetail("window_type", "deny").
		WithDetail("timezone", timezoneName).
		WithDetail("rrule", e.rule.Rrule).
		WithSatisfiedAt(now)

	if !nextWindowStart.IsZero() {
		timeUntilBlackout := nextWindowStart.Sub(now)
		result = result.
			WithDetail("next_deny_window_start", nextWindowStart.Format(time.RFC3339)).
			WithDetail("next_deny_window_end", nextWindowEnd.Format(time.RFC3339)).
			WithDetail("time_until_blackout", formatDuration(timeUntilBlackout)).
			WithNextEvaluationTime(nextEvalTime)
	}
	return result
}
