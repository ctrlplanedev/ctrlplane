package store

import (
	"context"
	"workspace-engine/pkg/changeset"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/store/repository"
)

func NewJobs(store *Store) *Jobs {
	return &Jobs{
		repo: store.repo,
		store: store,
	}
}

type Jobs struct {
	repo *repository.Repository
	store *Store
}

func (j *Jobs) Items() map[string]*oapi.Job {
	return j.repo.Jobs.Items()
}

func (j *Jobs) Upsert(ctx context.Context, job *oapi.Job) {
	j.repo.Jobs.Set(job.Id, job)

	if cs, ok := changeset.FromContext[any](ctx); ok {
		cs.Record(changeset.ChangeTypeUpsert, job)
	}
}

func (j *Jobs) Get(id string) (*oapi.Job, bool) {
	return j.repo.Jobs.Get(id)
}

func (j *Jobs) Has(id string) bool {
	return j.repo.Jobs.Has(id)
}

func (j *Jobs) GetByJobAgentAndExternalId(jobAgentId string, externalId string) (*oapi.Job, bool) {
	for jobItem := range j.repo.Jobs.IterBuffered() {
		if jobItem.Val.JobAgentId == jobAgentId &&
			jobItem.Val.ExternalId != nil &&
			*jobItem.Val.ExternalId == externalId {
			return jobItem.Val, true
		}
	}

	return nil, false
}

func (j *Jobs) GetPending() map[string]*oapi.Job {
	jobs := make(map[string]*oapi.Job, j.repo.Jobs.Count())
	for jobItem := range j.repo.Jobs.IterBuffered() {
		if jobItem.Val.Status != oapi.Pending {
			continue
		}
		jobs[jobItem.Key] = jobItem.Val
	}
	return jobs
}

func (j *Jobs) GetJobsForAgent(agentId string) map[string]*oapi.Job {
	jobs := make(map[string]*oapi.Job, j.repo.Jobs.Count())

	for jobItem := range j.repo.Jobs.IterBuffered() {
		if jobItem.Val.JobAgentId != agentId {
			continue
		}

		if jobItem.Val.Status != oapi.Pending {
			continue
		}

		jobs[jobItem.Key] = jobItem.Val
	}

	return jobs
}

func (j *Jobs) GetJobsForReleaseTarget(releaseTarget *oapi.ReleaseTarget) map[string]*oapi.Job {
	jobs := make(map[string]*oapi.Job, j.repo.Jobs.Count())
	for jobItem := range j.repo.Jobs.IterBuffered() {
		release, ok := j.repo.Releases.Get(jobItem.Val.ReleaseId)
		if !ok || release == nil {
			continue
		}
		if release.ReleaseTarget.Key() != releaseTarget.Key() {
			continue
		}
		jobs[jobItem.Key] = jobItem.Val
	}
	return jobs
}

func (j *Jobs) GetJobsInProcessingStateForReleaseTarget(releaseTarget *oapi.ReleaseTarget) map[string]*oapi.Job {
	jobs := make(map[string]*oapi.Job, j.repo.Jobs.Count())
	for _, job := range j.GetJobsForReleaseTarget(releaseTarget) {
		if !job.IsInProcessingState() {
			continue
		}
		jobs[job.Id] = job
	}
	return jobs
}
