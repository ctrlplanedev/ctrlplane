package rules

import (
	"context"
	"fmt"
	"workspace-engine/pkg/pb"
	"workspace-engine/pkg/workspace/releasemanager/policymanager/evaluator"
	"workspace-engine/pkg/workspace/releasemanager/policymanager/evaluator/results"
)

var _ Rule = &ConcurrencyEvaluator{}

// DeploymentStore defines the interface for querying active deployments.
type DeploymentStore interface {
	// GetActiveDeploymentCount returns the number of currently active deployments
	// for the given deployment ID and environment ID
	GetActiveDeploymentCount(ctx context.Context, deploymentID, environmentID string) (int, error)
}

// ConcurrencyEvaluator evaluates concurrency limit rules.
// These rules prevent too many simultaneous deployments.
type ConcurrencyEvaluator struct {
	ruleID          string
	rule            *pb.ConcurrencyRule
	deploymentStore DeploymentStore
}

// NewConcurrencyEvaluator creates a new concurrency evaluator.
func NewConcurrencyEvaluator(ruleID string, rule *pb.ConcurrencyRule, store DeploymentStore) *ConcurrencyEvaluator {
	return &ConcurrencyEvaluator{
		ruleID:          ruleID,
		rule:            rule,
		deploymentStore: store,
	}
}

func (e *ConcurrencyEvaluator) Type() string {
	return "concurrency"
}

func (e *ConcurrencyEvaluator) RuleID() string {
	return e.ruleID
}

func (e *ConcurrencyEvaluator) Evaluate(ctx context.Context, evalCtx *evaluator.EvaluationContext) (*results.RuleEvaluationResult, error) {
	activeCount, err := e.deploymentStore.GetActiveDeploymentCount(
		ctx,
		evalCtx.Deployment().GetId(),
		evalCtx.Environment().GetId(),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to get active deployment count: %w", err)
	}

	maxConcurrent := int(e.rule.GetMaxConcurrent())
	if activeCount >= maxConcurrent {
		reason := fmt.Sprintf("Concurrency limit reached (%d/%d active)", activeCount, maxConcurrent)
		return results.NewPendingResult(e.ruleID, e.Type(), "wait", reason).
			WithDetail("active_count", activeCount).
			WithDetail("max_concurrent", maxConcurrent), nil
	}

	reason := fmt.Sprintf("Within concurrency limits (%d/%d)", activeCount, maxConcurrent)
	return results.NewAllowedResult(e.ruleID, e.Type(), reason).
		WithDetail("active_count", activeCount).
		WithDetail("max_concurrent", maxConcurrent), nil
}

