package releasetargets

import (
	"context"
	"fmt"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/oapi"

	"github.com/google/uuid"
	"go.opentelemetry.io/otel"
)

var tracer = otel.Tracer("workspace-engine/pkg/store/releasetargets")

type GetReleaseTargetsForDeploymentAndEnvironment interface {
	GetReleaseTargetsForDeploymentAndEnvironment(ctx context.Context, deploymentID, environmentID string) ([]oapi.ReleaseTarget, error)
}

var _ GetReleaseTargetsForDeploymentAndEnvironment = (*PostgresGetReleaseTargetsForDeploymentAndEnvironment)(nil)

type PostgresGetReleaseTargetsForDeploymentAndEnvironment struct{}

func (p *PostgresGetReleaseTargetsForDeploymentAndEnvironment) GetReleaseTargetsForDeploymentAndEnvironment(ctx context.Context, deploymentID, environmentID string) ([]oapi.ReleaseTarget, error) {
	ctx, span := tracer.Start(ctx, "Store.GetReleaseTargetsForDeploymentAndEnvironment")
	defer span.End()

	depID, err := uuid.Parse(deploymentID)
	if err != nil {
		return nil, fmt.Errorf("parse deployment id: %w", err)
	}

	envID, err := uuid.Parse(environmentID)
	if err != nil {
		return nil, fmt.Errorf("parse environment id: %w", err)
	}

	rows, err := db.GetQueries(ctx).GetReleaseTargetsForDeploymentAndEnvironment(ctx, db.GetReleaseTargetsForDeploymentAndEnvironmentParams{
		DeploymentID:  depID,
		EnvironmentID: envID,
	})
	if err != nil {
		return nil, fmt.Errorf("get release targets for deployment and environment: %w", err)
	}

	targets := make([]oapi.ReleaseTarget, 0, len(rows))
	for _, row := range rows {
		targets = append(targets, oapi.ReleaseTarget{
			DeploymentId:  row.DeploymentID.String(),
			EnvironmentId: row.EnvironmentID.String(),
			ResourceId:    row.ResourceID.String(),
		})
	}

	return targets, nil
}
