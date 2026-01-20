package approval

import (
	"context"
	"fmt"
	"time"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator"
	"workspace-engine/pkg/workspace/releasemanager/policy/results"
	"workspace-engine/pkg/workspace/store"

	"go.opentelemetry.io/otel"
)

var tracer = otel.Tracer("workspace/releasemanager/policy/evaluator/approval")

var _ evaluator.Evaluator = &AnyApprovalEvaluator{}

type AnyApprovalEvaluator struct {
	store         *store.Store
	ruleId        string
	ruleCreatedAt string
	rule          *oapi.AnyApprovalRule
}

func NewEvaluator(store *store.Store, approvalRule *oapi.PolicyRule) evaluator.Evaluator {
	if approvalRule == nil || approvalRule.AnyApproval == nil || store == nil {
		return nil
	}
	return evaluator.WithMemoization(&AnyApprovalEvaluator{
		store:         store,
		ruleId:        approvalRule.Id,
		rule:          approvalRule.AnyApproval,
		ruleCreatedAt: approvalRule.CreatedAt,
	})
}

// ScopeFields declares that this evaluator cares about Environment and Version.
func (m *AnyApprovalEvaluator) ScopeFields() evaluator.ScopeFields {
	return evaluator.ScopeEnvironment | evaluator.ScopeVersion
}

// RuleType returns the rule type identifier for bypass matching.
func (m *AnyApprovalEvaluator) RuleType() string {
	return evaluator.RuleTypeApproval
}

func (m *AnyApprovalEvaluator) RuleId() string {
	return m.ruleId
}

func (m *AnyApprovalEvaluator) Complexity() int {
	return 1
}

// Evaluate checks if the version has enough approvals for the environment.
// The memoization wrapper ensures Environment and Version are present.
func (m *AnyApprovalEvaluator) Evaluate(
	ctx context.Context,
	scope evaluator.EvaluatorScope,
) *oapi.RuleEvaluation {
	ctx, span := tracer.Start(ctx, "AnyApprovalEvaluator.Evaluate")
	defer span.End()

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

	// If the version was created before the policy was created, it was previously "approved"
	ruleCreatedAtStr := m.ruleCreatedAt
	if ruleCreatedAtStr == "" {
		ruleCreatedAtStr = time.Time{}.Format(time.RFC3339)
	}
	ruleCreatedAt, err := time.Parse(time.RFC3339, ruleCreatedAtStr)
	if err != nil {
		return results.
			NewPendingResult("approval",
				fmt.Sprintf("Failed to parse rule created_at: %v", err),
			).
			WithDetail("min_approvals", minApprovals).
			WithDetail("approvers", approvers).
			WithDetail("version_id", version.Id).
			WithDetail("environment_id", environment.Id)
	}
	if version.CreatedAt.Before(ruleCreatedAt) {
		return results.
			NewAllowedResult("Version was created before the policy was created.").
			WithDetail("version_id", version.Id).
			WithDetail("environment_id", environment.Id).
			WithSatisfiedAt(version.CreatedAt)
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
