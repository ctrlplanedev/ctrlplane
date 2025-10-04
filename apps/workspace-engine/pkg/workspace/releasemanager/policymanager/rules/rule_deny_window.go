package rules

import (
	"context"
	"fmt"
	"time"
	"workspace-engine/pkg/pb"
	"workspace-engine/pkg/workspace/releasemanager/policymanager/evaluator"
	"workspace-engine/pkg/workspace/releasemanager/policymanager/evaluator/results"
)

var _ Rule = &DenyWindowEvaluator{}

// DenyWindowEvaluator evaluates deny window rules.
// These rules prevent deployments during specified time windows (e.g., weekends, holidays).
type DenyWindowEvaluator struct {
	ruleID   string
	rule     *pb.DenyWindowRule
	location *time.Location
}

// NewDenyWindowEvaluator creates a new deny window evaluator.
func NewDenyWindowEvaluator(ruleID string, rule *pb.DenyWindowRule) (*DenyWindowEvaluator, error) {
	// Parse the timezone
	location, err := time.LoadLocation(rule.GetTimeZone())
	if err != nil {
		return nil, fmt.Errorf("invalid timezone %s: %w", rule.GetTimeZone(), err)
	}

	return &DenyWindowEvaluator{
		ruleID:   ruleID,
		rule:     rule,
		location: location,
	}, nil
}

func (e *DenyWindowEvaluator) Type() string {
	return "deny_window"
}

func (e *DenyWindowEvaluator) RuleID() string {
	return e.ruleID
}

func (e *DenyWindowEvaluator) Evaluate(ctx context.Context, evalCtx *evaluator.EvaluationContext) (*results.RuleEvaluationResult, error) {
	now := evalCtx.Now.In(e.location)

	// Check if current time falls within a deny window
	// This is a simplified implementation - you'll need to properly parse
	// and evaluate RRule from the protobuf Struct
	inDenyWindow, nextAllowedTime, err := e.isInDenyWindow(now)
	if err != nil {
		return nil, fmt.Errorf("failed to evaluate deny window: %w", err)
	}

	if inDenyWindow {
		reason := fmt.Sprintf("Deployment blocked by deny window until %s", nextAllowedTime.Format(time.RFC3339))
		return results.NewDeniedResult(e.ruleID, e.Type(), reason).
			WithDetail("next_allowed_time", nextAllowedTime).
			WithDetail("timezone", e.rule.GetTimeZone()), nil
	}

	return results.NewAllowedResult(e.ruleID, e.Type(), "Outside deny window"), nil
}

// isInDenyWindow checks if the given time is within a deny window.
// Returns: (inWindow, nextAllowedTime, error)
func (e *DenyWindowEvaluator) isInDenyWindow(t time.Time) (bool, time.Time, error) {
	// TODO: Implement actual RRule parsing and evaluation
	// For now, this is a placeholder that always returns false
	// You'll need to:
	// 1. Parse the RRule from e.rule.Rrule (protobuf Struct)
	// 2. Use a library like github.com/teambition/rrule-go to evaluate
	// 3. Check if 't' falls within any occurrence
	// 4. Calculate the next allowed time if in a window

	return false, t, nil
}

