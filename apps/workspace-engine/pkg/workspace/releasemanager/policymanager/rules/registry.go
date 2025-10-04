package rules

import (
	"context"
	"fmt"
	"workspace-engine/pkg/pb"
	"workspace-engine/pkg/workspace/releasemanager/policymanager/evaluator"
	"workspace-engine/pkg/workspace/releasemanager/policymanager/evaluator/results"
)

// NewRuleRegistry creates a new rule registry.
func NewRuleRegistry() *RuleRegistry {
	return &RuleRegistry{
		factories: make(map[string]RuleFactory),
	}
}

// Rule is the interface that all policy rule implementations must satisfy.
// Each rule type (deny window, approval, concurrency, etc.) implements this interface.
type Rule interface {
	// Evaluate assesses whether the rule allows the deployment to proceed.
	// It returns an EvaluationResult with detailed information about the decision.
	Evaluate(ctx context.Context, evalCtx *evaluator.EvaluationContext) (*results.RuleEvaluationResult, error)

	// Type returns the rule type identifier (e.g., "deny_window", "user_approval")
	Type() string

	// RuleID returns the unique identifier for this rule instance
	RuleID() string
}

// RuleEvaluatorFactory creates a RuleEvaluator for a specific rule type.
// This allows for dependency injection and custom rule configurations.
type RuleFactory func(rule *pb.PolicyRule) (Rule, error)

// RuleRegistry maps rule types to their factory functions.
// This enables dynamic rule evaluation based on the protobuf rule type.
type RuleRegistry struct {
	factories map[string]RuleFactory
}

// Register adds a factory for a specific rule type.
func (r *RuleRegistry) Register(ruleType string, rule RuleFactory) {
	r.factories[ruleType] = rule
}

// CreateEvaluator creates a rule evaluator for the given rule.
func (r *RuleRegistry) CreateEvaluator(rule *pb.PolicyRule) (Rule, error) {
	ruleType := GetRuleType(rule)
	factory, exists := r.factories[ruleType]
	if !exists {
		return nil, fmt.Errorf("no rule registered for rule type: %s", ruleType)	
	}
	return factory(rule)
}
