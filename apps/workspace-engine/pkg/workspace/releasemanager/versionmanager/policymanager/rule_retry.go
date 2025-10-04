package policymanager

import (
	"context"
	"fmt"

	"workspace-engine/pkg/pb"
	"workspace-engine/pkg/workspace/releasemanager/versionmanager/policymanager/results"
)

// evaluateMaxRetries checks if retry limit has been reached.
func (m *Manager) evaluateMaxRetries(
	ctx context.Context,
	ruleID string,
	rule *pb.MaxRetriesRule,
	version *pb.DeploymentVersion,
	releaseTarget *pb.ReleaseTarget,
) (*results.RuleEvaluationResult, error) {
	// TODO: Implement RetryStore on store
	// For now, assume within limits
	maxRetries := int(rule.GetMaxRetries())
	retryCount := 0 // TODO: Get actual count

	if retryCount >= maxRetries {
		reason := fmt.Sprintf("Maximum retry limit reached (%d/%d)", retryCount, maxRetries)
		return results.NewDeniedResult(ruleID, "max_retries", reason).
			WithDetail("retry_count", retryCount).
			WithDetail("max_retries", maxRetries), nil
	}

	reason := fmt.Sprintf("Within retry limits (%d/%d)", retryCount, maxRetries)
	return results.NewAllowedResult(ruleID, "max_retries", reason).
		WithDetail("retry_count", retryCount).
		WithDetail("max_retries", maxRetries), nil
}
