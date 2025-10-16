package rrule

import (
	"context"
	"fmt"
	"time"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator"

	"workspace-engine/pkg/workspace/releasemanager/policy/results"
	"workspace-engine/pkg/workspace/store"

	"github.com/teambition/rrule-go"
	"go.opentelemetry.io/otel"
)

var tracer = otel.Tracer("workspace/releasemanager/policy/evaluator/rrule")

var _ evaluator.WorkspaceScopedEvaluator = &RRuleEvaluator{}

type RRuleEvaluator struct {
	store         *store.Store
	isAllowWindow bool
	rrule         *rrule.RRule
}

func NewRRuleEvaluator(store *store.Store, rruleStr string, isAllowWindow bool) (*RRuleEvaluator, error) {
	r, err := rrule.StrToRRule(rruleStr)
	if err != nil {
		return nil, fmt.Errorf("failed to parse rrule: %w", err)
	}
	return &RRuleEvaluator{
		store:         store,
		isAllowWindow: isAllowWindow,
		rrule:         r,
	}, nil
}

func (e *RRuleEvaluator) Evaluate(
	ctx context.Context,
) (*results.RuleEvaluationResult, error) {
	_, span := tracer.Start(ctx, "RRuleEvaluator.Evaluate")
	defer span.End()

	currentTime := time.Now()

	// Check if current time is within the rrule pattern
	// Get the next occurrence before or at current time
	before := e.rrule.Before(currentTime, true)

	// Determine if current time is inside the window
	isInsideWindow := false
	if !before.IsZero() {
		// Check if current time is within a reasonable window of the occurrence
		// We consider a small time window (1 minute) to account for timing precision
		timeDiff := currentTime.Sub(before)
		if timeDiff >= 0 && timeDiff <= time.Minute {
			isInsideWindow = true
		}
	}

	// Apply the allow/deny logic based on whether we're in an allow window or deny window
	if e.isAllowWindow {
		// Allow window: inside window = allowed, outside window = denied
		if isInsideWindow {
			return results.NewAllowedResult("Current time is within allowed deployment window").
				WithDetail("current_time", currentTime.Format(time.RFC3339)).
				WithDetail("occurrence", before.Format(time.RFC3339)).
				WithDetail("window_type", "allow").
				WithDetail("rrule", e.rrule.String()), nil
		}
		return results.NewDeniedResult("Current time is outside allowed deployment window").
			WithDetail("current_time", currentTime.Format(time.RFC3339)).
			WithDetail("window_type", "allow").
			WithDetail("rrule", e.rrule.String()), nil
	}

	// Deny window: inside window = denied, outside window = allowed
	if isInsideWindow {
		return results.NewDeniedResult("Current time is within deny window").
			WithDetail("current_time", currentTime.Format(time.RFC3339)).
			WithDetail("occurrence", before.Format(time.RFC3339)).
			WithDetail("window_type", "deny").
			WithDetail("rrule", e.rrule.String()), nil
	}
	return results.NewAllowedResult("Current time is outside deny window").
		WithDetail("current_time", currentTime.Format(time.RFC3339)).
		WithDetail("window_type", "deny").
		WithDetail("rrule", e.rrule.String()), nil
}
