package deployableversions

import (
	"context"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator"
	"workspace-engine/pkg/workspace/releasemanager/policy/results"
	"workspace-engine/pkg/workspace/store"
)

var _ evaluator.Evaluator = &DeployableVersionStatusEvaluator{}

type DeployableVersionStatusEvaluator struct {
	store *store.Store
}

func NewEvaluator(store *store.Store) evaluator.Evaluator {
	if store == nil {
		return nil
	}
	return evaluator.WithMemoization(&DeployableVersionStatusEvaluator{
		store: store,
	})
}

// ScopeFields declares that this evaluator only cares about Version.
func (e *DeployableVersionStatusEvaluator) ScopeFields() evaluator.ScopeFields {
	return evaluator.ScopeVersion
}

// Evaluate checks if a version is in a deployable status.
// The memoization wrapper ensures Version is present.
func (e *DeployableVersionStatusEvaluator) Evaluate(
	ctx context.Context,
	scope evaluator.EvaluatorScope,
) *oapi.RuleEvaluation {
	version := scope.Version

	if version.Status == oapi.DeploymentVersionStatusReady {
		return results.NewAllowedResult("Version is ready").
			WithDetail("version_id", version.Id).
			WithDetail("version_status", version.Status)
	}

	if version.Status == oapi.DeploymentVersionStatusPaused {
		return results.NewPendingResult(results.ActionTypeWait, "Version is paused").
			WithDetail("version_id", version.Id).
			WithDetail("version_status", version.Status)
	}

	return results.NewDeniedResult("Version is not ready").
		WithDetail("version_id", version.Id).
		WithDetail("version_status", version.Status)
}
