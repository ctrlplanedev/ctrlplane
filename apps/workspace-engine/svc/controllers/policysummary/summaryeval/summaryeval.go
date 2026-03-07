package summaryeval

import (
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator/approval"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator/deploymentwindow"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator/environmentprogression"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator/versioncooldown"
)

// RuleEvaluators returns all summary evaluators for a given policy rule.
func RuleEvaluators(getter Getter, wsId string, rule *oapi.PolicyRule) []evaluator.Evaluator {
	return evaluator.CollectEvaluators(
		deploymentwindow.NewSummaryEvaluator(rule),
		approval.NewEvaluator(getter, rule),
		environmentprogression.NewEvaluator(getter, rule),
		versioncooldown.NewSummaryEvaluator(getter, wsId, rule),
		// TODO: add gradualrollout.NewSummaryEvaluator(getter, rule)
		// once the getter-based constructor is added
	)
}
