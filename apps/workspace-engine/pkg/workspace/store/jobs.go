package store

import (
	"context"
	"fmt"
	"time"
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

// MostRecentForReleaseTarget returns the most recently created job for a given release target.
// It searches all jobs and finds the one with the latest CreatedAt for the specified release target ID.
func (j *Jobs) MostRecentForReleaseTarget(ctx context.Context, releaseTarget *pb.ReleaseTarget) (*pb.Job, error) {
	var mostRecentJob *pb.Job
	var mostRecentCreatedAt string

	for jobItem := range j.repo.Jobs.IterBuffered() {
		job := jobItem.Val
		release, ok := j.repo.Releases.Get(job.ReleaseId)
		if !ok {
			continue
		}
		if release.ReleaseTarget.Key() != releaseTarget.Key() {
			continue
		}

		jobCreatedAtTime, err := job.CreatedAtTime()
		if err != nil {
			continue // skip jobs with invalid CreatedAt
		}
	
		var mostRecentTime time.Time
		if mostRecentCreatedAt != "" {
			mostRecentTime, err = mostRecentJob.CreatedAtTime()
			if err != nil {
				continue
			}
		}
	
		if mostRecentJob == nil || jobCreatedAtTime.After(mostRecentTime) {
			mostRecentJob = job
			mostRecentCreatedAt = job.CreatedAt
		}
	}

	if mostRecentJob == nil {
		return nil, fmt.Errorf("no jobs found for release target %s", releaseTarget.Key())
	}

	return mostRecentJob, nil
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