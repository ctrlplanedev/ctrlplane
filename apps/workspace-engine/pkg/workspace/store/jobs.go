package store

import (
	"context"
	"fmt"
	"sort"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/store/repository"
)

func NewJobs(store *Store) *Jobs {
	return &Jobs{
		repo:  store.repo.JobsRepo(),
		store: store,
	}
}

type Jobs struct {
	repo  repository.JobRepo
	store *Store
}

func (j *Jobs) SetRepo(repo repository.JobRepo) {
	j.repo = repo
}

func (j *Jobs) Items() map[string]*oapi.Job {
	return j.repo.Items()
}

func (j *Jobs) Upsert(ctx context.Context, job *oapi.Job) {
	_ = j.repo.Set(job)
	j.store.changeset.RecordUpsert(job)
}

func (j *Jobs) Get(id string) (*oapi.Job, bool) {
	return j.repo.Get(id)
}

func (j *Jobs) Remove(ctx context.Context, id string) {
	job, ok := j.repo.Get(id)
	if !ok || job == nil {
		return
	}
	_ = j.repo.Remove(id)
	j.store.changeset.RecordDelete(job)
}

func (j *Jobs) GetPending() map[string]*oapi.Job {
	jobs := make(map[string]*oapi.Job)
	for _, job := range j.repo.Items() {
		if job.Status != oapi.JobStatusPending {
			continue
		}
		jobs[job.Id] = job
	}
	return jobs
}

func (j *Jobs) GetJobsForAgent(agentId string) map[string]*oapi.Job {
	jobs := make(map[string]*oapi.Job)
	jobItems, err := j.repo.GetByAgentID(agentId)
	if err != nil {
		return nil
	}
	for _, job := range jobItems {
		jobs[job.Id] = job
	}
	return jobs
}

func (j *Jobs) GetJobsForReleaseTarget(releaseTarget *oapi.ReleaseTarget) map[string]*oapi.Job {
	jobs := make(map[string]*oapi.Job)
	if releaseTarget == nil {
		return jobs
	}

	releases, err := j.store.Releases.GetByReleaseTargetKey(releaseTarget.Key())
	if err != nil {
		return jobs
	}

	for _, release := range releases {
		releaseJobs := j.store.Releases.Jobs(release.ID())
		for _, job := range releaseJobs {
			jobs[job.Id] = job
		}
	}

	return jobs
}

func (j *Jobs) GetLatestCompletedJobForReleaseTarget(releaseTarget *oapi.ReleaseTarget) *oapi.Job {
	jobs := j.GetJobsForReleaseTarget(releaseTarget)
	if len(jobs) == 0 {
		return nil
	}
	jobsList := make([]*oapi.Job, 0)
	for _, job := range jobs {
		if job.CompletedAt != nil {
			jobsList = append(jobsList, job)
		}
	}
	if len(jobsList) == 0 {
		return nil
	}
	sort.Slice(jobsList, func(i, j int) bool {
		return jobsList[i].CompletedAt.After(*jobsList[j].CompletedAt)
	})
	return jobsList[0]
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
	release, ok := j.store.Releases.Get(job.ReleaseId)
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

func (j *Jobs) GetByWorkflowJobId(workflowJobId string) []*oapi.Job {
	jobs := make([]*oapi.Job, 0)
	for _, job := range j.repo.Items() {
		if job.WorkflowJobId == workflowJobId {
			jobs = append(jobs, job)
		}
	}
	return jobs
}
