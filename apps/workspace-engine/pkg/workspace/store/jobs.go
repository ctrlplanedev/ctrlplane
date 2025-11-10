package store

import (
	"context"
	"fmt"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/store/repository"
)

func NewJobs(store *Store) *Jobs {
	return &Jobs{
		repo:  store.repo,
		store: store,
	}
}

type Jobs struct {
	repo  *repository.InMemoryStore
	store *Store
}

func (j *Jobs) Items() map[string]*oapi.Job {
	return j.repo.Jobs.Items()
}

func (j *Jobs) Upsert(ctx context.Context, job *oapi.Job) {
	j.repo.Jobs.Set(job.Id, job)
	j.store.changeset.RecordUpsert(job)
}

func (j *Jobs) Get(id string) (*oapi.Job, bool) {
	return j.repo.Jobs.Get(id)
}

func (j *Jobs) GetPending() map[string]*oapi.Job {
	jobs := make(map[string]*oapi.Job)
	for _, job := range j.repo.Jobs.Items() {
		if job.Status != oapi.JobStatusPending {
			continue
		}
		jobs[job.Id] = job
	}
	return jobs
}

func (j *Jobs) GetJobsForAgent(agentId string) map[string]*oapi.Job {
	jobs := make(map[string]*oapi.Job)

	for _, job := range j.repo.Jobs.Items() {
		if job.JobAgentId != agentId {
			continue
		}
		jobs[job.Id] = job
	}
	return jobs
}

func (j *Jobs) GetJobsForReleaseTarget(releaseTarget *oapi.ReleaseTarget) map[string]*oapi.Job {
	jobs := make(map[string]*oapi.Job)
	if releaseTarget == nil {
		return jobs
	}
	for _, job := range j.repo.Jobs.Items() {
		release, ok := j.repo.Releases.Get(job.ReleaseId)
		if !ok || release == nil {
			continue
		}
		if release.ReleaseTarget.Key() != releaseTarget.Key() {
			continue
		}
		jobs[job.Id] = job
	}
	return jobs
}

func (j *Jobs) GetJobsInProcessingStateForReleaseTarget(releaseTarget *oapi.ReleaseTarget) map[string]*oapi.Job {
	jobs := make(map[string]*oapi.Job)
	for _, job := range j.GetJobsForReleaseTarget(releaseTarget) {
		if !job.IsInProcessingState() {
			continue
		}
		jobs[job.Id] = job
	}
	return jobs
}

func (j *Jobs) GetWithRelease(id string) (*oapi.JobWithRelease, error) {
	job, ok := j.Get(id)
	if !ok {
		return nil, fmt.Errorf("job not found")
	}
	release, ok := j.repo.Releases.Get(job.ReleaseId)
	if !ok {
		return nil, fmt.Errorf("release not found")
	}

	environment, ok := j.store.Environments.Get(release.ReleaseTarget.EnvironmentId)
	if !ok {
		return nil, fmt.Errorf("environment not found")
	}
	deployment, ok := j.store.Deployments.Get(release.ReleaseTarget.DeploymentId)
	if !ok {
		return nil, fmt.Errorf("deployment not found")
	}
	resource, ok := j.store.Resources.Get(release.ReleaseTarget.ResourceId)
	if !ok {
		return nil, fmt.Errorf("resource not found")
	}

	return &oapi.JobWithRelease{
		Job:         *job,
		Release:     *release,
		Environment: environment,
		Deployment:  deployment,
		Resource:    resource,
	}, nil
}
