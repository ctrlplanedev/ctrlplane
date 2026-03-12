package policy

import (
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator"
	"workspace-engine/pkg/workspace/store"
)

func EvaluatorsForPolicy(store *store.Store, rule *oapi.PolicyRule) []evaluator.Evaluator {
	return evaluator.CollectEvaluators()
}

func EvaluatorsForSummary(store *store.Store, rule *oapi.PolicyRule) []evaluator.Evaluator {
	return evaluator.CollectEvaluators()
}
