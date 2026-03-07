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
		deployableversions.NewEvaluatorFromStore(store),
		approval.NewEvaluatorFromStore(store, rule),
		environmentprogression.NewEvaluatorFromStore(store, rule),
		gradualrollout.NewEvaluatorFromStore(store, rule),
		versionselector.NewEvaluator(rule),
		deploymentdependency.NewEvaluatorFromStore(store, rule),
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

// EvaluatorsForEnvironmentSummary returns evaluators scoped to an environment
// (no version/resource/deployment needed). Used by the policy-summary controller
// for the "environment" scope channel.
func EvaluatorsForEnvironmentSummary(store *store.Store, rule *oapi.PolicyRule) []evaluator.Evaluator {
	return evaluator.CollectEvaluators(
		deploymentwindow.NewSummaryEvaluatorFromStore(store, rule),
	)
}

// EvaluatorsForEnvironmentVersionSummary returns evaluators scoped to an
// (environment, version) pair. Used by the policy-summary controller for the
// "environment-version" scope channel.
func EvaluatorsForEnvironmentVersionSummary(store *store.Store, rule *oapi.PolicyRule) []evaluator.Evaluator {
	return evaluator.CollectEvaluators(
		approval.NewEvaluatorFromStore(store, rule),
		environmentprogression.NewEvaluatorFromStore(store, rule),
		gradualrollout.NewSummaryEvaluatorFromStore(store, rule),
	)
}

// EvaluatorsForDeploymentVersionSummary returns evaluators scoped to a
// (deployment, version) pair. Used by the policy-summary controller for the
// "deployment-version" scope channel.
func EvaluatorsForDeploymentVersionSummary(store *store.Store, rule *oapi.PolicyRule) []evaluator.Evaluator {
	return evaluator.CollectEvaluators(
		versioncooldown.NewSummaryEvaluatorFromStore(store, rule),
	)
}
