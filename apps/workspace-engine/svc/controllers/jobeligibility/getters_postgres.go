package jobeligibility

import (
	"context"
	"errors"

	"workspace-engine/pkg/db"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/store/policies"

	"github.com/charmbracelet/log"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"go.opentelemetry.io/otel/attribute"
)

var _ Getter = (*PostgresGetter)(nil)

type policiesGetter = policies.GetPoliciesForReleaseTarget

type PostgresGetter struct {
	policiesGetter
}

func NewPostgresGetter() *PostgresGetter {
	return &PostgresGetter{
		policiesGetter: &policies.PostgresGetPoliciesForReleaseTarget{},
	}
}

func (g *PostgresGetter) ReleaseTargetExists(ctx context.Context, rt *ReleaseTarget) (bool, error) {
	return db.GetQueries(ctx).ReleaseTargetExists(ctx, db.ReleaseTargetExistsParams{
		DeploymentID:  rt.DeploymentID,
		EnvironmentID: rt.EnvironmentID,
		ResourceID:    rt.ResourceID,
	})
}

func (g *PostgresGetter) GetDesiredRelease(
	ctx context.Context,
	rt *ReleaseTarget,
) (*oapi.Release, error) {
	ctx, span := tracer.Start(ctx, "GetDesiredRelease")
	defer span.End()

	span.SetAttributes(
		attribute.String("release_target.resource_id", rt.ResourceID.String()),
		attribute.String("release_target.environment_id", rt.EnvironmentID.String()),
		attribute.String("release_target.deployment_id", rt.DeploymentID.String()),
	)

	// TODO: Implement once the desired_release DB schema and queries exist.
	row, err := db.GetQueries(ctx).
		GetDesiredReleaseByReleaseTarget(ctx, db.GetDesiredReleaseByReleaseTargetParams{
			ResourceID:    rt.ResourceID,
			EnvironmentID: rt.EnvironmentID,
			DeploymentID:  rt.DeploymentID,
		})
	if errors.Is(err, pgx.ErrNoRows) {
		span.AddEvent("no desired release found for release target")
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return db.ToOapiFullRelease(row), nil
}

func (g *PostgresGetter) GetJobsForReleaseTarget(
	ctx context.Context,
	releaseTarget *oapi.ReleaseTarget,
) map[string]*oapi.Job {
	deploymentID, err := uuid.Parse(releaseTarget.DeploymentId)
	if err != nil {
		log.Error(
			"failed to parse deployment id",
			"deploymentID",
			releaseTarget.DeploymentId,
			"error",
			err,
		)
		return nil
	}
	environmentID, err := uuid.Parse(releaseTarget.EnvironmentId)
	if err != nil {
		log.Error(
			"failed to parse environment id",
			"environmentID",
			releaseTarget.EnvironmentId,
			"error",
			err,
		)
		return nil
	}
	resourceID, err := uuid.Parse(releaseTarget.ResourceId)
	if err != nil {
		log.Error(
			"failed to parse resource id",
			"resourceID",
			releaseTarget.ResourceId,
			"error",
			err,
		)
		return nil
	}
	rows, err := db.GetQueries(ctx).ListJobsByReleaseTarget(ctx, db.ListJobsByReleaseTargetParams{
		DeploymentID:  deploymentID,
		EnvironmentID: environmentID,
		ResourceID:    resourceID,
	})
	if err != nil {
		log.Error(
			"failed to get jobs for release target",
			"releaseTarget",
			releaseTarget.Key(),
			"error",
			err,
		)
		return nil
	}
	jobs := make(map[string]*oapi.Job, len(rows))
	for _, row := range rows {
		job := db.ToOapiJob(db.ListJobsByReleaseIDRow(row))
		jobs[job.Id] = job
	}
	return jobs
}

func (g *PostgresGetter) GetJobsInProcessingStateForReleaseTarget(
	ctx context.Context,
	releaseTarget *oapi.ReleaseTarget,
) map[string]*oapi.Job {
	deploymentID, err := uuid.Parse(releaseTarget.DeploymentId)
	if err != nil {
		log.Error(
			"failed to parse deployment id",
			"deploymentID",
			releaseTarget.DeploymentId,
			"error",
			err,
		)
		return nil
	}
	environmentID, err := uuid.Parse(releaseTarget.EnvironmentId)
	if err != nil {
		log.Error(
			"failed to parse environment id",
			"environmentID",
			releaseTarget.EnvironmentId,
			"error",
			err,
		)
		return nil
	}
	resourceID, err := uuid.Parse(releaseTarget.ResourceId)
	if err != nil {
		log.Error(
			"failed to parse resource id",
			"resourceID",
			releaseTarget.ResourceId,
			"error",
			err,
		)
		return nil
	}
	rows, err := db.GetQueries(ctx).
		ListJobsByReleaseTargetWithStatuses(ctx, db.ListJobsByReleaseTargetWithStatusesParams{
			DeploymentID:  deploymentID,
			EnvironmentID: environmentID,
			ResourceID:    resourceID,
			Statuses:      []string{"in_progress", "action_required", "pending"},
		})
	if err != nil {
		log.Error(
			"failed to get jobs for release target",
			"releaseTarget",
			releaseTarget.Key(),
			"error",
			err,
		)
		return nil
	}
	jobs := make(map[string]*oapi.Job, len(rows))
	for _, row := range rows {
		job := db.ToOapiJob(db.ListJobsByReleaseIDRow(row))
		jobs[job.Id] = job
	}
	return jobs
}

func (g *PostgresGetter) GetDeployment(
	ctx context.Context,
	deploymentID uuid.UUID,
) (*oapi.Deployment, error) {
	row, err := db.GetQueries(ctx).GetDeploymentByID(ctx, deploymentID)
	if err != nil {
		return nil, err
	}
	return db.ToOapiDeployment(row), nil
}

func (g *PostgresGetter) GetJobAgent(
	ctx context.Context,
	jobAgentID uuid.UUID,
) (*oapi.JobAgent, error) {
	row, err := db.GetQueries(ctx).GetJobAgentByID(ctx, jobAgentID)
	if err != nil {
		return nil, err
	}
	return db.ToOapiJobAgent(row), nil
}

func (g *PostgresGetter) GetEnvironment(
	ctx context.Context,
	environmentID uuid.UUID,
) (*oapi.Environment, error) {
	row, err := db.GetQueries(ctx).GetEnvironmentByID(ctx, environmentID)
	if err != nil {
		return nil, err
	}
	return db.ToOapiEnvironment(row), nil
}

func (g *PostgresGetter) GetResource(
	ctx context.Context,
	resourceID uuid.UUID,
) (*oapi.Resource, error) {
	row, err := db.GetQueries(ctx).GetResourceByID(ctx, resourceID)
	if err != nil {
		return nil, err
	}
	return db.ToOapiResource(row), nil
}
