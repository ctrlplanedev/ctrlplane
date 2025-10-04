package policymanager

import (
	"context"
	"fmt"
	"time"

	"workspace-engine/pkg/pb"
	"workspace-engine/pkg/workspace/releasemanager/versionmanager/policymanager/results"
)

// evaluateDenyWindow checks if deployment is blocked by a time window.
// Performance: Receives pre-computed time.Now() to avoid syscall in hot path.
func (m *Manager) evaluateDenyWindow(
	ctx context.Context,
	ruleID string,
	rule *pb.DenyWindowRule,
	now time.Time,
) (*results.RuleEvaluationResult, error) {
	// Parse timezone
	location, err := time.LoadLocation(rule.GetTimeZone())
	if err != nil {
		return nil, fmt.Errorf("invalid timezone %s: %w", rule.GetTimeZone(), err)
	}

	nowInZone := now.In(location)

	// Check if current time falls within a deny window
	// TODO: Implement actual RRule parsing and evaluation
	// For now, this is a placeholder
	inDenyWindow := false
	nextAllowedTime := nowInZone

	if inDenyWindow {
		reason := fmt.Sprintf("Deployment blocked by deny window until %s", nextAllowedTime.Format(time.RFC3339))
		return results.NewDeniedResult(ruleID, "deny_window", reason).
			WithDetail("next_allowed_time", nextAllowedTime).
			WithDetail("timezone", rule.GetTimeZone()), nil
	}

	return results.NewAllowedResult(ruleID, "deny_window", "Outside deny window"), nil
}
