package policymanager

import (
	"context"
	"fmt"

	"workspace-engine/pkg/pb"
	"workspace-engine/pkg/workspace/releasemanager/versionmanager/policymanager/results"
)

// evaluateConcurrency checks if concurrent deployment limit is reached.
func (m *Manager) evaluateConcurrency(
	ctx context.Context,
	ruleID string,
	rule *pb.ConcurrencyRule,
	releaseTarget *pb.ReleaseTarget,
) (*results.RuleEvaluationResult, error) {
	maxConcurrent := int(rule.GetMaxConcurrent())
	activeCount := 0 // TODO: Get actual count

	if activeCount >= maxConcurrent {
		reason := fmt.Sprintf("Concurrency limit reached (%d/%d active)", activeCount, maxConcurrent)
		return results.NewPendingResult(ruleID, "concurrency", "wait", reason).
			WithDetail("active_count", activeCount).
			WithDetail("max_concurrent", maxConcurrent), nil
	}

	reason := fmt.Sprintf("Within concurrency limits (%d/%d)", activeCount, maxConcurrent)
	return results.NewAllowedResult(ruleID, "concurrency", reason).
		WithDetail("active_count", activeCount).
		WithDetail("max_concurrent", maxConcurrent), nil
}
