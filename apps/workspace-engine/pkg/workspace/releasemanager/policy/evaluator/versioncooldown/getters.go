package versioncooldown

import (
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/store"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator"
	legacystore "workspace-engine/pkg/workspace/store"
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
	GetReleaseTargets() ([]*oapi.ReleaseTarget, error)
	NewVersionCooldownEvaluator(rule *oapi.PolicyRule) evaluator.Evaluator
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

// GetJobsForReleaseTarget implements [Getters].
func (p *PostgresGetters) GetJobsForReleaseTarget(releaseTarget *oapi.ReleaseTarget) map[string]*oapi.Job {
	panic("unimplemented")
}

// GetReleaseTargets implements [Getters].
func (p *PostgresGetters) GetReleaseTargets() ([]*oapi.ReleaseTarget, error) {
	panic("unimplemented")
}

// NewVersionCooldownEvaluator implements [Getters].
func (p *PostgresGetters) NewVersionCooldownEvaluator(rule *oapi.PolicyRule) evaluator.Evaluator {
	panic("unimplemented")
}

func (p *PostgresGetters) GetJobVerificationStatus(jobID string) oapi.JobVerificationStatus {
	return oapi.JobVerificationStatusCancelled
}
