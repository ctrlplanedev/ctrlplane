package deploymentwindow

import (
	"context"
	"fmt"
	"time"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator"
	"workspace-engine/pkg/workspace/releasemanager/policy/results"
	"workspace-engine/pkg/workspace/store"

	"github.com/teambition/rrule-go"
	"go.opentelemetry.io/otel"
)

var tracer = otel.Tracer("workspace/releasemanager/policy/evaluator/deploymentwindow")

var _ evaluator.Evaluator = &DeploymentWindowEvaluator{}

// DeploymentWindowEvaluator evaluates whether the current time is within a deployment window
// defined by an rrule pattern.
type DeploymentWindowEvaluator struct {
	store    *store.Store
	ruleId   string
	rule     *oapi.DeploymentWindowRule
	rrule    *rrule.RRule
	location *time.Location
}

// NewEvaluator creates a new DeploymentWindowEvaluator from a policy rule.
// Returns nil if the rule doesn't contain a deployment window configuration.
func NewEvaluator(store *store.Store, policyRule *oapi.PolicyRule) evaluator.Evaluator {
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

	return evaluator.WithMemoization(&DeploymentWindowEvaluator{
		store:    store,
		ruleId:   policyRule.Id,
		rule:     rule,
		rrule:    r,
		location: loc,
	})
}

// ScopeFields returns ReleaseTarget since deployment window evaluation needs to
// know if the target has a deployed version already.
func (e *DeploymentWindowEvaluator) ScopeFields() evaluator.ScopeFields {
	return evaluator.ScopeReleaseTarget
}

// RuleType returns the rule type identifier for bypass matching.
func (e *DeploymentWindowEvaluator) RuleType() string {
	return evaluator.RuleTypeDeploymentWindow
}

// RuleId returns the rule ID.
func (e *DeploymentWindowEvaluator) RuleId() string {
	return e.ruleId
}

// Complexity returns the computational complexity of this evaluator.
func (e *DeploymentWindowEvaluator) Complexity() int {
	return 2
}

// formatDuration returns a human-readable duration string.
func formatDuration(d time.Duration) string {
	if d < time.Minute {
		return fmt.Sprintf("%ds", int(d.Seconds()))
	}
	if d < time.Hour {
		return fmt.Sprintf("%dm", int(d.Minutes()))
	}
	hours := int(d.Hours())
	minutes := int(d.Minutes()) % 60
	if minutes == 0 {
		return fmt.Sprintf("%dh", hours)
	}
	return fmt.Sprintf("%dh %dm", hours, minutes)
}

// Evaluate checks if the current time is within a deployment window.
func (e *DeploymentWindowEvaluator) Evaluate(
	ctx context.Context,
	scope evaluator.EvaluatorScope,
) *oapi.RuleEvaluation {
	_, span := tracer.Start(ctx, "DeploymentWindowEvaluator.Evaluate")
	defer span.End()

	_, _, err := e.store.ReleaseTargets.GetCurrentRelease(ctx, scope.ReleaseTarget())
	if err != nil {
		return results.NewAllowedResult("No previous version deployed - deployment window ignored").
			WithDetail("reason", "first_deployment")
	}

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

// ValidateRRule validates an rrule string without creating an evaluator.
// Returns an error if the rrule is invalid.
func ValidateRRule(rruleStr string) error {
	_, err := rrule.StrToRRule(rruleStr)
	if err != nil {
		return fmt.Errorf("invalid rrule: %w", err)
	}
	return nil
}

// GetNextWindowStart returns when the next deployment window starts relative to the given time.
// This is used by gradual rollout to adjust rollout start times to respect deployment windows.
//
// For allow windows (allowWindow=true or nil):
//   - If 'at' is inside a window, returns nil (no adjustment needed)
//   - If 'at' is outside a window, returns the start of the next window
//
// For deny windows (allowWindow=false):
//   - Always returns nil (deny windows don't affect rollout start time,
//     they only block individual deployments during the window)
//
// Returns error if the rrule is invalid.
func GetNextWindowStart(rule *oapi.DeploymentWindowRule, at time.Time) (*time.Time, error) {
	if rule == nil {
		return nil, nil
	}

	// Deny windows don't affect rollout start time
	isAllowWindow := rule.AllowWindow == nil || *rule.AllowWindow
	if !isAllowWindow {
		return nil, nil
	}

	// Parse timezone
	loc := time.UTC
	if rule.Timezone != nil && *rule.Timezone != "" {
		parsedLoc, err := time.LoadLocation(*rule.Timezone)
		if err == nil {
			loc = parsedLoc
		}
	}

	// Parse the rrule
	r, err := rrule.StrToRRule(rule.Rrule)
	if err != nil {
		return nil, fmt.Errorf("invalid rrule: %w", err)
	}

	duration := time.Duration(rule.DurationMinutes) * time.Minute
	atInLoc := at.In(loc)

	// Set DTSTART to be far enough in the past to find previous occurrences
	// We need to look back at least one full recurrence cycle plus the duration
	// to ensure we can find windows that might currently be open
	lookbackStart := atInLoc.Add(-duration).Add(-24 * time.Hour * 7) // Go back a week plus duration
	if r.OrigOptions.Dtstart.IsZero() || r.OrigOptions.Dtstart.After(lookbackStart) {
		r.DTStart(lookbackStart)
	}

	// Check if 'at' is inside a current window
	// Look back by duration to find windows that might still be open
	searchStart := atInLoc.Add(-duration)
	before := r.Before(atInLoc.Add(time.Second), true)

	if !before.IsZero() && before.After(searchStart) {
		windowEnd := before.Add(duration)
		if atInLoc.Before(windowEnd) {
			// We're inside a window, no adjustment needed
			return nil, nil
		}
	}

	// We're outside a window, find the next one
	nextWindow := r.After(atInLoc, false)
	if nextWindow.IsZero() {
		// No future windows (e.g., COUNT limit reached)
		return nil, nil
	}

	return &nextWindow, nil
}

// IsInsideWindow checks if the given time is inside a deployment window.
// For allow windows, returns true if inside the window.
// For deny windows, returns true if inside the window (meaning deployments are blocked).
func IsInsideWindow(rule *oapi.DeploymentWindowRule, at time.Time) (bool, error) {
	if rule == nil {
		return false, nil
	}

	// Parse timezone
	loc := time.UTC
	if rule.Timezone != nil && *rule.Timezone != "" {
		parsedLoc, err := time.LoadLocation(*rule.Timezone)
		if err == nil {
			loc = parsedLoc
		}
	}

	// Parse the rrule
	r, err := rrule.StrToRRule(rule.Rrule)
	if err != nil {
		return false, fmt.Errorf("invalid rrule: %w", err)
	}

	duration := time.Duration(rule.DurationMinutes) * time.Minute
	atInLoc := at.In(loc)

	// Set DTSTART to be far enough in the past to find previous occurrences
	lookbackStart := atInLoc.Add(-duration).Add(-24 * time.Hour * 7)
	if r.OrigOptions.Dtstart.IsZero() || r.OrigOptions.Dtstart.After(lookbackStart) {
		r.DTStart(lookbackStart)
	}

	// Look back by duration to find windows that might still be open
	searchStart := atInLoc.Add(-duration)
	before := r.Before(atInLoc.Add(time.Second), true)

	if !before.IsZero() && before.After(searchStart) {
		windowEnd := before.Add(duration)
		if atInLoc.Before(windowEnd) {
			return true, nil
		}
	}

	return false, nil
}

// GetDenyWindowEnd returns when the current deny window ends if 'at' is inside a deny window.
// This is used by gradual rollout to adjust rollout start times to avoid frontloading
// when a version is created during a deny window.
//
// For deny windows (allowWindow=false):
//   - If 'at' is inside a window, returns the window end time
//   - If 'at' is outside a window, returns nil (no adjustment needed)
//
// For allow windows (allowWindow=true or nil):
//   - Always returns nil (allow windows are handled by GetNextWindowStart)
//
// Returns error if the rrule is invalid.
func GetDenyWindowEnd(rule *oapi.DeploymentWindowRule, at time.Time) (*time.Time, error) {
	if rule == nil {
		return nil, nil
	}

	// Only handle deny windows
	isAllowWindow := rule.AllowWindow == nil || *rule.AllowWindow
	if isAllowWindow {
		return nil, nil
	}

	// Parse timezone
	loc := time.UTC
	if rule.Timezone != nil && *rule.Timezone != "" {
		parsedLoc, err := time.LoadLocation(*rule.Timezone)
		if err == nil {
			loc = parsedLoc
		}
	}

	// Parse the rrule
	r, err := rrule.StrToRRule(rule.Rrule)
	if err != nil {
		return nil, fmt.Errorf("invalid rrule: %w", err)
	}

	duration := time.Duration(rule.DurationMinutes) * time.Minute
	atInLoc := at.In(loc)

	// Set DTSTART to be far enough in the past to find previous occurrences
	lookbackStart := atInLoc.Add(-duration).Add(-24 * time.Hour * 7)
	if r.OrigOptions.Dtstart.IsZero() || r.OrigOptions.Dtstart.After(lookbackStart) {
		r.DTStart(lookbackStart)
	}

	// Check if 'at' is inside a current window
	searchStart := atInLoc.Add(-duration)
	before := r.Before(atInLoc.Add(time.Second), true)

	if !before.IsZero() && before.After(searchStart) {
		windowEnd := before.Add(duration)
		if atInLoc.Before(windowEnd) {
			// We're inside a deny window, return when it ends
			return &windowEnd, nil
		}
	}

	// Not inside a deny window, no adjustment needed
	return nil, nil
}
