package approval

import (
	"context"
	"workspace-engine/pkg/pb"
	"workspace-engine/pkg/workspace/releasemanager/versionmanager/policymanager/results"
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
	approvers := m.store.UserApprovalRecords.GetApprovers(version.Id)
	minApprovals := int(rule.GetMinApprovals())
	if len(approvers) >= minApprovals {
		return results.
			NewAllowedResult("All approvals met").
			WithDetail("min_approvals", minApprovals).
			WithDetail("approvers", approvers), nil
	}
	return results.
		NewDeniedResult("Not enough approvals").
		WithDetail("min_approvals", minApprovals).
		WithDetail("approvers", approvers), nil
}
