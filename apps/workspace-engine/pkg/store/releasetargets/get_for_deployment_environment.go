package releasetargets

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	gocache "github.com/patrickmn/go-cache"
	"go.opentelemetry.io/otel"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/oapi"
)

var tracer = otel.Tracer("workspace-engine/pkg/store/releasetargets")

type GetReleaseTargetsForDeploymentAndEnvironment interface {
	GetReleaseTargetsForDeploymentAndEnvironment(
		ctx context.Context,
		deploymentID, environmentID string,
	) ([]oapi.ReleaseTarget, error)
}

var _ GetReleaseTargetsForDeploymentAndEnvironment = (*PostgresGetReleaseTargetsForDeploymentAndEnvironment)(
	nil,
)

type PostgresGetReleaseTargetsForDeploymentAndEnvironment struct {
	cache *gocache.Cache
}

func NewGetReleaseTargetsForDeploymentAndEnvironment(opts ...Option) *PostgresGetReleaseTargetsForDeploymentAndEnvironment {
	return &PostgresGetReleaseTargetsForDeploymentAndEnvironment{cache: buildCache(opts)}
}

func (p *PostgresGetReleaseTargetsForDeploymentAndEnvironment) GetReleaseTargetsForDeploymentAndEnvironment(
	ctx context.Context,
	deploymentID, environmentID string,
) ([]oapi.ReleaseTarget, error) {
	ctx, span := tracer.Start(ctx, "Store.GetReleaseTargetsForDeploymentAndEnvironment")
	defer span.End()

	cacheKey := deploymentID + ":" + environmentID
	if p.cache != nil {
		if v, ok := p.cache.Get(cacheKey); ok {
			return v.([]oapi.ReleaseTarget), nil
		}
	}

	depID, err := uuid.Parse(deploymentID)
	if err != nil {
		return nil, fmt.Errorf("parse deployment id: %w", err)
	}

	envID, err := uuid.Parse(environmentID)
	if err != nil {
		return nil, fmt.Errorf("parse environment id: %w", err)
	}

	rows, err := db.GetQueries(ctx).
		GetReleaseTargetsForDeploymentAndEnvironment(ctx, db.GetReleaseTargetsForDeploymentAndEnvironmentParams{
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

	if p.cache != nil {
		p.cache.SetDefault(cacheKey, targets)
	}

	return targets, nil
}
