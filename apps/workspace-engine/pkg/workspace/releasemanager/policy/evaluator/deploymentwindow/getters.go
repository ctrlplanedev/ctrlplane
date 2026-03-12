package deploymentwindow

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/oapi"
)

type Getters interface {
	HasCurrentRelease(ctx context.Context, releaseTarget *oapi.ReleaseTarget) (bool, error)
}

var _ Getters = (*PostgresGetters)(nil)

func NewPostgresGetters(queries *db.Queries) *PostgresGetters {
	return &PostgresGetters{
		queries: queries,
	}
}

type PostgresGetters struct {
	queries *db.Queries
}

func (g *PostgresGetters) HasCurrentRelease(
	ctx context.Context,
	releaseTarget *oapi.ReleaseTarget,
) (bool, error) {
	releases, err := db.GetQueries(ctx).
		ListReleasesByReleaseTarget(ctx, db.ListReleasesByReleaseTargetParams{
			ResourceID:    uuid.MustParse(releaseTarget.ResourceId),
			EnvironmentID: uuid.MustParse(releaseTarget.EnvironmentId),
			DeploymentID:  uuid.MustParse(releaseTarget.DeploymentId),
		})
	if err != nil {
		return false, fmt.Errorf("list releases for release target: %w", err)
	}
	return len(releases) > 0, nil
}
