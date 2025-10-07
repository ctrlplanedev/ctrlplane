package approval

import (
	"context"
	"fmt"
	"workspace-engine/pkg/pb"
	"workspace-engine/pkg/workspace/releasemanager/policymanager/results"
	"workspace-engine/pkg/workspace/store"
)

type AnyApprovalEvaluator struct {
	store *store.Store
}

func NewAnyApprovalEvaluator(store *store.Store) *AnyApprovalEvaluator {
	return &AnyApprovalEvaluator{
		store: store,
	}
}

func (m *AnyApprovalEvaluator) Evaluate(
	ctx context.Context,
	rule *pb.AnyApprovalRule,
	version *pb.DeploymentVersion,
	releaseTarget *pb.ReleaseTarget,
) (*results.RuleEvaluationResult, error) {
	if version.Id == "" {
		return results.
			NewDeniedResult("Version ID is required").
			WithDetail("version_id", version.Id).
			WithDetail("min_approvals", rule.GetMinApprovals()), nil
	}

	if rule.GetMinApprovals() <= 0 {
		return results.
			NewAllowedResult("No approvals required").
			WithDetail("min_approvals", rule.GetMinApprovals()), nil
	}

	approvers := m.store.UserApprovalRecords.GetApprovers(version.Id)
	minApprovals := int(rule.GetMinApprovals())
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
