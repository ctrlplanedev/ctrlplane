package versioncooldown

import (
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/db/getters"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator"
	"workspace-engine/pkg/workspace/store"
)

type deploymentGetter = getters.DeploymentGetter
type environmentGetter = getters.EnvironmentGetter
type resourceGetter = getters.ResourceGetter

type Getters interface {
	deploymentGetter
	environmentGetter
	resourceGetter

	GetJobsForReleaseTarget(releaseTarget *oapi.ReleaseTarget) map[string]*oapi.Job
	GetRelease(releaseID string) (*oapi.Release, bool)
	GetJobVerificationStatus(jobID string) oapi.JobVerificationStatus
	GetReleaseTargets() ([]*oapi.ReleaseTarget, error)
	NewVersionCooldownEvaluator(rule *oapi.PolicyRule) evaluator.Evaluator
}

var _ Getters = (*storeGetters)(nil)

type storeGetters struct {
	deploymentGetter
	environmentGetter
	resourceGetter
	store *store.Store
}

func NewStoreGetters(store *store.Store) *storeGetters {
	return &storeGetters{
		deploymentGetter: getters.NewStoreDeploymentGetter(store),
		environmentGetter: getters.NewStoreEnvironmentGetter(store),
		resourceGetter: getters.NewStoreResourceGetter(store),
		store: store,
	}
}

func (s *storeGetters) GetJobsForReleaseTarget(releaseTarget *oapi.ReleaseTarget) map[string]*oapi.Job {
	return s.store.Jobs.GetJobsForReleaseTarget(releaseTarget)
}

func (s *storeGetters) GetRelease(releaseID string) (*oapi.Release, bool) {
	return s.store.Releases.Get(releaseID)
}

func (s *storeGetters) GetJobVerificationStatus(jobID string) oapi.JobVerificationStatus {
	return s.store.JobVerifications.GetJobVerificationStatus(jobID)
}

func (s *storeGetters) GetReleaseTargets() ([]*oapi.ReleaseTarget, error) {
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

var _ Getters = (*postgresGetters)(nil)


type postgresGetters struct {
	queries *db.Queries
	deploymentGetter deploymentGetter
	environmentGetter environmentGetter
	resourceGetter resourceGetter
}

func NewPostgresGetters(queries *db.Queries) *postgresGetters {
	return &postgresGetters{
		queries: queries,
		deploymentGetter: getters.NewPostgresDeploymentGetter(queries),
		environmentGetter: getters.NewPostgresEnvironmentGetter(queries),
		resourceGetter: getters.NewPostgresResourceGetter(queries),
	}
}
