package versioncooldown

import (
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator"
	"workspace-engine/pkg/workspace/store"
)

type Getters interface {
	GetJobsForReleaseTarget(releaseTarget *oapi.ReleaseTarget) map[string]*oapi.Job
	GetRelease(releaseID string) (*oapi.Release, bool)
	GetJobVerificationStatus(jobID string) oapi.JobVerificationStatus
	GetReleaseTargets() ([]*oapi.ReleaseTarget, error)
	GetEnvironment(environmentID string) (*oapi.Environment, bool)
	GetResource(resourceID string) (*oapi.Resource, bool)
	GetDeployment(deploymentID string) (*oapi.Deployment, bool)
	NewVersionCooldownEvaluator(rule *oapi.PolicyRule) evaluator.Evaluator
}

var _ Getters = (*storeGetters)(nil)

type storeGetters struct {
	store *store.Store
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

func (s *storeGetters) GetEnvironment(environmentID string) (*oapi.Environment, bool) {
	return s.store.Environments.Get(environmentID)
}

func (s *storeGetters) GetResource(resourceID string) (*oapi.Resource, bool) {
	return s.store.Resources.Get(resourceID)
}

func (s *storeGetters) GetDeployment(deploymentID string) (*oapi.Deployment, bool) {
	return s.store.Deployments.Get(deploymentID)
}

func (s *storeGetters) NewVersionCooldownEvaluator(rule *oapi.PolicyRule) evaluator.Evaluator {
	return NewEvaluatorFromStore(s.store, rule)
}
