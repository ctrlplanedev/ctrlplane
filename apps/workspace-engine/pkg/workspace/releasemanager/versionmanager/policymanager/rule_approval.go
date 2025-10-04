package policymanager

import (
	"context"
	"fmt"

	"workspace-engine/pkg/pb"
	"workspace-engine/pkg/workspace/releasemanager/versionmanager/policymanager/results"
)

const (
	UserEvaluateRuleType = "user_approval"
	RoleEvaluateRuleType = "role_approval"
	AnyEvaluateRuleType  = "any_approval"
)

// evaluateUserApproval checks if a specific user has approved.
func (m *Manager) evaluateUserApproval(
	ctx context.Context,
	ruleID string,
	rule *pb.UserApprovalRule,
	version *pb.DeploymentVersion,
	releaseTarget *pb.ReleaseTarget,
) (*results.RuleEvaluationResult, error) {
	// TODO: Implement ApprovalStore on store
	// For now, return pending
	reason := fmt.Sprintf("Requires approval from user %s", rule.GetUserId())
	return results.NewPendingResult(ruleID, UserEvaluateRuleType, "approval", reason).
		WithDetail("user_id", rule.GetUserId()), nil
}

// evaluateRoleApproval checks if someone with a role has approved.
func (m *Manager) evaluateRoleApproval(
	ctx context.Context,
	ruleID string,
	rule *pb.RoleApprovalRule,
	version *pb.DeploymentVersion,
	releaseTarget *pb.ReleaseTarget,
) (*results.RuleEvaluationResult, error) {
	// TODO: Implement ApprovalStore on store
	// For now, return pending
	reason := fmt.Sprintf("Requires approval from role %s", rule.GetRoleId())
	return results.NewPendingResult(ruleID, RoleEvaluateRuleType, "approval", reason).
		WithDetail("role_id", rule.GetRoleId()), nil
}

// evaluateAnyApproval checks if minimum number of approvals met.
func (m *Manager) evaluateAnyApproval(
	ctx context.Context,
	ruleID string,
	rule *pb.AnyApprovalRule,
	version *pb.DeploymentVersion,
	releaseTarget *pb.ReleaseTarget,
) (*results.RuleEvaluationResult, error) {
	// TODO: Implement ApprovalStore on store
	// For now, return pending
	minApprovals := int(rule.GetMinApprovals())
	reason := fmt.Sprintf("Requires %d approval(s)", minApprovals)
	return results.NewPendingResult(ruleID, AnyEvaluateRuleType, "approval", reason).
		WithDetail("min_approvals", minApprovals).
		WithDetail("current_approvals", 0), nil
}
