package store

import (
	"context"
	"workspace-engine/pkg/changeset"
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
	return j.repo.Jobs
}

func (j *Jobs) Upsert(ctx context.Context, job *oapi.Job) {
	j.repo.Jobs.Set(job.Id, job)

	if cs, ok := changeset.FromContext[any](ctx); ok {
		cs.Record(changeset.ChangeTypeUpsert, job)
	}

	j.store.changeset.RecordUpsert(job)
}

func (j *Jobs) Get(id string) (*oapi.Job, bool) {
	return j.repo.Jobs.Get(id)
}

func (j *Jobs) GetPending() map[string]*oapi.Job {
	jobs := make(map[string]*oapi.Job)
	for _, job := range j.repo.Jobs {
		if job.Status != oapi.Pending {
			continue
		}
		jobs[job.Id] = job
	}
	return jobs
}

func (j *Jobs) GetJobsForAgent(agentId string) map[string]*oapi.Job {
	jobs := make(map[string]*oapi.Job)

	for _, job := range j.repo.Jobs {
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
	for _, job := range j.repo.Jobs {
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
