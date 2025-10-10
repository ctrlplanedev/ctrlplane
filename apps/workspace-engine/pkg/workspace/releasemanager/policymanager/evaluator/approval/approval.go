package approval

import (
	"context"
	"fmt"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/releasemanager/policymanager/results"
	"workspace-engine/pkg/workspace/store"
)

var _ results.VersionRuleEvaluator = &AnyApprovalEvaluator{}

type AnyApprovalEvaluator struct {
	store *store.Store
	rule  *oapi.AnyApprovalRule
}

func NewAnyApprovalEvaluator(store *store.Store, rule *oapi.AnyApprovalRule) *AnyApprovalEvaluator {
	return &AnyApprovalEvaluator{
		store: store,
		rule:  rule,
	}
}

func (m *AnyApprovalEvaluator) Evaluate(
	ctx context.Context,
	releaseTarget *oapi.ReleaseTarget,
	version *oapi.DeploymentVersion,
) (*results.RuleEvaluationResult, error) {
	if version.Id == "" {
		return results.
			NewDeniedResult("Version ID is required").
			WithDetail("version_id", version.Id).
			WithDetail("min_approvals", m.rule.MinApprovals), nil
	}

	if m.rule.MinApprovals <= 0 {
		return results.
			NewAllowedResult("No approvals required").
			WithDetail("min_approvals", m.rule.MinApprovals), nil
	}

	approvers := m.store.UserApprovalRecords.GetApprovers(version.Id)
	minApprovals := int(m.rule.MinApprovals)
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
