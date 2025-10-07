package store

import (
	"context"
	"workspace-engine/pkg/pb"
	"workspace-engine/pkg/workspace/store/repository"
)

func NewJobs(store *Store) *Jobs {
	return &Jobs{
		repo: store.repo,
	}
}

type Jobs struct {
	repo *repository.Repository
}

func (j *Jobs) Items() map[string]*pb.Job {
	return j.repo.Jobs.Items()
}

func (j *Jobs) Upsert(ctx context.Context, job *pb.Job) {
	j.repo.Jobs.Set(job.Id, job)
}

func (j *Jobs) Get(id string) (*pb.Job, bool) {
	return j.repo.Jobs.Get(id)
}

func (j *Jobs) Has(id string) bool {
	return j.repo.Jobs.Has(id)
}

func (j *Jobs) GetPending() map[string]*pb.Job {
	jobs := make(map[string]*pb.Job, j.repo.Jobs.Count())
	for jobItem := range j.repo.Jobs.IterBuffered() {
		if jobItem.Val.Status != pb.JobStatus_JOB_STATUS_PENDING {
			continue
		}
		jobs[jobItem.Key] = jobItem.Val
	}
	return jobs
}

func (j *Jobs) GetJobsForAgent(agentId string) map[string]*pb.Job {
	jobs := make(map[string]*pb.Job, j.repo.Jobs.Count())

	for jobItem := range j.repo.Jobs.IterBuffered() {
		if jobItem.Val.JobAgentId != agentId {
			continue
		}

		if jobItem.Val.Status != pb.JobStatus_JOB_STATUS_PENDING {
			continue
		}

		jobs[jobItem.Key] = jobItem.Val
	}

	return jobs
}

func (j *Jobs) GetJobsForReleaseTarget(releaseTarget *pb.ReleaseTarget) map[string]*pb.Job {
	jobs := make(map[string]*pb.Job, j.repo.Jobs.Count())
	for jobItem := range j.repo.Jobs.IterBuffered() {
		release, ok := j.repo.Releases.Get(jobItem.Val.ReleaseId)
		if !ok {
			continue
		}
		if release.ReleaseTarget.Key() != releaseTarget.Key() {
			continue
		}
		jobs[jobItem.Key] = jobItem.Val
	}
	return jobs
}

func (j *Jobs) GetJobsInProcessingStateForReleaseTarget(releaseTarget *pb.ReleaseTarget) map[string]*pb.Job {
	jobs := make(map[string]*pb.Job, j.repo.Jobs.Count())
	for _, job := range j.GetJobsForReleaseTarget(releaseTarget) {
		if !job.IsInProcessingState() {
			continue
		}
		jobs[job.Id] = job
	}
	return jobs
}

