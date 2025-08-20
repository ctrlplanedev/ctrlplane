package environmentversionrollout

import (
	"errors"
	"workspace-engine/pkg/engine/policy/releasetargets"
	"workspace-engine/pkg/engine/policy/rules"
	versionanyapproval "workspace-engine/pkg/engine/policy/rules/version-any-approval"
	"workspace-engine/pkg/engine/workspace"
	modelrules "workspace-engine/pkg/model/policy/rules"
)

type EnvironmentVersionRolloutRuleBuilder struct {
	rule                     modelrules.EnvironmentVersionRolloutRule
	releaseTargetRepository  *releasetargets.ReleaseTargetRepository
	wsPolicyManager          *workspace.PolicyManager
	ruleRepository           *rules.RuleRepository
	approvalRecordRepository *versionanyapproval.VersionAnyApprovalRecordRepository
}

func (b *EnvironmentVersionRolloutRuleBuilder) WithReleaseTargetRepo(releaseTargetRepository *releasetargets.ReleaseTargetRepository) *EnvironmentVersionRolloutRuleBuilder {
	b.releaseTargetRepository = releaseTargetRepository
	return b
}

func (b *EnvironmentVersionRolloutRuleBuilder) WithPolicyManager(wsPolicyManager *workspace.PolicyManager) *EnvironmentVersionRolloutRuleBuilder {
	b.wsPolicyManager = wsPolicyManager
	return b
}

func (b *EnvironmentVersionRolloutRuleBuilder) WithRuleRepository(ruleRepository *rules.RuleRepository) *EnvironmentVersionRolloutRuleBuilder {
	b.ruleRepository = ruleRepository
	return b
}

func (b *EnvironmentVersionRolloutRuleBuilder) WithApprovalRecordRepository(approvalRecordRepository *versionanyapproval.VersionAnyApprovalRecordRepository) *EnvironmentVersionRolloutRuleBuilder {
	b.approvalRecordRepository = approvalRecordRepository
	return b
}

func (b *EnvironmentVersionRolloutRuleBuilder) WithRule(rule modelrules.EnvironmentVersionRolloutRule) *EnvironmentVersionRolloutRuleBuilder {
	b.rule = rule
	return b
}

func (b *EnvironmentVersionRolloutRuleBuilder) validate() error {
	if b.rule.ID == "" {
		return errors.New("rule ID is required")
	}

	if b.ruleRepository == nil {
		return errors.New("rule repository is required")
	}

	if b.wsPolicyManager == nil {
		return errors.New("workspace policy manager is required")
	}

	if b.approvalRecordRepository == nil {
		return errors.New("approval record repository is required")
	}

	if b.releaseTargetRepository == nil {
		return errors.New("release target repository is required")
	}

	if _, ok := RolloutTypeToOffsetFunctionGetter[b.rule.Type]; !ok {
		return errors.New("invalid rollout type")
	}

	return nil
}

func (b *EnvironmentVersionRolloutRuleBuilder) Build() (*EnvironmentVersionRolloutRule, error) {
	if err := b.validate(); err != nil {
		return nil, err
	}

	rolloutStartTimeFunction := getRolloutStartTimeFunction(b.wsPolicyManager, b.ruleRepository, b.approvalRecordRepository)
	offsetFunctionGetter := RolloutTypeToOffsetFunctionGetter[b.rule.Type]
	releaseTargetPositionFunction := getHashedPositionFunction(b.releaseTargetRepository)

	return &EnvironmentVersionRolloutRule{
		BaseRule: rules.BaseRule{
			ID: b.rule.ID,
		},
		EnvironmentVersionRolloutRule: b.rule,
		rolloutStartTimeFunction:      rolloutStartTimeFunction,
		releaseTargetPositionFunction: releaseTargetPositionFunction,
		offsetFunctionGetter:          offsetFunctionGetter,
		releaseTargetsRepo:            b.releaseTargetRepository,
	}, nil
}
