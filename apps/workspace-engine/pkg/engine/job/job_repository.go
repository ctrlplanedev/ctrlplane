package job

import (
	"context"
	"fmt"
	"sort"
	"sync"
	"time"
	"workspace-engine/pkg/model"
	"workspace-engine/pkg/model/job"
)

var _ model.Repository[job.Job] = (*JobRepository)(nil)

type JobRepository struct {
	jobs map[string]*job.Job
	mu   sync.RWMutex
}

func NewJobRepository() *JobRepository {
	return &JobRepository{
		jobs: make(map[string]*job.Job),
	}
}

func (jr *JobRepository) GetAll(ctx context.Context) []*job.Job {
	jr.mu.RLock()
	defer jr.mu.RUnlock()

	jobs := make([]*job.Job, 0, len(jr.jobs))
	for _, job := range jr.jobs {
		jobs = append(jobs, job)
	}

	sort.Slice(jobs, func(i, j int) bool {
		return jobs[i].GetUpdatedAt().After(jobs[j].GetUpdatedAt())
	})

	return jobs
}

func (jr *JobRepository) Get(ctx context.Context, jobID string) *job.Job {
	jr.mu.RLock()
	defer jr.mu.RUnlock()

	return jr.jobs[jobID]
}

func (jr *JobRepository) Create(ctx context.Context, job *job.Job) error {
	jr.mu.Lock()
	defer jr.mu.Unlock()

	if job == nil {
		return fmt.Errorf("job is nil")
	}

	if _, ok := jr.jobs[job.GetID()]; ok {
		return fmt.Errorf("job already exists")
	}

	now := time.Now().UTC()
	if job.CreatedAt.IsZero() {
		job.CreatedAt = now
	}
	if job.UpdatedAt.IsZero() {
		job.UpdatedAt = now
	}

	jr.jobs[job.GetID()] = job

	return nil
}

func (jr *JobRepository) Update(ctx context.Context, job *job.Job) error {
	jr.mu.Lock()
	defer jr.mu.Unlock()

	if job == nil {
		return fmt.Errorf("job is nil")
	}

	currentJob, ok := jr.jobs[job.GetID()]
	if !ok {
		return fmt.Errorf("job does not exist")
	}

	isUpdatedAtStale := job.UpdatedAt.IsZero() ||
		job.UpdatedAt.Before(currentJob.UpdatedAt) ||
		job.UpdatedAt.Equal(currentJob.UpdatedAt)

	if isUpdatedAtStale {
		job.UpdatedAt = time.Now().UTC()
	}

	jr.jobs[job.GetID()] = job

	return nil
}

func (jr *JobRepository) Delete(ctx context.Context, jobID string) error {
	jr.mu.Lock()
	defer jr.mu.Unlock()

	if _, ok := jr.jobs[jobID]; !ok {
		return fmt.Errorf("job does not exist")
	}

	delete(jr.jobs, jobID)

	return nil
}

func (jr *JobRepository) Exists(ctx context.Context, jobID string) bool {
	jr.mu.RLock()
	defer jr.mu.RUnlock()

	_, ok := jr.jobs[jobID]
	return ok
}
