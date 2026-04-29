package jobdispatch

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/reconcile"
	"workspace-engine/pkg/reconcile/events"
)

// dispatchDependencyDownstreamTargets enqueues desired-release evaluations
// for release targets that belong to deployments declaring a dependency on
// the deployment whose job just changed status. The fan-out is scoped to
// the same resource as the upstream job, since deployment_version_dependency
// gates are evaluated per (deployment, resource).
func dispatchDependencyDownstreamTargets(
	ctx context.Context,
	queue reconcile.Queue,
	jobID uuid.UUID,
) error {
	ctx, span := tracer.Start(ctx, "DispatchDependencyDownstreamTargets",
		trace.WithAttributes(attribute.String("job.id", jobID.String())),
	)
	defer span.End()

	queries := db.GetQueries(ctx)

	release, err := queries.GetReleaseByJobID(ctx, jobID)
	if err != nil {
		return fmt.Errorf("get release by job id: %w", err)
	}

	wsID, err := queries.GetWorkspaceIDByJobID(ctx, jobID)
	if err != nil {
		return fmt.Errorf("get workspace id: %w", err)
	}

	span.SetAttributes(
		attribute.String("workspace.id", wsID.String()),
		attribute.String("upstream.deployment.id", release.DeploymentID.String()),
		attribute.String("resource.id", release.ResourceID.String()),
	)

	downstreamDeps, err := queries.GetDeploymentsDependingOn(ctx, release.DeploymentID)
	if err != nil {
		return fmt.Errorf("get deployments depending on: %w", err)
	}

	span.SetAttributes(attribute.Int("downstream_deployments.count", len(downstreamDeps)))

	if len(downstreamDeps) == 0 {
		return nil
	}

	wsIDStr := wsID.String()
	var params []events.DesiredReleaseEvalParams

	for _, downstreamDepID := range downstreamDeps {
		rts, err := queries.GetReleaseTargetsForDeploymentAndResource(
			ctx,
			db.GetReleaseTargetsForDeploymentAndResourceParams{
				DeploymentID: downstreamDepID,
				ResourceID:   release.ResourceID,
			},
		)
		if err != nil {
			return fmt.Errorf(
				"get release targets for downstream deployment %s: %w",
				downstreamDepID,
				err,
			)
		}
		for _, rt := range rts {
			params = append(params, events.DesiredReleaseEvalParams{
				WorkspaceID:   wsIDStr,
				ResourceID:    rt.ResourceID.String(),
				EnvironmentID: rt.EnvironmentID.String(),
				DeploymentID:  rt.DeploymentID.String(),
			})
		}
	}

	span.SetAttributes(attribute.Int("release_targets.count", len(params)))

	if len(params) == 0 {
		return nil
	}

	if err := events.EnqueueManyDesiredRelease(queue, ctx, params); err != nil {
		return fmt.Errorf("enqueue desired releases: %w", err)
	}

	span.AddEvent("desired releases enqueued", trace.WithAttributes(
		attribute.Int("enqueued.count", len(params)),
	))

	return nil
}
