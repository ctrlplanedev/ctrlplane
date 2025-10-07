package approval

import (
	"context"
	"fmt"
	"workspace-engine/pkg/pb"
	"workspace-engine/pkg/workspace/releasemanager/policymanager/results"
	"workspace-engine/pkg/workspace/store"
)

var _ results.VersionRuleEvaluator = &AnyApprovalEvaluator{}

type AnyApprovalEvaluator struct {
	store *store.Store
	rule *pb.AnyApprovalRule
}

func NewAnyApprovalEvaluator(store *store.Store, rule *pb.AnyApprovalRule) *AnyApprovalEvaluator {
	return &AnyApprovalEvaluator{
		store: store,
		rule: rule,
	}
}

func (m *AnyApprovalEvaluator) Evaluate(
	ctx context.Context,
	releaseTarget *pb.ReleaseTarget,
	version *pb.DeploymentVersion,
) (*results.RuleEvaluationResult, error) {
	if version.Id == "" {
		return results.
			NewDeniedResult("Version ID is required").
			WithDetail("version_id", version.Id).
			WithDetail("min_approvals", m.rule.GetMinApprovals()), nil
	}

	if m.rule.GetMinApprovals() <= 0 {
		return results.
			NewAllowedResult("No approvals required").
			WithDetail("min_approvals", m.rule.GetMinApprovals()), nil
	}

	approvers := m.store.UserApprovalRecords.GetApprovers(version.Id)
	minApprovals := int(m.rule.GetMinApprovals())
	if len(approvers) >= minApprovals {
		return results.
			NewAllowedResult(
				fmt.Sprintf("All approvals met (%d/%d).", len(approvers), minApprovals),
			).
			WithDetail("min_approvals", minApprovals).
			WithDetail("approvers", approvers), nil
	}

	return results.
		NewDeniedResult(
			fmt.Sprintf("Not enough approvals (%d/%d).", len(approvers), minApprovals),
		).
		WithDetail("min_approvals", minApprovals).
		WithDetail("approvers", approvers), nil
}
