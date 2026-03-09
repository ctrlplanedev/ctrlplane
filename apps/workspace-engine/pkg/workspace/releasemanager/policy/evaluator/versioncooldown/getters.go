package versioncooldown

import (
	"context"
	"fmt"
	"log/slog"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/store"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator"
	legacystore "workspace-engine/pkg/workspace/store"

	"github.com/charmbracelet/log"
	"github.com/google/uuid"
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

	GetJobsForReleaseTarget(releaseTarget *oapi.ReleaseTarget) map[string]*oapi.Job
	GetJobVerificationStatus(jobID string) oapi.JobVerificationStatus
	GetAllReleaseTargets(ctx context.Context, workspaceID string) ([]*oapi.ReleaseTarget, error)
}

var _ Getters = (*storeGetters)(nil)

func NewStoreGetters(ls *legacystore.Store) *storeGetters {
	return &storeGetters{
		environmentGetter: store.NewStoreEnvironmentGetter(ls),
		deploymentGetter:  store.NewStoreDeploymentGetter(ls),
		releaseGetter:     store.NewStoreReleaseGetter(ls),
		resourceGetter:    store.NewStoreResourceGetter(ls),
		store:             ls,
	}
}

type storeGetters struct {
	environmentGetter
	deploymentGetter
	releaseGetter
	resourceGetter

	store *legacystore.Store
}

func (s *storeGetters) GetJobsForReleaseTarget(releaseTarget *oapi.ReleaseTarget) map[string]*oapi.Job {
	return s.store.Jobs.GetJobsForReleaseTarget(releaseTarget)
}

func (s *storeGetters) GetJobVerificationStatus(jobID string) oapi.JobVerificationStatus {
	return s.store.JobVerifications.GetJobVerificationStatus(jobID)
}

func (s *storeGetters) GetAllReleaseTargets(_ context.Context, _ string) ([]*oapi.ReleaseTarget, error) {
	items, err := s.store.ReleaseTargets.Items()
	if err != nil {
		return nil, err
	}
	targets := make([]*oapi.ReleaseTarget, 0, len(items))
	for _, rt := range items {
		targets = append(targets, rt)
	}
	return targets, nil
}

func (s *storeGetters) NewVersionCooldownEvaluator(rule *oapi.PolicyRule) evaluator.Evaluator {
	return NewEvaluatorFromStore(s.store, rule)
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

func (p *PostgresGetters) GetJobsForReleaseTarget(releaseTarget *oapi.ReleaseTarget) map[string]*oapi.Job {
	if releaseTarget == nil {
		return nil
	}
	deploymentIDUUID, err := uuid.Parse(releaseTarget.DeploymentId)
	if err != nil {
		log.Error("failed to parse deployment id", "deploymentID", releaseTarget.DeploymentId, "error", err)
		return nil
	}
	environmentIDUUID, err := uuid.Parse(releaseTarget.EnvironmentId)
	if err != nil {
		log.Error("failed to parse environment id", "environmentID", releaseTarget.EnvironmentId, "error", err)
		return nil
	}
	resourceIDUUID, err := uuid.Parse(releaseTarget.ResourceId)
	if err != nil {
		log.Error("failed to parse resource id", "resourceID", releaseTarget.ResourceId, "error", err)
		return nil
	}
	rows, err := p.queries.ListJobsByReleaseTarget(context.Background(), db.ListJobsByReleaseTargetParams{
		DeploymentID:  deploymentIDUUID,
		EnvironmentID: environmentIDUUID,
		ResourceID:    resourceIDUUID,
	})
	if err != nil {
		log.Error("failed to get jobs for release target", "releaseTarget", releaseTarget.Key(), "error", err)
		return nil
	}
	jobs := make(map[string]*oapi.Job, len(rows))
	for _, row := range rows {
		job := db.ToOapiJob(db.ListJobsByReleaseIDRow(row))
		jobs[job.Id] = job
	}
	return jobs
}

func (p *PostgresGetters) GetAllReleaseTargets(ctx context.Context, workspaceID string) ([]*oapi.ReleaseTarget, error) {
	wsUUID, err := uuid.Parse(workspaceID)
	if err != nil {
		return nil, fmt.Errorf("parse workspace id: %w", err)
	}
	rows, err := p.queries.GetReleaseTargetsForWorkspace(ctx, wsUUID)
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
	jobUUID, err := uuid.Parse(jobID)
	if err != nil {
		slog.Error("parse jobID", "error", err)
		return ""
	}
	status, err := p.queries.GetAggregateJobVerificationStatus(context.Background(), jobUUID)
	if err != nil {
		slog.Error("failed to get job verification status", "jobID", jobID, "error", err)
		return ""
	}
	return oapi.JobVerificationStatus(status)
}
