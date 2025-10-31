package approval

import (
	"context"
	"fmt"
	"time"
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
			WithDetail("min_approvals", m.rule.MinApprovals).
			WithSatisfiedAt(version.CreatedAt)
	}


	// If this version has already been deployed to this environment, it was previously "approved"
	// so we can allow it without requiring new approvals. Will need to add support for bypass jobs though
	for _, release := range m.store.Releases.Items() {
		if release.Version.Id == version.Id && release.ReleaseTarget.EnvironmentId == environment.Id {
			return results.
				NewAllowedResult("Version already deployed to this environment.").
				WithDetail("release_id", release.ID()).
				WithDetail("version_id", version.Id).
				WithDetail("environment_id", environment.Id).
				WithSatisfiedAt(version.CreatedAt) // Use version creation time as it was already approved before
		}
	}

	approvalRecords := m.store.UserApprovalRecords.GetApprovalRecords(version.Id, environment.Id)
	minApprovals := int(m.rule.MinApprovals)
	
	approvers := make([]string, len(approvalRecords))
	for i, record := range approvalRecords {
		approvers[i] = record.UserId
	}


	if len(approvalRecords) >= minApprovals {
		// Get the timestamp of the approval that satisfied the requirement (the Nth approval)
		// Records are sorted oldest first, so the Nth approval is at index minApprovals-1
		satisfyingApproval := approvalRecords[minApprovals-1]
		approvalTime, err := time.Parse(time.RFC3339, satisfyingApproval.CreatedAt)
		if err != nil {
			// If parsing fails, continue without the timestamp
			return results.
				NewAllowedResult(
					fmt.Sprintf("All approvals met (%d/%d).", len(approvalRecords), minApprovals),
				).
				WithDetail("min_approvals", minApprovals).
				WithDetail("approvers", approvers).
				WithDetail("version_id", version.Id).
				WithDetail("environment_id", environment.Id)
		}

		return results.
			NewAllowedResult(
				fmt.Sprintf("All approvals met (%d/%d).", len(approvalRecords), minApprovals),
			).
			WithDetail("min_approvals", minApprovals).
			WithDetail("approvers", approvers).
			WithDetail("version_id", version.Id).
			WithDetail("environment_id", environment.Id).
			WithSatisfiedAt(approvalTime)
	}

	return results.
		NewPendingResult("approval",
			fmt.Sprintf("Not enough approvals (%d/%d).", len(approvalRecords), minApprovals),
		).
		WithDetail("min_approvals", minApprovals).
		WithDetail("approvers", approvers).
		WithDetail("version_id", version.Id).
		WithDetail("environment_id", environment.Id)
}
