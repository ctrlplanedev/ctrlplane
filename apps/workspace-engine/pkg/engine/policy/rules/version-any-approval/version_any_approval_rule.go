package versionanyapproval

import (
	"context"
	"time"
	rt "workspace-engine/pkg/engine/policy/releasetargets"
	"workspace-engine/pkg/engine/policy/rules"
	"workspace-engine/pkg/model/deployment"
)

var _ rules.Rule = (*VersionAnyApprovalRule)(nil)

func NewVersionAnyApprovalRule(
	versionAnyApprovalRecordRepository *VersionAnyApprovalRecordRepository,
	requiredApprovalsCount int,
	policyID string,
	ruleID string,
) *VersionAnyApprovalRule {
	return &VersionAnyApprovalRule{
		BaseRule: rules.BaseRule{
			ID:       ruleID,
			PolicyID: policyID,
		},
		versionAnyApprovalRecordRepository: versionAnyApprovalRecordRepository,
		RequiredApprovalsCount:             requiredApprovalsCount,
	}
}

type VersionAnyApprovalRule struct {
	rules.BaseRule
	versionAnyApprovalRecordRepository *VersionAnyApprovalRecordRepository
	RequiredApprovalsCount             int
}

func (r *VersionAnyApprovalRule) Evaluate(ctx context.Context, target rt.ReleaseTarget, version deployment.DeploymentVersion) (*rules.RuleEvaluationResult, error) {
	environmentID := target.Environment.GetID()
	versionID := version.GetID()

	result := &rules.RuleEvaluationResult{
		RuleID:      r.GetID(),
		EvaluatedAt: time.Now().UTC(),
	}

	records := r.versionAnyApprovalRecordRepository.GetAllForVersionAndEnvironment(
		ctx,
		versionID,
		environmentID,
	)

	approvedCount := 0
	for _, record := range records {
		if record.Status == VersionAnyApprovalRecordStatusApproved {
			approvedCount++
		}
	}

	if approvedCount >= r.RequiredApprovalsCount {
		result.Decision = rules.PolicyDecisionAllow
		result.Message = "Minimum number of approvals reached"
		return result, nil
	}

	result.Decision = rules.PolicyDecisionDeny
	result.Message = "Minimum number of approvals not reached"
	return result, nil
}
