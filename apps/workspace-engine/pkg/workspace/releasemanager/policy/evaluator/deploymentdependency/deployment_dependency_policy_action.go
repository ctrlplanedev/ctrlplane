package deploymentdependency

import (
	"context"
	"fmt"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/releasemanager/action"
	"workspace-engine/pkg/workspace/store"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
)

var actionTracer = otel.Tracer("DeploymentDependencyAction")

type ReconcileFn func(ctx context.Context, targets []*oapi.ReleaseTarget) error

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
	ctx, span := actionTracer.Start(ctx, "DeploymentDependencyAction.Execute")
	defer span.End()

	span.SetAttributes(
		attribute.String("trigger", string(trigger)),
		attribute.String("release.id", context.Release.ID()),
		attribute.String("job.id", context.Job.Id),
		attribute.String("job.status", string(context.Job.Status)),
	)
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

	if err := d.reconcileFn(ctx, targetsToReconcile); err != nil {
		return fmt.Errorf("failed to reconcile targets: %w", err)
	}

	return nil
}
