package environmentprogression

import (
	"context"
	"fmt"
	"time"

	"workspace-engine/pkg/oapi"
)

var _ Getters = (*mockGetters)(nil)

type mockGetters struct {
	environments           map[string]*oapi.Environment
	deployments            map[string]*oapi.Deployment
	resources              map[string]*oapi.Resource
	releaseTargets         []*oapi.ReleaseTarget
	jobs                   map[string]map[string]*oapi.Job // releaseTarget.Key() -> jobID -> job
	systemEnvs             map[string][]string             // envID -> systemIDs
	releaseByJob           map[string]*oapi.Release        // jobID -> release
	policies               map[string]*oapi.Policy
	jobVerificationStatus  map[string]string // jobID -> verification status
}

func newMockGetters() *mockGetters {
	return &mockGetters{
		environments:          make(map[string]*oapi.Environment),
		deployments:           make(map[string]*oapi.Deployment),
		resources:             make(map[string]*oapi.Resource),
		releaseTargets:        make([]*oapi.ReleaseTarget, 0),
		jobs:                  make(map[string]map[string]*oapi.Job),
		systemEnvs:            make(map[string][]string),
		releaseByJob:          make(map[string]*oapi.Release),
		policies:              make(map[string]*oapi.Policy),
		jobVerificationStatus: make(map[string]string),
	}
}

func (m *mockGetters) GetEnvironment(_ context.Context, id string) (*oapi.Environment, error) {
	env, ok := m.environments[id]
	if !ok {
		return nil, fmt.Errorf("environment %s not found", id)
	}
	return env, nil
}

func (m *mockGetters) GetAllEnvironments(
	_ context.Context,
	_ string,
) (map[string]*oapi.Environment, error) {
	return m.environments, nil
}

func (m *mockGetters) GetDeployment(_ context.Context, id string) (*oapi.Deployment, error) {
	dep, ok := m.deployments[id]
	if !ok {
		return nil, fmt.Errorf("deployment %s not found", id)
	}
	return dep, nil
}

func (m *mockGetters) GetAllDeployments(
	_ context.Context,
	_ string,
) (map[string]*oapi.Deployment, error) {
	return m.deployments, nil
}

func (m *mockGetters) GetRelease(_ context.Context, id string) (*oapi.Release, error) {
	return nil, fmt.Errorf("release %s not found", id)
}

func (m *mockGetters) GetResource(_ context.Context, id string) (*oapi.Resource, error) {
	res, ok := m.resources[id]
	if !ok {
		return nil, fmt.Errorf("resource %s not found", id)
	}
	return res, nil
}

func (m *mockGetters) GetReleaseTargetsForDeploymentAndEnvironment(
	_ context.Context,
	deploymentID, environmentID string,
) ([]oapi.ReleaseTarget, error) {
	var result []oapi.ReleaseTarget
	for _, rt := range m.releaseTargets {
		if rt.DeploymentId == deploymentID && rt.EnvironmentId == environmentID {
			result = append(result, *rt)
		}
	}
	return result, nil
}

func (m *mockGetters) GetSystemIDsForEnvironment(envID string) []string {
	return m.systemEnvs[envID]
}

func (m *mockGetters) GetReleaseTargetsForDeployment(
	_ context.Context,
	deploymentID string,
) ([]*oapi.ReleaseTarget, error) {
	var result []*oapi.ReleaseTarget
	for _, rt := range m.releaseTargets {
		if rt.DeploymentId == deploymentID {
			result = append(result, rt)
		}
	}
	return result, nil
}

func (m *mockGetters) GetJobsForReleaseTarget(
	_ context.Context,
	rt *oapi.ReleaseTarget,
) map[string]*oapi.Job {
	return m.jobs[rt.Key()]
}

func (m *mockGetters) GetAllPolicies(_ context.Context, _ string) (map[string]*oapi.Policy, error) {
	return m.policies, nil
}

func (m *mockGetters) GetReleaseByJobID(_ context.Context, jobID string) (*oapi.Release, error) {
	rel, ok := m.releaseByJob[jobID]
	if !ok {
		return nil, fmt.Errorf("release for job %s not found", jobID)
	}
	return rel, nil
}

func (m *mockGetters) GetJobsForEnvironmentAndVersion(
	_ context.Context,
	environmentID string,
	versionID string,
) ([]ReleaseTargetJob, error) {
	var result []ReleaseTargetJob
	for _, jobMap := range m.jobs {
		for _, job := range jobMap {
			rel, ok := m.releaseByJob[job.Id]
			if !ok {
				continue
			}
			if rel.ReleaseTarget.EnvironmentId != environmentID {
				continue
			}
			if rel.Version.Id != versionID {
				continue
			}
			result = append(result, ReleaseTargetJob{
				JobID:              job.Id,
				Status:             job.Status,
				CompletedAt:        job.CompletedAt,
				DeploymentID:       rel.ReleaseTarget.DeploymentId,
				EnvironmentID:      rel.ReleaseTarget.EnvironmentId,
				ResourceID:         rel.ReleaseTarget.ResourceId,
				VerificationStatus: m.jobVerificationStatus[job.Id],
			})
		}
	}
	return result, nil
}

func (m *mockGetters) addReleaseTarget(rt *oapi.ReleaseTarget) {
	m.releaseTargets = append(m.releaseTargets, rt)
}

func (m *mockGetters) addJob(rt *oapi.ReleaseTarget, job *oapi.Job, release *oapi.Release) {
	key := rt.Key()
	if m.jobs[key] == nil {
		m.jobs[key] = make(map[string]*oapi.Job)
	}
	m.jobs[key][job.Id] = job
	m.releaseByJob[job.Id] = release
}

// setupMock creates the base mock matching the original setupTestStore layout:
// 3 environments (dev, staging, prod), 1 deployment, 1 resource, 3 release targets,
// all in system-1.
func setupMock() *mockGetters {
	m := newMockGetters()

	resourceSelector := "true"

	m.environments["env-dev"] = &oapi.Environment{
		Id:               "env-dev",
		Name:             "dev",
		ResourceSelector: &resourceSelector,
	}
	m.environments["env-staging"] = &oapi.Environment{
		Id:               "env-staging",
		Name:             "staging",
		ResourceSelector: &resourceSelector,
	}
	m.environments["env-prod"] = &oapi.Environment{
		Id:               "env-prod",
		Name:             "prod",
		ResourceSelector: &resourceSelector,
	}

	m.systemEnvs["env-dev"] = []string{"system-1"}
	m.systemEnvs["env-staging"] = []string{"system-1"}
	m.systemEnvs["env-prod"] = []string{"system-1"}

	m.deployments["deploy-1"] = &oapi.Deployment{
		Id:             "deploy-1",
		Name:           "my-app",
		Slug:           "my-app",
		JobAgentConfig: oapi.JobAgentConfig{},
	}

	m.resources["resource-1"] = &oapi.Resource{
		Id:          "resource-1",
		Identifier:  "test-resource",
		Kind:        "service",
		WorkspaceId: "workspace-1",
		Config:      map[string]any{},
		Metadata:    map[string]string{},
		CreatedAt:   time.Now(),
	}

	m.addReleaseTarget(
		&oapi.ReleaseTarget{
			ResourceId:    "resource-1",
			EnvironmentId: "env-dev",
			DeploymentId:  "deploy-1",
		},
	)
	m.addReleaseTarget(
		&oapi.ReleaseTarget{
			ResourceId:    "resource-1",
			EnvironmentId: "env-staging",
			DeploymentId:  "deploy-1",
		},
	)
	m.addReleaseTarget(
		&oapi.ReleaseTarget{
			ResourceId:    "resource-1",
			EnvironmentId: "env-prod",
			DeploymentId:  "deploy-1",
		},
	)

	return m
}

// setupMockForSoakTime creates a mock matching setupTestStoreForSoakTime:
// 1 environment (staging), 1 deployment, linked in system-1.
func setupMockForSoakTime() *mockGetters {
	m := newMockGetters()

	resourceSelector := "true"

	m.environments["env-staging"] = &oapi.Environment{
		Id:               "env-staging",
		Name:             "staging",
		ResourceSelector: &resourceSelector,
	}
	m.systemEnvs["env-staging"] = []string{"system-1"}

	m.deployments["deploy-1"] = &oapi.Deployment{
		Id:             "deploy-1",
		Name:           "my-app",
		Slug:           "my-app",
		JobAgentConfig: oapi.JobAgentConfig{},
	}

	return m
}

// setupMockForPassRate creates a mock matching setupTestStoreForPassRate:
// 1 environment (staging), 1 deployment, linked in system-1.
func setupMockForPassRate() *mockGetters {
	return setupMockForSoakTime()
}

// setupMockForJobTracker creates a mock matching setupTestStoreForJobTracker:
// 2 environments (env-1 staging, env-2 prod), 1 deployment, linked in system-1.
func setupMockForJobTracker() (*mockGetters, *oapi.DeploymentVersion) {
	m := newMockGetters()

	m.environments["env-1"] = &oapi.Environment{Id: "env-1", Name: "staging"}
	m.environments["env-2"] = &oapi.Environment{Id: "env-2", Name: "prod"}
	m.systemEnvs["env-1"] = []string{"system-1"}
	m.systemEnvs["env-2"] = []string{"system-1"}

	m.deployments["deploy-1"] = &oapi.Deployment{
		Id:             "deploy-1",
		Name:           "my-app",
		Slug:           "my-app",
		JobAgentConfig: oapi.JobAgentConfig{},
	}

	version := &oapi.DeploymentVersion{
		Id:           "version-1",
		Name:         "v1.0.0",
		Tag:          "v1.0.0",
		DeploymentId: "deploy-1",
		Status:       oapi.DeploymentVersionStatusReady,
		CreatedAt:    time.Now(),
	}

	return m, version
}
