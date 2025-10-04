package rules

import (
	"context"
	"fmt"
	"workspace-engine/pkg/pb"
	"workspace-engine/pkg/workspace/releasemanager/policymanager/evaluator"
	"workspace-engine/pkg/workspace/releasemanager/policymanager/evaluator/results"
)

var _ Rule = &UserApprovalEvaluator{}
var _ Rule = &RoleApprovalEvaluator{}
var _ Rule = &AnyApprovalEvaluator{}

// ApprovalStore defines the interface for checking approval status.
// This allows the rule evaluators to query whether approvals have been granted.
type ApprovalStore interface {
	// HasUserApproved checks if a specific user has approved this deployment version
	HasUserApproved(ctx context.Context, userID, versionID, environmentID string) (bool, error)

	// HasRoleApproved checks if any user with the specified role has approved
	HasRoleApproved(ctx context.Context, roleID, versionID, environmentID string) (bool, error)

	// GetApprovalCount returns the number of approvals for this deployment version
	GetApprovalCount(ctx context.Context, versionID, environmentID string) (int, error)
}

// UserApprovalEvaluator evaluates user-specific approval rules.
type UserApprovalEvaluator struct {
	ruleID        string
	rule          *pb.UserApprovalRule
	approvalStore ApprovalStore
}

// NewUserApprovalEvaluator creates a new user approval evaluator.
func NewUserApprovalEvaluator(ruleID string, rule *pb.UserApprovalRule, store ApprovalStore) *UserApprovalEvaluator {
	return &UserApprovalEvaluator{
		ruleID:        ruleID,
		rule:          rule,
		approvalStore: store,
	}
}

func (e *UserApprovalEvaluator) Type() string {
	return "user_approval"
}

func (e *UserApprovalEvaluator) RuleID() string {
	return e.ruleID
}

func (e *UserApprovalEvaluator) Evaluate(ctx context.Context, evalCtx *evaluator.EvaluationContext) (*results.RuleEvaluationResult, error) {
	approved, err := e.approvalStore.HasUserApproved(
		ctx,
		e.rule.GetUserId(),
		evalCtx.Version.GetId(),
		evalCtx.Environment().GetId(),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to check user approval: %w", err)
	}

	if !approved {
		reason := fmt.Sprintf("Requires approval from user %s", e.rule.GetUserId())
		return results.NewPendingResult(e.ruleID, e.Type(), "approval", reason).
			WithDetail("user_id", e.rule.GetUserId()), nil
	}

	return results.NewAllowedResult(e.ruleID, e.Type(), "User approval granted"), nil
}

// RoleApprovalEvaluator evaluates role-based approval rules.
type RoleApprovalEvaluator struct {
	ruleID        string
	rule          *pb.RoleApprovalRule
	approvalStore ApprovalStore
}

// NewRoleApprovalEvaluator creates a new role approval evaluator.
func NewRoleApprovalEvaluator(ruleID string, rule *pb.RoleApprovalRule, store ApprovalStore) *RoleApprovalEvaluator {
	return &RoleApprovalEvaluator{
		ruleID:        ruleID,
		rule:          rule,
		approvalStore: store,
	}
}

func (e *RoleApprovalEvaluator) Type() string {
	return "role_approval"
}

func (e *RoleApprovalEvaluator) RuleID() string {
	return e.ruleID
}

func (e *RoleApprovalEvaluator) Evaluate(ctx context.Context, evalCtx *evaluator.EvaluationContext) (*results.RuleEvaluationResult, error) {
	approved, err := e.approvalStore.HasRoleApproved(
		ctx,
		e.rule.GetRoleId(),
		evalCtx.Version.GetId(),
		evalCtx.Environment().GetId(),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to check role approval: %w", err)
	}

	if !approved {
		reason := fmt.Sprintf("Requires approval from role %s", e.rule.GetRoleId())
		return results.
			NewPendingResult(e.ruleID, e.Type(), "approval", reason).
			WithDetail("role_id", e.rule.GetRoleId()), nil
	}

	return results.NewAllowedResult(e.ruleID, e.Type(), "Role approval granted"), nil
}

// AnyApprovalEvaluator evaluates rules requiring a minimum number of approvals.
type AnyApprovalEvaluator struct {
	ruleID        string
	rule          *pb.AnyApprovalRule
	approvalStore ApprovalStore
}

// NewAnyApprovalEvaluator creates a new any approval evaluator.
func NewAnyApprovalEvaluator(ruleID string, rule *pb.AnyApprovalRule, store ApprovalStore) *AnyApprovalEvaluator {
	return &AnyApprovalEvaluator{
		ruleID:        ruleID,
		rule:          rule,
		approvalStore: store,
	}
}

func (e *AnyApprovalEvaluator) Type() string {
	return "any_approval"
}

func (e *AnyApprovalEvaluator) RuleID() string {
	return e.ruleID
}

func (e *AnyApprovalEvaluator) Evaluate(ctx context.Context, evalCtx *evaluator.EvaluationContext) (*results.RuleEvaluationResult, error) {
	count, err := e.approvalStore.GetApprovalCount(
		ctx,
		evalCtx.Version.GetId(),
		evalCtx.Environment().GetId(),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to get approval count: %w", err)
	}

	required := int(e.rule.GetMinApprovals())
	if count < required {
		reason := fmt.Sprintf("Requires %d approvals (current: %d)", required, count)
		return results.NewPendingResult(e.ruleID, e.Type(), "approval", reason).
			WithDetail("required", required).
			WithDetail("current", count), nil
	}

	return results.NewAllowedResult(e.ruleID, e.Type(), fmt.Sprintf("Approval threshold met (%d/%d)", count, required)), nil
}

