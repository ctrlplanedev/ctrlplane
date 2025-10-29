package deployableversions

import (
	"context"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator"
	"workspace-engine/pkg/workspace/releasemanager/policy/results"
	"workspace-engine/pkg/workspace/store"
)

var _ evaluator.VersionScopedEvaluator = &DeployableVersionStatusEvaluator{}

type DeployableVersionStatusEvaluator struct {
	store *store.Store
}

func NewDeployableVersionStatusEvaluator(store *store.Store) *DeployableVersionStatusEvaluator {
	return &DeployableVersionStatusEvaluator{
		store: store,
	}
}

func (e *DeployableVersionStatusEvaluator) Evaluate(
	ctx context.Context,
	version *oapi.DeploymentVersion,
) (*oapi.RuleEvaluation, error) {
	if version.Status == oapi.DeploymentVersionStatusReady {
		return results.NewAllowedResult("Version is ready").
			WithDetail("version_id", version.Id).
			WithDetail("version_status", version.Status), nil
	}
	return results.NewDeniedResult("Version is not ready").
		WithDetail("version_id", version.Id).
		WithDetail("version_status", version.Status), nil
}
