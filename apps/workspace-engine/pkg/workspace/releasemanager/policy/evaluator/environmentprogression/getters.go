package environmentprogression

import (
	"context"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/store"
)

type Getters interface {
	GetEnvironments() map[string]*oapi.Environment
	GetEnvironment(environmentID string) (*oapi.Environment, bool)
	GetSystemIDsForEnvironment(environmentID string) []string
	GetReleaseTargetsForEnvironment(ctx context.Context, environmentID string) ([]*oapi.ReleaseTarget, error)
	GetReleaseTargetsForDeployment(ctx context.Context, deploymentID string) ([]*oapi.ReleaseTarget, error)
	GetJobsForReleaseTarget(releaseTarget *oapi.ReleaseTarget) map[string]*oapi.Job
	GetRelease(releaseID string) (*oapi.Release, bool)
	GetResource(resourceID string) (*oapi.Resource, bool)
	GetDeployment(deploymentID string) (*oapi.Deployment, bool)
	GetPolicies() map[string]*oapi.Policy
}

var _ Getters = (*storeGetters)(nil)

type storeGetters struct {
	store *store.Store
}

func (s *storeGetters) GetEnvironments() map[string]*oapi.Environment {
	return s.store.Environments.Items()
}

func (s *storeGetters) GetEnvironment(environmentID string) (*oapi.Environment, bool) {
	return s.store.Environments.Get(environmentID)
}

func (s *storeGetters) GetSystemIDsForEnvironment(environmentID string) []string {
	return s.store.SystemEnvironments.GetSystemIDsForEnvironment(environmentID)
}

func (s *storeGetters) GetReleaseTargetsForEnvironment(ctx context.Context, environmentID string) ([]*oapi.ReleaseTarget, error) {
	return s.store.ReleaseTargets.GetForEnvironment(ctx, environmentID)
}

func (s *storeGetters) GetReleaseTargetsForDeployment(ctx context.Context, deploymentID string) ([]*oapi.ReleaseTarget, error) {
	return s.store.ReleaseTargets.GetForDeployment(ctx, deploymentID)
}

func (s *storeGetters) GetJobsForReleaseTarget(releaseTarget *oapi.ReleaseTarget) map[string]*oapi.Job {
	return s.store.Jobs.GetJobsForReleaseTarget(releaseTarget)
}

func (s *storeGetters) GetRelease(releaseID string) (*oapi.Release, bool) {
	return s.store.Releases.Get(releaseID)
}

func (s *storeGetters) GetResource(resourceID string) (*oapi.Resource, bool) {
	return s.store.Resources.Get(resourceID)
}

func (s *storeGetters) GetDeployment(deploymentID string) (*oapi.Deployment, bool) {
	return s.store.Deployments.Get(deploymentID)
}

func (s *storeGetters) GetPolicies() map[string]*oapi.Policy {
	return s.store.Policies.Items()
}
