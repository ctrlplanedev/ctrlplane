package environmentversionrollout

import (
	"context"
	"time"
	rt "workspace-engine/pkg/engine/policy/releasetargets"
	"workspace-engine/pkg/engine/policy/rules"
	versionanyapproval "workspace-engine/pkg/engine/policy/rules/version-any-approval"
	"workspace-engine/pkg/engine/workspace"
	"workspace-engine/pkg/model/deployment"
)

func isAllApprovalsPassed(
	ctx context.Context,
	wsPolicyManager *workspace.PolicyManager,
	ruleRepository *rules.RuleRepository,
	target rt.ReleaseTarget,
	version deployment.DeploymentVersion,
) (bool, error) {
	policies, err := wsPolicyManager.GetReleaseTargetPolicies(ctx, &target)
	if err != nil {
		return false, err
	}

	for _, policy := range policies {
		pRules := ruleRepository.GetAllForPolicy(ctx, policy.GetID())
		for _, rulePtr := range pRules {
			if rulePtr == nil {
				continue
			}
			rule := *rulePtr
			if rule.GetType() != rules.RuleTypeVersionAnyApproval {
				continue
			}

			result, err := rule.Evaluate(ctx, target, version)
			if err != nil {
				return false, err
			}

			if !result.Passed() {
				return false, nil
			}
		}
	}

	return true, nil
}

func getRolloutStartTimeFunction(
	wsPolicyManager *workspace.PolicyManager,
	ruleRepository *rules.RuleRepository,
	approvalRecordRepository *versionanyapproval.VersionAnyApprovalRecordRepository,
) func(ctx context.Context, target rt.ReleaseTarget, version deployment.DeploymentVersion) (*time.Time, error) {
	return func(ctx context.Context, target rt.ReleaseTarget, version deployment.DeploymentVersion) (*time.Time, error) {
		allApprovalsPassed, err := isAllApprovalsPassed(ctx, wsPolicyManager, ruleRepository, target, version)
		if err != nil {
			return nil, err
		}

		if !allApprovalsPassed {
			return nil, nil
		}

		records := approvalRecordRepository.GetAllForVersionAndEnvironment(ctx, version.GetID(), target.Environment.GetID())

		for _, recordPtr := range records {
			if recordPtr == nil {
				continue
			}

			record := *recordPtr
			if record.GetApprovedAt() != nil {
				return record.GetApprovedAt(), nil
			}
		}

		createdAt := version.GetCreatedAt()
		return &createdAt, nil
	}
}
