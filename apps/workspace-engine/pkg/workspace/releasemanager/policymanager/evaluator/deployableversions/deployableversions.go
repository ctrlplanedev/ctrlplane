package deployableversions

import (
	"context"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/releasemanager/policymanager/results"
	"workspace-engine/pkg/workspace/store"
)

var _ results.VersionRuleEvaluator = &DeployableVersionStatusEvaluator{}

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
	releaseTarget *oapi.ReleaseTarget,
	version *oapi.DeploymentVersion,
) (*results.RuleEvaluationResult, error) {
	// Check if any policies apply to this release target
	// Only enforce version status check if policies exist
	policies, err := e.store.ReleaseTargets.GetPolicies(ctx, releaseTarget)
	if err != nil {
		return nil, err
	}
	
	// If no policies apply to this release target, allow any version status
	if len(policies) == 0 {
		return results.NewAllowedResult("No policies apply").
			WithDetail("version_id", version.Id).
			WithDetail("version_status", version.Status), nil
	}
	
	// If policies exist, enforce version status check
	if version.Status == oapi.DeploymentVersionStatusReady {
		return results.NewAllowedResult("Version is ready").
			WithDetail("version_id", version.Id).
			WithDetail("version_status", version.Status), nil
	}
	return results.NewDeniedResult("Version is not ready").
		WithDetail("version_id", version.Id).
		WithDetail("version_status", version.Status), nil
}
