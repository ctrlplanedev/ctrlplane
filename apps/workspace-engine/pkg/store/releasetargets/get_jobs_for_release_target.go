package releasetargets

import (
	"context"

	"github.com/google/uuid"
	gocache "github.com/patrickmn/go-cache"
	"go.opentelemetry.io/otel/attribute"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/oapi"
)

type GetJobsForReleaseTarget interface {
	GetJobsForReleaseTarget(
		ctx context.Context,
		releaseTarget *oapi.ReleaseTarget,
	) map[string]*oapi.Job
}

var _ GetJobsForReleaseTarget = (*PostgresGetJobsForReleaseTarget)(nil)

type PostgresGetJobsForReleaseTarget struct {
	cache *gocache.Cache
}

func NewGetJobsForReleaseTarget(opts ...Option) *PostgresGetJobsForReleaseTarget {
	return &PostgresGetJobsForReleaseTarget{cache: buildCache(opts)}
}

func (s *PostgresGetJobsForReleaseTarget) GetJobsForReleaseTarget(
	ctx context.Context,
	releaseTarget *oapi.ReleaseTarget,
) map[string]*oapi.Job {
	ctx, span := tracer.Start(ctx, "Store.GetJobsForReleaseTarget")
	defer span.End()

	span.SetAttributes(attribute.String("release_target.deployment_id", releaseTarget.DeploymentId))
	span.SetAttributes(
		attribute.String("release_target.environment_id", releaseTarget.EnvironmentId),
	)
	span.SetAttributes(attribute.String("release_target.resource_id", releaseTarget.ResourceId))

	if s.cache != nil {
		if v, ok := s.cache.Get(releaseTarget.Key()); ok {
			return v.(map[string]*oapi.Job)
		}
	}

	deploymentID, err := uuid.Parse(releaseTarget.DeploymentId)
	if err != nil {
		return nil
	}
	environmentID, err := uuid.Parse(releaseTarget.EnvironmentId)
	if err != nil {
		return nil
	}
	resourceID, err := uuid.Parse(releaseTarget.ResourceId)
	if err != nil {
		return nil
	}
	rows, err := db.GetQueries(ctx).ListJobsByReleaseTarget(ctx, db.ListJobsByReleaseTargetParams{
		DeploymentID:  deploymentID,
		EnvironmentID: environmentID,
		ResourceID:    resourceID,
	})
	if err != nil {
		return nil
	}

	jobs := make(map[string]*oapi.Job, len(rows))
	for _, row := range rows {
		jobs[row.ID.String()] = db.ToOapiJob(db.ListJobsByReleaseIDRow(row))
	}

	if s.cache != nil {
		s.cache.SetDefault(releaseTarget.Key(), jobs)
	}

	return jobs
}
