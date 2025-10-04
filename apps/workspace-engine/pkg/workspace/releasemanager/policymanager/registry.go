package policymanager

import (
	"workspace-engine/pkg/pb"
	"workspace-engine/pkg/workspace/releasemanager/policymanager/rules"
)


type RuleDependencies struct {
	ApprovalStore rules.ApprovalStore
}

// NewDefaultRegistry creates a registry with all standard rule types registered.
func NewDefaultRegistry(deps *RuleDependencies) *rules.RuleRegistry {
	registry := rules.NewRuleRegistry()

	registry.Register("deny_window", func(rule *pb.PolicyRule) (rules.Rule, error) {
		return rules.NewDenyWindowEvaluator(rule.GetId(), rule.GetDenyWindow())
	})

	// Register user approval rule
	registry.Register("user_approval", func(rule *pb.PolicyRule) (rules.Rule, error) {
		return rules.NewUserApprovalEvaluator(rule.GetId(), rule.GetUserApproval(), deps.ApprovalStore), nil
	})

	// Register role approval rule
	registry.Register("role_approval", func(rule *pb.PolicyRule) (rules.Rule, error) {
		return rules.NewRoleApprovalEvaluator(rule.GetId(), rule.GetRoleApproval(), deps.ApprovalStore), nil
	})

	// Register any approval rule
	registry.Register("any_approval", func(rule *pb.PolicyRule) (rules.Rule, error) {
		return rules.NewAnyApprovalEvaluator(rule.GetId(), rule.GetAnyApproval(), deps.ApprovalStore), nil
	})

	return registry
}
