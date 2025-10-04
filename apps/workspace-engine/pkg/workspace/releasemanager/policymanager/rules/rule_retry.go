package rules

import (
	"context"
	"fmt"
	"workspace-engine/pkg/pb"
	"workspace-engine/pkg/workspace/releasemanager/policymanager/evaluator"
	"workspace-engine/pkg/workspace/releasemanager/policymanager/evaluator/results"
)

var _ Rule = &MaxRetriesEvaluator{}

// RetryStore defines the interface for querying deployment retry history.
type RetryStore interface {
	// GetRetryCount returns the number of times this deployment version has been retried
	GetRetryCount(ctx context.Context, versionID, environmentID, resourceID string) (int, error)
}

// MaxRetriesEvaluator evaluates maximum retry limit rules.
type MaxRetriesEvaluator struct {
	ruleID     string
	rule       *pb.MaxRetriesRule
	retryStore RetryStore
}

// NewMaxRetriesEvaluator creates a new max retries evaluator.
func NewMaxRetriesEvaluator(ruleID string, rule *pb.MaxRetriesRule, store RetryStore) *MaxRetriesEvaluator {
	return &MaxRetriesEvaluator{
		ruleID:     ruleID,
		rule:       rule,
		retryStore: store,
	}
}

func (e *MaxRetriesEvaluator) Type() string {
	return "max_retries"
}

func (e *MaxRetriesEvaluator) RuleID() string {
	return e.ruleID
}

func (e *MaxRetriesEvaluator) Evaluate(ctx context.Context, evalCtx *evaluator.EvaluationContext) (*results.RuleEvaluationResult, error) {
	retryCount, err := e.retryStore.GetRetryCount(
		ctx,
		evalCtx.Version.GetId(),
		evalCtx.Environment().GetId(),
		evalCtx.Resource().GetId(),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to get retry count: %w", err)
	}

	maxRetries := int(e.rule.GetMaxRetries())
	if retryCount >= maxRetries {
		reason := fmt.Sprintf("Maximum retry limit reached (%d/%d)", retryCount, maxRetries)
		return results.NewDeniedResult(e.ruleID, e.Type(), reason).
			WithDetail("retry_count", retryCount).
			WithDetail("max_retries", maxRetries), nil
	}

	reason := fmt.Sprintf("Within retry limits (%d/%d)", retryCount, maxRetries)

	return results.NewAllowedResult(e.ruleID, e.Type(), reason).
		WithDetail("retry_count", retryCount).
		WithDetail("max_retries", maxRetries), nil
}

