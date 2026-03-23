package versioncooldown

import (
	"context"
	"log/slog"

	"github.com/google/uuid"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/store"
	"workspace-engine/pkg/store/releasetargets"
)

type environmentGetter = store.EnvironmentGetter
type deploymentGetter = store.DeploymentGetter
type releaseGetter = store.ReleaseGetter
type resourceGetter = store.ResourceGetter
type jobsForReleaseTargetGetter = releasetargets.GetJobsForReleaseTarget

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

func NewPostgresGetters(queries *db.Queries, jobsForRT releasetargets.GetJobsForReleaseTarget) *PostgresGetters {
	if jobsForRT == nil {
		jobsForRT = releasetargets.NewGetJobsForReleaseTarget()
	}
	return &PostgresGetters{
		queries:                    queries,
		environmentGetter:          store.NewPostgresEnvironmentGetter(queries),
		deploymentGetter:           store.NewPostgresDeploymentGetter(queries),
		releaseGetter:              store.NewPostgresReleaseGetter(queries),
		resourceGetter:             store.NewPostgresResourceGetter(queries),
		jobsForReleaseTargetGetter: jobsForRT,
	}
}

type PostgresGetters struct {
	environmentGetter
	deploymentGetter
	releaseGetter
	resourceGetter
	jobsForReleaseTargetGetter
	queries *db.Queries
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
