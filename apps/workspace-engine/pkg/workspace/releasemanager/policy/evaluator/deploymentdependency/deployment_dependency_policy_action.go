package deploymentdependency

import (
	"context"
	"fmt"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/releasemanager/action"
	"workspace-engine/pkg/workspace/store"
)

type ReconcileFn func(ctx context.Context, target *oapi.ReleaseTarget) error

type DeploymentDependencyAction struct {
	store       *store.Store
	reconcileFn ReconcileFn
}

func NewDeploymentDependencyAction(store *store.Store, reconcileFn ReconcileFn) *DeploymentDependencyAction {
	return &DeploymentDependencyAction{
		store:       store,
		reconcileFn: reconcileFn,
	}
}

func (d *DeploymentDependencyAction) Name() string {
	return "deploymentdependency"
}

func (d *DeploymentDependencyAction) Execute(ctx context.Context, trigger action.ActionTrigger, context action.ActionContext) error {
	if trigger != action.TriggerJobSuccess {
		return nil
	}

	resourceId := context.Release.ReleaseTarget.ResourceId

	resourceTargets := d.store.ReleaseTargets.GetForResource(ctx, resourceId)

	targetsToReconcile := make([]*oapi.ReleaseTarget, 0)

	for _, target := range resourceTargets {
		if target.Key() == context.Release.ReleaseTarget.Key() {
			continue
		}

		policies, err := d.store.ReleaseTargets.GetPolicies(ctx, target)
		if err != nil {
			return fmt.Errorf("failed to get policies for release target: %s", target.Key())
		}

		var hasDeploymentDependencyRule bool
		for _, policy := range policies {
			for _, rule := range policy.Rules {
				if rule.DeploymentDependency != nil {
					targetsToReconcile = append(targetsToReconcile, target)
					hasDeploymentDependencyRule = true
					break
				}
			}

			if hasDeploymentDependencyRule {
				break
			}
		}
	}

	if len(targetsToReconcile) == 0 {
		return nil
	}

	for _, target := range targetsToReconcile {
		if err := d.reconcileFn(ctx, target); err != nil {
			return fmt.Errorf("failed to reconcile target: %s", target.Key())
		}
	}

	return nil
}
