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
		jobCopy := *job
		jobs = append(jobs, &jobCopy)
	}

	sort.Slice(jobs, func(i, j int) bool {
		return jobs[i].GetUpdatedAt().After(jobs[j].GetUpdatedAt())
	})

	return jobs
}

func (jr *JobRepository) Get(ctx context.Context, jobID string) *job.Job {
	jr.mu.RLock()
	defer jr.mu.RUnlock()

	job := jr.jobs[jobID]
	if job == nil {
		return nil
	}

	jobCopy := *job
	return &jobCopy
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

	jobCopy := *job
	jobCopyPtr := &jobCopy

	now := time.Now().UTC()
	if jobCopy.CreatedAt.IsZero() {
		jobCopyPtr.CreatedAt = now
	}
	if jobCopyPtr.UpdatedAt.IsZero() {
		jobCopyPtr.UpdatedAt = now
	}

	jr.jobs[jobCopyPtr.GetID()] = jobCopyPtr

	return nil
}

func (jr *JobRepository) Update(ctx context.Context, job *job.Job) error {
	jr.mu.Lock()
	defer jr.mu.Unlock()

	if job == nil {
		return fmt.Errorf("job is nil")
	}

	currentJobPtr, ok := jr.jobs[job.GetID()]
	if !ok {
		return fmt.Errorf("job does not exist")
	}

	merged := *currentJobPtr

	// Merge mutable fields from new job into current job. Zero values are not overwritten.
	if job.JobAgentID != nil {
		merged.JobAgentID = job.JobAgentID
	}

	if job.JobAgentConfig != nil {
		merged.JobAgentConfig = job.JobAgentConfig
	}

	if job.ExternalID != nil {
		merged.ExternalID = job.ExternalID
	}

	if job.Status != "" {
		merged.Status = job.Status
	}

	if job.Reason != "" {
		merged.Reason = job.Reason
	}

	if job.Message != nil {
		merged.Message = job.Message
	}

	if !job.StartedAt.IsZero() {
		merged.StartedAt = job.StartedAt
	}

	if !job.CompletedAt.IsZero() {
		merged.CompletedAt = job.CompletedAt
	}

	merged.UpdatedAt = time.Now().UTC()

	jr.jobs[merged.GetID()] = &merged

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
