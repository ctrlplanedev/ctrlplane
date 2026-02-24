package policy

import (
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator/approval"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator/deployableversions"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator/deploymentdependency"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator/deploymentwindow"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator/environmentprogression"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator/gradualrollout"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator/versioncooldown"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator/versionselector"
	"workspace-engine/pkg/workspace/store"
)

func EvaluatorsForPolicy(store *store.Store, rule *oapi.PolicyRule) []evaluator.Evaluator {
	return evaluator.CollectEvaluators(
		deployableversions.NewEvaluator(store),
		approval.NewEvaluatorFromStore(store, rule),
		environmentprogression.NewEvaluatorFromStore(store, rule),
		gradualrollout.NewEvaluatorFromStore(store, rule),
		versionselector.NewEvaluator(rule),
		deploymentdependency.NewEvaluator(store, rule),
		deploymentwindow.NewEvaluatorFromStore(store, rule),
		versioncooldown.NewEvaluatorFromStore(store, rule),
	)
}

func EvaluatorsForSummary(store *store.Store, rule *oapi.PolicyRule) []evaluator.Evaluator {
	return evaluator.CollectEvaluators(
		deploymentwindow.NewSummaryEvaluatorFromStore(store, rule),
		approval.NewEvaluatorFromStore(store, rule),
		environmentprogression.NewEvaluatorFromStore(store, rule),
		gradualrollout.NewSummaryEvaluatorFromStore(store, rule),
		versioncooldown.NewSummaryEvaluatorFromStore(store, rule),
	)
}