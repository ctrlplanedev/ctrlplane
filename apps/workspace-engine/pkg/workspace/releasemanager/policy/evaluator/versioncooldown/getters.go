package versioncooldown

import (
	"context"
	"log/slog"

	"github.com/charmbracelet/log"
	"github.com/google/uuid"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/store"
)

type environmentGetter = store.EnvironmentGetter
type deploymentGetter = store.DeploymentGetter
type releaseGetter = store.ReleaseGetter
type resourceGetter = store.ResourceGetter

type Getters interface {
	environmentGetter
	deploymentGetter
	releaseGetter
	resourceGetter

	GetJobsForReleaseTarget(
		ctx context.Context,
		releaseTarget *oapi.ReleaseTarget,
	) map[string]*oapi.Job
	GetJobVerificationStatus(jobID string) oapi.JobVerificationStatus
	GetAllReleaseTargets(ctx context.Context, workspaceID string) ([]*oapi.ReleaseTarget, error)
}

var _ Getters = (*PostgresGetters)(nil)

func NewPostgresGetters(queries *db.Queries) *PostgresGetters {
	return &PostgresGetters{
		queries:           queries,
		environmentGetter: store.NewPostgresEnvironmentGetter(queries),
		deploymentGetter:  store.NewPostgresDeploymentGetter(queries),
		releaseGetter:     store.NewPostgresReleaseGetter(queries),
		resourceGetter:    store.NewPostgresResourceGetter(queries),
	}
}

type PostgresGetters struct {
	environmentGetter
	deploymentGetter
	releaseGetter
	resourceGetter
	queries *db.Queries
}

func (p *PostgresGetters) GetJobsForReleaseTarget(
	ctx context.Context,
	releaseTarget *oapi.ReleaseTarget,
) map[string]*oapi.Job {
	if releaseTarget == nil {
		return nil
	}
	deploymentIDUUID, err := uuid.Parse(releaseTarget.DeploymentId)
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
	environmentIDUUID, err := uuid.Parse(releaseTarget.EnvironmentId)
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
	resourceIDUUID, err := uuid.Parse(releaseTarget.ResourceId)
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
	rows, err := p.queries.ListJobsByReleaseTarget(ctx, db.ListJobsByReleaseTargetParams{
		DeploymentID:  deploymentIDUUID,
		EnvironmentID: environmentIDUUID,
		ResourceID:    resourceIDUUID,
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

func (p *PostgresGetters) GetAllReleaseTargets(
	ctx context.Context,
	workspaceID string,
) ([]*oapi.ReleaseTarget, error) {
	rows, err := p.queries.GetReleaseTargetsForWorkspace(ctx, uuid.MustParse(workspaceID))
	if err != nil {
		return nil, err
	}
	targets := make([]*oapi.ReleaseTarget, len(rows))
	for i, row := range rows {
		targets[i] = &oapi.ReleaseTarget{
			DeploymentId:  row.DeploymentID.String(),
			EnvironmentId: row.EnvironmentID.String(),
			ResourceId:    row.ResourceID.String(),
		}
	}
	return targets, nil
}

func (p *PostgresGetters) GetJobVerificationStatus(jobID string) oapi.JobVerificationStatus {
	status, err := p.queries.GetAggregateJobVerificationStatus(
		context.Background(),
		uuid.MustParse(jobID),
	)
	if err != nil {
		slog.Error("failed to get job verification status", "jobID", jobID, "error", err)
		return ""
	}
	return oapi.JobVerificationStatus(status)
}
