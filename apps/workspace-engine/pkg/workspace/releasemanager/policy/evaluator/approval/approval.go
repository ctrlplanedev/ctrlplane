package approval

import (
	"context"
	"fmt"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator"
	"workspace-engine/pkg/workspace/releasemanager/policy/results"
	"workspace-engine/pkg/workspace/store"
)

var _ evaluator.Evaluator = &AnyApprovalEvaluator{}

type AnyApprovalEvaluator struct {
	store *store.Store
	rule  *oapi.AnyApprovalRule
}

func NewAnyApprovalEvaluator(store *store.Store, rule *oapi.PolicyRule) evaluator.Evaluator {
	if rule.AnyApproval == nil {
		return nil
	}
	return evaluator.WithMemoization(&AnyApprovalEvaluator{
		store: store,
		rule:  rule.AnyApproval,
	})
}

// ScopeFields declares that this evaluator cares about Environment and Version.
func (m *AnyApprovalEvaluator) ScopeFields() evaluator.ScopeFields {
	return evaluator.ScopeEnvironment | evaluator.ScopeVersion
}

// Evaluate checks if the version has enough approvals for the environment.
// The memoization wrapper ensures Environment and Version are present.
func (m *AnyApprovalEvaluator) Evaluate(
	ctx context.Context,
	scope evaluator.EvaluatorScope,
) *oapi.RuleEvaluation {
	environment := scope.Environment
	version := scope.Version

	if m.rule.MinApprovals <= 0 {
		return results.
			NewAllowedResult("No approvals required").
			WithDetail("version_id", version.Id).
			WithDetail("environment_id", environment.Id).
			WithDetail("min_approvals", m.rule.MinApprovals)
	}

	approvers := m.store.UserApprovalRecords.GetApprovers(version.Id, environment.Id)
	minApprovals := int(m.rule.MinApprovals)
	if len(approvers) >= minApprovals {
		return results.
			NewAllowedResult(
				fmt.Sprintf("All approvals met (%d/%d).", len(approvers), minApprovals),
			).
			WithDetail("min_approvals", minApprovals).
			WithDetail("approvers", approvers).
			WithDetail("version_id", version.Id).
			WithDetail("environment_id", environment.Id)
	}

	return results.
		NewPendingResult("approval",
			fmt.Sprintf("Not enough approvals (%d/%d).", len(approvers), minApprovals),
		).
		WithDetail("min_approvals", minApprovals).
		WithDetail("approvers", approvers).
		WithDetail("version_id", version.Id).
		WithDetail("environment_id", environment.Id)
}
