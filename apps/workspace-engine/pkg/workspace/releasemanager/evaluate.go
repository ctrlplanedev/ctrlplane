package releasemanager

import (
	"context"
	"time"
	"workspace-engine/pkg/pb"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

var tracer = otel.Tracer("workspace/releasemanager")

func (m *Manager) Evaluate(ctx context.Context, releaseTarget *pb.ReleaseTarget) (*pb.ReleaseTargetDeploy, error) {
	ctx, span := tracer.Start(ctx, "Evaluate",
		trace.WithAttributes(
			attribute.String("deployment.id", releaseTarget.DeploymentId),
			attribute.String("environment.id", releaseTarget.EnvironmentId),
			attribute.String("resource.id", releaseTarget.ResourceId),
		))
	defer span.End()

	version, err := m.versionManager.Evaluate(ctx, releaseTarget)
	if err != nil {
		span.RecordError(err)
		return nil, err
	}

	variables, err := m.variableManager.Evaluate(ctx, releaseTarget)
	if err != nil {
		span.RecordError(err)
		return nil, err
	}

	span.SetAttributes(
		attribute.Int("variables.count", len(variables)),
		attribute.String("version.id", version.Id),
		attribute.String("version.tag", version.Tag),
	)

	deployVersion := &pb.ReleaseTargetDeploy{
		ReleaseTarget:     releaseTarget,
		DeploymentVersion: version,
		Variables:         variables,
		CreatedAt:         time.Now().Format(time.RFC3339),
	}

	return deployVersion, err
}
