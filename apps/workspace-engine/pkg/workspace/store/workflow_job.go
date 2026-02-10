package store

import (
	"context"
	"sort"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/store/repository"
)

func NewWorkflowJobs(store *Store) *WorkflowJobs {
	return &WorkflowJobs{
		repo:  store.repo,
		store: store,
	}
}

type WorkflowJobs struct {
	repo  *repository.InMemoryStore
	store *Store
}

func (w *WorkflowJobs) Items() map[string]*oapi.WorkflowJob {
	return w.repo.WorkflowJobs.Items()
}

func (w *WorkflowJobs) Get(id string) (*oapi.WorkflowJob, bool) {
	return w.repo.WorkflowJobs.Get(id)
}

func (w *WorkflowJobs) Upsert(ctx context.Context, workflowJob *oapi.WorkflowJob) {
	w.repo.WorkflowJobs.Set(workflowJob.Id, workflowJob)
	w.store.changeset.RecordUpsert(workflowJob)
}

func (w *WorkflowJobs) Remove(ctx context.Context, id string) {
	workflowJob, ok := w.repo.WorkflowJobs.Get(id)
	if !ok || workflowJob == nil {
		return
	}
	w.repo.WorkflowJobs.Remove(id)

	jobs := w.store.Jobs.GetByWorkflowJobId(id)
	for _, job := range jobs {
		w.store.Jobs.Remove(ctx, job.Id)
	}

	w.store.changeset.RecordDelete(workflowJob)
}

func (w *WorkflowJobs) GetByWorkflowId(workflowId string) []*oapi.WorkflowJob {
	wfJobs := make([]*oapi.WorkflowJob, 0)
	for _, job := range w.repo.WorkflowJobs.Items() {
		if job.WorkflowId == workflowId {
			wfJobs = append(wfJobs, job)
		}
	}
	sort.Slice(wfJobs, func(i, j int) bool {
		return wfJobs[i].Index < wfJobs[j].Index
	})
	return wfJobs
}
