package summaryeval

import (
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator/approval"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator/deploymentwindow"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator/environmentprogression"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator/versioncooldown"
)

func EnvironmentRuleEvaluators(rule *oapi.PolicyRule) []evaluator.Evaluator {
	return evaluator.CollectEvaluators(
		deploymentwindow.NewSummaryEvaluator(rule),
	)
}

func EnvironmentVersionRuleEvaluators(getter Getter, rule *oapi.PolicyRule) []evaluator.Evaluator {
	return evaluator.CollectEvaluators(
		approval.NewEvaluator(getter, rule),
		environmentprogression.NewEvaluator(getter, rule),
	)
}

func DeploymentVersionRuleEvaluators(getter Getter, rule *oapi.PolicyRule) []evaluator.Evaluator {
	return evaluator.CollectEvaluators(
		versioncooldown.NewSummaryEvaluator(getter, rule),
	)
}
